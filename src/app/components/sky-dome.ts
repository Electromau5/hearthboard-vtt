import * as THREE from 'three';

/**
 * A sky for levels with a time of day (see src/lib/weather.ts): a gradient
 * from horizon to zenith, a soft glow round the sun (or moon), and stars that
 * fade in as night comes. It follows the camera, sits just inside its far
 * plane, and ignores fog, so it always reads as distance.
 */
export type SkyDome = {
  mesh: THREE.Mesh;
  /** `sunDir` toward the sun, unit length; `stars` 0..1. */
  set: (zenith: THREE.Color, horizon: THREE.Color, sunColor: THREE.Color, sunDir: THREE.Vector3, stars: number) => void;
  dispose: () => void;
};

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;   // pinned to the far plane
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float stars;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // Overhead to horizon; below it, the haze over the sea.
    vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
    if (h < 0.0) col = mix(horizon, horizon * 0.55, clamp(-h * 4.0, 0.0, 1.0));
    // The sun's glow: a wide warm bloom and a tight core.
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += sunColor * (pow(s, 8.0) * 0.35 + pow(s, 400.0) * 1.5);
    // Stars: sparse cells, brighter the higher they are, gone near the horizon.
    if (stars > 0.0 && h > 0.0) {
      vec3 cell = floor(d * 220.0);
      float r = hash(cell);
      if (r > 0.997) col += vec3(0.85, 0.88, 1.0) * stars * smoothstep(0.0, 0.25, h) * (r - 0.997) * 300.0;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSkyDome(radius: number): SkyDome {
  const geo = new THREE.SphereGeometry(radius, 48, 24);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      stars: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    set(zenith, horizon, sunColor, sunDir, stars) {
      mat.uniforms.zenith.value.copy(zenith);
      mat.uniforms.horizon.value.copy(horizon);
      mat.uniforms.sunColor.value.copy(sunColor);
      mat.uniforms.sunDir.value.copy(sunDir);
      mat.uniforms.stars.value = stars;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
