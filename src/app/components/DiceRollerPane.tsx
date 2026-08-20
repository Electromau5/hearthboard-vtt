'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type RollResult = {
  formula: string; rolls: number[]; mod: number; sides: number; total: number; n: number;
};

interface Props {
  pushRollToChat: (who: string, res: RollResult) => void;
  who: string;
}

interface AnimState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  die: THREE.Object3D;
  animId: number;
  phase: 'idle' | 'rolling' | 'done';
  velX: number;
  velY: number;
  velZ: number;
  bobT: number;
  rolledResult: number;
  onDone?: () => void;
}

// Deep-space navy material for the die body
function makeBodyMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x0d1a35),
    metalness: 0.9,
    roughness: 0.12,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    envMapIntensity: 2.2,
    // Faint blue iridescent sheen
    sheenColor: new THREE.Color(0x3040aa),
    sheen: 0.4,
  });
}

// Gold emissive material for the digit text
function makeDigitMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xffd870),
    emissive: new THREE.Color(0xffb030),
    emissiveIntensity: 1.8,
    metalness: 0.4,
    roughness: 0.35,
  });
}

export function DiceRollerPane({ pushRollToChat, who }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const width  = el.clientWidth  || 280;
    const height = el.clientHeight || 280;

    // ── Renderer ────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    el.appendChild(renderer.domElement);

    // ── Scene ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // Environment map — makes metallic materials look realistic
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = envMap;
    pmrem.dispose();

    // ── Camera — equatorial view matching the Blender render ────────
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 3.4);
    camera.lookAt(0, 0.1, 0);

    // ── Lights ──────────────────────────────────────────────────────
    // Warm key from upper-right
    const keyLight = new THREE.DirectionalLight(0xffd880, 3.5);
    keyLight.position.set(4, 5, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Cool blue fill from the left
    const fillLight = new THREE.DirectionalLight(0x3858cc, 1.8);
    fillLight.position.set(-4, 1, -2);
    scene.add(fillLight);

    // Purple rim from behind/below
    const rimLight = new THREE.PointLight(0x7020ff, 5, 12);
    rimLight.position.set(0, -2.5, -3.5);
    scene.add(rimLight);

    // Gentle top glow
    const topGlow = new THREE.PointLight(0xffd060, 1.2, 8);
    topGlow.position.set(0, 4, 1);
    scene.add(topGlow);

    // Soft ambient
    const ambient = new THREE.AmbientLight(0x08102a, 6);
    scene.add(ambient);

    let disposed = false;
    const bodyMat  = makeBodyMaterial();
    const digitMat = makeDigitMaterial();

    // ── Load GLB ────────────────────────────────────────────────────
    const loader = new GLTFLoader();
    loader.load(
      '/space-d10.glb',
      (gltf) => {
        if (disposed) return;

        const die = gltf.scene;

        // Scale using the die-body mesh only (avoids text object skewing bounds)
        let dieMesh: THREE.Mesh | null = null;
        die.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.name === 'D10') {
            dieMesh = child as THREE.Mesh;
          }
        });

        const refObj = dieMesh ?? die;
        const box = new THREE.Box3().setFromObject(refObj);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        // Target: die fills most of the viewport (2.0 units across longest axis)
        const scale = (maxDim > 0 ? 2.0 / maxDim : 1);
        die.scale.setScalar(scale);

        // Recenter around origin after scaling
        const box2 = new THREE.Box3().setFromObject(die);
        const center = box2.getCenter(new THREE.Vector3());
        die.position.sub(center);

        // Replace all materials — Blender procedural nodes don't export to GLB
        die.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;

          // Dispose the placeholder GLB material(s)
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else if (mesh.material) {
            (mesh.material as THREE.Material).dispose();
          }

          // Text.XXX = digit labels, everything else = die body
          const isDigit = mesh.name.startsWith('Text');
          mesh.material = isDigit ? digitMat : bodyMat;
          mesh.castShadow    = true;
          mesh.receiveShadow = true;
        });

        scene.add(die);

        const state: AnimState = {
          renderer, scene, camera, die,
          animId: 0,
          phase: 'idle',
          velX: 0, velY: 0.45, velZ: 0,
          bobT: 0,
          rolledResult: 0,
        };
        animRef.current = state;

        // ── Animation loop ───────────────────────────────────────────
        const animate = () => {
          if (disposed) return;
          state.animId = requestAnimationFrame(animate);
          const dt = 1 / 60;

          if (state.phase === 'idle') {
            die.rotation.y += 0.007;
            die.rotation.x += 0.002;
            state.bobT += dt;
            die.position.y = Math.sin(state.bobT * 0.85) * 0.06;
          } else if (state.phase === 'rolling') {
            die.rotation.x += state.velX * dt;
            die.rotation.y += state.velY * dt;
            die.rotation.z += state.velZ * dt;

            // Dampen: 0.972 per frame → ~3 s roll at 60 fps
            state.velX *= 0.972;
            state.velY *= 0.972;
            state.velZ *= 0.972;

            if (Math.sqrt(state.velX ** 2 + state.velY ** 2 + state.velZ ** 2) < 0.06) {
              state.phase = 'done';
              die.position.y = 0;
              state.onDone?.();
            }
          }

          renderer.render(scene, camera);
        };
        animate();

        setLoaded(true);
      },
      undefined,
      (err) => console.error('[DiceRoller] GLB load failed:', err),
    );

    return () => {
      disposed = true;
      bodyMat.dispose();
      digitMat.dispose();
      envMap.dispose();
      const s = animRef.current;
      if (s) {
        cancelAnimationFrame(s.animId);
        s.renderer.dispose();
      }
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      animRef.current = null;
    };
  }, []);

  const handleRoll = useCallback(() => {
    const s = animRef.current;
    if (!s || rolling) return;

    const r = Math.floor(Math.random() * 10) + 1;
    s.rolledResult = r;
    setRolling(true);
    setResult(null);

    // Fully random spin axis and speed every roll
    const angle = Math.random() * Math.PI * 2;
    const tilt  = Math.random() * Math.PI;
    const speed = 22 + Math.random() * 14;
    s.velX = Math.sin(angle) * Math.cos(tilt) * speed;
    s.velY = Math.cos(angle) * speed * (0.6 + Math.random() * 0.4);
    s.velZ = Math.sin(tilt)  * speed * (0.3 + Math.random() * 0.4);
    s.phase = 'rolling';

    s.onDone = () => {
      const final = s.rolledResult;
      setResult(final);
      setRolling(false);
      pushRollToChat(who, {
        formula: '1d10',
        rolls: [final],
        mod: 0,
        sides: 10,
        total: final,
        n: 1,
      });
    };
  }, [rolling, pushRollToChat, who]);

  const displayNum = result === null ? null : result === 10 ? 0 : result;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 12px', gap: 10, height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '1.8px',
        textTransform: 'uppercase', color: 'var(--ink-text-2)', alignSelf: 'flex-start',
      }}>
        Space D10
      </div>

      {/* 3D viewport */}
      <div
        ref={mountRef}
        style={{
          width: '100%', height: 240, borderRadius: 'var(--r-lg)',
          overflow: 'hidden', border: '1px solid var(--line)',
          background: 'radial-gradient(ellipse at 50% 40%, #0f0930 0%, #04050c 100%)',
          flexShrink: 0,
        }}
      />

      {/* Result */}
      <div style={{
        height: 70, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {!rolling && result !== null ? (
          <>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700,
              color: 'var(--brass)', lineHeight: 1,
              textShadow: '0 0 24px rgba(201,148,79,0.6), 0 0 6px rgba(201,148,79,0.3)',
            }}>
              {displayNum}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--ink-text-2)', letterSpacing: '1.2px', marginTop: 3,
            }}>
              {result === 10 ? '00 · ten' : `${result} · 1d10`}
            </div>
          </>
        ) : rolling ? (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 14,
            color: 'var(--ink-text-2)', letterSpacing: '4px',
          }}>· · ·</div>
        ) : (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--line)', letterSpacing: '1px',
          }}>
            Click Roll to begin
          </div>
        )}
      </div>

      {/* Roll button */}
      <button
        onClick={handleRoll}
        disabled={rolling || !loaded}
        style={{
          width: '100%', padding: '11px 0',
          background: rolling
            ? 'var(--surface-2)'
            : 'linear-gradient(135deg, rgba(201,148,79,0.18) 0%, rgba(201,148,79,0.06) 100%)',
          border: `1px solid ${rolling ? 'var(--line)' : 'var(--brass-dim)'}`,
          borderRadius: 'var(--r-lg)',
          color: rolling ? 'var(--ink-text-2)' : 'var(--brass)',
          fontFamily: 'var(--font-mono)', fontSize: 13,
          fontWeight: 600, letterSpacing: '2.5px',
          textTransform: 'uppercase' as const,
          cursor: rolling || !loaded ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
      >
        {!loaded ? 'Loading…' : rolling ? 'Rolling…' : '⚄  Roll D10'}
      </button>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--line)', letterSpacing: '0.8px', textAlign: 'center',
      }}>
        Result also appears in Chat
      </div>
    </div>
  );
}
