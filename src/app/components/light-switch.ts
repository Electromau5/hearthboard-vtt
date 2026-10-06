import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * A period push-button light switch for a walkthrough wall (see LightSwitch
 * in src/lib/walkthrough.ts): a brass plate on a dark wooden block, a pearl
 * button above for on and a black one below for off. Whichever was pressed
 * last sits in. Built facing +Z; turn it to face out of the wall.
 */

export type LightSwitchModel = {
  group: THREE.Group;
  set: (on: boolean) => void;
  dispose: () => void;
};

const OUT = 0.009;    // a button standing proud of the plate
const IN = 0.0035;    // pressed in

export function createLightSwitch(): LightSwitchModel {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const m = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };

  const group = new THREE.Group();
  const block = new THREE.Mesh(
    g(new RoundedBoxGeometry(0.1, 0.15, 0.018, 3, 0.006)),
    m(new THREE.MeshStandardMaterial({ color: 0x2e1d12, roughness: 0.6 })),
  );
  block.position.z = 0.009;
  const plate = new THREE.Mesh(
    g(new RoundedBoxGeometry(0.078, 0.122, 0.004, 3, 0.0018)),
    m(new THREE.MeshStandardMaterial({ color: 0x8a6630, metalness: 0.6, roughness: 0.45 })),
  );
  plate.position.z = 0.02;
  group.add(block, plate);

  // Two screws, top and bottom.
  const screwGeo = g(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 12).rotateX(Math.PI / 2));
  for (const y of [0.048, -0.048]) {
    const screw = new THREE.Mesh(screwGeo, plate.material);
    screw.position.set(0, y, 0.0225);
    group.add(screw);
  }

  const buttonGeo = g(new THREE.CylinderGeometry(0.0085, 0.0085, 0.014, 20).rotateX(Math.PI / 2));
  const onButton = new THREE.Mesh(buttonGeo, m(new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.25 })));
  const offButton = new THREE.Mesh(buttonGeo, m(new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.3 })));
  onButton.position.set(0, 0.016, 0);
  offButton.position.set(0, -0.016, 0);
  group.add(onButton, offButton);

  const set = (on: boolean) => {
    onButton.position.z = 0.022 + (on ? IN : OUT) - 0.007;
    offButton.position.z = 0.022 + (on ? OUT : IN) - 0.007;
  };
  set(false);

  return {
    group,
    set,
    dispose() {
      for (const x of geos) x.dispose();
      for (const x of mats) x.dispose();
    },
  };
}
