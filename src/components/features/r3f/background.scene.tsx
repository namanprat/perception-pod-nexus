/**
 * Fullscreen shader backdrop. Shadertoy → three uniforms.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { usePointerTrail } from "./pointer-trail.ts";

/** How far the pointer smear drags the gradient's UVs. */
const SMEAR = 0.15;
/** Trail buffer resolution — must match pointer-trail.ts TRAIL_RES. */
const TRAIL_RES = 512;
/** Blur radius in trail texels when soft-sampling the displacement field. */
const TRAIL_BLUR = 4.0;

const vert = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  #define S(a,b,t) smoothstep(a,b,t)

  uniform float uTime;
  uniform vec2 uResolution;
  uniform sampler2D uTrail;
  uniform float uSmear;
  // ponytail: idle only; wire speaking later if needed
  uniform float uSpeakingState;

  vec2 hash(vec2 p) {
    p = vec2(dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)));
    return fract(sin(p)*43758.5453);
  }

  mat2 Rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float n = mix(
      mix(dot(-1.0+2.0*hash(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
          dot(-1.0+2.0*hash(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
      mix(dot(-1.0+2.0*hash(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
          dot(-1.0+2.0*hash(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
    return 0.5 + 0.5*n;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float ratio = uResolution.x / uResolution.y;
    vec2 tuv = uv - 0.5;

    // Soft-sample the trail so its rim does not stair-step the gradient.
    // 9-tap box at a few texels — cheap enough at this fill rate.
    vec2 texel = vec2(${(TRAIL_BLUR / TRAIL_RES).toFixed(6)});
    vec3 trail = (
      texture2D(uTrail, uv).xyz +
      texture2D(uTrail, uv + vec2( texel.x, 0.0)).xyz +
      texture2D(uTrail, uv - vec2( texel.x, 0.0)).xyz +
      texture2D(uTrail, uv + vec2(0.0,  texel.y)).xyz +
      texture2D(uTrail, uv - vec2(0.0,  texel.y)).xyz +
      texture2D(uTrail, uv + vec2( texel.x,  texel.y)).xyz +
      texture2D(uTrail, uv + vec2(-texel.x,  texel.y)).xyz +
      texture2D(uTrail, uv + vec2( texel.x, -texel.y)).xyz +
      texture2D(uTrail, uv + vec2(-texel.x, -texel.y)).xyz
    ) / 9.0;
    tuv += trail.xy * uSmear;

    float degree = noise(vec2(uTime*.1, tuv.x*tuv.y));
    tuv.y *= 1./ratio;
    tuv *= Rot(radians((degree-.25)*720.+180.));
    tuv.y *= ratio;

    float idleFreq = 8.0;
    float speakingFreq = 8.0;
    float idleAmp = 100.0;
    float speakingAmp = 40.0;
    float idleSpeed = 1.0;
    float speakingSpeed = 2.5;
    float idleNoise = 0.1;
    float speakingNoise = 0.12;

    float frequency = mix(idleFreq, speakingFreq, uSpeakingState);
    float amplitude = mix(idleAmp, speakingAmp, uSpeakingState);
    float speed = mix(idleSpeed, speakingSpeed, uSpeakingState);
    float noiseAmount = mix(idleNoise, speakingNoise, uSpeakingState);

    float t = uTime * speed;
    tuv.x += sin(tuv.y*frequency+t)/amplitude;
    tuv.y += sin(tuv.x*frequency*1.5+t)/(amplitude*.5);
    float noiseScale = 10.0;
    tuv += (noise(tuv * noiseScale + t) - 0.5) * noiseAmount;

    // Pastel stops — high value, low saturation (cream / blush / lilac).
    vec3 colorYellow = vec3(0.99, 0.96, 0.88);
    vec3 colorPink = vec3(0.97, 0.82, 0.86);
    vec3 colorBlue = vec3(0.78, 0.84, 0.94);

    /* Derivative AA: when the trail folds tuv, colour bands would otherwise
       stair-step. Widen each mix by a screen-space pixel of the field. */
    float ax = max(fwidth(tuv.x), 1e-4) * 1.25;
    float ay = max(fwidth(tuv.y), 1e-4) * 1.25;
    vec3 layer1 = mix(colorYellow, colorPink, S(-0.2 - ax, 0.3 + ax, tuv.x));
    layer1 = mix(layer1, colorBlue, S(0.2 - ay, 0.6 + ay, tuv.y));

    // lift where the trail is hot, so the smear reads on flat patches too
    layer1 = mix(layer1, colorYellow, clamp(trail.z, 0.0, 1.0) * 0.25);

    gl_FragColor = vec4(layer1, 1.0);
  }
`;

export default function Background() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const trail = usePointerTrail();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTrail: { value: trail.current },
      uSmear: { value: SMEAR },
      uSpeakingState: { value: 0 },
    }),
    [trail],
  );

  useFrame((state) => {
    const mat = material.current;
    if (!mat) return;
    // ponytail: 70% slower = 0.3× clock
    mat.uniforms.uTime.value = state.clock.elapsedTime * 0.3;
    mat.uniforms.uResolution.value.set(
      state.gl.domElement.width,
      state.gl.domElement.height,
    );
    // the ping-pong swap hands back a different texture every frame
    mat.uniforms.uTrail.value = trail.current;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
