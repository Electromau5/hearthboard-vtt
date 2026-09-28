import * as THREE from 'three';

/**
 * A Deep One's head, built procedurally for the walkthrough viewer (client
 * only — three.js). It is meant to be seen through a hole a hand-span wide, so
 * the detail is spent where a peering creature shows itself: one bulging,
 * unblinking fish eye, wet scales around it, the gill slits behind.
 *
 * The returned group's origin is the centre of the eye that does the peering
 * and its +Z points out of that eye; the head itself trails away behind it
 * along -Z, turned side-on the way a fish looks at something. `eye` turns to
 * follow a target with `lookAt`.
 */
export function createDeepOneHead(): { group: THREE.Group; eye: THREE.Object3D; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

  const scales = keep(scaleTexture());
  const skin = keep(new THREE.MeshPhysicalMaterial({
    color: 0x6a7560, map: scales, bumpMap: scales, bumpScale: 2,
    roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.2,   // slick with seawater
  }));
  const belly = keep(new THREE.MeshPhysicalMaterial({ color: 0x5c604c, roughness: 0.5, clearcoat: 0.6 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: 0x140606, roughness: 0.7 }));
  // Raw, wet membrane around the eyes and in the gills.
  const flesh = keep(new THREE.MeshPhysicalMaterial({ color: 0x2c1512, roughness: 0.5, clearcoat: 0.8 }));
  const eyeball = keep(new THREE.MeshPhysicalMaterial({ color: 0x8a8f6a, roughness: 0.1, clearcoat: 1 }));
  // Eyeshine: the iris glows faintly, so the eye shows in the dark before the torch finds it.
  const iris = keep(new THREE.MeshPhysicalMaterial({
    color: 0xa89a3a, emissive: 0x7d8a1e, emissiveIntensity: 0.8, roughness: 0.15, clearcoat: 1,
  }));
  const pupil = keep(new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.05, clearcoat: 1 }));

  // The head is modelled facing +Z (snout forward) with the eyes on its flanks,
  // then turned so its right eye faces the group's +Z.
  const head = new THREE.Group();
  group.add(head);

  // Skull: a stretched sphere, flattened at the flanks, the jaw heavy and underslung.
  const skullGeo = keep(new THREE.SphereGeometry(1, 48, 32));
  const p = skullGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i);
    const z = p.getZ(i);
    x *= 1 - 0.18 * Math.max(0, y);                  // narrower over the crown
    if (y < 0) { x *= 1.12; y *= 1 + 0.25 * Math.max(0, z); }   // jowls, deeper toward the mouth
    const bumps = 1 + 0.015 * Math.sin(x * 23 + z * 17) * Math.sin(y * 19);
    p.setXYZ(i, x * 0.12 * bumps, y * 0.13 * bumps, z * 0.19 * bumps);
  }
  skullGeo.computeVertexNormals();
  const skull = new THREE.Mesh(skullGeo, skin);
  head.add(skull);

  const chinGeo = keep(new THREE.SphereGeometry(1, 32, 16));
  const chin = new THREE.Mesh(chinGeo, belly);
  chin.scale.set(0.1, 0.05, 0.14);
  chin.position.set(0, -0.1, 0.05);
  head.add(chin);

  // A wide lipless mouth, turned down at the corners.
  const mouthGeo = keep(new THREE.TorusGeometry(0.1, 0.009, 8, 32, Math.PI * 0.9));
  const mouth = new THREE.Mesh(mouthGeo, dark);
  mouth.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.05);
  mouth.position.set(0, -0.075, 0.08);
  head.add(mouth);

  // Gill slits behind each eye.
  const gillGeo = keep(new THREE.BoxGeometry(0.006, 0.07, 0.012));
  for (const side of [-1, 1]) {
    for (let g = 0; g < 3; g++) {
      const gill = new THREE.Mesh(gillGeo, flesh);
      gill.position.set(side * 0.112, -0.03, -0.03 - g * 0.028);
      gill.rotation.set(0.15, 0, side * 0.1);
      head.add(gill);
    }
  }

  // Low crest of spines along the crown.
  const spineGeo = keep(new THREE.ConeGeometry(0.008, 0.07, 6));
  for (let s = 0; s < 6; s++) {
    const spine = new THREE.Mesh(spineGeo, skin);
    const z = 0.1 - s * 0.05;
    spine.position.set(0, 0.125 + 0.01 * Math.cos(s), z);
    spine.rotation.x = -0.5;
    head.add(spine);
  }

  // Eyes: a glossy ball with iris and pupil caps, ringed by a thick lid.
  // Almost all pupil, like a fish's: a thin sickly-gold ring around a black well.
  const ballGeo = keep(new THREE.SphereGeometry(0.04, 32, 24));
  const irisGeo = keep(new THREE.SphereGeometry(0.0405, 32, 12, 0, Math.PI * 2, 0, 1.05));
  const pupilGeo = keep(new THREE.SphereGeometry(0.0409, 32, 10, 0, Math.PI * 2, 0, 0.8));
  const lidGeo = keep(new THREE.TorusGeometry(0.039, 0.011, 10, 32));
  const eyeAt = new THREE.Vector3(0.1, 0.035, 0.07);
  let peeringEye: THREE.Object3D | null = null;
  for (const side of [-1, 1]) {
    const socket = new THREE.Group();
    socket.position.set(side * eyeAt.x, eyeAt.y, eyeAt.z);
    head.add(socket);
    const lid = new THREE.Mesh(lidGeo, flesh);
    lid.rotation.y = side * Math.PI / 2;
    lid.position.x = side * 0.008;
    socket.add(lid);

    const eye = new THREE.Group();
    eye.add(new THREE.Mesh(ballGeo, eyeball));
    // Caps are built around +Y; tip them onto +Z, the direction lookAt aims.
    const irisCap = new THREE.Mesh(irisGeo, iris);
    irisCap.rotation.x = Math.PI / 2;
    eye.add(irisCap);
    const pupilCap = new THREE.Mesh(pupilGeo, pupil);
    pupilCap.rotation.x = Math.PI / 2;
    eye.add(pupilCap);
    eye.rotation.y = side * Math.PI / 2;   // resting: staring straight out sideways
    socket.add(eye);
    if (side === 1) peeringEye = eye;
  }

  // Turn the head so the right eye's outward axis (+X) becomes the group's +Z,
  // then shift it so that eye sits on the origin.
  head.rotation.y = -Math.PI / 2;
  head.updateMatrix();
  head.position.copy(eyeAt.clone().applyMatrix4(head.matrix).negate());

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = true; }
  });

  return {
    group,
    eye: peeringEye!,
    dispose: () => { for (const d of disposables) d.dispose(); },
  };
}

/** Overlapping fish scales, dark-edged, painted once onto a canvas. */
function scaleTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#3a4434';
  g.fillRect(0, 0, size, size);
  const r = 9;
  for (let row = -1; row < size / (r * 0.8) + 1; row++) {
    const y = row * r * 0.8;
    const shift = row % 2 ? r : 0;
    for (let x = -r; x < size + r; x += r * 2) {
      const cx = x + shift;
      const grad = g.createRadialGradient(cx, y - r * 0.3, 1, cx, y, r);
      const tone = 45 + Math.floor(Math.random() * 35);
      grad.addColorStop(0, `rgb(${tone + 25},${tone + 32},${tone + 12})`);
      grad.addColorStop(0.75, `rgb(${tone - 10},${tone},${tone - 18})`);
      grad.addColorStop(1, 'rgb(10,14,9)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, y, r, 0, Math.PI);
      g.fill();
    }
  }
  // Blotches of rot and pallor over the scales.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size, y = Math.random() * size, rad = 8 + Math.random() * 30;
    const blot = g.createRadialGradient(x, y, 0, x, y, rad);
    blot.addColorStop(0, Math.random() < 0.5 ? 'rgba(20,16,10,0.55)' : 'rgba(150,160,120,0.25)');
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = blot;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
