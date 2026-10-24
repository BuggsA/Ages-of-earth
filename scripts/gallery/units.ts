// Unit gallery for the look lane: every unit line (rows; ?g=land or ?g=sea for ships and aircraft) across the five epochs (columns), one people's mark with ?c=<civ>.
import * as THREE from 'three';
import { unitGeometryColored } from '../../src/render/unitModels';
import { UNIT_TYPES } from '../../src/sim/data';
import type { CivId } from '../../src/sim/types';
const q = new URLSearchParams(location.search);
const civ = (q.get('c') ?? undefined) as CivId | undefined;
const group = q.get('g') ?? 'land';
const LAND = ['citizen', 'infantry', 'ranged', 'cavalry', 'siege', 'priest', 'hero', 'trader', 'wagon'];
const GEAR = group === 'gear'; // ?g=gear: foot soldiers, a row per people (Greek, Roman, Chinese, Egyptian, Mongol, Briton), epochs 1-3, close and low
const CIVS: CivId[] = ['greeks', 'romans', 'chinese', 'egyptians', 'mongols', 'britons'];
const types = UNIT_TYPES.filter((t) => (LAND.includes(t) ? 'land' : 'sea') === group);
const W = 1600, H = 1000;
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setClearColor(0x8fa8b8);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(-5, 10, 6); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6f8a55 })));
const sp = group === 'land' ? 2.2 : 3.6;
if (GEAR) {
  CIVS.forEach((c, row) => [1, 2, 3].forEach((e, col) => {
    for (const [i, a] of [0, 1].entries()) { // front-left and rear-right three-quarter views side by side
      const m = new THREE.Mesh(unitGeometryColored('infantry', e, '#cc3333', c), new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.set((col - 1) * 1.3 + (i - 0.5) * 0.55 - 0.1, 0, (row - 2.5) * 1.45);
      m.rotation.y = a ? -2.4 : 0.6;
      scene.add(m);
    }
  }));
}
types.forEach((t, row) => {
  if (GEAR) return;
  for (let e = 0; e < 5; e++) {
    const m = new THREE.Mesh(unitGeometryColored(t, e, '#cc3333', civ), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.set((e - 2) * sp, 0, (row - (types.length - 1) / 2) * sp);
    scene.add(m);
  }
});
const cam = new THREE.PerspectiveCamera(GEAR ? 24 : group === 'land' ? 25 : 34, W / H, 0.1, 500);
if (GEAR) { cam.position.set(0, 9, 13.5); cam.lookAt(0, 0.1, 0.3); } else { cam.position.set(0, 24, 21); cam.lookAt(0, 0, 0); }
r.render(scene, cam);
(window as any).done = true;
