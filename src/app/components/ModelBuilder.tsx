'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ModelBuild, ModelPiece, ModelState } from '@/lib/walkthrough';
import { boxesGroup, ghostGroup, isAvailable, loosePlace, modelMaterials, setAt } from './model-pieces';

interface Props {
  title: string;
  text: string;
  build: ModelBuild;
  /** Admins can take every piece back off the model. */
  isGM?: boolean;
  /** A piece went into its slot — the level posts it to the chat. */
  onPlaced: (piece: ModelPiece) => void;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

const SNAP_DIST = 0.08;    // metres from its slot a piece can be let go and still go in
const SNAP_TURN = 20;      // degrees off its slot's turn
const TURN_STEP = 15;      // degrees per R / Q / wheel notch
const LIFT = 0.04;         // how high a held piece rides over the model
const POLL_MS = 4000;      // others' progress, while the builder is open

const D2R = Math.PI / 180;

/** How far a piece's turn is from its slot's, allowing for a piece that looks the same turned round. */
function turnOff(yawDeg: number, piece: ModelPiece) {
  const sym = piece.symmetryDeg ?? 360;
  const d = (((yawDeg - piece.slot.yawDeg) % sym) + sym) % sym;
  return Math.min(d, sym - d);
}

type Loose = { piece: ModelPiece; group: THREE.Group; yawDeg: number };

/**
 * A close-up of a model's table (the architect's R'lyeh): loose pieces lie on
 * the margin, outlines on the base show where each one goes, and a piece let
 * go close enough to its own outline, turned the right way, snaps in and stays.
 * Drag a piece to move it, R / Q or the wheel while holding to turn it; drag
 * anywhere else to look round, the wheel to come closer. Esc (handled by the
 * modal) steps back into the level.
 */
export function ModelBuilder({ title, text, build, isGM, onPlaced, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ModelState | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const stateRef = useRef<ModelState | null>(null);
  // Pieces this investigator just put in, until the server confirms them.
  const pendingRef = useRef(new Set<string>());
  const onPlacedRef = useRef(onPlaced);
  useEffect(() => { onPlacedRef.current = onPlaced; }, [onPlaced]);
  // The scene redraws from shared state through this.
  const syncRef = useRef<((s: ModelState) => void) | null>(null);

  const apply = useCallback((s: ModelState) => {
    const merged = { ...s, placed: [...new Set([...s.placed, ...pendingRef.current])] };
    stateRef.current = merged;
    setState(merged);
    syncRef.current?.(merged);
  }, []);

  // Shared progress: fetched on open, then polled while the builder is up.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`/api/models/${build.id}`)
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((s: ModelState) => { if (!cancelled) { setError(false); apply(s); } })
        .catch(() => { if (!cancelled && !stateRef.current) setError(true); });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [build.id, apply]);

  const place = useCallback((piece: ModelPiece) => {
    pendingRef.current.add(piece.id);
    if (stateRef.current) apply(stateRef.current);
    onPlacedRef.current(piece);
    fetch(`/api/models/${build.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'place', piece: piece.id }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((s: ModelState) => { pendingRef.current.delete(piece.id); apply(s); })
      .catch(err => {
        console.error('Could not set the piece into the model:', err);
        pendingRef.current.delete(piece.id);
        if (stateRef.current) apply({ ...stateRef.current, placed: stateRef.current.placed.filter(id => id !== piece.id) });
      });
  }, [build.id, apply]);
  const placeRef = useRef(place);
  useEffect(() => { placeRef.current = place; }, [place]);

  const reset = useCallback(() => {
    if (!window.confirm('Take every piece back off the model, and forget the ones found elsewhere?')) return;
    pendingRef.current.clear();
    fetch(`/api/models/${build.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((s: ModelState) => apply(s))
      .catch(err => console.error('Could not reset the model:', err));
  }, [build.id, apply]);

  // ── The scene ───────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const [baseW, baseD] = build.base.size;
    const [tableW, tableD] = build.table.size;
    const drop = build.table.drop;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0907);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 30);

    scene.add(new THREE.HemisphereLight(0x8a7f6c, 0x0d0b09, 0.55));
    // The green-shaded lamp over the model.
    const lamp = new THREE.SpotLight(0xffd29a, 11, 6, 0.8, 0.6, 1.6);
    lamp.position.set(0.2, 2.1, 0.5);
    lamp.target.position.set(0, 0, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0004;
    scene.add(lamp, lamp.target);
    const fill = new THREE.DirectionalLight(0x8ea2c2, 0.5);
    fill.position.set(-3, 2, -1);
    scene.add(fill);

    // The table, its painted sea, and the basalt shelf.
    const owned: { dispose(): void }[] = [];
    const geo = <T extends { dispose(): void }>(g: T) => { owned.push(g); return g; };
    const oak = geo(new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.75 }));
    const sea = geo(new THREE.MeshStandardMaterial({ color: 0x1b3940, roughness: 0.5, metalness: 0.1 }));
    const tableTop = new THREE.Mesh(geo(new THREE.BoxGeometry(tableW, 0.05, tableD)), oak);
    tableTop.position.y = -drop - 0.026;
    tableTop.receiveShadow = true;
    const seaPlane = new THREE.Mesh(geo(new THREE.PlaneGeometry(tableW - 0.04, tableD - 0.04).rotateX(-Math.PI / 2)), sea);
    seaPlane.position.y = -drop + 0.0005;
    seaPlane.receiveShadow = true;
    const mats = modelMaterials();
    owned.push(mats);
    const shelf = new THREE.Mesh(geo(new THREE.BoxGeometry(baseW, drop - 0.001, baseD)), mats.basalt);
    shelf.position.y = -(drop - 0.001) / 2;
    shelf.receiveShadow = true;
    shelf.castShadow = true;
    scene.add(tableTop, seaPlane, shelf, boxesGroup(build.rubble, mats));
    // A floor, far below, to catch the lamp.
    const floor = new THREE.Mesh(geo(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2)), geo(new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 1 })));
    floor.position.y = -drop - 0.85;
    floor.receiveShadow = true;
    scene.add(floor);

    // Outlines of where each piece goes: brass for the ones on the table,
    // dim red for the ones still somewhere else, green when a held piece
    // would go in if let go.
    const ghostFill = geo(new THREE.MeshBasicMaterial({ color: 0xc9944f, transparent: true, opacity: 0.12, depthWrite: false }));
    const ghostLine = geo(new THREE.LineBasicMaterial({ color: 0xc9944f, transparent: true, opacity: 0.55 }));
    const awayFill = geo(new THREE.MeshBasicMaterial({ color: 0x8a3b3b, transparent: true, opacity: 0.07, depthWrite: false }));
    const awayLine = geo(new THREE.LineBasicMaterial({ color: 0x9a4a44, transparent: true, opacity: 0.35 }));
    const fitFill = geo(new THREE.MeshBasicMaterial({ color: 0x7fbf7a, transparent: true, opacity: 0.25, depthWrite: false }));
    const fitLine = geo(new THREE.LineBasicMaterial({ color: 0x9fe09a }));

    type Slot = { piece: ModelPiece; ghost: THREE.Group; solid: THREE.Group };
    const slots = new Map<string, Slot>();
    const loose = new Map<string, Loose>();
    const pickables: THREE.Object3D[] = [];
    const ghostHits: THREE.Object3D[] = [];
    for (const piece of build.pieces) {
      const ghost = ghostGroup(piece.boxes, ghostFill, ghostLine);
      setAt(ghost, piece.slot.x, 0.001, piece.slot.z, piece.slot.yawDeg);
      ghost.traverse(o => { o.userData.slot = piece.id; });
      const solid = boxesGroup(piece.boxes, mats);
      setAt(solid, piece.slot.x, 0, piece.slot.z, piece.slot.yawDeg);
      solid.visible = false;
      scene.add(ghost, solid);
      ghostHits.push(ghost);
      slots.set(piece.id, { piece, ghost, solid });
    }
    const paintGhost = (s: Slot, fillMat: THREE.Material, lineMat: THREE.Material) => {
      s.ghost.traverse(o => {
        if ((o as THREE.LineSegments).isLineSegments) (o as THREE.LineSegments).material = lineMat;
        else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = fillMat;
      });
    };

    const restY = (x: number, z: number) => (Math.abs(x) < baseW / 2 && Math.abs(z) < baseD / 2 ? 0 : -drop);

    // Redraw from shared state: placed pieces solid in their slots, available
    // ones loose (where they were left, or at their starting spot), the rest
    // only outlines.
    const sync = (s: ModelState) => {
      for (const [id, slot] of slots) {
        const placed = s.placed.includes(id);
        const available = isAvailable(slot.piece, s);
        slot.solid.visible = placed;
        slot.ghost.visible = !placed;
        paintGhost(slot, available ? ghostFill : awayFill, available ? ghostLine : awayLine);
        const l = loose.get(id);
        if (placed || !available) {
          if (l) {
            scene.remove(l.group);
            pickables.splice(pickables.indexOf(l.group), 1);
            loose.delete(id);
            if (dragging?.id === id) dragging = null;
          }
        } else if (!l) {
          const at = loosePlace(build, slot.piece);
          const group = boxesGroup(slot.piece.boxes, mats);
          setAt(group, at.x, restY(at.x, at.z), at.z, at.yawDeg);
          group.traverse(o => { o.userData.piece = id; });
          scene.add(group);
          pickables.push(group);
          loose.set(id, { piece: slot.piece, group, yawDeg: at.yawDeg });
        }
      }
    };

    // ── Looking round: orbit the model's centre ──
    let orbitYaw = 0;
    let orbitPitch = 52 * D2R;
    let dist = 2.9;
    const target = new THREE.Vector3(0, 0.05, 0);
    const placeCamera = () => {
      camera.position.set(
        target.x + Math.sin(orbitYaw) * Math.cos(orbitPitch) * dist,
        target.y + Math.sin(orbitPitch) * dist,
        target.z + Math.cos(orbitYaw) * Math.cos(orbitPitch) * dist,
      );
      camera.lookAt(target);
    };
    placeCamera();

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ── Picking up, carrying and setting down ──
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
    const hitPoint = new THREE.Vector3();
    let dragging: { id: string; offX: number; offZ: number } | null = null;
    let orbiting: { x: number; y: number } | null = null;
    // A piece flying into its slot.
    const flights: { group: THREE.Group; from: THREE.Vector3; fromYaw: number; to: THREE.Vector3; toYaw: number; t0: number; done: () => void }[] = [];

    const pointerRay = (e: { clientX: number; clientY: number }) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const onPlane = () => (ray.ray.intersectPlane(plane, hitPoint) ? hitPoint : null);
    const fits = (l: Loose) => {
      const s = l.piece.slot;
      return Math.hypot(l.group.position.x - s.x, l.group.position.z - s.z) < SNAP_DIST && turnOff(l.yawDeg, l.piece) < SNAP_TURN;
    };
    const showFit = () => {
      for (const [id, slot] of slots) {
        if (slot.solid.visible) continue;
        const l = dragging?.id === id ? loose.get(id) : undefined;
        const available = !!stateRef.current && isAvailable(slot.piece, stateRef.current);
        if (l && fits(l)) paintGhost(slot, fitFill, fitLine);
        else paintGhost(slot, available ? ghostFill : awayFill, available ? ghostLine : awayLine);
      }
    };
    const turnHeld = (dir: number) => {
      const l = dragging ? loose.get(dragging.id) : undefined;
      if (!l) return;
      l.yawDeg = (((l.yawDeg + dir * TURN_STEP) % 360) + 360) % 360;
      l.group.rotation.y = l.yawDeg * D2R;
      showFit();
    };

    const onDown = (e: PointerEvent) => {
      pointerRay(e);
      const hit = ray.intersectObjects(pickables, true)[0];
      const id = hit?.object.userData.piece as string | undefined;
      const l = id ? loose.get(id) : undefined;
      renderer.domElement.setPointerCapture(e.pointerId);
      if (e.button === 0 && l && onPlane()) {
        dragging = { id: l.piece.id, offX: l.group.position.x - hitPoint.x, offZ: l.group.position.z - hitPoint.z };
        l.group.position.y = LIFT;
        setHeld(l.piece.title);
        setHover(null);
        showFit();
      } else {
        orbiting = { x: e.clientX, y: e.clientY };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (orbiting) {
        orbitYaw -= (e.clientX - orbiting.x) * 0.006;
        orbitPitch = THREE.MathUtils.clamp(orbitPitch + (e.clientY - orbiting.y) * 0.005, 12 * D2R, 86 * D2R);
        orbiting = { x: e.clientX, y: e.clientY };
        placeCamera();
        return;
      }
      pointerRay(e);
      if (dragging) {
        const l = loose.get(dragging.id);
        if (l && onPlane()) {
          l.group.position.x = THREE.MathUtils.clamp(hitPoint.x + dragging.offX, -tableW / 2 + 0.05, tableW / 2 - 0.05);
          l.group.position.z = THREE.MathUtils.clamp(hitPoint.z + dragging.offZ, -tableD / 2 + 0.05, tableD / 2 - 0.05);
          showFit();
        }
        return;
      }
      // Hovering: name the piece under the pointer, or the outline.
      const p = ray.intersectObjects(pickables, true)[0];
      if (p) {
        const l = loose.get(p.object.userData.piece);
        setHover(l ? l.piece.title : null);
        renderer.domElement.style.cursor = 'grab';
        return;
      }
      renderer.domElement.style.cursor = '';
      const g = ray.intersectObjects(ghostHits.filter(gh => gh.visible), true).find(h => (h.object as THREE.Mesh).isMesh);
      const slot = g ? slots.get(g.object.userData.slot) : undefined;
      if (slot) {
        const away = !!stateRef.current && !isAvailable(slot.piece, stateRef.current);
        setHover(away ? `Where ${slot.piece.title} goes — not on this table` : `Where ${slot.piece.title} goes`);
      } else {
        setHover(null);
      }
    };
    const onUp = (e: PointerEvent) => {
      renderer.domElement.releasePointerCapture?.(e.pointerId);
      orbiting = null;
      if (!dragging) return;
      const l = loose.get(dragging.id);
      dragging = null;
      setHeld(null);
      if (!l) return;
      if (fits(l)) {
        // Into the slot: fly the last few centimetres, then hand it to the shared model.
        const s = l.piece.slot;
        pickables.splice(pickables.indexOf(l.group), 1);
        loose.delete(l.piece.id);
        const fromYaw = l.yawDeg;
        let toYaw = s.yawDeg;
        while (toYaw - fromYaw > 180) toYaw -= 360;
        while (toYaw - fromYaw < -180) toYaw += 360;
        flights.push({
          group: l.group, from: l.group.position.clone(), fromYaw, to: new THREE.Vector3(s.x, 0, s.z), toYaw, t0: performance.now(),
          done: () => { scene.remove(l.group); placeRef.current(l.piece); },
        });
      } else {
        l.group.position.y = restY(l.group.position.x, l.group.position.z);
      }
      showFit();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (dragging) { turnHeld(e.deltaY > 0 ? -1 : 1); return; }
      dist = THREE.MathUtils.clamp(dist * (1 + Math.sign(e.deltaY) * 0.08), 0.8, 4.5);
      placeCamera();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyR') turnHeld(-1);
      else if (e.code === 'KeyQ') turnHeld(1);
    };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);

    syncRef.current = sync;
    if (stateRef.current) sync(stateRef.current);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        const t = Math.min((now - f.t0) / 180, 1);
        const k = t * t * (3 - 2 * t);
        f.group.position.lerpVectors(f.from, f.to, k);
        f.group.position.y += Math.sin(Math.PI * k) * 0.01;
        f.group.rotation.y = (f.fromYaw + (f.toYaw - f.fromYaw) * k) * D2R;
        if (t >= 1) { flights.splice(i, 1); f.done(); }
      }
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      syncRef.current = null;
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      owned.forEach(o => o.dispose());
      renderer.dispose();
      el.remove();
    };
  }, [build]);

  const total = build.pieces.length;
  const placed = state?.placed.length ?? 0;
  const away = state ? build.pieces.filter(p => !state.placed.includes(p.id) && !isAvailable(p, state)).length : 0;
  const complete = !!state && placed >= total;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        width: 'min(1100px, 94%)', height: 'min(760px, 90%)', display: 'flex', flexDirection: 'column',
        background: 'rgba(14,11,8,0.97)', border: '1px solid var(--brass-dim)',
        borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--parchment)' }}>{title}</span>
          <span style={{ ...mono, fontSize: 10, color: complete ? 'var(--forest)' : 'var(--brass)' }}>
            {state ? `${placed} of ${total} in place` : error ? 'Could not load the model' : 'Loading…'}
            {state && away > 0 && <span style={{ color: 'var(--ink-text-2)' }}> · {away} still to be found elsewhere</span>}
          </span>
          <span style={{ flex: 1 }} />
          {isGM && (
            <button onClick={reset} style={{ ...mono, fontSize: 9, padding: '4px 8px', background: 'transparent', color: 'var(--blood)', border: '1px solid var(--blood)', borderRadius: 3, cursor: 'pointer' }}>
              Reset model
            </button>
          )}
          <button onClick={onClose} style={{ ...mono, fontSize: 9, padding: '4px 8px', background: 'transparent', color: 'var(--brass)', border: '1px solid var(--brass-dim)', borderRadius: 3, cursor: 'pointer' }}>
            Step back · Esc
          </button>
        </div>

        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
          {(held || hover) && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
              padding: '4px 10px', background: 'rgba(14,11,8,0.85)', border: '1px solid rgba(201,148,79,0.3)', borderRadius: 3,
              fontSize: 12, color: 'var(--parchment)', whiteSpace: 'nowrap',
            }}>
              {held ? <>Holding {held} · <span style={{ color: 'var(--brass)' }}>R / Q</span> or wheel to turn it</> : hover}
            </div>
          )}
          {complete && (
            <div style={{
              position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 90%)', pointerEvents: 'none',
              padding: '10px 14px', background: 'rgba(14,11,8,0.9)', border: '1px solid var(--forest)', borderRadius: 3,
              fontSize: 13, lineHeight: 1.6, color: 'var(--parchment)', textAlign: 'center',
            }}>
              {build.completeText}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', padding: '8px 14px', borderTop: '1px solid rgba(201,148,79,0.18)' }}>
          <p style={{ margin: 0, flex: 1, fontSize: 11, lineHeight: 1.5, color: 'var(--ink-text-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {text}
          </p>
          <span style={{ ...mono, fontSize: 9, color: 'var(--ink-text-2)', whiteSpace: 'nowrap' }}>
            Drag a piece onto its outline · drag elsewhere to look round · wheel to zoom
          </span>
        </div>
      </div>
    </div>
  );
}
