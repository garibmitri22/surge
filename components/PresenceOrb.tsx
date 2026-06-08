'use client';

// PresenceOrb — a living, breathing WebGL "presence" for each AI employee.
//
// Not a CSS pulse: a Three.js + GLSL fragment shader renders fluid, organic,
// glowing liquid-light. Identity (signature colour) is fixed; LIFE modulates on
// top by STATE (speed, turbulence, glow, hue tint, pulse) and by audio amplitude
// while talking. Reads well on the app's LIGHT surfaces.
//
// API: <PresenceOrb employeeId state [size] [analyser] [level] />
//   analyser — a real Web Audio AnalyserNode (Track A / ElevenLabs). When present
//              it drives amplitude from ACTUAL playback. This is the clean seam.
//   level    — a 0..1 stand-in amplitude (text-stream cadence) until voices land.
//   With neither, `talking` self-animates a lively synthetic cadence so it still
//   feels alive today.
//
// Performance: GPU shader, single mesh, rAF, DPR capped at 2, loop paused when the
// tab is hidden or the orb scrolls offscreen.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  type OrbState,
  ORB_STATE_PARAMS,
  orbColor,
  hexToRgb,
} from '@/lib/persona-orb';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uTurb;
  uniform float uGlow;
  uniform float uLevel;   // audio / cadence amplitude 0..1
  uniform float uPulse;   // attention pulse strength
  uniform vec3  uColor;   // fixed signature colour
  uniform vec3  uTint;    // state hue tint
  uniform float uTintMix; // 0..1 mix toward uTint
  uniform float uOnDark;  // 0 = light surface (app), 1 = dark stage (brand/agent pages)

  // --- Ashima simplex noise (2D) ---------------------------------------------
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.0; a *= 0.5; }
    return s;
  }

  void main(){
    vec2 p = (vUv - 0.5) * 2.0;   // centred, square canvas → circular orb
    float r = length(p);
    float t = uTime;

    // Domain-warped flow → liquid-light churn.
    vec2 q = vec2(fbm(p * 1.5 + vec2(0.0, t * 0.20)),
                  fbm(p * 1.5 + vec2(3.3, -t * 0.16)));
    vec2 warp = p * 1.8 + uTurb * 0.6 * q;
    float n = fbm(warp + t * 0.25);
    n = 0.5 + 0.5 * n;

    // Breathing + audio-reactive edge.
    float breathe = 0.04 * sin(t * 1.6) + uPulse * 0.05 * sin(t * 3.0);
    float edge = 0.66 + breathe + (n - 0.5) * 0.22 * uTurb + uLevel * 0.18;

    float core = smoothstep(edge, edge - 0.22, r);
    float glow = smoothstep(edge + 0.55, edge - 0.05, r);
    glow = pow(glow, 2.2) * uGlow;

    // Internal liquid luminance, lifted by amplitude.
    float lum = (0.45 + 0.65 * n) * (1.0 + uLevel * 0.6);

    vec3 base = mix(uColor, uTint, uTintMix);
    float baseLum = dot(base, vec3(0.299, 0.587, 0.114));

    // Surface-aware fill. On a LIGHT surface (app) we deepen light hues so the orb holds its shape
    // against white. On a DARK stage we keep the hue luminous so the orb glows as a real, present
    // light — the SAME orb, lit for its room (DESIGN-SYSTEM §2/§5).
    float floorLo = mix(0.46, 0.82, uOnDark);
    vec3 deep = base * mix(0.95, floorLo, smoothstep(0.40, 0.80, baseLum));

    float center = smoothstep(0.62, 0.0, r);          // soft inner falloff → depth
    float lift = 1.0 + 0.55 * uOnDark;                 // overall luminance lift on dark

    // Liquid body with internal depth.
    vec3 col = deep * (0.60 + 0.55 * lum) * lift;
    // The orb's own coloured inner glow.
    col += base * center * (0.34 + 0.55 * uOnDark) * lum;
    // Hot luminous core — "lit from within", so on dark it reads as a present light, not a blob.
    col += mix(base, vec3(1.0), 0.32) * smoothstep(0.34, 0.0, r) * (0.10 + 0.55 * uOnDark) * (0.6 + 0.4 * lum);
    // Spark highlight for dark hues on a light bg (unchanged there; faded on dark).
    col += vec3(1.0) * center * 0.10 * uGlow * (1.0 - baseLum) * (1.0 - 0.7 * uOnDark);
    col *= 1.0 + uPulse * 0.18 * sin(t * 3.0);          // attention pulse

    // Deep contact toning near the rim → grounds the orb (premium edge, never a flat disc).
    col = mix(col, deep * mix(0.45, 0.66, uOnDark), smoothstep(edge - 0.26, edge, r) * core);

    // Soft outer halo = the grounded glow. Wider + stronger on dark so the orb seats in the scene.
    float haloR = mix(0.55, 1.10, uOnDark);
    float halo = smoothstep(edge + haloR, edge - 0.05, r);
    halo = pow(halo, 2.0) * uGlow * (0.9 + 1.0 * uOnDark);

    float ring = (smoothstep(edge + 0.14, edge, r) - core) * (0.30 + 0.25 * baseLum);
    float alpha = clamp(core + halo * (0.30 + 0.5 * uOnDark) + ring, 0.0, 1.0);
    // Halo/ring take the deep tone on light; a glowing coloured tone on dark.
    vec3 haloTone = mix(deep * 0.5, base * (0.5 + 0.45 * lum), uOnDark);
    col = mix(haloTone, col, core / max(alpha, 0.001));
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface PresenceOrbProps {
  employeeId: string;
  state: OrbState;
  /** Rendered square, in CSS px. Default 96. */
  size?: number;
  /** Real Web Audio analyser (Track A). Overrides `level` when present. */
  analyser?: AnalyserNode | null;
  /** 0..1 amplitude stand-in (text-stream cadence) until voices land. */
  level?: number;
  /** Light the orb for a DARK surface (brand/agent pages) — luminous + soft grounded glow.
   *  Default false = the calmer light-surface treatment used across the app. Same orb, lit for its room. */
  onDark?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export function PresenceOrb({
  employeeId,
  state,
  size = 96,
  analyser = null,
  level,
  onDark = false,
  className,
  style,
  'aria-label': ariaLabel,
}: PresenceOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Latest props, read inside the animation loop without re-creating it.
  const propsRef = useRef({ employeeId, state, analyser, level, onDark });
  useEffect(() => {
    propsRef.current = { employeeId, state, analyser, level, onDark };
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- three setup ---------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const [r, g, b] = hexToRgb(orbColor(propsRef.current.employeeId));
    const uniforms = {
      uTime:    { value: 0 },
      uSpeed:   { value: 0.5 },
      uTurb:    { value: 0.55 },
      uGlow:    { value: 0.55 },
      uLevel:   { value: 0 },
      uPulse:   { value: 0 },
      uColor:   { value: new THREE.Vector3(r, g, b) },
      uTint:    { value: new THREE.Vector3(r, g, b) },
      uTintMix: { value: 0 },
      uOnDark:  { value: propsRef.current.onDark ? 1 : 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    // --- audio / cadence amplitude ------------------------------------------
    let audioData: Uint8Array<ArrayBuffer> | null = null;
    let smoothedLevel = 0;

    function readAmplitude(time: number): number {
      const { analyser: an, level: lv, state: st } = propsRef.current;
      if (an) {
        // Real playback amplitude (RMS of the time-domain waveform).
        if (!audioData || audioData.length !== an.fftSize) audioData = new Uint8Array(new ArrayBuffer(an.fftSize));
        an.getByteTimeDomainData(audioData);
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
          const v = (audioData[i] - 128) / 128;
          sum += v * v;
        }
        return Math.min(1, Math.sqrt(sum / audioData.length) * 3.2);
      }
      if (typeof lv === 'number') return Math.max(0, Math.min(1, lv));
      if (st === 'talking') {
        // Synthetic speech-like cadence — lively until the real analyser lands.
        const s = 0.5 + 0.5 * Math.sin(time * 9.0);
        const w = 0.5 + 0.5 * Math.sin(time * 2.3 + 1.7);
        return Math.max(0, Math.min(1, 0.25 + 0.6 * s * w));
      }
      return 0;
    }

    // --- run / pause control -------------------------------------------------
    let raf = 0;
    let running = false;
    let visible = true;       // intersection
    let tabVisible = !document.hidden;
    const clock = new THREE.Clock();
    let phase = 0;   // integrated animation time — always moves forward
    let elapsed = 0; // wall time, for cadence/breathing

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05); // clamp big gaps (post-resume)
      elapsed += dt;
      const target = ORB_STATE_PARAMS[propsRef.current.state] ?? ORB_STATE_PARAMS.idle;

      // Ease params toward the target state for graceful transitions.
      const k = 0.06;
      uniforms.uSpeed.value += (target.speed - uniforms.uSpeed.value) * k;
      uniforms.uTurb.value  += (target.turbulence - uniforms.uTurb.value) * k;
      uniforms.uGlow.value  += (target.glow - uniforms.uGlow.value) * k;
      uniforms.uPulse.value += (target.pulse - uniforms.uPulse.value) * k;
      uniforms.uTintMix.value += (target.tintMix - uniforms.uTintMix.value) * k;

      // Fixed identity colour (in case employeeId prop changes).
      const [cr, cg, cb] = hexToRgb(orbColor(propsRef.current.employeeId));
      uniforms.uColor.value.set(cr, cg, cb);
      const [tr, tg, tb] = target.tint ? hexToRgb(target.tint) : [cr, cg, cb];
      uniforms.uTint.value.set(tr, tg, tb);

      // Integrate phase by speed so motion tracks state without ever reversing.
      phase += dt * uniforms.uSpeed.value;
      uniforms.uTime.value = phase;

      const targetLevel = readAmplitude(elapsed);
      smoothedLevel += (targetLevel - smoothedLevel) * 0.18;
      uniforms.uLevel.value = smoothedLevel;
      uniforms.uOnDark.value += ((propsRef.current.onDark ? 1 : 0) - uniforms.uOnDark.value) * 0.1;

      renderer.render(scene, camera);
    }

    function start() {
      if (running || !visible || !tabVisible) return;
      running = true;
      clock.getDelta(); // reset delta so the first frame after a pause is small
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function onVisibility() {
      tabVisible = !document.hidden;
      if (tabVisible) start(); else stop();
    }
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; if (visible) start(); else stop(); },
      { threshold: 0.01 }
    );
    io.observe(mount);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || size;
      renderer.setSize(w, w, false);
    });
    ro.observe(mount);

    start();

    // --- cleanup -------------------------------------------------------------
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
      ro.disconnect();
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // Re-create only on size change; live props flow through propsRef.
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={className}
      role="img"
      aria-label={ariaLabel ?? `${employeeId} presence`}
      style={{ width: size, height: size, aspectRatio: '1 / 1', ...style }}
    />
  );
}
