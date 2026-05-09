#ifdef FRAGMENT
#version 300 es

precision highp float;
precision highp int;
#define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
#if HLSLCC_ENABLE_UNIFORM_BUFFERS
#define UNITY_UNIFORM
#else
#define UNITY_UNIFORM uniform
#endif
#define UNITY_SUPPORTS_UNIFORM_LOCATION 1
#if UNITY_SUPPORTS_UNIFORM_LOCATION
#define UNITY_LOCATION(x) layout(location = x)
#define UNITY_BINDING(x) layout(binding = x, std140)
#else
#define UNITY_LOCATION(x)
#define UNITY_BINDING(x) layout(std140)
#endif
uniform 	vec4 _Time;
uniform 	vec4 _MainTex_ST;
uniform 	mediump vec4 _Color;
uniform 	mediump vec2 _MainSpeed;
uniform 	float _MainContrast;
uniform 	float _MainStrength;
uniform 	vec4 _SecondTex_ST;
uniform 	mediump vec2 _SecondTexSpeed;
uniform 	vec4 _ThirdTex_ST;
uniform 	mediump vec2 _ThirdTexSpeed;
uniform 	vec4 _NoiseTex_ST;
uniform 	mediump vec2 _NoiseSpeed;
uniform 	float _NoiseStrength;
uniform 	float _AlphaStrength;
uniform 	vec4 _ClipRect;
UNITY_LOCATION(0) uniform mediump sampler2D _NoiseTex;
UNITY_LOCATION(1) uniform mediump sampler2D _SecondTex;
UNITY_LOCATION(2) uniform mediump sampler2D _ThirdTex;
UNITY_LOCATION(3) uniform mediump sampler2D _MainTex;
in highp vec4 vs_COLOR0;
in highp vec2 vs_TEXCOORD0;
in highp vec4 vs_TEXCOORD3;
layout(location = 0) out mediump vec4 SV_Target0;
vec4 u_xlat0;
mediump vec3 u_xlat16_0;
bvec4 u_xlatb0;
vec4 u_xlat1;
mediump float u_xlat16_1;
vec3 u_xlat2;
vec3 u_xlat3;
mediump vec3 u_xlat16_3;
vec3 u_xlat4;
mediump vec3 u_xlat16_5;
vec3 u_xlat6;
bool u_xlatb6;
vec2 u_xlat8;
mediump vec2 u_xlat16_8;
vec2 u_xlat12;
float u_xlat20;
void main()
{
    u_xlatb0.xy = greaterThanEqual(vs_TEXCOORD3.xyxx, _ClipRect.xyxx).xy;
    u_xlatb0.zw = greaterThanEqual(_ClipRect.zzzw, vs_TEXCOORD3.xxxy).zw;
    u_xlat0.x = u_xlatb0.x ? float(1.0) : 0.0;
    u_xlat0.y = u_xlatb0.y ? float(1.0) : 0.0;
    u_xlat0.z = u_xlatb0.z ? float(1.0) : 0.0;
    u_xlat0.w = u_xlatb0.w ? float(1.0) : 0.0;
;
    u_xlat0.xy = u_xlat0.zw * u_xlat0.xy;
    u_xlat0.x = u_xlat0.y * u_xlat0.x;
    u_xlat16_1 = _Color.w * u_xlat0.x + -0.00100000005;
    u_xlat0.x = u_xlat0.x * _Color.w;
    u_xlat0.x = u_xlat0.x * vs_COLOR0.w;
    u_xlatb6 = u_xlat16_1<0.0;
    if(u_xlatb6){discard;}
    u_xlatb6 = _MainContrast==0.0;
    u_xlat12.xy = vs_TEXCOORD0.xy * _MainTex_ST.xy + _MainTex_ST.zw;
    u_xlat2.x = _Time.x * 20.0;
    u_xlat12.xy = u_xlat2.xx * _MainSpeed.xy + u_xlat12.xy;
    u_xlat8.xy = vs_TEXCOORD0.xy * _NoiseTex_ST.xy + _NoiseTex_ST.zw;
    u_xlat8.xy = u_xlat2.xx * _NoiseSpeed.xy + u_xlat8.xy;
    u_xlat16_8.xy = texture(_NoiseTex, u_xlat8.xy).xy;
    u_xlat12.xy = u_xlat16_8.xy * vec2(_NoiseStrength) + u_xlat12.xy;
    u_xlat12.xy = clamp(u_xlat12.xy, 0.0, 1.0);
    u_xlat3.xyz = texture(_MainTex, u_xlat12.xy).xyz;
    u_xlat4.xyz = log2(u_xlat3.xyz);
    u_xlat4.xyz = u_xlat4.xyz * vec3(_MainContrast);
    u_xlat4.xyz = exp2(u_xlat4.xyz);
    u_xlat6.xyz = (bool(u_xlatb6)) ? u_xlat3.xyz : u_xlat4.xyz;
    u_xlat20 = u_xlat3.x * _AlphaStrength;
    u_xlat1.w = u_xlat0.x * u_xlat20;
    u_xlat3.xy = vs_TEXCOORD0.xy * _SecondTex_ST.xy + _SecondTex_ST.zw;
    u_xlat3.xy = u_xlat2.xx * _SecondTexSpeed.xy + u_xlat3.xy;
    u_xlat3.xy = u_xlat16_8.xy * vec2(_NoiseStrength) + u_xlat3.xy;
    u_xlat16_3.xyz = texture(_SecondTex, u_xlat3.xy).xyz;
    u_xlat16_5.xyz = u_xlat6.xyz + u_xlat16_3.xyz;
    u_xlat0.xy = vs_TEXCOORD0.xy * _ThirdTex_ST.xy + _ThirdTex_ST.zw;
    u_xlat0.xy = u_xlat2.xx * _ThirdTexSpeed.xy + u_xlat0.xy;
    u_xlat0.xy = u_xlat16_8.xy * vec2(_NoiseStrength) + u_xlat0.xy;
    u_xlat16_0.xyz = texture(_ThirdTex, u_xlat0.xy).xyz;
    u_xlat16_5.xyz = u_xlat16_0.xyz * u_xlat16_5.xyz;
    u_xlat0.xyz = u_xlat16_5.xyz * vec3(vec3(_MainStrength, _MainStrength, _MainStrength));
    u_xlat2.xyz = vs_COLOR0.xyz * _Color.xyz;
    u_xlat1.xyz = u_xlat0.xyz * u_xlat2.xyz;
    SV_Target0 = u_xlat1;
    return;
}

#endif