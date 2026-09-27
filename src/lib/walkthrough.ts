/**
 * A first-person walkthrough level for <WalkthroughModal>: a Summer-built .glb
 * plus the text and atmosphere the viewer needs. Each level lives in its own
 * module (innsmouth-house.ts, fishing-vessel.ts).
 *
 * The model contract, shared by every level:
 *   * meshes under a node named "Architecture" are walked on and collided with
 *   * each child of "Furniture" is an obstacle; one named "Examine_<id>" is
 *     examinable, its text looked up in `examinables[id]`
 *   * "PlayerStart" marks where the investigator enters, facing its -Z
 * Anything else in the model renders but never collides.
 */

export type Examinable = {
  title: string;
  text: string;
};

/**
 * An object that hurts to look at. While the investigator looks straight at
 * one, the view blurs, deepening the longer they stare; it clears once they
 * look away or walk off. Keyed like `examinables`.
 */
export type GazeHazard = {
  /** How far off-centre (beyond the object's own outline) still counts as looking at it. */
  angleDeg: number;
  /** Beyond this distance, in metres, it has no hold. */
  range: number;
  /** Blur at full strength, in CSS pixels. */
  maxBlurPx: number;
  /** Seconds of staring to reach full strength. */
  onsetSec: number;
  /** Seconds for the view to clear after looking away. */
  recoverSec: number;
};

type Vec3 = [number, number, number];

export type WalkthroughLevel = {
  model: string;
  /** Header, e.g. "The Derelict House · Innsmouth". */
  title: string;
  /** Progress line while the model streams in, before the percentage. */
  loadingText: string;
  errorText: string;
  /** Prompt before the first click takes pointer lock. */
  enterText: string;
  /** Accessible label for the close button. */
  leaveLabel: string;
  examinables: Record<string, Examinable>;
  gazeHazards?: Record<string, GazeHazard>;
  atmosphere: {
    background: number;
    fogColor: number;
    fogDensity: number;
    /** Hemisphere fill: sky colour, ground colour, intensity. */
    sky: number;
    ground: number;
    fill: number;
    /** Optional shadow-casting moonlight from `position` toward the origin. */
    moon?: { color: number; intensity: number; position: Vec3 };
  };
  /**
   * Flickering firelight anchored to an examinable's bounds — the house's
   * hearth. `at` gets the object's world bounds and returns the light position.
   */
  fires?: { examineId: string; at: (box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) => Vec3 }[];
};
