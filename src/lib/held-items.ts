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
  /** R reloads it (see reloads.ts): a Thompson's drum, or a muzzle-loader's powder, ball and ramrod. */
  reload?: 'drum' | 'muzzle';
  /** A first-person rig made with its own arms and animations: it is played, not posed (see ArmsRig). */
  arms?: ArmsRig;
};

/**
 * A gun that comes with its own arms and clips, made for a first-person
 * camera: drawn, idled, fired, reloaded, inspected and holstered by playing
 * its clips, seen from `eye`. Its `pos`/`rot`/`gripAt` only matter for the
 * copy lying on a bench.
 */
export type ArmsRig = {
  /** Where the eye sits in the model as made (metres; it looks along -Z), at the hip and aiming down the sights. */
  eye: [number, number, number];
  aimEye: [number, number, number];
  /** The hands' field of view (degrees) at the hip and down the sights. */
  fov: number;
  aimFov: number;
  /** Clip names in the glb. */
  clips: { draw: string; idle: string; shoot: string; reload: string; reloadEmpty: string; inspect: string; holster: string };
  /** The bone the gun hangs from, and its muzzle in that bone's space (for the flash). */
  gunBone: string;
  muzzle: [number, number, number];
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

export const HELD_MODELS = {
  // Colt Detective Special, the snub-nosed .38; barrel already along -Z.
  detectiveSpecial: {
    model: '/props/detective-special.glb', orient: [0, 0, 0], length: 0.1875,
    gripAt: [0.5, 0.28, 0.867], ...PISTOL_POSE, hand: true,
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
  tommyGun: {
    model: '/props/tommy-gun.glb', orient: [0, Math.PI / 2, 0], length: 0.85,
    gripAt: [0.42, 0.38, 0.5], supportAt: [0.73, 0.4, 0.5], ...SMG_POSE, hand: false, reload: 'drum',
  },
  // AK-74u with its own arms and clips; made in metres, muzzle along -Z, the
  // eye near the origin. Bones as made: Bone_043 the gun, carg_044 the
  // magazine in it, carg2_048 the fresh one (kept out of sight below), recam_045
  // the bolt. Timings measured off those bones.
  ak74u: {
    model: '/props/ak74u.glb', orient: [0, 0, 0], length: 0.66,
    gripAt: [0.5, 0.4, 0.6], ...SMG_POSE, hand: false,
    arms: {
      eye: [0, 1.6, 0.04],
      aimEye: [0.067, 1.581, 0.09],
      fov: 64,
      aimFov: 50,
      clips: { draw: 'DRAW', idle: 'IDLE', shoot: 'SHOOT', reload: 'RELOAD1', reloadEmpty: 'RELOAD2', inspect: 'INSPEC', holster: 'OLSER' },
      gunBone: 'Bone_043',
      muzzle: [0, 0.396, -0.021],
      rounds: 30,
      rpm: 650,
      reloadCues: [[0.5, 'latch'], [0.6, 'scrape'], [1.42, 'clack']],
      reloadEmptyCues: [[0.3, 'latch'], [1.2, 'scrape'], [1.28, 'clack'], [2.22, 'boltBack'], [2.5, 'boltHome']],
      benchHide: ['Ch08_body', 'Ch08_body1', 'Null.001'],
      benchCollapse: ['carg2_048'],
    },
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
