import type { StampId } from '../ageIcons';

/**
 * One age's hand-made interface art (`docs/age-art.md`). Every age has its own file in this folder, so agents working on
 * different ages never touch the same file. All of it is optional: what an age leaves out falls back to the default plate and
 * the shared glyphs (`../ageIcons.ts`).
 *
 * Drawings are SVG markup with no `<svg>` wrapper, in a 32 by 32 box. Paint with `currentColor` (the age's ink, set from its
 * plate) or with colours of your own; keep them to a few flat shapes, as the models are low-poly.
 */
export interface AgeArt {
  /**
   * The age's emblem: shown on the age-up button that leads to this age, and wherever the age is named by a picture.
   * It should be something a player would know the age by at a glance (a chipped flint, a bronze mirror, a windmill).
   */
  emblem?: string;
  /**
   * Hand-drawn glyphs for this age's buttons, in place of the shared emoji, by id: `tech:<TechId>` for a research button
   * (`TECHS` in `src/sim/data.ts`).
   */
  glyphs?: Record<string, string>;
  /** Replace the default button plate: a shape in a 56 by 56 box and/or the motif worked into it (`PLATES` and `MOTIFS` in `../ageIcons.ts`). */
  plate?: { path?: string; motif?: string };
  /** Strike the shared emoji another way than the age's default (`AGE_ICONS` in `../ageIcons.ts`). */
  stamp?: StampId;
}
