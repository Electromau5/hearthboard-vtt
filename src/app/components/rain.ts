import * as THREE from 'three';

/**
 * Rain for levels with weather (see src/lib/weather.ts): streaks falling in a
 * box that travels with the investigator, driven sideways by the wind, and a
 * cover map so no drop falls through a roof or a deck — under the wheelhouse
 * or below decks it is dry, though you hear it overhead.
 *
 * Also the sound of it, made rather than recorded: filtered noise for the
 * downpour, a low roar for a storm's wind, muffled when there is a roof over
 * your head; and thunder, a burst of shaped low rumble.
 */

/** The box of rain round the investigator, metres. */
const BOX = 28;
const HIGH = 16;
/** Most drops at once (a storm). */
export const MAX_DROPS = 9000;
const FALL = 9.5;        // metres a second
const STREAK = 0.45;     // metres long at that speed

export type Cover = {
  /** Height of the highest surface over each cell (R channel, metres); -1000 where open to the sky. */
  texture: THREE.DataTexture;
  /** World XZ of the map's corner and its size. */
  min: THREE.Vector2;
  size: THREE.Vector2;
  /** Height of whatever is over (x, z), or -Infinity. */
  at: (x: number, z: number) => number;
};

/**
 * Measures what covers each half-metre cell of `bounds` by casting down from
 * above it, once, when the level loads.
 */
export function buildCover(bounds: THREE.Box3, topAt: (x: number, z: number, from: number) => number): Cover {
  const cell = 0.5;
  const nx = Math.min(256, Math.ceil((bounds.max.x - bounds.min.x) / cell));
  const nz = Math.min(256, Math.ceil((bounds.max.z - bounds.min.z) / cell));
  const data = new Float32Array(nx * nz * 4);
  const top = bounds.max.y + 1;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const h = topAt(bounds.min.x + (i + 0.5) * cell, bounds.min.z + (j + 0.5) * cell, top);
      data[(j * nx + i) * 4] = h === -Infinity ? -1000 : h;
    }
  }
  const texture = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  const min = new THREE.Vector2(bounds.min.x, bounds.min.z);
  const size = new THREE.Vector2(nx * cell, nz * cell);
  return {
    texture, min, size,
    at(x, z) {
      const i = Math.floor((x - min.x) / cell), j = Math.floor((z - min.y) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return -Infinity;
      const h = data[(j * nx + i) * 4];
      return h <= -999 ? -Infinity : h;
    },
  };
}

const VERT = /* glsl */ `
  attribute vec4 seed;          // xyz: place in the box, w: 0 = head of the streak, 1 = tail
  uniform vec3 eye;
  uniform float time;
  uniform vec2 wind;
  uniform sampler2D cover;
  uniform vec2 coverMin;
  uniform vec2 coverSize;
  varying float vKeep;
  varying float vAlong;
  const float BOX = ${BOX.toFixed(1)};
  const float HIGH = ${HIGH.toFixed(1)};
  const float FALL = ${FALL.toFixed(2)};
  const float STREAK = ${STREAK.toFixed(2)};
  void main() {
    // Falling, and wrapping round a box that follows the eye without the drops moving with it.
    float y = eye.y + HIGH * 0.5 - mod(seed.y * HIGH + time * FALL, HIGH);
    float fallen = (eye.y + HIGH * 0.5 - y) / FALL;
    vec2 base = seed.xz * BOX + wind * fallen;
    vec2 xz = base + BOX * floor((eye.xz - base) / BOX + 0.5);
    // The tail trails up and back along the drop's path.
    vec3 vel = normalize(vec3(wind.x, -FALL, wind.y));
    vec3 p = vec3(xz.x, y, xz.y) - vel * STREAK * seed.w;
    // Dry under anything overhead.
    vec2 uv = (p.xz - coverMin) / coverSize;
    float roof = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? -1000.0 : texture2D(cover, uv).r;
    vKeep = step(roof, p.y) * step(0.0, p.y);
    vAlong = seed.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 tint;
  uniform float opacity;
  varying float vKeep;
  varying float vAlong;
  void main() {
    if (vKeep < 0.5) discard;
    gl_FragColor = vec4(tint, opacity * (1.0 - vAlong * 0.7));
  }
`;

export type RainFall = {
  object: THREE.LineSegments;
  setCover: (cover: Cover) => void;
  /** `drops` how many fall now; `wind` m/s sideways; `tint` the light they catch. */
  update: (dt: number, eye: THREE.Vector3, drops: number, wind: number, tint: THREE.Color) => void;
  dispose: () => void;
};

export function createRain(): RainFall {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(MAX_DROPS * 2 * 4);
  for (let i = 0; i < MAX_DROPS; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    seeds.set([x, y, z, 0, x, y, z, 1], i * 8);
  }
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  // Positions are made in the shader; three still wants an attribute to size the draw.
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_DROPS * 2 * 3), 3));
  geo.setDrawRange(0, 0);
  const empty = new THREE.DataTexture(new Float32Array([-1000, 0, 0, 0]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  empty.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      eye: { value: new THREE.Vector3() },
      time: { value: 0 },
      wind: { value: new THREE.Vector2() },
      cover: { value: empty },
      coverMin: { value: new THREE.Vector2() },
      coverSize: { value: new THREE.Vector2(1, 1) },
      tint: { value: new THREE.Color(0xb0bcc8) },
      opacity: { value: 0.5 },
    },
    transparent: true,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geo, mat);
  object.frustumCulled = false;
  let time = 0;
  // The wind turns slowly about the compass, so the slant shifts.
  let heading = Math.random() * Math.PI * 2;
  return {
    object,
    setCover(c) {
      mat.uniforms.cover.value = c.texture;
      mat.uniforms.coverMin.value.copy(c.min);
      mat.uniforms.coverSize.value.copy(c.size);
    },
    update(dt, eye, drops, wind, tint) {
      time += dt;
      heading += dt * 0.03;
      const gust = wind * (1 + 0.25 * Math.sin(time * 0.7) + 0.15 * Math.sin(time * 2.3));
      mat.uniforms.time.value = time;
      mat.uniforms.eye.value.copy(eye);
      mat.uniforms.wind.value.set(Math.cos(heading) * gust, Math.sin(heading) * gust);
      mat.uniforms.tint.value.copy(tint);
      geo.setDrawRange(0, Math.round(Math.min(drops, MAX_DROPS)) * 2);
      object.visible = drops > 0;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      empty.dispose();
    },
  };
}

// ── Sound ─────────────────────────────────────────────────────────

export type RainSound = {
  /** `loudness` 0..1; `indoors` muffles it, as under a roof; `wind` 0..1 adds the storm's roar. */
  update: (dt: number, loudness: number, wind: number, indoors: boolean) => void;
  /** A peal of thunder, `delay` seconds from now; `near` 0..1 sharpens and loudens it. */
  thunder: (delay: number, near: number) => void;
  dispose: () => void;
};

/** Seconds of looped noise; long enough that the loop is not heard. */
const LOOP_SEC = 4;

function noiseBuffer(ctx: BaseAudioContext, seconds: number, brown: boolean): AudioBuffer {
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
  }
  return buf;
}

export function createRainSound(ctx: AudioContext, out: AudioNode): RainSound {
  const master = ctx.createGain();
  master.gain.value = 0;
  // Muffled under cover: the lowpass closes and the level drops.
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 12000;
  master.connect(muffle).connect(out);

  // The downpour: white noise, its harsh top and its rumble taken off.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, LOOP_SEC, false);
  hiss.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 0.35;
  const soft = ctx.createBiquadFilter();
  soft.type = 'highshelf';
  soft.frequency.value = 6000;
  soft.gain.value = -10;
  const hissGain = ctx.createGain();
  hiss.connect(band).connect(soft).connect(hissGain).connect(master);

  // Wind: brown noise, low and swelling.
  const roar = ctx.createBufferSource();
  roar.buffer = noiseBuffer(ctx, LOOP_SEC, true);
  roar.loop = true;
  const roarLow = ctx.createBiquadFilter();
  roarLow.type = 'lowpass';
  roarLow.frequency.value = 500;
  const roarGain = ctx.createGain();
  roarGain.gain.value = 0;
  roar.connect(roarLow).connect(roarGain).connect(master);

  hiss.start();
  roar.start();
  const thunderNoise = noiseBuffer(ctx, 6, true);
  let t = 0;

  return {
    update(dt, loudness, wind, indoors) {
      t += dt;
      const now = ctx.currentTime;
      master.gain.setTargetAtTime(loudness * (indoors ? 0.45 : 1) * 0.5, now, 0.6);
      muffle.frequency.setTargetAtTime(indoors ? 700 : 12000, now, 0.3);
      hissGain.gain.setTargetAtTime(0.6 + 0.4 * loudness, now, 0.5);
      // Gusts: the roar swells and falls.
      const gust = 0.6 + 0.4 * Math.sin(t * 0.45) * Math.sin(t * 0.17 + 1);
      roarGain.gain.setTargetAtTime(wind * gust * 1.6, now, 0.8);
    },
    thunder(delay, near) {
      const at = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      src.buffer = thunderNoise;
      src.playbackRate.value = 0.75 + Math.random() * 0.3;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 180 + near * 500;
      const g = ctx.createGain();
      const peak = 0.5 + near * 1.3;
      g.gain.setValueAtTime(0, at);
      // A crack (sharper when near), then rolling rumbles dying away.
      g.gain.linearRampToValueAtTime(peak, at + 0.04 + (1 - near) * 0.3);
      g.gain.exponentialRampToValueAtTime(peak * 0.35, at + 0.9);
      g.gain.linearRampToValueAtTime(peak * 0.55, at + 1.5 + Math.random() * 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, at + 4.5 + Math.random() * 1.5);
      src.connect(low).connect(g).connect(out);
      src.start(at);
      src.stop(at + 6.5);
    },
    dispose() {
      try { hiss.stop(); roar.stop(); } catch {}
      master.disconnect();
    },
  };
}
