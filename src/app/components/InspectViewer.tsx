'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { InspectClue, Inspectable } from '@/lib/walkthrough';

interface Props {
  title: string;
  intro: string;
  inspectable: Inspectable;
  /** The Wood's lamp is lit — Q, handled by the modal, or the panel's switch. */
  uvOn: boolean;
  onToggleUv: () => void;
  /** Clue ids found so far, kept by the modal so they survive putting the object down. */
  found: Set<string>;
  onFound: (clueId: string) => void;
  shared: Set<string>;
  saved: Set<string>;
  onShare: (clueId: string) => void;
  onSave: (clueId: string) => Promise<void>;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

const FOV = 35;
/** A clue counts as found once it has been in plain view this long, seconds. */
const NOTICE_SEC = 0.5;
/** …and drawn at least this many pixels across: it has to be looked at, not glimpsed. */
const NOTICE_PX = 60;
/** How brightly the lamp must light a UV clue to see it. */
const UV_SEEN = 0.3;
/** The Wood's lamp's violet. */
const UV_COLOR = 0x5a2cff;

/**
 * An object picked up from the walkthrough, held in the light to be turned
 * over: drag to turn it, scroll to zoom, and Q floods it with the Wood's
 * lamp's light. Clues sit at the model's "Clue_<id>" markers; one is noticed
 * once it has faced the viewer, close enough to read, for a moment — and a UV
 * clue only while the lamp is lit.
 */
export function InspectViewer({ title, intro, inspectable, uvOn, onToggleUv, found, onFound, shared, saved, onShare, onSave, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [noticed, setNoticed] = useState<string | null>(null);

  // Read by the render loop without restarting it.
  const uvRef = useRef(uvOn);
  const foundRef = useRef(found);
  const onFoundRef = useRef(onFound);
  useEffect(() => { uvRef.current = uvOn; }, [uvOn]);
  useEffect(() => { foundRef.current = found; }, [found]);
  useEffect(() => { onFoundRef.current = onFound; }, [onFound]);

  const clueIds = Object.keys(inspectable.clues);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0907);
    // Brass needs something to reflect, or it renders black.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 20);
    const hemi = new THREE.HemisphereLight(0xb8a88c, 0x1a1410, 0.7);
    const key = new THREE.DirectionalLight(0xffe2b8, 1.7);
    key.position.set(-1.2, 2, 1.6);
    const rim = new THREE.DirectionalLight(0x8fa6c8, 0.9);
    rim.position.set(1.5, 0.6, -1.8);
    scene.add(hemi, key, rim);

    // The Wood's lamp, held just below and right of the eye, its wash wide
    // enough to take in the whole object.
    const uvSpot = new THREE.SpotLight(UV_COLOR, 0, 6, 0.6, 0.6, 2);
    // …and a faint violet fill, so the side away from it does not drop to black.
    const uvFill = new THREE.AmbientLight(UV_COLOR, 0);
    scene.add(uvSpot, uvSpot.target, uvFill);
    const lampPos = new THREE.Vector3();
    const toLamp = new THREE.Vector3();
    let uvPower = 0;

    const ray = new THREE.Raycaster();
    const pivot = new THREE.Group();
    scene.add(pivot);
    let radius = 0.2;
    let dist = 1;
    // Where the camera looks, in the plane of the object's centre: zooming
    // toward the pointer and panning move it.
    const target = new THREE.Vector3();
    let startDist = 1;
    let minDist = 0.2;
    let maxDist = 2;

    type Mark = { id: string; clue: InspectClue; node: THREE.Object3D; mat: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial; seen: number };
    const marks: Mark[] = [];
    const owned: { dispose: () => void }[] = [];
    let disposed = false;

    new GLTFLoader().load(
      inspectable.model,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        pivot.add(model);
        radius = box.getBoundingSphere(new THREE.Sphere()).radius;
        dist = radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2)) * 1.05;
        minDist = radius * 0.7;
        maxDist = dist * 2;
        startDist = dist;
        resetView();

        for (const [id, clue] of Object.entries(inspectable.clues)) {
          const node = model.getObjectByName(`Clue_${id}`);
          if (!node) { console.warn('Inspectable has no marker for clue', id); continue; }
          const tex = drawMark(clue);
          const geo = new THREE.PlaneGeometry(clue.size[0], clue.size[1]);
          const mat = clue.uv
            ? new THREE.MeshBasicMaterial({ map: tex, color: 0xb8ffe6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
            : new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.7, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
          const decal = new THREE.Mesh(geo, mat);
          decal.position.z = 0.0004;
          node.add(decal);
          owned.push(tex, geo, mat);
          marks.push({ id, clue, node, mat, seen: 0 });
        }
        setLoaded(true);
      },
      undefined,
      (err) => { console.error('Inspectable failed to load:', inspectable.model, err); if (!disposed) setFailed(true); },
    );

    // ── Turning it over ────────────────────────────────────────────
    // Start a little from above, the way it was standing.
    const resetView = () => {
      pivot.rotation.set(0.35, -0.5, 0);
      target.set(0, 0, 0);
      dist = startDist;
    };
    const keepTarget = () => target.clampLength(0, radius);
    const pointer = new THREE.Vector2(0, 0);
    let dragging: 'turn' | 'pan' | null = null;
    let last = { x: 0, y: 0 };
    const turn = (dx: number, dy: number) => {
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy);
      pivot.quaternion.premultiply(qy).premultiply(qx);
    };
    const onDown = (e: PointerEvent) => {
      // Left drag turns it; right drag (or Shift) slides the view.
      dragging = e.button === 2 || e.shiftKey ? 'pan' : 'turn';
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (!dragging) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (dragging === 'turn') turn(dx * 0.01, dy * 0.01);
      else {
        const perPx = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / r.height;
        target.x -= dx * perPx;
        target.y += dy * perPx;
        keepTarget();
      }
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      dragging = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
    };
    // Scrolling zooms toward whatever is under the pointer.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = THREE.MathUtils.clamp(dist * Math.exp(e.deltaY * 0.0012), minDist, maxDist);
      ray.setFromCamera(pointer, camera);
      const under = ray.ray.at(dist, new THREE.Vector3());
      target.lerp(under.setZ(0), 1 - next / dist);
      keepTarget();
      dist = next;
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onDouble = () => resetView();
    // Arrow keys turn it too.
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code.startsWith('Arrow')) { keys.add(e.code); e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContext);
    canvas.addEventListener('dblclick', onDouble);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // ── Loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const pos = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const q = new THREE.Quaternion();
    let anim = 0;
    const tick = () => {
      anim = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = 1.6 * dt;
      if (keys.has('ArrowLeft')) turn(-k, 0);
      if (keys.has('ArrowRight')) turn(k, 0);
      if (keys.has('ArrowUp')) turn(0, -k);
      if (keys.has('ArrowDown')) turn(0, k);

      camera.position.set(target.x, target.y, dist);
      camera.lookAt(target.x, target.y, 0);
      camera.updateMatrixWorld();

      // The lamp: its tube warms up and dies down rather than snapping.
      uvPower = THREE.MathUtils.clamp(uvPower + (uvRef.current ? dt / 0.35 : -dt / 0.2), 0, 1);
      lampPos.copy(camera.position).add(new THREE.Vector3(radius * 0.3, -radius * 0.25, 0));
      uvSpot.position.copy(lampPos);
      uvSpot.target.position.set(target.x, target.y, 0);
      uvSpot.angle = Math.min(1.2, Math.atan((radius * 1.4) / dist));
      uvSpot.intensity = uvPower * dist * dist * 10;
      uvFill.intensity = uvPower * 0.9;
      // Under the lamp the room light goes, so the glow has the dark it needs.
      const room = 1 - uvPower * 0.9;
      hemi.intensity = 0.7 * room;
      key.intensity = 1.7 * room;
      rim.intensity = 0.9 * room;
      // Kept low: flat brass faces otherwise mirror the studio and read white.
      scene.environmentIntensity = 0.45 * room;

      const pxPerMetre = renderer.domElement.height / (2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
      for (const m of marks) {
        m.node.getWorldPosition(pos);
        normal.set(0, 0, 1).applyQuaternion(m.node.getWorldQuaternion(q));
        const facing = normal.dot(toCam.subVectors(camera.position, pos).normalize());
        // Lit by how squarely the clue faces the lamp.
        const lit = m.clue.uv ? uvPower * THREE.MathUtils.clamp(normal.dot(toLamp.subVectors(lampPos, pos).normalize()) * 1.5, 0, 1) : 1;
        if (m.clue.uv) (m.mat as THREE.MeshBasicMaterial).opacity = Math.min(1, lit * 1.4) * THREE.MathUtils.clamp(facing * 2, 0, 1);
        const onScreen = pos.clone().project(camera);
        const plain = facing > 0.75 && Math.abs(onScreen.x) < 0.85 && Math.abs(onScreen.y) < 0.85
          && m.clue.size[0] * pxPerMetre / renderer.getPixelRatio() > NOTICE_PX
          && (!m.clue.uv || lit > UV_SEEN);
        m.seen = plain ? m.seen + dt : 0;
        if (m.seen > NOTICE_SEC && !foundRef.current.has(m.id)) {
          foundRef.current = new Set(foundRef.current).add(m.id);
          onFoundRef.current(m.id);
          setNoticed(m.clue.title);
        }
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(anim);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContext);
      canvas.removeEventListener('dblclick', onDouble);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      for (const o of owned) o.dispose();
      pivot.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const mat of [mesh.material].flat()) mat.dispose();
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (el.contains(canvas)) el.removeChild(canvas);
    };
  }, [inspectable]);

  // "You notice…" fades after a moment.
  useEffect(() => {
    if (!noticed) return;
    const t = window.setTimeout(() => setNoticed(null), 2600);
    return () => window.clearTimeout(t);
  }, [noticed]);

  const foundClues = clueIds.filter(id => found.has(id));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: '#0b0907' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 10, color: failed ? 'var(--blood)' : 'var(--ink-text-2)' }}>
            {failed ? `The ${title.toLowerCase()} could not be loaded.` : `Picking up the ${title.toLowerCase()}…`}
          </div>
        )}
        {noticed && (
          <div style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
            ...mono, fontSize: 10, color: 'var(--parchment)', background: 'rgba(0,0,0,0.65)',
            border: '1px solid var(--brass)', borderRadius: 'var(--r-sm)', padding: '6px 12px', whiteSpace: 'nowrap',
          }}>
            You notice something · {noticed}
          </div>
        )}
        <div style={{
          position: 'absolute', left: 12, bottom: 10, pointerEvents: 'none',
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', letterSpacing: '0.4px',
        }}>
          Drag or arrow keys to turn · scroll to zoom · right-drag to slide · double-click to reset · Q Wood&apos;s lamp · E / Esc put it down
        </div>
      </div>

      <div style={{
        width: 'min(300px, 38%)', display: 'flex', flexDirection: 'column',
        background: 'rgba(14,11,8,0.97)', borderLeft: '1px solid var(--brass-dim)',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)' }}>
          <div style={{ ...mono, fontSize: 9, color: 'var(--ink-text-2)' }}>In your hands</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--parchment)', margin: '3px 0 8px' }}>{title}</div>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--parchment)', margin: 0 }}>{intro}</p>
        </div>
        <div style={{ padding: '8px 14px', ...mono, fontSize: 9, color: foundClues.length === clueIds.length ? 'var(--forest)' : 'var(--brass)' }}>
          Clues found · {foundClues.length} of {clueIds.length}
        </div>
        <div style={{ padding: '0 14px 10px' }}>
          <button
            onClick={onToggleUv}
            aria-pressed={uvOn}
            style={{
              ...mono, fontSize: 9, width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: uvOn ? 'rgba(107,45,255,0.22)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${uvOn ? '#8a5cff' : 'var(--line)'}`,
              color: uvOn ? '#cbb4ff' : 'var(--ink-text-2)',
              boxShadow: uvOn ? '0 0 14px rgba(107,45,255,0.35)' : 'none',
            }}
          >
            <span>Wood&apos;s lamp · {uvOn ? 'lit' : 'off'}</span>
            <span>[Q]</span>
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 10px 10px' }}>
          {foundClues.length === 0 && (
            <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--ink-text-2)', margin: '4px 4px' }}>
              Turn it over and look closely. Some things only show under the Wood&apos;s lamp.
            </p>
          )}
          {foundClues.map(id => {
            const clue = inspectable.clues[id];
            return (
              <div key={id} style={{ border: '1px solid rgba(201,148,79,0.2)', borderRadius: 'var(--r-sm)', padding: '9px 10px', marginBottom: 8, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ ...mono, fontSize: 8, color: clue.uv ? '#b48cff' : 'var(--ink-text-2)' }}>{clue.uv ? "Under the Wood's lamp" : 'Found'}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--parchment)', margin: '2px 0 5px' }}>{clue.title}</div>
                <p style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--parchment)', margin: 0 }}>{clue.text}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={async () => { setSaving(id); try { await onSave(id); } finally { setSaving(null); } }}
                    disabled={saved.has(id) || saving === id}
                    style={smallButton(saved.has(id))}
                  >
                    {saved.has(id) ? 'On the case board' : saving === id ? 'Pinning…' : 'Save to case board'}
                  </button>
                  <button onClick={() => onShare(id)} disabled={shared.has(id)} style={smallButton(shared.has(id))}>
                    {shared.has(id) ? 'Shared' : 'Share'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid rgba(201,148,79,0.12)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...smallButton(false), color: 'var(--ink-text-2)', borderColor: 'var(--line)' }}>Put it down [E]</button>
        </div>
      </div>
    </div>
  );
}

function smallButton(done: boolean): React.CSSProperties {
  return {
    ...mono, fontSize: 8.5, padding: '5px 9px', borderRadius: 'var(--r-sm)', cursor: done ? 'default' : 'pointer',
    background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)',
    color: done ? 'var(--ink-text-2)' : 'var(--brass)',
  };
}

/** The clue's mark, drawn white-on-clear for UV (tinted by the material) or dark for a stamp. */
function drawMark(clue: InspectClue): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round(512 * clue.size[1] / clue.size[0]);
  const ctx = c.getContext('2d')!;
  const W = c.width, H = c.height;
  if (clue.mark.kind === 'stamp') {
    // Pressed into brass: dark in the cut, a lit edge just above it.
    const ink = 'rgba(38,24,8,0.92)';
    const edge = 'rgba(255,226,170,0.35)';
    const lines = clue.mark.lines ?? [];
    const ringY = lines.length ? H * 0.36 : H / 2;
    const r = Math.min(W, H) * 0.24;
    for (const [color, dy] of [[edge, -2], [ink, 0]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = W * 0.018;
      ctx.beginPath(); ctx.arc(W / 2, ringY + dy, r, 0, Math.PI * 2); ctx.stroke();
      // The device: a cross whose foot forks like a fish's tail.
      ctx.beginPath();
      ctx.moveTo(W / 2, ringY - r * 0.72 + dy); ctx.lineTo(W / 2, ringY + r * 0.45 + dy);
      ctx.moveTo(W / 2 - r * 0.42, ringY - r * 0.2 + dy); ctx.lineTo(W / 2 + r * 0.42, ringY - r * 0.2 + dy);
      ctx.moveTo(W / 2, ringY + r * 0.45 + dy); ctx.lineTo(W / 2 - r * 0.32, ringY + r * 0.72 + dy);
      ctx.moveTo(W / 2, ringY + r * 0.45 + dy); ctx.lineTo(W / 2 + r * 0.32, ringY + r * 0.72 + dy);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => {
        const size = W * (i === 0 ? 0.085 : 0.07);
        ctx.font = `bold ${size}px Georgia, serif`;
        ctx.fillText(line, W / 2, H * (0.72 + i * 0.13) + dy);
      });
    }
  } else {
    // A thumbprint: broken whorl ridges, and a smear of skin off one side.
    const cx = W * 0.44, cy = H * 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineCap = 'round';
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let ring = 1; ring <= 13; ring++) {
      const ry = ring * H * 0.033;
      const rx = ry * 0.78;
      ctx.lineWidth = W * (0.012 + rand() * 0.006);
      let a = rand() * Math.PI * 2;
      const end = a + Math.PI * 2;
      while (a < end) {
        const run = 0.4 + rand() * 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0.2, a, Math.min(a + run, end));
        ctx.stroke();
        a += run + 0.08 + rand() * 0.25;
      }
    }
    const smear = ctx.createRadialGradient(W * 0.8, cy, 0, W * 0.8, cy, W * 0.2);
    smear.addColorStop(0, 'rgba(255,255,255,0.55)');
    smear.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = smear;
    ctx.fillRect(0, 0, W, H);
    (clue.mark.lines ?? []).forEach((line, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${W * 0.07}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(line, W / 2, H * (0.9 + i * 0.08));
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
