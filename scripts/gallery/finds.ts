// Finds gallery for the look lane: each kind fresh (top row) and picked-over (bottom row), at the in-game scale.
import * as THREE from 'three';
import { findGeometry, FIND_KINDS } from '../../src/render/findsView';
const bakedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const W = 1600, H = 700;
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setClearColor(0x8fa8b8);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.6));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(-5, 10, 6); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6f8a55 })));
FIND_KINDS.forEach((k, i) => [false, true].forEach((t, j) => {
  const m = new THREE.Mesh(findGeometry(k, t), bakedMaterial);
  m.scale.setScalar(1.6); m.rotation.y = 0.4;
  m.position.set((i - (FIND_KINDS.length - 1) / 2) * 2.4, 0, j * 2.4 - 1.2);
  scene.add(m);
}));
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
cam.position.set(0, 9, 11); cam.lookAt(0, 0.2, 0);
r.render(scene, cam);
(window as any).done = true;
