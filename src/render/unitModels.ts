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
    // A flat cap and a team neckerchief.
    k.cyl(0.072, 0.078, 0.035, 10, '#3a3a40', 0, 0.54, 0);
    k.box(0.1, 0.012, 0.06, '#3a3a40', 0, 0.545, 0.06);
    k.team(k.box(0.12, 0.03, 0.08, TEAM, 0, 0.41, 0.02));
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
  const sail = k.box(sailW, h * 0.5, 0.015, team ? TEAM : '#efe8d8', 0, y + h * 0.33, z + 0.015);
  if (team) k.team(sail);
  else k.team(k.box(sailW, 0.05, 0.018, TEAM, 0, y + h * 0.55, z + 0.016));
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
  net(k, -0.3, 0.5);
  for (let i = 0; i < 2; i++) k.cyl(0.05, 0.045, 0.08, 6, '#8a6440', -0.08 + i * 0.12, 0.06, -0.38);
  return k;
}

function warship(epoch: number): Kit {
  const k = new Kit();
  if (epoch <= 1) {
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
    k.box(0.5, 0.025, 1.3, GOLD, 0, 0.16, -0.05);
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
  return k;
}

function transport(epoch: number): Kit {
  const k = new Kit();
  if (epoch <= 1) {
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
  if (epoch === 3) mast(k, -0.35, 0.8, 0.45, false, 0.16);
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

const MAKERS: Record<UnitType, (epoch: number) => Kit> = { citizen, infantry, ranged, cavalry, siege, priest, hero, fisher, warship, transport, fighter, bomber };


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
