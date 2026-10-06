import * as THREE from 'three';

/**
 * Where a shot lands in a walkthrough: a hole left in walls, floors and
 * ceilings (the oldest is reused once there are MAX), and a puff of dust and
 * grit at every hit, furniture included. Unlit, so they add no light cost.
 */

const MAX = 60;
const PUFFS = 8;

export type BulletHoles = {
  /** A hit at `point`; `normal` (world) when it struck a surface that keeps a hole. */
  hit: (point: THREE.Vector3, normal: THREE.Vector3 | null) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

export function createBulletHoles(scene: THREE.Scene): BulletHoles {
  const texture = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    draw(c.getContext('2d')!);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  // A dark hole with a ring of chipped, lighter surface round it.
  const holeTex = texture(ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(5,4,3,1)');
    g.addColorStop(0.28, 'rgba(12,10,8,0.95)');
    g.addColorStop(0.42, 'rgba(120,105,90,0.55)');
    g.addColorStop(1, 'rgba(60,50,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const puffTex = texture(ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(190,175,150,0.8)');
    g.addColorStop(1, 'rgba(120,110,95,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const holeGeo = new THREE.PlaneGeometry(0.05, 0.05);
  const holeMat = new THREE.MeshBasicMaterial({
    map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
  });
  const holes: THREE.Mesh[] = [];
  let next = 0;

  const puffs = Array.from({ length: PUFFS }, () => {
    const mat = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.visible = false;
    scene.add(s);
    return { s, mat, age: 1 };
  });
  let nextPuff = 0;
  const up = new THREE.Vector3(0, 0, 1);

  return {
    hit(point, normal) {
      if (normal) {
        let m = holes[next];
        if (!m) {
          m = new THREE.Mesh(holeGeo, holeMat);
          scene.add(m);
          holes[next] = m;
        }
        next = (next + 1) % MAX;
        m.position.copy(point).addScaledVector(normal, 0.002);
        m.quaternion.setFromUnitVectors(up, normal);
        m.rotateZ(Math.random() * Math.PI * 2);
        m.scale.setScalar(0.8 + Math.random() * 0.4);
      }
      const p = puffs[nextPuff];
      nextPuff = (nextPuff + 1) % PUFFS;
      p.s.position.copy(point);
      if (normal) p.s.position.addScaledVector(normal, 0.04);
      p.age = 0;
      p.s.visible = true;
    },
    update(dt) {
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.age += dt / 0.45;
        if (p.age >= 1) { p.s.visible = false; continue; }
        p.s.scale.setScalar(0.06 + p.age * 0.22);
        p.mat.opacity = 0.8 * (1 - p.age);
      }
    },
    dispose() {
      for (const m of holes) scene.remove(m);
      for (const p of puffs) { scene.remove(p.s); p.mat.dispose(); }
      holeGeo.dispose();
      holeMat.dispose();
      holeTex.dispose();
      puffTex.dispose();
    },
  };
}
