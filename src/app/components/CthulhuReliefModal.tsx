'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Props {
  onClose: () => void;
}

export function CthulhuReliefModal({ onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [walkthroughMode, setWalkthroughMode] = useState(false);

  // Refs shared between the animation loop (useEffect closure) and React handlers
  const walkthroughRef = useRef(false);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const yawRef         = useRef(0);
  const posRef         = useRef(new THREE.Vector3(0, 0, 2.5));
  const keysRef        = useRef({ up: false, down: false, left: false, right: false });

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const enterWalkthrough = useCallback(() => {
    yawRef.current  = 0;
    posRef.current.set(0, 0, 2.5);
    keysRef.current = { up: false, down: false, left: false, right: false };
    const cam = cameraRef.current;
    if (cam) {
      cam.fov = 75;
      cam.updateProjectionMatrix();
    }
    walkthroughRef.current = true;
    setWalkthroughMode(true);
  }, []);

  const exitWalkthrough = useCallback(() => {
    walkthroughRef.current = false;
    keysRef.current = { up: false, down: false, left: false, right: false };
    const cam = cameraRef.current;
    if (cam) {
      cam.fov = 42;
      cam.updateProjectionMatrix();
      cam.position.set(0, 0, 5.5);
      cam.lookAt(0, 0, 0);
    }
    setWalkthroughMode(false);
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const width  = el.clientWidth  || 680;
    const height = el.clientHeight || 520;

    // ── Renderer ────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    // ── Scene ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0806);

    // ── Camera ──────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 100);
    camera.position.set(0, 0, 5.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // ── Lighting — raking bas-relief look ───────────────────────────
    const keyLight = new THREE.DirectionalLight(0xffcc88, 4.5);
    keyLight.position.set(-4, 5, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8899cc, 0.8);
    fillLight.position.set(5, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xff8833, 1.5, 20);
    rimLight.position.set(1, -4, 2);
    scene.add(rimLight);

    const ambient = new THREE.AmbientLight(0x2a1a0a, 2.5);
    scene.add(ambient);

    // ── Load the GLB ────────────────────────────────────────────────
    let model: THREE.Object3D | null = null;
    let disposed = false;
    let animId = 0;

    // Orbit state
    let autoRotY = 0;
    let dragVelX = 0;
    let dragVelY = 0;
    let isDragging = false;
    let lastMX = 0;
    let lastMY = 0;

    const loader = new GLTFLoader();
    loader.load(
      '/cthulhu-relief.glb',
      (gltf) => {
        if (disposed) return;

        model = gltf.scene;

        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale  = maxDim > 0 ? 3.6 / maxDim : 1;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow    = true;
            mesh.receiveShadow = true;
            mesh.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x2a1108),
              roughness: 0.88,
              metalness: 0.04,
              envMapIntensity: 0.3,
            });
          }
        });

        scene.add(model);
      },
      undefined,
      (err) => console.error('GLB load error:', err),
    );

    // ── Animate ─────────────────────────────────────────────────────
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (walkthroughRef.current) {
        // ── First-person walkthrough ─────────────────────────────────
        const keys  = keysRef.current;
        const SPEED = 0.04;   // units per frame
        const TURN  = 0.03;   // radians per frame

        if (keys.left)  yawRef.current += TURN;
        if (keys.right) yawRef.current -= TURN;

        // Forward vector derived from yaw — moves along XZ plane only
        const sinY = Math.sin(yawRef.current);
        const cosY = Math.cos(yawRef.current);
        if (keys.up) {
          posRef.current.x -= sinY * SPEED;
          posRef.current.z -= cosY * SPEED;
        }
        if (keys.down) {
          posRef.current.x += sinY * SPEED;
          posRef.current.z += cosY * SPEED;
        }

        camera.position.copy(posRef.current);
        // YXZ order: yaw around world-Y first, then pitch around local-X
        camera.rotation.set(0, yawRef.current, 0, 'YXZ');

      } else {
        // ── Orbit mode ───────────────────────────────────────────────
        if (model) {
          if (isDragging) {
            model.rotation.y += dragVelX;
            model.rotation.x += dragVelY;
            model.rotation.x = Math.max(-0.5, Math.min(0.5, model.rotation.x));
            dragVelX *= 0.7;
            dragVelY *= 0.7;
          } else {
            autoRotY += 0.004;
            model.rotation.y = autoRotY + dragVelX * 20;
            dragVelX *= 0.96;
            dragVelY *= 0.96;
            model.rotation.x += dragVelY;
            model.rotation.x = Math.max(-0.5, Math.min(0.5, model.rotation.x));
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Orbit pointer controls ───────────────────────────────────────
    const canvas = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (walkthroughRef.current) return;
      isDragging = true;
      lastMX = e.clientX;
      lastMY = e.clientY;
      dragVelX = 0;
      dragVelY = 0;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || walkthroughRef.current) return;
      const dx = e.clientX - lastMX;
      const dy = e.clientY - lastMY;
      dragVelX = dx * 0.008;
      dragVelY = dy * 0.006;
      autoRotY += dragVelX;
      if (model) {
        model.rotation.y = autoRotY;
        model.rotation.x = Math.max(-0.5, Math.min(0.5, model.rotation.x + dragVelY));
      }
      lastMX = e.clientX;
      lastMY = e.clientY;
    };
    const onMouseUp = () => { isDragging = false; };

    const onTouchStart = (e: TouchEvent) => {
      if (walkthroughRef.current || e.touches.length !== 1) return;
      isDragging = true;
      lastMX = e.touches[0].clientX;
      lastMY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || walkthroughRef.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - lastMX;
      const dy = e.touches[0].clientY - lastMY;
      dragVelX = dx * 0.008;
      dragVelY = dy * 0.006;
      autoRotY += dragVelX;
      if (model) {
        model.rotation.y = autoRotY;
        model.rotation.x = Math.max(-0.5, Math.min(0.5, model.rotation.x + dragVelY));
      }
      lastMX = e.touches[0].clientX;
      lastMY = e.touches[0].clientY;
    };
    const onTouchEnd = () => { isDragging = false; };

    canvas.addEventListener('mousedown',  onMouseDown);
    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',   onTouchEnd);

    // ── Arrow key controls (walkthrough only) ────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (!walkthroughRef.current) return;
      switch (e.key) {
        case 'ArrowUp':    keysRef.current.up    = true; e.preventDefault(); break;
        case 'ArrowDown':  keysRef.current.down  = true; e.preventDefault(); break;
        case 'ArrowLeft':  keysRef.current.left  = true; e.preventDefault(); break;
        case 'ArrowRight': keysRef.current.right = true; e.preventDefault(); break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':    keysRef.current.up    = false; break;
        case 'ArrowDown':  keysRef.current.down  = false; break;
        case 'ArrowLeft':  keysRef.current.left  = false; break;
        case 'ArrowRight': keysRef.current.right = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    // ── Resize ──────────────────────────────────────────────────────
    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown',  onMouseDown);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseup',    onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('keydown',    onKeyDown);
      window.removeEventListener('keyup',      onKeyUp);
      window.removeEventListener('resize',     onResize);
      renderer.dispose();
      cameraRef.current = null;
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(5,4,3,0.94)',
        backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(760px, 92vw)',
          borderRadius: 'var(--r-lg)',
          border: `1px solid ${walkthroughMode ? 'var(--arcane)' : 'var(--brass-dim)'}`,
          boxShadow: walkthroughMode
            ? '0 0 0 1px rgba(139,92,246,0.2), 0 32px 100px rgba(0,0,0,0.95)'
            : '0 0 0 1px rgba(201,148,79,0.12), 0 32px 100px rgba(0,0,0,0.95)',
          background: '#0a0806',
          overflow: 'hidden',
          transition: 'border-color .25s, box-shadow .25s',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px 9px',
          borderBottom: `1px solid ${walkthroughMode ? 'rgba(139,92,246,0.25)' : 'rgba(201,148,79,0.18)'}`,
          background: walkthroughMode ? 'rgba(139,92,246,0.06)' : 'rgba(201,148,79,0.04)',
          transition: 'background .25s, border-color .25s',
        }}>
          <div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '2.5px',
              color: walkthroughMode ? 'var(--arcane)' : 'var(--blood)',
              border: `1px solid ${walkthroughMode ? 'var(--arcane)' : 'var(--blood)'}`,
              padding: '2px 6px', marginRight: 10,
              transition: 'color .25s, border-color .25s',
            }}>
              {walkthroughMode ? 'WALKTHROUGH' : '3D ARTIFACT'}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--parchment)' }}>
              Cthulhu Bas Relief
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', letterSpacing: '0.5px' }}>
              {walkthroughMode ? '↑↓ Move  ·  ←→ Turn' : 'Drag to rotate'}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(0,0,0,0.5)', border: '1px solid var(--line)',
                borderRadius: '50%', width: 28, height: 28,
                color: 'var(--ink-text-2)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        </div>

        {/* Three.js canvas mount */}
        <div
          ref={mountRef}
          style={{
            width: '100%',
            aspectRatio: '4/3',
            cursor: walkthroughMode ? 'crosshair' : 'grab',
          }}
        />

        {/* Footer — lore text + walkthrough toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16,
          padding: '8px 16px',
          borderTop: `1px solid ${walkthroughMode ? 'rgba(139,92,246,0.18)' : 'rgba(201,148,79,0.12)'}`,
          background: walkthroughMode ? 'rgba(139,92,246,0.04)' : 'transparent',
          transition: 'background .25s, border-color .25s',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--ink-text-2)', letterSpacing: '0.4px',
            fontStyle: 'italic', minWidth: 0,
          }}>
            {walkthroughMode
              ? 'First-person view active · Arrow keys to navigate the artifact'
              : 'Recovered from the sub-chamber, Section 7 — translation of border glyphs ongoing · Sanity cost: 0/1D4'
            }
          </span>

          {walkthroughMode ? (
            <button
              onClick={exitWalkthrough}
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px',
                textTransform: 'uppercase', cursor: 'pointer',
                padding: '4px 10px', borderRadius: 'var(--r-sm)',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.45)',
                color: 'var(--arcane)',
                whiteSpace: 'nowrap',
              }}
            >
              ← Exit
            </button>
          ) : (
            <button
              onClick={enterWalkthrough}
              style={{
                flexShrink: 0,
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px',
                textTransform: 'uppercase', cursor: 'pointer',
                padding: '4px 10px', borderRadius: 'var(--r-sm)',
                background: 'rgba(201,148,79,0.08)',
                border: '1px solid var(--brass-dim)',
                color: 'var(--brass)',
                whiteSpace: 'nowrap',
              }}
            >
              ⬡ Walkthrough
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
