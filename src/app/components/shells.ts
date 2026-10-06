import * as THREE from 'three';

/**
 * Spent cases thrown from a gun's ejection port into the level: they tumble
 * out to the right, bounce on the floor with a tink, and lie where they stop.
 * The oldest is picked up again once there are MAX on the ground.
 */

const MAX = 60;
const GRAVITY = 9.8;

export type Shells = {
  /** A case leaving `at` (world) along `dir`, `shell` its radius and length. */
  throw: (at: THREE.Vector3, dir: THREE.Vector3, shell: [number, number]) => void;
  /** `floorAt` gives the floor's height under a point; `onTink` is called on a case's first few bounces. */
  update: (dt: number, floorAt: (x: number, z: number) => number, onTink: (loud: number) => void) => void;
  dispose: () => void;
};

export function createShells(scene: THREE.Scene): Shells {
  // A unit case, standing along Y: scaled to each calibre.
  const geo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc09040, metalness: 0.45, roughness: 0.35 });
  const pool: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; resting: boolean; bounces: number; radius: number }[] = [];
  let next = 0;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  return {
    throw(at, dir, [radius, length]) {
      let c = pool[next];
      if (!c) {
        c = { mesh: new THREE.Mesh(geo, mat), vel: new THREE.Vector3(), spin: new THREE.Vector3(), resting: false, bounces: 0, radius };
        c.mesh.castShadow = true;
        scene.add(c.mesh);
        pool[next] = c;
      }
      next = (next + 1) % MAX;
      c.mesh.position.copy(at);
      c.mesh.scale.set(radius, length, radius);
      c.mesh.quaternion.setFromEuler(e.set(0, 0, Math.PI / 2));
      c.vel.copy(dir).multiplyScalar(1.5 + Math.random() * 0.8);
      c.vel.x += (Math.random() - 0.5) * 0.4;
      c.vel.y += 0.4 + Math.random() * 0.5;
      c.vel.z += (Math.random() - 0.5) * 0.4;
      c.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 12, 18 + Math.random() * 20);
      c.resting = false;
      c.bounces = 0;
      c.radius = radius;
      c.mesh.visible = true;
    },
    update(dt, floorAt, onTink) {
      for (const c of pool) {
        if (!c || c.resting) continue;
        c.vel.y -= GRAVITY * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.quaternion.multiply(q.setFromEuler(e.set(c.spin.x * dt, c.spin.y * dt, c.spin.z * dt)));
        const floor = floorAt(c.mesh.position.x, c.mesh.position.z);
        if (c.mesh.position.y > floor + c.radius) continue;
        // On the floor: bounce, lose most of it, and at last lie on its side.
        c.mesh.position.y = floor + c.radius;
        if (c.vel.y < -0.4 && c.bounces < 3) onTink(Math.min(1, -c.vel.y / 4));
        c.bounces++;
        c.vel.y = -c.vel.y * 0.3;
        c.vel.x *= 0.5;
        c.vel.z *= 0.5;
        c.spin.multiplyScalar(0.5);
        if (c.vel.length() < 0.25 || c.bounces > 5) {
          c.resting = true;
          // On its side, turned however it came to rest.
          c.mesh.quaternion.setFromEuler(e.set(0, Math.random() * Math.PI * 2, Math.PI / 2, 'YXZ'));
        }
      }
    },
    dispose() {
      for (const c of pool) if (c) scene.remove(c.mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
