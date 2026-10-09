import * as THREE from 'three';
import { PROP_LIBRARY, type PropAssetId } from '@/lib/prop-library';
import type { DressedProp } from '@/lib/walkthrough';

/**
 * Set dressing in a walkthrough level (three.js side): the props gamelord has
 * set down from the library's tray, a see-through ghost of the one he is
 * about to drop, and the raycasts that find where it would land and which
 * dressed prop is under the pointer. The tray, the drag and the saving live
 * in SetDressing.tsx; everyone else in the level only ever calls `show`.
 */

export type DropSpot = { p: [number, number, number]; up?: [number, number, number] };

export type Dressing = {
  /** Sets down exactly these, replacing whatever the last call set down. */
  show: (items: DressedProp[]) => void;
  /** The ghost to drop next (null for none), turned as it would stand. */
  setGhost: (asset: PropAssetId | null, turnDeg: number) => void;
  /**
   * Moves the ghost under a screen point (normalised -1..1), onto whatever
   * surface is there; returns where it would land, or null when the point is
   * on a wall, a ceiling or nothing.
   */
  aim: (ndc: THREE.Vector2 | null) => DropSpot | null;
  /** The key of the dressed prop under a screen point, if any. */
  pick: (ndc: THREE.Vector2) => string | null;
  /** Outlines one dressed prop (null for none). */
  select: (key: string | null) => void;
  /** Hides one dressed prop while it is being moved, its ghost standing in for it. */
  lift: (key: string | null) => void;
  dispose: () => void;
};

type Shown = { item: DressedProp; obj: THREE.Object3D; box: THREE.Box3 | null };
type Ghost = { asset: PropAssetId; turnDeg: number; obj: THREE.Object3D | null; mats: THREE.MeshStandardMaterial[] };

const UP = new THREE.Vector3(0, 1, 0);
const OK_TINT = new THREE.Color(0x3a8f4a);
const BAD_TINT = new THREE.Color(0xa83232);

/** Where a dressed prop stands and how it is turned and leaned. */
function standAt(obj: THREE.Object3D, item: { p: [number, number, number]; turnDeg: number; up?: [number, number, number] }) {
  obj.position.set(...item.p);
  obj.quaternion.setFromAxisAngle(UP, THREE.MathUtils.degToRad(item.turnDeg));
  if (item.up) obj.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...item.up).normalize()));
  obj.updateMatrixWorld(true);
}

export function createDressing(opts: {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** The prop's model, loaded once and shared; each use clones it. */
  load: (asset: PropAssetId) => Promise<THREE.Object3D>;
  /** What a drop can land on: the level, its furniture and props. Dressed props are added to it here. */
  surfaces: () => THREE.Object3D[];
  /** The level's furniture boxes, which the investigators bump into; solid dressed props join them. */
  blockers: THREE.Box3[];
}): Dressing {
  const { scene, camera, load, blockers } = opts;
  const group = new THREE.Group();
  group.name = 'SetDressing';
  scene.add(group);
  const shown = new Map<string, Shown>();
  const ray = new THREE.Raycaster();
  let generation = 0;
  let disposed = false;

  const outline = new THREE.Box3Helper(new THREE.Box3(), 0xc9944f);
  outline.visible = false;
  scene.add(outline);
  let selected: string | null = null;
  let lifted: string | null = null;

  let ghost = null as Ghost | null;
  // Where the pointer last was, so a ghost that finishes loading appears under it at once.
  let lastNdc: THREE.Vector2 | null = null;

  const unblock = (s: Shown) => {
    if (!s.box) return;
    const i = blockers.indexOf(s.box);
    if (i >= 0) blockers.splice(i, 1);
  };

  const refreshOutline = () => {
    const s = selected ? shown.get(selected) : undefined;
    outline.visible = !!s && selected !== lifted;
    if (s) outline.box.setFromObject(s.obj).expandByScalar(0.02);
  };

  const show = (items: DressedProp[]) => {
    const gen = ++generation;
    const wanted = new Map(items.map(i => [i.key, i]));
    for (const [key, s] of shown) {
      const next = wanted.get(key);
      // Moved or turned: stood again where it now is, without reloading.
      if (next && next.asset === s.item.asset) {
        if (JSON.stringify(next) === JSON.stringify(s.item)) continue;
        s.item = next;
        standAt(s.obj, next);
        s.box?.setFromObject(s.obj);
        continue;
      }
      // Gone, or something else now: taken away (set down afresh below).
      unblock(s);
      s.obj.removeFromParent();
      shown.delete(key);
    }
    for (const item of items) {
      if (shown.has(item.key)) continue;
      load(item.asset).then((template) => {
        // A later call has taken over, or this one went up in the meantime.
        if (disposed || gen !== generation || shown.has(item.key)) return;
        const obj = template.clone();
        obj.userData.dressKey = item.key;
        standAt(obj, item);
        obj.visible = item.key !== lifted;
        group.add(obj);
        const box = PROP_LIBRARY[item.asset].solid ? new THREE.Box3().setFromObject(obj) : null;
        if (box && obj.visible) blockers.push(box);
        shown.set(item.key, { item, obj, box });
        if (item.key === selected) refreshOutline();
      }).catch(err => console.error('Dressed prop failed to load:', item.asset, err));
    }
    refreshOutline();
  };

  const setGhost = (asset: PropAssetId | null, turnDeg: number) => {
    if (ghost && ghost.asset === asset) {
      ghost.turnDeg = turnDeg;
      if (ghost.obj) ghost.obj.rotation.y = THREE.MathUtils.degToRad(turnDeg);
      return;
    }
    if (ghost?.obj) {
      ghost.obj.removeFromParent();
      for (const m of ghost.mats) m.dispose();
    }
    ghost = null;
    if (!asset) return;
    const g: Ghost = { asset, turnDeg, obj: null, mats: [] };
    ghost = g;
    load(asset).then((template) => {
      if (disposed || ghost !== g) return;
      const obj = template.clone();
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        const see = (src: THREE.Material) => {
          const m = (src as THREE.MeshStandardMaterial).clone();
          m.transparent = true;
          m.opacity = 0.55;
          m.depthWrite = false;
          if (m.emissive) m.emissive.copy(OK_TINT);
          g.mats.push(m);
          return m;
        };
        // A list of materials only draws with geometry groups to match, so a single one stays single.
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(see) : see(mesh.material);
        // Never under the pointer for its own drop.
        mesh.raycast = () => {};
      });
      obj.visible = false;
      obj.rotation.y = THREE.MathUtils.degToRad(g.turnDeg);
      scene.add(obj);
      g.obj = obj;
      aim(lastNdc);
    }).catch(err => console.error('Ghost failed to load:', asset, err));
  };

  /** The first visible surface under a screen point. */
  const hitAt = (ndc: THREE.Vector2, roots: THREE.Object3D[]) => {
    ray.setFromCamera(ndc, camera);
    ray.far = 40;
    const visible = (o: THREE.Object3D | null): boolean => !o || (o.visible && visible(o.parent));
    return ray.intersectObjects(roots, true).find(h => visible(h.object) && !(h.object as THREE.Mesh & { isHelper?: boolean }).isHelper && h.object.type !== 'LineSegments');
  };

  const aim = (ndc: THREE.Vector2 | null): DropSpot | null => {
    lastNdc = ndc?.clone() ?? null;
    const g = ghost?.obj ?? null;
    if (!ndc) { if (g) g.visible = false; return null; }
    const hit = hitAt(ndc, [...opts.surfaces(), group]);
    if (!hit || !hit.face) { if (g) g.visible = false; return null; }
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    // Something to stand on: a floor, a tabletop, the top of a crate — not a wall.
    const ok = normal.y > 0.7;
    const spot: DropSpot = { p: [hit.point.x, hit.point.y, hit.point.z] };
    if (ok && normal.y < 0.999) spot.up = [normal.x, normal.y, normal.z];
    if (g && ghost) {
      standAt(g, { ...spot, turnDeg: ghost.turnDeg });
      g.visible = true;
      for (const m of ghost.mats) m.emissive?.copy(ok ? OK_TINT : BAD_TINT);
    }
    return ok ? spot : null;
  };

  const pick = (ndc: THREE.Vector2) => {
    const hit = hitAt(ndc, [...opts.surfaces(), group]);
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.dressKey) o = o.parent;
    return (o?.userData.dressKey as string | undefined) ?? null;
  };

  const select = (key: string | null) => {
    selected = key;
    refreshOutline();
  };

  const lift = (key: string | null) => {
    for (const [k, s] of shown) {
      const visible = k !== key;
      if (s.obj.visible === visible) continue;
      s.obj.visible = visible;
      // A lifted prop is not in the way while it is carried.
      if (!visible) unblock(s);
      else if (s.box) blockers.push(s.box);
    }
    lifted = key;
    refreshOutline();
  };

  return {
    show, setGhost, aim, pick, select, lift,
    dispose() {
      disposed = true;
      for (const s of shown.values()) unblock(s);
      shown.clear();
      group.removeFromParent();
      outline.removeFromParent();
      outline.dispose();
      setGhost(null, 0);
    },
  };
}
