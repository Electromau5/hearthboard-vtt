'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';

type Scene3D = { id: string; name: string; short: string };

interface Props {
  /** The town diorama built in Summer — `~/dev/my-summer-game/tools/export_town.sh`. */
  src: string;
  scenes: readonly Scene3D[];
  activeId: string;
  /** The scene whose info panel is open; the camera flies to it. */
  focusedId: string | null;
  onSelect: (id: string) => void;
}

// Where the camera rests when no scene is focused, and how far it sits from a focused pin.
const OVERVIEW_POS = new THREE.Vector3(0, 95, 105);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 4);
const FOCUS_OFFSET = new THREE.Vector3(0, 24, 28);
// Aim this far in front of a focused pin so it sits above the location panel.
const FOCUS_LEAD = new THREE.Vector3(0, 0, 9);
const FLY_SECONDS = 0.9;

/**
 * Orbitable 3D Innsmouth. Pins come from the model's `Pin_<sceneId>` empties,
 * which the Summer build script places at the same map percentages as the 2D
 * pins, so selecting a scene here behaves exactly like clicking it on the map.
 */
export function InnsmouthTown3D({ src, scenes, activeId, focusedId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pinsRef = useRef<Record<string, THREE.Vector3>>({});
  const flyRef = useRef<((to: THREE.Vector3 | null) => void) | null>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [webgl] = useState(() => WebGL.isWebGL2Available());

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !webgl) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(el.clientWidth || 960, el.clientHeight || 540);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e13);
    scene.fog = new THREE.FogExp2(0x0a0e13, 0.0065);

    const camera = new THREE.PerspectiveCamera(40, (el.clientWidth || 960) / (el.clientHeight || 540), 0.5, 600);
    camera.position.copy(OVERVIEW_POS);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(OVERVIEW_TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 190;
    controls.maxPolarAngle = 1.38;   // never dip below the waterline
    controls.screenSpacePanning = false;
    controls.update();

    // Overcast night over the harbour: cold moonlight, warm lamps from emissive windows.
    scene.add(new THREE.HemisphereLight(0x8a96ad, 0x2a2118, 1.7));
    const moon = new THREE.DirectionalLight(0xc4cfe6, 2.6);
    moon.position.set(-60, 90, -40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -100; sc.right = 100; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 260;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.3;
    scene.add(moon);

    let water: THREE.Mesh | null = null;
    let disposed = false;
    let animId = 0;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      src,
      gltf => {
        if (disposed) return;
        gltf.scene.traverse(obj => {
          if (obj.name.startsWith('Pin_')) {
            pinsRef.current[obj.name.slice(4)] = obj.getWorldPosition(new THREE.Vector3());
          }
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (mesh.name === 'Water') {
            water = mesh;
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x13262a, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.93,
            });
            mesh.receiveShadow = true;
            return;
          }
          mesh.castShadow = mesh.name !== 'Terrain';
          mesh.receiveShadow = true;
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            m.side = THREE.DoubleSide;
          }
        });
        scene.add(gltf.scene);
        setLoaded(true);
      },
      e => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
      () => { if (!disposed) setLoadError(true); },
    );

    // Camera flights between the overview and a pin.
    let flight: { t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3 } | null = null;
    flyRef.current = to => {
      const toTarget = to ? to.clone().setY(Math.max(0, to.y - 4)).add(FOCUS_LEAD) : OVERVIEW_TARGET.clone();
      flight = {
        t: 0,
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPos: to ? toTarget.clone().add(FOCUS_OFFSET) : OVERVIEW_POS.clone(),
        toTarget,
      };
    };
    // A drag cancels a flight in progress.
    const cancelFlight = () => { flight = null; };
    controls.addEventListener('start', cancelFlight);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const clock = new THREE.Clock();
    const projected = new THREE.Vector3();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const time = clock.elapsedTime;

      if (flight) {
        flight.t = Math.min(1, flight.t + dt / FLY_SECONDS);
        const k = 1 - Math.pow(1 - flight.t, 3);
        camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
        if (flight.t >= 1) flight = null;
      }
      controls.update();
      if (water) (water as THREE.Mesh).position.y = Math.sin(time * 0.6) * 0.06;

      renderer.render(scene, camera);

      // Float the HTML markers over their pins.
      const w = el.clientWidth;
      const h = el.clientHeight;
      for (const [id, pos] of Object.entries(pinsRef.current)) {
        const marker = markerRefs.current[id];
        if (!marker) continue;
        projected.copy(pos).project(camera);
        const visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
        marker.style.display = visible ? '' : 'none';
        if (!visible) continue;
        marker.style.left = `${((projected.x + 1) / 2) * w}px`;
        marker.style.top = `${((1 - projected.y) / 2) * h}px`;
        // Nearer pins draw over farther ones.
        marker.style.zIndex = String(5 + Math.round((1 - projected.z) * 1000));
      }
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.removeEventListener('start', cancelFlight);
      controls.dispose();
      flyRef.current = null;
      pinsRef.current = {};
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [src, webgl]);

  // Fly to the focused scene, or back out to the overview when it closes.
  useEffect(() => {
    if (!loaded) return;
    flyRef.current?.(focusedId ? pinsRef.current[focusedId] ?? null : null);
  }, [focusedId, loaded]);

  if (!webgl) {
    return (
      <div className="town3d-wrap">
        <div className="town3d-status">
          WebGL is unavailable in this browser — turn on hardware acceleration to see the 3D map.
        </div>
      </div>
    );
  }

  return (
    <div className="town3d-wrap">
      <div ref={mountRef} className="town3d-canvas" />
      {loaded && scenes.map(s => (
        <button
          key={s.id}
          ref={node => { markerRefs.current[s.id] = node; }}
          className={`loc-marker-btn${s.id === activeId ? ' active' : ''}`}
          style={{ display: 'none' }}
          onClick={e => { e.stopPropagation(); onSelect(s.id); }}
          title={s.name}
        >
          <div className="loc-pin" />
          <div className="loc-pin-label">{s.short}</div>
        </button>
      ))}
      {!loaded && (
        <div className="town3d-status">
          {loadError ? 'The 3D map failed to load.' : `Surveying Innsmouth… ${progress}%`}
        </div>
      )}
      {loaded && <div className="town3d-hint">Drag to orbit · right-drag to pan · scroll to zoom</div>}
    </div>
  );
}
