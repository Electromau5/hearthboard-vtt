import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Other investigators in a walkthrough level, as animated figures.
 *
 * The figure is Quaternius's "Animated Human" (CC0, opengameart.org/content/
 * animated-human-low-poly), exported to /avatars/investigator.glb with only
 * its Idle, Walk and Run clips, and with the arm and foot faces moved onto
 * their own palette bands so they read as sleeves and shoes. Its texture is a
 * column of colour bands, so each investigator is dressed by painting a
 * palette (see OUTFITS) rather than by a texture of their own.
 *
 * An investigator listed in DRESSED has a model of their own instead — a
 * MakeHuman body built in Blender with MPFB, in period clothes, on a Mixamo
 * skeleton carrying the same three clips. Those keep their own materials and
 * real height; the palette figure remains for everyone else and the Keeper.
 */

export type Gait = 'idle' | 'walk' | 'run';

type Outfit = {
  skin: string; eyes: string; hair: string; jacket: string; trousers: string; shoes: string;
  hat?: { kind: 'fedora' | 'cap'; color: string };
  /** Width and depth relative to height — over 1 for a heavyset build. */
  girth?: number;
};

/** Dressed from each dossier: Wright's surveyor tweed, Finch's mortuary black, Callahan's worn trench coat. */
const OUTFITS: Record<string, Outfit> = {
  'arthur-wright': { skin: '#d9a582', eyes: '#2a1d14', hair: '#8a8580', jacket: '#6b5034', trousers: '#4a4640', shoes: '#3a2414', hat: { kind: 'cap', color: '#5a4a38' } },
  'dr-alistair-finch': { skin: '#e2b896', eyes: '#1d1712', hair: '#1f1a16', jacket: '#1c1c20', trousers: '#18181b', shoes: '#0d0d0f' },
  'thomas-callahan': { skin: '#cf9c76', eyes: '#2a1d14', hair: '#3b2a1e', jacket: '#9a7a4f', trousers: '#3a3630', shoes: '#161210', hat: { kind: 'fedora', color: '#2e2a26' } },
};
/**
 * People in the levels (see NpcSpot). The Chief Attendant is drawn from his
 * portrait: bald, heavyset, a cream attendant's smock, grey trousers.
 */
const NPC_OUTFITS: Record<string, Outfit> = {
  'chief-attendant': { skin: '#d9a585', eyes: '#2a1d14', hair: '#d4a080', jacket: '#d6cfbd', trousers: '#5a554e', shoes: '#1a1612', girth: 1.18 },
};
/** Anyone without an investigator — the Keeper walking the level. */
const KEEPER: Outfit = { skin: '#d4a684', eyes: '#1d1712', hair: '#2a2420', jacket: '#3a2f45', trousers: '#232028', shoes: '#111', hat: { kind: 'fedora', color: '#1a1720' } };

/** Rows of the 32-px texture each part samples, top to bottom, in glTF UV space. */
const BANDS: [keyof Omit<Outfit, 'hat' | 'girth'>, number, number][] = [
  ['skin', 0, 5.9], ['eyes', 5.9, 9.5], ['hair', 9.5, 15.6], ['jacket', 15.6, 20.9], ['trousers', 20.9, 29.5], ['shoes', 29.5, 32],
];

const MODEL_URL = '/avatars/investigator.glb';
/** Investigators with a model of their own, at /avatars/<slug>.glb. */
const DRESSED = new Set(['thomas-callahan']);
const HEIGHT = 1.75;         // metres, crown to heel
const CLIP: Record<Gait, string> = { idle: 'Idle', walk: 'Walk', run: 'Run' };

type Model = { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
const models = new Map<string, Promise<Model>>();
function loadModel(url: string) {
  let p = models.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url).then(g => ({ scene: g.scene, clips: g.animations }));
    models.set(url, p);
  }
  return p;
}

function paletteTexture(o: Outfit): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  for (const [part, from, to] of BANDS) {
    ctx.fillStyle = o[part];
    ctx.fillRect(0, from, 32, to - from);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;                       // glTF UVs
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function makeHat(hat: NonNullable<Outfit['hat']>): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color: hat.color, roughness: 0.9 });
  const g = new THREE.Group();
  if (hat.kind === 'fedora') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 20), mat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.11, 16), mat);
    crown.position.y = 0.06;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.111, 0.111, 0.025, 16), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 }));
    band.position.y = 0.02;
    g.add(brim, crown, band);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    cap.scale.set(1, 0.55, 1.05);
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 16, 1, false, -Math.PI / 2, Math.PI), mat);
    peak.position.set(0, 0.005, 0.07);
    g.add(cap, peak);
    g.position.y = 0.02;   // a flat cap sits higher than a fedora's band
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** A name over the head, always facing the camera and readable in the dark. */
function makeLabel(text: string): THREE.Sprite {
  const font = '600 44px Georgia, serif';
  const c = document.createElement('canvas');
  const measure = c.getContext('2d')!;
  measure.font = font;
  // Sized to the name, so a long one is never clipped.
  c.width = Math.ceil(measure.measureText(text).width + 48);
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.font = font;
  ctx.fillStyle = 'rgba(10,8,6,0.72)';
  ctx.beginPath();
  ctx.roundRect(4, 14, c.width - 8, 68, 34);
  ctx.fill();
  ctx.fillStyle = '#e8d6b0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(0.15 * c.width / c.height, 0.15, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export type RemoteAvatar = {
  group: THREE.Group;
  /** The name over their head — a level can hide it when they are far off. */
  label: THREE.Sprite;
  /** Where the network last said they were; the figure eases toward it. */
  setTarget: (feet: THREE.Vector3, yaw: number, gait: Gait) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

/**
 * One other investigator. `slug` picks their outfit (an unknown slug, e.g. the
 * gamelord, dresses as the Keeper). Resolves once the shared model has loaded.
 */
export async function createAvatar(slug: string | null, name: string): Promise<RemoteAvatar> {
  const dressed = !!slug && DRESSED.has(slug);
  const { scene, clips } = await loadModel(dressed ? `/avatars/${slug}.glb` : MODEL_URL);
  const outfit = (slug && (OUTFITS[slug] ?? NPC_OUTFITS[slug])) || KEEPER;
  const figure = SkeletonUtils.clone(scene);

  // Measure the skinned, posed vertices: the mesh's own bounds are its unposed
  // geometry, which lies along Z until the skeleton stands it up.
  figure.updateMatrixWorld(true);
  const raw = new THREE.Box3().setFromObject(figure, true);
  // A dressed model is built in metres at the investigator's own height.
  const scale = dressed ? 1 : HEIGHT / (raw.max.y - raw.min.y);
  figure.scale.set(scale * (outfit.girth ?? 1), scale, scale * (outfit.girth ?? 1));
  figure.position.y = -raw.min.y * scale;
  const top = (raw.max.y - raw.min.y) * scale;

  const owned: { dispose: () => void }[] = [];
  const tex = dressed ? null : paletteTexture(outfit);
  if (tex) owned.push(tex);
  figure.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;   // skinned bounds lag the animation
    if (!tex) {
      // Hair, brows and lashes are cut-outs: test alpha rather than blend, so
      // overlapping cards neither sort wrongly nor flicker. The materials are
      // shared by every copy of the model, so they are not ours to dispose.
      for (const mat of [m.material].flat() as THREE.MeshStandardMaterial[]) {
        if (mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true; }
      }
      return;
    }
    // Blender exports the material fully metallic, which renders black without an environment map.
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
    owned.push(mat);
    m.material = mat;
  });

  if (!dressed && outfit.hat) {
    const head = figure.getObjectByName('Head');
    if (head) {
      const hat = makeHat(outfit.hat);
      // The head bone carries the armature's own scale and axes, so place the
      // hat in world terms at the bind pose — level, on the crown — and let it
      // follow the bone from there.
      figure.updateMatrixWorld(true);
      const crown = head.getWorldPosition(new THREE.Vector3());
      crown.y = raw.max.y * scale + figure.position.y - 0.035;
      const boneQ = head.getWorldQuaternion(new THREE.Quaternion());
      const boneS = head.getWorldScale(new THREE.Vector3());
      head.add(hat);
      hat.position.copy(head.worldToLocal(crown.clone()));
      hat.quaternion.copy(boneQ.invert());
      hat.scale.set(1 / boneS.x, 1 / boneS.y, 1 / boneS.z);
      hat.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) owned.push(m.geometry, m.material as THREE.Material); });
    }
  }

  const label = makeLabel(name);
  label.position.y = top + 0.3;
  owned.push(label.material.map!, label.material);

  const group = new THREE.Group();
  group.add(figure, label);

  const mixer = new THREE.AnimationMixer(figure);
  const actions = {} as Record<Gait, THREE.AnimationAction>;
  for (const g of ['idle', 'walk', 'run'] as Gait[]) {
    const clip = clips.find(c => c.name === CLIP[g]);
    actions[g] = mixer.clipAction(clip!);
  }
  let gait: Gait = 'idle';
  actions.idle.play();

  const target = new THREE.Vector3();
  let targetYaw = 0;
  let placed = false;

  return {
    group,
    label,
    setTarget(feet, yaw, next) {
      target.copy(feet);
      targetYaw = yaw;
      // First sighting: appear in place rather than gliding in from the origin.
      if (!placed) { group.position.copy(feet); group.rotation.y = yaw + Math.PI; placed = true; }
      if (next !== gait) {
        actions[next].reset().fadeIn(0.2).play();
        actions[gait].fadeOut(0.2);
        gait = next;
      }
    },
    update(dt) {
      mixer.update(dt);
      // Positions arrive about ten times a second; ease between them.
      const k = 1 - Math.exp(-dt * 12);
      group.position.lerp(target, k);
      // The figure faces +Z; the camera looks down -Z at yaw 0.
      const want = targetYaw + Math.PI;
      let d = want - group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      group.rotation.y += d * k;
    },
    dispose() {
      mixer.stopAllAction();
      group.removeFromParent();
      for (const o of owned) o.dispose();
    },
  };
}
