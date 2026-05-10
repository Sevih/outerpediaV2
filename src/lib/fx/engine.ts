import * as THREE from 'three'
import type { FxDescriptor, FxLayer, FxGradient, FxSizeOverLifetime } from './types'
import { VERT, FRAG } from './shaders/particle_ui'

const TEXTURE_BASE = '/images/fx'

const textureCache = new Map<string, Promise<THREE.Texture>>()
// Unity's `Texture.whiteTexture` — the default Unity binds to any unassigned
// sampler. We mirror that behavior so layers that omit a slot in their
// material still render correctly.
const fallbackWhite = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
})()

function loadTexture(name: string | null): Promise<THREE.Texture> {
  if (!name) return Promise.resolve(fallbackWhite)
  const url = `${TEXTURE_BASE}/${name}.webp`
  let p = textureCache.get(url)
  if (!p) {
    const loader = new THREE.TextureLoader()
    p = new Promise((resolve) => {
      loader.load(
        url,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.colorSpace = THREE.SRGBColorSpace
          tex.minFilter = THREE.LinearFilter
          tex.magFilter = THREE.LinearFilter
          tex.generateMipmaps = false
          resolve(tex)
        },
        undefined,
        // Fall back to the white default on any load error (404, decode, …).
        // Throwing here would propagate up and unmount the entire scene.
        () => resolve(fallbackWhite),
      )
    })
    textureCache.set(url, p)
  }
  return p
}

// Sample a Unity gradient at normalized t in [0..1].
function sampleGradient(g: FxGradient | undefined, t: number): [number, number, number, number] {
  if (!g || !g.colorKeys.length) return [1, 1, 1, 1]
  const tt = THREE.MathUtils.clamp(t, 0, 1) * 65535

  // Color: lerp between consecutive color keys (numColorKeys, ctimes)
  const nC = Math.max(g.numColorKeys, 1)
  let r = g.colorKeys[0][0]
  let gg = g.colorKeys[0][1]
  let b = g.colorKeys[0][2]
  for (let i = 0; i < nC - 1; i++) {
    const t0 = g.ctimes[i]
    const t1 = g.ctimes[i + 1]
    if (tt >= t0 && tt <= t1) {
      const span = Math.max(t1 - t0, 1)
      const k = (tt - t0) / span
      r = THREE.MathUtils.lerp(g.colorKeys[i][0], g.colorKeys[i + 1][0], k)
      gg = THREE.MathUtils.lerp(g.colorKeys[i][1], g.colorKeys[i + 1][1], k)
      b = THREE.MathUtils.lerp(g.colorKeys[i][2], g.colorKeys[i + 1][2], k)
      break
    }
    if (tt > t1) {
      r = g.colorKeys[i + 1][0]
      gg = g.colorKeys[i + 1][1]
      b = g.colorKeys[i + 1][2]
    }
  }

  // Alpha: same idea on (numAlphaKeys, atimes), pulled from colorKeys[i][3]
  const nA = Math.max(g.numAlphaKeys, 1)
  let a = g.colorKeys[0][3]
  for (let i = 0; i < nA - 1; i++) {
    const t0 = g.atimes[i]
    const t1 = g.atimes[i + 1]
    if (tt >= t0 && tt <= t1) {
      const span = Math.max(t1 - t0, 1)
      const k = (tt - t0) / span
      a = THREE.MathUtils.lerp(g.colorKeys[i][3], g.colorKeys[i + 1][3], k)
      break
    }
    if (tt > t1) a = g.colorKeys[i + 1][3]
  }

  return [r, gg, b, a]
}

interface LayerMesh {
  layer: FxLayer
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
}

interface ParticleState {
  spawnTime: number      // negative offset so the loop starts mid-cycle for variety
  spawnPos: [number, number]
  velocity: [number, number]   // world units per second (camera frustum -0.5..0.5)
  size: number                 // particle world size as fraction of card width
  rotation: number             // radians, fixed for the particle's lifetime
  lifetime: number
}

interface ParticleEmitter {
  layer: FxLayer
  particles: { mesh: THREE.Mesh; material: THREE.ShaderMaterial; state: ParticleState }[]
  gradient?: FxGradient
  sizeOverLifetime?: FxSizeOverLifetime
}

function rangeRandom(c?: { value: number; min?: number }): number {
  if (!c) return 0
  if (c.min === undefined || c.min === c.value) return c.value
  const a = Math.min(c.value, c.min)
  const b = Math.max(c.value, c.min)
  return a + Math.random() * (b - a)
}

function rangeMid(c?: { value: number; min?: number }): number {
  if (!c) return 0
  if (c.min === undefined || c.min === c.value) return c.value
  return (c.value + c.min) / 2
}

// Sample a Unity AnimationCurve (linear interpolation between keys, scaled
// by the scalar multiplier). t is the normalized particle age in [0, 1].
function sampleSizeCurve(sol: FxSizeOverLifetime | undefined, t: number): number {
  if (!sol || !sol.curve || sol.curve.length === 0) return 1
  const keys = sol.curve
  const scalar = sol.scalar ?? 1
  if (t <= keys[0].t) return keys[0].v * scalar
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v * scalar
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) {
      const span = keys[i + 1].t - keys[i].t
      const k = span > 0 ? (t - keys[i].t) / span : 0
      return (keys[i].v + k * (keys[i + 1].v - keys[i].v)) * scalar
    }
  }
  return scalar
}

export class FxScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private layerMeshes: LayerMesh[] = []
  private emitters: ParticleEmitter[] = []
  private startTime = 0
  private rafId = 0
  private disposed = false
  // Card size inside the canvas (canvas extends `bleed` px past on each side).
  private cardW = 100
  private cardH = 100
  // Multiplier on elapsed seconds passed to u_time. The Unity shader uses
  // `_Time.x * 20.0` which evaluates to elapsed real seconds, so 1.0 is the
  // ground-truth Unity speed. Tunable for visual A/B testing.
  private speedScale = 1.0
  // Particle world-size compensation. Unity's startSize × localScale is
  // expressed in Canvas units; without the Canvas scaler data we expose
  // this as a tunable, default 0.25.
  private particleSizeFactor = 0.25

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    })
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    // World space = pixel space: 1 world unit = 1 canvas pixel on both axes.
    // The frustum is set in resize() once we know the canvas size. This keeps
    // particle quads square in pixels regardless of card aspect/rotation.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
    this.camera.position.z = 1
  }

  async load(descriptor: FxDescriptor): Promise<void> {
    for (const layer of descriptor.layers) {
      const sx = layer.transform.localScale[0]
      const sy = layer.transform.localScale[1]
      // Skip invisible root layer (Unity convention: scale=0 disables render).
      if (sx === 0 || sy === 0) continue

      if (!layer.renderer.material) continue

      // Particle emitter: large *square* localScale (50–60 typical) means
      // Unity emits many small sprites at random positions, with localScale
      // being the per-particle WORLD size. Render via the particle emitter
      // (N stacked quads with random spawn / age / drift / rotation).
      // Non-uniform scale (e.g. web at 6.72×11.5) is a stretched static
      // decoration, not a real particle stream — skip until we have proper
      // scaled-quad rendering (otherwise we'd spawn N giant quads → blob).
      const isLarge = Math.abs(sx) > 1.5 || Math.abs(sy) > 1.5
      const isSquare = Math.abs(Math.abs(sx) - Math.abs(sy)) < 0.1 * Math.max(Math.abs(sx), Math.abs(sy))
      if (isLarge && isSquare) {
        await this.createParticleEmitter(layer)
        continue
      }
      if (isLarge && !isSquare) {
        // Stretched decoration layer — skip rather than spawn a giant blob.
        continue
      }

      // Skip "aura" out-layers — they run _MainStrength ≥ 50 with no _AlphaTex
      // to confine them. In Unity that brightness is naturally bounded
      // because the layer is a 30-particle emission stacked at origin with
      // random rotations and a gradient alpha ≈0.67; with a single quad it
      // just saturates the whole card to white.
      const m = layer.renderer.material
      const alphaTexOn = m.floats._ALPHA_TEX_ON === 1
      const mainStrength = m.floats._MainStrength ?? 1
      if (mainStrength >= 50 && !alphaTexOn) continue

      const mat = await this.makeMaterial(layer)
      // When _MainTex is unbound the layer relies on _AlphaStrength × the
      // mask to drive intensity. Unity emits ~30 particles with randomised
      // rotation and per-particle gradient cycle; the in-game framebuffer
      // ends up roughly rgb × tint.a per pixel after additive blend with the
      // (dim) card behind. With one quad on a bright DOM card composed via
      // plus-lighter, peak intensity blows out. Cap _AlphaStrength to 1 (so
      // alpha doesn't saturate the mask area) and dampen rgb proportionally.
      if (!m.textures._MainTex?.file) {
        const aStrength = m.floats._AlphaStrength ?? 1
        if (aStrength > 1) {
          mat.uniforms.u_alphaStrength.value = 1
          mat.uniforms.u_mainStrength.value *= 1 / aStrength
        }
      }
      const geo = new THREE.PlaneGeometry(1, 1)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = layer.depth
      this.scene.add(mesh)
      this.layerMeshes.push({ layer, mesh, material: mat })
    }
    this.applyMeshScales()
  }

  private async createParticleEmitter(layer: FxLayer): Promise<void> {
    const p = layer.particle
    const lifetime = Math.max(rangeMid(p.startLifetime), 0.5)
    const rate = rangeMid(p.emission?.rateOverTime)
    const burstTotal = (p.emission?.bursts ?? []).reduce(
      (sum, b) => sum + rangeMid(b.count) * (b.cycleCount || 1),
      0,
    )
    // Cap N to avoid additive saturation when many particles overlap.
    const aliveCount = Math.max(2, Math.min(20, Math.ceil(rate * lifetime + burstTotal)))

    const baseMaterial = await this.makeMaterial(layer)
    // Particles overlap and accumulate additively; some materials use
    // _MainStrength=4 (or more) which saturates the entire card. Dampen the
    // strength on the per-particle clones so the visual stays in the
    // intended brightness band when many particles overlap.
    const PARTICLE_BRIGHTNESS = 0.4
    baseMaterial.uniforms.u_mainStrength.value *= PARTICLE_BRIGHTNESS
    const geo = new THREE.PlaneGeometry(1, 1)
    const localScaleX = layer.transform.localScale[0]
    const localScaleY = layer.transform.localScale[1]
    const gradient = p.colorOverLifetime?.maxGradient

    // UV module: Unity divides _MainTex into a tilesX × tilesY grid of sub-
    // sprites. Each particle picks a frame in [frameOverTime.value × N,
    // frameOverTime.min × N], where N = tilesX × tilesY.
    const uv = p.uvModule
    const baseMainSt = layer.renderer.material!.textures._MainTex
    const origST = baseMainSt
      ? new THREE.Vector4(baseMainSt.scale[0], baseMainSt.scale[1], baseMainSt.offset[0], baseMainSt.offset[1])
      : new THREE.Vector4(1, 1, 0, 0)

    const particles: ParticleEmitter['particles'] = []
    for (let i = 0; i < aliveCount; i++) {
      const mat = baseMaterial.clone()
      mat.uniforms = THREE.UniformsUtils.clone(baseMaterial.uniforms)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = layer.depth + 100
      this.scene.add(mesh)

      // Per-particle atlas tile selection — pre-bake the tile sub-rect into
      // u_mainST so the shader doesn't need to know about UV tiling.
      // Unity TSA places frame 0 at the TOP-LEFT of the sheet (PNG row 0),
      // advancing right then down. Three.js's flipY=true means UV.v=0 samples
      // the BOTTOM row of the source PNG, so we mirror the row index:
      //   tileY (UV offset row, 0=bottom-of-UV) = (tilesY-1) - unityRow.
      if (uv && uv.tilesX > 1 && uv.tilesY > 1) {
        const tilesTotal = uv.tilesX * uv.tilesY
        let fLo = (uv.frameOverTime.value ?? 0) * tilesTotal
        let fHi = (uv.frameOverTime.min ?? uv.frameOverTime.value ?? 1) * tilesTotal
        // T_FX_Atlas_01 has the small star/bubble sprites in the TOP-LEFT 2
        // rows of the PNG (Unity frames 0–15 in 8×8 layout). The middle rows
        // hold large rings that span 2 cells; sampling them at 8×8 gives the
        // "quarter circle" fragments the user reports. Narrow the range to
        // the well-formed sprite band when the prefab would otherwise hit
        // the rings.
        const isSharedAtlas = baseMainSt?.file === 'T_FX_Atlas_01'
        if (isSharedAtlas && uv.tilesX === 8 && uv.tilesY === 8) {
          fLo = 0
          fHi = 16
        }
        const frame = Math.floor(Math.min(fLo, fHi) + Math.random() * Math.abs(fHi - fLo))
        const idx = Math.max(0, Math.min(tilesTotal - 1, frame))
        const tileX = idx % uv.tilesX
        const unityRow = Math.floor(idx / uv.tilesX) // 0 = top of PNG
        const tileY = uv.tilesY - 1 - unityRow       // 0 = bottom of UV (post-flipY)
        const effST = new THREE.Vector4(
          origST.x / uv.tilesX,
          origST.y / uv.tilesY,
          origST.z / uv.tilesX + tileX / uv.tilesX,
          origST.w / uv.tilesY + tileY / uv.tilesY,
        )
        ;(mat.uniforms.u_mainST.value as THREE.Vector4).copy(effST)
      }

      // Particle world size = startSize × localScale (Hierarchy scaling) in
      // Unity 100-unit space. We've moved to a pixel-uniform world (1 world
      // = 1 canvas px), so on a card of width cardW px:
      //   size_px = (startSize × localScale / 100) × cardW × particleSizeFactor
      // particleSizeFactor compensates for the parent Canvas scaling we
      // don't have data for; tunable at runtime.
      const startSize = rangeRandom(p.startSize)
      const sizeX = (Math.abs(localScaleX) * startSize * this.particleSizeFactor) / 100
      const sizeY = (Math.abs(localScaleY) * startSize * this.particleSizeFactor) / 100
      // Speed is in Unity world units / sec. Outerplane's parent Canvas
      // applies a screen-size scaling factor we don't have data for; in
      // practice particles drift faster on screen than the raw values
      // suggest, so apply a 5× compensation.
      const SPEED_FACTOR = 5
      const startSpeed = (rangeRandom(p.startSpeed) * SPEED_FACTOR) / 100
      const state: ParticleState = {
        spawnTime: -i * (lifetime / aliveCount),
        // In-game bubbles/sparkles drift up *from the bottom* of the card,
        // not random across the whole frame. Spawn in the lower half so the
        // entire trajectory stays inside the card area.
        spawnPos: [Math.random() - 0.5, Math.random() * 0.4 - 0.5],
        velocity: [0, startSpeed],
        size: (sizeX + sizeY) / 2,
        rotation: rangeRandom(p.startRotation),
        lifetime,
      }
      particles.push({ mesh, material: mat, state })
    }

    baseMaterial.dispose()
    this.emitters.push({
      layer,
      particles,
      gradient,
      sizeOverLifetime: p.sizeOverLifetime,
    })
  }

  private applyMeshScales() {
    // Frame layers fill the card area in pixels. localScale=1 → card size,
    // 1.05 → 5% spill into the bleed margin.
    for (const lm of this.layerMeshes) {
      const sx = lm.layer.transform.localScale[0]
      const sy = lm.layer.transform.localScale[1]
      lm.mesh.scale.set(sx * this.cardW, sy * this.cardH, 1)
    }
  }

  private async makeMaterial(layer: FxLayer): Promise<THREE.ShaderMaterial> {
    const m = layer.renderer.material!
    const tex = m.textures
    const f = m.floats
    const c = m.colors

    // Unity's default for any unassigned sampler is `Texture.whiteTexture`
    // (1×1 RGBA(1,1,1,1)). Several Demi-family materials leave _MainTex,
    // _NoiseTex, etc. blank — they rely on the white default so the
    // alpha-from-mainTex.r path stays >0 and the layer is visible.
    const [main, second, third, noise, alpha] = await Promise.all([
      loadTexture(tex._MainTex?.file ?? null),
      loadTexture(tex._SecondTex?.file ?? null),
      loadTexture(tex._ThirdTex?.file ?? null),
      loadTexture(tex._NoiseTex?.file ?? null),
      loadTexture(tex._AlphaTex?.file ?? null),
    ])

    // Unity packs ST as vec4(scale.x, scale.y, offset.x, offset.y).
    const stVec4 = (key: string) => {
      const s = tex[key]
      return s
        ? new THREE.Vector4(s.scale[0], s.scale[1], s.offset[0], s.offset[1])
        : new THREE.Vector4(1, 1, 0, 0)
    }

    const speedVec = (key: string) => {
      const v = c[key]
      return new THREE.Vector2(v?.[0] ?? 0, v?.[1] ?? 0)
    }

    const colorVec = (key: string, def: [number, number, number, number] = [1, 1, 1, 1]) => {
      const v = c[key] ?? def
      return new THREE.Vector4(v[0], v[1], v[2], v[3])
    }

    const flag = (key: string) => (f[key] === 1 ? 1 : 0)

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Pure additive between layers inside the canvas. Each layer outputs
      // premultiplied rgb already (rgb × alpha) with alpha=1, so One + One
      // sums their intensities.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: {
        u_time: { value: 0 },
        u_tint: { value: new THREE.Vector4(1, 1, 1, 1) },
        u_color: { value: colorVec('_Color') },

        u_mainTex: { value: main },
        u_secondTex: { value: second },
        u_thirdTex: { value: third },
        u_noiseTex: { value: noise },
        u_alphaTex: { value: alpha },

        u_mainST: { value: stVec4('_MainTex') },
        u_secondST: { value: stVec4('_SecondTex') },
        u_thirdST: { value: stVec4('_ThirdTex') },
        u_noiseST: { value: stVec4('_NoiseTex') },
        u_alphaST: { value: stVec4('_AlphaTex') },

        u_mainSpeed: { value: speedVec('_MainSpeed') },
        u_secondSpeed: { value: speedVec('_SecondTexSpeed') },
        u_thirdSpeed: { value: speedVec('_ThirdTexSpeed') },
        u_noiseSpeed: { value: speedVec('_NoiseSpeed') },
        u_alphaSpeed: { value: speedVec('_AlphaSpeed') },

        // _MainContrast uniform: when _MAIN_CONTRAST_ON=0, we feed 0 to the
        // shader to bypass pow() (the extracted Unity shader checks `==0`).
        u_mainContrast: {
          value: flag('_MAIN_CONTRAST_ON') === 1 ? (f._MainContrast ?? 1) : 0,
        },
        u_mainStrength: { value: f._MainStrength ?? 1 },
        u_noiseStrength: { value: f._NoiseStrength ?? 0 },
        u_alphaStrength: { value: f._AlphaStrength ?? 1 },

        u_mainClamp: { value: flag('_MAIN_CLAMP') },
        u_mainTexAssigned: { value: tex._MainTex?.file ? 1 : 0 },
        u_secondTexOn: { value: flag('_SECOND_TEX_ON') },
        u_secondTypeAdd: { value: flag('_SECOND_TYPE_ADD') },
        u_thirdTexOn: { value: flag('_THIRD_TEX_ON') },
        u_thirdTypeAdd: { value: flag('_THIRD_TYPE_ADD') },
        u_alphaTexOn: { value: flag('_ALPHA_TEX_ON') },
        u_noiseUvOn: { value: flag('_NOISE_UV_ON') },
        u_mainAlphaChannelOn: { value: flag('_MAIN_ALPHACHANNEL_ON') },
      },
    })

    return material
  }

  start() {
    if (this.rafId) return
    this.startTime = performance.now()
    const tick = () => {
      if (this.disposed) return
      const elapsed = (performance.now() - this.startTime) / 1000
      const tShader = elapsed * this.speedScale
      // Frame layers — single quad per layer, gradient sampled at duration
      // progress (looped).
      for (const lm of this.layerMeshes) {
        const dur = Math.max(lm.layer.particle.duration, 0.001)
        const tNorm = (elapsed % dur) / dur
        const grad = lm.layer.particle.colorOverLifetime?.maxGradient
        const tint = sampleGradient(grad, tNorm)
        lm.material.uniforms.u_time.value = tShader
        ;(lm.material.uniforms.u_tint.value as THREE.Vector4).set(...tint)
      }
      // Particles in pixel-uniform world: size in pixels (square regardless
      // of rotation), spawnPos in (-0.5..0.5) mapped to the card pixel area.
      const sizePx = this.cardW
      for (const em of this.emitters) {
        for (const p of em.particles) {
          const ageRaw = elapsed - p.state.spawnTime
          const age = ageRaw - Math.floor(ageRaw / p.state.lifetime) * p.state.lifetime
          const tNorm = age / p.state.lifetime
          const x = (p.state.spawnPos[0] + p.state.velocity[0] * age) * this.cardW
          const y = (p.state.spawnPos[1] + p.state.velocity[1] * age) * this.cardH
          p.mesh.position.set(x, y, 0)
          // SizeOverLifetime: per-particle size scales by the curve sampled
          // at the particle's normalized age. Without this Unity curve, the
          // particle stays at peak size and looks too big throughout life.
          const sizeMul = sampleSizeCurve(em.sizeOverLifetime, tNorm)
          const px = p.state.size * sizeMul * sizePx
          p.mesh.scale.set(px, px, 1)
          p.mesh.rotation.z = p.state.rotation
          const tint = sampleGradient(em.gradient, tNorm)
          ;(p.material.uniforms.u_tint.value as THREE.Vector4).set(...tint)
          p.material.uniforms.u_time.value = tShader
        }
      }
      this.renderer.render(this.scene, this.camera)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  setSpeedScale(scale: number) {
    this.speedScale = scale
  }

  setParticleSizeFactor(factor: number) {
    if (factor === this.particleSizeFactor) return
    const ratio = factor / Math.max(this.particleSizeFactor, 1e-6)
    this.particleSizeFactor = factor
    // Rescale every emitted particle's stored size in place.
    for (const em of this.emitters) {
      for (const p of em.particles) {
        p.state.size *= ratio
      }
    }
  }

  resize(cardW: number, cardH: number, bleed: number) {
    this.cardW = cardW
    this.cardH = cardH
    const canvasW = cardW + bleed * 2
    const canvasH = cardH + bleed * 2
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(canvasW, canvasH)
    // 1 world unit = 1 canvas pixel.
    this.camera.left = -canvasW / 2
    this.camera.right = canvasW / 2
    this.camera.top = canvasH / 2
    this.camera.bottom = -canvasH / 2
    this.camera.updateProjectionMatrix()
    this.applyMeshScales()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    for (const lm of this.layerMeshes) {
      lm.mesh.geometry.dispose()
      lm.material.dispose()
      this.scene.remove(lm.mesh)
    }
    for (const em of this.emitters) {
      for (const p of em.particles) {
        p.mesh.geometry.dispose()
        p.material.dispose()
        this.scene.remove(p.mesh)
      }
    }
    this.layerMeshes = []
    this.emitters = []
    this.renderer.dispose()
  }
}
