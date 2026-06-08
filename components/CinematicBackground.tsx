'use client';

// CinematicBackground — a living, atmospheric WebGL stage for the marketing/showcase
// surfaces (landing hero + per-agent pages). Same tech family as PresenceOrb: a single
// Three.js fullscreen quad + GLSL fragment shader. Deep atmospheric gradient, slow-drifting
// domain-warped light in the agent's signature colour, a soft drifting star/particle field,
// a centre glow that cradles the orb, and a vignette for depth. No video, no external asset.
//
// Performance: GPU shader, one mesh, rAF, DPR capped at 2, loop paused when the tab is hidden
// or the element scrolls offscreen. Tunable via `color` + `intensity`.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { hexToRgb } from '@/lib/persona-orb';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec3  uColor;
  uniform float uIntensity;

  vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
    vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
    vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
    vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
    vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
    m=m*m; m=m*m;
    vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
    m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
    vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
    return 130.0*dot(m,g);
  }
  float fbm(vec2 p){ float s=0.0,a=0.55; for(int i=0;i<5;i++){ s+=a*snoise(p); p=p*2.02+vec2(7.1,3.3); a*=0.5; } return s; }
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

  void main(){
    vec2 uv = vUv;
    // Aspect-correct coords centred at 0.
    vec2 p = (uv - 0.5); p.x *= uRes.x / max(uRes.y, 1.0);
    float t = uTime;

    // 1. Deep atmospheric vertical gradient — premium near-black, faint navy lift up top.
    vec3 top = vec3(0.035, 0.042, 0.075);
    vec3 bot = vec3(0.012, 0.014, 0.026);
    vec3 col = mix(bot, top, smoothstep(0.0, 1.0, uv.y));

    // 2. Slow domain-warped nebula light in the signature colour — SUBTLE, a tint not a flood.
    vec2 q = vec2(fbm(p*1.3 + vec2(0.0, t*0.04)), fbm(p*1.3 + vec2(5.2, -t*0.035)));
    float neb = fbm(p*1.7 + 1.3*q + t*0.05);
    neb = smoothstep(0.15, 1.2, neb);
    // Two soft drifting glow centres, pushed toward the upper corners so the centre/lower area
    // (where the headline sits) stays clean and readable.
    float g1 = exp(-5.5*length(p - vec2(0.42*sin(t*0.06), 0.34+0.05*cos(t*0.05))));
    float g2 = exp(-6.5*length(p - vec2(-0.40*cos(t*0.05), 0.28+0.04*sin(t*0.06))));
    float light = neb*0.10 + g1*0.22 + g2*0.16;
    col += uColor * light * (0.55 + 0.7*uIntensity);

    // 3. Soft cradle glow seated slightly high — gives the orb a luminous seat without washing text.
    float cradle = exp(-3.6*dot(p - vec2(0.0, 0.12), p - vec2(0.0, 0.12)));
    col += uColor * cradle * 0.13 * uIntensity;

    // 4. Drifting star/particle field (two parallax layers, hashed twinkle).
    float stars = 0.0;
    for (int L=0; L<2; L++){
      float sc = 110.0 + float(L)*170.0;
      vec2 drift = vec2(t*(0.5+float(L)*0.35), t*0.12);
      vec2 g = (uv*vec2(uRes.x/max(uRes.y,1.0),1.0))*sc + drift;
      vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
      float h = hash(cell + float(L)*23.0);
      if (h > 0.978){
        float tw = 0.5 + 0.5*sin(t*1.8 + h*40.0);
        stars += smoothstep(0.05, 0.0, length(f)) * tw * (0.4 + 0.4*float(2-L));
      }
    }
    col += vec3(0.8,0.85,1.0) * stars * 0.35;

    // 5. Vignette + a gentle lower-screen darken so headline/CTA copy always reads.
    float vig = smoothstep(1.25, 0.2, length(p));
    col *= 0.62 + 0.5*vig;
    col *= mix(0.82, 1.0, smoothstep(-0.55, 0.1, p.y));

    col = pow(col, vec3(0.95));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function CinematicBackground({
  color = '#6366f1',
  intensity = 1,
  className,
  style,
}: {
  color?: string;
  intensity?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ color, intensity });
  useEffect(() => { propsRef.current = { color, intensity }; });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
    renderer.setClearColor(0x05060a, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const w0 = mount.clientWidth || 1, h0 = mount.clientHeight || 1;
    renderer.setSize(w0, h0, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const [r, g, b] = hexToRgb(propsRef.current.color);
    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(w0, h0) },
      uColor: { value: new THREE.Vector3(r, g, b) },
      uIntensity: { value: propsRef.current.intensity },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    let raf = 0, running = false, visible = true, tabVisible = !document.hidden;
    const clock = new THREE.Clock();
    let phase = 0;

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      phase += dt;
      uniforms.uTime.value = phase;
      const [cr, cg, cb] = hexToRgb(propsRef.current.color);
      uniforms.uColor.value.set(cr, cg, cb);
      uniforms.uIntensity.value += (propsRef.current.intensity - uniforms.uIntensity.value) * 0.05;
      renderer.render(scene, camera);
    }
    function start() { if (running || !visible || !tabVisible) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    function onVis() { tabVisible = !document.hidden; if (tabVisible) start(); else stop(); }
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }, { threshold: 0.01 });
    io.observe(mount);
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    });
    ro.observe(mount);
    start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect(); ro.disconnect();
      mesh.geometry.dispose(); material.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} aria-hidden className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }} />;
}
