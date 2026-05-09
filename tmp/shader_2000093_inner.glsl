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
uniform 	float _MainStrength;
uniform 	vec4 _ThirdTex_ST;
uniform 	mediump vec2 _ThirdTexSpeed;
uniform 	vec4 _AlphaTex_ST;
uniform 	float _AlphaStrength;
uniform 	mediump vec2 _AlphaSpeed;
uniform 	vec4 _ClipRect;
UNITY_LOCATION(0) uniform mediump sampler2D _ThirdTex;
UNITY_LOCATION(1) uniform mediump sampler2D _MainTex;
UNITY_LOCATION(2) uniform mediump sampler2D _AlphaTex;
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
mediump vec3 u_xlat16_2;
mediump vec3 u_xlat16_3;
vec2 u_xlat4;
mediump float u_xlat16_4;
bool u_xlatb4;
float u_xlat12;
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
    u_xlatb4 = u_xlat16_1<0.0;
    if(u_xlatb4){discard;}
    u_xlat4.xy = vs_TEXCOORD0.xy * _AlphaTex_ST.xy + _AlphaTex_ST.zw;
    u_xlat12 = _Time.x * 20.0;
    u_xlat4.xy = vec2(u_xlat12) * _AlphaSpeed.xy + u_xlat4.xy;
    u_xlat16_4 = texture(_AlphaTex, u_xlat4.xy).x;
    u_xlat2.xy = vs_TEXCOORD0.xy * _MainTex_ST.xy + _MainTex_ST.zw;
    u_xlat2.xy = vec2(u_xlat12) * _MainSpeed.xy + u_xlat2.xy;
    u_xlat16_2.xyz = texture(_MainTex, u_xlat2.xy).xyz;
    u_xlat4.x = u_xlat16_4 * u_xlat16_2.x;
    u_xlat4.x = u_xlat4.x * _AlphaStrength;
    u_xlat1.w = u_xlat4.x * u_xlat0.x;
    u_xlat0.xy = vs_TEXCOORD0.xy * _ThirdTex_ST.xy + _ThirdTex_ST.zw;
    u_xlat0.xy = vec2(u_xlat12) * _ThirdTexSpeed.xy + u_xlat0.xy;
    u_xlat16_0.xyz = texture(_ThirdTex, u_xlat0.xy).xyz;
    u_xlat16_3.xyz = u_xlat16_0.xyz + u_xlat16_2.xyz;
    u_xlat0.xyz = u_xlat16_3.xyz * vec3(vec3(_MainStrength, _MainStrength, _MainStrength));
    u_xlat2.xyz = vs_COLOR0.xyz * _Color.xyz;
    u_xlat1.xyz = u_xlat0.xyz * u_xlat2.xyz;
    SV_Target0 = u_xlat1;
    return;
}

#endif