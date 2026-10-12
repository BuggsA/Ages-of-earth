import * as THREE from 'three';
import type { UnitType } from '../sim/types';
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
  });
  return k;
}

// ---- Infantry --------------------------------------------------------------------------------------

function infantry(epoch: number): Kit {
  const k = new Kit();
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
  const robe = epoch <= 1 ? '#f2ecdc' : epoch === 2 ? '#7a5a3a' : '#f4f0e6';
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
  } else {
    k.cone(0.06, 0.17, 4, TEAM, 0, 0.55, 0);
    k.team(k.cone(0.065, 0.17, 4, TEAM, 0, 0.55, 0));
    k.box(0.02, 0.1, 0.006, '#e2b23c', 0, 0.58, 0.04);
  }
  const g = k.group(0.12, SHOULDER - 0.18, 0.03, arm);
  g.rotation.x = 0.3;
  k.cyl(0.012, 0.012, 0.62, 4, epoch === 2 ? WOOD : '#e2b23c', 0, -0.25, 0, g);
  if (epoch === 2) {
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
  // Mounted heroes: a paladin on a white horse, a general on a black one.
  const saddle = horse(k, epoch === 2 ? '#ecebe6' : '#2a2421', { color: TEAM, team: true });
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

const MAKERS: Record<UnitType, (epoch: number) => Kit> = { citizen, infantry, ranged, cavalry, siege, priest, hero };

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

const cache = new Map<string, THREE.BufferGeometry>();

/** The baked geometry of a unit line in an epoch (team parts left white for tinting). */
export function unitGeometry(type: UnitType, epoch: number): THREE.BufferGeometry {
  const key = `${type}:${epoch}`;
  let g = cache.get(key);
  if (!g) {
    g = bake(MAKERS[type](epoch).root);
    cache.set(key, g);
  }
  return g;
}

/** The same model with the team color baked in (for portraits). */
export function unitGeometryColored(type: UnitType, epoch: number, color: string): THREE.BufferGeometry {
  return bake(MAKERS[type](epoch).root, color);
}
