import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { T_WATER } from '../sim/types';
import { TIDE_CAUSEWAY } from '../sim/tides';
import { WATER_Y } from './water';

/**
 * The causeways under the tide (#739): while the water covers a causeway, its pale paving shows just under the surface, a road you can
 * see and not walk. Bared, it is drawn by the ground itself (`TerrainView`). One instanced mesh, refreshed when the tide moves.
 */
export class TidesView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private seen = -1;

  private static material = new THREE.MeshStandardMaterial({ color: '#c9bea6', roughness: 0.9, flatShading: true, transparent: true, opacity: 0.7 });
  private static geometry = (() => {
    const g = new THREE.BoxGeometry(1, 0.06, 1);
    g.translate(0, -0.03, 0);
    return g;
  })();

  /** `seen`: whether the viewer has seen a point, so no causeway shows through the unexplored. */
  update(s: GameState, seen: (x: number, y: number) => boolean): void {
    if (!s.tidal) {
      if (this.mesh) this.clear();
      return;
    }
    const key = (s.tideTurns ?? 0) * 7 + s.blockVersion + (s.tick >> 6) * 1e7;
    if (key === this.seen) return;
    this.seen = key;
    const under: number[] = [];
    for (let i = 0; i < s.tidal.length; i++) if (s.tidal[i] === TIDE_CAUSEWAY && s.terrain[i] === T_WATER && seen((i % s.w) + 0.5, Math.floor(i / s.w) + 0.5)) under.push(i);
    this.clear();
    if (!under.length) return;
    const mesh = new THREE.InstancedMesh(TidesView.geometry, TidesView.material, under.length);
    const m = new THREE.Matrix4();
    under.forEach((t, j) => {
      m.makeTranslation((t % s.w) + 0.5, WATER_Y - 0.07, Math.floor(t / s.w) + 0.5);
      mesh.setMatrixAt(j, m);
    });
    mesh.receiveShadow = true;
    mesh.renderOrder = 0;
    this.mesh = mesh;
    this.group.add(mesh);
  }

  private clear(): void {
    if (!this.mesh) return;
    this.group.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = null;
  }
}
