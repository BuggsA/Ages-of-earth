import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Overlays } from '../src/render/overlays';

function marksOf(overlays: Overlays): THREE.InstancedMesh {
  return overlays.group.children.find((o) => o.renderOrder === 12) as THREE.InstancedMesh;
}

describe('health bar quarter marks', () => {
  it('keeps quarters fixed across health changes and aligned with a rotated camera', () => {
    const overlays = new Overlays();
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.set(0.6, 0.9, 0.2);
    camera.updateMatrixWorld();
    const at = new THREE.Vector3(3, 5, 7);
    const q = camera.getWorldQuaternion(new THREE.Quaternion());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    for (const frac of [1, 0.6, 0.1, 0]) {
      overlays.setBars([{ at, width: 2, frac }], camera);
      const marks = marksOf(overlays);
      expect(marks.count).toBe(3);
      for (let j = 0; j < 3; j++) {
        const matrix = new THREE.Matrix4();
        marks.getMatrixAt(j, matrix);
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        matrix.decompose(position, rotation, scale);
        const expected = at.clone().addScaledVector(right, (j - 1) * 0.5);
        expect(position.distanceTo(expected)).toBeLessThan(0.00001);
        expect(Math.abs(rotation.dot(q))).toBeCloseTo(1);
        expect(scale.x).toBeCloseTo(0.03);
        expect(scale.y).toBeCloseTo(0.07);
      }
    }
    expect(at.toArray()).toEqual([3, 5, 7]);
  });

  it('caps instances and clears all marks when bars disappear', () => {
    const overlays = new Overlays();
    const camera = new THREE.PerspectiveCamera();
    overlays.setBars(Array.from({ length: 401 }, () => ({ at: new THREE.Vector3(), width: 1, frac: 1 })), camera);
    expect(marksOf(overlays).count).toBe(1200);
    overlays.setBars([], camera);
    expect(marksOf(overlays).count).toBe(0);
  });
});
