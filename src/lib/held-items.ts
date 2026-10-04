/**
 * Inventory items that show in the investigator's hand, first-person, when
 * taken in hand in a walkthrough (see InventoryPane and held-viewmodel.ts).
 * An item is matched by its sheet equipment text, so the GM can word it as
 * they like as long as the pattern still finds it. Items with no entry are
 * held without a model, as before.
 */

export type HeldModel = {
  /** A .glb under public/; meshopt-compressed is fine. */
  model: string;
  /**
   * Turns the model so its muzzle (or business end) points along -Z, up is +Y
   * and the grip is at the origin — radians, applied in XYZ order.
   */
  orient: [number, number, number];
  /** Model-space point the hand closes round, before `orient`. */
  grip: [number, number, number];
  scale: number;
  /** Where the grip sits in view, camera space (metres; -Z is ahead), and how the item is angled there. */
  pos: [number, number, number];
  rot: [number, number, number];
  /** Draw a right hand round the grip. */
  hand: boolean;
};

const HELD: { match: RegExp; view: HeldModel }[] = [
  {
    // Colt Detective Special, the snub-nosed .38. The model already points its
    // barrel along -Z; the grip is 7 cm behind the cylinder and the trigger
    // just behind the origin.
    match: /detective special|revolver/i,
    view: {
      model: '/props/detective-special.glb',
      orient: [0, 0, 0],
      grip: [0, -0.03, 0.072],
      scale: 1,
      // Low and right, turned in so its left flank and the cylinder show.
      pos: [0.13, -0.125, -0.44],
      rot: [0.03, 0.24, -0.04],
      hand: true,
    },
  },
];

/** The model for an inventory item, if it has one. */
export function heldModelFor(item: string | null | undefined): HeldModel | null {
  if (!item) return null;
  return HELD.find(h => h.match.test(item))?.view ?? null;
}
