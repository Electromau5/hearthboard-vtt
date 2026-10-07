import * as THREE from 'three';
import type { ModelBox, ModelBuild, ModelPiece, ModelState } from '@/lib/walkthrough';

/**
 * Meshes for a model to put together (ModelBuilder, and the finished pieces
 * on the real table in the level). Every block is a unit box scaled into
 * place, so a whole city shares one geometry.
 */

export type ModelMaterials = Record<ModelBox['mat'], THREE.Material> & { dispose(): void };

export function modelMaterials(): ModelMaterials {
  const m = {
    basalt: new THREE.MeshStandardMaterial({ color: 0x16201b, roughness: 0.7, metalness: 0.05 }),
    verdigris: new THREE.MeshStandardMaterial({ color: 0x3d7564, roughness: 0.6, metalness: 0.3 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xcfc4a8, roughness: 1 }),
  };
  return { ...m, dispose: () => Object.values(m).forEach(x => x.dispose()) };
}

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const D2R = Math.PI / 180;

function placeBox(o: THREE.Object3D, b: ModelBox) {
  o.position.set(...b.at);
  if (b.rot) o.rotation.set(b.rot[0] * D2R, b.rot[1] * D2R, b.rot[2] * D2R);
  o.scale.set(...b.size);
}

/** Solid blocks, their origin at the piece's foot. */
export function boxesGroup(boxes: ModelBox[], mats: ModelMaterials): THREE.Group {
  const g = new THREE.Group();
  for (const b of boxes) {
    const mesh = new THREE.Mesh(UNIT, mats[b.mat]);
    placeBox(mesh, b);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

const EDGES = new THREE.EdgesGeometry(UNIT);

/** The outline of where a piece goes: faint faces and bright edges. */
export function ghostGroup(boxes: ModelBox[], fill: THREE.Material, line: THREE.LineBasicMaterial): THREE.Group {
  const g = new THREE.Group();
  for (const b of boxes) {
    const face = new THREE.Mesh(UNIT, fill);
    placeBox(face, b);
    const edge = new THREE.LineSegments(EDGES, line);
    placeBox(edge, b);
    g.add(face, edge);
  }
  return g;
}

/** Puts a piece group at a spot on the base (y 0 is the base's top). */
export function setAt(g: THREE.Object3D, x: number, y: number, z: number, yawDeg: number) {
  g.position.set(x, y, z);
  g.rotation.set(0, yawDeg * D2R, 0);
}

/** Where a piece lies before anyone has moved it: its own spot on the margin, or, for one brought back from elsewhere, a place along the north edge. */
export function loosePlace(build: ModelBuild, piece: ModelPiece): { x: number; z: number; yawDeg: number } {
  if (piece.loose) return piece.loose;
  const away = build.pieces.filter(p => !p.loose);
  const i = away.indexOf(piece);
  const halfW = build.table.size[0] / 2 - 0.15;
  return { x: -halfW + ((i + 0.5) * (halfW * 2)) / Math.max(away.length, 1), z: -(build.base.size[1] / 2 + (build.table.size[1] - build.base.size[1]) / 4), yawDeg: 0 };
}

/** Is a piece on the table to be moved: loose from the start, or found. */
export function isAvailable(piece: ModelPiece, state: ModelState) {
  return piece.source === 'table' || state.found.includes(piece.id);
}

/**
 * The model as it stands, for the level: the rubble, every placed piece in
 * its slot, and the loose ones still lying on the table's margin. `update`
 * redraws it from fresh shared state.
 */
export function createModelInLevel(build: ModelBuild) {
  const mats = modelMaterials();
  const group = new THREE.Group();
  group.position.set(...build.base.at);
  group.add(boxesGroup(build.rubble, mats));
  const pieces = new Map(build.pieces.map(p => [p.id, boxesGroup(p.boxes, mats)]));
  for (const g of pieces.values()) { g.visible = false; group.add(g); }
  const update = (state: ModelState) => {
    for (const p of build.pieces) {
      const g = pieces.get(p.id)!;
      if (state.placed.includes(p.id)) {
        setAt(g, p.slot.x, 0, p.slot.z, p.slot.yawDeg);
        g.visible = true;
      } else if (isAvailable(p, state)) {
        const l = loosePlace(build, p);
        setAt(g, l.x, -build.table.drop, l.z, l.yawDeg);
        g.visible = true;
      } else {
        g.visible = false;
      }
    }
  };
  update({ placed: [], found: [] });
  return { group, update, dispose: () => mats.dispose() };
}
