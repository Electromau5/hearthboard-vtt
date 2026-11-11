'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';

type Scene3D = { id: string; name: string; short: string };

interface Props {
  /** The diorama: the Innsmouth town, or K'n-yan (`~/dev/my-summer-game/tools/export_knyan.sh`). */
  src: string;
  /** The look and camera: the harbour town at night, or K'n-yan's blue-lit cavern. Default town. */
  preset?: 'town' | 'cavern';
  scenes: readonly Scene3D[];
  activeId: string;
  /** The scene whose info panel is open; the camera flies to it. */
  focusedId: string | null;
  onSelect: (id: string) => void;
}

// Where the camera rests when no scene is focused (`overview`), looks straight down (`overhead`),
// and how far it sits from a focused pin.
type Look = {
  overview: THREE.Vector3; overviewTarget: THREE.Vector3; overhead: THREE.Vector3; overheadTarget: THREE.Vector3;
  focusOffset: THREE.Vector3;
  /** Aim this far in front of a focused pin so it sits above the location panel. */
  focusLead: THREE.Vector3;
  background: number; fogDensity: number;
  sky: number; ground: number; hemi: number;
  key: { color: number; intensity: number; at: THREE.Vector3 };
  /** Coloured glows at pins — the red light of the sealed gate, lamplight over a city. */
  glows?: { pin: string; color: number; intensity: number; dy: number; reach: number }[];
};
const LOOKS: Record<'town' | 'cavern', Look> = {
  town: {
    overview: new THREE.Vector3(0, 95, 105), overviewTarget: new THREE.Vector3(0, 0, 4), overhead: new THREE.Vector3(0, 170, 4.01), overheadTarget: new THREE.Vector3(0, 0, 4),
    focusOffset: new THREE.Vector3(0, 24, 28), focusLead: new THREE.Vector3(0, 0, 9),
    background: 0x0a0e13, fogDensity: 0.0065, sky: 0x8a96ad, ground: 0x2a2118, hemi: 1.7,
    key: { color: 0xc4cfe6, intensity: 2.6, at: new THREE.Vector3(-60, 90, -40) },
  },
  cavern: {
    overview: new THREE.Vector3(0, 82, 82), overviewTarget: new THREE.Vector3(0, 0, -4), overhead: new THREE.Vector3(0, 138, 12.01), overheadTarget: new THREE.Vector3(0, 0, 12),
    focusOffset: new THREE.Vector3(0, 17, 20), focusLead: new THREE.Vector3(0, 0, 6),
    background: 0x030303, fogDensity: 0.0040, sky: 0x8a929a, ground: 0x2a211a, hemi: 1.9,
    key: { color: 0xe2d2b4, intensity: 2.3, at: new THREE.Vector3(-30, 80, 20) },
    glows: [
      { pin: 'kn-gate', color: 0xff2a14, intensity: 90, dy: -4, reach: 22 },
      { pin: 'kn-tsath', color: 0xffa855, intensity: 420, dy: 7, reach: 36 },
      { pin: 'kn-farms', color: 0x2fb89a, intensity: 60, dy: 3, reach: 30 },
    ],
  },
};
const FLY_SECONDS = 0.9;

/**
 * Orbitable 3D Innsmouth. Pins come from the model's `Pin_<sceneId>` empties,
 * which the Summer build script places at the same map percentages as the 2D
 * pins, so selecting a scene here behaves exactly like clicking it on the map.
 */
export function InnsmouthTown3D({ src, preset = 'town', scenes, activeId, focusedId, onSelect }: Props) {
  const look = LOOKS[preset];
  const mountRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pinsRef = useRef<Record<string, THREE.Vector3>>({});
  const flyRef = useRef<((to: THREE.Vector3 | null, overhead?: boolean) => void) | null>(null);
  const [overhead, setOverhead] = useState(false);
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
    scene.background = new THREE.Color(look.background);
    scene.fog = new THREE.FogExp2(look.background, look.fogDensity);

    const camera = new THREE.PerspectiveCamera(40, (el.clientWidth || 960) / (el.clientHeight || 540), 0.5, 600);
    camera.position.copy(look.overview);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(look.overviewTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 190;
    controls.maxPolarAngle = 1.38;   // never dip below the waterline
    controls.screenSpacePanning = false;
    controls.update();

    // Night over the harbour — or K'n-yan's blue glow: cold light from above, warm lamps from emissive windows.
    scene.add(new THREE.HemisphereLight(look.sky, look.ground, look.hemi));
    const moon = new THREE.DirectionalLight(look.key.color, look.key.intensity);
    moon.position.copy(look.key.at);
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
        for (const g of look.glows ?? []) {
          const at = pinsRef.current[g.pin];
          if (!at) continue;
          const light = new THREE.PointLight(g.color, g.intensity, g.reach, 2);
          light.position.copy(at).setY(g.dy);
          scene.add(light);
        }
        setLoaded(true);
      },
      e => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
      () => { if (!disposed) setLoadError(true); },
    );

    // Camera flights between the overview and a pin.
    let flight: { t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3 } | null = null;
    flyRef.current = (to, top) => {
      const toTarget = to ? to.clone().setY(Math.max(0, to.y - 4)).add(look.focusLead) : (top ? look.overheadTarget : look.overviewTarget).clone();
      flight = {
        t: 0,
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPos: to ? toTarget.clone().add(look.focusOffset) : (top ? look.overhead.clone() : look.overview.clone()),
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
  }, [src, webgl, look]);

  // Fly to the focused scene, or back out to the overview (or straight down) when it closes.
  useEffect(() => {
    if (!loaded) return;
    flyRef.current?.(focusedId ? pinsRef.current[focusedId] ?? null : null, overhead);
  }, [focusedId, loaded, overhead]);

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
      <div ref={mountRef} className={`town3d-canvas${preset === 'cavern' ? ' victorian' : ''}`} />
      {preset === 'cavern' && <div className="town3d-vignette" />}
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
          {loadError ? 'The 3D map failed to load.' : `${preset === 'cavern' ? 'Descending' : 'Surveying Innsmouth'}… ${progress}%`}
        </div>
      )}
      {loaded && <div className="town3d-hint">Drag to orbit · right-drag to pan · scroll to zoom</div>}
      {loaded && (
        <button
          className="scene-chip town3d-view"
          onClick={e => { e.stopPropagation(); setOverhead(v => !v); }}
          title={overhead ? 'Tilt back to the angled view' : 'Look straight down on the whole map'}
        >
          {overhead ? 'Angled view' : 'Overhead view'}
        </button>
      )}
    </div>
  );
}
