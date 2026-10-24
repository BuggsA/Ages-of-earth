// The tower line's looks: a Watch Tower of every epoch (rows, Bronze to Industrial) at each level (columns: plain, Guard Tower,
// Keep, Bastion). `npx vite --port 5199 &`, then open /scripts/gallery/towers.html (shoot.mjs's browser flags work here too).
import * as THREE from 'three';
import { buildingGeometry } from '../../src/render/buildingModels';
const W = 1600, H = 1000;
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setClearColor(0x8fa8b8);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(-5, 10, 6); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6f8a55 })));
const epochs = [1, 2, 3, 4];
for (const [row, e] of epochs.entries()) for (let level = 0; level <= 3; level++) {
  const m = new THREE.Mesh(buildingGeometry('tower', e, '#cc3333', level), new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.position.set((level - 1.5) * 4, 0, (row - 1.5) * 3.6);
  scene.add(m);
}
const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 500);
cam.position.set(0, 14, 18); cam.lookAt(0, 0.6, 0);
r.render(scene, cam);
(window as any).done = true;
