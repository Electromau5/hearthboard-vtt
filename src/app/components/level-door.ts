import * as THREE from 'three';
import type { DoorCut, LevelDoor } from '@/lib/walkthrough';

/**
 * A door gamelord opens and shuts (see LevelDoor in src/lib/walkthrough.ts).
 * Summer exports a level's architecture merged into one mesh per material, so
 * the door's parts are cut out of those meshes here, at load: every triangle
 * lying wholly inside a cut's box moves to a mesh of its own (sharing the
 * original's vertex buffers, so nothing is copied). The leaf then swings on
 * its hinge, and boards nailed across it vanish to lie on the floor instead.
 */

export type DoorModel = {
  /** What blocks the doorway while it is shut: add to the level's walls then. */
  blocking: THREE.Mesh[];
  /** 0 shut … 1 open. */
  set: (k: number) => void;
  dispose: () => void;
};

export function createDoor(model: THREE.Object3D, scene: THREE.Scene, door: LevelDoor): DoorModel | null {
  model.updateMatrixWorld(true);
  const owned: { dispose: () => void }[] = [];

  const hinge = new THREE.Group();
  hinge.position.set(...door.hinge);
  hinge.updateMatrixWorld(true);
  const leaf = cutAll(model, door.leaf, hinge);
  if (!leaf.length) {
    console.warn(`Door "${door.label}" found nothing to cut`);
    return null;
  }
  const nailed = new THREE.Group();
  const boards = cutAll(model, door.boards ?? [], nailed);
  scene.add(hinge, nailed);

  // The boards, pried off and dropped: lying flat where `fallen` says.
  const fallen = new THREE.Group();
  fallen.visible = false;
  const boardMat = boards[0]?.material as THREE.Material | undefined;
  if (door.fallen && boardMat) {
    const [w, h, d] = door.fallen.size;
    const geo = new THREE.BoxGeometry(w, h, d);
    owned.push(geo);
    for (const [x, z, turnDeg] of door.fallen.at) {
      const board = new THREE.Mesh(geo, boardMat);
      board.position.set(x, h / 2, z);
      board.rotation.y = THREE.MathUtils.degToRad(turnDeg);
      board.receiveShadow = true;
      fallen.add(board);
    }
    scene.add(fallen);
  }

  const openRad = THREE.MathUtils.degToRad(door.openDeg);
  return {
    blocking: [...leaf, ...boards],
    set(k) {
      // Eased, so the leaf starts slow and settles against the wall.
      hinge.rotation.y = openRad * (k * k * (3 - 2 * k));
      hinge.updateMatrixWorld(true);
      nailed.visible = k === 0;
      fallen.visible = k > 0;
    },
    dispose() {
      owned.forEach(o => o.dispose());
      hinge.removeFromParent();
      nailed.removeFromParent();
      fallen.removeFromParent();
    },
  };
}

/** Moves each cut's triangles out of its mesh into a new mesh under `parent`, placed where they were. */
function cutAll(model: THREE.Object3D, cuts: DoorCut[], parent: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const toParent = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  for (const cut of cuts) {
    const mesh = model.getObjectByName(cut.mesh) as THREE.Mesh | undefined;
    if (!mesh?.isMesh) { console.warn(`Door cut: no mesh "${cut.mesh}"`); continue; }
    const geo = carve(mesh, new THREE.Box3(new THREE.Vector3(...cut.min), new THREE.Vector3(...cut.max)));
    if (!geo) { console.warn(`Door cut: nothing of "${cut.mesh}" in its box`); continue; }
    const part = new THREE.Mesh(geo, mesh.material);
    part.name = `${cut.mesh}_door`;
    part.castShadow = mesh.castShadow;
    part.receiveShadow = mesh.receiveShadow;
    part.matrix.multiplyMatrices(toParent, mesh.matrixWorld);
    part.matrix.decompose(part.position, part.quaternion, part.scale);
    parent.add(part);
    part.updateMatrixWorld(true);
    out.push(part);
  }
  return out;
}

/** Splits off the triangles of `mesh` wholly inside `box` (world space); null if there are none. */
function carve(mesh: THREE.Mesh, box: THREE.Box3): THREE.BufferGeometry | null {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const inside = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    inside[i] = box.containsPoint(v) ? 1 : 0;
  }
  const index = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.count }, (_, i) => i);
  const keep: number[] = [];
  const cut: number[] = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    (inside[a] && inside[b] && inside[c] ? cut : keep).push(a, b, c);
  }
  if (!cut.length) return null;
  geo.setIndex(keep);
  const part = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) part.setAttribute(name, attr);
  part.setIndex(cut);
  return part;
}
