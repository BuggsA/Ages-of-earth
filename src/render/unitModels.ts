import * as THREE from 'three';
import type { CivId, UnitType } from '../sim/types';
import { Kit, RIG_ARM, RIG_LEG_A, RIG_LEG_B, bake } from './kit';

/**
 * Every unit, in every epoch, built from primitives. Models face +z, stand on y = 0 and are about
 * 0.65 tall (riders about 0.95). Team-colored parts are baked white and tinted per player when drawn;
 * legs and the weapon arm are tagged as limbs so they swing.
 */

const SKIN = '#e2ae86';
const HAIR = '#3b2a1e';
const FUR = '#8a6240';
const FUR_DARK = '#5e3f26';
const LINEN = '#e8dfc6';
const LEATHER = '#7a5230';
const WOOD = '#7a5636';
const BRONZE = '#c8913f';
const STEEL = '#c3c9d1';
const DARK_STEEL = '#737a84';
const IRON = '#585d64';
const TEAM = '#f4f4f4';
const BOOT = '#3d2c22';
const ROPE = '#c9b48a';

const HIP = 0.22;
const SHOULDER = 0.42;

interface Body {
  k: Kit;
  /** The weapon arm (right), swinging about the shoulder. */
  arm: THREE.Group;
}

/** Legs, torso, head and arms of a person standing at the origin. */
function person(k: Kit, o: { legs: string; boots?: string; torso: string; torsoTeam?: boolean; belt?: string; at?: THREE.Object3D; y?: number; mounted?: boolean }): Body {
  const root = o.at ?? k.root;
  const y = o.y ?? 0;
  if (!o.mounted) {
    const legA = k.limb(k.group(0, 0, 0, root), RIG_LEG_A, y + HIP, 0);
    k.box(0.065, HIP - 0.04, 0.075, o.legs, -0.045, y + 0.04, 0, legA);
    k.box(0.07, 0.045, 0.095, o.boots ?? BOOT, -0.045, y, 0.01, legA);
    const legB = k.limb(k.group(0, 0, 0, root), RIG_LEG_B, y + HIP, 0);
    k.box(0.065, HIP - 0.04, 0.075, o.legs, 0.045, y + 0.04, 0, legB);
    k.box(0.07, 0.045, 0.095, o.boots ?? BOOT, 0.045, y, 0.01, legB);
  } else {
    // Legs astride the horse.
    k.box(0.06, 0.16, 0.08, o.legs, -0.1, y - 0.1, 0.02, root).rotation.z = 0.35;
    k.box(0.06, 0.16, 0.08, o.legs, 0.1, y - 0.1, 0.02, root).rotation.z = -0.35;
  }
  const torso = k.box(0.17, 0.21, 0.11, o.torso, 0, y + HIP - 0.01, 0, root);
  if (o.torsoTeam) k.team(torso);
  if (o.belt) k.box(0.175, 0.03, 0.115, o.belt, 0, y + HIP + 0.01, 0, root);
  k.sphere(0.066, SKIN, 0, y + 0.5, 0.005, root);
  // The off arm hangs at the side.
  k.box(0.05, 0.17, 0.06, o.torso, -0.11, y + SHOULDER - 0.16, 0, root);
  k.sphere(0.028, SKIN, -0.11, y + SHOULDER - 0.18, 0.005, root);
  // Limb pivots are in model space: add where this body sits (a rider sits on a horse).
  const base = new THREE.Vector3();
  root.updateWorldMatrix(true, false);
  root.getWorldPosition(base);
  const arm = k.limb(k.group(0, 0, 0, root), RIG_ARM, base.y + y + SHOULDER, base.z);
  k.box(0.05, 0.17, 0.06, o.torso, 0.11, y + SHOULDER - 0.16, 0, arm);
  k.sphere(0.028, SKIN, 0.11, y + SHOULDER - 0.18, 0.01, arm);
  return { k, arm };
}

/** A hand-held weapon or tool, held in the swinging arm, pointing forward and up. */
function held(b: Body, build: (k: Kit, g: THREE.Group) => void, y = SHOULDER - 0.18, tilt = 0.9): void {
  const g = b.k.group(0.11, y, 0.03, b.arm);
  g.rotation.x = tilt;
  build(b.k, g);
}

function hairOrHat(k: Kit, y: number, hat?: (k: Kit, y: number) => void, at?: THREE.Object3D): void {
  if (hat) hat(k, y);
  else k.sphere(0.068, HAIR, 0, y + 0.52, -0.012, at).scale.set(1, 0.7, 1);
}

// ---- Citizens --------------------------------------------------------------------------------------

function citizen(epoch: number): Kit {
  const k = new Kit();
  const outfits = [
    { legs: SKIN, torso: FUR, belt: TEAM },
    { legs: SKIN, torso: LINEN, belt: TEAM },
    { legs: '#6b5a48', torso: '#8c7a5a', belt: TEAM },
    { legs: '#5a5f6b', torso: LINEN, belt: TEAM },
    { legs: '#454952', torso: '#8a7a64', belt: TEAM },
  ];
  const o = outfits[epoch];
  const b = person(k, { legs: o.legs, torso: o.torso });
  k.team(k.box(0.176, 0.035, 0.116, TEAM, 0, HIP + 0.02, 0));
  if (epoch === 2) {
    // A team-colored hood.
    k.team(k.sphere(0.075, TEAM, 0, 0.52, -0.015)).scale.set(1, 0.85, 1.05);
  } else if (epoch === 3) {
    k.cyl(0.11, 0.11, 0.015, 10, '#5a4632', 0, 0.54, 0);
    k.team(k.cyl(0.055, 0.065, 0.06, 8, TEAM, 0, 0.55, 0));
  } else if (epoch >= 4) {
    // A flat cap, a team neckerchief, braces over a waistcoat, rolled sleeves and a lunch pail.
    k.cyl(0.072, 0.078, 0.035, 10, '#3a3a40', 0, 0.54, 0);
    k.box(0.1, 0.012, 0.06, '#3a3a40', 0, 0.545, 0.06);
    k.team(k.box(0.12, 0.03, 0.08, TEAM, 0, 0.41, 0.02));
    for (const x of [-0.045, 0.045]) k.box(0.02, 0.2, 0.125, '#5a3e2c', x, 0.23, 0.0);
    k.box(0.14, 0.02, 0.01, '#d8cdb0', 0, 0.35, 0.066);
    k.cyl(0.035, 0.035, 0.06, 8, '#7d8791', 0.13, 0.12, 0.02);
    k.cyl(0.036, 0.036, 0.012, 8, '#4a5158', 0.13, 0.18, 0.02);
  } else if (epoch === 1) {
    hairOrHat(k, 0);
    k.team(k.cyl(0.07, 0.07, 0.02, 8, TEAM, 0, 0.53, 0));
  } else hairOrHat(k, 0);
  // A basket on the back.
  k.cyl(0.05, 0.04, 0.09, 6, '#b08a4e', 0, 0.28, -0.09);
  // A tool: stone hammer, bronze axe, iron axe, steel axe.
  held(b, (kk, g) => {
    kk.cyl(0.012, 0.012, 0.22, 4, WOOD, 0, 0, 0, g);
    const head = epoch === 0 ? '#8a8a84' : epoch === 1 ? BRONZE : STEEL;
    kk.box(0.03, 0.05, 0.08, head, 0, 0.18, 0.03, g);
    // A pickaxe: a second blade swung the other way.
    if (epoch >= 4) kk.box(0.03, 0.05, 0.08, head, 0, 0.18, -0.05, g);
  });
  return k;
}

/**
 * A thrall (#502, Age of the Warband): a taken citizen. Drab undyed sackcloth in place of the people's
 * dress, hair uncovered, a rope noosed at the neck with its tail hanging, wrists lashed in front, no tool
 * and no basket. Only the neck rope is team-tinted, so whose thrall it is still reads.
 */
function thrall(epoch: number): Kit {
  const k = new Kit();
  const cloth = ['#9a8a6c', '#a39375', '#948670', '#8f8672', '#7f7a6c'][epoch];
  person(k, { legs: epoch === 0 ? SKIN : '#76705f', torso: cloth, belt: '#6b5a40' });
  hairOrHat(k, 0);
  if (epoch >= 3) k.box(0.1, 0.03, 0.08, '#6a645a', 0, 0.41, 0.02);
  // The noose, and a tail of rope trailing down the back.
  k.team(k.cyl(0.06, 0.06, 0.02, 8, TEAM, 0, 0.44, 0.0));
  k.box(0.012, 0.2, 0.012, ROPE, 0, 0.3, -0.07);
  k.box(0.012, 0.1, 0.012, ROPE, 0.015, 0.14, -0.08);
  // Wrists bound in front of the body.
  k.box(0.11, 0.035, 0.04, ROPE, 0, 0.27, 0.08);
  k.sphere(0.026, SKIN, -0.04, 0.27, 0.09);
  k.sphere(0.026, SKIN, 0.04, 0.27, 0.09);
  return k;
}

// ---- Infantry --------------------------------------------------------------------------------------

function rifle(kk: Kit, g: THREE.Group, bayonet: boolean): void {
  kk.box(0.025, 0.03, 0.4, WOOD, 0, 0.03, 0.08, g);
  kk.cyl(0.008, 0.008, 0.3, 5, IRON, 0, 0.05, 0.38, g).rotation.x = Math.PI / 2;
  if (bayonet) kk.cone(0.01, 0.12, 4, STEEL, 0, 0.05, 0.58, g).rotation.x = Math.PI / 2;
}

function infantry(epoch: number): Kit {
  const k = new Kit();
  if (epoch >= 4) {
    // Fusilier: team coatee, white cross-belts, a tall shako with a plume, rifle and bayonet.
    const b = person(k, { legs: '#2e3038', torso: TEAM, torsoTeam: true, belt: LINEN });
    k.box(0.02, 0.22, 0.12, LINEN, 0, 0.22, 0.0).rotation.z = 0.7;
    k.box(0.02, 0.22, 0.12, LINEN, 0, 0.22, 0.0).rotation.z = -0.7;
    k.cyl(0.07, 0.065, 0.13, 10, '#1d1e24', 0, 0.53, 0);
    k.box(0.11, 0.01, 0.05, '#1d1e24', 0, 0.53, 0.06);
    k.team(k.sphere(0.022, TEAM, 0, 0.68, 0.04));
    held(b, (kk, g) => rifle(kk, g, true), SHOULDER - 0.18, 0.35);
    return k;
  }
  if (epoch === 0) {
    // Clubman: furs, a team war-paint band, a heavy club.
    const b = person(k, { legs: SKIN, torso: FUR_DARK });
    k.team(k.box(0.176, 0.05, 0.116, TEAM, 0, 0.36, 0));
    hairOrHat(k, 0);
    k.team(k.cyl(0.07, 0.07, 0.022, 8, TEAM, 0, 0.53, 0));
    held(b, (kk, g) => {
      kk.cyl(0.018, 0.012, 0.26, 5, WOOD, 0, 0, 0, g);
      kk.blob(0.045, '#6e5038', 0, 0.26, 0, g);
    });
    return k;
  }
  if (epoch === 1) {
    // Spearman: crested bronze helmet, round team shield, spear.
    const b = person(k, { legs: SKIN, torso: LINEN, torsoTeam: true, belt: LEATHER });
    k.box(0.15, 0.1, 0.105, BRONZE, 0, 0.3, 0.005);
    k.dome(0.074, BRONZE, 0, 0.5, 0);
    k.team(k.box(0.02, 0.06, 0.14, TEAM, 0, 0.55, -0.01));
    const shield = k.team(k.cyl(0.11, 0.11, 0.025, 10, TEAM, -0.15, 0.24, 0.04));
    shield.rotation.z = Math.PI / 2;
    shield.rotation.y = 0.25;
    k.cyl(0.03, 0.03, 0.03, 6, BRONZE, -0.17, 0.24, 0.04).rotation.z = Math.PI / 2;
    held(b, (kk, g) => {
      kk.cyl(0.011, 0.011, 0.7, 4, WOOD, 0, -0.2, 0, g);
      kk.cone(0.025, 0.08, 4, BRONZE, 0, 0.5, 0, g);
    }, SHOULDER - 0.18, 0.25);
    return k;
  }
  if (epoch === 2) {
    // Pikeman: kettle helm, team tabard over mail, a long pike.
    const b = person(k, { legs: '#6c6458', torso: DARK_STEEL });
    k.team(k.box(0.15, 0.22, 0.118, TEAM, 0, 0.18, 0.003));
    k.cyl(0.11, 0.11, 0.015, 10, STEEL, 0, 0.52, 0);
    k.dome(0.07, STEEL, 0, 0.52, 0);
    held(b, (kk, g) => {
      kk.cyl(0.01, 0.01, 0.95, 4, WOOD, 0, -0.3, 0, g);
      kk.cone(0.022, 0.1, 4, STEEL, 0, 0.65, 0, g);
    }, SHOULDER - 0.18, 0.2);
    return k;
  }
  // Halberdier: morion helmet, breastplate, team sleeves and breeches, halberd.
  const b = person(k, { legs: TEAM, torso: TEAM, torsoTeam: true });
  k.team(k.box(0.066, 0.18, 0.076, TEAM, -0.045, 0.04, 0));
  k.box(0.18, 0.16, 0.12, STEEL, 0, 0.26, 0.002);
  k.dome(0.075, STEEL, 0, 0.5, 0);
  k.cyl(0.0, 0.12, 0.04, 8, STEEL, 0, 0.5, 0).scale.set(1, 1, 0.6);
  k.box(0.012, 0.06, 0.15, STEEL, 0, 0.56, 0);
  held(b, (kk, g) => {
    kk.cyl(0.011, 0.011, 0.85, 4, WOOD, 0, -0.25, 0, g);
    kk.box(0.015, 0.1, 0.09, STEEL, 0, 0.5, 0.04, g);
    kk.cone(0.018, 0.1, 4, STEEL, 0, 0.6, 0, g);
  }, SHOULDER - 0.18, 0.25);
  return k;
}

// ---- Ranged ----------------------------------------------------------------------------------------

function bow(kk: Kit, g: THREE.Group, color: string): void {
  const arc = kk.lathe([[0.0, 0], [0.012, 0.01], [0.012, 0.3], [0, 0.31]], 4, color, 0, -0.15, 0.04, g);
  arc.rotation.x = 0.0;
  kk.cyl(0.003, 0.003, 0.3, 3, '#f0ead8', 0, -0.15, 0.0, g);
}

function ranged(epoch: number): Kit {
  const k = new Kit();
  if (epoch >= 4) {
    // Rifleman: team tunic, a kepi, bandolier, rifle at the shoulder.
    const b = person(k, { legs: '#5a5446', torso: TEAM, torsoTeam: true, belt: LEATHER });
    k.box(0.02, 0.24, 0.12, LEATHER, 0, 0.21, 0.0).rotation.z = 0.65;
    const kepi = k.cyl(0.06, 0.07, 0.08, 10, '#3a3e34', 0, 0.53, -0.005);
    kepi.rotation.x = -0.15;
    k.box(0.1, 0.012, 0.05, '#1d1e24', 0, 0.535, 0.06);
    held(b, (kk, g) => rifle(kk, g, false), SHOULDER - 0.18, 1.5);
    return k;
  }
  if (epoch === 0) {
    // Slinger: furs, team headband, a sling and a pouch of stones.
    const b = person(k, { legs: SKIN, torso: FUR, belt: TEAM });
    k.team(k.box(0.176, 0.035, 0.116, TEAM, 0, HIP + 0.02, 0));
    hairOrHat(k, 0);
    k.team(k.cyl(0.07, 0.07, 0.022, 8, TEAM, 0, 0.53, 0));
    k.sphere(0.04, LEATHER, 0.1, 0.22, 0.04);
    held(b, (kk, g) => {
      kk.cyl(0.004, 0.004, 0.2, 3, '#c8b48a', 0, 0, 0, g);
      kk.sphere(0.025, '#8a8a84', 0, 0.2, 0, g);
    });
    return k;
  }
  if (epoch === 1) {
    // Archer: team tunic, quiver, bow.
    const b = person(k, { legs: SKIN, torso: TEAM, torsoTeam: true, belt: LEATHER });
    hairOrHat(k, 0);
    k.cyl(0.03, 0.025, 0.2, 6, LEATHER, 0.05, 0.3, -0.08).rotation.x = -0.3;
    for (const dx of [0.04, 0.06]) k.cone(0.012, 0.04, 3, '#f0f0f0', dx, 0.5, -0.12);
    held(b, (kk, g) => bow(kk, g, WOOD), SHOULDER - 0.18, 1.3);
    return k;
  }
  if (epoch === 2) {
    // Crossbowman: kettle hat, padded jack, team tabard, crossbow.
    const b = person(k, { legs: '#6c6458', torso: '#a08c6a' });
    k.team(k.box(0.15, 0.2, 0.118, TEAM, 0, 0.2, 0.003));
    k.cyl(0.1, 0.1, 0.015, 10, STEEL, 0, 0.53, 0);
    k.dome(0.066, STEEL, 0, 0.53, 0);
    held(b, (kk, g) => {
      kk.box(0.025, 0.025, 0.28, WOOD, 0, 0.04, 0.05, g);
      kk.box(0.24, 0.015, 0.02, IRON, 0, 0.045, 0.18, g);
    }, SHOULDER - 0.18, 1.45);
    return k;
  }
  // Musketeer: team coat, wide hat with a plume, musket.
  const b = person(k, { legs: '#3e3a36', torso: TEAM, torsoTeam: true, belt: LEATHER });
  k.team(k.box(0.18, 0.08, 0.12, TEAM, 0, 0.13, 0));
  k.cyl(0.13, 0.13, 0.015, 10, '#2f2a26', 0, 0.54, 0);
  k.cyl(0.06, 0.07, 0.07, 8, '#2f2a26', 0, 0.55, 0);
  k.team(k.cone(0.02, 0.12, 4, TEAM, -0.06, 0.58, -0.02)).rotation.z = 0.8;
  k.box(0.17, 0.02, 0.02, LINEN, 0, 0.36, 0.06).rotation.z = 0.7;
  held(b, (kk, g) => {
    kk.box(0.03, 0.03, 0.42, WOOD, 0, 0.03, 0.08, g);
    kk.cyl(0.009, 0.009, 0.3, 5, IRON, 0, 0.05, 0.36, g).rotation.x = Math.PI / 2;
  }, SHOULDER - 0.18, 1.5);
  return k;
}

// ---- Cavalry ---------------------------------------------------------------------------------------

/** A horse standing at the origin facing +z; returns the saddle height. */
function horse(k: Kit, coat: string, barding?: { color: string; team: boolean }): number {
  const LEG = 0.3;
  const legs: [number, number, number][] = [
    [-0.075, 0.17, RIG_LEG_A],
    [0.075, 0.17, RIG_LEG_B],
    [-0.075, -0.17, RIG_LEG_B],
    [0.075, -0.17, RIG_LEG_A],
  ];
  for (const [x, z, rig] of legs) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z);
    k.box(0.06, LEG - 0.04, 0.07, coat, x, 0.04, z, g);
    k.box(0.065, 0.045, 0.075, '#2b2420', x, 0, z, g);
  }
  k.box(0.2, 0.18, 0.5, coat, 0, LEG, 0);
  const neck = k.box(0.1, 0.24, 0.12, coat, 0, LEG + 0.08, 0.24);
  neck.rotation.x = 0.55;
  const head = k.box(0.09, 0.09, 0.2, coat, 0, LEG + 0.26, 0.36);
  head.rotation.x = 0.35;
  k.box(0.03, 0.18, 0.05, '#2b2420', 0, LEG + 0.12, 0.2).rotation.x = 0.55;
  k.box(0.05, 0.16, 0.05, '#2b2420', 0, LEG + 0.02, -0.27).rotation.x = -0.5;
  if (barding) {
    const cloth = k.box(0.23, 0.15, 0.46, barding.color, 0, LEG - 0.06, -0.01);
    if (barding.team) k.team(cloth);
  }
  return LEG + 0.18;
}

function cavalry(epoch: number): Kit {
  const k = new Kit();
  if (epoch <= 1) {
    // Horseman: a bare chestnut, a rider with a team cloak, javelin and small shield.
    const saddle = horse(k, '#8a5a34');
    k.team(k.box(0.22, 0.05, 0.16, TEAM, 0, saddle - 0.02, -0.02));
    const rider = k.group(0, saddle, -0.03);
    const b = person(k, { legs: SKIN, torso: TEAM, torsoTeam: true, belt: LEATHER, at: rider, y: -0.12, mounted: true });
    hairOrHat(k, -0.12, undefined, rider);
    k.team(k.cyl(0.08, 0.08, 0.02, 8, TEAM, -0.15, 0.13, 0.02, rider)).rotation.z = Math.PI / 2;
    held(b, (kk, g) => {
      kk.cyl(0.009, 0.009, 0.55, 4, WOOD, 0, -0.1, 0, g);
      kk.cone(0.02, 0.06, 4, BRONZE, 0, 0.45, 0, g);
    }, SHOULDER - 0.3, 0.6);
    return k;
  }
  if (epoch === 2) {
    // Knight: a grey horse in a team caparison, plate, great helm, lance.
    const saddle = horse(k, '#9a9a9a', { color: TEAM, team: true });
    const rider = k.group(0, saddle, -0.03);
    const b = person(k, { legs: STEEL, torso: STEEL, at: rider, y: -0.12, mounted: true });
    k.team(k.box(0.16, 0.1, 0.12, TEAM, 0, 0.12, 0.001, rider));
    k.cyl(0.07, 0.07, 0.11, 8, STEEL, 0, 0.32, 0, rider);
    k.box(0.1, 0.012, 0.02, '#202020', 0, 0.38, 0.06, rider);
    held(b, (kk, g) => {
      kk.cyl(0.008, 0.02, 0.85, 6, WOOD, 0, -0.2, 0, g);
      kk.cone(0.03, 0.05, 6, STEEL, 0, -0.2, 0, g).rotation.x = Math.PI;
    }, SHOULDER - 0.3, 1.3);
    return k;
  }
  if (epoch >= 4) {
    // Hussar: a bay horse, a team dolman with gold frogging, a fur busby, a curved saber.
    const saddle = horse(k, '#6e4426', { color: TEAM, team: true });
    const rider = k.group(0, saddle, -0.03);
    const b = person(k, { legs: '#e8e2d0', torso: TEAM, torsoTeam: true, at: rider, y: -0.12, mounted: true });
    for (let i = 0; i < 3; i++) k.box(0.18, 0.012, 0.12, GOLD, 0, -0.02 + i * 0.05, 0.002, rider);
    k.cyl(0.07, 0.075, 0.14, 10, '#2b2420', 0, 0.32, 0, rider);
    k.team(k.box(0.03, 0.08, 0.06, TEAM, 0.05, 0.4, -0.04, rider));
    held(b, (kk, g) => {
      kk.box(0.012, 0.34, 0.03, STEEL, 0, 0.0, 0.02, g).rotation.x = 0.25;
      kk.box(0.05, 0.015, 0.02, GOLD, 0, -0.04, 0, g);
    }, SHOULDER - 0.3, 0.9);
    return k;
  }
  // Cuirassier: a black horse, team saddle cloth, steel cuirass, plumed helmet, saber.
  const saddle = horse(k, '#2e2622', { color: TEAM, team: true });
  const rider = k.group(0, saddle, -0.03);
  const b = person(k, { legs: '#e8e2d0', torso: TEAM, torsoTeam: true, at: rider, y: -0.12, mounted: true });
  k.box(0.18, 0.15, 0.12, STEEL, 0, 0.06, 0.002, rider);
  k.dome(0.074, STEEL, 0, 0.36, 0, rider);
  k.team(k.box(0.02, 0.08, 0.15, TEAM, 0, 0.42, -0.02, rider));
  held(b, (kk, g) => {
    kk.box(0.012, 0.32, 0.03, STEEL, 0, 0.0, 0, g).rotation.x = 0.15;
    kk.box(0.05, 0.015, 0.02, '#c8a040', 0, 0, 0, g);
  }, SHOULDER - 0.3, 0.9);
  return k;
}

// ---- Siege -----------------------------------------------------------------------------------------

function wheel(k: Kit, x: number, z: number, r: number, color = WOOD): void {
  const w = k.cyl(r, r, 0.05, 10, color, x, r, z);
  w.rotation.z = Math.PI / 2;
  w.position.y = r;
  const hub = k.cyl(r * 0.3, r * 0.3, 0.07, 6, IRON, x, r, z);
  hub.rotation.z = Math.PI / 2;
  hub.position.y = r;
}

function siege(epoch: number): Kit {
  const k = new Kit();
  if (epoch <= 1) {
    // Battering ram: a roofed frame on four wheels, a log with a bronze head swinging inside.
    for (const [x, z] of [[-0.24, 0.26], [0.24, 0.26], [-0.24, -0.26], [0.24, -0.26]]) wheel(k, x, z, 0.11);
    k.box(0.42, 0.06, 0.78, WOOD, 0, 0.16, 0);
    for (const [x, z] of [[-0.19, 0.3], [0.19, 0.3], [-0.19, -0.3], [0.19, -0.3]]) k.box(0.05, 0.36, 0.05, WOOD, x, 0.2, z);
    k.prism(0.84, 0.24, 0.52, '#8a6a46', 0, 0.56, 0);
    k.team(k.box(0.53, 0.04, 0.86, TEAM, 0, 0.55, 0));
    const ram = k.limb(k.group(0, 0, 0), RIG_ARM, 0.5, 0);
    const log = k.cyl(0.07, 0.07, 0.9, 7, '#7a5636', 0, 0.36, 0.05, ram);
    log.rotation.x = Math.PI / 2;
    log.position.y = 0.36;
    k.cone(0.09, 0.12, 7, BRONZE, 0, 0.36, 0.5, ram).rotation.x = Math.PI / 2;
    return k;
  }
  if (epoch === 2) {
    // Catapult: a heavy frame, a throwing arm with a sling cup, a team pennant.
    for (const [x, z] of [[-0.26, 0.28], [0.26, 0.28], [-0.26, -0.28], [0.26, -0.28]]) wheel(k, x, z, 0.12);
    k.box(0.5, 0.08, 0.8, WOOD, 0, 0.18, 0);
    k.box(0.06, 0.38, 0.06, WOOD, -0.18, 0.26, 0.05);
    k.box(0.06, 0.38, 0.06, WOOD, 0.18, 0.26, 0.05);
    k.box(0.42, 0.06, 0.08, WOOD, 0, 0.6, 0.05);
    const arm = k.limb(k.group(0, 0, 0), RIG_ARM, 0.3, -0.05);
    const beam = k.box(0.07, 0.07, 0.7, '#8a6440', 0, 0.27, -0.3, arm);
    beam.rotation.x = -0.2;
    k.sphere(0.09, '#5b4330', 0, 0.36, -0.62, arm);
    k.sphere(0.06, '#8a8a84', 0, 0.42, -0.62, arm);
    k.cyl(0.015, 0.015, 0.5, 4, WOOD, 0.22, 0.2, -0.32);
    k.team(k.box(0.01, 0.12, 0.18, TEAM, 0.22, 0.58, -0.24));
    return k;
  }
  if (epoch >= 4) {
    // Field gun: tall spoked wheels, a steel shield, a long rifled barrel, the trail behind.
    wheel(k, -0.27, 0.02, 0.24, '#4a3a2c');
    wheel(k, 0.27, 0.02, 0.24, '#4a3a2c');
    k.box(0.12, 0.08, 0.75, '#4a4f45', 0, 0.12, -0.3).rotation.x = -0.18;
    k.box(0.5, 0.36, 0.03, '#5d6455', 0, 0.2, 0.14);
    k.team(k.box(0.5, 0.05, 0.035, TEAM, 0, 0.5, 0.14));
    const gun = k.limb(k.group(0, 0, 0), RIG_ARM, 0.32, 0.05);
    const tube = k.cyl(0.04, 0.055, 0.85, 10, '#3f4247', 0, 0.32, 0.3, gun);
    tube.rotation.x = Math.PI / 2 - 0.08;
    tube.position.set(0, 0.34, 0.3);
    k.cyl(0.07, 0.07, 0.2, 8, '#3f4247', 0, 0.32, -0.05, gun).rotation.x = Math.PI / 2;
    return k;
  }
  // Bombard: a great iron barrel on a two-wheeled carriage, a team flag.
  wheel(k, -0.26, 0.05, 0.2, '#5b4330');
  wheel(k, 0.26, 0.05, 0.2, '#5b4330');
  k.box(0.3, 0.1, 0.8, WOOD, 0, 0.16, -0.12).rotation.x = -0.12;
  const barrel = k.limb(k.group(0, 0, 0), RIG_ARM, 0.32, 0.05);
  const tube = k.cyl(0.085, 0.11, 0.8, 10, '#3f4247', 0, 0.32, 0.2, barrel);
  tube.rotation.x = Math.PI / 2 - 0.12;
  tube.position.set(0, 0.36, 0.2);
  k.cyl(0.12, 0.12, 0.06, 10, '#c8a040', 0, 0.3, -0.18, barrel).rotation.x = Math.PI / 2;
  k.sphere(0.05, '#2b2b2b', 0.12, 0.08, -0.4);
  k.sphere(0.05, '#2b2b2b', 0.17, 0.08, -0.36);
  k.cyl(0.015, 0.015, 0.55, 4, '#5b4330', -0.2, 0.2, -0.45);
  k.team(k.box(0.01, 0.14, 0.2, TEAM, -0.2, 0.6, -0.37));
  return k;
}

// ---- Priests ---------------------------------------------------------------------------------------

function priest(epoch: number): Kit {
  const k = new Kit();
  const robe = epoch <= 1 ? '#f2ecdc' : epoch === 2 ? '#7a5a3a' : epoch === 3 ? '#f4f0e6' : '#26262c';
  // Feet peep out under a long robe; the robe sways as one with the body.
  const legA = k.limb(k.group(0, 0, 0), RIG_LEG_A, HIP, 0);
  k.box(0.07, 0.05, 0.1, BOOT, -0.045, 0, 0.02, legA);
  const legB = k.limb(k.group(0, 0, 0), RIG_LEG_B, HIP, 0);
  k.box(0.07, 0.05, 0.1, BOOT, 0.045, 0, 0.02, legB);
  k.cyl(0.1, 0.15, 0.42, 8, robe, 0, 0.03, 0);
  k.team(k.box(0.05, 0.36, 0.02, TEAM, 0, 0.08, 0.1));
  k.sphere(0.066, SKIN, 0, 0.5, 0.005);
  k.box(0.05, 0.17, 0.06, robe, -0.12, SHOULDER - 0.16, 0);
  const arm = k.limb(k.group(0, 0, 0), RIG_ARM, SHOULDER, 0);
  k.box(0.05, 0.17, 0.06, robe, 0.12, SHOULDER - 0.16, 0, arm);
  if (epoch <= 1) {
    k.cyl(0.05, 0.07, 0.12, 8, '#e2b23c', 0, 0.54, 0);
    k.glow(k.sphere(0.03, '#ffe08a', 0, 0.68, 0));
  } else if (epoch === 2) {
    k.sphere(0.075, robe, 0, 0.52, -0.02).scale.set(1, 0.9, 1.05);
    k.team(k.box(0.18, 0.025, 0.12, TEAM, 0, 0.27, 0));
  } else if (epoch === 3) {
    k.cone(0.06, 0.17, 4, TEAM, 0, 0.55, 0);
    k.team(k.cone(0.065, 0.17, 4, TEAM, 0, 0.55, 0));
    k.box(0.02, 0.1, 0.006, '#e2b23c', 0, 0.58, 0.04);
  } else {
    // Missionary: a black coat, white collar and a wide-brimmed hat.
    k.box(0.08, 0.025, 0.04, '#f4f0e6', 0, 0.42, 0.05);
    k.cyl(0.13, 0.13, 0.012, 12, '#1a1a1e', 0, 0.55, 0);
    k.cyl(0.06, 0.065, 0.06, 10, '#1a1a1e', 0, 0.555, 0);
    k.team(k.cyl(0.066, 0.066, 0.015, 10, TEAM, 0, 0.56, 0));
    // A team stole down the front, a brass cross on the chest and a skirt hem of grey wool.
    k.team(k.box(0.04, 0.3, 0.012, TEAM, 0, 0.12, 0.112));
    k.box(0.012, 0.05, 0.01, GOLD, 0, 0.36, 0.118);
    k.box(0.036, 0.012, 0.01, GOLD, 0, 0.375, 0.118);
    k.cyl(0.152, 0.155, 0.035, 8, '#4a4a52', 0, 0.03, 0);
  }
  const g = k.group(0.12, SHOULDER - 0.18, 0.03, arm);
  g.rotation.x = 0.3;
  k.cyl(0.012, 0.012, 0.62, 4, epoch === 2 || epoch >= 4 ? WOOD : '#e2b23c', 0, -0.25, 0, g);
  if (epoch === 2 || epoch >= 4) {
    k.box(0.12, 0.02, 0.02, WOOD, 0, 0.28, 0, g);
  } else k.glow(k.octa(0.045, '#ffe08a', 0, 0.4, 0, g));
  return k;
}

// ---- Heroes ----------------------------------------------------------------------------------------

const GOLD = '#e2b23c';

function hero(epoch: number): Kit {
  const k = new Kit();
  if (epoch === 0) {
    // Chieftain: a team-colored fur cloak, a feathered crown, a great stone axe.
    const b = person(k, { legs: SKIN, torso: FUR_DARK, belt: GOLD });
    k.team(k.box(0.22, 0.32, 0.04, TEAM, 0, 0.14, -0.08));
    hairOrHat(k, 0);
    k.glow(k.cyl(0.075, 0.075, 0.03, 8, GOLD, 0, 0.55, 0));
    for (let i = 0; i < 5; i++) k.team(k.cone(0.015, 0.12, 3, TEAM, -0.05 + i * 0.025, 0.56, -0.04)).rotation.x = -0.3;
    held(b, (kk, g) => {
      kk.cyl(0.016, 0.016, 0.42, 5, WOOD, 0, -0.05, 0, g);
      kk.box(0.04, 0.12, 0.16, '#7d7a72', 0, 0.32, 0.05, g);
    });
    return k;
  }
  if (epoch === 1) {
    // Warlord: golden cuirass, crested helmet, a team cape, sword and round shield.
    const b = person(k, { legs: SKIN, torso: GOLD, belt: LEATHER });
    k.team(k.box(0.22, 0.38, 0.03, TEAM, 0, 0.08, -0.08));
    k.dome(0.078, GOLD, 0, 0.5, 0);
    k.team(k.box(0.025, 0.08, 0.2, TEAM, 0, 0.56, -0.02));
    const shield = k.cyl(0.12, 0.12, 0.03, 10, GOLD, -0.16, 0.25, 0.04);
    shield.rotation.z = Math.PI / 2;
    held(b, (kk, g) => {
      kk.box(0.02, 0.36, 0.035, '#e8e2d0', 0, 0.1, 0, g);
      kk.box(0.08, 0.02, 0.03, GOLD, 0, -0.06, 0, g);
    });
    return k;
  }
  // Mounted heroes: a paladin on a white horse, a general on a black one, a field marshal on a grey.
  const saddle = horse(k, epoch === 2 ? '#ecebe6' : epoch === 3 ? '#2a2421' : '#8f8f8f', { color: TEAM, team: true });
  k.box(0.24, 0.03, 0.48, GOLD, 0, saddle - 0.2, -0.01);
  const rider = k.group(0, saddle, -0.03);
  if (epoch === 2) {
    const b = person(k, { legs: GOLD, torso: GOLD, at: rider, y: -0.12, mounted: true });
    k.team(k.box(0.22, 0.3, 0.03, TEAM, 0, 0.0, -0.08, rider));
    k.cyl(0.072, 0.072, 0.11, 8, GOLD, 0, 0.32, 0, rider);
    k.glow(k.cyl(0.08, 0.08, 0.03, 8, '#ffe08a', 0, 0.44, 0, rider));
    held(b, (kk, g) => {
      kk.box(0.02, 0.4, 0.035, '#f2f2f2', 0, 0.1, 0, g);
      kk.box(0.09, 0.02, 0.03, GOLD, 0, -0.08, 0, g);
    }, SHOULDER - 0.3, 1.0);
    return k;
  }
  if (epoch >= 4) {
    // Field Marshal: a team greatcoat, a gold sash, a peaked cap, a baton.
    const b = person(k, { legs: '#2e3038', torso: TEAM, torsoTeam: true, at: rider, y: -0.12, mounted: true });
    k.box(0.19, 0.03, 0.12, GOLD, 0, 0.12, 0.002, rider).rotation.z = 0.5;
    for (const x of [-0.1, 0.1]) k.box(0.06, 0.02, 0.07, GOLD, x, 0.3, 0, rider);
    k.cyl(0.075, 0.07, 0.05, 10, '#2a2c34', 0, 0.38, 0, rider);
    k.box(0.1, 0.012, 0.06, '#1a1a1e', 0, 0.38, 0.06, rider);
    k.glow(k.box(0.05, 0.02, 0.01, GOLD, 0, 0.4, 0.075, rider));
    // Medals on the breast, gold aiguillettes at the shoulder and a long team-coloured coat-tail.
    for (let i = 0; i < 3; i++) k.glow(k.box(0.018, 0.028, 0.008, i === 1 ? '#c8302a' : GOLD, -0.06 + i * 0.022, 0.2, 0.08, rider));
    k.box(0.015, 0.14, 0.015, GOLD, 0.1, 0.2, 0.05, rider);
    k.team(k.box(0.2, 0.24, 0.03, TEAM, 0, -0.04, -0.1, rider));
    held(b, (kk, g) => {
      kk.cyl(0.015, 0.015, 0.16, 6, '#c8302a', 0, 0.02, 0, g);
      kk.cyl(0.018, 0.018, 0.02, 6, GOLD, 0, 0.1, 0, g);
    }, SHOULDER - 0.3, 1.0);
    return k;
  }
  const b = person(k, { legs: '#e8e2d0', torso: TEAM, torsoTeam: true, at: rider, y: -0.12, mounted: true });
  k.box(0.19, 0.03, 0.03, GOLD, 0, 0.29, 0.02, rider);
  for (const x of [-0.1, 0.1]) k.box(0.06, 0.02, 0.07, GOLD, x, 0.3, 0, rider);
  k.box(0.2, 0.05, 0.08, '#1d1d22', 0, 0.42, 0, rider).scale.set(1, 1, 0.9);
  k.cone(0.06, 0.06, 6, '#1d1d22', 0, 0.44, 0, rider);
  k.glow(k.sphere(0.02, GOLD, 0.06, 0.46, 0.04, rider));
  held(b, (kk, g) => {
    kk.box(0.012, 0.34, 0.03, '#e8e2d0', 0, 0.04, 0, g).rotation.x = 0.15;
    kk.box(0.05, 0.015, 0.02, GOLD, 0, -0.1, 0, g);
  }, SHOULDER - 0.3, 1.0);
  return k;
}

// ---- Ships -----------------------------------------------------------------------------------------

/** A hull: a long bowl below a deck, the waterline at y = 0 (models face +z). */
function hull(k: Kit, L: number, W: number, H: number, color: string, deck: string, y = 0.06): void {
  const bowl = k.dome(0.5, color, 0, y, 0);
  bowl.rotation.x = Math.PI;
  bowl.scale.set(W, H * 2, L);
  k.cyl(0.5, 0.5, 0.03, 16, deck, 0, y - 0.015, 0).scale.set(W, 1, L);
}

/** A mast with a square sail across the ship (team colored, or plain with a team band). */
function mast(k: Kit, z: number, h: number, sailW: number, team = true, y = 0.06): void {
  k.cyl(0.018, 0.022, h, 5, WOOD, 0, y, z);
  k.box(sailW + 0.06, 0.02, 0.02, WOOD, 0, y + h * 0.85, z);
  const sail = k.sail(k.box(sailW, h * 0.5, 0.015, team ? TEAM : '#efe8d8', 0, y + h * 0.33, z + 0.015), sailW / 2, y + h * 0.08, h * 0.5);
  if (team) k.team(sail);
  else k.team(k.box(sailW, 0.05, 0.018, TEAM, 0, y + h * 0.55, z + 0.016));
  pennant(k, 0, y + h * 0.5 - 0.04, z, 0.1 + h * 0.12);
}

/** A small team pennant that streams aft from a masthead or pole top in the wind (cloth, see `Kit.cloth`). */
function pennant(k: Kit, x: number, y: number, z: number, len: number): void {
  k.cloth(k.team(k.box(0.01, len * 0.32, len, TEAM, x, y, z - len / 2)), -len, z);
}

/** A bank of oars along one side, each a limb that sweeps fore and aft. */
function oars(k: Kit, side: number, n: number, L: number, W: number): void {
  for (let i = 0; i < n; i++) {
    const z = -L * 0.3 + (i / Math.max(1, n - 1)) * L * 0.6;
    const g = k.limb(k.group(0, 0, 0), i % 2 ? RIG_LEG_B : RIG_LEG_A, 0.08, z);
    const oar = k.box(0.25, 0.012, 0.018, WOOD, side * (W / 2 + 0.1), 0.02, z, g);
    oar.rotation.z = side * -0.45;
  }
}

/** Something that fishes: a pole or boom that dips (the arm). */
function net(k: Kit, z: number, len: number, y = 0.1): void {
  const g = k.limb(k.group(0, 0, 0), RIG_ARM, y, z);
  const pole = k.box(0.015, 0.015, len, WOOD, 0.1, y + 0.1, z + len / 2, g);
  pole.rotation.x = -0.35;
  k.box(0.12, 0.08, 0.01, '#d8d0b8', 0.1, y - 0.05 + 0.1, z + len * 0.95, g).rotation.x = -0.35;
}

function fisher(epoch: number): Kit {
  const k = new Kit();
  if (epoch === 0) {
    // A dugout canoe: a fisher with a line, a team cloth at the bow.
    hull(k, 0.85, 0.2, 0.08, '#6e4f33', '#8a6440', 0.04);
    const b = person(k, { legs: SKIN, torso: FUR, y: -0.12 });
    void b;
    k.team(k.box(0.1, 0.06, 0.02, TEAM, 0, 0.06, 0.38));
    net(k, 0.1, 0.4, 0.15);
    return k;
  }
  if (epoch === 1) {
    // A reed boat with a small square sail.
    hull(k, 1.0, 0.3, 0.1, '#c8b46a', '#a89458');
    for (let i = 0; i < 4; i++) k.box(0.31, 0.012, 0.012, '#8a7a40', 0, 0.065, -0.3 + i * 0.2);
    mast(k, 0.05, 0.6, 0.3);
    net(k, -0.1, 0.45);
    return k;
  }
  if (epoch === 4) {
    // A steam trawler: a steel hull, wheelhouse, smokestack with a team band, a net derrick.
    hull(k, 1.25, 0.36, 0.14, '#3c4046', '#8a7a64', 0.08);
    k.box(0.36, 0.05, 1.0, '#a8402e', 0, 0.0, 0);
    k.box(0.26, 0.2, 0.3, '#e8e2d0', 0, 0.08, 0.15);
    k.box(0.28, 0.03, 0.32, '#3c4046', 0, 0.28, 0.15);
    k.cyl(0.05, 0.055, 0.32, 8, '#2b2b2e', 0, 0.08, -0.05);
    k.team(k.cyl(0.056, 0.056, 0.06, 8, TEAM, 0, 0.3, -0.05));
    net(k, -0.35, 0.5, 0.14);
    return k;
  }
  // A wooden fishing boat with a mast (a cog, then a sloop with a big sail).
  hull(k, 1.1, 0.34, 0.12, epoch === 2 ? '#6e4f33' : '#5a4430', '#9a7448');
  mast(k, 0.08, epoch === 2 ? 0.7 : 0.85, epoch === 2 ? 0.34 : 0.4, epoch === 2);
  if (epoch === 3) {
    // A lugger: a bowsprit with a jib, a tarred hull stripe, a lantern at the stern and a catch of fish.
    k.cyl(0.012, 0.012, 0.4, 4, WOOD, 0, 0.1, 0.62).rotation.x = 1.2;
    k.sail(k.box(0.012, 0.4, 0.22, '#efe8d8', 0, 0.38, 0.4), 0.2, 0.18, 0.4);
    k.box(0.35, 0.025, 1.0, '#2a1e16', 0, 0.06, 0);
    k.glow(k.sphere(0.035, '#ffd27a', 0, 0.22, -0.5, undefined, 6));
    k.cyl(0.012, 0.012, 0.16, 4, WOOD, 0, 0.06, -0.5);
    k.box(0.14, 0.04, 0.1, '#9aa8b0', 0.08, 0.07, -0.38);
  }
  net(k, -0.3, 0.5);
  for (let i = 0; i < 2; i++) k.cyl(0.05, 0.045, 0.08, 6, '#8a6440', -0.08 + i * 0.12, 0.06, -0.38);
  return k;
}

function warship(epoch: number): Kit {
  const k = new Kit();
  if (epoch === 0) {
    // A war canoe: a long dugout with a carved, upswept prow, paddlers' oars, team shields on the gunwale, no sail.
    hull(k, 1.5, 0.26, 0.12, '#5b4330', '#7a5638');
    k.cone(0.05, 0.3, 6, '#6e4f33', 0, 0.12, 0.78).rotation.x = -0.9;
    k.sphere(0.05, '#d8d0b8', 0, 0.27, 0.9, undefined, 6);
    k.cone(0.04, 0.2, 5, '#6e4f33', 0, 0.1, -0.78).rotation.x = Math.PI + 0.7;
    for (const side of [-1, 1]) {
      oars(k, side, 6, 1.5, 0.26);
      for (let i = 0; i < 5; i++) k.team(k.cyl(0.04, 0.04, 0.012, 8, TEAM, side * 0.13, 0.1, -0.4 + i * 0.2)).rotation.z = Math.PI / 2;
    }
    k.team(k.box(0.14, 0.1, 0.02, TEAM, 0, 0.12, 0.45));
    return k;
  }
  if (epoch === 1) {
    // A trireme: a long narrow hull, a bronze ram, three banks of oars, team shields and sail.
    hull(k, 1.6, 0.34, 0.14, '#5b4330', '#8a6440');
    k.cone(0.05, 0.22, 6, BRONZE, 0, 0.0, 0.8).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      oars(k, side, 7, 1.6, 0.34);
      for (let i = 0; i < 6; i++) k.team(k.cyl(0.04, 0.04, 0.012, 8, TEAM, side * 0.17, 0.1, -0.45 + i * 0.18)).rotation.z = Math.PI / 2;
    }
    mast(k, 0.05, 0.8, 0.5);
    k.box(0.2, 0.1, 0.2, '#6e4f33', 0, 0.06, -0.62);
    return k;
  }
  if (epoch === 2) {
    // A war cog: a stout hull with castles fore and aft, crenellated, a big team sail.
    hull(k, 1.4, 0.48, 0.18, '#5a4430', '#9a7448');
    for (const z of [0.5, -0.5]) {
      k.box(0.46, 0.18, 0.32, '#6e4f33', 0, 0.06, z);
      for (const x of [-0.18, 0, 0.18]) k.box(0.07, 0.06, 0.07, '#6e4f33', x, 0.24, z + 0.12);
    }
    mast(k, 0, 1.05, 0.6);
    k.team(k.box(0.012, 0.1, 0.18, TEAM, 0, 1.12, 0.08));
    return k;
  }
  if (epoch === 3) {
    // A galleon: three masts of sails with team crosses, a high stern castle, gun ports.
    hull(k, 1.7, 0.5, 0.2, '#4a3426', '#8a6a46');
    k.box(0.5, 0.12, 1.3, '#4a3426', 0, 0.06, -0.05);
    k.box(0.48, 0.24, 0.4, '#5a4030', 0, 0.06, -0.62);
    for (let i = 0; i < 5; i++) for (const x of [-0.26, 0.26]) k.box(0.02, 0.05, 0.06, '#1d1d1d', x, 0.1, -0.45 + i * 0.22);
    // A planked deck inside gilded rails.
    k.box(0.44, 0.012, 1.24, '#9a7a52', 0, 0.18, -0.05);
    for (const x of [-0.245, 0.245]) k.box(0.025, 0.04, 1.3, GOLD, x, 0.17, -0.05);
    for (const [z, h, w] of [[0.45, 0.95, 0.42], [0, 1.2, 0.56], [-0.42, 0.95, 0.4]] as const) {
      mast(k, z, h, w, false, 0.18);
      k.team(k.box(0.06, w * 0.6, 0.02, TEAM, 0, 0.18 + h * 0.33 + 0.02, z + 0.02));
    }
    k.cyl(0.012, 0.012, 0.5, 4, WOOD, 0, 0.18, 0.8).rotation.x = 1.0;
    return k;
  }
  // An ironclad: a low armored hull, a central turret with two guns, a smokestack.
  hull(k, 1.7, 0.46, 0.16, '#3a3e44', '#5a5e64', 0.08);
  k.box(0.46, 0.06, 1.2, '#2e3236', 0, 0.02, -0.05);
  k.box(0.3, 0.12, 0.42, '#4a4e54', 0, 0.08, -0.45);
  const turret = k.limb(k.group(0, 0, 0), RIG_ARM, 0.22, 0.25);
  k.cyl(0.16, 0.17, 0.14, 10, '#4a4e54', 0, 0.08, 0.25, turret);
  for (const x of [-0.05, 0.05]) {
    const g = k.cyl(0.022, 0.026, 0.42, 8, '#2b2b2e', x, 0.15, 0.45, turret);
    g.rotation.x = Math.PI / 2;
    g.position.set(x, 0.16, 0.45);
  }
  k.cyl(0.07, 0.075, 0.4, 8, '#2b2b2e', 0, 0.12, -0.12);
  k.team(k.cyl(0.076, 0.076, 0.07, 8, TEAM, 0, 0.42, -0.12));
  k.cyl(0.012, 0.012, 0.55, 4, '#2b2b2e', 0, 0.12, -0.62);
  k.team(k.box(0.012, 0.1, 0.16, TEAM, 0, 0.56, -0.54));
  // Armor belt: a riveted band along each flank, a ram at the bow, a lit conning-tower slit.
  for (const x of [-0.235, 0.235]) {
    k.box(0.02, 0.05, 1.3, '#2a2d31', x, 0.03, -0.05);
    for (let i = 0; i < 7; i++) k.sphere(0.014, '#8a9098', x * 1.02, 0.06, -0.62 + i * 0.2, undefined, 5);
  }
  k.cone(0.05, 0.2, 6, '#4a4e54', 0, 0.04, 0.9).rotation.x = Math.PI / 2;
  k.glow(k.box(0.12, 0.015, 0.012, '#ffd27a', 0, 0.16, -0.24));
  return k;
}

function transport(epoch: number): Kit {
  const k = new Kit();
  if (epoch === 0) {
    // A log raft: lashed trunks, a hide sail on a pole, a heap of bundles and baskets.
    for (let i = 0; i < 5; i++) k.cyl(0.07, 0.07, 1.1, 7, i % 2 ? '#7a5638' : '#6e4f33', (i - 2) * 0.13, 0.0, 0).rotation.x = Math.PI / 2;
    for (const z of [-0.3, 0.3]) k.box(0.7, 0.025, 0.04, '#3a2a1e', 0, 0.08, z);
    k.cyl(0.018, 0.022, 0.7, 5, WOOD, 0, 0.08, 0.2);
    k.sail(k.team(k.box(0.4, 0.4, 0.015, TEAM, 0, 0.45, 0.2)), 0.2, 0.2, 0.4);
    for (let i = 0; i < 3; i++) k.box(0.14, 0.1, 0.14, '#a07a50', -0.15 + (i % 2) * 0.28, 0.08, -0.15 - i * 0.15);
    return k;
  }
  if (epoch === 1) {
    // A transport galley: a broad hull, oars, a team sail, crates and amphorae on deck.
    hull(k, 1.4, 0.5, 0.16, '#6e4f33', '#9a7448');
    for (const side of [-1, 1]) oars(k, side, 5, 1.4, 0.5);
    mast(k, 0.15, 0.8, 0.5);
    for (let i = 0; i < 3; i++) k.box(0.14, 0.1, 0.14, '#a07a50', -0.12 + (i % 2) * 0.22, 0.06, -0.15 - i * 0.14);
    return k;
  }
  if (epoch === 4) {
    // A paddle steamer: a white superstructure, a tall stack, wheels that churn.
    hull(k, 1.6, 0.5, 0.16, '#2e3236', '#9a8a6a', 0.08);
    k.box(0.4, 0.18, 0.9, '#efe8da', 0, 0.08, -0.05);
    k.box(0.44, 0.03, 0.94, '#3a3e44', 0, 0.26, -0.05);
    for (let i = 0; i < 5; i++) for (const x of [-0.205, 0.205]) k.box(0.01, 0.06, 0.08, '#3b4a5a', x, 0.15, -0.4 + i * 0.18);
    k.cyl(0.07, 0.075, 0.5, 8, '#2b2b2e', 0, 0.29, 0.05);
    k.team(k.cyl(0.076, 0.076, 0.08, 8, TEAM, 0, 0.7, 0.05));
    for (const side of [-1, 1]) {
      // The wheel turns about the axle along x: a limb spun round and round.
      const g = k.limb(k.group(0, 0, 0), RIG_LEG_A, 0.1, 0.0);
      const rim = k.cyl(0.2, 0.2, 0.08, 12, '#a8402e', side * 0.3, 0.1, 0, g);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(side * 0.3, 0.1, 0);
      for (let i = 0; i < 4; i++) k.box(0.085, 0.4, 0.04, '#5a3a2a', side * 0.3, -0.1, 0, g).rotation.x = (i * Math.PI) / 4;
      k.team(k.box(0.04, 0.12, 0.3, TEAM, side * 0.35, 0.12, 0));
    }
    return k;
  }
  // A transport cog or fluyt: a round-bellied hull, one or two masts, a hatch and cargo.
  hull(k, 1.5, 0.56, 0.2, '#5a4430', '#9a7448');
  k.box(0.54, 0.1, 1.1, '#5a4430', 0, 0.06, 0);
  k.box(0.3, 0.04, 0.4, '#3a2a1e', 0, 0.16, 0.05);
  mast(k, 0.3, 1.0, 0.55);
  if (epoch === 2) {
    // A trading cog: clinker strakes along the flanks, a stern castle with a rail, a stem post and a stern rudder.
    for (const x of [-0.275, 0.275]) for (const y of [0.0, 0.05, 0.1]) k.box(0.014, 0.025, 1.0, y === 0.05 ? '#4a3626' : '#6a5036', x, 0.08 + y, 0.0);
    k.box(0.48, 0.14, 0.3, '#6e4f33', 0, 0.06, -0.55);
    for (const x of [-0.2, 0, 0.2]) k.box(0.05, 0.05, 0.05, '#6e4f33', x, 0.2, -0.66);
    k.cyl(0.02, 0.025, 0.3, 5, WOOD, 0, 0.12, 0.74).rotation.x = 0.35;
    k.box(0.03, 0.18, 0.1, '#4a3426', 0, 0.0, -0.78);
    for (let i = 0; i < 3; i++) k.cyl(0.06, 0.055, 0.1, 7, '#8a5a3a', -0.12 + i * 0.12, 0.2, 0.0);
  }
  if (epoch === 3) {
    // A fluyt: a second mast, a raised stern with a gilded lantern and a bowsprit.
    mast(k, -0.35, 0.8, 0.45, false, 0.16);
    k.box(0.5, 0.16, 0.34, '#4a3426', 0, 0.06, -0.58);
    k.cyl(0.02, 0.02, 0.18, 5, GOLD, 0, 0.22, -0.7);
    k.glow(k.sphere(0.04, '#ffd27a', 0, 0.42, -0.7, undefined, 6));
    k.cyl(0.012, 0.012, 0.45, 4, WOOD, 0, 0.18, 0.78).rotation.x = 1.1;
  }
  return k;
}

/** A merchant ship: a transport's hull with its deck stacked high with bales and a golden pennant. */
function cog(epoch: number): Kit {
  const k = transport(epoch);
  const gold = '#d8b24a';
  k.box(0.2, 0.14, 0.22, '#b88e5a', -0.14, 0.2, 0.3);
  k.box(0.18, 0.12, 0.2, '#a07a50', 0.14, 0.2, 0.18);
  k.box(0.16, 0.1, 0.16, gold, 0, 0.2, -0.22);
  k.team(k.box(0.16, 0.1, 0.02, TEAM, 0, 0.2, 0.62));
  return k;
}

// ---- Aircraft --------------------------------------------------------------------------------------

/** A blur of propeller at a point, facing forward. */
function prop(k: Kit, x: number, y: number, z: number, r: number): void {
  k.cyl(0.03, 0.03, 0.05, 6, '#2b2b2e', x, y - 0.025, z).rotation.x = Math.PI / 2;
  const disc = k.cyl(r, r, 0.006, 16, '#d8d4c8', x, y - 0.003, z + 0.03);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(x, y, z + 0.03);
}

function fighter(_epoch: number): Kit {
  const k = new Kit();
  // A biplane: canvas fuselage, team upper wing and tail, struts, a goggled pilot.
  const body = '#7a7c52';
  k.box(0.14, 0.13, 0.7, body, 0, -0.065, 0);
  const cowl = k.cyl(0.085, 0.08, 0.1, 10, '#3a3a3e', 0, 0, 0.36);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.set(0, 0, 0.36);
  prop(k, 0, 0, 0.42, 0.2);
  k.box(1.0, 0.02, 0.2, body, 0, -0.08, 0.12);
  k.team(k.box(1.06, 0.02, 0.2, TEAM, 0, 0.14, 0.14));
  for (const x of [-0.32, 0.32]) for (const z of [0.07, 0.19]) k.box(0.012, 0.22, 0.012, '#3a2a1e', x, -0.07, z);
  for (const x of [-0.42, 0.42]) k.team(k.cyl(0.05, 0.05, 0.022, 10, TEAM, x, -0.075, 0.12));
  k.box(0.36, 0.015, 0.1, body, 0, -0.02, -0.32);
  k.team(k.box(0.015, 0.13, 0.12, TEAM, 0, -0.01, -0.33));
  k.sphere(0.045, SKIN, 0, 0.04, 0.0);
  k.box(0.08, 0.02, 0.02, '#2b2b2e', 0, 0.05, 0.035);
  for (const x of [-0.08, 0.08]) {
    k.box(0.01, 0.1, 0.01, '#2b2b2e', x, -0.2, 0.18);
    k.cyl(0.035, 0.035, 0.02, 8, '#1d1d1d', x, -0.22, 0.18).rotation.z = Math.PI / 2;
  }
  return k;
}

function bomber(_epoch: number): Kit {
  const k = new Kit();
  // A big twin-engined biplane: long fuselage, glazed nose, two engines, a rack of bombs.
  const body = '#5e6250';
  k.box(0.2, 0.18, 1.05, body, 0, -0.09, 0);
  k.box(0.16, 0.1, 0.14, '#9ec2d8', 0, -0.05, 0.56);
  k.box(1.6, 0.025, 0.26, body, 0, -0.11, 0.08);
  k.team(k.box(1.66, 0.025, 0.26, TEAM, 0, 0.2, 0.1));
  for (const x of [-0.55, -0.25, 0.25, 0.55]) for (const z of [0.0, 0.18]) k.box(0.014, 0.3, 0.014, '#3a2a1e', x, -0.1, z);
  for (const x of [-0.38, 0.38]) {
    const nac = k.cyl(0.07, 0.06, 0.32, 10, '#3a3a3e', x, -0.1, 0.12);
    nac.rotation.x = Math.PI / 2;
    nac.position.set(x, -0.1, 0.16);
    prop(k, x, -0.1, 0.33, 0.2);
    k.team(k.cyl(0.07, 0.07, 0.03, 10, TEAM, x * 1.6, 0.2, 0.1));
  }
  k.box(0.6, 0.02, 0.16, body, 0, -0.02, -0.5);
  for (const x of [-0.2, 0.2]) k.team(k.box(0.015, 0.16, 0.16, TEAM, x, -0.02, -0.52));
  for (const z of [-0.08, 0.08]) k.sphere(0.05, '#2b2b2e', 0, -0.22, z).scale.set(0.8, 0.8, 2);
  k.sphere(0.045, SKIN, 0, 0.04, 0.35);
  return k;
}

// ---- Traders ---------------------------------------------------------------------------------------

/** A beast of burden standing at the origin facing +z; returns the height of its back. */
function beast(k: Kit, o: { coat: string; leg: number; body: [number, number, number]; z?: number; ears?: boolean; horns?: boolean }): number {
  const z0 = o.z ?? 0;
  const [bw, bh, bl] = o.body;
  const LEG = o.leg;
  const legs: [number, number, number][] = [
    [-bw * 0.36, bl * 0.34, RIG_LEG_A],
    [bw * 0.36, bl * 0.34, RIG_LEG_B],
    [-bw * 0.36, -bl * 0.34, RIG_LEG_B],
    [bw * 0.36, -bl * 0.34, RIG_LEG_A],
  ];
  for (const [x, z, rig] of legs) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z0 + z);
    k.box(bw * 0.28, LEG - 0.03, bw * 0.32, o.coat, x, 0.03, z0 + z, g);
    k.box(bw * 0.3, 0.035, bw * 0.34, '#2b2420', x, 0, z0 + z, g);
  }
  k.box(bw, bh, bl, o.coat, 0, LEG, z0);
  const neck = k.box(bw * 0.5, bh * 1.1, bw * 0.55, o.coat, 0, LEG + bh * 0.4, z0 + bl * 0.45);
  neck.rotation.x = 0.7;
  const head = k.box(bw * 0.48, bw * 0.45, bl * 0.36, o.coat, 0, LEG + bh * 1.05, z0 + bl * 0.62);
  head.rotation.x = 0.45;
  k.box(bw * 0.42, bw * 0.3, bl * 0.12, '#d8cbb4', 0, LEG + bh * 0.95, z0 + bl * 0.78).rotation.x = 0.45;
  if (o.ears) for (const x of [-0.035, 0.035]) k.box(0.025, 0.12, 0.03, o.coat, x, LEG + bh * 1.35, z0 + bl * 0.55).rotation.z = x * 6;
  if (o.horns) for (const x of [-1, 1]) {
    const h = k.cone(0.02, 0.12, 5, '#e8dcc0', x * bw * 0.32, LEG + bh * 1.3, z0 + bl * 0.6);
    h.rotation.z = -x * 1.1;
  }
  // A tail.
  k.box(0.025, bh * 0.9, 0.025, '#3a2c22', 0, LEG - bh * 0.3, z0 - bl * 0.52).rotation.x = -0.3;
  return LEG + bh;
}

/** What a trader carries: bales, jars and baskets on the way out, a chest of gold on the way home. */
function wares(k: Kit, homeward: boolean, x: number, y: number, z: number, w: number, l: number): void {
  if (homeward) {
    const chest = k.group(x, y, z);
    k.box(w * 0.7, 0.1, l * 0.45, '#6b4426', 0, 0, 0, chest);
    k.box(w * 0.74, 0.02, l * 0.48, '#c8913f', 0, 0.1, 0, chest);
    for (const zz of [-l * 0.12, l * 0.12]) k.box(w * 0.74, 0.11, 0.02, '#c8913f', 0, 0, zz, chest);
    // Coins heaped over the brim catch the light.
    k.glow(k.blob(Math.max(0.05, w * 0.26), '#f2cf4a', -w * 0.08, 0.13, 0, chest)).scale.set(1, 0.6, 1);
    k.glow(k.blob(Math.max(0.04, w * 0.2), '#ffd75a', w * 0.14, 0.12, l * 0.05, chest)).scale.set(1, 0.6, 1);
    return;
  }
  // Bales under a cloth in the player's color, a jar and a basket of fruit.
  k.team(k.box(w * 0.8, 0.11, l * 0.5, TEAM, x, y, z - l * 0.08));
  k.box(w * 0.82, 0.02, 0.03, '#8a6a46', x, y + 0.09, z - l * 0.08);
  k.lathe([[0, 0], [0.04, 0.01], [0.055, 0.06], [0.03, 0.12], [0.035, 0.14]], 8, '#b8673a', x - w * 0.22, y + 0.11, z + l * 0.25);
  k.cyl(0.05, 0.04, 0.05, 7, '#b08a4e', x + w * 0.2, y + 0.11, z + l * 0.25);
  for (const [dx, c] of [[-0.02, '#e0782e'], [0.025, '#7aa83a'], [0, '#c8402e']] as [number, string][]) k.sphere(0.025, c, x + w * 0.2 + dx, y + 0.17, z + l * 0.25, undefined, 5);
}

/** A carter walking beside the beast with a stick. */
function carter(k: Kit, x: number, z: number, outfit: { legs: string; torso: string; hat?: string }): void {
  const at = k.group(x, 0, z);
  const b = person(k, { legs: outfit.legs, torso: outfit.torso, belt: TEAM, at });
  k.team(k.box(0.176, 0.035, 0.116, TEAM, 0, HIP + 0.02, 0, at));
  if (outfit.hat) k.cyl(0.09, 0.1, 0.035, 8, outfit.hat, 0, 0.55, 0, at);
  else hairOrHat(k, 0, undefined, at);
  held(b, (kk, g) => kk.cyl(0.008, 0.008, 0.4, 4, WOOD, 0, -0.05, 0, g), SHOULDER - 0.18, 0.5);
}

function trader(epoch: number): Kit {
  const k = new Kit();
  // Above 10: the same, homeward with gold.
  const homeward = epoch >= 10;
  const e = epoch % 10;
  if (e <= 1) {
    // Pack donkey: panniers either side, the load on its back, led by a carter.
    const back = beast(k, { coat: '#8a7d6e', leg: 0.2, body: [0.15, 0.14, 0.36], ears: true });
    for (const x of [-0.12, 0.12]) {
      k.box(0.07, 0.13, 0.2, '#9a7a4a', x, back - 0.2, -0.02);
      k.team(k.box(0.075, 0.03, 0.21, TEAM, x, back - 0.08, -0.02));
    }
    wares(k, homeward, 0, back, -0.02, 0.2, 0.3);
    carter(k, -0.24, 0.16, { legs: SKIN, torso: LINEN });
    return k;
  }
  if (e === 2) {
    // Ox cart: a yoked ox, a two-wheeled cart behind, the carter with a goad.
    beast(k, { coat: '#6e5a48', leg: 0.22, body: [0.22, 0.18, 0.4], z: 0.32, horns: true });
    k.box(0.3, 0.04, 0.05, WOOD, 0, 0.42, 0.52);
    for (const x of [-0.08, 0.08]) k.box(0.025, 0.025, 0.5, WOOD, x, 0.3, 0.05).rotation.x = -0.12;
    wheel(k, -0.24, -0.25, 0.17);
    wheel(k, 0.24, -0.25, 0.17);
    k.box(0.42, 0.05, 0.5, '#8a6440', 0, 0.22, -0.25);
    for (const x of [-0.2, 0.2]) k.box(0.03, 0.1, 0.5, '#7a5636', x, 0.27, -0.25);
    k.box(0.42, 0.1, 0.03, '#7a5636', 0, 0.27, -0.49);
    wares(k, homeward, 0, 0.27, -0.25, 0.36, 0.45);
    carter(k, -0.3, 0.42, { legs: '#6b5a48', torso: '#8c7a5a' });
    return k;
  }
  if (e === 3) {
    // Covered wagon: a draught horse, four wheels, a canvas hood in the player's color, a driver up front.
    beast(k, { coat: '#8a5a34', leg: 0.27, body: [0.18, 0.17, 0.44], z: 0.48 });
    for (const x of [-0.07, 0.07]) k.box(0.025, 0.025, 0.4, WOOD, x, 0.3, 0.12).rotation.x = -0.1;
    for (const z of [0.05, -0.55]) {
      wheel(k, -0.25, z, 0.15, '#5b4330');
      wheel(k, 0.25, z, 0.15, '#5b4330');
    }
    k.box(0.44, 0.06, 0.78, '#7a5636', 0, 0.2, -0.25);
    k.box(0.46, 0.12, 0.8, '#8a6440', 0, 0.26, -0.25);
    // A tailboard behind the hood, where the gold rides home.
    k.box(0.4, 0.04, 0.18, '#7a5636', 0, 0.3, -0.7);
    if (homeward) wares(k, true, 0, 0.34, -0.7, 0.36, 0.34);
    const hood = k.team(k.cyl(0.24, 0.24, 0.62, 10, TEAM, 0, 0.38, -0.28));
    hood.rotation.x = Math.PI / 2;
    hood.position.set(0, 0.38, -0.28);
    hood.scale.set(1, 1, 0.9);
    for (const z of [-0.02, -0.28, -0.54]) k.ring(0.245, 0.012, '#5b4330', 0.38, k.group(0, 0, z)).rotation.set(0, 0, 0);
    // The driver on the bench, reins in hand.
    const seat = k.group(0, 0.3, 0.08);
    const drv = person(k, { legs: '#5a5f6b', torso: LINEN, at: seat, y: -0.12, mounted: true });
    k.cyl(0.11, 0.11, 0.015, 10, '#5a4632', 0, 0.42, 0, seat);
    k.cyl(0.06, 0.07, 0.07, 8, '#5a4632', 0, 0.43, 0, seat);
    held(drv, (kk, g) => kk.cyl(0.006, 0.006, 0.3, 4, LEATHER, 0, 0, 0, g), SHOULDER - 0.3, 1.2);
    return k;
  }
  // Traction engine: a steam boiler on iron wheels, a tall stack, a canopy in the player's color,
  // towing a little wagon of crates.
  wheel(k, -0.26, -0.05, 0.22, '#3f4247');
  wheel(k, 0.26, -0.05, 0.22, '#3f4247');
  wheel(k, -0.18, 0.42, 0.12, '#3f4247');
  wheel(k, 0.18, 0.42, 0.12, '#3f4247');
  const boiler = k.cyl(0.13, 0.13, 0.6, 12, '#2f5a3a', 0, 0.3, 0.2);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, 0.32, 0.2);
  for (const z of [0.0, 0.2, 0.4]) {
    const band = k.cyl(0.135, 0.135, 0.02, 12, '#c8a040', 0, 0.32, z);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.32, z);
  }
  k.cyl(0.04, 0.05, 0.36, 8, '#26262a', 0, 0.42, 0.42);
  k.cyl(0.06, 0.04, 0.04, 8, '#26262a', 0, 0.78, 0.42);
  k.box(0.36, 0.22, 0.2, '#3f4247', 0, 0.16, -0.18);
  // A little canopy over the footplate only, so the boiler shows.
  for (const [x, z] of [[-0.16, -0.32], [0.16, -0.32], [-0.16, -0.04], [0.16, -0.04]]) k.box(0.02, 0.4, 0.02, '#3f4247', x, 0.3, z);
  k.team(k.box(0.4, 0.03, 0.36, TEAM, 0, 0.7, -0.18));
  // The engineer on the footplate.
  const plate = k.group(0, 0.14, -0.2);
  plate.scale.setScalar(0.85);
  person(k, { legs: '#454952', torso: '#3a3a40', at: plate });
  k.cyl(0.072, 0.078, 0.035, 10, '#3a3a40', 0, 0.54, 0, plate);
  // The wagon behind.
  wheel(k, -0.2, -0.72, 0.1, '#4a3a2c');
  wheel(k, 0.2, -0.72, 0.1, '#4a3a2c');
  k.box(0.04, 0.03, 0.22, IRON, 0, 0.12, -0.4);
  k.box(0.38, 0.05, 0.4, '#7a5636', 0, 0.14, -0.72);
  if (homeward) wares(k, true, 0, 0.19, -0.72, 0.36, 0.38);
  else {
    k.box(0.15, 0.13, 0.15, '#a07a4a', -0.09, 0.19, -0.66);
    k.box(0.13, 0.11, 0.13, '#8a6440', 0.1, 0.19, -0.78);
    k.team(k.box(0.17, 0.02, 0.17, TEAM, -0.09, 0.32, -0.66));
  }
  return k;
}

/**
 * A ger cart (the Age of the Steppe, #297): a horned ox yoked to a broad cart carrying a packed ger, the
 * felt drum and its smoke-hole roof lashed down with a band in the player's colour, the painted door at the
 * front and the folded lattice walls along the sides. From the Middle Ages a heavier wagon on four wheels.
 */
function wagon(epoch: number): Kit {
  // Above 20: the Market on the road (the Silk Road, #326).
  if (epoch >= 20) return caravanCart(epoch - 20);
  const k = new Kit();
  beast(k, { coat: '#5e4a3a', leg: 0.22, body: [0.22, 0.18, 0.4], z: 0.55, horns: true });
  k.box(0.34, 0.04, 0.05, WOOD, 0, 0.42, 0.74);
  for (const x of [-0.08, 0.08]) k.box(0.025, 0.025, 0.55, WOOD, x, 0.3, 0.28).rotation.x = -0.12;
  if (epoch >= 2) {
    for (const z of [0.12, -0.42]) {
      wheel(k, -0.3, z, 0.15, '#5b4330');
      wheel(k, 0.3, z, 0.15, '#5b4330');
    }
  } else {
    wheel(k, -0.3, -0.15, 0.19);
    wheel(k, 0.3, -0.15, 0.19);
  }
  // The bed, and the lattice walls folded along its sides.
  k.box(0.56, 0.05, 0.8, '#8a6440', 0, 0.22, -0.15);
  for (const x of [-0.25, 0.25]) {
    k.box(0.05, 0.12, 0.66, '#b08a58', x, 0.31, -0.15);
    for (const z of [-0.4, -0.15, 0.1]) k.box(0.055, 0.02, 0.1, '#6a4a2c', x, 0.34, z).rotation.x = 0.6;
  }
  // The felt drum, its band, the domed roof and the crown ring.
  k.cyl(0.21, 0.23, 0.2, 10, '#ddd2b8', 0, 0.35, -0.17);
  k.team(k.cyl(0.235, 0.235, 0.04, 10, TEAM, 0, 0.36, -0.17));
  k.cone(0.25, 0.14, 10, '#cdbf9e', 0, 0.52, -0.17);
  k.cyl(0.05, 0.05, 0.03, 8, '#8a6440', 0, 0.6, -0.17);
  // The painted door, facing the road.
  k.box(0.1, 0.14, 0.02, '#b8462e', 0, 0.34, 0.07);
  carter(k, -0.34, 0.6, { legs: '#5a4a3a', torso: '#3e5a7a', hat: '#8a3a2a' });
  return k;
}

/**
 * The Market on the road (the Silk Road, #326): a two-humped Bactrian camel, the caravans' beast from the
 * Gobi to the Caspian, draws a four-wheeled cart. On it ride the Market's striped awning rolled on its poles,
 * bales of silk in madder red, indigo and saffron under a cloth in the player's colour, a tall oil jar, a
 * chest of the scales and weights, and a pennant on a pole so the traders can find the camp across the grass.
 */
function caravanCart(epoch: number): Kit {
  const k = new Kit();
  const coat = '#b48a58';
  const back = beast(k, { coat, leg: 0.32, body: [0.19, 0.17, 0.4], z: 0.62 });
  // Two humps, and the shaggy tuft at the throat.
  for (const z of [0.74, 0.5]) k.sphere(0.09, '#a87e4e', 0, back + 0.02, z, undefined, 8).scale.set(1, 1.2, 1);
  k.box(0.09, 0.12, 0.08, '#8a6440', 0, back - 0.08, 0.86);
  // A saddle blanket in the player's colour between the humps, and a bell under the chin.
  k.team(k.box(0.21, 0.02, 0.12, TEAM, 0, back + 0.01, 0.61));
  k.sphere(0.025, '#d8b25a', 0, back - 0.16, 0.92, undefined, 6);
  // Shafts to the cart.
  for (const x of [-0.1, 0.1]) k.box(0.025, 0.025, 0.55, WOOD, x, 0.34, 0.24).rotation.x = -0.15;
  for (const z of [0.12, -0.46]) {
    wheel(k, -0.3, z, 0.15, '#5b4330');
    wheel(k, 0.3, z, 0.15, '#5b4330');
  }
  k.box(0.56, 0.05, 0.84, '#8a6440', 0, 0.24, -0.17);
  for (const x of [-0.27, 0.27]) k.box(0.03, 0.08, 0.84, '#6a4a2c', x, 0.3, -0.17);
  // The awning, rolled on its poles along the left side: stripes of red and cream.
  const roll = k.group(-0.17, 0.36, -0.17);
  for (let i = 0; i < 6; i++) k.cyl(0.055, 0.055, 0.13, 8, i % 2 ? '#efe2c4' : '#b8462e', 0, 0, -0.33 + i * 0.13, roll).rotation.x = Math.PI / 2;
  for (const z of [-0.43, 0.43]) k.box(0.02, 0.02, 0.06, WOOD, 0, 0, z, roll);
  // Bales of silk.
  for (const [x, y, z, c] of [[0.1, 0.33, 0.02, '#a83a3a'], [0.1, 0.33, -0.22, '#3a4e9a'], [0.1, 0.45, -0.1, '#e0a83a'], [-0.06, 0.47, -0.36, '#7a3a8a']] as [number, number, number, string][]) {
    k.box(0.17, 0.11, 0.2, c, x, y, z);
    k.box(0.18, 0.02, 0.025, '#d8c8a0', x, y + 0.01, z);
  }
  k.team(k.box(0.2, 0.02, 0.48, TEAM, 0.1, 0.395, -0.1));
  // The scales' chest at the back, and a tall jar.
  k.box(0.2, 0.12, 0.13, '#6b4426', 0.08, 0.32, -0.5);
  k.box(0.21, 0.02, 0.14, '#c8913f', 0.08, 0.39, -0.5);
  k.lathe([[0, 0], [0.04, 0.01], [0.06, 0.08], [0.035, 0.17], [0.04, 0.19]], 8, '#b8673a', -0.16, 0.27, -0.52);
  // The pennant pole, so the traders find the camp across the grass.
  k.cyl(0.012, 0.012, 0.75, 5, WOOD, -0.24, 0.27, -0.56);
  k.team(k.box(0.02, 0.1, 0.18, TEAM, -0.24, 0.92, -0.65));
  carter(k, -0.36, 0.72, { legs: '#5a4a3a', torso: '#7a3a2e', hat: '#3e5a7a' });
  void epoch;
  return k;
}

const MAKERS: Record<UnitType, (epoch: number) => Kit> = { citizen, infantry, ranged, cavalry, siege, priest, hero, fisher, warship, transport, cog, fighter, bomber, trader, wagon };

/** Epoch + 30 asks for the citizen as a thrall (the same offset trick as the trader's gold and the caravan cart). */
export const THRALL_MODEL = 30;

/** Epoch + 40 asks for a foot soldier at work: the legion's tools on his back (#501). */
export const LEGION_MODEL = 40;

function legionary(epoch: number): Kit {
  const k = infantry(epoch);
  // A satchel on the back, an axe hafted through its strap, and a coil of rope: a Roman soldier carries his own tools.
  k.box(0.11, 0.12, 0.05, LEATHER, 0, 0.24, -0.1);
  k.box(0.115, 0.02, 0.055, '#5a3c20', 0, 0.3, -0.1);
  k.cyl(0.011, 0.011, 0.3, 4, WOOD, 0.06, 0.28, -0.13).rotation.z = 0.35;
  k.box(0.07, 0.045, 0.012, STEEL, 0.13, 0.42, -0.13).rotation.z = 0.35;
  k.cyl(0.03, 0.03, 0.04, 8, '#b09a6a', -0.06, 0.2, -0.14).rotation.x = Math.PI / 2;
  return k;
}

function makeUnit(type: UnitType, epochIn: number): Kit {
  // The Atomic Age (#605) has no soldiers of its own yet: its people keep their Industrial look.
  const epoch = epochIn === 5 ? 4 : epochIn;
  if (type === 'infantry' && epoch >= LEGION_MODEL) return legionary(epoch - LEGION_MODEL);
  return type === 'citizen' && epoch >= THRALL_MODEL ? thrall(epoch - THRALL_MODEL) : MAKERS[type](epoch);
}

// ---- Deer ------------------------------------------------------------------------------------------

function deer(): Kit {
  const k = new Kit();
  const coat = '#a8703e';
  const LEG = 0.24;
  for (const [x, z, rig] of [[-0.05, 0.12, RIG_LEG_A], [0.05, 0.12, RIG_LEG_B], [-0.05, -0.12, RIG_LEG_B], [0.05, -0.12, RIG_LEG_A]] as [number, number, number][]) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z);
    k.box(0.035, LEG, 0.04, coat, x, 0, z, g);
  }
  k.box(0.13, 0.13, 0.34, coat, 0, LEG, 0);
  k.box(0.1, 0.03, 0.28, '#e8dcc6', 0, LEG - 0.01, 0);
  const neck = k.box(0.06, 0.18, 0.07, coat, 0, LEG + 0.08, 0.15);
  neck.rotation.x = 0.4;
  const head = k.box(0.07, 0.07, 0.14, coat, 0, LEG + 0.22, 0.22);
  head.rotation.x = 0.3;
  k.box(0.04, 0.04, 0.03, '#f2ece0', 0, LEG + 0.09, -0.18);
  for (const x of [-0.04, 0.04]) {
    const a = k.cyl(0.006, 0.008, 0.14, 3, '#d9c7a0', x, LEG + 0.28, 0.2);
    a.rotation.z = x * 6;
    const t = k.cyl(0.005, 0.005, 0.06, 3, '#d9c7a0', x * 1.6, LEG + 0.38, 0.22);
    t.rotation.x = 0.8;
  }
  return k;
}

let deerGeo: THREE.BufferGeometry | null = null;

/** The deer, rigged to walk and run. */
export function deerGeometry(): THREE.BufferGeometry {
  deerGeo ??= bake(deer().root);
  return deerGeo;
}

// ---- The wild (#171) -------------------------------------------------------------------------------

/** A woolly mammoth: shaggy, high-shouldered, with long curved tusks. Its head (and tusks) lunge to gore. */
function mammoth(): Kit {
  const k = new Kit();
  const wool = '#6b4527';
  const dark = '#4a2e1a';
  const LEG = 0.26;
  for (const [x, z, rig] of [[-0.12, 0.17, RIG_LEG_A], [0.12, 0.17, RIG_LEG_B], [-0.12, -0.2, RIG_LEG_B], [0.12, -0.2, RIG_LEG_A]] as [number, number, number][]) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z);
    k.cyl(0.06, 0.065, LEG + 0.04, 6, dark, x, 0, z, g);
    k.cyl(0.07, 0.07, 0.03, 6, '#3a2416', x, 0, z, g);
  }
  // A round, shaggy body, high at the shoulders, with a skirt of long hair.
  k.blob(0.27, wool, 0, LEG + 0.2, -0.04).scale.set(1, 0.85, 1.35);
  k.blob(0.21, wool, 0, LEG + 0.3, 0.13).scale.set(1.05, 1, 1);
  k.blob(0.13, dark, 0, LEG + 0.44, 0.1);
  k.cyl(0.25, 0.27, 0.12, 8, dark, 0, LEG - 0.06, -0.02).scale.set(1, 1, 1.5);
  k.cyl(0.015, 0.025, 0.14, 4, dark, 0, LEG + 0.12, -0.42).rotation.x = -0.5;
  const head = k.limb(k.group(0, 0, 0), RIG_ARM, LEG + 0.3, 0.3);
  k.blob(0.14, wool, 0, LEG + 0.3, 0.4, head).scale.set(0.95, 1.15, 0.9);
  k.blob(0.07, dark, 0, LEG + 0.45, 0.37, head);
  for (const x of [-0.13, 0.13]) k.blob(0.06, dark, x, LEG + 0.32, 0.34, head).scale.set(0.5, 1, 1);
  // The trunk, in three tapering pieces curling down.
  k.cyl(0.05, 0.045, 0.16, 6, wool, 0, LEG + 0.08, 0.5, head).rotation.x = 0.25;
  k.cyl(0.045, 0.035, 0.14, 6, wool, 0, LEG - 0.06, 0.53, head);
  k.cyl(0.035, 0.03, 0.08, 6, dark, 0, LEG - 0.14, 0.5, head).rotation.x = -0.5;
  // Tusks: out, down, then up and in.
  for (const x of [-1, 1]) {
    const a = k.cyl(0.022, 0.026, 0.2, 5, '#efe6cf', x * 0.08, LEG + 0.08, 0.54, head);
    a.rotation.x = 1.0;
    a.rotation.z = -x * 0.35;
    const b = k.cyl(0.014, 0.022, 0.18, 5, '#f4eedc', x * 0.11, LEG + 0.06, 0.68, head);
    b.rotation.x = -0.6;
    b.rotation.z = x * 0.5;
  }
  return k;
}

/** A grey wolf, lean and long-legged, with a bushy tail. Its head snaps forward to bite. */
function wolf(): Kit {
  const k = new Kit();
  const coat = '#7d7a74';
  const pale = '#c9c3b6';
  const LEG = 0.17;
  for (const [x, z, rig] of [[-0.04, 0.11, RIG_LEG_A], [0.04, 0.11, RIG_LEG_B], [-0.04, -0.11, RIG_LEG_B], [0.04, -0.11, RIG_LEG_A]] as [number, number, number][]) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z);
    k.box(0.03, LEG, 0.035, coat, x, 0, z, g);
  }
  k.box(0.1, 0.1, 0.3, coat, 0, LEG, 0);
  k.box(0.08, 0.03, 0.24, pale, 0, LEG - 0.03, 0.01);
  k.box(0.11, 0.07, 0.1, '#5e5b56', 0, LEG + 0.07, 0.1);
  const head = k.limb(k.group(0, 0, 0), RIG_ARM, LEG + 0.08, 0.16);
  k.box(0.08, 0.08, 0.09, coat, 0, LEG + 0.1, 0.2, head);
  k.box(0.045, 0.04, 0.09, pale, 0, LEG + 0.07, 0.27, head);
  k.box(0.02, 0.02, 0.02, '#1c1a18', 0, LEG + 0.09, 0.31, head);
  for (const x of [-0.025, 0.025]) k.cone(0.018, 0.05, 4, '#4f4c48', x, LEG + 0.16, 0.18, head);
  // A bushy tail, carried low.
  const tail = k.cyl(0.035, 0.02, 0.16, 5, '#6a6761', 0, LEG - 0.06, -0.22);
  tail.rotation.x = 0.6;
  return k;
}

/** A wild boar: low, bristled and thick-necked, with pale tusks. Its head jerks up and forward to gore. */
function boar(): Kit {
  const k = new Kit();
  const hide = '#4d3b2a';
  const dark = '#2f241a';
  const LEG = 0.12;
  for (const [x, z, rig] of [[-0.05, 0.1, RIG_LEG_A], [0.05, 0.1, RIG_LEG_B], [-0.05, -0.1, RIG_LEG_B], [0.05, -0.1, RIG_LEG_A]] as [number, number, number][]) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z);
    k.box(0.035, LEG, 0.035, dark, x, 0, z, g);
  }
  k.blob(0.14, hide, 0, LEG + 0.1, 0.0).scale.set(0.9, 0.85, 1.5);
  k.blob(0.1, dark, 0, LEG + 0.2, 0.1).scale.set(0.7, 0.6, 1.2);
  // A bristle ridge down the back.
  k.box(0.03, 0.05, 0.28, dark, 0, LEG + 0.25, 0);
  const head = k.limb(k.group(0, 0, 0), RIG_ARM, LEG + 0.1, 0.17);
  k.blob(0.085, hide, 0, LEG + 0.1, 0.22, head).scale.set(1, 0.95, 1.2);
  k.box(0.07, 0.06, 0.08, dark, 0, LEG + 0.07, 0.31, head);
  for (const x of [-0.045, 0.045]) {
    const tusk = k.cone(0.012, 0.07, 4, '#e8dfc8', x, LEG + 0.07, 0.3, head);
    tusk.rotation.x = -0.9;
  }
  for (const x of [-0.04, 0.04]) k.cone(0.02, 0.04, 4, dark, x, LEG + 0.2, 0.2, head);
  const tail = k.cyl(0.008, 0.008, 0.08, 3, dark, 0, LEG + 0.2, -0.22);
  tail.rotation.x = 0.7;
  return k;
}

/** A raider of the wild camps: a lean man in a hide kilt, war paint across the shoulders, a flint spear thrust forward to strike. */
function raider(): Kit {
  const k = new Kit();
  const skin = '#a8714a';
  const hide = '#5a3f2a';
  const dark = '#2d2118';
  const paint = '#b23a2a';
  const LEG = 0.24;
  for (const [x, rig] of [[-0.05, RIG_LEG_A], [0.05, RIG_LEG_B]] as [number, number][]) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, 0);
    k.box(0.05, LEG, 0.05, skin, x, 0, 0, g);
    k.box(0.055, 0.03, 0.08, dark, x, 0, 0.01, g);
  }
  k.box(0.2, 0.07, 0.12, hide, 0, LEG - 0.03, 0);
  k.box(0.18, 0.2, 0.1, skin, 0, LEG + 0.04, 0);
  k.box(0.2, 0.05, 0.11, paint, 0, LEG + 0.19, 0);
  k.blob(0.07, skin, 0, LEG + 0.34, 0.01);
  k.box(0.14, 0.04, 0.09, dark, 0, LEG + 0.4, 0);
  // The spear arm: it drives forward on the blow.
  const arm = k.limb(k.group(0, 0, 0), RIG_ARM, LEG + 0.2, 0.05);
  k.box(0.04, 0.04, 0.16, skin, 0.11, LEG + 0.18, 0.08, arm);
  k.cyl(0.012, 0.012, 0.5, 4, '#6b4a2a', 0.11, LEG + 0.18, 0.2, arm).rotation.x = Math.PI / 2;
  k.cone(0.026, 0.09, 4, '#cfcac0', 0.11, LEG + 0.18, 0.5, arm).rotation.x = Math.PI / 2;
  return k;
}

let raiderGeo: THREE.BufferGeometry | null = null;

/** The raider, rigged to stride and thrust. */
export function raiderGeometry(): THREE.BufferGeometry {
  raiderGeo ??= bake(raider().root);
  return raiderGeo;
}

let boarGeo: THREE.BufferGeometry | null = null;
let mammothGeo: THREE.BufferGeometry | null = null;
let wolfGeo: THREE.BufferGeometry | null = null;

/** The mammoth, rigged to walk and gore. */
export function mammothGeometry(): THREE.BufferGeometry {
  mammothGeo ??= bake(mammoth().root);
  return mammothGeo;
}

/** The boar, rigged to trot and gore. */
export function boarGeometry(): THREE.BufferGeometry {
  boarGeo ??= bake(boar().root);
  return boarGeo;
}

/** The wolf, rigged to run and bite. */
export function wolfGeometry(): THREE.BufferGeometry {
  wolfGeo ??= bake(wolf().root);
  return wolfGeo;
}

// ---- The flock (#308) ------------------------------------------------------------------------------

/**
 * A fat-tailed steppe sheep: a cream fleece, a dark face and legs, the broad tail the herders of the
 * grasslands bred for, and a daub of its people's dye on the back (the team color). Its head (the arm rig)
 * dips to crop the grass.
 */
function sheep(): Kit {
  const k = new Kit();
  const wool = '#e6dcc4';
  const dark = '#3a2e26';
  const LEG = 0.11;
  for (const [x, z, rig] of [[-0.045, 0.08, RIG_LEG_A], [0.045, 0.08, RIG_LEG_B], [-0.045, -0.08, RIG_LEG_B], [0.045, -0.08, RIG_LEG_A]] as [number, number, number][]) {
    const g = k.limb(k.group(0, 0, 0), rig, LEG, z);
    k.box(0.028, LEG, 0.03, dark, x, 0, z, g);
  }
  // A round fleece in three puffs, and the fat tail behind.
  k.blob(0.12, wool, 0, LEG + 0.08, 0).scale.set(0.95, 0.85, 1.3);
  k.blob(0.08, '#efe7d2', 0, LEG + 0.14, 0.06);
  k.blob(0.08, '#ddd2b6', 0, LEG + 0.13, -0.07);
  k.blob(0.06, '#d8cba9', 0, LEG + 0.03, -0.17).scale.set(1.3, 1, 0.8);
  // The herders' dye on the back.
  k.team(k.box(0.09, 0.02, 0.08, TEAM, 0, LEG + 0.2, -0.02));
  const head = k.limb(k.group(0, 0, 0), RIG_ARM, LEG + 0.1, 0.12);
  k.blob(0.045, wool, 0, LEG + 0.15, 0.13, head);
  k.box(0.05, 0.05, 0.08, dark, 0, LEG + 0.11, 0.19, head).rotation.x = 0.35;
  for (const x of [-1, 1]) {
    const ear = k.box(0.05, 0.012, 0.025, dark, x * 0.045, LEG + 0.13, 0.16, head);
    ear.rotation.z = x * -0.4;
  }
  return k;
}

let sheepGeo: THREE.BufferGeometry | null = null;

/** The sheep, rigged to walk and to dip its head to graze. */
export function sheepGeometry(): THREE.BufferGeometry {
  sheepGeo ??= bake(sheep().root);
  return sheepGeo;
}

const cache = new Map<string, THREE.BufferGeometry>();

/** How high a unit line's head (or its banner pole) reaches, where a people's mark sits. */
const MARK_Y: Partial<Record<UnitType, number>> = { infantry: 0.5, ranged: 0.5, priest: 0.5, cavalry: 0.98, siege: 0.8 };

/** A people's mark on its signature line: a crest, plume, headdress or banner, so its army reads at a glance. */
function signatureMark(k: Kit, civ: CivId, type: UnitType): void {
  const y = MARK_Y[type] ?? 0.5;
  // Foot soldiers wear it on the head; siege and riders carry it on a pole behind.
  const pole = type === 'siege' || type === 'cavalry';
  const z = pole ? -0.2 : -0.01;
  const top = pole ? y + 0.3 : y + 0.06;
  if (pole) {
    k.cyl(0.01, 0.01, 0.34, 4, WOOD, 0, y, z);
    pennant(k, 0, y + 0.13, z, 0.16);
  }
  switch (civ) {
    case 'egyptians':
      k.cone(0.07, 0.14, 4, '#e0b13c', 0, top - 0.02, z);
      k.box(0.16, 0.03, 0.03, '#2f5fa8', 0, top - 0.05, z + 0.06);
      break;
    case 'greeks':
      k.box(0.03, 0.09, 0.18, '#b3282d', 0, top, z);
      break;
    case 'romans':
      k.box(0.2, 0.08, 0.03, '#c0302f', 0, top, z);
      break;
    case 'mongols':
      k.cone(0.045, 0.1, 5, '#22201e', 0, top, z);
      k.blob(0.045, '#f1ece0', 0, top + 0.08, z);
      break;
    case 'chinese':
      k.box(0.03, 0.14, 0.2, '#d03a2a', 0.0, top - 0.04, z);
      k.box(0.032, 0.05, 0.08, '#f0c43a', 0.0, top - 0.01, z);
      break;
    case 'britons':
      k.cone(0.03, 0.2, 4, '#f6f4ee', 0, top, z - 0.03).rotation.x = -0.5;
      break;
  }
}

/** The baked geometry of a unit line in an epoch (team parts left white for tinting), with a people's mark when given. */
export function unitGeometry(type: UnitType, epoch: number, civ?: CivId): THREE.BufferGeometry {
  const key = `${type}:${epoch}:${civ ?? ''}`;
  let g = cache.get(key);
  if (!g) {
    const kit = makeUnit(type, epoch);
    if (civ) signatureMark(kit, civ, type);
    g = bake(kit.root);
    cache.set(key, g);
  }
  return g;
}

/** The same model with the team color baked in (for portraits). */
export function unitGeometryColored(type: UnitType, epoch: number, color: string, civ?: CivId): THREE.BufferGeometry {
  const kit = makeUnit(type, epoch);
  if (civ) signatureMark(kit, civ, type);
  return bake(kit.root, color);
}
