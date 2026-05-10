// Mirrors data/admin/fx/fx_*.json produced by scripts/fx/dump_demi.py.

export interface MinMaxCurve {
  mode: number
  value: number
  min?: number
}

export interface FxGradient {
  colorKeys: [number, number, number, number][]
  ctimes: number[]
  atimes: number[]
  numColorKeys: number
  numAlphaKeys: number
}

export interface FxColorOverLifetime {
  mode: number
  maxGradient: FxGradient
  minGradient: FxGradient
}

export interface FxBurst {
  count: MinMaxCurve
  cycleCount: number
  repeatInterval: number
  probability: number
  time: number
}

export interface FxUvModule {
  tilesX: number
  tilesY: number
  frameOverTime: MinMaxCurve
  startFrame: MinMaxCurve
  cycles: number
  animationType: number
  rowMode: number
}

export interface FxSizeOverLifetime {
  mode: number
  scalar: number
  minScalar: number
  curve: { t: number; v: number }[] | null
  separateAxes: boolean
}

export interface FxParticle {
  duration: number
  looping: boolean
  playOnAwake: boolean
  startLifetime: MinMaxCurve
  startSpeed: MinMaxCurve
  startSize: MinMaxCurve
  startRotation: MinMaxCurve
  startRotationY: MinMaxCurve
  rotation3D: boolean
  maxNumParticles: number
  gravityModifier: MinMaxCurve
  colorOverLifetime?: FxColorOverLifetime
  emission?: { rateOverTime: MinMaxCurve; bursts: FxBurst[] }
  uvModule?: FxUvModule
  sizeOverLifetime?: FxSizeOverLifetime
}

export interface FxTextureSlot {
  file: string | null
  scale: [number, number]
  offset: [number, number]
}

export interface FxMaterial {
  name: string
  shader: string | null
  floats: Record<string, number>
  colors: Record<string, [number, number, number, number]>
  textures: Record<string, FxTextureSlot>
}

export interface FxRenderer {
  renderMode: number
  sortMode: number
  alignment: number
  lengthScale: number
  allowRoll: boolean
  maxParticleSize: number
  material?: FxMaterial
}

export interface FxTransform {
  localPosition: [number, number, number]
  localRotation: [number, number, number, number]
  localScale: [number, number, number]
  anchoredPosition: [number, number]
  sizeDelta: [number, number]
  pivot: [number, number]
}

export interface FxLayer {
  name: string
  depth: number
  transform: FxTransform
  particle: FxParticle
  renderer: FxRenderer
}

export interface FxDescriptor {
  name: string
  rect: { size: [number, number]; pivot: [number, number] }
  layers: FxLayer[]
}
