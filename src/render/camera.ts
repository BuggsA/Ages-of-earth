import * as THREE from 'three';

/**
 * The strategy camera: it looks down at a point on the ground from a distance that zooms, tilting
 * steeper as it pulls back. It pans with the keyboard, the screen edges and dragging, turns with Q/E,
 * glides to wherever it is sent, and never leaves the map.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  private goal = new THREE.Vector3();
  distance = 26;
  private goalDistance = 26;
  yaw = 0;
  private goalYaw = 0;
  private bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
  /** Ground height under the target, so hills don't swallow the view. */
  groundAt: (x: number, z: number) => number = () => 0;

  static readonly MIN = 9;
  static readonly MAX = 62;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
  }

  setBounds(w: number, h: number): void {
    this.bounds = { minX: 2, maxX: w - 2, minZ: 2, maxZ: h - 2 };
  }

  /** Glide (or jump) to look at a point. */
  focus(x: number, z: number, jump = false): void {
    this.goal.set(x, 0, z);
    this.clamp(this.goal);
    if (jump) this.target.copy(this.goal);
  }

  /** Pan by a screen-relative amount of world units (right, forward). */
  pan(right: number, forward: number): void {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    this.goal.x += right * c - forward * s;
    this.goal.z += -right * s - forward * c;
    this.clamp(this.goal);
  }

  zoom(factor: number): void {
    this.goalDistance = Math.max(CameraRig.MIN, Math.min(CameraRig.MAX, this.goalDistance * factor));
  }

  rotate(delta: number): void {
    this.goalYaw += delta;
  }

  resetYaw(): void {
    this.goalYaw = Math.round(this.goalYaw / (Math.PI * 2)) * Math.PI * 2;
  }

  get zoomT(): number {
    return (this.distance - CameraRig.MIN) / (CameraRig.MAX - CameraRig.MIN);
  }

  /** Pan speed in world units per second, scaled with the zoom. */
  get panSpeed(): number {
    return 10 + this.distance * 0.9;
  }

  private clamp(v: THREE.Vector3): void {
    v.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, v.x));
    v.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, v.z));
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    this.target.lerp(this.goal, k);
    this.distance += (this.goalDistance - this.distance) * (1 - Math.exp(-dt * 9));
    this.yaw += (this.goalYaw - this.yaw) * (1 - Math.exp(-dt * 8));
    const ground = Math.max(0, this.groundAt(this.target.x, this.target.z));
    this.target.y += (ground - this.target.y) * k;
    // Close in, the view tilts toward the horizon; far out it looks more straight down.
    const pitch = 0.8 + this.zoomT * 0.35;
    const d = this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(pitch) * d,
      this.target.y + Math.sin(pitch) * d,
      this.target.z + Math.cos(this.yaw) * Math.cos(pitch) * d,
    );
    this.camera.lookAt(this.target);
  }

  /** Where the four screen corners meet the ground (for the minimap's view box). */
  footprint(): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.target.y);
    const hit = new THREE.Vector3();
    for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
      if (ray.ray.intersectPlane(plane, hit)) out.push({ x: hit.x, z: hit.z });
      else {
        // Looking above the horizon: clamp to far along the view direction.
        const dir = ray.ray.direction.clone().setY(0).normalize().multiplyScalar(this.distance * 3);
        out.push({ x: this.target.x + dir.x, z: this.target.z + dir.z });
      }
    }
    return out;
  }
}
