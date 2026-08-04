/**
 * Pointer smear trail.
 *
 * The pointer paints its velocity into a low-res ping-pong buffer that drags
 * itself along and fades, so a sweep leaves a smear that relaxes once the
 * pointer stops. background.scene.tsx samples the result to displace its UVs.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

/* Feel knobs. */
/* ponytail: fixed square buffer — the shader corrects for aspect, so a resize
   never has to reallocate. Mid res keeps the smear soft without stair-stepping
   the gradient edges it drives. */
const TRAIL_RES = 512;
/** e-folding rate per second: how fast the trail settles once the pointer stops. */
const DECAY = 1.5;
/** Brush radius, in aspect-corrected UV. */
const RADIUS = 0.13;
/** Soft outer falloff as a fraction of RADIUS — wider = less jagged rim. */
const SOFTNESS = 0.72;
/** How far the field drags itself along its own velocity each frame. */
const ADVECT = 0.006;
/** Pointer speed (screens per second) → stored velocity. */
const VELOCITY_SCALE = 0.22;
const VELOCITY_MAX = 1;
/** Longest step the sim will integrate, so a backgrounded tab cannot spike it. */
const MAX_STEP = 0.05;

const trailVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const trailFrag = /* glsl */ `
  uniform sampler2D uPrev;
  uniform vec2 uPointer;
  uniform vec2 uPrevPointer;
  uniform vec2 uVelocity;
  uniform float uDecay;
  uniform float uAspect;
  varying vec2 vUv;

  const float RADIUS = ${RADIUS.toFixed(4)};
  const float SOFTNESS = ${SOFTNESS.toFixed(4)};
  const float ADVECT = ${ADVECT.toFixed(4)};

  float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float len = dot(ab, ab);
    float h = len > 0.0 ? clamp(dot(p - a, ab) / len, 0.0, 1.0) : 0.0;
    return distance(p, a + ab * h);
  }

  void main() {
    vec3 prev = texture2D(uPrev, vUv).xyz;
    /* Re-sampling along its own velocity is what keeps the trail flowing
       instead of fading in place. */
    prev = texture2D(uPrev, vUv - prev.xy * ADVECT).xyz * uDecay;

    /* Stamp the whole pointer segment, not just its current position, so a
       fast flick paints a stroke rather than a dotted line. Soft outer rim
       keeps the displacement field from folding the gradient into jags. */
    vec2 correct = vec2(uAspect, 1.0);
    float d = distToSegment(vUv * correct, uPrevPointer * correct, uPointer * correct);
    float stamp = 1.0 - smoothstep(RADIUS * (1.0 - SOFTNESS), RADIUS, d);
    stamp *= stamp;

    vec2 velocity = clamp(prev.xy + uVelocity * stamp, -1.5, 1.5);
    gl_FragColor = vec4(velocity, max(prev.z, stamp), 1.0);
  }
`;

/**
 * Returns a ref holding the newest trail texture. It is a ref, not state,
 * because the ping-pong swap hands back a different texture every frame and
 * re-rendering React for that would be absurd.
 */
export function usePointerTrail(): RefObject<THREE.Texture> {
  const sim = useMemo(() => {
    const options = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uPrevPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uVelocity: { value: new THREE.Vector2() },
        uDecay: { value: 1 },
        uAspect: { value: 1 },
      },
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));

    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blank.needsUpdate = true;

    return {
      read: new THREE.WebGLRenderTarget(TRAIL_RES, TRAIL_RES, options),
      write: new THREE.WebGLRenderTarget(TRAIL_RES, TRAIL_RES, options),
      camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      material,
      geometry,
      scene,
      blank,
    };
  }, []);

  const texture = useRef<THREE.Texture>(sim.blank);
  const pointer = useRef(new THREE.Vector2(0.5, 0.5));
  const previous = useRef(new THREE.Vector2(0.5, 0.5));
  const velocity = useRef(new THREE.Vector2());
  const reduced = useRef(false);
  const cleared = useRef(false);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight,
      );
    };

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      reduced.current = query.matches;
      if (query.matches) {
        window.removeEventListener("pointermove", onMove);
        texture.current = sim.blank;
      } else {
        window.addEventListener("pointermove", onMove, { passive: true });
      }
    };

    syncMotion();
    query.addEventListener("change", syncMotion);

    return () => {
      query.removeEventListener("change", syncMotion);
      window.removeEventListener("pointermove", onMove);
    };
  }, [sim]);

  useEffect(
    () => () => {
      sim.read.dispose();
      sim.write.dispose();
      sim.geometry.dispose();
      sim.material.dispose();
      sim.blank.dispose();
    },
    [sim],
  );

  /* Default priority: R3F runs every subscriber before its own render, so the
     buffer is always a frame fresh by the time the backdrop samples it. */
  useFrame((state, delta) => {
    if (reduced.current) return;

    const { gl } = state;

    if (!cleared.current) {
      for (const target of [sim.read, sim.write]) {
        gl.setRenderTarget(target);
        gl.clear();
      }
      gl.setRenderTarget(null);
      cleared.current = true;
    }

    const step = Math.min(Math.max(delta, 1e-4), MAX_STEP);

    velocity.current
      .copy(pointer.current)
      .sub(previous.current)
      .divideScalar(step)
      .multiplyScalar(VELOCITY_SCALE)
      .clampScalar(-VELOCITY_MAX, VELOCITY_MAX);

    const uniforms = sim.material.uniforms;
    uniforms.uPrev.value = sim.read.texture;
    uniforms.uPointer.value.copy(pointer.current);
    uniforms.uPrevPointer.value.copy(previous.current);
    uniforms.uVelocity.value.copy(velocity.current);
    uniforms.uDecay.value = Math.exp(-step * DECAY);
    uniforms.uAspect.value = state.size.width / state.size.height;

    gl.setRenderTarget(sim.write);
    gl.render(sim.scene, sim.camera);
    gl.setRenderTarget(null);

    const spent = sim.read;
    sim.read = sim.write;
    sim.write = spent;

    texture.current = sim.read.texture;
    previous.current.copy(pointer.current);
  });

  return texture;
}
