// Direct port of Unity shader `MASTA/S_Assemble_Particle_UI` (extracted from
// shader/common bundle, GLES3 variant). The original is a HLSLcc-decompiled
// fragment shader; this is the same algorithm written by hand.
//
//   1. NoiseTex sample (always — it gates UV distortion when _NOISE_UV_ON)
//   2. Main UV = ST + scroll(_MainSpeed) [+ noise distortion]; sample MainTex
//   3. Optional pow(main, _MainContrast) when _MAIN_CONTRAST_ON
//   4. Second UV = ST + scroll(_SecondTexSpeed) + noise distortion
//   5. Third UV  = ST + scroll(_ThirdTexSpeed)  + noise distortion
//   6. composite = (main op2 second) op3 third  (op2/op3 = '*' or '+' per TYPE_ADD)
//   7. rgb = composite × _MainStrength × _Color × particleColor
//   8. alpha = (_AlphaTex.r if _ALPHA_TEX_ON else 1) × mainRaw.r × _AlphaStrength
//   9. alpha ×= _Color.a × particleColor.a × clipFactor
//
// Output is `(rgb * alpha, 1.0)` — premultiplied — so it composes correctly
// over the DOM card via CSS `mix-blend-mode: plus-lighter` (Unity uses
// SrcAlpha + One inside the same framebuffer; we mirror that compositing
// semantics through the browser compositor instead).

export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float u_time;
uniform vec4  u_color;   // material _Color
uniform vec4  u_tint;    // gradient sample (acts as vs_COLOR0)

uniform sampler2D u_mainTex;
uniform sampler2D u_secondTex;
uniform sampler2D u_thirdTex;
uniform sampler2D u_noiseTex;
uniform sampler2D u_alphaTex;

uniform vec4 u_mainST;    // (scaleX, scaleY, offsetX, offsetY)
uniform vec4 u_secondST;
uniform vec4 u_thirdST;
uniform vec4 u_noiseST;
uniform vec4 u_alphaST;

uniform vec2 u_mainSpeed;
uniform vec2 u_secondSpeed;
uniform vec2 u_thirdSpeed;
uniform vec2 u_noiseSpeed;
uniform vec2 u_alphaSpeed;

uniform float u_mainContrast;    // 0 → bypass pow
uniform float u_mainStrength;
uniform float u_noiseStrength;
uniform float u_alphaStrength;

uniform int u_mainClamp;
uniform int u_mainTexAssigned;   // 0 = _MainTex slot was unbound in the prefab
uniform int u_secondTexOn;       // 0 = skip second contribution
uniform int u_secondTypeAdd;     // 0 = multiply, 1 = add
uniform int u_thirdTexOn;
uniform int u_thirdTypeAdd;
uniform int u_alphaTexOn;
uniform int u_noiseUvOn;
uniform int u_mainAlphaChannelOn; // 0 = alpha sourced from mainRaw.r, 1 = mainRaw.a

vec2 stUv(vec2 uv, vec4 st, vec2 speed) {
  return uv * st.xy + st.zw + speed * u_time;
}

void main() {
  // Sample noise (always — _NoiseTex is sampled even when distortion is off
  // to keep the variant uniform; in practice _NoiseTex is unassigned on Demi
  // materials and falls back to a 1×1 default texture, so noise.rg is constant).
  vec2 noiseUv = stUv(vUv, u_noiseST, u_noiseSpeed);
  vec2 noise   = texture2D(u_noiseTex, noiseUv).rg;
  vec2 dist    = (u_noiseUvOn == 1) ? noise * u_noiseStrength : vec2(0.0);

  // Main. When _MainTex was unbound in the prefab, the right default for the
  // RGB contribution depends on the composite operators: any additive op
  // enabled (main + tex) means main=0 (else it would lift the sum to white).
  // All multiplicative (main * tex) means main=1, Unity's white default,
  // else multiplication would zero out Second/Third. The alpha sampler
  // below always treats main as 1.
  vec2 mainUv = stUv(vUv, u_mainST, u_mainSpeed) + dist;
  if (u_mainClamp == 1) mainUv = clamp(mainUv, 0.0, 1.0);
  vec4 mainSample = texture2D(u_mainTex, mainUv);
  vec3 mainRaw;
  if (u_mainTexAssigned == 1) {
    mainRaw = mainSample.rgb;
  } else {
    bool anyAdd = ((u_secondTexOn == 1) && (u_secondTypeAdd == 1))
               || ((u_thirdTexOn  == 1) && (u_thirdTypeAdd  == 1));
    mainRaw = anyAdd ? vec3(0.0) : vec3(1.0);
  }
  vec3 mainContrasted = (u_mainContrast == 0.0)
    ? mainRaw
    : pow(max(mainRaw, vec3(0.0)), vec3(u_mainContrast));

  // Second (only if _SECOND_TEX_ON)
  vec3 step1 = mainContrasted;
  if (u_secondTexOn == 1) {
    vec2 secondUv = stUv(vUv, u_secondST, u_secondSpeed) + dist;
    vec3 second   = texture2D(u_secondTex, secondUv).rgb;
    step1 = (u_secondTypeAdd == 1) ? step1 + second : step1 * second;
  }

  // Third (only if _THIRD_TEX_ON)
  vec3 composite = step1;
  if (u_thirdTexOn == 1) {
    vec2 thirdUv = stUv(vUv, u_thirdST, u_thirdSpeed) + dist;
    vec3 third   = texture2D(u_thirdTex, thirdUv).rgb;
    composite = (u_thirdTypeAdd == 1) ? composite + third : composite * third;
  }

  vec3 rgb = composite * u_mainStrength * u_color.rgb * u_tint.rgb;

  // Alpha — gated by main's red (or alpha) channel × optional _AlphaTex.r ×
  // _AlphaStrength × tint alpha. When _MainTex is unbound the alpha source
  // collapses to 1 (let the mask + tint do the gating alone); otherwise
  // _MAIN_ALPHACHANNEL_ON picks .a vs .r.
  float mainAlphaSrc;
  if (u_mainTexAssigned == 0) {
    mainAlphaSrc = 1.0;
  } else if (u_mainAlphaChannelOn == 1) {
    mainAlphaSrc = mainSample.a;
  } else {
    mainAlphaSrc = mainSample.r;
  }
  float alpha = mainAlphaSrc * u_alphaStrength;
  if (u_alphaTexOn == 1) {
    vec2 alphaUv = stUv(vUv, u_alphaST, u_alphaSpeed);
    alpha *= texture2D(u_alphaTex, alphaUv).r;
  }
  alpha *= u_color.a * u_tint.a;
  alpha  = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(rgb * alpha, 1.0);
}
`
