import * as THREE from 'three';
import { buildingGeometry } from '../render/buildingModels';
import { unitGeometryColored } from '../render/unitModels';
import type { BuildingType, UnitType } from '../sim/types';

/**
 * Pictures of the 3D models for the interface (portraits, buttons, the queue), rendered once each with
 * a small offscreen renderer and kept as images, so the panels show the very same models as the map.
 */

const SIZE = 160;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 80);
const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });

function setup(): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(SIZE, SIZE, false);
  r.toneMapping = THREE.NeutralToneMapping;
  scene.add(new THREE.HemisphereLight('#e2f1ff', '#d9c39a', 1.3));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.6);
  sun.position.set(-3, 6, 4);
  scene.add(sun, new THREE.AmbientLight('#cfe0ff', 0.35));
  return r;
}

function picture(key: string, geo: THREE.BufferGeometry, tilt: number, zoom: number, yaw: number): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (failed) return '';
  try {
    renderer ??= setup();
  } catch {
    failed = true;
    return '';
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = new THREE.Vector3(0, tilt, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, (radius / Math.tan((camera.fov * Math.PI) / 360)) / zoom);
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(mesh);
  cache.set(key, url);
  return url;
}

export function unitPicture(type: UnitType, epoch: number, color: string): string {
  const key = `u:${type}:${epoch}:${color}`;
  if (cache.has(key)) return cache.get(key)!;
  const geo = unitGeometryColored(type, epoch, color);
  const url = picture(key, geo, 0.25, 1.05, -0.55);
  geo.dispose();
  return url;
}

export function buildingPicture(type: BuildingType, epoch: number, color: string): string {
  return picture(`b:${type}:${epoch}:${color}`, buildingGeometry(type, epoch, color), 0.75, 1.0, -0.6);
}
