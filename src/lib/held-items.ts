/**
 * Things that show in the investigator's hand, first-person (see
 * held-viewmodel.ts): inventory items taken in hand, matched by their sheet
 * equipment text, and pickups lying in a level (a level's `pickups`). Items
 * with no model are held without one, as before.
 *
 * Models come as they were made — any scale, any axis. Each one says how to
 * turn it so its barrel points along -Z with +Y up, how long it really is,
 * and where on it the hand closes, as fractions of its own bounding box, so
 * no model has to be re-exported to fit.
 *
 * Credits (all from Sketchfab):
 *  - "Colt M1911" by Ole Gunnar Isager (sketchfab.com/FrenchBaguette), CC-BY-4.0
 *  - "Renaissance Rifle" by denis_cliofas (sketchfab.com/denis_cliofas), CC-BY-4.0
 *  - "Tommy Gun" by lokeig (sketchfab.com/lokeig), CC-BY-NC-4.0 (non-commercial)
 *  - "AK74U | FREE ANIMATION." by BURNER (sketchfab.com/Alexander_Ovelar), CC-BY-4.0
 * Also in public/props/CREDITS.txt.
 */

import type { GunSound } from '@/app/components/gun-sounds';

export type HeldModel = {
  /** A .glb under public/; meshopt-compressed is fine. */
  model: string;
  /** Turns the model as made so its muzzle points along -Z and up is +Y — radians, XYZ order. */
  orient: [number, number, number];
  /** Its real length in metres: the longest side of its bounding box is scaled to this. */
  length: number;
  /** Where the right hand closes, as fractions (0..1) of the model's bounding box along its own X, Y and Z. */
  gripAt: [number, number, number];
  /** Where a left hand steadies it (a fore-grip), same terms; long guns only. */
  supportAt?: [number, number, number];
  /** Where the grip sits in view, camera space (metres; -Z is ahead), and how it is angled there. */
  pos: [number, number, number];
  rot: [number, number, number];
  /** Draw hands. Off for the long guns, which are shown on their own (the GM's call). */
  hand: boolean;
  /** R reloads it (see reloads.ts): a muzzle-loader's powder, ball and ramrod. */
  reload?: 'muzzle';
  /** A first-person rig made with its own arms and animations: it is played, not posed (see ArmsRig). */
  arms?: ArmsRig;
  /** A revolver in borrowed arms, posed rather than played (see RevolverRig). */
  revolver?: RevolverRig;
};

type V3 = [number, number, number];

/**
 * A revolver worked by another rig's arms (the AK-74u's), its own gun hidden
 * (see revolver.ts): the idle clip gives the fingers and the breathing, and
 * each hand is reached to the revolver by IK, so they can open the crane,
 * punch the ejector and feed the chambers, which no clip in the rig does.
 */
export type RevolverRig = {
  /** The glb with the arms, its gun's materials (left out), and the clip to breathe with. */
  rig: string;
  hide: string[];
  idle: string;
  /** Where the eye sits in the rig as made (metres; it looks along -Z). */
  eye: V3;
  /** The rig's gun bone, and where on it (rig as made, at rest) its right hand closes: the revolver's grip goes there, so the hand holds it as it held its own. */
  gunBone: string;
  mount: V3;
  /** Upper arm, forearm and hand bones; and the right thumb and index tips, which pinch a round. */
  arms: { right: [string, string, string]; left: [string, string, string]; rightTips: [string, string] };
  /** The gun's moving parts (bones) and the rounds' material. */
  parts: { hammer: string; trigger: string; crane: string; cylinder: string; rounds: string };
  /** The grip in view at the hip: camera space (metres) and turn (radians). Down the sights, the rear sight is `sightAt` ahead of the eye. */
  hold: { pos: V3; rot: V3 };
  sightAt: number;
  /** The left hand at the hip, wrapped under the right, in the gun's frame (grip at the origin, barrel along -Z): the wrist, and which way its fingers run and its palm faces. */
  support: { at: V3; fingers: V3; palm: V3 };
  /** The hands' field of view (degrees) at the hip and down the sights. */
  fov: number;
  aimFov: number;
  /** A spent case: radius and length. */
  shell: [number, number];
};

/**
 * A gun that comes with its own arms and clips, made for a first-person
 * camera: drawn, idled, fired, reloaded, inspected and holstered by playing
 * its clips, seen from `eye`. Its `pos`/`rot`/`gripAt` only matter for the
 * copy lying on a bench.
 *
 * A gun without arms of its own can borrow another's (`rig` + `mount`): that
 * rig's gun is hidden, this one is fixed to its gun bone with the grip in
 * the right hand, and its magazine parts ride the rig's magazine bones, so
 * the same hands fire and reload it. Points are in the rig as made, at rest
 * (metres), and measured from renders.
 */
export type ArmsRig = {
  /** The glb with the arms and clips, when it is not the gun's own `model`. */
  rig?: string;
  mount?: {
    /** Where the gun's grip (`gripAt`) goes. */
    at: [number, number, number];
    /** The rig's own gun, left out: material names. */
    hide: string[];
    /** Parts of the gun named with this prefix ride the magazine bones: the Tommy's drum. */
    magParts: string;
  };
  /** Where the eye sits in the model as made (metres; it looks along -Z), at the hip and aiming down the sights. */
  eye: [number, number, number];
  aimEye: [number, number, number];
  /** The hands' field of view (degrees) at the hip and down the sights. */
  fov: number;
  aimFov: number;
  /** Clip names in the glb. */
  clips: { draw: string; idle: string; shoot: string; reload: string; reloadEmpty: string; inspect: string; holster: string };
  /** The bone the gun hangs from; the magazine in it, and the fresh one a reload brings. */
  gunBone: string;
  magBone: string;
  spareBone: string;
  /** The muzzle (for the flash), and the port spent cases fly from. */
  muzzle: [number, number, number];
  eject: [number, number, number];
  /** A spent case: radius and length. */
  shell: [number, number];
  rounds: number;
  /** Rounds a minute, held on the trigger. */
  rpm: number;
  /** Sounds through each reload, seconds in: a partial magazine, and an empty one (bolt racked too). */
  reloadCues: [number, GunSound][];
  reloadEmptyCues: [number, GunSound][];
  /** Left off the copy on a bench: the arms' meshes (by material name), and bones folded to nothing (the spare magazine). */
  benchHide: string[];
  benchCollapse: string[];
};

type Pose = Pick<HeldModel, 'pos' | 'rot'>;
/** Low and right, turned in so the left flank shows: how a handgun is carried. */
const PISTOL_POSE: Pose = { pos: [0.13, -0.125, -0.44], rot: [0.03, 0.24, -0.04] };
/**
 * Long guns ride higher than a handgun, near the line of the eye, or the
 * barrel's perspective runs it steeply up the screen; the muzzle is tipped
 * down a touch to match.
 */
const RIFLE_POSE: Pose = { pos: [0.17, -0.13, -0.3], rot: [-0.07, 0.08, -0.06] };
const SMG_POSE: Pose = { pos: [0.17, -0.15, -0.44], rot: [-0.04, 0.1, -0.06] };

/**
 * The AK-74u's arms. Bones as made: Bone_043 the gun, carg_044 the magazine in
 * it, carg2_048 the fresh one (kept out of sight below), recam_045 the bolt.
 * Timings measured off those bones.
 */
const AK_ARMS: ArmsRig = {
  eye: [0, 1.6, 0.04],
  aimEye: [0.067, 1.581, 0.09],
  fov: 64,
  aimFov: 50,
  clips: { draw: 'DRAW', idle: 'IDLE', shoot: 'SHOOT', reload: 'RELOAD1', reloadEmpty: 'RELOAD2', inspect: 'INSPEC', holster: 'OLSER' },
  gunBone: 'Bone_043',
  magBone: 'carg_044',
  spareBone: 'carg2_048',
  muzzle: [0.067, 1.531, -0.552],
  eject: [0.095, 1.545, -0.27],
  shell: [0.0047, 0.039],      // 5.45 × 39
  rounds: 30,
  rpm: 650,
  reloadCues: [[0.5, 'latch'], [0.6, 'scrape'], [1.42, 'clack']],
  reloadEmptyCues: [[0.3, 'latch'], [1.2, 'scrape'], [1.28, 'clack'], [2.22, 'boltBack'], [2.5, 'boltHome']],
  benchHide: ['Ch08_body', 'Ch08_body1', 'Null.001'],
  benchCollapse: ['carg2_048'],
};

export const HELD_MODELS = {
  // Colt Detective Special, the snub-nosed .38; barrel already along -Z. Held
  // two-handed in the AK-74u's arms (its gun hidden), fired double-action and
  // reloaded through the swung-out cylinder (revolver.ts).
  detectiveSpecial: {
    model: '/props/detective-special.glb', orient: [0, 0, 0], length: 0.1875,
    gripAt: [0.5, 0.28, 0.867], ...PISTOL_POSE, hand: true,
    revolver: {
      rig: '/props/ak74u.glb',
      hide: ['Krinkov', 'Magazine', 'Null.001'],
      idle: 'IDLE',
      eye: [0, 1.6, 0.04],
      gunBone: 'Bone_043',
      mount: [0.072, 1.452, -0.155],
      arms: {
        right: ['mixamorig7RightArm_021', 'mixamorig7RightForeArm_022', 'mixamorig7RightHand_023'],
        left: ['mixamorig7LeftArm_03', 'mixamorig7LeftForeArm_04', 'mixamorig7LeftHand_05'],
        rightTips: ['mixamorig7RightHandThumb3_026', 'mixamorig7RightHandIndex3_029'],
      },
      parts: { hammer: 'Hammer', trigger: 'Trigger', crane: 'Hinge', cylinder: 'Cylinder', rounds: 'Bullet' },
      hold: { pos: [0.13, -0.15, -0.38], rot: [0.0, 0.28, 0.12] },
      sightAt: 0.33,
      support: { at: [-0.035, -0.045, 0.035], fingers: [0.55, 0.3, -0.8], palm: [1, 0.1, 0.25] },
      fov: 60,
      aimFov: 46,
      shell: [0.0048, 0.029],     // .38 Special
    },
  },
  // Colt M1911 .45; made lying along X with the muzzle toward -X.
  coltM1911: {
    model: '/props/colt-m1911.glb', orient: [0, -Math.PI / 2, 0], length: 0.216,
    gripAt: [0.83, 0.39, 0.5], ...PISTOL_POSE, hand: true,
  },
  // A wheel-lock long gun; along X, muzzle toward +X. Held at the wrist of the stock.
  renaissanceRifle: {
    model: '/props/renaissance-rifle.glb', orient: [0, Math.PI / 2, 0], length: 1.25,
    gripAt: [0.28, 0.4, 0.5], supportAt: [0.6, 0.62, 0.5], ...RIFLE_POSE, hand: false, reload: 'muzzle',
  },
  // Thompson submachine gun with the drum; along X, muzzle toward +X. (The
  // model's loose cartridge, "bullet_low", is stripped before compressing.)
  // Fired and reloaded by the AK-74u's hands (its gun hidden): the right hand on
  // the rear grip, the left on the fore-grip, the drum carried by the magazine
  // bones, so the hands pull it out and seat a fresh one.
  tommyGun: {
    model: '/props/tommy-gun.glb', orient: [0, Math.PI / 2, 0], length: 0.85,
    gripAt: [0.42, 0.38, 0.5], supportAt: [0.73, 0.4, 0.5], ...SMG_POSE, hand: false,
    arms: {
      ...AK_ARMS,
      rig: '/props/ak74u.glb',
      mount: { at: [0.072, 1.46, -0.16], hide: ['Krinkov', 'Magazine', 'Null.001'], magParts: 'mag' },
      // Its receiver is tall and near the eye: seen from a little higher and further back.
      eye: [-0.03, 1.66, 0.1],
      // Through the rear sight's ears to the blade on the compensator.
      aimEye: [0.0724, 1.603, 0.12],
      muzzle: [0.072, 1.569, -0.651],
      eject: [0.094, 1.565, -0.26],
      shell: [0.006, 0.023],      // .45 ACP
      rounds: 50,
      rpm: 700,
    },
  },
  // AK-74u with its own arms and clips; made in metres, muzzle along -Z, the
  // eye near the origin.
  ak74u: {
    model: '/props/ak74u.glb', orient: [0, 0, 0], length: 0.66,
    gripAt: [0.5, 0.4, 0.6], ...SMG_POSE, hand: false,
    arms: AK_ARMS,
  },
} satisfies Record<string, HeldModel>;

/** Inventory items with a model, matched by their sheet text. */
const INVENTORY: { match: RegExp; view: HeldModel }[] = [
  { match: /detective special|revolver/i, view: HELD_MODELS.detectiveSpecial },
];

/** The model for an inventory item, if it has one. */
export function heldModelFor(item: string | null | undefined): HeldModel | null {
  if (!item) return null;
  return INVENTORY.find(h => h.match.test(item))?.view ?? null;
}
