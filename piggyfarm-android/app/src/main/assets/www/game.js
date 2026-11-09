(() => {
'use strict';

/* ======== 01_base.js ======== */
/* PIGGY FARM v5.2 – 1000 levels, 20 worlds, multi-stage missions, online play */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;
const WORLD = 100;
const TOTAL_LEVELS = 1000;
let seed = 1337;
const srand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const Chars = window.Chars;

/* ============================================================ renderer */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ed1ff);
scene.fog = new THREE.Fog(0xcdeaff, 70, 230);
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 700);
const hemi = new THREE.HemisphereLight(0xffffff, 0x6a9a4a, 2.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(40, 80, 30); scene.add(sun);

/* every material in the game is a soft toon material (same look as the characters) */
const M = (c, o) => {
  o = o || {}; const m = new THREE.MeshToonMaterial({ color: c, gradientMap: Chars.ramp });
  for (const k in o) { if (k === 'flatShading') continue; if (k === 'emissive') m.emissive = new THREE.Color(o.emissive); else m[k] = o[k]; }
  return m;
};
const matCache = {};
const MC = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return matCache[k] || (matCache[k] = M(c, o)); };
const dummy = new THREE.Object3D();
const GEO = {
  sph: new THREE.SphereGeometry(1, 16, 11), sphLo: new THREE.SphereGeometry(1, 10, 7), box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 12), ico: new THREE.SphereGeometry(1, 14, 10),
  tor: new THREE.TorusGeometry(1, .22, 8, 18)
};
function part(parent, geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
  parent.add(m); return m;
}
function outline(root, k) { if (root.userData.hasOl) return; Chars.outline(root, k ? Math.min(.09, k) : .05); }

/* soft round blob shadow */
const SH_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(20,40,10,.62)'); gr.addColorStop(.6, 'rgba(20,40,10,.32)'); gr.addColorStop(1, 'rgba(20,40,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const SH_GEO = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), SH_MAT = new THREE.MeshBasicMaterial({ map: SH_TEX, transparent: true, depthWrite: false, fog: false });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = camera.aspect < 1 ? 70 : 56; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
/* adaptive resolution: if the phone is struggling, render fewer pixels */
const perf = { acc: 0, n: 0, lowT: 0 };
function adaptRes(dt) {
  perf.acc += dt; perf.n++;
  if (perf.acc > 2.5) {
    const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
    if (avg > 1 / 38 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - .5); resize(); }
    else if (avg > 1 / 30 && pixelRatio > .75) { pixelRatio = Math.max(.75, pixelRatio - .25); resize(); }
  }
}

/* ======== 02_world.js ======== */
/* ============================================================ themes (20, repeating through 100 worlds) */
const THEMES = [
  { name: 'Sunny Meadow', emoji: '🌞', sky: 0x8ed1ff, fog: 0xcdeaff, hemi: 2.1, sun: 2.2, ground: '#5fbf3a', patch: () => `hsla(${88 + srand() * 30},62%,${38 + srand() * 20}%,.28)`, path: ['#a8693c', '#cf9560'],
    fol: [.31, .55, .22, .06, .1], grass: [.27, .6, .22, .08, .1], flow: [0xffd93a, 0xffffff, 0xff9ac8], haz: 'mower', hazCol: 0xd82a22, amb: { fall: .7, sway: 1.2, cols: [0xffffff, 0xffc0dc], size: .4 } },
  { name: 'Autumn Acres', emoji: '🍂', sky: 0xffc98a, fog: 0xffe3c0, hemi: 2.0, sun: 2.1, ground: '#b5b83c', patch: () => `hsla(${25 + srand() * 40},70%,${42 + srand() * 14}%,.3)`, path: ['#8a5a30', '#b5804a'],
    fol: [.07, .78, .42, .05, .08], grass: [.12, .6, .38, .06, .08], flow: [0xff8a1a, 0xffd23a, 0xe83a2a], haz: 'ball', hazCol: 0x8a5a2a, amb: { fall: 1.6, sway: 2, cols: [0xe8742a, 0xd8442a, 0xf2b03a], size: .55 } },
  { name: 'Coral Reef', emoji: '🐠', sky: 0x4fc8e8, fog: 0x9ae8f4, hemi: 2.2, sun: 2.2, ground: '#ffd9a8', patch: () => `hsla(${330 + srand() * 40},80%,${68 + srand() * 12}%,.32)`, path: ['#ff9a8a', '#ffd0a0'],
    fol: [.92, .7, .62, .08, .08], grass: [.45, .6, .5, .1, .08], flow: [0xff6ab0, 0xffa03a, 0xffffff, 0x7af0ff], haz: 'crab', hazCol: 0xff5a7a, mod: 'bouncy', amb: { fall: -1.3, sway: 1.4, cols: [0xffffff, 0xbff4ff, 0x9ae8ff], size: .5 } },
  { name: 'Candy Land', emoji: '🍭', sky: 0xffc4ec, fog: 0xffe6f7, hemi: 2.2, sun: 2.0, ground: '#ff9fd6', patch: () => `hsla(${290 + srand() * 60},80%,${70 + srand() * 12}%,.35)`, path: ['#e8c43a', '#fff2a8'],
    fol: [.85, .65, .62, .1, .08], grass: [.52, .6, .65, .08, .06], flow: [0xffffff, 0x7af0ff, 0xffe45c], haz: 'ball', hazCol: 0xff4fa0, amb: { fall: 1.2, sway: 1, cols: [0xff4fa0, 0x4fd0ff, 0xffe45c, 0xa0ff6a], size: .5 } },
  { name: 'Snowy Hills', emoji: '⛄', sky: 0xbfe3ff, fog: 0xeaf6ff, hemi: 2.3, sun: 2.0, ground: '#eef6ff', patch: () => `hsla(205,60%,${82 + srand() * 14}%,.4)`, path: ['#9ab8d0', '#c4dcee'],
    fol: [.42, .35, .32, .04, .06], grass: [.5, .25, .82, .04, .06], flow: [0x7ad0ff, 0xffffff], haz: 'ball', hazCol: 0xffffff, mod: 'ice', amb: { fall: 2.2, sway: 1.5, cols: [0xffffff], size: .5 } },
  { name: 'Dino Valley', emoji: '🦕', sky: 0xffd9a0, fog: 0xffecc8, hemi: 2.1, sun: 2.3, ground: '#8fc04a', patch: () => `hsla(${70 + srand() * 40},55%,${36 + srand() * 18}%,.32)`, path: ['#b58a50', '#d8b078'],
    fol: [.27, .6, .3, .08, .1], grass: [.2, .6, .36, .08, .08], flow: [0xff8a3a, 0xffe04a, 0xff5a5a], haz: 'ball', hazCol: 0x9a7a52, mod: 'wind', amb: { fall: .4, sway: 3.2, cols: [0xe8c070, 0x9ad06a], size: .45 } },
  { name: 'Sandy Desert', emoji: '🌵', sky: 0xffe0a0, fog: 0xfff0cc, hemi: 2.2, sun: 2.4, ground: '#e8c36a', patch: () => `hsla(${35 + srand() * 12},60%,${50 + srand() * 14}%,.3)`, path: ['#b88a3a', '#d4a85a'],
    fol: [.25, .45, .33, .04, .05], grass: [.14, .5, .42, .04, .05], flow: [0xff6a9a, 0xffd23a], haz: 'ball', hazCol: 0x9a7a3a, amb: { fall: .3, sway: 4, cols: [0xe8c070], size: .35 } },
  { name: 'Tropical Beach', emoji: '🏝️', sky: 0x7fe0ff, fog: 0xc8f4ff, hemi: 2.2, sun: 2.3, ground: '#f3e0a0', patch: () => `hsla(${180 + srand() * 25},70%,${65 + srand() * 12}%,.28)`, path: ['#c9a85a', '#e8d08a'],
    fol: [.36, .7, .34, .04, .06], grass: [.33, .6, .38, .05, .06], flow: [0xff5a8a, 0xffa01a, 0xffffff], haz: 'crab', hazCol: 0xe8402a, amb: { fall: -1.0, sway: 1.5, cols: [0xffffff, 0xaee8ff], size: .45 } },
  { name: 'Fairy Garden', emoji: '🧚', sky: 0xe6c8ff, fog: 0xf6e6ff, hemi: 2.2, sun: 1.9, ground: '#b6f0a0', patch: () => `hsla(${280 + srand() * 70},75%,${75 + srand() * 12}%,.35)`, path: ['#d8a0f0', '#f4d0ff'],
    fol: [.78, .55, .66, .1, .08], grass: [.35, .6, .6, .08, .08], flow: [0xff8ad8, 0xc08aff, 0xfff08a, 0x8af0ff], haz: 'ghost', hazCol: 0xffd0f0, mod: 'lowgrav', amb: { fall: 0, sway: 2.4, cols: [0xfff08a, 0xff9ae8, 0x9ae8ff], size: .55, fly: true } },
  { name: 'Starry Night', emoji: '🌙', sky: 0x14123a, fog: 0x24205a, hemi: 1.1, sun: .7, ground: '#2a6a50', patch: () => `hsla(${160 + srand() * 30},40%,${18 + srand() * 10}%,.35)`, path: ['#3a2a5a', '#5a4a7a'],
    fol: [.5, .5, .25, .05, .06], grass: [.4, .5, .28, .05, .05], flow: [0xfff58a, 0x9ad0ff], haz: 'ghost', hazCol: 0xf0f4ff, mod: 'dark', stars: true, cloud: 0x3a3a6a, amb: { fall: 0, sway: 3, cols: [0xfff58a], size: .5, fly: true } },
  { name: 'Pumpkin Patch', emoji: '🎃', sky: 0xa070c8, fog: 0xd0a8e8, hemi: 1.8, sun: 1.6, ground: '#7f8f3a', patch: () => `hsla(${20 + srand() * 20},80%,${40 + srand() * 10}%,.3)`, path: ['#4a3228', '#6a4a3a'],
    fol: [.08, .8, .3, .04, .06], grass: [.2, .5, .3, .05, .05], flow: [0xff7a1a, 0xa04aff], haz: 'ball', hazCol: 0xff7a1a, amb: { fall: 1.1, sway: 2, cols: [0xff7a1a, 0x9a4aff], size: .5 } },
  { name: 'Carnival Fun', emoji: '🎪', sky: 0xffe4ec, fog: 0xfff0f4, hemi: 2.3, sun: 2.0, ground: '#ff9aa8', patch: () => `hsla(${srand() * 360},90%,${70 + srand() * 10}%,.4)`, path: ['#ffffff', '#ff5a6a'],
    fol: [.0, .8, .6, .5, .08], grass: [.12, .7, .6, .5, .06], flow: [0xff4a6a, 0xffe04a, 0x4ab8ff, 0xffffff], haz: 'ball', hazCol: 0xff4a6a, mod: 'party', amb: { fall: 1.3, sway: 1.1, cols: [0xff4f9a, 0x4fd0ff, 0xffe45c, 0xa0ff6a, 0xc07aff], size: .6 } },
  { name: 'Moon Base', emoji: '🚀', sky: 0x05061a, fog: 0x15183a, hemi: 1.5, sun: 2.0, ground: '#9aa0b0', patch: () => `hsla(225,10%,${40 + srand() * 25}%,.38)`, path: ['#5a6070', '#7a8090'], craters: true,
    fol: [.52, .5, .5, .05, .08], grass: [.6, .4, .55, .05, .06], flow: [0x7af0ff, 0xffffff], haz: 'ufo', hazCol: 0x7ad0ff, mod: 'lowgrav', stars: true, cloud: -1, amb: { fall: .25, sway: .5, cols: [0xffffff, 0x9ad0ff], size: .4 } },
  { name: 'Rainbow Sky', emoji: '🌈', sky: 0xa8e8ff, fog: 0xe8f8ff, hemi: 2.3, sun: 2.0, ground: '#bff0ff', patch: () => `hsla(${srand() * 360},90%,75%,.42)`, path: ['#ff9ac8', '#ffe45c'], rainbow: true,
    fol: [.5, .7, .6, 1, .08], grass: [.5, .7, .6, 1, .08], flow: [0xff5a8a, 0xffd23a, 0x5ae0ff, 0xa0ff6a], haz: 'ball', hazCol: 0xff6ad0, amb: { fall: .9, sway: 1.4, cols: [0xff4f9a, 0x4fd0ff, 0xffe45c, 0xa0ff6a, 0xc07aff], size: .55 } },
  { name: 'Rainy Day', emoji: '🌧️', sky: 0x9fb4d0, fog: 0xc8d4e4, hemi: 1.9, sun: 1.5, ground: '#6fae66', patch: () => `hsla(${200 + srand() * 20},50%,${50 + srand() * 14}%,.35)`, path: ['#5a6a80', '#8a9ab0'],
    fol: [.33, .5, .34, .05, .08], grass: [.3, .55, .36, .05, .06], flow: [0xffe04a, 0xff8ab0, 0xffffff], haz: 'ball', hazCol: 0x4a8ac8, mod: 'ice', cloud: 0x8a96aa, amb: { fall: 7, sway: .3, cols: [0xbfe0ff, 0xdff0ff], size: .3 } },
  { name: 'Jungle Jam', emoji: '🌴', sky: 0xa8f0b8, fog: 0xd8ffd8, hemi: 2.0, sun: 2.0, ground: '#2f9a44', patch: () => `hsla(${120 + srand() * 40},60%,${28 + srand() * 18}%,.35)`, path: ['#7a5a30', '#a8844a'],
    fol: [.34, .72, .3, .06, .1], grass: [.3, .7, .3, .06, .1], flow: [0xff4a8a, 0xffe04a, 0xff8a1a], haz: 'ball', hazCol: 0x2a7a3a, amb: { fall: .5, sway: 1.8, cols: [0xffe04a, 0xff7ad0, 0xffffff], size: .45, fly: true } },
  { name: 'Lava Land', emoji: '🌋', sky: 0x7a2a3a, fog: 0xa0505a, hemi: 1.5, sun: 1.8, ground: '#5a3a42', patch: () => `hsla(${5 + srand() * 25},80%,${20 + srand() * 16}%,.4)`, path: ['#ff7a1a', '#ffc23a'],
    fol: [.02, .6, .3, .05, .08], grass: [.05, .7, .35, .05, .08], flow: [0xffe04a, 0xff7a1a], haz: 'ball', hazCol: 0xff5a1a, stars: true, cloud: 0x7a3a4a, amb: { fall: -1.6, sway: 1.6, cols: [0xff8a1a, 0xffd23a, 0xff4a1a], size: .5 } },
  { name: 'Crystal Cave', emoji: '💎', sky: 0x241046, fog: 0x3a2068, hemi: 1.3, sun: .9, ground: '#4a3a86', patch: () => `hsla(${260 + srand() * 60},50%,${30 + srand() * 16}%,.4)`, path: ['#6a4ab8', '#9a7ae8'],
    fol: [.52, .7, .5, .12, .1], grass: [.8, .6, .5, .1, .08], flow: [0x7af0ff, 0xff8ae8, 0xffffff], haz: 'ghost', hazCol: 0xc8a8ff, mod: 'speedy', stars: true, cloud: -1, amb: { fall: -.2, sway: 1, cols: [0x7af0ff, 0xff8ae8, 0xffffff], size: .5, fly: true } },
  { name: 'Toy Town', emoji: '🧸', sky: 0xbfe0ff, fog: 0xeaf4ff, hemi: 2.3, sun: 2.0, ground: '#ffd860', patch: () => `hsla(${srand() * 360},85%,${60 + srand() * 14}%,.4)`, path: ['#4a8aff', '#8ab8ff'],
    fol: [.6, .7, .6, .35, .08], grass: [.15, .7, .55, .4, .08], flow: [0xff4a6a, 0x4a8aff, 0xffe04a, 0x6aff8a], haz: 'ball', hazCol: 0x4a8aff, amb: { fall: 1.0, sway: 1.2, cols: [0xff4a6a, 0x4a8aff, 0xffe04a, 0x6aff8a], size: .5 } },
  { name: 'Pirate Bay', emoji: '🏴‍☠️', sky: 0x8ad8e8, fog: 0xd0f4f8, hemi: 2.1, sun: 2.3, ground: '#e8d49a', patch: () => `hsla(${40 + srand() * 20},50%,${58 + srand() * 14}%,.3)`, path: ['#8a5a30', '#b5804a'],
    fol: [.3, .6, .32, .05, .08], grass: [.28, .5, .4, .05, .08], flow: [0xff5a4a, 0xffd23a, 0xffffff], haz: 'crab', hazCol: 0xc83a2a, amb: { fall: -.6, sway: 1.5, cols: [0xffffff, 0xbfeeff], size: .4 } },
  { name: 'Robot Factory', emoji: '🤖', sky: 0xb8c8dc, fog: 0xdde6f0, hemi: 2.0, sun: 2.0, ground: '#8a98a8', patch: () => `hsla(${205 + srand() * 20},18%,${38 + srand() * 22}%,.35)`, path: ['#33414f', '#ffd23a'],
    fol: [.52, .3, .5, .05, .08], grass: [.5, .35, .5, .05, .06], flow: [0xffd23a, 0x4af0ff, 0xff5a5a], haz: 'mower', hazCol: 0x3a7ad8, mod: 'speedy', amb: { fall: -.3, sway: .6, cols: [0xffd23a, 0xffffff, 0x9ad0ff], size: .35 } },
  { name: 'Neon City', emoji: '🌃', sky: 0x1a0f3a, fog: 0x2e1a5a, hemi: 1.3, sun: .8, ground: '#2a2050', patch: () => `hsla(${280 + srand() * 50},80%,${30 + srand() * 15}%,.4)`, path: ['#ff3ad8', '#3af0ff'],
    fol: [.88, .9, .45, .1, .08], grass: [.5, .9, .45, .1, .08], flow: [0xff3ad8, 0x3af0ff, 0xffe45c], haz: 'ufo', hazCol: 0xff3ad8, mod: 'dark', stars: true, cloud: 0x4a2a7a, amb: { fall: .2, sway: 1.2, cols: [0xff3ad8, 0x3af0ff, 0xffe45c], size: .5, fly: true } },
  { name: 'Pixel Park', emoji: '🎮', sky: 0x6ad0ff, fog: 0xcff0ff, hemi: 2.2, sun: 2.1, ground: '#5ad84a', patch: () => `hsla(${100 + srand() * 30},70%,${40 + srand() * 20}%,.35)`, path: ['#a87a4a', '#d8b07a'],
    fol: [.33, .8, .4, .04, .1], grass: [.3, .85, .45, .04, .06], flow: [0xff3a3a, 0xffe83a, 0x3a8aff], haz: 'ball', hazCol: 0xff3a3a, mod: 'bouncy', amb: { fall: 1.0, sway: .6, cols: [0xff3a3a, 0xffe83a, 0x3a8aff, 0x3aff6a], size: .5 } },
  { name: 'Hologram Hills', emoji: '🔮', sky: 0x0a2a4a, fog: 0x174a6a, hemi: 1.5, sun: 1.2, ground: '#1a6a7a', patch: () => `hsla(${180 + srand() * 25},80%,${35 + srand() * 20}%,.4)`, path: ['#3af0ff', '#a0ffff'],
    fol: [.5, .9, .5, .06, .1], grass: [.47, .85, .5, .05, .08], flow: [0x7affff, 0xffffff, 0xff7aff], haz: 'ghost', hazCol: 0x7affff, mod: 'lowgrav', stars: true, cloud: -1, amb: { fall: -.2, sway: 1.4, cols: [0x7affff, 0xffffff, 0xff7aff], size: .5, fly: true } },
  { name: 'Cloud Kingdom', emoji: '☁️', sky: 0xcfe8ff, fog: 0xf4faff, hemi: 2.4, sun: 1.9, ground: '#f4f8ff', patch: () => `hsla(${210 + srand() * 20},70%,${85 + srand() * 10}%,.4)`, path: ['#ffd9f0', '#ffffff'],
    fol: [.58, .4, .8, .05, .06], grass: [.55, .35, .85, .05, .04], flow: [0xffb0e0, 0xffffff, 0xffe45c], haz: 'ball', hazCol: 0xffffff, mod: 'lowgrav', amb: { fall: .3, sway: 1.8, cols: [0xffffff, 0xcfe8ff], size: .55 } },
  { name: 'Bubble Lagoon', emoji: '🐟', sky: 0x5ad8f0, fog: 0xa8f0f8, hemi: 2.2, sun: 2.1, ground: '#7ad8e8', patch: () => `hsla(${170 + srand() * 30},80%,${60 + srand() * 15}%,.35)`, path: ['#fff0a0', '#ffffff'],
    fol: [.5, .7, .6, .08, .08], grass: [.45, .65, .55, .08, .06], flow: [0xff9ae8, 0xffffff, 0xa0ffe8], haz: 'crab', hazCol: 0xff8a7a, mod: 'bouncy', amb: { fall: -1.5, sway: 1.2, cols: [0xffffff, 0xbff4ff, 0xffd0f8], size: .65 } },
  { name: 'Ice Cream Parlor', emoji: '🍦', sky: 0xfff0f8, fog: 0xfff8fc, hemi: 2.4, sun: 1.9, ground: '#ffe4f0', patch: () => `hsla(${320 + srand() * 60},80%,${80 + srand() * 10}%,.4)`, path: ['#8a5a3a', '#c89a6a'],
    fol: [.95, .6, .78, .1, .08], grass: [.4, .5, .75, .1, .06], flow: [0xff6ab0, 0xffe45c, 0x7affd0], haz: 'ball', hazCol: 0xff8ab8, mod: 'party', amb: { fall: 1.2, sway: 1.0, cols: [0xff4f9a, 0x4fd0ff, 0xffe45c, 0xa0ff6a, 0xc07aff], size: .5 } },
  { name: 'Haunted Hollow', emoji: '👻', sky: 0x2a1a3a, fog: 0x4a3a5a, hemi: 1.3, sun: .9, ground: '#3a5a3a', patch: () => `hsla(${90 + srand() * 50},30%,${15 + srand() * 13}%,.4)`, path: ['#3a2a4a', '#5a4a6a'],
    fol: [.75, .4, .28, .05, .06], grass: [.3, .4, .25, .05, .05], flow: [0xffa01a, 0xa04aff, 0x7aff5a], haz: 'ghost', hazCol: 0xdff0ff, mod: 'dark', stars: true, cloud: 0x4a3a5a, amb: { fall: 0, sway: 2.2, cols: [0xffa01a, 0xa04aff, 0x7aff5a], size: .5, fly: true } },
  { name: 'Enchanted Forest', emoji: '🍄', sky: 0xb8f0c8, fog: 0xe0ffe8, hemi: 1.9, sun: 1.8, ground: '#3aa860', patch: () => `hsla(${130 + srand() * 40},60%,${25 + srand() * 15}%,.35)`, path: ['#8a5a3a', '#c8a070'],
    fol: [.38, .7, .28, .08, .1], grass: [.35, .7, .32, .08, .1], flow: [0xff4a6a, 0xffffff, 0xc07aff], haz: 'ball', hazCol: 0xc8402a, amb: { fall: 0, sway: 2.4, cols: [0xfff58a, 0xffffff, 0xc8ffa0], size: .5, fly: true } },
  { name: 'Dragon Mountain', emoji: '🐉', sky: 0xffb87a, fog: 0xffd8b0, hemi: 2.0, sun: 2.2, ground: '#b87a50', patch: () => `hsla(${15 + srand() * 20},50%,${35 + srand() * 15}%,.35)`, path: ['#8a4a2a', '#d8a060'],
    fol: [.02, .7, .4, .05, .08], grass: [.08, .55, .4, .05, .06], flow: [0xff5a3a, 0xffd23a], haz: 'ball', hazCol: 0xe8402a, mod: 'wind', amb: { fall: -.8, sway: 2.2, cols: [0xff8a1a, 0xffd23a, 0xff4a1a], size: .45 } }
];
/* 30 base themes. The 10 new ones are woven in between the old ones so they show up early.
   From world 30 on, every theme comes back as a hue-rotated "Dream" / "Twilight" / "Neon" variant (procedural AI-style worlds). */
const THEME_ORDER = [0, 1, 2, 3, 20, 4, 5, 21, 6, 7, 22, 8, 9, 23, 10, 11, 24, 12, 13, 25, 14, 15, 26, 16, 17, 27, 18, 19, 28, 29];
const DREAMS = [null, { pre: 'Dream', e: '✨', h: .34, s: 1.0, l: 0 }, { pre: 'Twilight', e: '🌌', h: .66, s: .9, l: -.03 }, { pre: 'Neon', e: '⚡', h: .12, s: 1.15, l: 0 }];
const dreamCache = {};
function dreamTheme(b, k) {
  const key = b.name + '|' + k; if (dreamCache[key]) return dreamCache[key];
  const D = DREAMS[k], hx = c => { const o = new THREE.Color(c), h = {}; o.getHSL(h); o.setHSL((h.h + D.h) % 1, Math.min(1, h.s * D.s), Math.max(0, Math.min(1, h.l + D.l))); return o.getHex(); };
  const css = c => '#' + new THREE.Color(hx(new THREE.Color(c).getHex())).getHexString();
  const t = Object.assign({}, b, {
    name: D.pre + ' ' + b.name, emoji: D.e + b.emoji, base: b.name, dream: k, sky: hx(b.sky), fog: hx(b.fog), ground: css(b.ground), path: b.path.map(css), flow: b.flow.map(hx), hazCol: hx(b.hazCol),
    patch: () => b.patch().replace(/hsla\((-?[\d.]+)/, (m, h) => 'hsla(' + ((((+h + D.h * 360) % 360) + 360) % 360)),
    fol: [(b.fol[0] + D.h) % 1].concat(b.fol.slice(1)), grass: [(b.grass[0] + D.h) % 1].concat(b.grass.slice(1)), amb: Object.assign({}, b.amb, { cols: b.amb.cols.map(hx) })
  });
  if (b.cloud > 0) t.cloud = hx(b.cloud);
  return dreamCache[key] = t;
}
function themeFor(w) { const base = THEMES[THEME_ORDER[w % THEME_ORDER.length]], k = Math.floor(w / THEME_ORDER.length) % DREAMS.length; return k ? dreamTheme(base, k) : base; }
const NWORLDS = TOTAL_LEVELS / 10;

/* ============================================================ world: ground, landmarks, scenery */
const farm = new THREE.Group(); scene.add(farm);          // everything that belongs to the farm (hidden in dash runs)
const groundMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: Chars.ramp });
const underMat = M(0x6fc04a);
function buildGround(t) {
  const GW = 130, S = 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = t.ground; g.fillRect(0, 0, S, S);
  g.globalAlpha = .5; for (let i = 0; i < 1100; i++) { g.fillStyle = t.patch(); g.beginPath(); g.arc(srand() * S, srand() * S, 8 + srand() * 38, 0, TAU); g.fill(); } g.globalAlpha = 1;
  if (t.craters) for (let i = 0; i < 70; i++) {
    const x = srand() * S, y = srand() * S, r = 10 + srand() * 34;
    g.fillStyle = 'rgba(60,66,84,.5)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(210,216,232,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 2, 0, TAU); g.stroke();
  }
  const tp = (x, z) => [(x + GW) * S / (2 * GW), (z + GW) * S / (2 * GW)];
  const drawPath = (pts, w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    const P = pts.map(p => tp(p[0], p[1])); g.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.stroke();
  };
  const p1 = [[4, 40], [0, 18], [-10, 0], [-22, -16], [-30, -34], [-36, -50], [-40, -56]];
  const p2 = [[-10, 0], [8, -8], [26, -14], [40, -22], [52, -30]];
  const p3 = [[0, 18], [20, 28], [40, 50], [60, 70]];
  for (const p of [p1, p2, p3]) { drawPath(p, 34, t.path[0]); drawPath(p, 27, t.path[1]); }
  if (t.rainbow) { const cs = ['#ff5a5a', '#ffa03a', '#ffe45c', '#7ae05a', '#5ac8ff', '#9a6aff']; cs.forEach((c, i) => drawPath(p1, 27 - i * 4.4, c)); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  if (groundMat.map) groundMat.map.dispose();
  groundMat.map = tex; groundMat.needsUpdate = true;
  underMat.color.set(t.ground);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMat); ground.rotation.x = -Math.PI / 2; farm.add(ground);
const under = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), underMat); under.rotation.x = -Math.PI / 2; under.position.y = -0.05; scene.add(under);

const cols = [];
const addCol = (x, z, r) => cols.push({ x, z, r });
const blocked = (x, z, margin) => cols.some(c => Math.hypot(x - c.x, z - c.z) < c.r + margin);

const POND = { x: 52, z: -30, r: 12 };
(function () {
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(POND.r + 1, POND.r + 1.6, 0.16, 28), M(0xc99a62)); rim.position.set(POND.x, 0.04, POND.z);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(POND.r, POND.r, 0.2, 28), M(0x3fa6ec, { emissive: 0x0a3a66 })); water.position.set(POND.x, 0.08, POND.z);
  farm.add(rim, water); addCol(POND.x, POND.z, POND.r - 0.3);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = 3 + (i % 3) * 3, lp = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .05, 14), M(0x5ad06a)); lp.position.set(POND.x + Math.cos(a) * r, .2, POND.z + Math.sin(a) * r); farm.add(lp); }
})();
(function () { // barn
  const g = new THREE.Group(); const red = M(0xd8402e), white = M(0xf4efe4), roofM = M(0x8a2a22);
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9), red); body.position.y = 3.5; g.add(body);
  const ang = Math.atan2(4, 6), len = Math.hypot(6, 4) + 0.5;
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 10.4), roofM); r.position.set(s * 3, 9, 0); r.rotation.z = -s * ang; g.add(r); }
  const sh = new THREE.Shape(); sh.moveTo(-6, 0); sh.lineTo(6, 0); sh.lineTo(0, 4); sh.lineTo(-6, 0);
  for (const s of [1, -1]) { const t = new THREE.Mesh(new THREE.ShapeGeometry(sh), red); t.position.set(0, 7, s * 4.52); if (s < 0) t.rotation.y = Math.PI; g.add(t); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 0.2), M(0x6b3f22)); door.position.set(0, 2.3, 4.55); g.add(door);
  for (const [w, h, x, y] of [[4.6, .3, 0, 4.7], [.3, 4.8, -2.2, 2.4], [.3, 4.8, 2.2, 2.4]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, .25), white); f.position.set(x, y, 4.62); g.add(f); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.25, 5.6, .22), white); bar.position.set(0, 2.4, 4.7); bar.rotation.z = 0.8; g.add(bar);
  const bar2 = bar.clone(); bar2.rotation.z = -0.8; g.add(bar2);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .2, 16), M(0xffe9a0, { emissive: 0x806a20 })); win.rotation.x = Math.PI / 2; win.position.set(0, 7.6, 4.6); g.add(win);
  for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(2, 1 + i, 5), M(i % 2 ? 0xf5b400 : 0xe07a10)); st.position.set(8 + i * 2, (1 + i) / 2, 0); g.add(st); }
  g.position.set(-42, 0, -60); g.rotation.y = 0.45; farm.add(g); outlineSimple(g);
  const cs = Math.cos(0.45), sn = Math.sin(0.45);
  for (const lx of [-4.5, 0, 4.5]) addCol(-42 + lx * cs, -60 - lx * sn, 5.2);
  for (const lx of [9, 11, 13, 15, 17]) addCol(-42 + lx * cs, -60 - lx * sn, 2.2);
})();
function outlineSimple(g) { try { Chars.outline(g, .12); } catch (e) { } }
const GOAL = { x: -38, z: -52 };   // where the naughty foxes are heading
const windmillBlades = new THREE.Group();
(function () {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, 11, 12), M(0xe8c89a)); tower.position.y = 5.5; g.add(tower);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 10, 0, TAU, 0, Math.PI / 2), M(0xc84a3a)); cap.position.y = 11; cap.scale.y = 1.2; g.add(cap);
  windmillBlades.position.set(0, 10.4, 2.2);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7, 0.15), M(0xfff6e2)); b.position.y = 4.2; arm.add(b);
    const rod = new THREE.Mesh(new THREE.BoxGeometry(.25, 7.4, .25), M(0x6b4a2a)); rod.position.y = 3.8; arm.add(rod); windmillBlades.add(arm);
  }
  g.add(windmillBlades); g.position.set(30, 0, -75); g.rotation.y = -0.3; farm.add(g); addCol(30, -75, 3.2); outlineSimple(g);
})();
(function () { // fence + hay
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.16, 0.12), M(0xe6c088), 400);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.5, 0.28), M(0xc49660), 200);
  let ri = 0, pi = 0;
  const seg = (x1, z1, x2, z2) => {
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(L / 2.5)), a = Math.atan2(-(z2 - z1), x2 - x1);
    for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, z = z1 + (z2 - z1) * i / n; dummy.position.set(x, 0.75, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); posts.setMatrixAt(pi++, dummy.matrix); addCol(x, z, 0.35); }
    for (const y of [0.55, 1.05]) { dummy.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); dummy.rotation.set(0, a, 0); dummy.scale.set(L, 1, 1); dummy.updateMatrix(); rails.setMatrixAt(ri++, dummy.matrix); }
  };
  const x0 = -24, z0 = -30, x1 = -6, z1 = -44;
  seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0 - 6);
  rails.count = ri; posts.count = pi; rails.instanceMatrix.needsUpdate = posts.instanceMatrix.needsUpdate = true; farm.add(rails, posts);
  for (const [x, z] of [[-18, -40], [-12, -38], [-15, -34]]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.6, 14), M(0xf0cc62)); h.rotation.z = Math.PI / 2; h.position.set(x, 1.2, z); farm.add(h); addCol(x, z, 1.4); const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, .06, 6, 20), M(0xc89a30)); r.position.set(x - .8, 1.2, z); r.rotation.y = Math.PI / 2; farm.add(r); }
})();
(function () { // rocks (smooth pebbles)
  const N = 28, im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), M(0xffffff), N), col = new THREE.Color();
  let n = 0, tries = 0;
  while (n < N && tries++ < 800) {
    const a = srand() * TAU, r = 14 + srand() * 100, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.8 + srand() * srand() * 3.2;
    if (blocked(x, z, s + 2)) continue;
    dummy.position.set(x, s * 0.3, z); dummy.rotation.set(srand() * 0.4, srand() * TAU, srand() * 0.4); dummy.scale.set(s, s * 0.68, s * (0.8 + srand() * 0.4)); dummy.updateMatrix();
    im.setMatrixAt(n, dummy.matrix); col.setHSL(0.6, 0.06, 0.6 + srand() * 0.2); im.setColorAt(n, col); addCol(x, z, s * 0.92); n++;
  }
  im.count = n; farm.add(im);
})();
let treeLo, treeHi, bushIM; const treeSh = [];
(function () { // round, friendly trees + bushes
  const N = 100, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.38, .55, 2.6, 8), M(0x8a5a36), N);
  treeLo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), M(0xffffff), N);
  treeHi = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 9), M(0xffffff), N);
  let n = 0, tries = 0;
  while (n < N && tries++ < 3000) {
    const a = srand() * TAU, r = 40 + srand() * 76, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z, 3.4)) continue;
    const s = 0.85 + srand() * 0.7; treeSh.push(srand());
    dummy.rotation.set(0, srand() * TAU, 0); dummy.scale.set(s, s, s);
    dummy.position.set(x, 1.3 * s, z); dummy.updateMatrix(); trunk.setMatrixAt(n, dummy.matrix);
    dummy.scale.set(2.3 * s, 2.0 * s, 2.3 * s); dummy.position.set(x, 4.0 * s, z); dummy.updateMatrix(); treeLo.setMatrixAt(n, dummy.matrix);
    dummy.scale.set(1.6 * s, 1.45 * s, 1.6 * s); dummy.position.set(x + .15 * s, 5.7 * s, z); dummy.updateMatrix(); treeHi.setMatrixAt(n, dummy.matrix);
    addCol(x, z, 0.9 * s); n++;
  }
  trunk.count = treeLo.count = treeHi.count = n; farm.add(trunk, treeLo, treeHi);
  bushIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), M(0xffffff), 70);
  let b = 0; tries = 0;
  while (b < 70 && tries++ < 1500) {
    const a = srand() * TAU, r = 12 + srand() * 108, x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 2.2)) continue;
    const s = .7 + srand() * 1.0; dummy.rotation.set(0, srand() * TAU, 0); dummy.scale.set(s * 1.2, s * .85, s * 1.1); dummy.position.set(x, s * .5, z); dummy.updateMatrix(); bushIM.setMatrixAt(b, dummy.matrix); bushIM.setColorAt(b, new THREE.Color(0x44aa33)); b++;
  }
  bushIM.count = b; farm.add(bushIM);
})();
let grassIM, flowerIM; const GRASS_N = 380, FLOW_N = 220;
(function () {
  grassIM = new THREE.InstancedMesh(new THREE.ConeGeometry(.18, .7, 5), M(0xffffff), GRASS_N);
  for (let i = 0; i < GRASS_N; i++) {
    const a = srand() * TAU, r = Math.sqrt(srand()) * 125; dummy.position.set(Math.cos(a) * r, .3, Math.sin(a) * r); dummy.rotation.set(0, srand() * TAU, 0);
    const s = .7 + srand() * 1.1; dummy.scale.set(s, s, s); dummy.updateMatrix(); grassIM.setMatrixAt(i, dummy.matrix); grassIM.setColorAt(i, new THREE.Color(0x44aa33));
  }
  farm.add(grassIM);
  flowerIM = new THREE.InstancedMesh(new THREE.SphereGeometry(.22, 8, 6), M(0xffffff, { emissive: 0x222222 }), FLOW_N);
  for (let i = 0; i < FLOW_N; i++) {
    const a = srand() * TAU, r = Math.sqrt(srand()) * 120; dummy.position.set(Math.cos(a) * r, .26, Math.sin(a) * r); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); flowerIM.setMatrixAt(i, dummy.matrix); flowerIM.setColorAt(i, new THREE.Color(0xffffff));
  }
  farm.add(flowerIM);
})();
const clouds = []; const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
(function () {
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 4, 10, 8), cloudMat); s.position.set(j * 6 - 9, Math.random() * 2, Math.random() * 3); s.scale.y = .6; g.add(s); }
    const a = Math.random() * TAU, r = 90 + Math.random() * 140; g.position.set(Math.cos(a) * r, 55 + Math.random() * 25, Math.sin(a) * r); scene.add(g); clouds.push(g);
  }
})();
const skyStars = (function () {
  const N = 450, p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = Math.random() * TAU, b = Math.random() * 1.3 + .15, r = 380; p[i * 3] = Math.cos(a) * Math.cos(b) * r; p[i * 3 + 1] = Math.sin(b) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, fog: false })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts;
})();
const AMB_N = 90; const amb = { pts: null, pos: null, col: null, cfg: null, ph: [] };
(function () {
  amb.pos = new Float32Array(AMB_N * 3); amb.col = new Float32Array(AMB_N * 3);
  for (let i = 0; i < AMB_N; i++) { amb.pos[i * 3] = rand(-45, 45); amb.pos[i * 3 + 1] = rand(0, 26); amb.pos[i * 3 + 2] = rand(-45, 45); amb.ph.push(rand(0, TAU)); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(amb.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(amb.col, 3));
  amb.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .5, vertexColors: true, transparent: true, opacity: .92, depthWrite: false, alphaTest: .35, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 15, 0, TAU); g.fill(); return new THREE.CanvasTexture(c); })() })); amb.pts.frustumCulled = false; scene.add(amb.pts);
})();

let curTheme = THEMES[0], curMod = null;
function applyTheme(t, mod) {
  curTheme = t; curMod = mod || null;
  let sky = new THREE.Color(t.sky), fog = new THREE.Color(t.fog), hi = t.hemi, su = t.sun, fn = 70, ff = 230;
  if (mod === 'dark') { sky.multiplyScalar(.45); fog.multiplyScalar(.4); hi *= .6; su *= .45; fn = 18; ff = 95; }
  scene.background = sky; scene.fog = new THREE.Fog(fog, fn, ff);
  hemi.intensity = hi; sun.intensity = su;
  buildGround(t);
  const col = new THREE.Color(), n = treeLo.count, F = t.fol, Gr = t.grass;
  for (let i = 0; i < n; i++) {
    const sh = treeSh[i] || 0, h = t.rainbow ? Math.random() : F[0] + (sh - .5) * 2 * F[3];
    col.setHSL(((h % 1) + 1) % 1, F[1], F[2] + sh * F[4]); treeLo.setColorAt(i, col);
    col.setHSL(((h % 1) + 1) % 1, F[1], F[2] + .06 + sh * F[4]); treeHi.setColorAt(i, col);
  }
  treeLo.instanceColor.needsUpdate = treeHi.instanceColor.needsUpdate = true;
  for (let i = 0; i < bushIM.count; i++) { const h = t.rainbow ? Math.random() : F[0] + (treeSh[i % n] - .5) * F[3]; col.setHSL(((h % 1) + 1) % 1, F[1], F[2] - .03 + (i % 5) * .02); bushIM.setColorAt(i, col); }
  bushIM.instanceColor.needsUpdate = true;
  for (let i = 0; i < GRASS_N; i++) { const h = t.rainbow ? Math.random() : Gr[0] + (srand() - .5) * 2 * Gr[3]; col.setHSL(((h % 1) + 1) % 1, Gr[1], Gr[2] + srand() * Gr[4]); grassIM.setColorAt(i, col); }
  grassIM.instanceColor.needsUpdate = true;
  for (let i = 0; i < FLOW_N; i++) { col.setHex(t.flow[i % t.flow.length]); flowerIM.setColorAt(i, col); }
  flowerIM.instanceColor.needsUpdate = true;
  skyStars.visible = !!t.stars;
  cloudMat.color.setHex(t.cloud > 0 ? t.cloud : 0xffffff); clouds.forEach(c => c.visible = t.cloud !== -1);
  amb.cfg = t.amb;
  for (let i = 0; i < AMB_N; i++) { col.setHex(pick(t.amb.cols)); amb.col[i * 3] = col.r; amb.col[i * 3 + 1] = col.g; amb.col[i * 3 + 2] = col.b; }
  amb.pts.geometry.attributes.color.needsUpdate = true; amb.pts.material.size = t.amb.size;
}
function updateAmb(dt, pig) {
  const c = amb.cfg; if (!c) return; const p = amb.pos;
  for (let i = 0; i < AMB_N; i++) {
    const k = i * 3; amb.ph[i] += dt;
    p[k + 1] -= c.fall * dt; p[k] += Math.sin(amb.ph[i] * .9 + i) * c.sway * dt; p[k + 2] += Math.cos(amb.ph[i] * .7 + i * 1.3) * c.sway * dt * .6;
    if (c.fly) p[k + 1] += Math.sin(amb.ph[i] * 1.3) * dt * 1.2;
    if (p[k] < pig.x - 45) p[k] += 90; else if (p[k] > pig.x + 45) p[k] -= 90;
    if (p[k + 2] < pig.z - 45) p[k + 2] += 90; else if (p[k + 2] > pig.z + 45) p[k + 2] -= 90;
    if (c.fly) { if (p[k + 1] < .8) p[k + 1] = 5; if (p[k + 1] > 9) p[k + 1] = 2; }
    else if (p[k + 1] < 0) p[k + 1] = 26; else if (p[k + 1] > 28) p[k + 1] = .5;
  }
  amb.pts.geometry.attributes.position.needsUpdate = true;
}

/* ======== 03_audio_fx.js ======== */
/* ============================================================ audio */
let actx = null, muted = false;
function audioInit() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
}
function tone(type, f0, f1, dur, vol, delay) {
  if (!actx || muted) return;
  const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + .03);
}
function noise(dur, vol) {
  if (!actx || muted) return;
  const b = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(actx.destination); s.start();
}
const SIMON_F = [392, 494, 587, 698];
const sfx = {
  oink() { tone('sawtooth', 230, 120, .13, .13); tone('square', 150, 90, .12, .06, .1); },
  baa() { tone('sawtooth', 460, 330, .28, .09); tone('triangle', 470, 310, .28, .1); },
  gold() { tone('sine', 880, 1320, .18, .12); tone('sine', 1320, 1760, .2, .1, .12); },
  hit() { tone('square', 150, 45, .35, .22); tone('sawtooth', 90, 40, .3, .15); },
  jump() { tone('sine', 320, 760, .14, .1); },
  shoot() { tone('sine', 420, 90, .16, .2); noise(.08, .1); },
  pop() { noise(.07, .25); tone('triangle', 900, 1500, .08, .1); },
  thunk() { tone('square', 200, 120, .08, .12); },
  star() { tone('sine', 1000, 1500, .12, .1); tone('sine', 1500, 2100, .14, .08, .08); },
  pin() { noise(.18, .2); tone('square', 300, 180, .1, .06); },
  power() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .1, .1, i * .06)); },
  boom() { noise(.6, .35); tone('sawtooth', 140, 30, .6, .25); },
  end() { [520, 440, 360, 260].forEach((f, i) => tone('triangle', f, f * .96, .22, .14, i * .16)); },
  start() { [392, 523, 659].forEach((f, i) => tone('triangle', f, f, .14, .12, i * .09)); },
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, .16, .13, i * .1)); },
  go() { tone('triangle', 660, 880, .25, .15); },
  coin() { tone('square', 988, 1319, .09, .08); tone('square', 1319, 1319, .12, .07, .07); },
  stomp() { tone('square', 300, 90, .15, .14); noise(.08, .1); },
  moo() { tone('sawtooth', 190, 110, .5, .14); tone('triangle', 95, 70, .5, .1); },
  cluck() { [0, .09, .18].forEach(d => tone('square', 760, 520, .05, .07, d)); },
  quack() { tone('square', 540, 340, .12, .1); tone('square', 520, 330, .12, .1, .16); },
  boing() { tone('sine', 240, 920, .2, .14); },
  zap() { tone('sawtooth', 900, 120, .18, .1); noise(.1, .12); },
  meow() { tone('sine', 700, 520, .3, .1); tone('sine', 520, 800, .14, .06, .2); },
  woof() { tone('sawtooth', 300, 140, .12, .14); noise(.05, .08); },
  toot() { tone('sawtooth', 280, 540, .3, .1); tone('square', 300, 500, .26, .05, .02); },
  hoot() { tone('sine', 520, 380, .22, .12); tone('sine', 520, 360, .22, .1, .26); },
  roar() { tone('sawtooth', 130, 70, .45, .15); noise(.3, .1); },
  squeak() { tone('sine', 1500, 2200, .08, .08); tone('sine', 1900, 2600, .08, .07, .09); },
  note(i) { tone('triangle', SIMON_F[i % 4], SIMON_F[i % 4], .34, .16); tone('sine', SIMON_F[i % 4] * 2, SIMON_F[i % 4] * 2, .2, .05); },
  wrong() { tone('sawtooth', 200, 90, .35, .14); },
  whoosh() { noise(.22, .12); tone('sine', 300, 700, .2, .05); },
  flag() { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, .1, .1, i * .06)); },
  stage() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .13, .13, i * .08)); noise(.15, .06); },
  splash() { noise(.3, .18); tone('sine', 500, 120, .3, .1); },
  ring() { tone('sine', 1200, 1200, .4, .06); tone('sine', 1800, 1800, .5, .04, .02); },
  peep() { tone('sine', 1900, 2500, .07, .07); tone('sine', 2100, 2700, .07, .06, .09); },
  clank() { tone('square', 520, 260, .09, .1); noise(.05, .08); tone('triangle', 1100, 700, .08, .05, .03); },
  bzz() { tone('sawtooth', 210, 250, .22, .05); tone('sawtooth', 215, 255, .22, .04, .02); },
  sparkle() { [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, .1, .06, i * .05)); }
};
const buzz = ms => { try { if (!muted && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } };

/* tiny procedural music: a bouncy pentatonic loop (tempo and mood follow the game) */
const music = { on: false, step: 0, next: 0, bpm: 112, mode: 'farm', timer: 0 };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const MEL = [[0, 2, 4, 2, 5, 4, 2, 1], [0, 3, 5, 3, 6, 5, 3, 2], [4, 5, 6, 4, 5, 3, 2, 0], [2, 4, 5, 7, 6, 4, 3, 1]];
const BASS = [0, 0, 5, 3];   // scale degrees of the bass per bar
function musicTick() {
  if (!actx || muted || !music.on) return;
  const now = actx.currentTime; if (music.next < now - .5) music.next = now + .05;
  const sd = 60 / music.bpm / 2;
  while (music.next < now + .35) {
    const s = music.step, bar = (s >> 3) & 3, beat = s & 7, root = music.mode === 'boss' ? 164.8 : music.mode === 'night' ? 196 : 261.6;
    const d = MEL[(bar + (music.mode === 'boss' ? 2 : 0)) & 3][beat];
    if (!(beat === 3 && music.mode === 'night')) toneAt('triangle', root * Math.pow(2, PENTA[d] / 12), sd * 1.6, .045, music.next);
    if (beat % 4 === 0) toneAt('sine', root / 2 * Math.pow(2, PENTA[BASS[bar]] / 12), sd * 3.2, .07, music.next);
    if (music.mode !== 'night' && beat % 2 === 1) toneAt('square', root * 2 * Math.pow(2, PENTA[d] / 12), sd * .5, .012, music.next);
    music.step++; music.next += sd;
  }
}
function toneAt(type, f, dur, vol, t) { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + .02); }
setInterval(musicTick, 120);
function musicMode(m, bpm) { music.mode = m; music.bpm = bpm || 112; }

/* ============================================================ particles */
const puffs = []; const puffGeo = new THREE.SphereGeometry(.3, 7, 5);
for (let i = 0; i < 220; i++) {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.visible = false; scene.add(m);
  puffs.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 0 });
}
let puffI = 0;
function emit(x, y, z, vx, vy, vz, life, color, size, grow) {
  const p = puffs[puffI++ % puffs.length]; p.m.visible = true; p.m.position.set(x, y, z); p.m.material.color.setHex(color); p.m.material.opacity = 1;
  p.m.scale.setScalar(size); p.vx = vx; p.vy = vy; p.vz = vz; p.life = p.max = life; p.grow = grow || 0;
}
function burst(x, y, z, color, n, sp, size) { for (let i = 0; i < n; i++) emit(x, y, z, rand(-sp, sp), rand(sp * .2, sp * 1.1), rand(-sp, sp), rand(.45, .9), color, rand(size * .6, size), 1.2); }
const CONF = [0xff4f9a, 0x4fd0ff, 0xffe45c, 0xa0ff6a, 0xc07aff, 0xff8a2a];
function confetti(x, y, z, n) { for (let i = 0; i < n; i++) emit(x + rand(-1, 1), y, z + rand(-1, 1), rand(-7, 7), rand(4, 13), rand(-7, 7), rand(.9, 1.6), pick(CONF), rand(.5, .9), 0); }
function updatePuffs(dt) {
  for (const p of puffs) {
    if (p.life <= 0) continue; p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.vy -= 6 * dt;
    p.m.material.opacity = Math.min(1, p.life / p.max * 1.5); p.m.scale.addScalar(p.grow * dt); if (p.m.scale.x < .05) p.m.scale.setScalar(.05);
  }
}

/* ======== 04_input.js ======== */
/* ============================================================ input
   ONE floating move-stick (left half of the screen), JET + SHOOT buttons on the right.
   The camera follows and swings behind Piggy by itself (see updateCamera). */
const input = { mx: 0, my: 0, jumpHeld: false, jumpPressed: false, shootHeld: false, keys: {} };
let camYaw = Math.PI, camPitch = .5, camManT = 0;
const jumpEl = $('jump'), shootEl = $('shoot'), jl = $('jl'), jlk = $('jlk');
let state = 'menu';   // menu | levels | intro | play | stageclear | win | fail | pause | lobby
let botMode = false;
const stick = { id: null, ox: 0, oy: 0, R: 64 };
let lookP = null;
function stickR() { return clamp(Math.min(window.innerWidth, window.innerHeight) * .15, 50, 84); }
function setKnob(dx, dy) { const R = stick.R * .72; jlk.style.transform = `translate(${dx * R}px,${dy * R}px)`; }
function stickMove(e) {
  let dx = (e.clientX - stick.ox) / stick.R, dy = (e.clientY - stick.oy) / stick.R; const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; } setKnob(dx, dy);
  const mm = Math.min(1, m); if (mm < .12) { input.mx = input.my = 0; return; }
  const k = Math.min(1, (mm - .12) / .55) / Math.max(mm, 1e-6); input.mx = dx * k; input.my = -dy * k;
}
function stickEnd() {
  stick.id = null; input.mx = input.my = 0; setKnob(0, 0); jl.classList.remove('active'); jl.style.left = jl.style.top = jl.style.bottom = '';
}
function stickBegin(e) {
  stick.R = stickR(); stick.id = e.pointerId; const size = stick.R * 2.3;
  stick.ox = e.clientX; stick.oy = e.clientY;
  // keep the stick base fully on screen
  stick.ox = clamp(stick.ox, size / 2 + 6, window.innerWidth - size / 2 - 6); stick.oy = clamp(stick.oy, size / 2 + 6, window.innerHeight - size / 2 - 6);
  jl.style.width = jl.style.height = size + 'px'; jl.style.left = (stick.ox - size / 2) + 'px'; jl.style.top = (stick.oy - size / 2) + 'px'; jl.style.bottom = 'auto';
  jl.classList.add('active'); stickMove(e);
}
function dpadReset() { if (stick.id !== null) stickEnd(); input.mx = input.my = 0; setKnob(0, 0); input.jumpHeld = input.shootHeld = false; lookP = null; }
canvas.addEventListener('pointerdown', e => {
  audioInit(); if (state !== 'play' && state !== 'intro' && state !== 'stageclear') return;
  const left = e.clientX < window.innerWidth * .55;
  if (left && stick.id === null) { try { canvas.setPointerCapture(e.pointerId); } catch (_) { } stickBegin(e); return; }
  if (!lookP) { lookP = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { } }
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) { stickMove(e); return; }
  if (!lookP || e.pointerId !== lookP.id) return;
  const dx = e.clientX - lookP.x, dy = e.clientY - lookP.y; lookP.x = e.clientX; lookP.y = e.clientY;
  if (L && L.dash && state === 'play') return; camYaw -= dx * .009; camPitch = clamp(camPitch + dy * .0045, .12, 1.3); camManT = 1.6;
});
const canvasEnd = e => { if (e.pointerId === stick.id) stickEnd(); if (lookP && e.pointerId === lookP.id) lookP = null; };
canvas.addEventListener('pointerup', canvasEnd); canvas.addEventListener('pointercancel', canvasEnd);
canvas.addEventListener('contextmenu', e => e.preventDefault());
function bindBtn(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); if (state !== 'play') return; down(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) { } });
  const u = () => { up(); el.classList.remove('down'); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u);
}
bindBtn(jumpEl, () => { input.jumpHeld = true; input.jumpPressed = true; }, () => { input.jumpHeld = false; });
bindBtn(shootEl, () => { input.shootHeld = true; audioInit(); }, () => { input.shootHeld = false; });
window.addEventListener('keydown', e => {
  input.keys[e.code] = true;
  if (e.code === 'Space') { if (!input.jumpHeld) input.jumpPressed = true; input.jumpHeld = true; e.preventDefault(); }
  if (e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'ShiftLeft') input.shootHeld = true;
});
window.addEventListener('keyup', e => { input.keys[e.code] = false; if (e.code === 'Space') input.jumpHeld = false; if (e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'ShiftLeft') input.shootHeld = false; });
function readKeys() {
  const k = input.keys; if (stick.id !== null || botMode) return;
  input.mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0); input.my = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
}

/* ======== 05_levels.js ======== */
/* ============================================================ level generator (1000 levels, multi-stage missions) */
const OBJ_INFO = {
  sheep: { e: '🐑', verb: 'Bonk', noun: 'farm friends', per: 4.6, range: [12, 34], from: 1 },
  balloons: { e: '🎈', verb: 'Pop', noun: 'balloons', per: 3.6, range: [11, 34], from: 3 },
  pins: { e: '🎳', verb: 'Knock down', noun: 'pins', per: 2.5, range: [14, 50], from: 4 },
  baddies: { e: '👾', verb: 'Defeat', noun: 'baddies', per: 5.6, range: [10, 34], from: 5 },
  stars: { e: '⭐', verb: 'Grab', noun: 'stars', per: 3.8, range: [10, 30], from: 6 },
  foxes: { e: '🦊', verb: 'Stop', noun: 'foxes', per: 5.2, range: [8, 26], from: 7 },
  targets: { e: '🎯', verb: 'Hit', noun: 'targets', per: 4.4, range: [9, 28], from: 9 },
  gifts: { e: '🎁', verb: 'Find', noun: 'gift boxes', per: 3.6, range: [7, 22], from: 11 },
  chicks: { e: '🐥', verb: 'Bring home', noun: 'lost chicks', per: 7.5, range: [3, 8], from: 15 },
  coins: { e: '🪙', verb: 'Collect', noun: 'shiny coins', per: 2.4, range: [14, 40], from: 8 },
  fireflies: { e: '✨', verb: 'Catch', noun: 'fireflies', per: 4.6, range: [6, 18], from: 18 },
  seeds: { e: '🌱', verb: 'Plant', noun: 'magic seeds', per: 6.5, range: [3, 9], from: 21 },
  cages: { e: '🔓', verb: 'Free', noun: 'caged pals', per: 8.5, range: [3, 8], from: 25 },
  flags: { e: '🚩', verb: 'Reach', noun: 'flags', per: 12, range: [3, 9], from: 12 },
  simon: { e: '🎵', verb: 'Copy', noun: 'melodies', per: 15, range: [2, 6], from: 16 },
  dash: { e: '🏁', verb: 'Reach', noun: 'the finish', per: 0, range: [1, 1] },
  boss: { e: '👑', verb: 'Defeat', noun: 'the boss', per: 0, range: [1, 1] },
  rush: { e: '⭐', verb: 'Collect', noun: 'stars before your friends', per: 0, range: [1, 1] }
};
const KINDS = ['sheep', 'balloons', 'pins', 'baddies', 'stars', 'foxes', 'targets', 'flags', 'simon', 'gifts', 'chicks', 'coins', 'fireflies', 'seeds', 'cages'];
const ANIM_SETS = [['sheep', 'cow', 'chicken', 'bunny'], ['duck', 'frog', 'chicken', 'sheep'], ['penguin', 'bunny', 'duck', 'panda'], ['cow', 'frog', 'cat', 'duck'], ['chicken', 'sheep', 'penguin', 'puppy'], ['frog', 'duck', 'bunny', 'cat'], ['penguin', 'panda', 'cow', 'frog'], ['bunny', 'chicken', 'puppy', 'cow'], ['sheep', 'penguin', 'frog', 'panda'], ['cow', 'cat', 'penguin', 'duck'], ['puppy', 'bunny', 'sheep', 'chicken'], ['panda', 'cat', 'puppy', 'frog'], ['duck', 'penguin', 'cow', 'bunny'], ['cat', 'sheep', 'panda', 'chicken'], ['elephant', 'owl', 'turtle', 'lion'], ['koala', 'dino', 'duck', 'bunny'], ['turtle', 'frog', 'duck', 'koala'], ['lion', 'cow', 'elephant', 'sheep'], ['owl', 'cat', 'panda', 'koala'], ['dino', 'turtle', 'frog', 'chicken'], ['elephant', 'penguin', 'koala', 'puppy'], ['lion', 'dino', 'cat', 'owl'], ['turtle', 'sheep', 'bunny', 'elephant'], ['koala', 'panda', 'owl', 'dino']];
const objE = (t, w) => t === 'sheep' ? SPECIES[ANIM_SETS[(w || 0) % ANIM_SETS.length][0]].e : OBJ_INFO[t].e;
const BOSS_ORDER = [0, 1, 2, 10, 3, 4, 11, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17];   // world -> boss type: Cupcake Queen is boss #4 (level 40), Big Jack boss #7 (level 70)
const bossType = w => BOSS_ORDER[w % BOSS_ORDER.length];
const BOSSES = [
  { name: 'King Woolly', e: '👑' }, { name: 'Captain Fox', e: '🦊' }, { name: 'Mega Mower', e: '🚜' }, { name: 'Grumpy Cloud', e: '⛈️' }, { name: 'Jelly Giant', e: '🟢' },
  { name: 'Robo Sheep', e: '🤖' }, { name: 'Pumpkin King', e: '🎃' }, { name: 'Ice Golem', e: '🧊' }, { name: 'Space Blob', e: '👾' }, { name: 'Rainbow Dragon', e: '🐲' },
  { name: 'Cupcake Queen', e: '🧁' }, { name: 'Big Jack', e: '🤡' },
  { name: 'Captain Crabby', e: '🦀' }, { name: 'Boo King', e: '👻' }, { name: 'Rex the Roar', e: '🦖' }, { name: 'Sundae Sam', e: '🍨' }, { name: 'Teddy Titan', e: '🧸' }, { name: 'Professor Hoot', e: '🦉' }
];
const MODS = {
  lowgrav: { e: '🌙', name: 'Low gravity – super jumps!' }, ice: { e: '🧊', name: 'Slippery ice – you slide!' },
  speedy: { e: '⚡', name: 'Speedy mode – everything is faster!' }, dark: { e: '🌑', name: 'Dark night – look carefully!' },
  wind: { e: '💨', name: 'Windy day – the breeze pushes you!' }, bouncy: { e: '🦘', name: 'Bouncy ground – boing boing! (hold JET to bounce higher)' }, party: { e: '🎉', name: 'Party time – extra goodies!' }
};
/* the first ten levels teach one new trick each */
const EARLY = { 1: [['sheep'], ['sheep'], ['sheep']], 2: [['sheep'], ['balloons'], ['sheep']], 3: [['balloons'], ['pins'], ['sheep']], 4: [['pins'], ['sheep'], ['balloons']], 6: [['baddies'], ['stars']], 7: [['stars'], ['foxes']], 8: [['foxes'], ['baddies']], 9: [['targets'], ['sheep', 'balloons']] };
const HINTS = {
  1: 'Drag on the left side to run. Run into the farm friends to bonk them! 🐑🐮🐔', 2: 'Hold SHOOT to fire balls from your head cannon! 🎯', 3: 'Shoot balloons – or hold JET to fly up to them! 🎈',
  4: 'Roll a ball into the bowling pins! 🎳', 5: 'DASH! Jump logs with JET, stomp critters, and leap over the gaps! 🏃', 6: 'Waves of baddies! Stomp them or shoot them. 👾', 7: 'Fly with JET to reach the high stars! ⭐',
  8: 'Foxes run to the barn. Stop them before they get there! 🦊', 9: 'Moving targets! Lead your shots. 🎯', 10: 'BOSS! Shoot it again and again – jump over its attacks!'
};
const KIND_HINT = {
  flags: 'Follow the arrow to the 🚩 flag – dodge the spinning bars and rolling hazards!', simon: 'Watch the pads light up, then copy the tune! Step on the pads or shoot them. 🎵',
  baddies: 'Waves of baddies are coming! 👾', foxes: 'Foxes run to the barn – stop them!',
  coins: 'Grab the shiny 🪙 coins scattered around the farm!', fireflies: 'Fireflies flit away when you get close – sneak up, or shoot them! ✨', seeds: 'Stand on each 🌱 soil patch until the seed grows into a flower!', cages: 'Bonk the cages (or jump on top!) to free the pals inside! 🔓',
  gifts: 'Find the 🎁 gift boxes hiding around – bump into them or shoot them!', chicks: 'Touch the lost chicks 🐥 so they follow you, then lead them to the red ring (their barn)!'
};
const isDashLevel = n => n % 10 !== 0 && ((n >= 5 && n % 10 === 5) || (n >= 130 && n % 10 === 2));
function genLevel(n) {
  const R = mulberry32(n * 7919 + 13), world = Math.floor((n - 1) / 10), idx = (n - 1) % 10, d = Math.min(1, (n - 1) / 799), dd = (n - 1) / (TOTAL_LEVELS - 1);
  const theme = themeFor(world), boss = idx === 9, dash = !boss && isDashLevel(n);
  const L = { n, world, idx, d, dd, theme, boss, dash, stages: [], hint: HINTS[n] || '', mod: null, star: (n >= 3 && !boss && !dash) ? starFor(n, world) : null, cheer: cheerIdx(n) };
  const mkObj = (type, mult) => {
    const info = OBJ_INFO[type]; let need = Math.round(lerp(info.range[0], info.range[1], d) * (mult || 1) * (.9 + R() * .2)); need = Math.max(type === 'simon' ? 2 : 3, need);
    if (n === 1) need = 7; if (n === 2) need = type === 'sheep' ? 9 : 8; return { type, need, got: 0 };
  };
  if (dash) {
    L.stages.push({ objs: [{ type: 'dash', need: 1, got: 0 }], time: 0 });
  } else if (boss) {
    if (n >= 20) { const al = KINDS.filter(k => OBJ_INFO[k].from <= n && k !== 'baddies' && k !== 'simon' && k !== 'flags'); L.stages.push({ objs: [mkObj(al[Math.floor(R() * al.length)], 1)], time: 0 }); }
    L.stages.push({ objs: [mkObj('baddies', 1)], time: 0 }); L.stages.push({ objs: [{ type: 'boss', need: 1, got: 0 }], time: 0 });
  } else {
    const S = n < 12 ? 3 : n < 100 ? 4 : n < 300 ? 5 : 6;
    const early = EARLY[n], allowed = KINDS.filter(k => OBJ_INFO[k].from <= n); let prev = null;
    const dbl = n < 40 ? 0 : Math.min(.6, .15 + (n - 40) / 900);
    for (let s = 0; s < S; s++) {
      let types;
      if (early && early[s]) types = early[s].slice();
      else {
        const pool = allowed.filter(k => k !== prev); types = [pool[Math.floor(R() * pool.length)]];
        if (R() < dbl && types[0] !== 'simon' && types[0] !== 'flags' && types[0] !== 'chicks') { const p2 = allowed.filter(k => k !== types[0] && k !== 'simon' && k !== 'flags' && k !== 'chicks' && k !== 'foxes'); if (p2.length) types.push(p2[Math.floor(R() * p2.length)]); }
      }
      prev = types[0];
      L.stages.push({ objs: types.map(t => mkObj(t, types.length > 1 ? .66 : 1)), time: 0 });
    }
  }
  // per-stage time budget
  for (const st of L.stages) {
    let t = 14; for (const o of st.objs) t += o.need * (OBJ_INFO[o.type].per || 0) * lerp(1.45, 1.0, d);
    st.time = Math.round(t);
  }
  const dashSec = lerp(95, 165, d);
  if (dash) { L.dashSec = dashSec; L.stages[0].time = Math.round(dashSec * 1.55 + 20); }
  if (boss) { const hp = Math.round(lerp(110, 320, d)); L.stages[L.stages.length - 1].time = Math.round(50 + hp * .8); }
  if (n <= 2) for (const st of L.stages) st.time = Math.max(st.time, 70);
  L.totalTime = L.stages.reduce((a, s) => a + s.time, 0);
  L.foxInterval = lerp(4.2, 1.2, d); L.foxHpMax = 1 + Math.floor(d * 3.2);
  // difficulty knobs
  L.em = 1 + d * 0.45;                                    // enemy speed multiplier
  L.targetSpeed = lerp(.55, 1.7, d); L.targetSize = lerp(1.9, 1.0, d); L.balloonSpeed = lerp(.25, .95, d);
  L.sheepFlee = lerp(6.2, 9.8, d);
  L.harass = n < 3 ? 0 : Math.round(lerp(1, 5, d)); L.harassEvery = lerp(10, 4.5, d);
  L.hazCount = n < 6 ? 0 : Math.round(lerp(1, 6, d) * (boss ? .6 : 1));
  L.hazSpeed = lerp(4.8, 9, d); if (L.dash) { L.hazCount = 0; L.harass = 0; }
  L.pickupEvery = lerp(14, 22, d);
  L.waveSize = Math.round(lerp(2, 5, d)); L.waveGap = lerp(20, 15, d);
  if (n >= 12) { if (theme.mod && R() < .75) L.mod = theme.mod; else if (R() < .35 && !boss && !dash) L.mod = pick2(R, ['lowgrav', 'ice', 'speedy', 'dark', 'wind', 'bouncy', 'party']); }
  if (boss && theme.mod && n >= 12) L.mod = theme.mod;
  if (dash && (L.mod === 'dark' || L.mod === 'lowgrav' || L.mod === 'wind' || L.mod === 'bouncy')) L.mod = null;
  if (L.mod === 'speedy') L.em *= 1.3;
  if (boss) {
    const tier = Math.floor(world / 10), hp = Math.round(lerp(110, 320, d));
    L.bossCfg = { type: bossType(world), tier, hp, speed: lerp(2.8, 5, d), fireEvery: lerp(3.0, 1.3, d), shots: 1 + Math.floor(d * 2.6), projSpeed: lerp(11, 16, d), scale: 1 + Math.min(tier, 6) * .1, ring: Math.round(lerp(8, 14, d)) };
  }
  if (L.dash && !L.hint) L.hint = 'Steer with the stick. JET = jump (hold to hover over gaps), stomp critters – and outrun the angry boulder! ⚫';
  if (!L.hint) { const k = L.stages[0].objs[0].type; L.hint = KIND_HINT[k] || ''; }
  L.title = boss ? `Boss: ${BOSSES[bossType(world)].name}` : dash ? `Dash ${n}` : `Level ${n}`;
  return L;
}
function pick2(R, a) { return a[Math.floor(R() * a.length)]; }
function missionOf(st, world) {
  return st.objs.map(o => o.type === 'dash' ? '🏁 Dash to the finish line! Jump logs, leap the gaps, grab coins!' : o.type === 'boss' ? `${OBJ_INFO.boss.e} Defeat ${BOSSES[bossType(world)].name}!` : `${objE(o.type, world)} ${OBJ_INFO[o.type].verb} ${o.need} ${OBJ_INFO[o.type].noun}`).join('  +  ');
}

/* ======== 06_state.js ======== */
/* ============================================================ pig */
const PIG_SCALE = 1.1;
const pig = { x: 0, z: 24, y: 0, vx: 0, vz: 0, vy: 0, heading: Math.PI, grounded: true, fuel: 1, squash: 0, thrusting: false, aimH: 0, aimT: 0, recoil: 0, mood: 'normal', moodT: 0, falling: false };
const BALL_COLORS = Chars.BALL_COLORS;
const rig = Chars.makePig(); scene.add(rig.g); rig.g.scale.setScalar(PIG_SCALE);
const pigParts = { g: rig.g, inner: rig.inner, rig };
{
  const sh = new THREE.Mesh(SH_GEO, SH_MAT.clone()); sh.position.y = .05; sh.scale.setScalar(1.6); scene.add(sh); pigParts.shadow = sh; sh.material.opacity = 1; sh.material.fog = false;
}

/* ============================================================ save */
let save = { max: 1, stars: '0'.repeat(TOTAL_LEVELS) };
try {
  const s = JSON.parse(localStorage.getItem('piggy_save2'));
  if (s && s.max && s.stars) { save = s; if (save.stars.length < TOTAL_LEVELS) save.stars += '0'.repeat(TOTAL_LEVELS - save.stars.length); save.stars = save.stars.slice(0, TOTAL_LEVELS); }
} catch (_) { }
save.coins = save.coins || 0; save.own = save.own || ['hat0', 'skin0']; save.hat = save.hat || 'hat0'; save.skin = save.skin || 'skin0'; save.mpWins = save.mpWins || 0; save.mpGames = save.mpGames || 0;
const writeSave = () => { try { localStorage.setItem('piggy_save2', JSON.stringify(save)); } catch (_) { } };
const totalStars = () => { let t = 0; for (let i = 0; i < TOTAL_LEVELS; i++) t += +save.stars[i]; return t; };

let level = Math.min(save.max, TOTAL_LEVELS), L = null, objs = [], hearts = 3, invuln = 0, timeLeft = 60, timeLimit = 60, tripleT = 0, shootCd = 0;
let stageIdx = 0, stageT = 0, usedCkpt = false, ckptStage = 0;
let combo = 0, comboT = 0, clock = 0, shake = 0, introT = 0, ballColorI = 0, foxQueue = 0, foxTimer = 0, pickupTimer = 8, GRAV = 26, iceMode = false, speedMode = false, windMode = false, bounceMode = false, partyMode = false, windA = 0, windT = 0, bossRef = null;
const ents = [];
const balls = [], bprojs = [];
const el = { time: $('time'), lvl: $('lvl'), hearts: $('hearts'), objs: $('objs'), combo: $('combo'), fuel: $('fuel'), flash: $('flash'), banner: $('banner'), bossbar: $('bossbar'), bossfill: $('bossfill'), bossname: $('bossname'), stage: $('stage'), arrow: $('arrow') };

/* ============================================================ helpers for entities */
function spot(minPig, margin) {
  for (let i = 0; i < 80; i++) {
    const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (WORLD - (margin || 12)), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z, 2) || Math.hypot(x - pig.x, z - pig.z) < (minPig || 10)) continue; return { x, z };
  }
  return { x: rand(-30, 30), z: rand(-30, 30) };
}
function pushOut(o, r) {
  for (const c of cols) { const dx = o.x - c.x, dz = o.z - c.z, m = c.r + r, d2 = dx * dx + dz * dz; if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2), k = (m - d) / d; o.x += dx * k; o.z += dz * k; } }
}
function keepInWorld(o, lim) { const d = Math.hypot(o.x, o.z); if (d > lim) { o.x *= lim / d; o.z *= lim / d; return true; } return false; }
const pigNear = (e, r, maxY) => state === 'play' && pig.y < (maxY == null ? 99 : maxY) && Math.hypot(e.x - pig.x, e.z - pig.z) < r;
const _v = new THREE.Vector3();
function popText(str, x, y, z, cls) {
  _v.set(x, y, z).project(camera); if (_v.z > 1) return;
  const d = document.createElement('div'); d.className = 'pop ' + (cls || ''); d.textContent = str;
  d.style.left = clamp((_v.x * .5 + .5) * window.innerWidth, 30, window.innerWidth - 30) + 'px'; d.style.top = ((-_v.y * .5 + .5) * window.innerHeight) + 'px';
  $('popwrap').appendChild(d); setTimeout(() => d.remove(), 950);
}
function renderObjs() {
  el.objs.innerHTML = objs.filter(o => o.type !== 'boss').map(o => {
    let extra = ''; if (o.type === 'baddies' && waves.total > 1) extra = ` <small>wave ${Math.min(waves.num, waves.total)}/${waves.total}</small>`;
    return `<span class="obj ${o.got >= o.need ? 'done' : ''}">${objE(o.type, L.world)} ${Math.min(o.got, o.need)}/${o.need}${extra}</span>`;
  }).join('');
  el.stage.textContent = L && L.stages.length > 1 ? `Stage ${stageIdx + 1}/${L.stages.length}` : '';
  el.stage.style.display = L && L.stages.length > 1 ? '' : 'none';
}
const praiseWords = [[3, 'Nice!'], [5, 'Great!'], [8, 'Awesome!'], [12, 'Amazing!!'], [18, 'INCREDIBLE!!!']];
function progress(type, n) {
  const o = objs.find(o => o.type === type); if (!o || state !== 'play') return;
  o.got += n || 1; combo = comboT > 0 ? combo + 1 : 1; comboT = 2.4; renderObjs(); pig.mood = 'happy'; pig.moodT = .8;
  const w = praiseWords.filter(p => combo === p[0])[0];
  if (w) { el.combo.textContent = '🔥 ' + w[1]; el.combo.style.opacity = 1; setTimeout(() => { if (comboT < 1.8) el.combo.style.opacity = 0; }, 900); }
  if (objs.every(o => o.got >= o.need)) stageClear();
}
function hurtPig(fx, fz, force) {
  if (invuln > 0 || state !== 'play') return;
  hearts--; invuln = 1.7; shake = .5; combo = 0; comboT = 0; sfx.hit(); buzz(120); updateHearts(); pig.mood = 'hurt'; pig.moodT = 1.1;
  const dx = pig.x - fx, dz = pig.z - fz, d = Math.hypot(dx, dz) || 1; pig.vx = dx / d * (force || 20); pig.vz = dz / d * (force || 20); pig.vy = 8; pig.grounded = false;
  el.flash.style.opacity = 1; setTimeout(() => el.flash.style.opacity = 0, 120); popText('Ouch!', pig.x, pig.y + 3.4, pig.z, 'bad');
  if (hearts <= 0) failLevel('You ran out of hearts! 💔');
}
const updateHearts = () => { el.hearts.textContent = '❤️'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, 3 - hearts)); };

/* ============================================================ balls (the head-cannon shots) */
const ballGeo = new THREE.SphereGeometry(.42, 12, 9);
for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(ballGeo, M(0xffffff)); m.visible = false; scene.add(m); balls.push({ m, alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, r: .5 }); }
const BALL_G = 9, BALL_SPEED = 34;
function fireBall(x, y, z, vx, vy, vz, color, owner) {
  const b = balls.find(b => !b.alive); if (!b) return; b.alive = true; b.x = x; b.y = y; b.z = z; b.vx = vx; b.vy = vy; b.vz = vz; b.life = 2.4; b.m.visible = true; b.m.material.color.setHex(color); b.m.position.set(x, y, z); b.color = color; b.owner = owner || 0; b.mpOwner = null; return b;
}
function findAimTarget() {
  let best = null, bs = 1e9;
  for (const e of ents) {
    if (!e.hittable || e.dead) continue;
    const dx = e.x - pig.x, dz = e.z - pig.z, d = Math.hypot(dx, dz); if (d < 1.5 || d > 52) continue;
    const a = Math.abs(angDiff(pig.heading, Math.atan2(dx, dz))); if (a > 2.7) continue;
    const s = a * 7 + d * .35 - (e.kind === 'boss' ? 25 : 0); if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function shoot() {
  if (shootCd > 0 || state !== 'play') return;
  shootCd = tripleT > 0 ? .22 : .3;
  const tgt = MP.active && MP.mode === 'rush' ? (findAimTarget() || MP.aimAtPig()) : findAimTarget();
  let h = pig.heading, vy0 = 3.5;
  const fx = Math.sin(h), fz = Math.cos(h);
  const mx = pig.x + fx * 2.1, mz = pig.z + fz * 2.1, my = pig.y + 3.0;
  if (tgt) {
    let tx = tgt.x, tz = tgt.z, ty = tgt.y + (tgt.cy || 0);
    for (let it = 0; it < 2; it++) { const dd = Math.hypot(tx - mx, tz - mz), t = dd / BALL_SPEED; tx = tgt.x + (tgt.vx || 0) * t; tz = tgt.z + (tgt.vz || 0) * t; ty = tgt.y + (tgt.cy || 0) + (tgt.vy || 0) * t; }
    const dx = tx - mx, dz = tz - mz, dd = Math.hypot(dx, dz) || 1, t = dd / BALL_SPEED; h = Math.atan2(dx, dz); vy0 = clamp((ty - my + .5 * BALL_G * t * t) / t, -12, 24);
  }
  if (tgt) { pig.aimH = h; pig.aimT = .35; } pig.recoil = .18;
  const offs = tripleT > 0 ? [-.2, 0, .2] : [0];
  for (const o of offs) { const a = h + o; fireBall(mx, my, mz, Math.sin(a) * BALL_SPEED, vy0, Math.cos(a) * BALL_SPEED, BALL_COLORS[ballColorI % BALL_COLORS.length], 1); if (MP.active) MP.sendShot(mx, my, mz, Math.sin(a) * BALL_SPEED, vy0, Math.cos(a) * BALL_SPEED, BALL_COLORS[ballColorI % BALL_COLORS.length]); }
  ballColorI++; rig.reload(ballColorI);
  sfx.shoot(); emit(mx, my, mz, 0, 1, 0, .25, 0xffffff, .5, 3);
}
function updateBalls(dt) {
  for (const b of balls) {
    if (!b.alive) continue;
    b.vy -= BALL_G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt; b.m.position.set(b.x, b.y, b.z);
    if (b.life <= 0 || b.y < .2 || Math.hypot(b.x, b.z) > (L && L.dash ? 4000 : 140)) { if (b.y < .3) emit(b.x, .3, b.z, 0, 1, 0, .3, b.color, .5, 2); kill(b); continue; }
    if (b.owner === 2) { MP.ballVsPig(b) && kill(b); continue; }          // another player's shot: only matters to my pig (rush mode)
    for (const e of ents) {
      if (!e.hittable || e.dead) continue;
      const rr = e.r + b.r; const dx = b.x - e.x, dy = b.y - (e.y + (e.cy || 0)), dz = b.z - e.z;
      if (dx * dx + dy * dy + dz * dz < rr * rr) { if (e.onBall(b) !== false) { burst(b.x, b.y, b.z, b.color, 5, 3, .5); kill(b); break; } }
    }
    if (b.alive && MP.active) MP.ballVsRemote(b);
  }
  function kill(b) { b.alive = false; b.m.visible = false; }
}

/* ============================================================ entity factories */
function addEnt(e) {
  e.dead = false; e.vx = e.vx || 0; e.vy = e.vy || 0; e.vz = e.vz || 0; e.g.position.set(e.x, e.y || 0, e.z); ents.push(e); scene.add(e.g); outline(e.g);
  if (e.kind !== 'pickup' && e.kind !== 'coin' && e.kind !== 'flag' && e.kind !== 'simonpad') { e.sh = new THREE.Mesh(SH_GEO, SH_MAT); e.sh.position.set(e.x, .07, e.z); scene.add(e.sh); }
  return e;
}
function dropEnt(e) { scene.remove(e.g); if (e.sh) scene.remove(e.sh); if (e.cleanup) e.cleanup(); }
function clearEnts() { for (const e of ents) dropEnt(e); ents.length = 0; }
function clearLevel() {
  clearEnts();
  for (const b of balls) { b.alive = false; b.m.visible = false; }
  for (const p of bprojs) scene.remove(p.m); bprojs.length = 0;
  for (const p of puffs) { p.life = 0; p.m.visible = false; }
  bossRef = null; el.bossbar.style.display = 'none'; clearDash();
}

/* ======== 07_friends.js ======== */
/* ---- farm friends (13 cute species!) */
const SPECIES = {
  sheep: { e: '🐑', say: 'Baa!', snd: 'baa', flee: 1, hop: .22, sc: 1.2 },
  cow: { e: '🐮', say: 'Moo!', snd: 'moo', flee: .75, hop: .12, sc: 1.3 },
  chicken: { e: '🐔', say: 'Cluck!', snd: 'cluck', flee: 1.3, hop: .3, sc: 1.25 },
  bunny: { e: '🐰', say: 'Boing!', snd: 'boing', flee: 1.25, hop: .9, sc: 1.25 },
  duck: { e: '🦆', say: 'Quack!', snd: 'quack', flee: 1.05, hop: .2, sc: 1.25 },
  penguin: { e: '🐧', say: 'Wheee!', snd: 'squeak', flee: .95, hop: .28, sc: 1.2 },
  frog: { e: '🐸', say: 'Ribbit!', snd: 'boing', flee: 1.1, hop: 1.1, sc: 1.3 },
  panda: { e: '🐼', say: 'Pan-da!', snd: 'squeak', flee: .8, hop: .15, sc: 1.2 },
  cat: { e: '🐱', say: 'Meow!', snd: 'meow', flee: 1.2, hop: .25, sc: 1.25 },
  puppy: { e: '🐶', say: 'Woof!', snd: 'woof', flee: 1.15, hop: .3, sc: 1.2 },
  elephant: { e: '🐘', say: 'Toot!', snd: 'toot', flee: .7, hop: .1, sc: 1.2 },
  owl: { e: '🦉', say: 'Hoot!', snd: 'hoot', flee: 1, hop: .2, sc: 1.25 },
  turtle: { e: '🐢', say: 'Yay!', snd: 'squeak', flee: .55, hop: .08, sc: 1.3 },
  lion: { e: '🦁', say: 'Rawr!', snd: 'roar', flee: 1, hop: .2, sc: 1.2 },
  koala: { e: '🐨', say: 'Aww!', snd: 'squeak', flee: .8, hop: .12, sc: 1.25 },
  dino: { e: '🦖', say: 'Rawr!', snd: 'roar', flee: 1.1, hop: .25, sc: 1.2 }
};
function spawnSheep(gold, atPos) {
  const set = ANIM_SETS[L.world % ANIM_SETS.length], spn = set[(Math.random() * set.length) | 0], SP = SPECIES[spn], rg = Chars.makeCritter(spn, gold), g = new THREE.Group(); g.add(rg.g);
  rg.g.scale.setScalar(SP.sc); g.userData.hasOl = true;
  const p = atPos || spot(14);
  const e = addEnt({ kind: 'sheep', sp: spn, g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1, r: 1.6, hittable: true, gold, ang: rand(0, TAU), moving: false, wait: rand(0, 3), st: 'idle', t: 0, spin: 0 });
  e.update = dt => {
    if (e.st === 'fly') {
      e.vy -= 28 * dt; e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt; g.rotation.x += e.spin * dt; g.rotation.z += e.spin * .6 * dt; e.t -= dt; g.position.set(e.x, Math.max(0, e.y), e.z);
      Chars.blinkAll(rg, dt, 1);
      if ((e.y <= 0 && e.vy < 0) || e.t <= 0) { burst(e.x, .4, e.z, gold ? 0xffd23a : 0xffffff, 8, 3, .7); confetti(e.x, .6, e.z, 8); e.dead = true; } return;
    }
    if (state === 'win') {
      e.cheer = (e.cheer || rand(0, 1)) + dt * 2.4; const j = Math.abs(Math.sin(e.cheer * Math.PI)), cv = (((L && L.cheer) | 0) + (e.ang * 3 | 0)) & 3;
      g.position.set(e.x, j * (cv === 1 ? 2.3 : cv === 2 ? .7 : 1.6), e.z);
      if (cv === 0) g.rotation.y += dt * 4; else if (cv === 1) g.rotation.z = Math.sin(e.cheer * 9) * .35; else if (cv === 2) g.rotation.y += dt * 9; else g.rotation.x = -(e.cheer % 1) * TAU;
      Chars.tickCritter(rg, dt, clock, 0, null); return;
    }
    const dx = e.x - pig.x, dz = e.z - pig.z, d = Math.hypot(dx, dz); let sp = 0, scared = false;
    if (d < 12 && state === 'play') { e.ang += angDiff(e.ang, Math.atan2(dx, dz)) * Math.min(1, 6 * dt); sp = (gold ? L.sheepFlee * 1.2 : L.sheepFlee) * SP.flee * clamp(1.4 - d / 15, .5, 1) * (speedMode ? 1.25 : 1); e.moving = false; e.wait = rand(.5, 1.5); scared = true; }
    else { e.wait -= dt; if (e.wait <= 0) { e.moving = !e.moving; e.wait = e.moving ? rand(1.5, 3.5) : rand(1, 3); if (e.moving) e.ang = rand(0, TAU); } if (e.moving) sp = 1.5; }
    e.vx = Math.sin(e.ang) * sp; e.vz = Math.cos(e.ang) * sp; e.x += e.vx * dt; e.z += e.vz * dt; pushOut(e, .8); if (keepInWorld(e, WORLD)) e.ang += Math.PI * .5;
    g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 10 * dt);
    const ph = Math.abs(Math.sin(clock * (sp * 1.4 + 3) + e.ang)), hop = sp > 0 ? ph * SP.hop : Math.sin(clock * 3 + e.ang) * .03; g.position.set(e.x, hop, e.z);
    rg.g.scale.set(SP.sc * (1 + (1 - ph) * .04 * (sp > 0 ? 1 : 0)), SP.sc * (1 - (1 - ph) * .05 * (sp > 0 ? 1 : 0)), SP.sc * (1 + (1 - ph) * .04 * (sp > 0 ? 1 : 0)));
    Chars.tickCritter(rg, dt, clock, sp, null); if (scared) for (const ey of rg.eyes) ey.look(0, .4);
    if (rg.halo) { rg.halo.rotation.z += dt * 3; rg.halo.position.y = 2.7 + Math.sin(clock * 4) * .12; }
    if (pigNear(e, 2.3, 2.6)) knock(pig.x, pig.z);
  };
  function knock(fx, fz) {
    const dx = e.x - fx, dz = e.z - fz, d = Math.hypot(dx, dz) || 1; e.st = 'fly'; e.hittable = false; e.vx = dx / d * 11; e.vz = dz / d * 11; e.vy = 12; e.spin = rand(8, 14); e.t = 1.4; e.y = 0;
    burst(e.x, 1.2, e.z, gold ? 0xffd23a : 0xffffff, 12, 5, 1.1); confetti(e.x, 1.6, e.z, gold ? 22 : 12); popText(gold ? '+3s! ' + SP.say : SP.say, e.x, 3, e.z, gold ? 'gold' : ''); if (gold) { timeLeft += 3; sfx.gold(); } else { sfx[SP.snd](); } buzz(20); progress('sheep');
  }
  e.onBall = b => { knock(b.x - b.vx, b.z - b.vz); };
  return e;
}
/* ---- balloons (glossy, with curly strings) */
const BAL_COLS = [0xff4f6a, 0x4fb8ff, 0xffd23a, 0x7aff6a, 0xb06aff, 0xff8a2a, 0xff7ad0];
function spawnBalloon() {
  const g = new THREE.Group(), col = pick(BAL_COLS);
  const bm = M(col, { emissive: new THREE.Color(col).multiplyScalar(.12).getHex() });
  part(g, GEO.sph, bm, 0, 0, 0, 1.15, 1.4, 1.15); part(g, GEO.cone, bm, 0, -1.5, 0, .28, .3, .28).rotation.x = Math.PI;
  const str = part(g, GEO.cyl, MC(0xffffff), 0, -3.0, 0, .03, 1.5, .03); str.userData.noOutline = true;
  const sh = part(g, GEO.sph, C_basic(0xffffff, .55), -.42, .55, .86, .26, .38, .08); sh.userData.noOutline = true; sh.rotation.z = .5;
  const c = spot(0, 22), top = lerp(5, 8.5, L.d), ymin = lerp(2.6, 4, L.d);
  const e = addEnt({ kind: 'balloon', g, cx: c.x, cz: c.z, rad: rand(2, 9), ang: rand(0, TAU), spd: (Math.random() < .5 ? -1 : 1) * rand(.6, 1) * L.balloonSpeed * (speedMode ? 1.3 : 1), by: rand(ymin, top), ph: rand(0, TAU), x: c.x, z: c.z, y: ymin, r: 1.7, cy: 0, hittable: true, col });
  e.update = dt => {
    e.ang += e.spd * dt; const nx = e.cx + Math.cos(e.ang) * e.rad, nz = e.cz + Math.sin(e.ang) * e.rad, ny = e.by + Math.sin(clock * 1.7 + e.ph) * .6;
    e.vx = (nx - e.x) / Math.max(dt, .001); e.vz = (nz - e.z) / Math.max(dt, .001); e.vy = (ny - e.y) / Math.max(dt, .001); e.x = nx; e.z = nz; e.y = ny;
    g.position.set(e.x, e.y, e.z); g.rotation.z = Math.sin(clock * 2 + e.ph) * .08; g.rotation.y += dt * .5;
    if (state === 'play' && Math.hypot(e.x - pig.x, e.y - (pig.y + 1.4), e.z - pig.z) < 2.7) pop();
  };
  function pop() { if (e.dead) return; e.dead = true; burst(e.x, e.y, e.z, col, 14, 6, .7); sfx.pop(); buzz(15); popText('Pop!', e.x, e.y + 1.5, e.z, ''); progress('balloons'); }
  e.onBall = () => { pop(); };
  return e;
}
function C_basic(c, op) { return Chars.basic(c, { opacity: op }); }
/* ---- bowling pins (with googly eyes) */
function spawnPinCluster(size) {
  const c = spot(14, 16), rows = Math.ceil((Math.sqrt(8 * size + 1) - 1) / 2), list = [];
  let made = 0;
  for (let r = 0; r < rows && made < size; r++) for (let k = 0; k <= r && made < size; k++) {
    const x = c.x + (k - r / 2) * 1.35, z = c.z - r * 1.2; made++; list.push(spawnPin(x, z));
  }
  list.forEach(p => p.group = list);
}
function spawnPin(x, z) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; const fall0 = new THREE.Group(); g.add(fall0);
  const wm = M(0xfffdf6, { emissive: 0x181818 });
  part(fall0, GEO.sph, wm, 0, .7, 0, .46, .78, .46); part(fall0, GEO.sph, wm, 0, 1.55, 0, .34, .34, .34); part(fall0, GEO.cyl, MC(0xff4f6a), 0, 1.22, 0, .36, .09, .36);
  part(fall0, GEO.cyl, MC(0xff4f6a), 0, .3, 0, .42, .09, .42);
  for (const s of [-1, 1]) { const ey = Chars.eye(.11); ey.position.set(s * .13, 1.58, .27); fall0.add(ey); }
  const e = addEnt({ kind: 'pin', g, x, z, y: 0, cy: .8, r: 1.0, hittable: true, st: 'stand', t: 0, delay: -1, dir: 0 });
  g.position.set(x, 0, z);
  e.update = dt => {
    if (e.st === 'stand') {
      g.rotation.z = Math.sin(clock * 3 + x) * .03;
      if (e.delay > 0) { e.delay -= dt; if (e.delay <= 0) fall(e.dir); }
      else if (pigNear(e, 1.8, 2)) fall(Math.atan2(e.x - pig.x, e.z - pig.z));
    } else if (e.st === 'fall') {
      e.t += dt; g.rotation.x = Math.min(1.55, e.t * 4.5); if (e.t > 1.1) { burst(e.x, .5, e.z, 0xffffff, 4, 2, .5); e.dead = true; }
    }
  };
  function fall(dir) {
    if (e.st !== 'stand') return; e.st = 'fall'; e.hittable = false; g.rotation.y = dir; sfx.pin(); buzz(10); progress('pins');
    for (const o of ents) if (o.kind === 'pin' && o.st === 'stand' && o.delay < 0 && Math.hypot(o.x - e.x, o.z - e.z) < 2.0) { o.delay = .1 + Math.random() * .12; o.dir = Math.atan2(o.x - e.x, o.z - e.z); }
  }
  e.onBall = b => { fall(Math.atan2(b.vx, b.vz)); };
  return e;
}
/* ---- moving bullseye targets */
let targetTex = null;
function getTargetTex() {
  if (targetTex) return targetTex; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  ['#ffffff', '#ff3d5e', '#ffffff', '#ff3d5e', '#ffd23a'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(64, 64, 64 - i * 13, 0, TAU); g.fill(); });
  targetTex = new THREE.CanvasTexture(cv); targetTex.colorSpace = THREE.SRGBColorSpace; return targetTex;
}
function spawnTarget() {
  const g = new THREE.Group(), s = L.targetSize, c = spot(12, 22), hh = rand(2.4, 2.4 + L.d * 5);
  part(g, GEO.cyl, MC(0x8a5a2a), 0, hh / 2, 0, .18, hh, .18);
  const disc = new THREE.Group(); disc.position.y = hh + s * .2; g.add(disc);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(s, s, .25, 28), [MC(0x8a5a2a), new THREE.MeshBasicMaterial({ map: getTargetTex() }), MC(0x8a5a2a)]); face.rotation.x = Math.PI / 2; disc.add(face);
  const e = addEnt({ kind: 'target', g, disc, bx: c.x, bz: c.z, x: c.x, z: c.z, y: 0, cy: hh + s * .2, r: s + .3, hittable: true, t: rand(0, 6), amp: rand(5, 12), spd: L.targetSpeed * rand(.8, 1.2) * (speedMode ? 1.3 : 1), face: Math.atan2(-c.x, -c.z), hit: 0 });
  g.rotation.y = e.face; const sx = Math.cos(e.face), sz = -Math.sin(e.face);
  e.update = dt => {
    if (e.hit > 0) { e.hit += dt; disc.rotation.x = e.hit * 8; disc.position.y -= dt * 4; if (e.hit > .7) e.dead = true; return; }
    e.t += dt * e.spd; const off = Math.sin(e.t) * e.amp; const nx = e.bx + sx * off, nz = e.bz + sz * off;
    e.vx = (nx - e.x) / Math.max(dt, .001); e.vz = (nz - e.z) / Math.max(dt, .001); e.x = nx; e.z = nz; g.position.set(e.x, 0, e.z);
  };
  e.onBall = () => { e.hit = .01; e.hittable = false; burst(e.x, e.cy, e.z, 0xff3d5e, 10, 5, .6); sfx.thunk(); sfx.pop(); buzz(15); popText('Bullseye!', e.x, e.cy + 2, e.z, 'good'); progress('targets'); };
  return e;
}
/* ---- smiling stars */
let starGeo = null;
function getStarGeo() {
  if (starGeo) return starGeo; const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.PI / 2, r = i % 2 ? .52 : 1; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  starGeo = new THREE.ExtrudeGeometry(sh, { depth: .4, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 3 }); starGeo.translate(0, 0, -.2); return starGeo;
}
function spawnStar() {
  const g = new THREE.Group(), c = spot(6, 14), high = Math.random() < .35 + L.d * .3, y = high ? rand(3.5, 5 + L.d * 3) : 1.5;
  const sg = new THREE.Group(); g.add(sg);
  const m = new THREE.Mesh(getStarGeo(), M(0xffd93a, { emissive: 0x8a6400 })); m.scale.setScalar(1.2); sg.add(m);
  for (const s of [-1, 1]) { const ey = Chars.eye(.14); ey.position.set(s * .24, .1, .42); ey.scale.multiplyScalar(1.0); sg.add(ey); }
  const sm = new THREE.Mesh(new THREE.TorusGeometry(1, .14, 6, 12, Math.PI), Chars.basic(0x6a3a00)); sm.scale.set(.2, .16, .2); sm.position.set(0, -.18, .43); sm.rotation.z = Math.PI; sg.add(sm);
  const e = addEnt({ kind: 'star', g, x: c.x, z: c.z, y, cy: 0, r: 1.4, hittable: true, ph: rand(0, TAU) }); g.position.set(e.x, y, e.z);
  e.update = dt => { sg.rotation.y = Math.sin(clock * 1.6 + e.ph) * .5; sg.rotation.z = Math.sin(clock * 2.2 + e.ph) * .12; g.position.y = e.y + Math.sin(clock * 2 + e.ph) * .3; if (state === 'play' && Math.hypot(e.x - pig.x, e.y - (pig.y + 1.4), e.z - pig.z) < 2.5) take(); };
  function take() { if (e.dead) return; e.dead = true; burst(e.x, e.y, e.z, 0xffe45c, 12, 5, .6); sfx.star(); buzz(10); popText('+1 ⭐', e.x, e.y + 1.5, e.z, 'gold'); progress('stars'); }
  e.onBall = () => { take(); };
  return e;
}
/* ---- flags (Stumble-Guys style: reach the flag across the arena) */
const flagState = { left: 0, active: null, id: 0 };
function spawnFlag() {
  let best = null;
  for (let i = 0; i < 40; i++) { const a = rand(0, TAU), r = rand(38, WORLD - 14), x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 3) || Math.hypot(x - pig.x, z - pig.z) < 40) continue; best = { x, z }; break; }
  if (!best) best = { x: -pig.x * .8, z: -pig.z * .8 - 30 };
  const g = new THREE.Group(), id = ++flagState.id;
  part(g, GEO.cyl, MC(0xffffff), 0, 3, 0, .13, 6, .13); part(g, GEO.sph, MC(0xffd23a, { emissive: 0x806000 }), 0, 6.1, 0, .32);
  const cloth = new THREE.Group(); cloth.position.set(0, 5.2, 0); g.add(cloth); const cm = part(cloth, GEO.box, M(0xff3d6a, { emissive: 0x401020, side: THREE.DoubleSide }), 1.1, 0, 0, 2.2, 1.3, .08);
  const ey = Chars.eye(.2); ey.position.set(1.0, .1, .06); cloth.add(ey); const ey2 = Chars.eye(.2); ey2.position.set(1.0, .1, -.06); ey2.rotation.y = Math.PI; cloth.add(ey2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6a8a, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.y = 30; g.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, .22, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff3d6a })); ring.rotation.x = Math.PI / 2; ring.position.y = .3; g.add(ring);
  const e = addEnt({ kind: 'flag', g, id, x: best.x, z: best.z, y: 0, cy: 3, r: 3, hittable: false, ph: 0 });
  e.update = dt => {
    cloth.rotation.y = Math.sin(clock * 3) * .35; ring.scale.setScalar(1 + Math.sin(clock * 4) * .06); beam.material.opacity = .22 + Math.sin(clock * 5) * .06;
    if (pigNear(e, 3.4, 3.8)) take();
  };
  function take() {
    if (e.dead) return; e.dead = true; flagState.active = null; sfx.flag(); confetti(e.x, 3, e.z, 24); popText('Flag!', e.x, 5, e.z, 'gold'); buzz(25);
    for (const o of ents) if (o.owner === id) o.dead = true; progress('flags');
  }
  flagState.active = e;
  // spinning bars guarding the route near the flag (the "obstacle course")
  const nS = 1 + Math.floor(L.d * 3);
  for (let k = 0; k < nS; k++) { const a = rand(0, TAU), r = rand(9, 14); const sx = best.x + Math.cos(a) * r, sz = best.z + Math.sin(a) * r; if (blocked(sx, sz, 2) || Math.hypot(sx, sz) > WORLD - 6) continue; const sw = spawnSweeper({ x: sx, z: sz }, rand(5, 7.5) + L.d * 2, lerp(1.2, 2.6, L.d)); sw.owner = id; }
  return e;
}
function flagsTick() { if (flagState.left > 0 && !flagState.active) { flagState.left--; spawnFlag(); } }
/* ---- Simon-says music pads (puzzle) */
const SIMON_COL = [0xff4f6a, 0x4fb8ff, 0xffd23a, 0x4fe06a];
const simon = { pads: [], seq: [], phase: 'idle', idx: 0, t: 0, round: 0, rounds: 0, si: 0 };
function simonTex(k) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 8; g.beginPath();
  if (k === 0) g.arc(64, 64, 38, 0, TAU); else if (k === 1) { g.moveTo(64, 24); g.lineTo(104, 100); g.lineTo(24, 100); g.closePath(); } else if (k === 2) g.rect(28, 28, 72, 72);
  else { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? 22 : 46; i ? g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r) : g.moveTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r); } g.closePath(); }
  g.stroke(); g.fill(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function spawnSimon(rounds) {
  simon.pads.length = 0; simon.seq = []; simon.phase = 'start'; simon.t = 1.6; simon.round = 0; simon.rounds = rounds; simon.idx = 0;
  let c = null; for (let i = 0; i < 40; i++) { const a = rand(0, TAU), r = rand(14, 30), x = pig.x + Math.cos(a) * r, z = pig.z + Math.sin(a) * r; if (Math.hypot(x, z) > WORLD - 16 || blocked(x, z, 9)) continue; c = { x, z }; break; }
  if (!c) c = { x: -pig.x * .5, z: -pig.z * .5 - 20 };
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, g = new THREE.Group(), col = SIMON_COL[k];
    const base = part(g, GEO.cyl, M(0x3a3a4a), 0, .25, 0, 2.5, .5, 2.5); const top = part(g, GEO.cyl, M(col, { emissive: 0x000000 }), 0, .62, 0, 2.2, .26, 2.2);
    const sym = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: simonTex(k), transparent: true, depthWrite: false })); sym.rotation.x = -Math.PI / 2; sym.position.y = .78; sym.userData.noOutline = true; g.add(sym);
    const e = addEnt({ kind: 'simonpad', k, g, top, x: c.x + Math.cos(a) * 6.5, z: c.z + Math.sin(a) * 6.5, y: 0, cy: .6, r: 2.6, hittable: true, lit: 0, cool: 0 });
    e.update = dt => {
      e.lit = Math.max(0, e.lit - dt); const on = e.lit > 0; top.material.emissive.setHex(on ? col : 0x000000); top.material.emissiveIntensity = on ? .9 : 0; g.scale.setScalar(on ? 1.08 : 1); top.position.y = on ? .75 : .62;
      e.cool -= dt; if (state === 'play' && e.cool <= 0 && pig.y < 1.6 && Math.hypot(pig.x - e.x, pig.z - e.z) < 2.5) { e.cool = .6; simonHit(k); }
    };
    e.onBall = () => { if (e.cool > 0) return false; e.cool = .35; simonHit(k); };
    simon.pads.push(e);
  }
}
function padLight(k, t) { const p = simon.pads[k]; if (p && !p.dead) { p.lit = t || .5; sfx.note(k); burst(p.x, 1, p.z, SIMON_COL[k], 5, 2, .5); } }
function simonHit(k) {
  if (simon.phase !== 'input') return;
  padLight(k, .4);
  if (k === simon.seq[simon.idx]) { simon.idx++; if (simon.idx >= simon.seq.length) { simon.phase = 'won'; simon.t = 1.3; sfx.flag(); confetti(simon.pads[0].x, 2, simon.pads[0].z, 24); popText('Great tune! 🎵', pig.x, pig.y + 4, pig.z, 'gold'); progress('simon'); } }
  else { sfx.wrong(); buzz(60); popText('Oops! Watch again 👀', pig.x, pig.y + 4, pig.z, 'bad'); timeLeft = Math.max(1, timeLeft - 3); simon.phase = 'wait'; simon.t = 1.0; simon.idx = 0; }
}
function simonTick(dt) {
  if (!simon.pads.length) return; simon.t -= dt;
  if (simon.phase === 'start' && simon.t <= 0) { const len = 3 + simon.round; simon.seq = []; for (let i = 0; i < len; i++) simon.seq.push(Math.floor(Math.random() * 4)); simon.phase = 'show'; simon.si = -1; simon.t = .5; simon.idx = 0; popText('Watch! 👀', pig.x, pig.y + 4, pig.z, ''); }
  else if (simon.phase === 'wait' && simon.t <= 0) { simon.phase = 'show'; simon.si = -1; simon.t = .4; simon.idx = 0; }
  else if (simon.phase === 'show' && simon.t <= 0) {
    simon.si++; if (simon.si >= simon.seq.length) { simon.phase = 'input'; simon.idx = 0; popText('Your turn! 🎹', pig.x, pig.y + 4, pig.z, 'good'); simon.t = 0; }
    else { padLight(simon.seq[simon.si], .5); simon.t = Math.max(.42, .75 - simon.round * .05); }
  }
  else if (simon.phase === 'won' && simon.t <= 0) { simon.round++; if (simon.round < simon.rounds) { simon.phase = 'start'; simon.t = .6; } else simon.phase = 'idle'; }
}

/* ======== 08_enemies.js ======== */
/* ---- naughty foxes (run to the barn) */
const FOX_COLS = [0xff8a2a, 0xe8501a, 0x9a4aff, 0x3a3a52, 0x20b0b0];
function spawnFox() {
  const hp = Math.max(1, Math.min(L.foxHpMax, 1 + Math.floor(Math.random() * (L.foxHpMax + .5)))), col = FOX_COLS[hp - 1] != null ? FOX_COLS[hp - 1] : FOX_COLS[4];
  const rg = Chars.makeFox(col), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true;
  let sx = 0, sz = 0;
  for (let i = 0; i < 30; i++) { const a = rand(0, TAU); sx = Math.cos(a) * 92; sz = Math.sin(a) * 92; if (Math.hypot(sx - GOAL.x, sz - GOAL.z) > 70) break; }
  const e = addEnt({ kind: 'fox', g, rig: rg, x: sx, z: sz, y: 0, cy: 1.1, r: 1.6, hittable: true, hp, spd: lerp(3.4, 7.4, L.d) * L.em * rand(.85, 1.15), ang: Math.atan2(GOAL.x - sx, GOAL.z - sz), st: 'run', t: 0, spin: 0, pcool: 0, hurtT: 0, wob: rand(0, TAU) });
  rg.g.scale.setScalar(.9 + hp * .1);
  e.update = dt => {
    if (e.st === 'fly') { e.vy -= 28 * dt; e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt; g.rotation.x += e.spin * dt; e.t -= dt; g.position.set(e.x, Math.max(0, e.y), e.z); Chars.blinkAll(rg, dt, 1); if ((e.y <= 0 && e.vy < 0) || e.t <= 0) { burst(e.x, .4, e.z, 0xff8a2a, 8, 3, .7); e.dead = true; } return; }
    const dx = GOAL.x - e.x, dz = GOAL.z - e.z, d = Math.hypot(dx, dz);
    if (d < 5.5) { e.dead = true; burst(e.x, 1, e.z, 0x222222, 10, 4, .7); popText('Escaped!', e.x, 3, e.z, 'bad'); foxQueue++; hurtGoal(); return; }
    e.pcool -= dt; e.hurtT -= dt; e.wob += dt * 3;
    const tgt = Math.atan2(dx, dz) + Math.sin(e.wob) * .25; e.ang += angDiff(e.ang, tgt) * Math.min(1, 5 * dt);
    const sp = e.spd * (e.hurtT > 0 ? .25 : 1); e.vx = Math.sin(e.ang) * sp; e.vz = Math.cos(e.ang) * sp; e.x += e.vx * dt; e.z += e.vz * dt; pushOut(e, .9);
    g.rotation.y = e.ang; g.position.set(e.x, Math.abs(Math.sin(clock * 14 + e.wob)) * .18, e.z);
    rg.legs.forEach((l, i) => l.rotation.x = Math.sin(clock * 16 + (i === 0 || i === 3 ? 0 : Math.PI)) * .7); rg.tail.rotation.y = Math.sin(clock * 10) * .5; Chars.blinkAll(rg, dt, e.hurtT > 0 ? .7 : 0);
    if (e.pcool <= 0 && pigNear(e, 2.3, 2.4)) { e.pcool = .6; damage(1, pig.x, pig.z); }
  };
  function damage(n, fx, fz) {
    e.hp -= n; const dx = e.x - fx, dz = e.z - fz, d = Math.hypot(dx, dz) || 1;
    if (e.hp > 0) { e.hurtT = .5; e.x += dx / d * 1.8; e.z += dz / d * 1.8; rg.mat.color.setHex(FOX_COLS[Math.max(0, e.hp - 1)]); sfx.thunk(); burst(e.x, 1.4, e.z, 0xffffff, 4, 3, .5); popText('Hit!', e.x, 3, e.z, ''); return; }
    e.st = 'fly'; e.hittable = false; e.vx = dx / d * 12; e.vz = dz / d * 12; e.vy = 12; e.spin = rand(8, 13); e.t = 1.3; sfx.baa(); sfx.pop(); buzz(20);
    burst(e.x, 1.2, e.z, 0xff8a2a, 12, 5, 1); popText('Shoo!', e.x, 3, e.z, 'good'); progress('foxes');
  }
  e.onBall = b => { damage(1, b.x - b.vx * .1, b.z - b.vz * .1); };
  return e;
}
function hurtGoal() {
  if (state !== 'play') return; hearts--; combo = 0; comboT = 0; shake = .4; sfx.hit(); el.flash.style.opacity = 1; setTimeout(() => el.flash.style.opacity = 0, 120); updateHearts(); if (hearts <= 0) failLevel('The foxes got into the barn! 🦊');
}
/* ---- roaming hazards (mower, rolling ball, crab, ghost, ufo) */
function spawnHazard(i) {
  const t = curTheme, kind = t.haz, rg = Chars.makeHazard(kind, t.hazCol), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true; const rad = rg.rad;
  const pts = [], n = 4 + (i % 3), baseA = rand(0, TAU), R0 = rand(24, 72);
  for (let k = 0; k < n; k++) { const a = baseA + k / n * TAU + rand(-.3, .3), r = R0 + rand(-14, 14); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const e = addEnt({ kind: 'hazard', g, rig: rg, x: pts[0][0], z: pts[0][1], y: 0, cy: 1, r: rad, hittable: false, wp: 0, ang: 0, pts, cool: 0, fl: rg.fl });
  e.update = dt => {
    const w = e.pts[e.wp], dx = w[0] - e.x, dz = w[1] - e.z, d = Math.hypot(dx, dz); if (d < 2.5) e.wp = (e.wp + 1) % e.pts.length;
    e.ang += angDiff(e.ang, Math.atan2(dx, dz)) * Math.min(1, 2.5 * dt); const sp = L.hazSpeed * (speedMode ? 1.2 : 1); e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, rad); keepInWorld(e, WORLD + 5);
    g.position.set(e.x, e.fl ? Math.sin(clock * 3 + i) * .4 : 0, e.z); g.rotation.y = e.ang; if (rg.blade) rg.blade.rotation.y += 25 * dt; if (rg.roll) rg.roll.rotation.x += sp * dt / 1.5;
    Chars.blinkAll(rg, dt);
    if (kind === 'mower' && Math.random() < dt * 14) emit(e.x, .4, e.z, rand(-1, 1), rand(.5, 1.5), rand(-1, 1), .5, 0x7bcf4a, .5, 1);
    e.cool -= dt; if (state === 'play' && pig.y < 2.2 && Math.hypot(pig.x - e.x, pig.z - e.z) < rad + 1) hurtPig(e.x, e.z, 22);
  };
  g.position.set(e.x, 0, e.z); return e;
}
/* ---- pickups */
const pickupTex = {};
function emojiTex(ch) {
  if (pickupTex[ch]) return pickupTex[ch]; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.94)'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.strokeStyle = '#ffd23a'; g.lineWidth = 6; g.stroke(); g.font = '78px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (pickupTex[ch] = t);
}
let magnetT = 0;
function spawnPickup(px, pz, force) {
  const kinds = ['clock', 'triple', 'magnet']; if (hearts < 3) kinds.push('heart', 'heart');
  const k = force || pick(kinds), ch = { clock: '⏰', heart: '❤️', triple: '✨', magnet: '🧲' }[k];
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ch), depthWrite: false })); sp.scale.set(2.9, 2.9, 1); const g = new THREE.Group(); g.add(sp);
  const a = rand(0, TAU), r = rand(9, 28); let x = px != null ? px : pig.x + Math.cos(a) * r, z = pz != null ? pz : pig.z + Math.sin(a) * r; const q = { x, z }; keepInWorld(q, WORLD - 6);
  const e = addEnt({ kind: 'pickup', g, x: q.x, z: q.z, y: 2, cy: 0, r: 1.5, life: 16, ph: rand(0, TAU) }); g.position.set(e.x, 2, e.z);
  e.update = dt => {
    e.life -= dt; g.position.y = 2 + Math.sin(clock * 3 + e.ph) * .4; sp.visible = e.life > 3 || Math.floor(clock * 6) % 2 === 0; if (e.life <= 0) e.dead = true;
    if (state === 'play' && Math.hypot(e.x - pig.x, e.y - (pig.y + 1.3), e.z - pig.z) < 3) {
      e.dead = true; sfx.power(); burst(e.x, 2, e.z, 0xffffff, 10, 5, .6);
      if (k === 'clock') { timeLeft += 6; popText('+6s', e.x, 3, e.z, 'good'); } else if (k === 'heart') { hearts = Math.min(3, hearts + 1); updateHearts(); popText('+❤️', e.x, 3, e.z, 'good'); } else if (k === 'magnet') { magnetT = 12; popText('Coin magnet! 🧲', e.x, 3, e.z, 'gold'); } else { tripleT = 9; popText('Triple shot!', e.x, 3, e.z, 'gold'); }
    }
  };
  return e;
}

/* ============================================================ v5.2 new missions: gift boxes + lost chicks */
const GIFT_COLS = [0xff6ab0, 0x4ab8ff, 0x7ad84a, 0xffa03a, 0xb08aff];
function spawnGift() {
  const rg = Chars.makeGift(pick(GIFT_COLS)), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true;
  const c = spot(8, 12), e = addEnt({ kind: 'gift', g, rig: rg, x: c.x, z: c.z, y: 0, cy: 1.2, r: 1.7, hittable: true, ph: rand(0, TAU), hopT: rand(.6, 3), hop: 0 });
  e.update = dt => {
    e.ph += dt; e.hopT -= dt; if (e.hopT <= 0) { e.hopT = rand(2.4, 5); e.hop = 1; sfx.squeak(); } if (e.hop > 0) e.hop = Math.max(0, e.hop - dt * 1.5);
    const hs = Math.sin(e.hop * Math.PI), sq = 1 - hs * .1;
    g.position.set(e.x, hs * 1.5, e.z); rg.body.scale.set(1 + (1 - sq) * .8, sq + (e.hop > 0 ? 0 : Math.sin(e.ph * 3) * .015), 1 + (1 - sq) * .8); g.rotation.y = Math.sin(e.ph * 1.7) * .3 + e.hop * 1.6;
    Chars.blinkAll(rg, dt); for (const ey of rg.eyes) ey.look(Math.sin(e.ph) * .6, 0);
    if (state === 'play' && Math.hypot(pig.x - e.x, pig.z - e.z) < 2.9 && pig.y < 2.6) take();
  };
  function take() {
    if (e.dead) return; e.dead = true; burst(e.x, 1.5, e.z, pick(GIFT_COLS), 14, 6, .9); confetti(e.x, 2, e.z, 22); sfx.sparkle(); buzz(15); popText('Surprise! 🎁', e.x, 3.4, e.z, 'gold');
    for (let i = 0; i < 2; i++) spawnCoin(e.x + rand(-2, 2), e.z + rand(-2, 2), 1.6);
    progress('gifts');
  }
  e.onBall = () => { take(); };
  return e;
}
const chickGrp = { followers: [] };
function spawnChicks(n) { chickGrp.followers.length = 0; for (let k = 0; k < n; k++) spawnChick(); }
function spawnChick() {
  const rg = Chars.makeChick(), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true; rg.g.scale.setScalar(1.15);
  const c = spot(12, 14), e = addEnt({ kind: 'chick', g, rig: rg, x: c.x, z: c.z, y: 0, cy: .8, r: 1.4, hittable: false, st: 'lost', ang: rand(0, TAU), wait: rand(0, 2), moving: false, ph: rand(0, TAU), peep: rand(1.5, 4), t: 0 });
  e.update = dt => {
    e.ph += dt; const F = chickGrp.followers; let sp = 0;
    if (e.st === 'home') { e.t += dt; const k = Math.min(1, e.t / .8); g.position.set(e.x, Math.sin(k * Math.PI) * 3.2, e.z); g.scale.setScalar(1 - k * .7); g.rotation.y += dt * 12; if (e.t > .8) e.dead = true; return; }
    if (e.st === 'lost') {
      e.wait -= dt; if (e.wait <= 0) { e.moving = !e.moving; e.wait = e.moving ? rand(.8, 1.8) : rand(.8, 2); if (e.moving) e.ang = rand(0, TAU); } if (e.moving) sp = 2.2;
      e.peep -= dt; if (e.peep <= 0) { e.peep = rand(2.5, 5); popText('Peep!', e.x, 2.9, e.z, ''); sfx.peep(); }
      if (state === 'play' && Math.hypot(pig.x - e.x, pig.z - e.z) < 3.3 && pig.y < 2.6) { e.st = 'follow'; F.push(e); sfx.sparkle(); burst(e.x, 1.2, e.z, 0xffe45c, 8, 3, .6); popText('Peep peep! 💕', e.x, 3, e.z, 'gold'); }
    } else {
      const i = F.indexOf(e), lead = i <= 0 ? pig : F[i - 1], dx = lead.x - e.x, dz = lead.z - e.z, d = Math.hypot(dx, dz) || 1, want = i <= 0 ? 2.6 : 1.7;
      if (d > want) { sp = clamp((d - want) * 6, 0, 16); e.ang = Math.atan2(dx, dz); }
      if (Math.hypot(e.x - GOAL.x, e.z - GOAL.z) < 5.4) { F.splice(F.indexOf(e), 1); e.st = 'home'; e.t = 0; sfx.star(); confetti(e.x, 2, e.z, 14); popText('Home sweet home! 🏠', e.x, 3.6, e.z, 'good'); progress('chicks'); return; }
    }
    e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, .6); keepInWorld(e, WORLD);
    g.position.set(e.x, sp > 0 ? Math.abs(Math.sin(clock * 14 + e.ph)) * .5 : Math.sin(clock * 3 + e.ph) * .04, e.z); g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 12 * dt);
    rg.wings.forEach((w, k) => { w.rotation.z = (k ? 1 : -1) * (sp > 0 ? .5 + Math.sin(clock * 32) * .45 : .08); }); Chars.blinkAll(rg, dt);
  };
  return e;
}
/* ---- wacky baddies */
const waves = { queue: 0, size: 3, num: 0, total: 1, timer: 0, cool: 0 };
function enemyDown(e, col, txt) {
  e.dead = true; burst(e.x, 1.3, e.z, col, 14, 6, 1.1); confetti(e.x, 1.6, e.z, 10); popText(txt, e.x, 3, e.z, 'good'); sfx.pop(); sfx.zap(); buzz(20);
  if (e.mission && objs.some(o => o.type === 'baddies')) progress('baddies');
}
function edgeSpawn(minD) { for (let i = 0; i < 30; i++) { const a = rand(0, TAU), x = Math.cos(a) * rand(40, 85), z = Math.sin(a) * rand(40, 85); if (Math.hypot(x - pig.x, z - pig.z) > minD && !blocked(x, z, 2)) return { x, z }; } return { x: 60, z: 60 }; }
function ringSpawn(minD, maxD) { for (let i = 0; i < 30; i++) { const a = rand(0, TAU), r = rand(minD, maxD), x = pig.x + Math.cos(a) * r, z = pig.z + Math.sin(a) * r; if (Math.hypot(x, z) < WORLD - 4 && !blocked(x, z, 2)) return { x, z }; } return edgeSpawn(minD); }
function wrapEnemy(rg) { const g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true; return g; }
function spawnSlime(size, at, mission) {
  size = size || 2; const rg = Chars.makeSlime(size), g = wrapEnemy(rg), sc = rg.sc;
  const p = at || ringSpawn(26, 40);
  const e = addEnt({ kind: 'enemy', sub: 'slime', g, rig: rg, x: p.x, z: p.z, y: 0, cy: .9 * sc, r: 1.6 * sc, hittable: true, size, mission, hop: rand(0, 1), ang: 0, hp: 1, cool: 0 });
  e.update = dt => {
    e.hop += dt * (.8 + L.em * .35); if (e.hop > 1) { e.hop -= 1; e.ang = Math.atan2(pig.x - e.x, pig.z - e.z) + rand(-.5, .5); }
    const jmp = Math.sin(e.hop * Math.PI), sp = (3 + L.d * 5) * (size === 2 ? .8 : 1.15) * L.em; e.x += Math.sin(e.ang) * sp * jmp * dt; e.z += Math.cos(e.ang) * sp * jmp * dt; pushOut(e, e.r * .6); keepInWorld(e, WORLD + 8);
    e.y = jmp * 1.6; g.position.set(e.x, e.y, e.z); g.scale.set(1 + (1 - jmp) * .25, 1 - (1 - jmp) * .3 + jmp * .15, 1 + (1 - jmp) * .25); g.rotation.y = e.ang;
    Chars.blinkAll(rg, dt); for (const ey of rg.eyes) ey.look(0, jmp * .4);
    e.cool -= dt; if (e.cool <= 0 && pigNear(e, e.r + 1.1, 2.2 + e.y)) { e.cool = .8; hurtPig(e.x, e.z, 18); }
  };
  e.onBall = b => {
    if (size === 2) { e.dead = true; burst(e.x, 1.2, e.z, 0x4bd86a, 12, 5, 1); sfx.boing(); popText('Split!', e.x, 3, e.z, ''); for (let k = 0; k < 2; k++) spawnSlime(1, { x: e.x + (k ? 1.5 : -1.5), z: e.z }, false); if (e.mission && objs.some(o => o.type === 'baddies')) progress('baddies'); }
    else enemyDown(e, 0x86f08a, 'Splat!');
  };
  return e;
}
function spawnBat(at, mission) {
  const rg = Chars.makeBat(), g = wrapEnemy(rg); const p = at || ringSpawn(28, 42);
  const e = addEnt({ kind: 'enemy', sub: 'bat', g, rig: rg, x: p.x, z: p.z, y: 5, cy: 0, r: 1.6, hittable: true, mission, st: 'circle', t: rand(1.5, 3.2), ph: rand(0, TAU), ang: 0, cool: 0 });
  e.update = dt => {
    const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz), sp = (6 + L.d * 6) * L.em;
    e.ph += dt * 4; rg.wingL.rotation.z = Math.sin(e.ph * 3) * .6; rg.wingR.rotation.z = -Math.sin(e.ph * 3) * .6;
    if (e.st === 'circle') {
      const want = Math.atan2(dx, dz) + (d > 14 ? 0 : 1.4); e.ang += angDiff(e.ang, want) * Math.min(1, 3 * dt); e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; e.y += (5 + Math.sin(e.ph) * .7 - e.y) * Math.min(1, 3 * dt); e.t -= dt;
      if (e.t <= 0 && d < 24) { e.st = 'dive'; e.t = 1.1; e.ang = Math.atan2(dx, dz); }
    } else if (e.st === 'dive') {
      e.t -= dt; e.x += Math.sin(e.ang) * sp * 2 * dt; e.z += Math.cos(e.ang) * sp * 2 * dt; e.y += (1.4 - e.y) * Math.min(1, 6 * dt); if (e.t <= 0) { e.st = 'circle'; e.t = rand(2, 4); }
    }
    e.cy = 0; keepInWorld(e, WORLD + 15); g.position.set(e.x, e.y, e.z); g.rotation.y = e.ang; g.rotation.z = Math.sin(e.ph) * .1; Chars.blinkAll(rg, dt);
    e.cool -= dt; if (e.cool <= 0 && Math.hypot(e.x - pig.x, e.z - pig.z) < 2.4 && Math.abs(e.y - (pig.y + 1.4)) < 2.2) { e.cool = 1; hurtPig(e.x, e.z, 16); }
  };
  e.onBall = () => { enemyDown(e, 0x8a5ad8, 'Bat-tastic!'); };
  return e;
}
function spawnMole(at, mission) {
  const rg = Chars.makeMole(), g = wrapEnemy(rg), body = rg.body, p = at || spot(18, 16);
  const e = addEnt({ kind: 'enemy', sub: 'mole', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.2, r: 1.6, hittable: false, mission, st: 'hide', t: rand(.5, 2), pop: 0, tgt: null, cool: 0 });
  body.position.y = -2.6;
  e.update = dt => {
    e.t -= dt;
    if (e.st === 'hide') { e.pop = Math.max(0, e.pop - dt * 3); if (e.t <= 0) { e.st = 'rumble'; e.t = 1.0; const a = rand(0, TAU), r = rand(5, 12); const q = { x: pig.x + Math.cos(a) * r, z: pig.z + Math.sin(a) * r }; keepInWorld(q, WORLD - 6); if (blocked(q.x, q.z, 2)) { q.x = pig.x; q.z = pig.z + 7; } e.x = q.x; e.z = q.z; } }
    else if (e.st === 'rumble') { e.pop = 0; if (Math.random() < dt * 14) emit(e.x, .3, e.z, rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5), .5, 0x7a5236, .6, 0); if (e.t <= 0) { e.st = 'up'; e.t = 2.2 - L.d * .7; sfx.boing(); } }
    else if (e.st === 'up') { e.pop = Math.min(1, e.pop + dt * 6); if (e.pop > .6) e.hittable = true; if (e.t <= 0) { e.st = 'hide'; e.hittable = false; e.t = rand(1.2, 3.2 - L.d); } e.cool -= dt; if (e.cool <= 0 && pigNear(e, 2.7, 3)) { e.cool = 1; hurtPig(e.x, e.z, 16); } }
    body.position.y = -2.6 + e.pop * 2.6; g.position.set(e.x, 0, e.z); g.rotation.y = Math.atan2(pig.x - e.x, pig.z - e.z); e.hideSh = e.pop < .1; Chars.blinkAll(rg, dt);
  };
  e.onBall = () => { if (e.pop < .6) return false; enemyDown(e, 0x7a5236, 'Whack!'); };
  return e;
}
function spawnBomber(at, mission) {
  const rg = Chars.makeBomber(), g = wrapEnemy(rg), bm = rg.bm, p = at || ringSpawn(26, 40);
  const e = addEnt({ kind: 'enemy', sub: 'bomber', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.2, r: 1.6, hittable: true, mission, fuse: 0, ang: 0 });
  e.update = dt => {
    const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz); e.ang += angDiff(e.ang, Math.atan2(dx, dz)) * Math.min(1, 4 * dt);
    const sp0 = (3.2 + L.d * 3.5) * L.em * (e.fuse > 0 ? .4 : 1); e.x += Math.sin(e.ang) * sp0 * dt; e.z += Math.cos(e.ang) * sp0 * dt; pushOut(e, 1); keepInWorld(e, WORLD + 8);
    if (e.fuse === 0 && d < 7) { e.fuse = 2.2 - L.d * .8; sfx.thunk(); popText('Tick tick!', e.x, 4, e.z, 'bad'); }
    if (e.fuse > 0) {
      e.fuse -= dt; const f = 1 + Math.sin(clock * (14 + (2.2 - e.fuse) * 10)) * .25; g.scale.setScalar(f); const on = Math.floor(clock * 12) % 2; bm.color.setHex(on ? 0xdd3322 : 0x2a2a3c);
      if (e.fuse <= 0) { e.dead = true; burst(e.x, 1.5, e.z, 0xff9a2a, 22, 9, 1.4); burst(e.x, 1.5, e.z, 0x333333, 10, 5, 1.2); sfx.hit(); shake = .35; if (Math.hypot(pig.x - e.x, pig.z - e.z) < 6.2 && pig.y < 3) hurtPig(e.x, e.z, 24); if (e.mission && objs.some(o => o.type === 'baddies')) progress('baddies'); }
    }
    g.rotation.y = e.ang; g.position.set(e.x, Math.abs(Math.sin(clock * 9)) * .25, e.z); rg.spark.visible = Math.floor(clock * 20) % 3 !== 0; Chars.blinkAll(rg, dt);
  };
  e.onBall = () => { enemyDown(e, 0xff9a2a, 'Defused!'); };
  return e;
}
function spawnHedgehog(at, mission) {
  const rg = Chars.makeHedgehog(), g = wrapEnemy(rg), p = at || ringSpawn(26, 40);
  const e = addEnt({ kind: 'enemy', sub: 'hedgehog', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1, r: 1.7, hittable: true, mission, hp: 2, st: 'walk', t: rand(1.5, 3), ang: 0, cool: 0, spinA: 0 });
  e.update = dt => {
    const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1; e.t -= dt; let sp = 0;
    if (e.st === 'walk') { e.ang += angDiff(e.ang, Math.atan2(dx, dz)) * Math.min(1, 5 * dt); sp = (3 + L.d * 2.5) * L.em; rg.feet.forEach((f, i) => f.position.z = .6 + Math.sin(clock * 12 + i * Math.PI) * .2); rg.body.rotation.x *= .85; if (e.t <= 0 && d < 24) { e.st = 'curl'; e.t = .7; popText('!', e.x, 3.4, e.z, 'bad'); sfx.whoosh(); } }
    else if (e.st === 'curl') { e.ang += angDiff(e.ang, Math.atan2(dx, dz)) * Math.min(1, 8 * dt); rg.body.scale.set(1, .85, 1); e.spinA += dt * 20; rg.body.rotation.x = e.spinA; if (e.t <= 0) { e.st = 'roll'; e.t = 1.3; e.rollAng = e.ang; } }
    else if (e.st === 'roll') { sp = (11 + L.d * 5) * L.em; e.spinA += dt * 22; rg.body.rotation.x = e.spinA; e.ang = e.rollAng; if (e.t <= 0) { e.st = 'dizzy'; e.t = 1.2; rg.body.scale.set(1, 1, 1); rg.body.rotation.x = 0; } }
    else if (e.st === 'dizzy') { rg.body.rotation.z = Math.sin(clock * 12) * .15; if (e.t <= 0) { e.st = 'walk'; e.t = rand(2, 3.5); rg.body.rotation.z = 0; } }
    e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, 1.2); keepInWorld(e, WORLD + 5);
    g.position.set(e.x, 0, e.z); g.rotation.y = e.ang; Chars.blinkAll(rg, dt, e.st === 'dizzy' ? .6 : 0);
    e.cool -= dt; if (e.cool <= 0 && pigNear(e, e.r + 1, 2.4)) { e.cool = .9; hurtPig(e.x, e.z, e.st === 'roll' ? 24 : 16); }
  };
  e.onBall = () => { e.hp--; if (e.hp > 0) { sfx.thunk(); burst(e.x, 1.4, e.z, 0xffffff, 5, 3, .5); popText('Ow!', e.x, 3.2, e.z, ''); e.st = 'dizzy'; e.t = 1.2; return true; } enemyDown(e, 0x9a6a4a, 'Pricked!'); };
  return e;
}

/* ============================================================ v5.2 new villains: grumpy-cute, never scary */
const popK = a => { const t = Math.min(1, a / .38); return t >= 1 ? 1 : 1 + Math.sin(t * Math.PI) * .22 - (1 - t) * (1 - t) * .9; };   // little bouncy "boop!" when they appear
const lobGeo = new THREE.SphereGeometry(.9, 12, 9), lobRing = new THREE.RingGeometry(2.0, 2.5, 32);
/* a snowball / sprinkle lobbed in an arc: a red ring on the ground shows where it will land */
function spawnLob(sx, sy, sz, tx, tz, T, col, dmg) {
  const g = new THREE.Group(), m = new THREE.Mesh(lobGeo, M(col, { emissive: new THREE.Color(col).multiplyScalar(.25).getHex() })); g.add(m); Chars.outline(g, .08);
  const ring = new THREE.Mesh(lobRing, new THREE.MeshBasicMaterial({ color: 0xff4f4f, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(tx, .12, tz); scene.add(ring);
  const e = addEnt({ kind: 'lob', g, x: sx, z: sz, y: sy, cy: 0, r: 1, t: 0 });
  e.cleanup = () => { scene.remove(ring); ring.material.dispose(); };
  e.update = dt => {
    e.t += dt; const k = Math.min(1, e.t / T);
    e.x = lerp(sx, tx, k); e.z = lerp(sz, tz, k); e.y = lerp(sy, .8, k) + Math.sin(k * Math.PI) * 6.5; g.position.set(e.x, e.y, e.z); m.rotation.x += dt * 6;
    ring.material.opacity = .3 + .25 * Math.sin(clock * 16); ring.scale.setScalar(.85 + .15 * Math.sin(clock * 16 + 1));
    if (k >= 1) {
      e.dead = true; burst(tx, .6, tz, col, 14, 6, .9); sfx.thunk();
      if (state === 'play' && Math.hypot(pig.x - tx, pig.z - tz) < 2.7 && pig.y < 1.6) hurtPig(tx, tz, dmg || 16);
    }
  };
  return e;
}

/* Grumpy Cupcake: waddles in, squats, squirts three sprinkle shots. In dash levels it just patrols (stomp it!). */
function spawnCupcake(at, mission, patrol) {
  const rg = Chars.makeCupcake(), g = wrapEnemy(rg), p = at || ringSpawn(24, 38);
  const e = addEnt({ kind: 'enemy', sub: 'cupcake', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.5, r: 1.5, hittable: true, mission, st: 'walk', t: rand(1.6, 3), ang: 0, cool: 0, ph: rand(0, TAU), x0: p.x, amp: patrol || 0, age: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age);
    if (e.st === 'squash') { e.t -= 0; g.scale.set(1.3 * bk, .22, 1.3 * bk); if (e.t <= -.45) { burst(e.x, .5, e.z, 0xff8ec9, 8, 3, .6); e.dead = true; } return; }
    const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let sq = 0, moving = false;
    if (e.amp) { e.x = e.x0 + Math.sin(e.ph * 1.4) * e.amp; g.rotation.y = Math.cos(e.ph * 1.4) > 0 ? Math.PI / 2 : -Math.PI / 2; moving = true; }
    else if (e.st === 'walk') {
      e.ang += angDiff(e.ang, want) * Math.min(1, 5 * dt); const sp = d > 11 ? (2.6 + L.d * 2.2) * L.em : -1.4 * L.em; moving = true;
      e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, .9); keepInWorld(e, WORLD + 8);
      if (e.t <= 0 && d < 28) { e.st = 'aim'; e.t = .85; sfx.thunk(); popText('!', e.x, 4.6, e.z, 'bad'); }
    } else if (e.st === 'aim') {                    // squat and wobble: the warning
      e.ang += angDiff(e.ang, want) * Math.min(1, 8 * dt); const k = 1 - e.t / .85; sq = Math.sin(Math.min(1, k) * Math.PI * .85) * .3;
      if (e.t <= 0) {
        const spd = 9 + L.d * 3.5; sfx.zap(); for (let i = -1; i <= 1; i++) { const a = e.ang + i * .32; addProj(e.x + Math.sin(a) * 1.5, 1.9, e.z + Math.cos(a) * 1.5, Math.sin(a) * spd, 0, Math.cos(a) * spd, i === 0 ? 0xff4f9a : (i < 0 ? 0x4fd0ff : 0xffe45c), 4.2); }
        e.st = 'walk'; e.t = rand(2.4, 3.8) / (1 + L.d * .4);
      }
    }
    if (!e.amp) g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 10 * dt);
    g.position.set(e.x, moving ? Math.abs(Math.sin(clock * 9 + e.ph)) * .14 : 0, e.z); g.scale.set((1 + sq * .7) * bk, (1 - sq) * bk, (1 + sq * .7) * bk);
    rg.top.rotation.z = Math.sin(clock * 6 + e.ph) * .06; rg.feet.forEach((f, i) => f.position.z = .22 + (moving ? Math.sin(clock * 11 + i * Math.PI) * .22 : 0)); Chars.blinkAll(rg, dt);
    e.cool -= dt;
    if (state === 'play') { const dd = Math.hypot(pig.x - e.x, pig.z - e.z); if (dd < e.r + .9) { if (pig.y > .35 && pig.y < 3.6 && pig.vy < 2) { pig.vy = 15; pig.grounded = false; down(true); } else if (pig.y < 1.6 && e.cool <= 0) { e.cool = .9; hurtPig(e.x, e.z, 16); } } }
  };
  function down(stomp) { if (e.st === 'squash') return; e.st = 'squash'; e.t = 0; e.hittable = false; sfx.stomp(); confetti(e.x, 1.8, e.z, 16); popText(stomp ? 'Stomp!' : 'Sweet!', e.x, 3.2, e.z, 'good'); for (let i = 0; i < 2; i++) spawnCoin(e.x + rand(-1.5, 1.5), e.z + rand(-1.5, 1.5), 1.6); if (e.mission && objs.some(o => o.type === 'baddies')) progress('baddies'); }
  e.onBall = () => { if (e.st !== 'squash') down(false); };
  return e;
}

/* Snowball Sam: keeps his distance and lobs snowballs (watch the red ring!). Two bonks: first knocks his hat off. */
function spawnSnowman(at, mission) {
  const rg = Chars.makeSnowman(), g = wrapEnemy(rg), p = at || ringSpawn(28, 42);
  const e = addEnt({ kind: 'enemy', sub: 'snowman', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.7, r: 1.7, hittable: true, mission, hp: 2, st: 'walk', t: rand(1.4, 2.6), ang: 0, ph: rand(0, TAU), cool: 0, tx: 0, tz: 0, age: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let sp = 0, lean = 0;
    e.ang += angDiff(e.ang, want) * Math.min(1, 4 * dt);
    if (e.st === 'walk') {
      sp = d > 15 ? (2.4 + L.d * 1.6) * L.em : d < 8 ? -2 * L.em : 0; rg.armL.rotation.z = Math.sin(clock * 5) * .25; rg.armR.rotation.z = -Math.sin(clock * 5) * .25;
      if (e.t <= 0 && d < 34) { e.st = 'wind'; e.t = .95; e.tx = pig.x + pig.vx * .55; e.tz = pig.z + pig.vz * .55; popText('Snowball!', e.x, 5, e.z, 'bad'); sfx.whoosh(); }
    } else if (e.st === 'wind') { const k = 1 - e.t / .95; rg.armR.rotation.z = -k * 2.5; rg.armL.rotation.z = k * .6; lean = -k * .3; if (e.t <= 0) { spawnLob(e.x + Math.sin(e.ang) * 1.2, 3.4, e.z + Math.cos(e.ang) * 1.2, e.tx, e.tz, 1.15, 0xffffff, 16); e.st = 'throw'; e.t = .35; sfx.zap(); } }
    else if (e.st === 'throw') { const k = e.t / .35; rg.armR.rotation.z = -2.5 * k + .8 * (1 - k); lean = .35 * (1 - k); if (e.t <= 0) { e.st = 'walk'; e.t = rand(2.6, 4.2) / (1 + L.d * .5); } }
    else if (e.st === 'dizzy') { rg.body.rotation.z = Math.sin(clock * 14) * .15; rg.armL.rotation.z = Math.sin(clock * 9) * .8; rg.armR.rotation.z = -Math.sin(clock * 9) * .8; if (e.t <= 0) { e.st = 'walk'; e.t = rand(1.2, 2.4); rg.body.rotation.z = 0; } }
    if (e.st !== 'dizzy') rg.body.rotation.z = Math.sin(clock * 6) * (sp ? .05 : 0);
    rg.body.rotation.x += (lean - rg.body.rotation.x) * Math.min(1, 12 * dt);
    e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, 1.1); keepInWorld(e, WORLD + 8);
    g.position.set(e.x, sp ? Math.abs(Math.sin(clock * 6 + e.ph)) * .1 : 0, e.z); g.rotation.y = e.ang; g.scale.setScalar(bk); Chars.blinkAll(rg, dt, e.st === 'dizzy' ? .6 : 0);
    e.cool -= dt; if (e.cool <= 0 && pigNear(e, e.r + .9, 2.8)) { e.cool = 1; hurtPig(e.x, e.z, 16); }
  };
  e.onBall = () => {
    e.hp--; if (e.hp > 0) { sfx.thunk(); burst(e.x, 3.2, e.z, 0xffffff, 10, 5, .7); rg.hat.visible = false; const h = spawnHatFly(e.x, e.z); e.st = 'dizzy'; e.t = 1.3; popText('Brrr!', e.x, 4.4, e.z, ''); return true; }
    burst(e.x, 1.6, e.z, 0xbfe0ff, 18, 7, 1); enemyDown(e, 0xffffff, 'Snow-tastic!');
  };
  return e;
}
function spawnHatFly(x, z) {
  const g = new THREE.Group(), hm = Chars.toon(0x2a2440, { rim: 0x8a80c0 }); const c = new THREE.Mesh(Chars.G.cyl, hm); c.scale.set(.5, .8, .5); g.add(c); const b = new THREE.Mesh(Chars.G.cyl, hm); b.scale.set(.8, .09, .8); b.position.y = -.4; g.add(b); Chars.outline(g, .05);
  const e = addEnt({ kind: 'fx', g, x, z, y: 3.2, cy: 0, r: .5, vx: rand(-3, 3), vz: rand(-3, 3), vy: 9, t: 0 });
  e.update = dt => { e.vy -= 24 * dt; e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt; g.rotation.x += dt * 7; g.rotation.z += dt * 5; g.position.set(e.x, Math.max(.2, e.y), e.z); if (e.y <= .2 && e.vy < 0) { e.vy = 0; e.vx = e.vz = 0; e.t += dt; if (e.t > 3) e.dead = true; g.rotation.set(.2, g.rotation.y, 0); } };
  return e;
}

/* Jack-in-the-Box: hops about like a closed box (shots just go "clunk"), then pops its grinning head out on a spring. */
function spawnJack(at, mission, fixed) {
  const rg = Chars.makeJack(), g = wrapEnemy(rg), p = at || ringSpawn(22, 36);
  const e = addEnt({ kind: 'enemy', sub: 'jack', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.2, r: 1.6, hittable: true, mission, hp: 2, st: 'hop', t: rand(.8, 1.8), hopT: rand(0, 1), ang: 0, cool: 0, popT: 0, age: 0, fixed: !!fixed });
  e.update = dt => {
    e.age += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1; let jy = 0, sxz = 1, sy = 1;
    if (e.st === 'hop') {
      if (!e.fixed) { e.hopT += dt * 1.5; if (e.hopT > 1) { e.hopT -= 1; e.ang = Math.atan2(dx, dz) + rand(-.4, .4); } const j = Math.sin(e.hopT * Math.PI), sp = (4.6 + L.d * 3) * L.em; e.x += Math.sin(e.ang) * sp * j * dt; e.z += Math.cos(e.ang) * sp * j * dt; pushOut(e, 1); keepInWorld(e, WORLD + 8); jy = j * 1.3; sy = 1 + j * .1 - (1 - j) * .12; sxz = 1 - j * .05 + (1 - j) * .06; }
      rg.crank.rotation.x += dt * 7; const trig = e.fixed ? (dz > 0 && dz < 17 && Math.abs(dx) < 5) : d < 10;
      if (trig && e.t <= 0) { e.st = 'wind'; e.t = .8; popText('!', e.x, 4.5, e.z, 'bad'); sfx.thunk(); }
    } else if (e.st === 'wind') { rg.setExt(0); rg.lid.rotation.x = -(1 - e.t / .8) * .55; g.rotation.z = Math.sin(clock * 45) * .07 * (1 - e.t / .8); rg.crank.rotation.x += dt * 16; if (e.t <= 0) { e.st = 'pop'; e.t = e.fixed ? 2.4 : 1.7 - L.d * .5; e.popT = 0; sfx.boing(); g.rotation.z = 0; } }
    else if (e.st === 'pop') { e.popT += dt; rg.setExt(1 - Math.exp(-e.popT * 9) * Math.cos(e.popT * 17)); rg.head.rotation.z = Math.sin(clock * 7) * .12; rg.head.rotation.y = Math.atan2(dx, dz) - g.rotation.y; if (e.t <= 0) { e.st = 'retract'; e.t = .45; } }
    else if (e.st === 'retract') { rg.setExt(Math.max(0, e.t / .45)); if (e.t <= 0) { rg.setExt(0); e.st = 'hop'; e.t = rand(1.6, 3); } }
    if (!e.fixed && e.st === 'hop') g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 8 * dt);
    g.position.set(e.x, jy, e.z); g.scale.set(sxz * bk, sy * bk, sxz * bk); rg.eyes.forEach(ey => ey.look(Math.sin(clock * 2) * .3, 0)); Chars.blinkAll(rg, dt);
    e.cool -= dt; const ext = rg.ext || 0;
    if (state === 'play' && e.cool <= 0 && pig.y < 6 && Math.hypot(pig.x - e.x, pig.z - e.z) < (ext > .6 ? 3 : 2.1)) { e.cool = 1; hurtPig(e.x, e.z, 18); }
  };
  e.onBall = b => {
    if ((rg.ext || 0) < .6) { sfx.clank(); popText('Clunk!', e.x, 3.6, e.z, ''); burst(b.x, b.y, b.z, 0xffd93a, 4, 3, .5); return; }
    e.hp--; if (e.hp > 0) { sfx.boing(); popText('Boing!', e.x, 6, e.z, ''); e.st = 'retract'; e.t = .45; return true; }
    burst(e.x, 4, e.z, 0xffd93a, 18, 7, 1); confetti(e.x, 4, e.z, 22); enemyDown(e, 0x7a4ad8, 'Surprise!');
  };
  return e;
}

/* Buzzy Bee: lazy figure-eights around Piggy, then a quick swoop. One bonk and it's gone. */
function spawnBee(at, mission) {
  const rg = Chars.makeBee(), g = wrapEnemy(rg), p = at || ringSpawn(26, 40);
  const e = addEnt({ kind: 'enemy', sub: 'bee', g, rig: rg, x: p.x, z: p.z, y: 4, cy: 0, r: 1.4, hittable: true, mission, ang: 0, ph: rand(0, TAU), st: 'loop', t: rand(2.2, 4), cool: 0, age: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, sp = (7 + L.d * 5) * L.em;
    rg.wingL.rotation.z = .25 + Math.sin(clock * 62 + e.ph) * .6; rg.wingR.rotation.z = -.25 - Math.sin(clock * 62 + e.ph) * .6;
    if (e.st === 'loop') {
      const a = e.ph * .95, tx = pig.x + Math.sin(a) * 10, tz = pig.z + Math.sin(a * 2) * 6, tdx = tx - e.x, tdz = tz - e.z, td = Math.hypot(tdx, tdz) || 1;
      e.ang += angDiff(e.ang, Math.atan2(tdx, tdz)) * Math.min(1, 6 * dt); const v = Math.min(sp, td * 3 + 2); e.x += Math.sin(e.ang) * v * dt; e.z += Math.cos(e.ang) * v * dt; e.y += (4.2 + Math.sin(e.ph * 2) * .8 - e.y) * Math.min(1, 3 * dt); rg.body.rotation.x += (0 - rg.body.rotation.x) * Math.min(1, 8 * dt);
      if (e.t <= 0 && d < 24) { e.st = 'dive'; e.t = 1.05; e.ang = Math.atan2(dx, dz); popText('Bzzz!', e.x, e.y + 2, e.z, 'bad'); sfx.bzz(); }
    } else {
      e.x += Math.sin(e.ang) * sp * 2.1 * dt; e.z += Math.cos(e.ang) * sp * 2.1 * dt; e.y += (1.7 - e.y) * Math.min(1, 5 * dt); rg.body.rotation.x += (.55 - rg.body.rotation.x) * Math.min(1, 10 * dt);
      if (e.t <= 0) { e.st = 'loop'; e.t = rand(3, 5); }
    }
    keepInWorld(e, WORLD + 12); g.position.set(e.x, e.y + Math.sin(clock * 9 + e.ph) * .12, e.z); g.rotation.y = e.ang; g.scale.setScalar(bk); Chars.blinkAll(rg, dt);
    e.cool -= dt; if (e.cool <= 0 && state === 'play' && Math.hypot(e.x - pig.x, e.z - pig.z) < 2.2 && Math.abs(e.y - (pig.y + 1.4)) < 2.2) { e.cool = 1; hurtPig(e.x, e.z, 14); }
  };
  e.onBall = () => { enemyDown(e, 0xffd93a, 'Buzz off!'); };
  return e;
}

/* Wind-up Robot: marches in square turns; its key spins faster as it winds up, then the arm springs out in a punch. */
function spawnRobot(at, mission) {
  const rg = Chars.makeRobot(), g = wrapEnemy(rg), p = at || ringSpawn(26, 40);
  const e = addEnt({ kind: 'enemy', sub: 'robot', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.9, r: 1.8, hittable: true, mission, hp: 2, st: 'march', t: rand(1.6, 3), turnT: 0, ang: rand(0, 4) * Math.PI / 2, cool: 0, ph: 0, hit: false, age: 0 });
  const lamp = (c, em) => { rg.lampMat.color.setHex(c); rg.lampMat.emissive.setHex(em); };
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz);
    rg.key.rotation.z += dt * (e.st === 'wind' ? 16 : 4);
    if (e.st === 'march') {
      const sp = (3 + L.d * 2.4) * L.em; e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, 1.2); keepInWorld(e, WORLD + 5);
      rg.armL.rotation.x = Math.sin(e.ph * 7) * .6; rg.armR.rotation.x = -Math.sin(e.ph * 7) * .6; rg.body.rotation.z = Math.sin(e.ph * 7) * .05;
      e.turnT -= dt; if (e.turnT <= 0) { e.ang = Math.round(want / (Math.PI / 2)) * (Math.PI / 2); e.turnT = rand(1.5, 2.6); }
      if (e.t <= 0 && d < 13 && Math.abs(angDiff(e.ang, want)) < .9) { e.st = 'wind'; e.t = .85; lamp(0xff3a2a, 0xaa1010); popText('Wind up!', e.x, 5, e.z, 'bad'); sfx.clank(); }
    } else if (e.st === 'wind') { e.ang += angDiff(e.ang, want) * Math.min(1, 8 * dt); const k = 1 - e.t / .85; rg.armR.rotation.x = k * 1.5; rg.armL.rotation.x = 0; rg.body.rotation.z = Math.sin(clock * 40) * .05 * k; if (e.t <= 0) { e.st = 'punch'; e.t = .55; e.hit = false; sfx.zap(); } }
    else if (e.st === 'punch') {
      const k = Math.min(1, (.55 - e.t) / .12), back = e.t < .2 ? e.t / .2 : 1; rg.armR.rotation.x = lerp(1.5, -Math.PI / 2, k); rg.armR.scale.y = 1 + 1.5 * k * back; rg.armR.fist.scale.setScalar(1 + .3 * k);
      const fz = dx * Math.sin(e.ang) + dz * Math.cos(e.ang), side = dx * Math.cos(e.ang) - dz * Math.sin(e.ang);
      if (!e.hit && state === 'play' && k > .5 && fz > .5 && fz < 7.5 && Math.abs(side) < 1.7 && pig.y < 2.6) { e.hit = true; hurtPig(e.x, e.z, 22); }
      if (e.t <= 0) { e.st = 'rest'; e.t = 1.2; rg.armR.scale.y = 1; rg.armR.fist.scale.setScalar(1); lamp(0x4aff7a, 0x1a8a3a); }
    } else if (e.st === 'rest') { rg.armR.rotation.x += (0 - rg.armR.rotation.x) * Math.min(1, 6 * dt); rg.body.rotation.z = Math.sin(clock * 12) * .08; if (e.t <= 0) { e.st = 'march'; e.t = rand(2.2, 3.6); } }
    g.position.set(e.x, e.st === 'march' ? Math.abs(Math.sin(e.ph * 7)) * .12 : 0, e.z); g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 10 * dt); g.scale.setScalar(bk); Chars.blinkAll(rg, dt);
    e.cool -= dt; if (e.cool <= 0 && pigNear(e, e.r + .8, 2.8)) { e.cool = 1; hurtPig(e.x, e.z, 16); }
  };
  e.onBall = () => { e.hp--; if (e.hp > 0) { sfx.clank(); burst(e.x, 2.4, e.z, 0xffd23a, 10, 5, .6); popText('Clank!', e.x, 4.6, e.z, ''); e.st = 'rest'; e.t = 1.0; lamp(0xffa02a, 0x8a4a10); return true; } burst(e.x, 2, e.z, 0x3ab8c8, 16, 7, 1); enemyDown(e, 0x3ab8c8, 'Powered down!'); };
  return e;
}

/* ============================================================ v5.3: six more villains + a star villain for every level */
const VILLAINS = {
  shroom: { from: 1, e: '🍄', n: 'Grumpy Shroom' }, slime: { from: 5, e: '🟢', n: 'Bouncy Slime' }, bomber: { from: 12, e: '💣', n: 'Bomber' }, cupcake: { from: 14, e: '🧁', n: 'Grumpy Cupcake' }, bee: { from: 16, e: '🐝', n: 'Buzzy Bee' },
  hedgehog: { from: 18, e: '🦔', n: 'Spiky Hedgehog' }, jack: { from: 20, e: '🤡', n: 'Jack-in-the-Box' }, mole: { from: 22, e: '🐹', n: 'Digger Mole' }, snowman: { from: 24, e: '⛄', n: 'Snowball Sam' }, bat: { from: 28, e: '🦇', n: 'Batty' },
  robot: { from: 32, e: '🤖', n: 'Wind-up Robot' }, crabby: { from: 36, e: '🦀', n: 'Crabby' }, boo: { from: 40, e: '👻', n: 'Peek-a-boo Ghost' }, spinny: { from: 44, e: '🌀', n: 'Spinny Top' },
  rexy: { from: 48, e: '🦖', n: 'Baby Rexy' }, drizzle: { from: 52, e: '🌧️', n: 'Drizzle' }, gummy: { from: 56, e: '🧸', n: 'Gummy Bear' }
};
/* the villain that stars in level n (always one you have already met) */
function starFor(n, world) { const ks = Object.keys(VILLAINS).filter(k => VILLAINS[k].from <= n), h = (Math.imul(n, 2654435761) >>> 0) % 997; return ks[(h + world * 3) % ks.length]; }
const VILL_FAV = {
  crabby: ['Bubble Lagoon', 'Tropical Beach', 'Pirate Bay', 'Coral Reef'], boo: ['Haunted Hollow', 'Starry Night', 'Pumpkin Patch', 'Hologram Hills'], spinny: ['Toy Town', 'Carnival Fun', 'Pixel Park', 'Robot Factory'],
  rexy: ['Dino Valley', 'Dragon Mountain', 'Jungle Jam', 'Enchanted Forest'], drizzle: ['Rainy Day', 'Cloud Kingdom', 'Neon City', 'Sunny Meadow'], gummy: ['Candy Land', 'Ice Cream Parlor', 'Fairy Garden', 'Neon City'], robot: ['Robot Factory', 'Neon City']
};
function extraPool(n, tnm) {
  const p = [];
  for (const k of ['crabby', 'boo', 'spinny', 'rexy', 'drizzle', 'gummy']) if (n >= VILLAINS[k].from) p.push(k);
  for (const k in VILL_FAV) if (n >= VILLAINS[k].from && VILL_FAV[k].includes(tnm)) p.push(k, k);
  if (L.star && n >= VILLAINS[L.star].from) p.push(L.star, L.star, L.star);
  return p;
}
function spawnKind(kind, at, mission) {
  const F = { shroom: spawnShroom, slime: (a, m) => spawnSlime(2, a, m), bat: spawnBat, mole: spawnMole, hedgehog: spawnHedgehog, bomber: spawnBomber, cupcake: spawnCupcake, snowman: spawnSnowman, jack: spawnJack, bee: spawnBee, robot: spawnRobot, crabby: spawnCrabby, boo: spawnBoo, spinny: spawnSpinny, rexy: spawnRexy, drizzle: spawnDrizzle, gummy: spawnGummy };
  return (F[kind] || spawnShroom)(at, mission);
}

/* Crabby: scuttles sideways, snaps its claws (warning!), then lunges. Two bonks. */
function spawnCrabby(at, mission) {
  const rg = Chars.makeCrabby(), g = wrapEnemy(rg), p = at || ringSpawn(24, 38);
  const e = addEnt({ kind: 'enemy', sub: 'crabby', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.4, r: 2.0, hittable: true, mission, hp: 2, st: 'scuttle', t: rand(1.4, 2.6), ang: 0, dirS: Math.random() < .5 ? 1 : -1, cool: 0, ph: rand(0, TAU), age: 0, lx: 0, lz: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let fw = 0, side = 0, op = .1 + Math.abs(Math.sin(e.ph * 7)) * .22;
    if (e.st !== 'lunge') e.ang += angDiff(e.ang, want) * Math.min(1, 6 * dt);
    if (e.st === 'scuttle') {
      side = e.dirS * (3.2 + L.d * 2.4) * L.em; fw = d > 12 ? 1.8 * L.em : d < 7 ? -1.6 * L.em : 0; if (Math.random() < dt * .35) e.dirS = -e.dirS;
      if (e.t <= 0 && d < 22) { e.st = 'snap'; e.t = .75; popText('Snip snip!', e.x, 4.2, e.z, 'bad'); sfx.clank(); }
    } else if (e.st === 'snap') { op = .5 + Math.abs(Math.sin(e.ph * 22)) * .5; rg.body.rotation.x = -.12; if (e.t <= 0) { e.st = 'lunge'; e.t = .5; e.lx = Math.sin(e.ang); e.lz = Math.cos(e.ang); sfx.whoosh(); } }
    else if (e.st === 'lunge') { op = 1; e.x += e.lx * 15 * L.em * dt; e.z += e.lz * 15 * L.em * dt; rg.body.rotation.x = .1; if (e.t <= 0) { e.st = 'rest'; e.t = 1.2; } }
    else if (e.st === 'rest') { op = .1; rg.body.rotation.z = Math.sin(clock * 12) * .08; if (e.t <= 0) { e.st = 'scuttle'; e.t = rand(2, 3.4); rg.body.rotation.z = 0; } }
    if (e.st !== 'snap' && e.st !== 'lunge') rg.body.rotation.x *= .8;
    const cs = Math.cos(e.ang), sn = Math.sin(e.ang); e.x += (sn * fw + cs * side) * dt; e.z += (cs * fw - sn * side) * dt; pushOut(e, 1.2); keepInWorld(e, WORLD + 5);
    rg.open(rg.clawL, op); rg.open(rg.clawR, op); rg.legs.forEach((l, i) => { l.rotation.z = Math.sin(clock * 18 + i * 1.3) * (side ? .28 : .04); });
    g.position.set(e.x, side ? Math.abs(Math.sin(clock * 14 + e.ph)) * .1 : 0, e.z); g.rotation.y = e.ang; g.scale.setScalar(bk); Chars.blinkAll(rg, dt, e.st === 'rest' ? .5 : 0);
    e.cool -= dt; if (e.cool <= 0 && pigNear(e, e.r + .9, 2.6)) { e.cool = 1; hurtPig(e.x, e.z, e.st === 'lunge' ? 24 : 16); }
  };
  e.onBall = () => { e.hp--; if (e.hp > 0) { sfx.clank(); burst(e.x, 1.6, e.z, 0xff9a6a, 10, 5, .7); popText('Ow-claw!', e.x, 3.6, e.z, ''); e.st = 'rest'; e.t = 1.4; return true; } burst(e.x, 1.6, e.z, 0xff6a3a, 16, 7, 1); enemyDown(e, 0xff6a3a, 'Crab-tastic!'); };
  return e;
}

/* Peek-a-boo Ghost: floats near, hides its eyes, vanishes with a pop, reappears behind Piggy and swoops. Can't be hit while hidden. */
function spawnBoo(at, mission) {
  const rg = Chars.makeBoo(), g = wrapEnemy(rg), p = at || ringSpawn(22, 34);
  const e = addEnt({ kind: 'enemy', sub: 'boo', g, rig: rg, x: p.x, z: p.z, y: 1.2, cy: 1.8, r: 1.9, hittable: true, mission, st: 'float', t: rand(2, 3.4), ang: 0, ph: rand(0, TAU), cool: 0, age: 0, vis: 1, bx: 0, bz: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let sp = 0, shy = 0;
    if (e.st !== 'boo') e.ang += angDiff(e.ang, want) * Math.min(1, 5 * dt);
    if (e.st === 'float') {
      sp = d > 14 ? (3 + L.d * 2) * L.em : d < 8 ? -2 * L.em : 0; e.vis = Math.min(1, e.vis + dt * 5); rg.mouth.scale.set(.2, .27, .06);
      if (e.t <= 0 && d < 30) { e.st = 'shy'; e.t = .8; popText('Peek-a-boo!', e.x, 5, e.z, 'bad'); sfx.squeak(); }
    } else if (e.st === 'shy') { shy = 1; if (e.t <= 0) { e.st = 'vanish'; e.t = .35; sfx.pop(); burst(e.x, 2, e.z, 0xdbe8ff, 10, 4, .7); } }
    else if (e.st === 'vanish') { shy = 1; e.vis = Math.max(0, e.t / .35); e.hittable = false; if (e.t <= 0) { e.st = 'hide'; e.t = .8; e.vis = 0; const a = Math.atan2(pig.vx, pig.vz) + Math.PI + rand(-.6, .6), r = rand(9, 12); e.x = pig.x + Math.sin(a) * r; e.z = pig.z + Math.cos(a) * r; keepInWorld(e, WORLD); } }
    else if (e.st === 'hide') { e.vis = 0; if (e.t <= 0) { e.st = 'boo'; e.t = .95; e.vis = 1; e.hittable = true; e.ang = Math.atan2(pig.x - e.x, pig.z - e.z); e.bx = Math.sin(e.ang); e.bz = Math.cos(e.ang); popText('BOO!', e.x, 5, e.z, 'bad'); sfx.whoosh(); burst(e.x, 2, e.z, 0xdbe8ff, 10, 4, .7); } }
    else if (e.st === 'boo') { rg.mouth.scale.set(.3, .42, .06); e.x += e.bx * (11 + L.d * 4) * dt; e.z += e.bz * (11 + L.d * 4) * dt; keepInWorld(e, WORLD + 5); if (e.t <= 0) { e.st = 'float'; e.t = rand(2.6, 4); } }
    e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; if (e.st === 'float') { pushOut(e, 1.2); keepInWorld(e, WORLD + 5); }
    for (const [arm, s] of [[rg.armL, -1], [rg.armR, 1]]) arm.rotation.z += ((shy ? s * 2.5 : -s * .5 + Math.sin(e.ph * 3 + s) * .25) - arm.rotation.z) * Math.min(1, 14 * dt);
    rg.skirt.forEach((b, i) => { b.scale.y = .55 + Math.sin(e.ph * 5 + i) * .1; });
    g.visible = e.vis > .02; g.position.set(e.x, 1.2 + Math.sin(e.ph * 2) * .35, e.z); g.rotation.y = e.ang; g.scale.setScalar(bk * (.3 + .7 * e.vis)); Chars.blinkAll(rg, dt, shy ? 1 : 0);
    e.cool -= dt; if (e.vis > .5 && e.cool <= 0 && pigNear(e, e.r + .8, 3)) { e.cool = 1; hurtPig(e.x, e.z, e.st === 'boo' ? 20 : 14); }
  };
  e.onBall = () => { if (e.vis < .5) return false; enemyDown(e, 0xdbe8ff, 'Boo-hoo!'); burst(e.x, 2, e.z, 0xffffff, 14, 6, 1); };
  return e;
}

/* Spinny Top: wobbles after Piggy, winds up, zig-zags at speed (shots just ping off), then gets dizzy – bonk it then! */
function spawnSpinny(at, mission) {
  const rg = Chars.makeSpinny(), g = wrapEnemy(rg), p = at || ringSpawn(24, 38);
  const e = addEnt({ kind: 'enemy', sub: 'spinny', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.7, r: 1.8, hittable: true, mission, hp: 2, st: 'idle', t: rand(1.4, 2.6), ang: 0, ph: rand(0, TAU), cool: 0, age: 0, spin: 8, zt: 0, zdir: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let sp = 0, tilt = 0, tspin = 8;
    if (e.st === 'idle') { e.ang += angDiff(e.ang, want) * Math.min(1, 4 * dt); sp = d > 10 ? (2.4 + L.d * 1.6) * L.em : 0; tilt = Math.sin(e.ph * 5) * .08; if (e.t <= 0 && d < 28) { e.st = 'wind'; e.t = .85; popText('Wheee!', e.x, 5.2, e.z, 'bad'); sfx.zap(); } }
    else if (e.st === 'wind') { tspin = 40; tilt = Math.sin(clock * 50) * .05; e.ang += angDiff(e.ang, want) * Math.min(1, 6 * dt); if (e.t <= 0) { e.st = 'zip'; e.t = 1.7; e.zt = 0; e.zdir = want; sfx.whoosh(); } }
    else if (e.st === 'zip') { tspin = 46; e.zt -= dt; if (e.zt <= 0) { e.zt = .35; e.zdir = want + rand(-.9, .9); } e.ang = e.zdir; sp = (13 + L.d * 4) * L.em; tilt = .12; if (e.t <= 0) { e.st = 'dizzy'; e.t = 1.7; sfx.boing(); popText('Dizzy...', e.x, 5.2, e.z, ''); } }
    else if (e.st === 'dizzy') { tspin = 1.5; tilt = Math.sin(clock * 9) * .3; rg.head.rotation.y = Math.sin(clock * 5) * .5; if (e.t <= 0) { e.st = 'idle'; e.t = rand(2, 3.2); rg.head.rotation.y = 0; } }
    e.spin += (tspin - e.spin) * Math.min(1, 6 * dt); rg.spinner.rotation.y += e.spin * dt;
    e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, 1.2); keepInWorld(e, WORLD + 5);
    g.position.set(e.x, e.st === 'zip' ? Math.abs(Math.sin(clock * 20)) * .25 : 0, e.z); g.rotation.set(0, e.st === 'zip' ? e.ang : g.rotation.y + angDiff(g.rotation.y, e.ang) * Math.min(1, 6 * dt), tilt); g.scale.setScalar(bk); Chars.blinkAll(rg, dt, e.st === 'dizzy' ? .6 : 0);
    e.cool -= dt; if (e.st !== 'dizzy' && e.cool <= 0 && pigNear(e, e.r + .9, 2.8)) { e.cool = 1; hurtPig(e.x, e.z, e.st === 'zip' ? 24 : 15); }
  };
  e.onBall = () => {
    if (e.st === 'zip' || e.st === 'wind') { sfx.clank(); popText('Ping!', e.x, 4, e.z, ''); burst(e.x, 2.2, e.z, 0xffffff, 4, 3, .5); return; }
    e.hp--; if (e.hp > 0) { sfx.clank(); burst(e.x, 2, e.z, 0x4fb8ff, 10, 5, .7); popText('Whoa!', e.x, 4, e.z, ''); e.st = 'dizzy'; e.t = 2.0; return true; }
    burst(e.x, 2, e.z, 0xffd93a, 16, 7, 1); enemyDown(e, 0x4fb8ff, 'Top-notch!');
  };
  return e;
}

/* Baby Rexy: stomps after Piggy, throws its head back for a ROAR, charges in a straight line, then pants (bonk it!). */
function spawnRexy(at, mission) {
  const rg = Chars.makeRexy(), g = wrapEnemy(rg), p = at || ringSpawn(26, 40);
  const e = addEnt({ kind: 'enemy', sub: 'rexy', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 2.0, r: 2.1, hittable: true, mission, hp: 2, st: 'walk', t: rand(1.6, 3), ang: 0, ph: rand(0, TAU), cool: 0, age: 0, cx: 0, cz: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let sp = 0, hd = 0, mouth = false, tw = 1;
    if (e.st === 'walk') { e.ang += angDiff(e.ang, want) * Math.min(1, 4 * dt); sp = (3.2 + L.d * 2.2) * L.em; hd = Math.sin(e.ph * 7) * .06; if (e.t <= 0 && d < 20) { e.st = 'roar'; e.t = .85; popText('RAWR!', e.x, 6, e.z, 'bad'); sfx.roar(); } }
    else if (e.st === 'roar') { e.ang += angDiff(e.ang, want) * Math.min(1, 8 * dt); hd = -.5; mouth = true; tw = 3; g.position.x += 0; shake = Math.max(shake, .12); if (e.t <= 0) { e.st = 'charge'; e.t = .95; e.cx = Math.sin(e.ang); e.cz = Math.cos(e.ang); } }
    else if (e.st === 'charge') { sp = 0; e.x += e.cx * (12 + L.d * 4) * L.em * dt; e.z += e.cz * (12 + L.d * 4) * L.em * dt; hd = .2; tw = 2; if (e.t <= 0) { e.st = 'tired'; e.t = 1.5; } }
    else if (e.st === 'tired') { hd = .35 + Math.sin(clock * 10) * .04; if (e.t <= 0) { e.st = 'walk'; e.t = rand(2, 3.4); } }
    e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt; pushOut(e, 1.4); keepInWorld(e, WORLD + 5);
    rg.head.rotation.x += (hd - rg.head.rotation.x) * Math.min(1, 10 * dt); rg.mouth.visible = mouth; rg.tail.rotation.y = Math.sin(e.ph * 5 * tw) * .5; rg.tail.tail2.rotation.y = Math.sin(e.ph * 5 * tw - .8) * .5;
    rg.legs.forEach((l, i) => { l.rotation.x = (sp || e.st === 'charge') ? Math.sin(e.ph * (e.st === 'charge' ? 16 : 8) + i * Math.PI) * .6 : 0; }); rg.armL.rotation.x = Math.sin(e.ph * 9) * .3; rg.armR.rotation.x = -Math.sin(e.ph * 9) * .3;
    g.position.set(e.x, (sp || e.st === 'charge') ? Math.abs(Math.sin(e.ph * (e.st === 'charge' ? 8 : 4))) * .25 : 0, e.z); g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 10 * dt); g.scale.setScalar(bk); Chars.blinkAll(rg, dt, e.st === 'tired' ? .5 : 0);
    e.cool -= dt; if (e.cool <= 0 && pigNear(e, e.r + .9, 3)) { e.cool = 1; hurtPig(e.x, e.z, e.st === 'charge' ? 24 : 16); }
  };
  e.onBall = () => { e.hp--; if (e.hp > 0) { sfx.thunk(); burst(e.x, 2.6, e.z, 0x6ad46a, 10, 5, .7); popText('Rawr...', e.x, 5.2, e.z, ''); e.st = 'tired'; e.t = 1.6; return true; } burst(e.x, 2, e.z, 0x6ad46a, 16, 7, 1); enemyDown(e, 0x6ad46a, 'Dino-mite!'); };
  return e;
}

/* Drizzle: a grumpy little rain cloud that hovers around Piggy and drops raindrops (red rings show where). One shot pops it. */
function spawnDrizzle(at, mission) {
  const rg = Chars.makeDrizzle(), g = wrapEnemy(rg), p = at || ringSpawn(22, 34);
  const e = addEnt({ kind: 'enemy', sub: 'drizzle', g, rig: rg, x: p.x, z: p.z, y: 5.2, cy: 0, r: 2.3, hittable: true, mission, st: 'drift', t: rand(2, 3.2), ang: 0, ph: rand(0, TAU), cool: 0, age: 0, n: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let sp = 0;
    if (e.st === 'drift') {
      const a = e.ph * .5, tx = pig.x + Math.sin(a) * 11, tz = pig.z + Math.cos(a) * 11, tdx = tx - e.x, tdz = tz - e.z, td = Math.hypot(tdx, tdz) || 1; sp = Math.min((4.2 + L.d * 2.4) * L.em, td * 2); e.ang = Math.atan2(tdx, tdz); e.x += Math.sin(e.ang) * sp * dt; e.z += Math.cos(e.ang) * sp * dt;
      if (e.t <= 0 && d < 32) { e.st = 'rain'; e.t = 1.5; e.n = 0; popText('Drip drip!', e.x, 7.5, e.z, 'bad'); sfx.whoosh(); }
    } else if (e.st === 'rain') {
      rg.body.rotation.z = Math.sin(clock * 30) * .06; const k = Math.floor((1.5 - e.t) / .38); if (k >= e.n && e.n < 4) { e.n++; const tx = pig.x + pig.vx * .5 + rand(-3, 3), tz = pig.z + pig.vz * .5 + rand(-3, 3); spawnLob(e.x, 4.2, e.z, tx, tz, 1.0, 0x5ab8ff, 14); }
      if (e.t <= 0) { e.st = 'drift'; e.t = rand(2.6, 4); rg.body.rotation.z = 0; }
    }
    keepInWorld(e, WORLD + 8); e.y = 5.2 + Math.sin(e.ph * 1.6) * .5; g.position.set(e.x, e.y, e.z); g.rotation.y = want; g.scale.setScalar(bk);
    rg.drops.forEach(dr => { const k = (e.ph * 1.5 + dr.userData.ph) % 1.6; dr.position.y = -1.3 - k * 1.2; dr.scale.setScalar(Math.max(.01, 1 - k / 1.6)); }); Chars.blinkAll(rg, dt);
  };
  e.onBall = () => { burst(e.x, e.y, e.z, 0x9ac8ff, 18, 7, 1); enemyDown(e, 0x9ac8ff, 'Splash!'); for (let i = 0; i < 8; i++) emit(e.x + rand(-1.5, 1.5), e.y - .5, e.z + rand(-1.5, 1.5), rand(-1, 1), rand(-8, -4), rand(-1, 1), .8, 0x5ab8ff, .5, 0); };
  return e;
}

/* Gummy Bear: jiggles, then bounces after Piggy in big arcs. The landing makes a little shockwave. Two bonks. */
function spawnGummy(at, mission) {
  const col = Chars.GUMMY_COLS[(Math.random() * Chars.GUMMY_COLS.length) | 0], rg = Chars.makeGummy(col), g = wrapEnemy(rg), p = at || ringSpawn(24, 38);
  const e = addEnt({ kind: 'enemy', sub: 'gummy', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1.6, r: 1.8, hittable: true, mission, hp: 2, st: 'sit', t: rand(.6, 1.4), ang: 0, ph: rand(0, TAU), cool: 0, age: 0, hopT: 0, hx: 0, hz: 0, col, lands: 0 });
  e.update = dt => {
    e.age += dt; e.ph += dt; e.t -= dt; const bk = popK(e.age), dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, want = Math.atan2(dx, dz); let jy = 0, sq = 1;
    if (e.st === 'sit') { e.ang += angDiff(e.ang, want) * Math.min(1, 6 * dt); sq = 1 + Math.sin(e.ph * 9) * .05; if (e.t <= 0) { e.st = 'hop'; e.hopT = 0; const dist = Math.min(d, 9 + L.d * 3); e.ang = want + rand(-.3, .3); e.hx = Math.sin(e.ang) * dist; e.hz = Math.cos(e.ang) * dist; e.sx = e.x; e.sz = e.z; sfx.boing(); } }
    else if (e.st === 'hop') {
      e.hopT += dt / .9; const k = Math.min(1, e.hopT); e.x = e.sx + e.hx * k; e.z = e.sz + e.hz * k; jy = Math.sin(k * Math.PI) * 3.4; sq = 1 + Math.sin(k * Math.PI) * .12; rg.armL.rotation.z = rg.armR.rotation.z = Math.sin(k * Math.PI) * -1;
      if (k >= 1) { e.st = 'squish'; e.t = .35; e.lands++; burst(e.x, .4, e.z, e.col, 8, 4, .6); sfx.thunk(); if (state === 'play' && Math.hypot(pig.x - e.x, pig.z - e.z) < 3.2 && pig.y < 1.6) hurtPig(e.x, e.z, 18); }
    } else if (e.st === 'squish') { sq = .72 + (1 - e.t / .35) * .28; if (e.t <= 0) { e.st = 'sit'; e.t = rand(.5, 1.1) / (1 + L.d * .5); rg.armL.rotation.z = rg.armR.rotation.z = 0; } }
    pushOut(e, 1.2); keepInWorld(e, WORLD + 5); g.position.set(e.x, jy, e.z); g.rotation.y += angDiff(g.rotation.y, e.ang) * Math.min(1, 8 * dt); g.scale.set(bk / Math.sqrt(sq), bk * sq, bk / Math.sqrt(sq)); Chars.blinkAll(rg, dt);
    e.cool -= dt; if (e.cool <= 0 && e.st !== 'squish' && pigNear(e, e.r + .8, 2.6 + jy)) { e.cool = 1; hurtPig(e.x, e.z, 16); }
  };
  e.onBall = () => { e.hp--; if (e.hp > 0) { sfx.boing(); burst(e.x, 2, e.z, e.col, 10, 5, .7); popText('Boing!', e.x, 4.4, e.z, ''); e.st = 'sit'; e.t = .6; e.sx = e.x; return true; } burst(e.x, 1.8, e.z, e.col, 18, 7, 1); confetti(e.x, 1.8, e.z, 12); enemyDown(e, e.col, 'Squish-tastic!'); };
  return e;
}

/* ============================================================ v5.3 objectives: fireflies, magic seeds, caged pals, shiny coins */
function spawnFirefly() {
  const g = new THREE.Group(); g.userData.hasOl = true;
  const bodyM = M(0xffe45c, { emissive: 0xc8a020 }), wingM = C_basic(0xffffff, .6), halo = part(g, GEO.sph, C_basic(0xfff3a0, .28), 0, -.1, 0, 1.25, 1.25, 1.25); halo.userData.noOutline = true;
  part(g, GEO.sph, bodyM, 0, 0, .1, .34, .38, .5); part(g, GEO.sph, M(0xfffbb0, { emissive: 0xffe040 }), 0, -.05, -.4, .3, .3, .36); part(g, GEO.sph, M(0x3a2a20), 0, .12, .5, .2, .2, .2);
  const wings = [-1, 1].map(sd => { const w = part(g, GEO.sph, wingM, sd * .32, .3, 0, .38, .05, .22); w.userData.noOutline = true; return w; });
  const c = spot(8, 12), e = addEnt({ kind: 'firefly', g, x: c.x, z: c.z, y: rand(1.6, 3.4), cy: 0, r: 1.7, hittable: true, tx: c.x, tz: c.z, ty: 2.5, t: 0, ph: rand(0, TAU), ang: 0 });
  function catchIt() { if (e.dead) return; e.dead = true; burst(e.x, e.y, e.z, 0xffe45c, 14, 5, .8); confetti(e.x, e.y, e.z, 8); sfx.sparkle(); buzz(15); popText('Got it! ✨', e.x, e.y + 1.6, e.z, 'gold'); spawnCoin(e.x, e.z, 1.6); progress('fireflies'); }
  e.update = dt => {
    e.ph += dt; e.t -= dt; const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, fleeing = d < 7;
    if (e.t <= 0 || Math.hypot(e.tx - e.x, e.tz - e.z) < 1) { e.t = rand(.8, 1.8); const a = fleeing ? Math.atan2(-dx, -dz) + rand(-.8, .8) : rand(0, TAU), r = fleeing ? rand(9, 15) : rand(4, 10); e.tx = e.x + Math.sin(a) * r; e.tz = e.z + Math.cos(a) * r; e.ty = rand(1.4, 4.2); const q = Math.hypot(e.tx, e.tz); if (q > WORLD - 5) { e.tx *= (WORLD - 5) / q; e.tz *= (WORLD - 5) / q; } }
    const tdx = e.tx - e.x, tdz = e.tz - e.z, td = Math.hypot(tdx, tdz) || 1, sp = (fleeing ? 10.5 : 5) * (1 + L.d * .3); e.ang = Math.atan2(tdx, tdz); e.x += tdx / td * Math.min(sp, td * 4) * dt; e.z += tdz / td * Math.min(sp, td * 4) * dt; e.y += (e.ty - e.y) * Math.min(1, 3 * dt);
    g.position.set(e.x, e.y + Math.sin(e.ph * 6) * .15, e.z); g.rotation.y = e.ang; wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(clock * 50) * .6; }); halo.scale.setScalar(1.2 + Math.sin(e.ph * 5) * .2);
    if (state === 'play' && d < 2.3 && Math.abs(e.y - (pig.y + 1.3)) < 2.6) catchIt();
  };
  e.onBall = () => { catchIt(); };
  return e;
}
function spawnSeed() {
  const g = new THREE.Group(); g.userData.hasOl = true;
  const soil = part(g, GEO.cyl, M(0x7a5232), 0, .08, 0, 2.0, .16, 2.0), ring = part(g, GEO.cyl, C_basic(0x7aff6a, .5), 0, .2, 0, 2.5, .05, 2.5); ring.userData.noOutline = true;
  const sprout = new THREE.Group(); g.add(sprout); const stem = part(sprout, GEO.cyl, M(0x4ac84a), 0, .5, 0, .09, 1.0, .09), lf = [-1, 1].map(sd => { const l = part(sprout, GEO.sph, M(0x5ae05a), sd * .35, 1.0, 0, .38, .1, .2); l.rotation.z = sd * -.4; return l; });
  const bloom = new THREE.Group(); bloom.position.y = 1.15; bloom.scale.setScalar(.01); sprout.add(bloom); const pc = pick([0xff6ab0, 0xffe45c, 0xb08aff, 0xff8a3a]); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; part(bloom, GEO.sph, M(pc), Math.sin(a) * .5, 0, Math.cos(a) * .5, .34, .12, .34); } part(bloom, GEO.sph, M(0xffe45c, { emissive: 0x806000 }), 0, .05, 0, .28);
  const arrow = part(g, GEO.cone, M(0xffe45c, { emissive: 0x806000 }), 0, 3.6, 0, .5, .9, .5); arrow.rotation.x = Math.PI; Chars.outline(g, .06);
  const c = spot(8, 12), e = addEnt({ kind: 'seed', g, x: c.x, z: c.z, y: 0, cy: 0, r: 2.2, hittable: false, prog: 0, done: false, ph: rand(0, TAU) });
  e.update = dt => {
    e.ph += dt;
    if (!e.done) {
      const near = state === 'play' && Math.hypot(pig.x - e.x, pig.z - e.z) < 2.6 && pig.y < 2.2; e.prog = clamp(e.prog + (near ? dt / .9 : -dt * .7), 0, 1);
      sprout.scale.setScalar(.25 + e.prog * .9); ring.material.opacity = .3 + e.prog * .5 + Math.sin(e.ph * 6) * .08; arrow.position.y = 3.6 + Math.sin(e.ph * 4) * .25; arrow.rotation.y += dt * 3; if (near && Math.random() < dt * 10) emit(e.x + rand(-1, 1), .4, e.z + rand(-1, 1), 0, rand(2, 4), 0, .6, 0x7aff6a, .4, 0);
      if (e.prog >= 1) { e.done = true; arrow.visible = false; ring.visible = false; sfx.sparkle(); burst(e.x, 1.2, e.z, 0xffe45c, 14, 5, .8); confetti(e.x, 1.6, e.z, 12); popText('Bloom! 🌸', e.x, 3.4, e.z, 'gold'); spawnCoin(e.x + 2, e.z, 1.6); progress('seeds'); }
    } else { bloom.scale.setScalar(Math.min(1.6, bloom.scale.x + dt * 4)); sprout.scale.setScalar(1.2); sprout.rotation.z = Math.sin(e.ph * 2) * .06; }
  };
  return e;
}
function spawnCage() {
  const set = ANIM_SETS[L.world % ANIM_SETS.length], spn = pick(set), SP = SPECIES[spn], pal = Chars.makeCritter(spn, false), g = new THREE.Group(); g.userData.hasOl = true;
  const cage = new THREE.Group(); g.add(cage); const barM = M(0x8a93a8), wood = M(0x6a4a30), bars = [];
  part(cage, GEO.cyl, wood, 0, .25, 0, 2.3, .5, 2.3); part(cage, GEO.cyl, wood, 0, 3.9, 0, 2.3, .35, 2.3); part(cage, GEO.sph, M(0xffd23a, { emissive: 0x4a3a00 }), 0, 4.35, 0, .35);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, b = part(cage, GEO.cyl, barM, Math.cos(a) * 1.95, 2.1, Math.sin(a) * 1.95, .1, 3.5, .1); b.userData.a = a; bars.push(b); }
  Chars.outline(cage, .06); pal.g.scale.setScalar(SP.sc * .78); pal.g.position.y = .5; g.add(pal.g);
  const c = spot(10, 14), e = addEnt({ kind: 'cage', g, rig: pal, x: c.x, z: c.z, y: 0, cy: 2, r: 2.6, hittable: true, hp: 2 + (L.d > .5 ? 1 : 0), shake: 0, st: 'locked', ph: rand(0, TAU), t: 0, cool: 0 });
  function hit() { if (e.st !== 'locked') return; e.hp--; e.shake = .4; sfx.clank(); burst(e.x, 2.4, e.z, 0xc8d0e0, 8, 4, .6); popText(e.hp > 0 ? 'Clang!' : 'Free!', e.x, 5.2, e.z, e.hp > 0 ? '' : 'good'); if (e.hp <= 0) open(); }
  function open() { e.st = 'open'; e.hittable = false; e.t = 0; sfx[SP.snd](); sfx.sparkle(); confetti(e.x, 3, e.z, 22); for (let i = 0; i < 3; i++) spawnCoin(e.x + rand(-2, 2), e.z + rand(-2, 2), 1.6); popText(SP.say + ' Thank you! ' + SP.e, e.x, 6, e.z, 'gold'); progress('cages'); }
  e.update = dt => {
    e.ph += dt; e.cool -= dt;
    if (e.st === 'locked') {
      e.shake = Math.max(0, e.shake - dt); cage.rotation.z = Math.sin(clock * 40) * e.shake * .12; pal.g.position.y = .5 + Math.abs(Math.sin(e.ph * 4)) * .25; Chars.tickCritter(pal, dt, clock, 0, null);
      if (state === 'play' && e.cool <= 0 && pig.vy < 0 && pig.y > 2.6 && pig.y < 6.4 && Math.hypot(pig.x - e.x, pig.z - e.z) < 2.7) { e.cool = .6; pig.vy = 13; pig.grounded = false; hit(); }
    } else {
      e.t += dt; bars.forEach(b => { const a = b.userData.a; b.position.x += Math.cos(a) * dt * 9; b.position.z += Math.sin(a) * dt * 9; b.position.y += (3 - e.t * 14) * dt; b.rotation.z += dt * 6; }); cage.scale.setScalar(Math.max(.01, 1 - Math.max(0, e.t - .6) * 1.6));
      const k = e.t; pal.g.position.y = .5 + Math.abs(Math.sin(k * 7)) * 1.2; pal.g.rotation.y += dt * 6; Chars.tickCritter(pal, dt, clock, 0, null); if (k > 1.8) { e.dead = true; burst(e.x, 1.5, e.z, 0xffffff, 8, 4, .7); }
    }
    g.position.set(e.x, 0, e.z);
  };
  e.onBall = () => { hit(); };
  return e;
}

function spawnEnemy(mission) {
  const n = L.n, pool = ['shroom', 'shroom'];
  if (n >= 5) pool.push('slime'); if (n >= 12) pool.push('bomber', 'slime'); if (n >= 18) pool.push('hedgehog'); if (n >= 22) pool.push('mole'); if (n >= 28) pool.push('bat', 'bat'); if (n >= 90) pool.push('hedgehog', 'bomber');
  if (n >= 14) pool.push('cupcake'); if (n >= 16) pool.push('bee'); if (n >= 20) pool.push('jack'); if (n >= 24) pool.push('snowman'); if (n >= 32) pool.push('robot');
  const tnm = L.theme && (L.theme.base || L.theme.name);   // each world gets a favourite villain
  if (n >= 14) { if (tnm === 'Candy Land' || tnm === 'Carnival Fun') pool.push('cupcake', 'cupcake'); else if (tnm === 'Snowy Hills' || tnm === 'Rainy Day') pool.push('snowman', 'snowman'); else if (tnm === 'Toy Town' || tnm === 'Carnival Fun') pool.push('jack', 'robot'); else if (tnm === 'Fairy Garden' || tnm === 'Jungle Jam' || tnm === 'Coral Reef') pool.push('bee', 'bee'); else if (tnm === 'Crystal Cave' || tnm === 'Moon Base') pool.push('robot', 'robot'); }
  pool.push(...extraPool(n, tnm));
  return spawnKind(pick(pool), null, mission);
}
function wavesTick(dt) {
  if (waves.queue <= 0) return;
  waves.timer -= dt; const act = ents.filter(e => e.kind === 'enemy' && e.mission && !e.dead).length;
  if (act === 0) waves.cool -= dt; else waves.cool = 2.2;
  if (waves.timer <= 0 || (act === 0 && waves.cool <= 0)) {
    const n = Math.min(waves.size, waves.queue); waves.queue -= n; waves.num++; waves.timer = L.waveGap; waves.cool = 2.2;
    popText(`Wave ${waves.num}!`, pig.x, pig.y + 5, pig.z, 'gold'); sfx.stage(); renderObjs();
    for (let i = 0; i < n; i++) { const e = spawnEnemy(true); if (e) { burst(e.x, 1, e.z, 0xffffff, 8, 4, .8); } }
  }
}
/* ---- bosses (multi-phase!) */
function spawnBoss(cfg) {
  const rg = Chars.makeBoss(cfg.type, cfg.tier), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true; const mats = rg.mats; mats.forEach(m => m.userData.em = m.emissive.getHex());
  const sc = cfg.scale, floatY = rg.floatY;
  const e = addEnt({ kind: 'boss', g, rig: rg, x: pig.x + 22, z: pig.z - 14, y: floatY, base: floatY, cy: (rg.cy || 2.6) * sc, r: 3.4 * sc + .6, hittable: true, hp: cfg.hp, max: cfg.hp, flash: 0, fireT: 3, dying: 0, orb: 1, ph: 0, cfg, sc, phase: 1, nFire: 0, sumT: 8, intro: 1.2 });
  g.scale.setScalar(sc);
  e.update = dt => {
    if (e.dying > 0) { e.dying += dt; g.rotation.y += dt * 10; g.scale.setScalar(Math.max(.01, (1 - e.dying / 1.4)) * e.sc); if (Math.random() < .6) confetti(e.x, e.y + 3, e.z, 2); if (e.dying > 1.4) { e.dead = true; sfx.boom(); confetti(e.x, 3, e.z, 40); burst(e.x, 3, e.z, 0xffffff, 16, 8, 1.2); progress('boss'); } return; }
    const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, rage = e.phase === 3 ? 1.5 : e.phase === 2 ? 1.2 : 1, sp = cfg.speed * rage * (speedMode ? 1.2 : 1);
    e.ph += dt; const want = 17; let rx = dx / d, rz = dz / d; let mvx = rx * (d - want) * .35, mvz = rz * (d - want) * .35; mvx += -rz * e.orb * sp * .55; mvz += rx * e.orb * sp * .55; if (Math.random() < dt * .25) e.orb = -e.orb;
    const ml = Math.hypot(mvx, mvz) || 1, cap = Math.min(sp, ml); e.vx = mvx / ml * cap; e.vz = mvz / ml * cap; e.x += e.vx * dt; e.z += e.vz * dt; keepInWorld(e, WORLD);
    e.y = e.base + (e.base > 0 ? Math.sin(e.ph * 2) * .8 : Math.abs(Math.sin(e.ph * 2.2)) * .5); g.position.set(e.x, e.y, e.z); g.rotation.y += angDiff(g.rotation.y, Math.atan2(dx, dz)) * Math.min(1, 5 * dt); if (rg.blade) rg.blade.rotation.y += 20 * dt;
    if (e.flash > 0) { e.flash -= dt; for (const m of mats) m.emissive.setHex(e.flash > 0 ? 0xaaaaaa : m.userData.em); }
    const sq = 1 + Math.sin(e.ph * 4) * .015 + Math.max(0, e.flash) * .6; g.scale.set(e.sc * sq, e.sc * (2 - sq), e.sc * sq); Chars.blinkAll(rg, dt, e.flash > 0 ? .8 : 0); if (rg.tick) rg.tick(dt, e.ph, e.phase);
    e.intro -= dt; e.fireT -= dt; if (e.fireT <= 0 && state === 'play') { e.fireT = cfg.fireEvery / rage; bossFire(e); }
    if (e.phase >= 3) { e.sumT -= dt; if (e.sumT <= 0) { e.sumT = 11 - cfg.shots; if (ents.filter(q => q.kind === 'enemy').length < 4) { for (let i = 0; i < 2; i++) { const m = spawnEnemy(false); if (m) burst(m.x, 1, m.z, 0xffffff, 8, 4, .8); } popText('Help!', e.x, e.y + 6 * sc, e.z, 'bad'); } } }
    if (state === 'play' && Math.hypot(pig.x - e.x, pig.z - e.z) < e.r * .75 && pig.y < e.cy + e.r * .6) hurtPig(e.x, e.z, 24);
  };
  e.onBall = () => {
    if (e.dying > 0) return; e.hp--; e.flash = .15; sfx.thunk(); burst(e.x, e.cy + e.y, e.z, 0xffffff, 6, 4, .8); el.bossfill.style.width = Math.max(0, e.hp / e.max * 100) + '%'; popText('Boom!', e.x, e.y + e.cy * 2 + 1.5, e.z, 'gold');
    const ph = e.hp < e.max * .34 ? 3 : e.hp < e.max * .67 ? 2 : 1;
    if (ph > e.phase) { e.phase = ph; sfx.stage(); shake = .4; popText(ph === 2 ? 'Getting angry! 😠' : 'FINAL RAGE! 😡', e.x, e.y + e.cy * 2 + 4, e.z, 'bad'); if (rg.eyes) rg.eyes.forEach(ey => ey.scale.multiplyScalar(1.1)); confetti(e.x, e.y + 3, e.z, 14); musicMode('boss', 120 + ph * 10); }
    if (e.hp <= 0) { e.dying = .01; e.hittable = false; } return true;
  };
  bossRef = e; el.bossbar.style.display = 'block'; el.bossfill.style.width = '100%'; el.bossname.textContent = BOSSES[cfg.type].e + ' ' + BOSSES[cfg.type].name; return e;
}
const projGeo = new THREE.SphereGeometry(.8, 12, 9);
function projMat(col) { return M(col, { emissive: new THREE.Color(col).multiplyScalar(.35).getHex() }); }
function addProj(x, y, z, vx, vy, vz, col, life, rain) { const m = new THREE.Mesh(projGeo, projMat(col)); m.position.set(x, y, z); scene.add(m); Chars.outline(m, .08); bprojs.push({ m, x, y, z, vx, vy, vz, life, rain, col }); }
/* v5.3 boss attacks (every other volley): crab claw fan, ghost ambush, T-rex roar ring, cherry rain, teddy wall (find the gap!), owl feathers */
function bossFire2(b) {
  const cfg = b.cfg, t = cfg.type, base = Math.atan2(pig.x - b.x, pig.z - b.z), sp = cfg.projSpeed, col = [0xff7a3a, 0xdbe8ff, 0x6ad46a, 0xff8ab8, 0xc88a52, 0xffa02a][t - 12];
  const shot = (a, v, y) => addProj(b.x + Math.sin(a) * 3, y || 1.3, b.z + Math.cos(a) * 3, Math.sin(a) * v, 0, Math.cos(a) * v, col, 5.5), top = b.y + 9;
  if (t === 12) { const n = 3 + cfg.shots * 2 + b.phase; for (let i = 0; i < n; i++) shot(base + (i - (n - 1) / 2) * .22, sp * .75); popText('Snap snap!', b.x, top, b.z, 'bad'); sfx.thunk(); }
  else if (t === 13) { for (let i = 0; i < 3 + b.phase; i++) { const a = base + (Math.random() - .5) * 3.0, px = pig.x + Math.sin(a) * 16, pz = pig.z + Math.cos(a) * 16; addProj(px, 1.4, pz, -Math.sin(a) * sp * .55, 0, -Math.cos(a) * sp * .55, col, 5.5); } popText('Boooo!', b.x, top, b.z, 'bad'); sfx.whoosh(); }
  else if (t === 14) { const n = cfg.ring + 4 + b.phase * 2, off = rand(0, TAU); for (let i = 0; i < n; i++) { const a = off + i / n * TAU; addProj(b.x + Math.sin(a) * 3, 1.0, b.z + Math.cos(a) * 3, Math.sin(a) * sp * .8, 0, Math.cos(a) * sp * .8, col, 5); } popText('ROAR!', b.x, top, b.z, 'bad'); sfx.boom(); shake = .35; }
  else if (t === 15) { const n = 4 + cfg.shots * 2 + b.phase; for (let i = 0; i < n; i++) addProj(pig.x + rand(-9, 9), 16 + i * 3, pig.z + rand(-9, 9), 0, -11, 0, [0xff7aa8, 0xffffff, 0x7a4a2a][i % 3], 4, true); sfx.sparkle(); }
  else if (t === 16) { const n = 7, gap = Math.floor(rand(1, n - 1)), cb = Math.cos(base), sb = Math.sin(base); for (let i = 0; i < n; i++) { if (i === gap) continue; const o = (i - (n - 1) / 2) * 3.2; addProj(b.x + sb * 4 + cb * o, 1.3, b.z + cb * 4 - sb * o, sb * sp * .6, 0, cb * sp * .6, col, 6.5); } popText('Teddy wall!', b.x, top, b.z, 'bad'); sfx.thunk(); }
  else { for (const k of [-1, 1]) for (let i = 0; i < 2 + Math.ceil(b.phase / 2); i++) shot(base + k * (.3 + i * .22), sp); shot(base, sp * 1.15); popText('Hoot hoot!', b.x, top, b.z, 'bad'); sfx.whoosh(); }
}
function bossFire(b) {
  const cfg = b.cfg; b.nFire++;
  if (cfg.type >= 12 && b.nFire % 2 === 0) { bossFire2(b); return; }
  if (cfg.type === 3 || (cfg.type === 10 && b.nFire % 2 === 0)) { const n = 2 + cfg.shots * 2 + b.phase, rc = cfg.type === 10 ? [0xff7ad0, 0x4fd0ff, 0xffe45c][b.nFire % 3] : 0x5ab8ff; for (let i = 0; i < n; i++) { const x = pig.x + rand(-9, 9), z = pig.z + rand(-9, 9); addProj(x, 16 + i * 3, z, 0, -11, 0, rc, 4, true); } if (cfg.type === 10) sfx.sparkle(); return; }
  const col = [0xffffff, 0xff5a2a, 0xff3030, 0, 0x5aff7a, 0xff3d3d, 0xff9a1a, 0x9ad8ff, 0xc07aff, 0xff7ad0, 0xff7ad0, 0xffd93a, 0xff7a3a, 0xdbe8ff, 0x6ad46a, 0xff8ab8, 0xc88a52, 0xffa02a][cfg.type] || 0xff5a5a;
  const dx = pig.x - b.x, dz = pig.z - b.z, base = Math.atan2(dx, dz), sp = cfg.projSpeed;
  if (b.phase >= 2 && b.nFire % 3 === 0) {           // ring burst: jump over it!
    const n = cfg.ring + b.phase * 2, off = rand(0, TAU); for (let i = 0; i < n; i++) { const a = off + i / n * TAU; addProj(b.x + Math.sin(a) * 3, 1.0, b.z + Math.cos(a) * 3, Math.sin(a) * sp * .7, 0, Math.cos(a) * sp * .7, col, 5); }
    sfx.boom(); return;
  }
  const shots = cfg.shots + (b.phase === 3 ? 1 : 0);
  for (let i = 0; i < shots; i++) { const a = base + (i - (shots - 1) / 2) * .28; addProj(b.x + Math.sin(a) * 3, 1.3, b.z + Math.cos(a) * 3, Math.sin(a) * sp, 0, Math.cos(a) * sp, col, 5); }
  sfx.thunk();
}
function updateBossProj(dt) {
  for (let i = bprojs.length - 1; i >= 0; i--) {
    const p = bprojs[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt; p.m.position.set(p.x, p.y, p.z); p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 4;
    let rm = p.life <= 0;
    if (p.rain && p.y < .8) { burst(p.x, .5, p.z, p.col || 0x5ab8ff, 6, 3, .6); rm = true; if (state === 'play' && Math.hypot(p.x - pig.x, p.z - pig.z) < 1.9 && pig.y < 1.5) hurtPig(p.x, p.z, 14); }
    if (state === 'play' && !rm && !p.rain && Math.hypot(p.x - pig.x, p.y - (pig.y + 1.2), p.z - pig.z) < 1.9) { hurtPig(p.x - p.vx, p.z - p.vz, 18); burst(p.x, p.y, p.z, 0xffffff, 6, 4, .6); rm = true; }
    if (Math.hypot(p.x, p.z) > 150) rm = true;
    if (rm) { scene.remove(p.m); bprojs.splice(i, 1); }
  }
}

/* ======== 09_dash.js ======== */
/* ============================================================ coins, blocks, pads, sweepers, shrooms */
const coinGeo = new THREE.CylinderGeometry(.55, .55, .16, 18), coinRimGeo = new THREE.CylinderGeometry(.68, .68, .1, 18);
const coinMat = M(0xffd23a, { emissive: 0x8a5a00 }), coinRimMat = M(0xd8860a);
let runCoins = 0, dashRun = 13, dashSlowT = 0;
const coinChip = $('coins'); const updCoins = () => { coinChip.textContent = '🪙 ' + save.coins; };
function spawnCoin(x, z, y) {
  const g = new THREE.Group(), sp = new THREE.Group(); g.userData.hasOl = true; g.add(sp);
  const c = new THREE.Mesh(coinGeo, coinMat); c.rotation.x = Math.PI / 2; sp.add(c);
  const r = new THREE.Mesh(coinRimGeo, coinRimMat); r.rotation.x = Math.PI / 2; sp.add(r);
  const e = addEnt({ kind: 'coin', g, x, z, y: 0, cy: 0, r: 1, ph: rand(0, TAU), by: y == null ? 1.7 : y }); g.position.set(x, e.by, z);
  e.update = dt => {
    e.ph += dt * 4; sp.rotation.y = e.ph; g.position.set(e.x, e.by + Math.sin(e.ph * .8) * .15, e.z);
    if (state !== 'play') return;
    const dx = pig.x - e.x, dz = pig.z - e.z, dy = (pig.y + 1.5) - e.by, d = Math.hypot(dx, dy, dz) || 1;
    if (magnetT > 0 && d < 16 && d > 2) { const v = 22 * dt; e.x += dx / d * v; e.z += dz / d * v; e.by += dy / d * v; }
    if (d < 2.6) { e.dead = true; save.coins++; runCoins++; updCoins(); sfx.coin(); burst(e.x, e.by, e.z, 0xffe45c, 4, 3, .4); if (e.mission) progress('coins'); }
  };
  return e;
}
function coinTrail(n) {
  const p = spot(8, 16); let x = p.x, z = p.z, ang = rand(0, TAU); const curve = rand(-.5, .5);
  for (let i = 0; i < n; i++) { if (blocked(x, z, 1.2) || Math.hypot(x, z) > WORLD - 8) break; spawnCoin(x, z); ang += curve * .14; x += Math.sin(ang) * 2.4; z += Math.cos(ang) * 2.4; }
}
let qTex = null;
function questionTex() {
  if (qTex) return qTex; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#ffc928'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#d68a00'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
  g.fillStyle = '#9a5a00'; for (const [x, y] of [[16, 16], [112, 16], [16, 112], [112, 112]]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
  g.font = '900 88px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#9a5a00'; g.lineWidth = 8; g.strokeText('?', 64, 70); g.fillText('?', 64, 70);
  qTex = new THREE.CanvasTexture(cv); qTex.colorSpace = THREE.SRGBColorSpace; return qTex;
}
function spawnBlock(at) {
  const g = new THREE.Group(), mat = new THREE.MeshToonMaterial({ map: questionTex(), gradientMap: Chars.ramp }), b = new THREE.Mesh(GEO.box, mat); b.scale.set(2.2, 2.2, 2.2); b.position.y = 3.6; g.add(b);
  const p = at || spot(10), e = addEnt({ kind: 'block', g, x: p.x, z: p.z, y: 0, cy: 3.6, r: 1.9, hittable: true, used: false, bump: 0 }); g.position.set(e.x, 0, e.z);
  function hit() {
    if (e.used) return; e.used = true; e.hittable = false; e.bump = 1; mat.color.setHex(0x9a8a7a); sfx.coin(); confetti(e.x, 4.5, e.z, 14); popText('Coins!', e.x, 5.5, e.z, 'gold');
    for (let i = 0; i < 7; i++) spawnCoin(e.x + rand(-3, 3), e.z + rand(-3, 3), rand(1.4, 3));
    if (Math.random() < .35 && !(L && L.dash)) spawnPickup(e.x + 4, e.z);
  }
  e.update = dt => {
    e.bump = Math.max(0, e.bump - dt * 4); b.position.y = 3.6 + Math.sin(e.bump * Math.PI) * .8 + (e.used ? 0 : Math.sin(clock * 2 + e.x) * .14);
    if (!e.used && state === 'play' && pig.vy > 1 && Math.hypot(pig.x - e.x, pig.z - e.z) < 2.3 && pig.y + 2.6 > 2.5 && pig.y < 3.6) hit();
  };
  e.onBall = () => { hit(); };
  return e;
}
function spawnPad(at) {
  const g = new THREE.Group(); part(g, GEO.cyl, MC(0x2a7ae0), 0, .3, 0, 1.9, .6, 1.9); const top = part(g, GEO.cyl, MC(0xff4f6a), 0, .75, 0, 1.5, .22, 1.5); part(g, GEO.cyl, MC(0xffffff), 0, .88, 0, .7, .06, .7);
  const p = at || spot(12), e = addEnt({ kind: 'pad', g, x: p.x, z: p.z, y: 0, cy: 0, r: 2, cool: 0, sq: 0 }); g.position.set(e.x, 0, e.z);
  e.update = dt => {
    e.cool -= dt; e.sq = Math.max(0, e.sq - dt * 3); top.position.y = .75 - e.sq * .35;
    if (state === 'play' && e.cool <= 0 && pig.y < 1.2 && Math.hypot(pig.x - e.x, pig.z - e.z) < 2.1) { e.cool = .5; e.sq = 1; pig.vy = 23; pig.grounded = false; sfx.boing(); burst(e.x, .8, e.z, 0xff4f6a, 8, 4, .6); popText('Boing!', e.x, 3, e.z, 'good'); }
  };
  return e;
}
function spawnSweeper(at, len, spd) {
  const g = new THREE.Group(); part(g, GEO.cyl, MC(0xfaf4e6), 0, .9, 0, .72, 1.8, .72); const arm = new THREE.Group(); arm.position.y = 1; g.add(arm);
  for (const s of [-1, 1]) { const ey = Chars.eye(.2); ey.position.set(s * .25, 1.3, .66); g.add(ey); }
  part(arm, GEO.box, MC(0xff4f6a), 0, 0, 0, len * 2, .55, .7); for (const s of [-1, 1]) part(arm, GEO.sph, MC(0xffd23a), s * len, 0, 0, .75);
  const p = at || spot(18), e = addEnt({ kind: 'sweeper', g, x: p.x, z: p.z, y: 0, cy: 1, r: 1, ang: rand(0, TAU), spd: (Math.random() < .5 ? -1 : 1) * spd, len, cool: 0 }); g.position.set(e.x, 0, e.z); e.hideSh = true;
  e.update = dt => {
    e.ang += e.spd * dt; arm.rotation.y = e.ang;
    if (state === 'play' && pig.y < 1.3) { const dx = pig.x - e.x, dz = pig.z - e.z, ca = Math.cos(e.ang), sa = Math.sin(e.ang), u = dx * ca - dz * sa, v = dx * sa + dz * ca; if (Math.abs(u) < e.len + .9 && Math.abs(v) < 1.2) hurtPig(e.x, e.z, 20); }
  };
  return e;
}
/* the grumpy mushroom walker: stomp it (Mario style) or shoot it */
function spawnShroom(at, mission, patrol) {
  const rg = Chars.makeShroom(), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true;
  const p = at || edgeSpawn(24), e = addEnt({ kind: 'enemy', sub: 'shroom', g, rig: rg, x: p.x, z: p.z, y: 0, cy: 1, r: 1.4, hittable: true, mission, st: 'walk', t: 0, ph: rand(0, TAU), x0: p.x, amp: patrol || 0, cool: 0 });
  e.update = dt => {
    e.ph += dt;
    if (e.st === 'squash') { e.t -= dt; g.scale.set(1.3, .22, 1.3); if (e.t <= 0) { burst(e.x, .5, e.z, 0xa060d8, 8, 3, .6); e.dead = true; } return; }
    if (e.amp) { e.x = e.x0 + Math.sin(e.ph * 1.5) * e.amp; g.rotation.y = Math.cos(e.ph * 1.5) > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { const dx = pig.x - e.x, dz = pig.z - e.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(7.5, 2.8 + L.d * 3.4) * L.em; e.x += dx / d * sp * dt; e.z += dz / d * sp * dt; pushOut(e, .8); keepInWorld(e, WORLD + 8); g.rotation.y += angDiff(g.rotation.y, Math.atan2(dx, dz)) * Math.min(1, 8 * dt); }
    g.position.set(e.x, Math.abs(Math.sin(clock * 9 + e.ph)) * .12, e.z); rg.feet[0].position.z = .2 + Math.sin(clock * 12) * .35; rg.feet[1].position.z = .2 - Math.sin(clock * 12) * .35; rg.head.rotation.z = Math.sin(clock * 6) * .06; Chars.blinkAll(rg, dt);
    e.cool -= dt;
    if (state === 'play') { const d = Math.hypot(pig.x - e.x, pig.z - e.z); if (d < e.r + .9) { if (pig.y > .35 && pig.y < 3.4 && pig.vy < 2) { pig.vy = 15; pig.grounded = false; stomp(); } else if (pig.y < 1.4 && e.cool <= 0) { e.cool = .8; hurtPig(e.x, e.z, 18); } } }
  };
  function stomp() {
    e.st = 'squash'; e.t = .45; e.hittable = false; sfx.stomp(); confetti(e.x, 1.5, e.z, 10); popText('Stomp!', e.x, 3, e.z, 'good'); for (let i = 0; i < 2; i++) spawnCoin(e.x + rand(-1.5, 1.5), e.z + rand(-1.5, 1.5), 1.6);
    if (e.mission && objs.some(o => o.type === 'baddies')) progress('baddies');
  }
  e.onBall = () => { if (e.st === 'walk') stomp(); };
  return e;
}
/* a cheeky ball that rolls from side to side across the dash track */
function spawnRoller(x, z, dir, spd) {
  const rg = Chars.makeHazard('ball', curTheme.hazCol), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true;
  const e = addEnt({ kind: 'hazard', sub: 'roller', g, rig: rg, x, z, y: 0, cy: 1, r: rg.rad, hittable: false, dir, spd }); g.position.set(x, 0, z);
  e.update = dt => {
    e.x += e.dir * e.spd * dt; if (e.x > 10.4) { e.x = 10.4; e.dir = -1; } else if (e.x < -10.4) { e.x = -10.4; e.dir = 1; }
    g.position.set(e.x, 0, e.z); g.rotation.y = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2; if (rg.roll) rg.roll.rotation.x += e.spd * dt / 1.5; Chars.blinkAll(rg, dt);
    if (state === 'play' && pig.y < 1.4 && Math.hypot(pig.x - e.x, pig.z - e.z) < e.r + .8) hurtPig(e.x, e.z, 20);
  };
  return e;
}

/* ============================================================ dash runs (Subway Surfers / Temple Run / Banana Kong style)
   A long track with pits, checkpoints, obstacles, enemies and an angry boulder. The track is a seeded list of
   "rows" that are only built when the pig gets close – so it can be a kilometre long and still run on a phone. */
const dash = { on: false, len: 0, startZ: 34, endZ: -900, specs: [], next: 0, pits: [], ckpts: [], ckptZ: null, meshes: [], run0: 13, fin: null };
const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a9ae0 })); voidMesh.position.y = -9; voidMesh.visible = false; scene.add(voidMesh);
function voidColor(t) { return /Lava/.test(t.name) ? 0xff5a1a : /Night|Moon/.test(t.name) ? 0x0c0c28 : /Candy|Rainbow|Toy/.test(t.name) ? 0xb06aff : /Snowy/.test(t.name) ? 0x6ab0e8 : 0x2f8fe0; }
function dashAdd(o) { scene.add(o); dash.meshes.push(o); return o; }
function clearDash() {
  for (const o of dash.meshes) { scene.remove(o); if (o.isInstancedMesh) o.dispose(); else if (o.userData.own && o.geometry) o.geometry.dispose(); }
  dash.meshes.length = 0; dash.on = false; dash.specs = []; dash.pits = []; dash.ckpts = []; dash.ckptZ = null; dash.fin = null;
  farm.visible = true; under.visible = true; voidMesh.visible = false; skyStars.position.z = 0;
}
const dashGroundAt = z => { for (const p of dash.pits) if (z < p.zs - .35 && z > p.ze + .35) return false; return true; };
let _finTex = null, _ckTex = null, _warnTex = null;
function bannerTex(kind) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
  if (kind === 'fin') {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 32, j * 32, 32, 32); }
    g.fillStyle = 'rgba(255,60,120,.92)'; g.fillRect(96, 26, 320, 76); g.font = '900 58px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('FINISH!', 256, 66);
  } else if (kind === 'ck') {
    const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#2fb3ff'); gr.addColorStop(1, '#7a5aff'); g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
    g.font = '900 60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.strokeStyle = '#2a1a6a'; g.lineWidth = 8; g.strokeText('CHECKPOINT ✔', 256, 68); g.fillText('CHECKPOINT ✔', 256, 68);
  } else {
    g.fillStyle = '#ffd23a'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#222'; for (let i = -4; i < 20; i++) { g.beginPath(); g.moveTo(i * 40, 128); g.lineTo(i * 40 + 20, 128); g.lineTo(i * 40 + 84, 0); g.lineTo(i * 40 + 64, 0); g.closePath(); g.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const finishTex = () => _finTex || (_finTex = bannerTex('fin')), ckptTex = () => _ckTex || (_ckTex = bannerTex('ck')), warnTex = () => _warnTex || (_warnTex = bannerTex('warn'));
function dashObstacle(type, x, z, w) {
  const g = new THREE.Group(); let hx = w / 2 + .7, hz = 1.2, hy = 1.5;
  if (type === 'log') {
    const l = part(g, GEO.cyl, MC(0x9a6a3a), 0, .75, 0, .75, w, .75); l.rotation.z = Math.PI / 2; for (const s of [-1, 1]) { const ec = part(g, GEO.cyl, MC(0xf0cc90), s * w / 2, .75, 0, .6, .06, .6); ec.rotation.z = Math.PI / 2; part(g, GEO.cyl, MC(0xc89a5a), s * (w / 2 + .03), .75, 0, .3, .06, .3).rotation.z = Math.PI / 2; }
    part(g, GEO.sph, MC(0x5fc83a), -w * .22, 1.55, 0, .5, .32, .5); part(g, GEO.sph, MC(0x7ae04a), w * .26, 1.5, 0, .36, .25, .36); part(g, GEO.box, MC(0xff4f4f), 0, 2.05, 0, .5, .5, .1);
  } else if (type === 'hay') {
    part(g, GEO.box, MC(0xf0c04a), 0, 1.9, 0, w, 3.8, 3); for (let i = 0; i < 3; i++) part(g, GEO.box, MC(0xc89a2a), 0, .7 + i * 1.2, 1.52, w * .96, .12, .06); hz = 1.9; hy = 3.9;
  } else { part(g, GEO.cyl, MC(0x6a4a2a), 0, .09, 0, w / 2, .18, w / 2); part(g, GEO.cyl, MC(0x8a6240), 0, .12, 0, w / 2.7, .2, w / 2.7); for (let i = 0; i < 5; i++) part(g, GEO.sph, MC(0x6a4a2a), Math.cos(i * 1.3) * w * .25, .35, Math.sin(i * 1.3) * w * .25, .5, .3, .5); }
  const e = addEnt({ kind: 'obstacle', sub: type, g, x, z, y: 0, cy: 1, r: type === 'mud' ? 0 : w / 2, cool: 0 }); g.position.set(x, 0, z); e.hideSh = true; if (e.sh) e.sh.visible = false;
  e.update = dt => {
    if (state !== 'play') return;
    if (type === 'mud') { if (Math.hypot(pig.x - e.x, pig.z - e.z) < w / 2 && pig.y < .6) { dashSlowT = Math.max(dashSlowT, .25); if (Math.random() < dt * 14) emit(pig.x, .3, pig.z, rand(-2, 2), rand(1, 3), rand(-2, 2), .5, 0x6a4a2a, .5, 1); } return; }
    if (Math.abs(pig.x - e.x) < hx && Math.abs(pig.z - e.z) < hz && pig.y < hy - .1 && invuln <= 0) { dashSlowT = 1; hurtPig(pig.x, pig.z - 2, 14); popText(type === 'hay' ? 'Hay-yaa!' : 'Oof!', pig.x, 4, pig.z, 'bad'); }
  };
  return e;
}
/* Temple-Run boulder: rolls after Piggy; if it catches up, ouch */
function spawnChaser() {
  const rg = Chars.makeChaser(), g = new THREE.Group(); g.add(rg.g); g.userData.hasOl = true;
  const e = addEnt({ kind: 'chaser', g, rig: rg, x: 0, z: pig.z + 36, y: 0, cy: 3, r: 4.4 }); e.hideSh = true;
  e.update = dt => {
    if (state !== 'play') { g.position.set(e.x, 4.4, e.z); return; }
    const hard = clamp(L.d * .75 + clamp((dash.startZ - pig.z) / Math.max(1, dash.len), 0, 1) * .35, 0, 1), sp = dashRun * lerp(.9, 1.0, hard);
    e.z -= sp * dt; e.x += (pig.x - e.x) * Math.min(1, .6 * dt); let gap = e.z - pig.z; if (gap > 40) { e.z = pig.z + 40; gap = 40; }
    rg.rock.rotation.x -= sp * dt / 4.4; rg.setFade(clamp((gap - 7) / 14, .22, 1)); g.position.set(e.x, 4.4 + Math.abs(Math.sin(clock * 5)) * .25, e.z);
    if (gap < 5.6) { hurtPig(pig.x, pig.z + 3, 24); dashSlowT = 0; e.z = pig.z + 32; shake = .5; popText('Boulder!', pig.x, 4.5, pig.z, 'bad'); }
  };
  return e;
}
function dashCkpt(z) {
  const g = new THREE.Group(); g.userData.own = false;
  for (const sx of [-12.4, 12.4]) { part(g, GEO.cyl, MC(0xffffff), sx, 4, 0, .5, 8, .5); part(g, GEO.sph, MC(0xffd23a, { emissive: 0x806000 }), sx, 8.3, 0, .85); }
  const bn = new THREE.Mesh(GEO.box, new THREE.MeshToonMaterial({ map: ckptTex(), gradientMap: Chars.ramp })); bn.scale.set(25, 3, .6); bn.position.set(0, 7.6, 0); g.add(bn);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11, .22, 6, 40), new THREE.MeshBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: .55 })); ring.rotation.x = Math.PI / 2; ring.position.y = .25; ring.scale.set(1.12, 1, .1); g.add(ring);
  g.position.z = z; outline(g, .08); dashAdd(g);
}
function setupDash() {
  const d = L.d, R = mulberry32(L.n * 977 + 5);
  dash.run0 = dashRun = lerp(11.5, 15.5, d); dashSlowT = 0;
  const len = Math.round(L.dashSec * dash.run0 * .92);
  Object.assign(dash, { on: true, len, startZ: 34, endZ: 34 - len, specs: [], next: 0, pits: [], ckpts: [], ckptZ: null });
  farm.visible = false; under.visible = false; voidMesh.visible = true; voidMesh.material.color.setHex(voidColor(curTheme)); voidMesh.position.z = dash.endZ / 2;
  const specs = dash.specs, pits = dash.pits, lanes = [-7, 0, 7], lane = () => lanes[Math.floor(R() * 3)], others = a => lanes.filter(x => x !== a);
  const S = (z, fn, t) => specs.push({ z, fn, t });
  const lineCoins = (x, z0, n) => { for (let i = 0; i < n; i++) spawnCoin(x, z0 - i * 2.3); };
  const arcCoins = (x, z0, n, h) => { for (let i = 0; i < n; i++) spawnCoin(x, z0 + n * .75 - i * 1.5, 1.7 + Math.sin(i / Math.max(1, n - 1) * Math.PI) * h); };
  const ckEvery = len / Math.max(2, Math.round(len / 320));
  let z = dash.startZ - 64, ckAt = dash.startZ - ckEvery, rows = 0, lastPit = -9, reward = 4 + Math.floor(R() * 3), nRew = 0;
  while (z > dash.endZ + 55) {
    const prog = (dash.startZ - z) / len, hard = clamp(d * .75 + prog * .35, 0, 1);
    if (z <= ckAt && ckAt > dash.endZ + 110) { const cz = z; S(cz, () => dashCkpt(cz), 'ckpt'); dash.ckpts.push({ z: cz, done: false }); z -= 28; ckAt = z - ckEvery; continue; }
    rows++; const adv = lerp(25, 15, hard) * (.9 + R() * .3);
    if (--reward <= 0) {
      reward = 5 + Math.floor(R() * 3); const l1 = lane(), zz = z, k = nRew++;
      S(zz, () => { lineCoins(l1, zz + 6, 9); arcCoins(others(l1)[k % 2], zz - 4, 7, 3.4); const pk = spawnPickup(l1, zz - 8, hearts < 3 ? 'heart' : (k % 2 ? 'magnet' : 'triple')); pk.life = 40; });
      z -= adv; continue;
    }
    const W = [['logs', 30], ['hay', hard > .08 ? 14 : 0], ['mud', 9], ['shrooms', 15], ['pad', 7], ['block', 6], ['sweeper', hard > .12 ? 8 + hard * 10 : 0], ['slalom', hard > .18 ? 9 : 0], ['rollers', hard > .22 ? 8 + hard * 8 : 0], ['slime', hard > .35 ? 7 : 0], ['cupcakes', hard > .1 ? 10 : 0], ['jacks', hard > .25 ? 8 : 0], ['pit', hard > .04 && rows - lastPit >= 3 ? 14 + hard * 10 : 0]];
    let tot = 0; for (const w of W) tot += w[1]; let rr = R() * tot, type = 'logs'; for (const w of W) { rr -= w[1]; if (rr <= 0) { type = w[0]; break; } }
    const zz = z;
    if (type === 'logs') {
      const l1 = lane(), twin = R() < .3 + hard * .5, l2 = twin ? others(l1)[Math.floor(R() * 2)] : null, free = lanes.filter(x => x !== l1 && x !== l2)[0];
      S(zz, () => { dashObstacle('log', l1, zz, 6.4); if (l2 != null) dashObstacle('log', l2, zz, 6.4); arcCoins(l1, zz, 7, 3.2); if (free != null) lineCoins(free, zz + 4, 5); });
    } else if (type === 'hay') {
      const l1 = lane(), twin = hard > .3 && R() < .55, l2 = twin ? others(l1)[Math.floor(R() * 2)] : null, free = lanes.find(x => x !== l1 && x !== l2);
      S(zz, () => { dashObstacle('hay', l1, zz, 6.6); if (l2 != null) dashObstacle('hay', l2, zz, 6.6); if (free != null) lineCoins(free, zz + 4, 6); });
    } else if (type === 'mud') {
      const l1 = lane(), l2 = others(l1)[0];
      S(zz, () => { dashObstacle('mud', l1, zz, 9); lineCoins(l1, zz + 3, 5); lineCoins(l2, zz + 2, 4); });
    } else if (type === 'shrooms') {
      const c = 2 + Math.floor(hard * 2.5 + R());
      S(zz, () => { for (let k = 0; k < c; k++) { const gg = spawnShroom({ x: (k % 2 ? 3 : -3), z: zz - k * 5 }, false, 7 + k); gg.ph = k * 2.4; gg.x0 = k % 2 ? 2 : -2; } lineCoins(0, zz + 4, 4); });
    } else if (type === 'cupcakes') {
      const c = 2 + Math.floor(hard * 1.5 + R());
      S(zz, () => { for (let k = 0; k < c; k++) { const q = spawnCupcake({ x: (k % 2 ? 3 : -3), z: zz - k * 6 }, false, 6 + k); q.ph = k * 2.2; q.x0 = k % 2 ? 2 : -2; } lineCoins(0, zz + 4, 4); });
    } else if (type === 'jacks') {
      const l1 = lane();
      S(zz, () => { spawnJack({ x: l1, z: zz }, false, true); lineCoins(others(l1)[0], zz + 3, 5); lineCoins(others(l1)[1], zz - 2, 4); });
    } else if (type === 'pad') {
      const l1 = lane();
      S(zz, () => { spawnPad({ x: l1, z: zz }); for (let i = 0; i < 6; i++) spawnCoin(l1, zz - 5 - i * 2, 5 + Math.sin(i / 5 * Math.PI) * 4.5); });
    } else if (type === 'block') {
      const l1 = lane();
      S(zz, () => { spawnBlock({ x: l1, z: zz }); spawnBlock({ x: others(l1)[0], z: zz - 4 }); lineCoins(0, zz + 3, 4); });
    } else if (type === 'sweeper') {
      const sp = lerp(1.4, 2.9, hard);
      S(zz, () => { const sw = spawnSweeper({ x: 0, z: zz }, 12.2, sp); sw.hideSh = true; lineCoins(lane2(zz), zz + 5, 4); });
    } else if (type === 'slalom') {
      const c = 3 + Math.floor(hard * 2), s0 = R() < .5 ? -1 : 1;
      S(zz, () => { for (let k = 0; k < c; k++) { const sd = (k % 2 ? -1 : 1) * s0; dashObstacle('hay', sd * 6.25, zz - k * 16, 9.5); lineCoins(-sd * 6, zz - k * 16 + 5, 4); } });
      z -= (c - 1) * 16;
    } else if (type === 'rollers') {
      const c = 1 + (hard > .5 ? 1 : 0), sp = lerp(5.5, 9.5, hard);
      S(zz, () => { for (let k = 0; k < c; k++) spawnRoller(k ? 6 : -6, zz - k * 9, k ? -1 : 1, sp); lineCoins(0, zz + 5, 4); });
    } else if (type === 'slime') {
      S(zz, () => { for (let k = 0; k < 2; k++) spawnSlime(1, { x: k ? 6 : -6, z: zz - k * 4 }, false); lineCoins(0, zz + 5, 4); });
    } else if (type === 'pit') {
      const w = Math.round(lerp(8, 17, hard) * (.92 + R() * .16)), zs = zz, ze = zz - w, cx = lanes[Math.floor(R() * 3)]; lastPit = rows; pits.push({ zs, ze });
      S(zs, () => { for (let i = 0; i < 8; i++) spawnCoin(cx, zs + 3 - i * (w + 6) / 7, 1.7 + Math.sin(i / 7 * Math.PI) * (2.6 + w * .12)); });
      z -= w + 24;
    }
    z -= adv;
  }
  function lane2(zz) { return lanes[Math.floor(Math.abs(Math.sin(zz * 12.9898)) * 3) % 3]; }
  dashScenery(R);
  spawnChaser();
}
/* road, banks, pits, trees, lane marks, finish gate */
function dashScenery(R) {
  const t = curTheme, own = o => { o.userData.own = true; return o; }, gcol = new THREE.Color(t.ground).getHex(), roadC = new THREE.Color(t.path[0]).getHex();
  const sideM = M(0x8a6a44), topM = M(gcol), botM = M(0x4a3a2a), roadM = M(roadC), railM = M(0xffffff);
  let top = dash.startZ + 46; const segs = [];
  for (const p of dash.pits.slice().sort((a, b) => b.zs - a.zs)) { if (top - p.zs > 1) segs.push([top, p.zs]); top = p.ze; }
  segs.push([top, dash.endZ - 70]);
  for (const [z0, z1] of segs) {
    const l = z0 - z1, zc = (z0 + z1) / 2;
    const bank = own(new THREE.Mesh(new THREE.BoxGeometry(96, 6, l), [sideM, sideM, topM, botM, sideM, sideM])); bank.position.set(0, -3, zc); dashAdd(bank);
    const road = own(new THREE.Mesh(new THREE.BoxGeometry(25, .12, l), roadM)); road.position.set(0, .03, zc); dashAdd(road);
    for (const sx of [-12.9, 12.9]) { const rl = own(new THREE.Mesh(new THREE.BoxGeometry(.8, .55, l), railM)); rl.position.set(sx, .3, zc); dashAdd(rl); }
  }
  for (const p of dash.pits) { const w = own(new THREE.Mesh(new THREE.BoxGeometry(25, .06, 1.8), new THREE.MeshBasicMaterial({ map: warnTex() }))); w.position.set(0, .13, p.zs - 1.4); dashAdd(w); }
  const inPit = z => dash.pits.some(p => z < p.zs + 2.5 && z > p.ze - 2.5), m4 = new THREE.Matrix4();
  // lane marks
  const nm = Math.floor(dash.len / 7), marks = dashAdd(new THREE.InstancedMesh(GEO.box, M(0xfff2a0), nm * 2)); let mi = 0;
  for (let i = 0; i < nm; i++) { const zz = dash.startZ + 30 - i * 7; if (inPit(zz)) continue; for (const lx of [-3.5, 3.5]) { m4.compose(new THREE.Vector3(lx, .12, zz), new THREE.Quaternion(), new THREE.Vector3(.4, .05, 3)); marks.setMatrixAt(mi++, m4); } }
  marks.count = mi;
  // cones
  const nc = Math.floor(dash.len / 14), cones = dashAdd(new THREE.InstancedMesh(GEO.cone, M(0xff7a1a), nc * 2)); mi = 0;
  for (let i = 0; i < nc; i++) { const zz = dash.startZ + 30 - i * 14; if (inPit(zz)) continue; for (const sx of [-14.2, 14.2]) { m4.compose(new THREE.Vector3(sx, .8, zz), new THREE.Quaternion(), new THREE.Vector3(.6, 1.5, .6)); cones.setMatrixAt(mi++, m4); } }
  cones.count = mi;
  // trees
  const n = Math.min(260, Math.round(dash.len / 5)), trunk = dashAdd(new THREE.InstancedMesh(GEO.cyl, M(0x8a5a30), n)), crown = dashAdd(new THREE.InstancedMesh(GEO.ico, M(0xffffff), n)), F = t.fol, col = new THREE.Color(); mi = 0;
  for (let i = 0; i < n; i++) {
    let tz = 0, tr = 0; do { tz = lerp(dash.startZ + 30, dash.endZ - 40, R()); tr++; } while (inPit(tz) && tr < 8); if (inPit(tz)) continue;
    const sd = i % 2 ? 1 : -1, tx = sd * lerp(18, 42, R()), s = lerp(1.7, 3.1, R());
    m4.compose(new THREE.Vector3(tx, s * .8, tz), new THREE.Quaternion(), new THREE.Vector3(.35 * s, 1.6 * s, .35 * s)); trunk.setMatrixAt(mi, m4);
    m4.compose(new THREE.Vector3(tx, s * 2.3, tz), new THREE.Quaternion(), new THREE.Vector3(1.5 * s, 1.35 * s, 1.5 * s)); crown.setMatrixAt(mi, m4);
    col.setHSL(t.rainbow ? R() : (F[0] + (R() - .5) * F[3] * 2 + 1) % 1, F[1], F[2] + R() * F[4]); crown.setColorAt(mi, col); mi++;
  }
  trunk.count = crown.count = mi; if (crown.instanceColor) crown.instanceColor.needsUpdate = true;
  // finish gate
  const gz = dash.endZ, tex = finishTex(), fg = new THREE.Group();
  for (const sx of [-12.4, 12.4]) { part(fg, GEO.cyl, MC(0xff4f9a), sx, 5, 0, .65, 10, .65); part(fg, GEO.sph, MC(0xffd23a, { emissive: 0x806000 }), sx, 10.3, 0, .95); }
  const bn = new THREE.Mesh(GEO.box, new THREE.MeshToonMaterial({ map: tex, gradientMap: Chars.ramp })); bn.scale.set(25, 4, .8); bn.position.set(0, 9.2, 0); fg.add(bn);
  const sl = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ map: tex })); sl.scale.set(25, .05, 2.4); sl.position.set(0, .16, 0); fg.add(sl);
  fg.position.z = gz; outline(fg, .08); dashAdd(fg); dash.fin = fg;
}
function dashFall() {
  const p = dash.pits.find(q => pig.z < q.zs + 1 && pig.z > q.ze - 1) || dash.pits.find(q => q.ze < pig.z + 6) || null, safe = p ? p.zs + 6 : pig.z + 14;
  splashFx(pig.x, pig.z);
  if (invuln <= 0 && state === 'play') { hearts--; updateHearts(); combo = 0; comboT = 0; sfx.hit(); buzz(100); popText('Splash!', pig.x, 4, pig.z + 4, 'bad'); if (hearts <= 0) { failLevel('You fell in the water! 💦'); return; } }
  pig.x = clamp(pig.x, -9, 9); pig.z = safe; pig.y = 0; pig.vx = 0; pig.vz = 0; pig.vy = 0; pig.grounded = true; pig.falling = false; invuln = Math.max(invuln, 1.6); dashSlowT = .6; shake = .3;
  const ch = ents.find(e => e.kind === 'chaser'); if (ch && ch.z - pig.z < 24) ch.z = pig.z + 24;
}
function splashFx(x, z) { sfx.splash(); for (let i = 0; i < 16; i++) emit(x + rand(-1, 1), -.2, z + rand(-1, 1), rand(-3, 3), rand(5, 11), rand(-3, 3), rand(.5, .9), 0xbfeaff, rand(.5, .9), 0); }
/* restart a dash from the last checkpoint (one free retry per level) */
function dashResume(z) {
  clearEnts(); for (const b of balls) { b.alive = false; b.m.visible = false; } for (const p of bprojs) scene.remove(p.m); bprojs.length = 0;
  pig.x = 0; pig.z = z + 3; pig.y = 0; pig.vx = pig.vy = pig.vz = 0; pig.grounded = true; pig.falling = false; dashSlowT = 0;
  dash.next = dash.specs.findIndex(s => s.z < pig.z - 4); if (dash.next < 0) dash.next = dash.specs.length;
  spawnChaser(); camera.position.set(0, 16, pig.z + 20);
}
function dashTick(dt) {
  if (!dash.on) return;
  const prog = clamp((dash.startZ - pig.z) / dash.len, 0, 1); dashRun = dash.run0 * (1 + .22 * prog);
  while (dash.next < dash.specs.length && dash.specs[dash.next].z > pig.z - 175) { const s = dash.specs[dash.next++]; if (s.z < pig.z - 4) s.fn(); }
  for (const e of ents) if (e.z > pig.z + 52 && e.kind !== 'chaser') e.dead = true;
  for (const c of dash.ckpts) if (!c.done && pig.z < c.z) {
    c.done = true; dash.ckptZ = c.z; sfx.stage(); confetti(pig.x, 3, pig.z, 24); popText('Checkpoint! ✔', pig.x, pig.y + 5, pig.z, 'gold');
    if (hearts < 3) { hearts++; updateHearts(); }
  }
  skyStars.position.z = pig.z;
  if (pig.z < dash.endZ && state === 'play') progress('dash');
}
function spawnFun() {
  const d = L.d, n = L.n, k = L.stages.length > 2 ? .8 : 1;
  for (let i = 0; i < Math.round((4 + d * 5) * k); i++) coinTrail(6 + Math.floor(Math.random() * 4));
  if (n >= 3) for (let i = 0; i < 2 + Math.round(d * 2); i++) spawnBlock();
  if (n >= 6) for (let i = 0; i < 1 + Math.round(d * 3); i++) spawnPad();
  if (n >= 9) for (let i = 0; i < 1 + Math.round(d * 2.5); i++) spawnSweeper(null, rand(6, 9) + d * 3, lerp(1, 2.2, d));
}

/* ======== 10_cosmetics_flow.js ======== */
/* ============================================================ cosmetics: hats and skins */
const HATS = [{ id: 'hat0', n: 'No hat', e: '🐷', p: 0 }, { id: 'party', n: 'Party', e: '🥳', p: 30 }, { id: 'cap', n: 'Cap', e: '🧢', p: 60 }, { id: 'shades', n: 'Cool', e: '😎', p: 80 }, { id: 'cowboy', n: 'Cowboy', e: '🤠', p: 90 }, { id: 'chef', n: 'Chef', e: '👨‍🍳', p: 100 }, { id: 'crown', n: 'Royal', e: '👑', p: 140 }, { id: 'prop', n: 'Copter', e: '🚁', p: 170 }, { id: 'wizard', n: 'Wizard', e: '🧙', p: 220 },
  { id: 'pirate', n: 'Pirate', e: '🏴‍☠️', p: 110 }, { id: 'bunny', n: 'Bunny', e: '🐰', p: 120 }, { id: 'flower', n: 'Flowers', e: '🌼', p: 130 }, { id: 'duck', n: 'Ducky', e: '🦆', p: 150 }, { id: 'cupcake', n: 'Cupcake', e: '🧁', p: 190 }, { id: 'unicorn', n: 'Unicorn', e: '🦄', p: 260 }];
const SKINS = [{ id: 'skin0', n: 'Classic', e: '🌸', p: 0, c: [0xff80b6, 0xffb3d0] }, { id: 'sky', n: 'Blueberry', e: '💙', p: 120, c: [0x6ab8ff, 0x9bd2ff] }, { id: 'mint', n: 'Mint', e: '🍃', p: 120, c: [0x5fd89a, 0x9af0c4] }, { id: 'grape', n: 'Grape', e: '🍇', p: 160, c: [0xa874ff, 0xc9a6ff] }, { id: 'sun', n: 'Sunny', e: '🍊', p: 160, c: [0xffa24a, 0xffc88a] }, { id: 'candy', n: 'Candy', e: '🍬', p: 200, c: [0xff6ad0, 0xffa8ea] }, { id: 'gold', n: 'Golden', e: '✨', p: 250, c: [0xffcf3a, 0xffe27a] },
  { id: 'lemon', n: 'Lemon', e: '🍋', p: 140, c: [0xffe45c, 0xfff0a0] }, { id: 'berry', n: 'Berry', e: '🍓', p: 170, c: [0xff4a5a, 0xff8a96] }, { id: 'ocean', n: 'Ocean', e: '🌊', p: 190, c: [0x2ac8d8, 0x8af0f0] }, { id: 'cocoa', n: 'Cocoa', e: '🍫', p: 210, c: [0x9a6a4a, 0xc89a7a] }];
/* every level n (1..1000) hands out its own hat 'h<n>' and skin 's<n>' (generated by ch_world.js) the first time it is beaten */
const lvRe = /^([hs])(\d{1,4})$/;
const levelDone = n => n >= 1 && n <= TOTAL_LEVELS && +save.stars[n - 1] > 0;
function hatInfo(id) { const m = lvRe.exec(id); if (m && m[1] === 'h' && +m[2] >= 1 && +m[2] <= TOTAL_LEVELS) { const i = Chars.hatInfo(+m[2]); return { id, n: i.n, e: i.e, lv: +m[2] }; } return HATS.find(x => x.id === id) || HATS[0]; }
function skinInfo(id) { const m = lvRe.exec(id); if (m && m[1] === 's' && +m[2] >= 1 && +m[2] <= TOTAL_LEVELS) { const i = Chars.skinInfo(+m[2]); return { id, n: i.n, e: i.e, c: i.c, pat: i.pat, c3: i.c3, lv: +m[2] }; } return SKINS.find(x => x.id === id) || SKINS[0]; }
const ownsItem = id => { const m = lvRe.exec(id); return m ? levelDone(+m[2]) : save.own.includes(id); };
if (!ownsItem(save.hat)) save.hat = 'hat0'; if (!ownsItem(save.skin)) save.skin = 'skin0';
/* dress any pig rig (mine or another player's) */
function dressRig(r, hatId, skinId) {
  const sk = skinInfo(skinId); r.setSkin(sk.c[0], sk.c[1], sk.pat, sk.c3);
  if (r.hat) { r.hatA.remove(r.hat); r.hat = null; } if (r.shades) { r.inner.remove(r.shades); r.shades = null; }
  if (hatId === 'shades') { const g = Chars.makeShades(); g.position.set(0, 1.84, 1.44); g.scale.setScalar(1.28); Chars.outline(g, .03); r.inner.add(g); r.shades = g; }
  else if (hatId && hatId !== 'hat0') { const g = Chars.makeHat(hatId); Chars.outline(g, .05); r.hatA.add(g); r.hat = g; }
}
const applyCosmetic = () => dressRig(rig, save.hat, save.skin);
function renderShop() {
  $('shopCoins').textContent = '🪙 ' + save.coins;
  const draw = (box, list, key) => {
    box.innerHTML = '';
    for (const it of list) {
      const own = save.own.includes(it.id), on = save[key] === it.id, b = document.createElement('button');
      b.className = 'item' + (on ? ' on' : '') + (own ? '' : ' lock'); b.innerHTML = `<b>${it.e}</b>${it.n}<br>${on ? '✔ Wearing' : own ? 'Wear' : '🪙 ' + it.p}`;
      b.onclick = () => {
        if (!own) { if (save.coins < it.p) { sfx.hit(); b.innerHTML = `<b>😢</b>Need ${it.p - save.coins} more`; return; } save.coins -= it.p; save.own.push(it.id); sfx.win(); confetti(pig.x, 3, pig.z, 18); }
        else sfx.coin();
        save[key] = it.id; writeSave(); updCoins(); applyCosmetic(); pig.mood = 'cheer'; pig.moodT = 1.2; renderShop();
      };
      box.appendChild(b);
    }
  };
  draw($('shopHats'), HATS, 'hat'); draw($('shopSkins'), SKINS, 'skin'); renderWard();
}
/* ---- wardrobe: one page per world = 10 level hats + 10 level skins */
let wardW = 0;
function renderWard() {
  const t = themeFor(wardW), lo = wardW * 10 + 1;
  $('wardTitle').textContent = `${t.emoji} ${t.name} · Lv ${lo}-${lo + 9}`;
  let done = 0; for (let n = 1; n <= TOTAL_LEVELS; n++) if (levelDone(n)) done++;
  $('wardCount').textContent = `${done} / ${TOTAL_LEVELS} unlocked`;
  const hi = hatInfo(save.hat), si = skinInfo(save.skin); $('wardWear').textContent = `Wearing: ${hi.e} ${hi.n} · ${si.e} ${si.n}`;
  for (const [boxId, kind, key] of [['wardHats', 'h', 'hat'], ['wardSkins', 's', 'skin']]) {
    const box = $(boxId); box.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const n = lo + i, id = kind + n, own = levelDone(n), on = save[key] === id, b = document.createElement('button');
      const inf = kind === 'h' ? hatInfo(id) : skinInfo(id);
      b.className = 'item' + (on ? ' on' : '') + (own ? '' : ' lock'); b.title = inf.n;
      b.innerHTML = own ? `<b>${inf.e}</b>Lv ${n}<br>${on ? '✔' : 'Wear'}` : `<b>🔒</b>Lv ${n}`;
      if (own && kind === 's') { b.style.background = `linear-gradient(135deg,#${inf.c[0].toString(16).padStart(6, '0')},#${inf.c[1].toString(16).padStart(6, '0')})`; b.style.textShadow = '0 1px 2px rgba(0,0,0,.6)'; }
      b.onclick = () => {
        if (!own) { sfx.hit(); b.innerHTML = `<b>😢</b>Beat<br>Lv ${n}!`; return; }
        sfx.coin(); save[key] = id; writeSave(); applyCosmetic(); pig.mood = 'cheer'; pig.moodT = 1.2; renderShop();
      };
      box.appendChild(b);
    }
  }
}
const wardGo = d => { wardW = ((wardW + d) % NWORLDS + NWORLDS) % NWORLDS; sfx.coin(); renderWard(); };
$('wardPrev').onclick = () => wardGo(-1); $('wardNext').onclick = () => wardGo(1); $('wardPrev10').onclick = () => wardGo(-10); $('wardNext10').onclick = () => wardGo(10);
$('wardNow').onclick = () => { wardW = Math.floor((Math.min(save.max, TOTAL_LEVELS) - 1) / 10); sfx.coin(); renderWard(); };

/* ============================================================ level flow (multi-stage) */
let harassTimer = 5, levelT = 0;
/* ============================================================ victory cheers: every level has its own dance + particle show */
const CHEERS = [{ n: 'Spin & Hop', e: '🌀' }, { n: 'Backflip', e: '🤸' }, { n: 'Moonwalk', e: '🌙' }, { n: 'Cartwheel', e: '🎡' }, { n: 'Pogo Jump', e: '🦘' }, { n: 'Wiggle Dance', e: '💃' },
  { n: 'Rocket Boost', e: '🚀' }, { n: 'Ballet Twirl', e: '🦢' }, { n: 'Bunny Hop', e: '🐰' }, { n: 'Robot Dance', e: '🤖' }, { n: 'Superhero Flight', e: '🦸' }, { n: 'Conga Circle', e: '🎶' }];
const CHEER_FX = ['Confetti', 'Fireworks', 'Hearts', 'Stars', 'Bubbles', 'Rainbow Ring'];
const cheerIdx = n => ((n | 0) * 7) % 12, cheerFxIdx = n => (((n | 0) * 5) + Math.floor((n | 0) / 6)) % 6;
const RAINBOW = [0xff4f5a, 0xff9a2a, 0xffe45c, 0x6ae05a, 0x4fb8ff, 0xb06aff];
let cheerOn = false, cheerT = 0, cheerFlip = 0, cheerRate = 0, cheerHs = 0, cheerFxT = 0, cheerFxK = 0;
function cheerReset() {
  if (cheerOn) { rig.inner.rotation.y = 0; rig.inner.position.x = rig.inner.position.z = 0; }
  cheerOn = false; cheerT = 0; cheerFlip = 0; cheerHs = 0; cheerFxT = 0; cheerFxK = 0;
}
/* physics side of the dance: hops, spins (called while the win state is on) */
function cheerStep(dt) {
  const c = ((L && L.cheer) | 0) % 12; cheerOn = true; cheerT += dt; cheerHs = 0; pig.thrusting = false;
  if (pig.grounded) cheerFlip = 0; else cheerFlip += cheerRate * dt;
  const hop = (v, snd) => { if (pig.grounded) { pig.vy = v; pig.grounded = false; cheerRate = TAU / Math.max(.25, 2 * v / GRAV); if (snd !== false) sfx.squeak(); } };
  switch (c) {
    case 0: pig.heading += dt * 5.2; hop(7.5); break;                                   // spin & hop
    case 1: hop(10.5); break;                                                           // backflip (pose does the flip)
    case 2: cheerHs = 4; break;                                                         // moonwalk (legs walk, body slides back)
    case 3: pig.heading += dt * .9; hop(8.5); break;                                    // cartwheel
    case 4: hop(11.5, false); break;                                                    // pogo
    case 5: break;                                                                      // wiggle (pose only)
    case 6: pig.heading += dt * 9; hop(15, false); if (!pig.grounded && pig.vy > 0) pig.thrusting = true; break;   // rocket
    case 7: pig.heading += dt * 9.5; hop(4.2, false); break;                            // ballet
    case 8: hop(6.4); break;                                                            // bunny hop
    case 9: break;                                                                      // robot (pose only)
    case 10: pig.heading += dt * .7; hop(9); if (!pig.grounded) pig.thrusting = true; break;   // superhero flight
    default: cheerHs = 3.5; hop(3.2, false); break;                                      // conga
  }
}
/* visual side of the dance: overrides the rig pose after rig.animate (visual only, the real pig position is untouched) */
function cheerPose(g) {
  if (!cheerOn) return;
  if (state !== 'win') { cheerReset(); return; }
  const c = ((L && L.cheer) | 0) % 12, t = cheerT, I = rig.inner, air = !pig.grounded;
  switch (c) {
    case 1: I.rotation.x = -cheerFlip; break;
    case 2: { const b = 1.3 - ((t * .9) % 1) * 2.6; g.position.x -= Math.sin(pig.heading) * b; g.position.z -= Math.cos(pig.heading) * b; I.rotation.x = -.18; break; }
    case 3: I.rotation.z = cheerFlip; break;
    case 4: { I.scale.set(air ? .9 : 1.15, air ? 1.15 : .8, air ? .9 : 1.15); I.rotation.z = Math.sin(t * 9) * .12; break; }
    case 5: I.rotation.z = Math.sin(t * 13) * .32; I.rotation.y = Math.sin(t * 6.5) * .6; I.scale.y *= 1 + .06 * Math.sin(t * 13); break;
    case 6: I.rotation.x = 0; break;
    case 7: I.rotation.x = -.12; I.rotation.z = Math.sin(t * 5) * .1; break;
    case 8: g.rotation.y += Math.sin(t * 4) * .5; I.rotation.x = air ? -.25 : .1; break;
    case 9: { const k = Math.floor(t / .38); g.rotation.y += (k % 4) * Math.PI / 2; I.rotation.z = (k % 2 ? 1 : -1) * .28; I.rotation.x = 0; break; }
    case 10: I.rotation.x = air ? 1.15 : .1; break;
    case 11: { const a = t * 1.6; g.position.x += (Math.cos(a) - 1) * 2.6; g.position.z += Math.sin(a) * 2.6; g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)); I.rotation.z = Math.sin(t * 8) * .12; break; }
  }
}
/* the particle show that goes with the dance */
function cheerFx(dt) {
  cheerFxT -= dt; if (cheerFxT > 0) return; cheerFxT = .13; cheerFxK++;
  const v = cheerFxIdx(L && L.n), x = pig.x, y = pig.y, z = pig.z, k = cheerFxK;
  if (v === 0) confetti(x, y + 1.8, z, 5);
  else if (v === 1) { if (k % 4 === 1) { const cx = x + rand(-6, 6), cy = 9 + rand(0, 4), cz = z + rand(-6, 6), col = pick(CONF); for (let i = 0; i < 24; i++) { const a = rand(0, TAU), b = rand(-1, 1), s = Math.sqrt(1 - b * b) * 7; emit(cx, cy, cz, Math.cos(a) * s, b * 7, Math.sin(a) * s, rand(.7, 1.1), col, rand(.5, .8), 0); } sfx.pop(); } }
  else if (v === 2) emit(x + rand(-2.5, 2.5), y + 1.5, z + rand(-2.5, 2.5), rand(-.6, .6), rand(3, 4.5), rand(-.6, .6), 1.5, pick([0xff4f7a, 0xff7aa8, 0xff3a5a]), rand(.7, 1.1), -.3);
  else if (v === 3) { for (let i = 0; i < 2; i++) emit(x + rand(-7, 7), y + 9, z + rand(-7, 7), 0, -4, 0, 1.7, pick([0xffe45c, 0xffffff, 0xfff0a0]), rand(.6, 1), 0); if (k % 6 === 0) sfx.sparkle(); }
  else if (v === 4) { for (let i = 0; i < 2; i++) emit(x + rand(-5, 5), .4, z + rand(-5, 5), rand(-.4, .4), rand(3, 4.4), rand(-.4, .4), 2.2, pick([0xbfe8ff, 0xd8f4ff, 0xffffff]), rand(.9, 1.5), .1); }
  else { for (let i = 0; i < 6; i++) { const a = k * .9 + i * TAU / 6; emit(x, y + 1.2, z, Math.cos(a) * 6, rand(2, 4), Math.sin(a) * 6, .9, RAINBOW[i], .8, .2); } }
}

const goalRing = new THREE.Mesh(new THREE.TorusGeometry(5.2, .25, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff4f4f, transparent: true, opacity: .7 })); goalRing.rotation.x = Math.PI / 2; goalRing.position.set(GOAL.x, .25, GOAL.z); goalRing.visible = false; farm.add(goalRing);
function setHud(v) {
  for (const id of ['hud', 'objs', 'pause', 'mute', 'jump', 'shoot', 'fuelwrap', 'jl']) $(id).style.display = v ? '' : 'none';
  if (!v) { el.bossbar.style.display = 'none'; el.combo.style.opacity = 0; el.stage.style.display = 'none'; el.arrow.style.display = 'none'; $('emotes').style.display = 'none'; $('mpScore').style.display = 'none'; stickEnd(); }
  else { $('emotes').style.display = MP.active ? '' : 'none'; $('mpScore').style.display = MP.active ? '' : 'none'; }
}
function resetRun() {
  cheerReset(); speedMode = L.mod === 'speedy'; iceMode = L.mod === 'ice'; GRAV = L.mod === 'lowgrav' ? 12 : 26; curMod = L.mod; windMode = L.mod === 'wind'; bounceMode = L.mod === 'bouncy'; partyMode = L.mod === 'party'; windA = Math.random() * TAU; chickGrp.followers.length = 0;
  pig.x = 0; pig.z = L.dash ? dash.startZ : 24; pig.y = 0; pig.vx = pig.vz = pig.vy = 0; pig.heading = Math.PI; pig.fuel = 1; pig.grounded = true; pig.falling = false; pig.coy = 0; pig.stun = 0; pig.mood = 'normal'; pig.moodT = 0;
  camYaw = Math.PI; camPitch = .5; camManT = 0; runCoins = 0; magnetT = 0; dashSlowT = 0;
  hearts = 3; invuln = 0; tripleT = 0; shootCd = 0; combo = 0; comboT = 0; foxQueue = 0; foxTimer = 2; pickupTimer = 7; harassTimer = 6; levelT = 0; stageIdx = 0; usedCkpt = false;
  waves.queue = 0; waves.num = 0; waves.total = 1; simon.pads.length = 0; simon.phase = 'idle'; flagState.left = 0; flagState.active = null;
}
/* ============================================================ landmark architecture: 0-3 toon buildings per level, themed by world */
const archGroup = new THREE.Group(); farm.add(archGroup);
const archCache = {}; let archCols = [], archList = [];
const ARCH_THEME = { 0: ['treehouse', 'castle', 'clocktower'], 1: ['treehouse', 'tipi', 'clocktower'], 2: ['lighthouse', 'castle'], 3: ['gingerbread', 'carousel'], 4: ['igloo', 'castle'], 5: ['tipi', 'treehouse'], 6: ['pyramid', 'tipi'], 7: ['lighthouse', 'treehouse'], 8: ['mushroom', 'castle'], 9: ['clocktower', 'castle'],
  10: ['castle', 'clocktower'], 11: ['carousel', 'clocktower'], 12: ['rocket'], 13: ['castle', 'carousel'], 14: ['lighthouse', 'clocktower'], 15: ['treehouse', 'pyramid', 'tipi'], 16: ['pyramid', 'castle'], 17: ['castle', 'pagoda'], 18: ['castle', 'clocktower', 'carousel'], 19: ['lighthouse', 'castle'],
  20: ['rocket', 'clocktower'], 21: ['pagoda', 'clocktower'], 22: ['castle', 'carousel'], 23: ['pagoda', 'rocket'], 24: ['castle', 'lighthouse'], 25: ['lighthouse', 'pagoda'], 26: ['gingerbread', 'igloo', 'carousel'], 27: ['castle', 'clocktower'], 28: ['mushroom', 'treehouse'], 29: ['pagoda', 'castle'] };
const archFixed = [{ x: 0, z: 24, r: 14 }, { x: GOAL.x, z: GOAL.z, r: 13 }, { x: -42, z: -60, r: 17 }, { x: 30, z: -75, r: 9 }, { x: POND.x, z: POND.z, r: POND.r + 2 }];
/* bake a building into one mesh per material (a castle drops from ~120 draw calls to ~10) */
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse(o => { if (o.isMesh && o.visible) { let b = buckets.get(o.material); if (!b) buckets.set(o.material, b = []); b.push(o); } });
  const out = new THREE.Group(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [mat, list] of buckets) {
    let nv = 0, ni = 0; for (const o of list) { const ge = o.geometry; nv += ge.attributes.position.count; ni += ge.index ? ge.index.count : ge.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
    for (const o of list) {
      const ge = o.geometry, P = ge.attributes.position, N = ge.attributes.normal, U = ge.attributes.uv, m = o.matrixWorld, flip = m.determinant() < 0; nm.getNormalMatrix(m);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z; }
        if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
      }
      const cnt = ge.index ? ge.index.count : P.count, ix = k => ge.index ? ge.index.getX(k) : k;
      for (let i = 0; i < cnt; i += 3) { const a = ix(i) + vo, b = ix(i + 1) + vo, c = ix(i + 2) + vo; idx[io + i] = a; idx[io + i + 1] = flip ? c : b; idx[io + i + 2] = flip ? b : c; }
      vo += P.count; io += cnt;
    }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); mg.setIndex(new THREE.BufferAttribute(idx, 1)); mg.computeBoundingSphere();
    const mesh = new THREE.Mesh(mg, mat); mesh.renderOrder = list[0].renderOrder; out.add(mesh);
  }
  return out;
}
function clearArch() {
  for (const a of archList) for (const m of a.mats) m.dispose();
  for (const c of archCols) { const i = cols.indexOf(c); if (i >= 0) cols.splice(i, 1); }
  archCols = []; archList = []; for (const ch of archGroup.children.slice()) archGroup.remove(ch);
}
/* buildings that stand between the camera and Piggy (or around the camera) fade out so the view is never blocked */
function updateArch(dt) {
  if (!archList.length) return;
  const cx = camera.position.x, cz = camera.position.z, sx = pig.x - cx, sz = pig.z - cz, sl = sx * sx + sz * sz || 1;
  for (const a of archList) {
    const t = clamp(((a.x - cx) * sx + (a.z - cz) * sz) / sl, 0, 1), d = Math.hypot(cx + sx * t - a.x, cz + sz * t - a.z);
    const want = (Math.hypot(cx - a.x, cz - a.z) < a.rad + 3 || (d < a.rad * .9 && t < .97)) ? .14 : 1;
    if (a.alpha === want) continue;
    a.alpha += (want - a.alpha) * Math.min(1, 8 * dt); if (Math.abs(want - a.alpha) < .01) a.alpha = want;
    for (const m of a.mats) m.opacity = a.alpha;
  }
}
function placeArch() {
  clearArch();
  if (!L || L.dash || L.mp) return;
  const n = L.n | 0, cnt = n < 3 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3; if (!cnt) return;
  const R = mulberry32(n * 6151 + 29), ti = THEME_ORDER[L.world % THEME_ORDER.length], pref = ARCH_THEME[ti] || ['castle'], all = Chars.BUILDINGS, used = [];
  for (let i = 0; i < cnt; i++) {
    let kind = R() < .65 ? pref[(i + Math.floor(R() * pref.length)) % pref.length] : all[Math.floor(R() * all.length)], guard = 0;
    while (used.includes(kind) && guard++ < 12) kind = all[Math.floor(R() * all.length)];
    used.push(kind);
    const b = archCache[kind] || (archCache[kind] = (() => { const o = Chars.makeBuilding(kind); o.g = mergeByMaterial(o.g); return o; })());
    const sc = (b.r > 6 ? .9 : 1.05) * (.92 + R() * .2), rad = b.r * sc;
    for (let t = 0; t < 70; t++) {
      const a = R() * TAU, rr = 24 + R() * 26, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (archFixed.some(f => Math.hypot(x - f.x, z - f.z) < f.r + rad) || archList.some(o => Math.hypot(x - o.x, z - o.z) < o.rad + rad + 5) || blocked(x, z, rad + 1.5)) continue;
      const g = new THREE.Group(), body = b.g.clone(true), mats = []; body.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } }); g.add(body); g.position.set(x, 0, z); g.scale.setScalar(sc); g.rotation.y = Math.atan2(-x, -z) + (R() - .5) * .6;
      g.updateMatrixWorld(true); g.traverse(o => { if (o !== g) o.matrixAutoUpdate = false; });
      archGroup.add(g); const c = { x, z, r: rad * .85 }; cols.push(c); archCols.push(c); archList.push({ kind, x, z, rad, g, mats, alpha: 1 }); break;
    }
  }
}
function loadLevelObj(Lv, preview) {
  L = Lv; level = Lv.n || level; clearLevel(); applyTheme(L.theme, L.mod); placeArch();
  if (L.dash) { dash.startZ = 34; } resetRun();
  camera.position.set(0, 16, L.dash ? 56 : 38);
  if (preview) { spawnPreview(); state = 'menu'; el.bossbar.style.display = 'none'; return; }
  $('lvl').textContent = L.mp ? L.title : 'Lv ' + level; el.time.classList.remove('low'); updateHearts(); setHud(true);
  beginStage(0, true);
}
function loadLevel(n, preview) { loadLevelObj(genLevel(clamp(n, 1, TOTAL_LEVELS)), preview); }
function spawnPreview() {
  pig.z = 24; for (let i = 0; i < 7; i++) spawnSheep(false); for (let i = 0; i < 2; i++) coinTrail(7); spawnBlock(); updCoins();
}
function beginStage(i, first) {
  stageIdx = i; const st = L.stages[i];
  if (!first) { clearEnts(); for (const b of balls) { b.alive = false; b.m.visible = false; } for (const p of bprojs) scene.remove(p.m); bprojs.length = 0; flagState.active = null; simon.pads.length = 0; simon.phase = 'idle'; waves.queue = 0; }
  objs = st.objs.map(o => ({ type: o.type, need: o.need, got: 0 }));
  const carry = first ? 0 : clamp(timeLeft * .35, 0, 12); timeLimit = timeLeft = st.time + Math.round(carry);
  if (!first) { pig.vx = pig.vz = 0; if (!L.dash) { pig.x = clamp(pig.x, -70, 70); pig.z = clamp(pig.z, -70, 70); } }
  foxQueue = 0; foxTimer = 2; harassTimer = 6; pickupTimer = 7;
  for (const o of st.objs) {
    if (o.type === 'sheep') for (let k = 0; k < o.need; k++) spawnSheep(k > 1 && Math.random() < .1 + L.d * .05);
    else if (o.type === 'balloons') for (let k = 0; k < o.need; k++) spawnBalloon();
    else if (o.type === 'pins') { let left = o.need; while (left > 0) { const s = Math.min(left, pick([3, 6, 6, 10])); spawnPinCluster(s); left -= s; } }
    else if (o.type === 'targets') for (let k = 0; k < o.need; k++) spawnTarget();
    else if (o.type === 'stars') for (let k = 0; k < o.need; k++) spawnStar();
    else if (o.type === 'gifts') for (let k = 0; k < o.need; k++) spawnGift();
    else if (o.type === 'chicks') spawnChicks(o.need);
    else if (o.type === 'coins') for (let k = 0; k < o.need; k++) { const p = spot(6, 10), c = spawnCoin(p.x, p.z); c.mission = true; }
    else if (o.type === 'fireflies') for (let k = 0; k < o.need; k++) spawnFirefly();
    else if (o.type === 'seeds') for (let k = 0; k < o.need; k++) spawnSeed();
    else if (o.type === 'cages') for (let k = 0; k < o.need; k++) spawnCage();
    else if (o.type === 'foxes') foxQueue = o.need;
    else if (o.type === 'baddies') { waves.queue = o.need; waves.size = L.waveSize; waves.total = Math.ceil(o.need / L.waveSize); waves.num = 0; waves.timer = 2.2; waves.cool = 1.2; }
    else if (o.type === 'flags') flagState.left = o.need;
    else if (o.type === 'simon') spawnSimon(o.need);
    else if (o.type === 'boss') spawnBoss(L.bossCfg);
    else if (o.type === 'dash') setupDash();
    else if (o.type === 'rush') { /* online arena: stars are sent by the host */ }
  }
  goalRing.visible = st.objs.some(o => o.type === 'foxes' || o.type === 'chicks');
  if (!L.mp) for (let k = 0; k < L.hazCount; k++) spawnHazard(k);
  if (!L.dash && !L.mp) spawnFun();
  if (L.star && !L.dash && !L.mp && !L.boss && !st.objs.some(o => o.type === 'boss')) { const se = spawnKind(L.star, null, false); if (se) burst(se.x, 1, se.z, 0xffffff, 8, 4, .8); }   // every level has its own star villain
  el.time.textContent = timeLeft; el.time.classList.remove('low'); updateHearts(); renderObjs();
  if (bossRef) el.bossbar.style.display = 'block';
  showBanner(i); state = 'intro'; introT = first ? 2.8 : 2.0; sfx.start();
  if (L.mp) musicMode('farm', 128); else musicMode(L.boss && i === L.stages.length - 1 ? 'boss' : L.mod === 'dark' ? 'night' : 'farm', L.boss && i === L.stages.length - 1 ? 128 : 108 + Math.round(L.d * 24));
}
function showBanner(i) {
  const st = L.stages[i];
  $('bnTitle').textContent = i === 0 ? L.title : `Stage ${i + 1} of ${L.stages.length}`;
  $('bnTheme').textContent = i === 0 ? `${L.theme.emoji} World ${L.world + 1} · ${L.theme.name}` : `${L.theme.emoji} ${L.title}`;
  $('bnMission').textContent = missionOf(st, L.world);
  $('bnMod').textContent = i === 0 ? [L.mod ? `${MODS[L.mod].e} ${MODS[L.mod].name}` : '', L.star ? `${VILLAINS[L.star].e} Watch out: ${VILLAINS[L.star].n}!` : ''].filter(Boolean).join('   ·   ') : '';
  $('bnHint').textContent = i === 0 ? L.hint : (st.objs[0] && KIND_HINT[st.objs[0].type]) || ''; el.banner.classList.add('show');
}
function startLevel(n) { if (MP.inRoom) MP.leave(true); hideAll(); audioInit(); loadLevel(n); }
function hideAll() { for (const id of ['menu', 'levels', 'win', 'fail', 'pauseMenu', 'shop', 'lobby', 'mpEnd']) $(id).classList.remove('show'); }
function stageClear() {
  if (state !== 'play') return;
  if (stageIdx + 1 >= L.stages.length) { winLevel(); return; }
  state = 'stageclear'; stageT = 2.5; sfx.stage(); buzz(60); dpadReset();
  confetti(pig.x, 2, pig.z, 40); popText(`Stage ${stageIdx + 1} clear! 🎉`, pig.x, pig.y + 4.5, pig.z, 'gold'); pig.mood = 'cheer'; pig.moodT = 2;
  if (hearts < 3) { hearts++; updateHearts(); popText('+❤️', pig.x, pig.y + 3.2, pig.z, 'good'); }
  el.combo.textContent = `⭐ Stage ${stageIdx + 1} clear!`; el.combo.style.opacity = 1; setTimeout(() => { if (state !== 'play') el.combo.style.opacity = 0; }, 1900);
  for (const e of ents) if (e.kind === 'enemy' || e.kind === 'fox') { e.dead = true; burst(e.x, 1, e.z, 0xffffff, 6, 4, .6); }
}
function winLevel() {
  if (state !== 'play') return;
  if (MP.active) { MP.onWin(); return; }
  state = 'win'; sfx.win(); buzz(80); dpadReset();
  const frac = levelT / L.totalTime, stars = frac <= .4 && hearts >= 2 ? 3 : frac <= .65 ? 2 : 1;
  const prev = +save.stars[level - 1], firstClear = !(prev > 0); if (stars > prev) save.stars = save.stars.slice(0, level - 1) + stars + save.stars.slice(level);
  if (level >= save.max && level < TOTAL_LEVELS) save.max = level + 1;
  const bonus = Math.round((stars * 5 + Math.round(level / 40)) * (partyMode ? 1.5 : 1)); save.coins += bonus; runCoins += bonus; updCoins(); writeSave();
  const ch = CHEERS[cheerIdx(level)]; cheerReset(); confetti(pig.x, 2, pig.z, 70); popText(`${ch.e} ${ch.n}!`, pig.x, pig.y + 4.5, pig.z, 'gold'); pig.mood = 'cheer'; pig.moodT = 3;
  if (firstClear) setTimeout(() => { if (state === 'win') popText('🎁 New hat + skin!', pig.x, pig.y + 6, pig.z, 'good'); }, 600);
  setTimeout(() => {
    if (state !== 'win') return; el.banner.classList.remove('show');
    $('winTitle').textContent = L.boss ? `${BOSSES[bossType(L.world)].name} defeated!` : L.dash ? 'You made it to the finish!' : 'Level Complete!'; $('winStars').innerHTML = [0, 1, 2].map(i => `<span style="animation-delay:${(.12 + i * .28).toFixed(2)}s">${i < stars ? '⭐' : '☆'}</span>`).join(''); if (stars === 3) setTimeout(() => { if (state === 'win') sfx.sparkle(); }, 800);
    $('winMsg').textContent = pick(['Super piggy! 🐷', 'Oink-credible!', 'Ham-azing job!', 'The farm is saved!', 'Snout-standing!', 'You rock, piggy! 🎸', 'Pig-tastic! 🌟']) + `  +${runCoins} 🪙` + (partyMode ? '  🎉 Party bonus x1.5!' : '') + (level >= TOTAL_LEVELS ? '  🏆 You finished all 1000 levels!' : ''); $('next').style.display = level >= TOTAL_LEVELS ? 'none' : '';
    $('winCheer').textContent = `${ch.e} ${ch.n}  ·  ✨ ${CHEER_FX[cheerFxIdx(level)]}`;
    const gift = $('winGift'); gift.style.display = firstClear ? '' : 'none';
    if (firstClear) { const hi = hatInfo('h' + level), si = skinInfo('s' + level); $('winGiftTxt').textContent = `🎁 New hat: ${hi.e} ${hi.n}  ·  New skin: ${si.e} ${si.n}`; const w = $('winWear'); w.textContent = '👕 WEAR THEM'; w.onclick = () => { save.hat = 'h' + level; save.skin = 's' + level; writeSave(); applyCosmetic(); sfx.sparkle(); w.textContent = '✔ Wearing!'; pig.mood = 'cheer'; pig.moodT = 2; }; }
    $('win').classList.add('show');
  }, 1300);
}
function failLevel(msg) {
  if (state !== 'play') return;
  if (MP.active) { MP.onFail(msg); return; }
  state = 'fail'; sfx.end(); input.shootHeld = false; dpadReset(); writeSave();
  const can = !usedCkpt && (L.dash ? dash.ckptZ != null : stageIdx > 0);
  $('failMsg').textContent = msg + ' ' + pick(['Bacon is NOT on the menu! 🥓', 'Shake it off, piggy!', 'Oink... try again!', 'So close! Hoof it!']);
  $('retryStage').style.display = can ? '' : 'none'; $('retryStage').textContent = L.dash ? '🏁 FROM CHECKPOINT' : `⏭️ RETRY STAGE ${stageIdx + 1}`;
  setTimeout(() => { if (state === 'fail') $('fail').classList.add('show'); }, 700);
}
$('retryStage').onclick = () => {
  usedCkpt = true; $('fail').classList.remove('show'); hearts = 3; invuln = 2; updateHearts(); audioInit();
  if (L.dash) { const keep = timeLeft; dashResume(dash.ckptZ); timeLeft = Math.max(keep, 45); timeLimit = Math.max(timeLimit, timeLeft); state = 'intro'; introT = 1.2; showBanner(0); }
  else beginStage(stageIdx, false);
};

/* ============================================================ menus */
let viewWorld = 0;
function renderLevels() {
  const t = themeFor(viewWorld); $('wtitle').textContent = `${t.emoji} ${t.name}`; $('wnum').textContent = `World ${viewWorld + 1} of ${NWORLDS}`;
  const grid = $('lvgrid'); grid.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const n = viewWorld * 10 + i + 1, b = document.createElement('button'), locked = n > save.max, st = +save.stars[n - 1], dsh = isDashLevel(n);
    b.className = 'lv' + (i === 9 ? ' boss' : '') + (dsh ? ' dash' : '') + (locked ? ' locked' : '') + (n === Math.min(save.max, TOTAL_LEVELS) ? ' cur' : '');
    b.innerHTML = `${locked ? '🔒' : (i === 9 ? '👑' : dsh ? '🏃' : n)}<small>${locked ? '' : (st ? '⭐'.repeat(st) : (i === 9 || dsh ? n : ''))}</small>`;
    b.onclick = () => { if (!locked) { audioInit(); startLevel(n); } };
    grid.appendChild(b);
  }
  $('lvfoot').textContent = `⭐ ${totalStars()} / ${TOTAL_LEVELS * 3}`;
}
function openLevels() { hideAll(); viewWorld = Math.floor((Math.min(save.max, TOTAL_LEVELS) - 1) / 10); renderLevels(); $('levels').classList.add('show'); el.banner.classList.remove('show'); state = 'levels'; setHud(false); }
function openMenu() {
  if (MP.inRoom) MP.leave(true);
  hideAll(); el.banner.classList.remove('show'); setHud(false);
  const w = Math.floor((Math.min(save.max, TOTAL_LEVELS) - 1) / 10); loadLevel(w * 10 + 1, true); pig.heading = camYaw + Math.PI;
  $('menuStars').textContent = `⭐ ${totalStars()}   ·   Level ${Math.min(save.max, TOTAL_LEVELS)}   ·   🪙 ${save.coins}`; $('play').textContent = save.max > 1 ? 'CONTINUE' : 'PLAY'; $('menu').classList.add('show'); state = 'menu'; musicMode('farm', 104);
}
function openShop() { audioInit(); hideAll(); wardW = Math.floor((Math.min(save.max, TOTAL_LEVELS) - 1) / 10); renderShop(); $('shop').classList.add('show'); state = 'shop'; }
$('play').onclick = () => { audioInit(); startLevel(Math.min(save.max, TOTAL_LEVELS)); };
$('btnLevels').onclick = () => { audioInit(); openLevels(); };
$('btnShop').onclick = openShop; $('shopBack').onclick = openMenu;
$('lvback').onclick = openMenu;
$('wprev').onclick = () => { viewWorld = Math.max(0, viewWorld - 1); renderLevels(); };
$('wnext').onclick = () => { viewWorld = Math.min(NWORLDS - 1, viewWorld + 1); renderLevels(); };
$('wprev10').onclick = () => { viewWorld = Math.max(0, viewWorld - 10); renderLevels(); };
$('wnext10').onclick = () => { viewWorld = Math.min(NWORLDS - 1, viewWorld + 10); renderLevels(); };
$('wtitle').onclick = () => { viewWorld = Math.floor((Math.min(save.max, TOTAL_LEVELS) - 1) / 10); renderLevels(); };
$('next').onclick = () => startLevel(level + 1);
$('winReplay').onclick = () => startLevel(level);
$('winLevels').onclick = openLevels; $('failLevels').onclick = openLevels; $('pauseLevels').onclick = () => { if (MP.active) MP.leave(true); openLevels(); };
$('retry').onclick = () => startLevel(level);
$('restart').onclick = () => startLevel(level);
$('leaveOnline').onclick = () => { MP.leave(true); openMenu(); };
$('pause').addEventListener('pointerdown', e => {
  e.stopPropagation(); if (state !== 'play' && !(MP.active && (state === 'intro' || state === 'stageclear'))) return;
  if (!MP.active) { state = 'pause'; input.shootHeld = false; dpadReset(); }
  $('restart').style.display = MP.active ? 'none' : ''; $('pauseLevels').style.display = MP.active ? 'none' : ''; $('leaveOnline').style.display = MP.active ? '' : 'none'; $('pauseMenu').classList.add('show');
});
$('resume').onclick = () => { $('pauseMenu').classList.remove('show'); if (state === 'pause') { state = 'play'; last = performance.now(); } };
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; });
let titleTaps = 0; $('title').addEventListener('click', () => { if (++titleTaps >= 7) { save.max = TOTAL_LEVELS; writeSave(); titleTaps = 0; $('menuStars').textContent = `🔓 All ${TOTAL_LEVELS} levels unlocked!`; } });
applyCosmetic(); updCoins();

/* ======== 11_pig_cam_loop.js ======== */
/* ============================================================ pig update */
const IDLE = s => s === 'menu' || s === 'levels' || s === 'shop' || s === 'lobby';
function updatePig(dt) {
  const live = state === 'play', playing = live && !(pig.stun > 0), mx = playing ? input.mx : 0, my = playing ? input.my : 0, dashOn = dash.on && !IDLE(state);
  // movement is relative to the camera (the camera follows Piggy by itself – see updateCamera)
  const sy = Math.sin(camYaw), cy = Math.cos(camYaw), wx = sy * my - cy * mx, wz = cy * my + sy * mx, mag = Math.min(1, Math.hypot(wx, wz));
  const speed = (speedMode ? 13.5 : 11.5) * mag, wl = Math.hypot(wx, wz) || 1; let tvx = mag > 0 ? wx / wl * speed : 0, tvz = mag > 0 ? wz / wl * speed : 0;
  if (dashOn) { dashSlowT -= dt; tvx = playing ? mx * 11 : 0; tvz = state === 'play' || state === 'stageclear' ? -dashRun * (dashSlowT > 0 ? .45 : 1) * (pig.falling ? .5 : 1) : 0; if (state === 'win') tvz = 0; }
  const k = Math.min(1, (pig.grounded ? (iceMode ? 1.5 : 9) : 4) * dt);
  pig.vx += (tvx - pig.vx) * k; pig.vz += (tvz - pig.vz) * k; pig.x += pig.vx * dt; pig.z += pig.vz * dt;
  if (windMode && live && !dashOn) {   // Dino Valley breeze: slowly turning direction, a little stronger now and then
    windA += dt * .22; const wf = 2.8 + Math.sin(clock * .6) * 1.1; pig.x += Math.sin(windA) * wf * dt; pig.z += Math.cos(windA) * wf * dt;
    if (Math.random() < dt * 14) emit(pig.x + rand(-16, 16), rand(.6, 7), pig.z + rand(-16, 16), Math.sin(windA) * 9, rand(-.4, .9), Math.cos(windA) * 9, rand(1, 1.7), pick([0x7ad84a, 0xffa03a, 0xffd93a, 0xff7a5a]), rand(.35, .6), 0);
  }
  if (partyMode && live && Math.random() < dt * 5) emit(pig.x + rand(-18, 18), rand(9, 13), pig.z + rand(-18, 18), rand(-1.5, 1.5), rand(-3, -1), rand(-1.5, 1.5), rand(1.8, 2.6), pick(CONF), rand(.45, .8), 0);
  if (dashOn) pig.x = clamp(pig.x, -11, 11); else { pushOut(pig, .95); keepInWorld(pig, WORLD + 4); }
  const hs = Math.hypot(pig.vx, pig.vz);
  if (pig.aimT > 0) { pig.aimT -= dt; pig.heading += angDiff(pig.heading, pig.aimH) * Math.min(1, 18 * dt); }
  else if (!IDLE(state) && hs > 1) pig.heading += angDiff(pig.heading, Math.atan2(pig.vx, pig.vz)) * Math.min(1, 12 * dt);
  // ground under the pig (dash tracks have pits)
  const onRoad = !dashOn || dashGroundAt(pig.z);
  if (pig.grounded && !onRoad) { pig.grounded = false; pig.coy = .13; }
  if (pig.coy > 0) pig.coy -= dt;
  if (playing && input.jumpPressed && (pig.grounded || (pig.coy > 0 && !pig.falling))) { pig.vy = L && L.mod === 'lowgrav' ? 10 : 11; pig.grounded = false; pig.coy = 0; sfx.jump(); if (Math.random() < .3) popText(pick(['Oink!', 'Wheee!', 'Boing!', 'Snort!']), pig.x, pig.y + 4.5, pig.z, ''); }
  input.jumpPressed = false; pig.thrusting = false;
  if (playing && input.jumpHeld && !pig.grounded && !pig.falling && pig.fuel > 0 && pig.vy < 8) { pig.vy += (GRAV < 20 ? 32 : 46) * dt; pig.fuel = Math.max(0, pig.fuel - .38 * dt); pig.thrusting = true; }
  pig.vy -= GRAV * dt; pig.y += pig.vy * dt; if (pig.y > 16) { pig.y = 16; pig.vy = Math.min(pig.vy, 0); }
  if (pig.y <= 0) {
    if (bounceMode && live && onRoad && !pig.falling && pig.vy < -5) {
      pig.vy = input.jumpHeld ? 13.5 : Math.min(9.5, -pig.vy * .72); pig.y = .02; pig.grounded = false; pig.coy = .1; pig.squash = .22; sfx.boing();
      for (let i = 0; i < 6; i++) emit(pig.x, .3, pig.z, rand(-3, 3), rand(.5, 2), rand(-3, 3), .5, 0x7ad8ff, .6, 1.5);
    } else
    if (onRoad && !pig.falling) { if (!pig.grounded && pig.vy < -6) { pig.squash = .25; for (let i = 0; i < 6; i++) emit(pig.x, .3, pig.z, rand(-3, 3), rand(.5, 2), rand(-3, 3), .5, 0xd8c08a, .6, 1.5); } pig.y = 0; pig.vy = 0; pig.grounded = true; }
    else if (dashOn) pig.falling = true;
  }
  if (pig.falling && pig.y < -11 && live) dashFall(); else if (pig.falling && pig.y < -30) dashFall();
  if (pig.grounded) pig.fuel = Math.min(1, pig.fuel + .7 * dt);
  if (state === 'win' && onRoad && !pig.falling) { cheerStep(dt); cheerFx(dt); }    // victory dance: 12 different cheers + 6 particle shows, picked by level
  else if (cheerOn) cheerReset();
  if (live && !dashOn && !botMode && pig.grounded && !(pig.stun > 0) && !input.shootHeld && !input.mx && !input.my) {
    pig.idleT = (pig.idleT || 0) + dt;
    if (pig.idleT > 6) { pig.idleT = 0; pig.vy = 8.5; pig.grounded = false; sfx.oink(); popText(pick(['Oink?', 'Hello?', 'Snort snort', 'Bored...']), pig.x, pig.y + 4.5, pig.z, ''); }   // tiny "are you there?" hop
  } else pig.idleT = 0;
  if (pig.stun > 0) pig.stun -= dt;
  if (pig.thrusting) emit(pig.x - Math.sin(pig.heading) * .9 + rand(-.2, .2), pig.y + 1.0, pig.z - Math.cos(pig.heading) * .9 + rand(-.2, .2), rand(-.6, .6), rand(-5, -3), rand(-.6, .6), rand(.25, .4), Math.random() < .5 ? 0xffa21a : 0xffe45c, rand(.5, .9), -1.2);
  // mood
  pig.moodT -= dt; if (pig.moodT <= 0) pig.mood = IDLE(state) ? 'happy' : (pig.stun > 0 ? 'hurt' : 'normal');
  pig.squash = Math.max(0, pig.squash - dt); const sq = pig.squash > 0 ? 1 - Math.sin(pig.squash / .25 * Math.PI) * .18 : 1;
  pig.recoil = Math.max(0, pig.recoil - dt);
  rig.animate(dt, { t: clock, speed: hs + cheerHs, grounded: pig.grounded, thrusting: pig.thrusting, vy: pig.vy, squash: sq, recoil: pig.recoil, mood: pig.mood });
  const g = pigParts.g; g.position.set(pig.x, pig.y, pig.z); g.rotation.y = pig.heading; g.visible = state === 'levels' ? false : invuln > 0 && live ? Math.floor(clock * 14) % 2 === 0 : true; cheerPose(g);
  const sh = pigParts.shadow, sc = Math.max(.35, 1 - Math.max(0, pig.y) * .06) * 1.6; sh.visible = !pig.falling && state !== 'levels'; sh.position.set(pig.x, .06, pig.z); sh.scale.setScalar(sc); sh.material.opacity = Math.max(.35, 1 - Math.max(0, pig.y) * .06);
}

/* ============================================================ camera: follows Piggy and swings round behind him by itself */
let camFov = 0;
function updateCamera(dt) {
  const hero = state === 'menu' || state === 'shop' || state === 'lobby', dashOn = dash.on && !IDLE(state), hs = Math.hypot(pig.vx, pig.vz);
  let dist = 13.5 + Math.min(Math.max(pig.y, 0), 8) * .3, ty = Math.max(pig.y, 0) * .5 + 1.6, shift = 0, look = 3;
  if (hero) {
    camYaw += dt * .3; camPitch += (.17 - camPitch) * Math.min(1, 3 * dt); pig.heading = camYaw + Math.PI + Math.sin(clock * .8) * .35; dist = camera.aspect > 1.2 ? 8.4 : 9.2; ty = camera.aspect > 1.2 ? .75 : .3; look = 0; if (camera.aspect > 1.2) shift = 2.5;
  } else if (state === 'levels') { camYaw += dt * .3; camPitch += (.5 - camPitch) * Math.min(1, 2 * dt); dist = 18; }
  else if (dashOn) { camYaw += angDiff(camYaw, Math.PI) * Math.min(1, 5 * dt); camPitch += (.5 - camPitch) * Math.min(1, 2 * dt); dist = 17; ty = 1.8 + Math.max(pig.y, 0) * .4; look = 0; }
  else {
    camManT -= dt;
    if (input.keys.KeyQ) { camYaw += 2 * dt; camManT = 2; } if (input.keys.KeyE) { camYaw -= 2 * dt; camManT = 2; }
    if (camManT <= 0) {
      camPitch += (.5 - camPitch) * Math.min(1, .8 * dt);
      const mag = Math.hypot(input.mx, input.my);
      if ((state === 'play') && !botMode && mag > .15 && hs > 2.5 && !(pig.stun > 0)) {
        // the camera swings round to follow where Piggy is heading (gentle when turning sideways, stronger when running ahead)
        const d = angDiff(camYaw, Math.atan2(pig.vx, pig.vz)), rate = input.my > -.3 ? lerp(.35, 1.0, clamp(input.my, 0, 1)) : 0;   // running towards the camera never spins it
        camYaw += clamp(d, -1.25, 1.25) * rate * dt;
      }
    }
  }
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch), sy = Math.sin(camYaw), cy = Math.cos(camYaw), k = Math.min(1, (hero ? 5 : 7) * dt);
  camera.position.x += (pig.x - sy * cp * dist - camera.position.x) * k; camera.position.y += (Math.max(1.4, ty + sp * dist) - camera.position.y) * k; camera.position.z += (pig.z - cy * cp * dist - camera.position.z) * k;
  if (shake > 0) { shake -= dt; camera.position.x += rand(-1, 1) * shake * .6; camera.position.y += rand(-1, 1) * shake * .6; }
  camera.lookAt(pig.x + sy * look - cy * shift, ty, pig.z + cy * look + sy * shift);
  const base = camera.aspect < 1 ? 70 : 56, want = base + (dashOn ? Math.min(7, hs * .4) : hero ? -10 : Math.min(4, hs * .2));
  camFov += (want - (camFov || want)) * Math.min(1, 4 * dt); if (!camFov) camFov = want; if (Math.abs(camera.fov - camFov) > .05) { camera.fov = camFov; camera.updateProjectionMatrix(); }
}
/* arrow pointing at the next thing to do when it is off screen */
function objTarget() {
  const open = objs.filter(o => o.got < o.need).map(o => o.type); let best = null, bd = 1e9;
  const eat = fn => { for (const e of ents) { if (e.dead || !fn(e)) continue; const d = Math.hypot(e.x - pig.x, e.z - pig.z); if (d < bd) { bd = d; best = e; } } };
  if (open.includes('flags') && flagState.active) return { t: flagState.active, e: '🚩' };
  if (open.includes('boss') && bossRef) return { t: bossRef, e: '👑' };
  if (open.includes('simon') && simon.pads.length) { const p = simon.pads[0]; return { t: { x: p.x - 3.5 * Math.SQRT1_2 * 1.0, z: p.z - 3.5 * Math.SQRT1_2 }, e: '🎵' }; }
  if (open.includes('chicks')) { const F = chickGrp.followers, lost = ents.filter(e => e.kind === 'chick' && e.st === 'lost' && !e.dead); if (F.length && (!lost.length || F.length >= 3)) return { t: { x: GOAL.x, z: GOAL.z, y: 0 }, e: '🏠' }; eat(e => e.kind === 'chick' && e.st === 'lost'); if (best) return { t: best, e: '🐥' }; }
  const want = { coins: e => e.kind === 'coin' && e.mission, fireflies: e => e.kind === 'firefly', seeds: e => e.kind === 'seed' && !e.done, cages: e => e.kind === 'cage' && e.st === 'locked', gifts: e => e.kind === 'gift', sheep: e => e.kind === 'sheep' && e.st !== 'fly', balloons: e => e.kind === 'balloon', pins: e => e.kind === 'pin' && e.st === 'stand', stars: e => e.kind === 'star', targets: e => e.kind === 'target' && !e.hit, foxes: e => e.kind === 'fox' && e.st === 'run', baddies: e => e.kind === 'enemy' && e.mission };
  for (const ty of open) if (want[ty]) eat(want[ty]);
  return best ? { t: best, e: '' } : null;
}
function updateArrow() {
  const a = el.arrow; if (state !== 'play' || !L || L.dash || (L.mp && MP.mode === 'rush')) { a.style.display = 'none'; return; }
  const o = objTarget(); if (!o) { a.style.display = 'none'; return; }
  const dx = o.t.x - pig.x, dz = o.t.z - pig.z, dist = Math.hypot(dx, dz); _v.set(o.t.x, (o.t.y || 0) + 1.5, o.t.z).project(camera);
  const off = _v.z > 1 || Math.abs(_v.x) > .82 || Math.abs(_v.y) > .8;
  if (!off || dist < 12) { a.style.display = 'none'; return; }
  const sy = Math.sin(camYaw), cy = Math.cos(camYaw), sx = -cy * dx + sy * dz, sup = sy * dx + cy * dz, ang = Math.atan2(sx, sup), R = Math.min(window.innerWidth, window.innerHeight) * .3;
  a.style.display = 'block'; a.style.left = (window.innerWidth * .5 + Math.sin(ang) * R) + 'px'; a.style.top = (window.innerHeight * .44 - Math.cos(ang) * R) + 'px'; a.style.transform = `translate(-50%,-50%) rotate(${ang}rad)`;
}

/* ============================================================ main loop */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tick(dt); adaptRes(dt); renderer.render(scene, camera);
}
function tick(dt) {
  if (state === 'pause') return;
  clock += dt; readKeys();
  if (state === 'intro') { introT -= dt; if (introT <= 0) { state = 'play'; sfx.go(); setTimeout(() => { if (state === 'play') el.banner.classList.remove('show'); }, 900); } }
  if (state === 'stageclear') { stageT -= dt; if (stageT <= 0) beginStage(stageIdx + 1); }
  if (state === 'play') {
    timeLeft -= dt; levelT += dt; el.time.textContent = Math.max(0, Math.ceil(timeLeft)); el.time.classList.toggle('low', timeLeft <= 10);
    shootCd -= dt; invuln -= dt; tripleT -= dt; magnetT -= dt; if (input.shootHeld && !(pig.stun > 0)) shoot();
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; el.combo.style.opacity = 0; } }
    if (foxQueue > 0) { foxTimer -= dt; const active = ents.filter(e => e.kind === 'fox' && e.st === 'run').length; if (foxTimer <= 0 && active < 3 + Math.floor(L.d * 6)) { foxTimer = L.foxInterval * rand(.8, 1.2); foxQueue--; spawnFox(); } }
    wavesTick(dt); flagsTick(); simonTick(dt);
    if (L.harass > 0 && !L.boss && !L.dash && !L.mp && !simon.pads.length) { harassTimer -= dt; if (harassTimer <= 0) { harassTimer = L.harassEvery * rand(.8, 1.3); if (ents.filter(e => e.kind === 'enemy' && !e.mission).length < L.harass) spawnEnemy(false); } }
    pickupTimer -= dt; if (pickupTimer <= 0) { pickupTimer = L.pickupEvery * rand(.8, 1.3) * (partyMode ? .5 : 1); if (!L.dash && !L.mp && ents.filter(e => e.kind === 'pickup').length < 2) spawnPickup(); }
    dashTick(dt);
    if (timeLeft <= 0) { if (L.mp && MP.mode === 'rush') timeLeft = 0; else failLevel("Time's up! ⏰"); }
  }
  if (MP.inRoom) MP.update(dt);
  updatePig(dt);
  if (state === 'play' || state === 'intro' || state === 'stageclear' || IDLE(state)) { for (const e of ents) if (!e.dead) e.update(dt); }
  for (let i = ents.length - 1; i >= 0; i--) if (ents[i].dead) { dropEnt(ents[i]); ents.splice(i, 1); }
  for (const e of ents) if (e.sh) { const sc = (e.r || 1.2) * .85 * (1 - Math.min(.55, (e.y || 0) * .05)); e.sh.position.set(e.x, .07, e.z); e.sh.scale.set(sc, sc, sc); e.sh.visible = !e.hideSh; }
  updateBalls(dt); updateBossProj(dt); updatePuffs(dt); updateAmb(dt, pig);
  windmillBlades.rotation.z += dt * .8; goalRing.scale.setScalar(1 + Math.sin(clock * 4) * .06);
  for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 240) c.position.x = -240; if (dash.on) { if (c.position.z > pig.z + 260) c.position.z -= 520; else if (c.position.z < pig.z - 260) c.position.z += 520; } }
  el.fuel.style.width = (pig.fuel * 100) + '%';
  updateCamera(dt); updateArch(dt); updateArrow();
}
document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden && state === 'play' && !MP.active) { state = 'pause'; $('pauseMenu').classList.add('show'); } });

/* ======== 12_mp.js ======== */
/* ============================================================ ONLINE PLAY (WebRTC data channels through PeerJS)
   Star topology: the host is also a player and keeps the score. Two game modes:
     ⭐ Star Rush  – grab stars in the farm arena (shoot rivals to steal a star)
     🏁 Dash Race  – everyone runs the same seeded dash track, first to the finish wins
   Kid-safe by design: auto-generated names and a few preset emotes – there is no free text chat. */
const MP = {
  active: false, inRoom: false, role: null, mode: 'rush', peer: null, hostConn: null, conns: new Map(), me: { id: '', name: '', hat: 'hat0', skin: 'skin0' }, roster: [], remote: new Map(),
  score: {}, stars: new Map(), starId: 0, spawnT: 0, rt: 0, goal: 20, dur: 100, fins: [], endAt: 0, over: false, sendT: 0, sess: 0, autoT: -1, quick: 0, code: '', emoteCd: 0, scoreT: 0, myFin: null
};
const MP_ADJ = ['Happy', 'Jolly', 'Silly', 'Bouncy', 'Fluffy', 'Speedy', 'Sunny', 'Giggly', 'Zippy', 'Cuddly', 'Lucky', 'Sparkly'];
const MP_ANI = ['Piglet', 'Truffle', 'Snouty', 'Oinky', 'Curly', 'Mudpie', 'Pumpkin', 'Hamlet', 'Trotter', 'Pinky', 'Wiggles', 'Peanut'];
const MP_COL = ['#ff6aa8', '#4fb8ff', '#ffd23a', '#6adf5a'];
const MP_EMOTES = ['😀', '👋', '😂', '❤️', '👍', '🎉'];
const mnum = (v, lim) => typeof v === 'number' && isFinite(v) ? clamp(v, -lim, lim) : 0;
const cleanName = s => String(s || '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 18) || 'Piggy';
const okLv = (v, k) => { const m = lvRe.exec(v); return !!m && m[1] === k && +m[2] >= 1 && +m[2] <= TOTAL_LEVELS; };
const okHat = h => (HATS.some(x => x.id === h) || okLv(h, 'h')) ? h : 'hat0', okSkin = s => (SKINS.some(x => x.id === s) || okLv(s, 's')) ? s : 'skin0';
const rid = n => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
function newName() { return pick(MP_ADJ) + ' ' + pick(MP_ANI); }
MP.me.name = save.mpName || (save.mpName = newName());
const tx = (c, m) => { try { if (c && c.open) c.send(m); } catch (_) { } };
const bc = (m, except) => { for (const [id, c] of MP.conns) if (id !== except) tx(c, m); };
const netSend = m => { if (MP.role === 'host') bc(m); else tx(MP.hostConn, m); };
const toastEl = $('toast'); let toastT = 0;
function toast(msg, ms) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 2600); }
const lbStatus = msg => { $('lbStatus').textContent = msg || ''; };
function peerCfg() {
  let c = window.PIGGY_PEER ? Object.assign({}, window.PIGGY_PEER) : {};
  const m = /[?&]peer=([^&:]+):(\d+)/.exec(location.search); if (m) c = { host: m[1], port: +m[2], path: '/', secure: false, config: { iceServers: [] } };
  c.debug = 0; return c;
}
function friendlyErr(e) {
  const t = e && e.type; if (t === 'peer-unavailable') return "Couldn't find that room. Check the code! 🔍"; if (t === 'unavailable-id') return 'That room name is busy – try again.';
  if (t === 'browser-incompatible') return "This device can't do online play yet."; return "Can't reach the online server. Check your internet and try again 🌐";
}
function newPeer(id, onOpen, onErr) {
  if (typeof Peer === 'undefined') { onErr({ type: 'browser-incompatible' }); return null; }
  let p, done = false; try { p = new Peer(id, peerCfg()); } catch (e) { onErr({ type: 'browser-incompatible' }); return null; }
  const to = setTimeout(() => { if (!done) { done = true; onErr({ type: 'timeout' }); } }, 11000);
  p.on('open', i => { if (done) return; done = true; clearTimeout(to); onOpen(i); });
  p.on('error', e => { clearTimeout(to); if (!done) { done = true; onErr(e); } else MP.onPeerError(e); });
  return p;
}
MP.onPeerError = e => { if (e && e.type === 'peer-unavailable' && MP.role === 'host') return; if (MP.inRoom && e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error')) toast('Connection hiccup…'); };

/* ---- lobby screens */
function showLobbyHome() {
  hideAll(); MP.leave(true); $('lobby').classList.add('show'); $('lbHome').style.display = ''; $('lbRoom').style.display = 'none'; $('lbName').textContent = MP.me.name; lbStatus(''); state = 'lobby'; setHud(false); el.banner.classList.remove('show');
  $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = false;
}
function showRoom() {
  hideAll(); $('lobby').classList.add('show'); $('lbHome').style.display = 'none'; $('lbRoom').style.display = ''; state = 'lobby'; setHud(false); renderRoom();
}
function renderRoom() {
  $('lbRoomCode').textContent = MP.quick ? 'QUICK MATCH' : MP.code; $('lbCodeLab').textContent = MP.quick ? 'Waiting for players from all over the world…' : 'Tell your friends this code:';
  $('lbCopy').style.display = MP.quick ? 'none' : '';
  const box = $('lbPlayers'); box.innerHTML = '';
  MP.roster.forEach((p, i) => { const d = document.createElement('div'); d.className = 'lbp'; d.style.borderColor = MP_COL[i % 4]; d.textContent = (i === 0 ? '👑 ' : '🐷 ') + p.name + (p.id === MP.me.id ? ' (you)' : ''); box.appendChild(d); });
  const host = MP.role === 'host'; $('lbRush').classList.toggle('on', MP.mode === 'rush'); $('lbRace').classList.toggle('on', MP.mode === 'race'); $('lbRush').disabled = $('lbRace').disabled = !host;
  $('lbStart').style.display = host ? '' : 'none'; $('lbStart').textContent = MP.roster.length > 1 ? `START (${MP.roster.length} players)` : 'START ALONE';
  $('lbWait').textContent = host ? (MP.autoT >= 0 ? `Starting in ${Math.ceil(MP.autoT)}…` : MP.roster.length > 1 ? 'Pick a game and press START!' : 'Waiting for friends to join…') : 'Waiting for the host to start the game…';
}
MP.me.hat = save.hat; MP.me.skin = save.skin;
const meInfo = () => ({ id: MP.me.id, name: MP.me.name, hat: save.hat, skin: save.skin });
function resetRoomState() { MP.score = {}; MP.stars.clear(); MP.fins = []; MP.over = false; MP.endAt = 0; MP.myFin = null; }

/* ---- hosting */
function hostRoom(id, quick, onTaken) {
  const sess = ++MP.sess; MP.role = 'host'; MP.quick = quick || 0; MP.conns.clear();
  MP.peer = newPeer(id, () => {
    if (sess !== MP.sess) return; MP.me.id = id; MP.code = id.slice(6); MP.roster = [meInfo()]; MP.inRoom = true; MP.mode = 'rush'; MP.autoT = -1; resetRoomState(); showRoom();
  }, e => {
    if (sess !== MP.sess) return;
    if (e.type === 'unavailable-id' && onTaken) { try { MP.peer && MP.peer.destroy(); } catch (_) { } MP.peer = null; onTaken(); return; }
    lbStatus(friendlyErr(e)); MP.role = null; $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = false;
  });
  if (MP.peer) MP.peer.on('connection', conn => onHostConn(conn, sess));
}
function onHostConn(conn, sess) {
  conn.on('open', () => {
    if (sess !== MP.sess) { conn.close(); return; }
    if (MP.conns.size >= 3 || MP.active) { tx(conn, { t: 'full' }); setTimeout(() => { try { conn.close(); } catch (_) { } }, 400); return; }
    MP.conns.set(conn.peer, conn);
  });
  conn.on('data', d => { if (sess === MP.sess) hostRecv(conn, d); });
  conn.on('close', () => { if (sess === MP.sess) dropPlayer(conn.peer); });
  conn.on('error', () => { if (sess === MP.sess) dropPlayer(conn.peer); });
}
function dropPlayer(id) {
  MP.conns.delete(id); const i = MP.roster.findIndex(p => p.id === id); if (i < 0) return; const nm = MP.roster[i].name; MP.roster.splice(i, 1);
  const r = MP.remote.get(id); if (r) { removeRemote(r); MP.remote.delete(id); }
  bc({ t: 'roster', list: MP.roster, mode: MP.mode }); toast(nm + ' left the game'); if (!MP.active) renderRoom(); else refreshScore(true);
  if (MP.active && MP.mode === 'race' && !MP.over && MP.roster.length > 0 && MP.fins.length >= MP.roster.length) hostEnd();
}
function hostRecv(conn, m) {
  if (!m || typeof m !== 'object') return; const id = conn.peer;
  if (m.t === 'hi') {
    if (MP.roster.some(p => p.id === id)) return;
    MP.roster.push({ id, name: cleanName(m.name), hat: okHat(m.hat), skin: okSkin(m.skin) });
    tx(conn, { t: 'wel', id, list: MP.roster, mode: MP.mode }); bc({ t: 'roster', list: MP.roster, mode: MP.mode }, id);
    toast(MP.roster[MP.roster.length - 1].name + ' joined! 🎉'); sfx.power(); renderRoom(); if (MP.quick && MP.roster.length > 1 && MP.autoT < 0) MP.autoT = 6;
    return;
  }
  if (!MP.roster.some(p => p.id === id)) return;
  if (m.t === 's') { applyState(id, m); bc(Object.assign({}, m, { id }), id); }
  else if (m.t === 'shot') { applyShot(id, m); bc(Object.assign({}, m, { id }), id); }
  else if (m.t === 'em') { applyEmote(id, m); bc(Object.assign({}, m, { id }), id); }
  else if (m.t === 'take') hostTake(id, m.i | 0);
  else if (m.t === 'lost') hostLost(id, String(m.by || ''));
  else if (m.t === 'fin') hostFin(id, mnum(m.time, 9999));
}

/* ---- joining */
function joinRoom(hostId, quick, onFail) {
  const sess = ++MP.sess; MP.role = 'client'; MP.quick = quick || 0; let got = false;
  const fail = msg => { if (sess !== MP.sess || got) return; MP.leave(true); if (onFail) onFail(msg); else { lbStatus(msg); $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = false; } };
  MP.peer = newPeer('pfc-' + rid(9), myId => {
    if (sess !== MP.sess) return; MP.me.id = myId;
    const c = MP.peer.connect(hostId, { reliable: true, serialization: 'json' }); MP.hostConn = c;
    const to = setTimeout(() => fail("Couldn't connect to that room 😕"), 9000);
    c.on('open', () => tx(c, { t: 'hi', name: MP.me.name, hat: save.hat, skin: save.skin }));
    c.on('data', m => {
      if (sess !== MP.sess || !m || typeof m !== 'object') return;
      if (m.t === 'wel') { got = true; clearTimeout(to); MP.me.id = MP.peer.id; MP.code = hostId.slice(6); MP.roster = cleanRoster(m.list); MP.mode = m.mode === 'race' ? 'race' : 'rush'; MP.inRoom = true; resetRoomState(); showRoom(); return; }
      if (m.t === 'full') { clearTimeout(to); fail('That room is full or already playing 😕'); return; }
      clientRecv(m);
    });
    c.on('close', () => { clearTimeout(to); if (sess !== MP.sess) return; if (!got) fail("Couldn't connect to that room 😕"); else { MP.leave(true); toast('The host left the game', 3200); openMenu(); } });
    c.on('error', () => { clearTimeout(to); fail("Couldn't connect to that room 😕"); });
  }, e => fail(e.type === 'peer-unavailable' ? friendlyErr(e) : friendlyErr(e)));
  if (MP.peer) MP.peer.on('error', e => { if (e && e.type === 'peer-unavailable') fail(friendlyErr(e)); });
}
function cleanRoster(list) { return (Array.isArray(list) ? list : []).slice(0, 4).map(p => ({ id: String(p.id || '').slice(0, 40), name: cleanName(p.name), hat: okHat(p.hat), skin: okSkin(p.skin) })); }
function clientRecv(m) {
  switch (m.t) {
    case 'roster': MP.roster = cleanRoster(m.list); MP.mode = m.mode === 'race' ? 'race' : 'rush'; for (const [id, r] of MP.remote) if (!MP.roster.some(p => p.id === id)) { removeRemote(r); MP.remote.delete(id); } if (!MP.active) renderRoom(); else refreshScore(true); break;
    case 'start': beginGame(m); break;
    case 's': applyState(String(m.id), m); break;
    case 'shot': applyShot(String(m.id), m); break;
    case 'em': applyEmote(String(m.id), m); break;
    case 'star': if (MP.active && !MP.over) mpStar(m.i | 0, mnum(m.x, 200), mnum(m.y, 20), mnum(m.z, 200), m.v === 3 ? 3 : 1); break;
    case 'took': { const e = ents.find(q => q.mpid === (m.i | 0) && !q.dead); if (e) { e.dead = true; burst(e.x, e.y, e.z, 0xffe45c, 8, 4, .5); } break; }
    case 'sc': if (m.s && typeof m.s === 'object') { MP.score = {}; for (const k in m.s) MP.score[k] = m.s[k] | 0; refreshScore(); } break;
    case 'fin': onFin(String(m.id), mnum(m.time, 9999), m.place | 0); break;
    case 'end': endGame(Array.isArray(m.res) ? m.res.slice(0, 4) : [], m.mode === 'race' ? 'race' : 'rush'); break;
    case 'bye': MP.leave(true); toast('The host left the game', 3200); openMenu(); break;
  }
}

/* ---- remote pigs */
const ntags = $('ntags'); const remoteSh = SH_MAT.clone();
function mkRemote(info, idx) {
  const rig2 = Chars.makePig(); rig2.g.scale.setScalar(PIG_SCALE); scene.add(rig2.g); dressRig(rig2, info.hat, info.skin);
  const sh = new THREE.Mesh(SH_GEO, remoteSh); sh.scale.setScalar(1.6); sh.position.y = .06; scene.add(sh);
  const tag = document.createElement('div'); tag.className = 'ntag'; tag.textContent = info.name; tag.style.background = MP_COL[idx % 4]; ntags.appendChild(tag);
  return { id: info.id, name: info.name, idx, rig: rig2, sh, tag, x: pig.x, y: 0, z: pig.z, h: 0, tx: pig.x, ty: 0, tz: pig.z, th: 0, vx: 0, vz: 0, vy: 0, sp: 0, gr: true, thr: false, seen: 0, mood: 'normal', stunT: 0 };
}
function removeRemote(r) { scene.remove(r.rig.g); scene.remove(r.sh); r.tag.remove(); }
function remoteFor(id) {
  if (id === MP.me.id) return null; let r = MP.remote.get(id); if (r) return r;
  const idx = MP.roster.findIndex(p => p.id === id); if (idx < 0 || !MP.active) return null; r = mkRemote(MP.roster[idx], idx); MP.remote.set(id, r); return r;
}
function applyState(id, m) {
  const r = remoteFor(id); if (!r) return; const nx = mnum(m.x, 600), nz = mnum(m.z, 3000), ny = mnum(m.y, 60), now = clock, dt = Math.max(.03, now - r.seen);
  if (r.seen) { r.vx = (nx - r.tx) / dt; r.vz = (nz - r.tz) / dt; } r.seen = now;
  r.tx = nx; r.ty = ny; r.tz = nz; r.th = mnum(m.h, 10); r.sp = mnum(m.sp, 40); r.gr = !!m.g; r.thr = !!m.th; r.vy = mnum(m.vy, 60); r.mood = m.md === 1 ? 'hurt' : m.md === 2 ? 'cheer' : 'normal';
  if (Math.hypot(r.x - nx, r.z - nz) > 25) { r.x = nx; r.z = nz; r.y = ny; }
}
function applyShot(id, m) {
  if (!MP.active || MP.over || id === MP.me.id) return; const vx = mnum(m.vx, 80), vy = mnum(m.vy, 80), vz = mnum(m.vz, 80);
  const b = fireBall(mnum(m.x, 600), mnum(m.y, 60), mnum(m.z, 3000), vx, vy, vz, (m.c | 0) & 0xffffff, 2); if (b) b.mpOwner = id;
}
function applyEmote(id, m) { const r = MP.remote.get(id), e = MP_EMOTES[m.k | 0]; if (r && e) popText(e, r.x, r.y + 4.2, r.z, 'gold'); }
MP.emote = k => { if (!MP.active || MP.emoteCd > clock) return; MP.emoteCd = clock + 1.2; popText(MP_EMOTES[k], pig.x, pig.y + 4.4, pig.z, 'gold'); sfx.coin(); netSend({ t: 'em', k }); };
const emoteBox = $('emotes'); MP_EMOTES.forEach((e, k) => { const b = document.createElement('button'); b.textContent = e; b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); MP.emote(k); }); emoteBox.appendChild(b); });
const r2 = v => Math.round(v * 100) / 100;
MP.sendShot = (x, y, z, vx, vy, vz, c) => netSend({ t: 'shot', x: r2(x), y: r2(y), z: r2(z), vx: r2(vx), vy: r2(vy), vz: r2(vz), c });
MP.aimAtPig = () => {
  let best = null, bs = 1e9;
  for (const p of MP.remote.values()) { const dx = p.x - pig.x, dz = p.z - pig.z, d = Math.hypot(dx, dz); if (d < 2 || d > 45) continue; const a = Math.abs(angDiff(pig.heading, Math.atan2(dx, dz))); if (a > 1.2) continue; const s = a * 7 + d * .3; if (s < bs) { bs = s; best = p; } }
  return best ? { x: best.x, z: best.z, y: best.y, cy: 1.4, vx: best.vx, vz: best.vz, vy: 0 } : null;
};
/* a rival's ball hits MY pig */
MP.ballVsPig = b => {
  if (!MP.active || MP.over || state !== 'play' || invuln > 0 || pig.stun > 0) return false;
  if (Math.hypot(b.x - pig.x, b.z - pig.z) < 1.8 && b.y > pig.y - .3 && b.y < pig.y + 3.4) {
    pig.stun = 1.1; invuln = 1.9; pig.mood = 'hurt'; pig.moodT = 1.1; pig.vy = Math.max(pig.vy, 6); pig.grounded = false; pig.vx += b.vx * .2; pig.vz += b.vz * .2; shake = .3; sfx.hit(); buzz(80);
    burst(pig.x, pig.y + 1.5, pig.z, 0xffffff, 8, 4, .6); popText('Bonk!', pig.x, pig.y + 4, pig.z, 'bad');
    if (MP.mode === 'rush' && b.mpOwner) { if (MP.role === 'host') hostLost(MP.me.id, b.mpOwner); else tx(MP.hostConn, { t: 'lost', by: b.mpOwner }); }
    return true;
  } return false;
};
/* my ball hits a rival (the rival's own device decides the real effect) */
MP.ballVsRemote = b => {
  if (b.owner !== 1) return;
  for (const p of MP.remote.values()) if (Math.hypot(b.x - p.x, b.z - p.z) < 1.8 && b.y > p.y - .3 && b.y < p.y + 3.4) { burst(b.x, b.y, b.z, b.color, 6, 4, .5); sfx.thunk(); b.alive = false; b.m.visible = false; return; }
};

/* ---- game flow */
function hostStart() {
  if (MP.role !== 'host' || MP.active) return; MP.autoT = -1;
  const p = MP.mode === 'rush' ? { t: 'start', mode: 'rush', world: Math.floor(Math.random() * NWORLDS), goal: 20, dur: 100 } : { t: 'start', mode: 'race', lvl: 132 + 10 * Math.floor(Math.random() * 30) };
  bc(p); beginGame(p);
}
function beginGame(p) {
  if (MP.active || !MP.inRoom) return; audioInit(); hideAll(); resetRoomState(); const rush = p.mode !== 'race'; MP.mode = rush ? 'rush' : 'race'; MP.goal = clamp(p.goal | 0 || 20, 5, 60); MP.dur = clamp(p.dur | 0 || 100, 30, 300);
  let Lv;
  if (rush) {
    const base = genLevel(clamp(Math.floor(mnum(p.world, 99)) * 10 + 3, 3, 993));
    Lv = Object.assign({}, base, { mp: true, title: '⭐ Star Rush', dash: false, boss: false, mod: null, hazCount: 0, harass: 0, bossCfg: null, hint: 'Grab the stars before your friends! Shoot a rival to steal one of their stars! ⭐', stages: [{ objs: [{ type: 'rush', need: MP.goal, got: 0 }], time: MP.dur }], totalTime: MP.dur });
    MP.rt = MP.dur;
  } else {
    const n = clamp(p.lvl | 0, 132, 432), lv = isDashLevel(n) ? n : 132; Lv = genLevel(lv); Lv.mp = true; Lv.title = '🏁 Dash Race'; Lv.hint = 'Race your friends to the finish! Shoot rivals to slow them down. Falling in the water sends you back a bit.';
  }
  MP.active = true; MP.score = {}; for (const q of MP.roster) MP.score[q.id] = 0; MP.spawnT = 1.5; MP.sendT = 0;
  for (const r of MP.remote.values()) removeRemote(r); MP.remote.clear();
  loadLevelObj(Lv, false);
  const idx = Math.max(0, MP.roster.findIndex(q => q.id === MP.me.id));
  if (rush) { const a = idx * TAU / 4 + .6; pig.x = Math.cos(a) * 22; pig.z = Math.sin(a) * 22; pig.heading = Math.atan2(-pig.x, -pig.z); camYaw = pig.heading; }
  else { pig.x = [-7, -2.5, 2.5, 7][idx % 4]; }
  for (const q of MP.roster) if (q.id !== MP.me.id) remoteFor(q.id);
  $('lvl').textContent = Lv.title; setHud(true); refreshScore(true); $('mpScore').style.display = ''; $('emotes').style.display = '';
}
function refreshScore(force) {
  const box = $('mpScore'); if (!MP.active) { box.style.display = 'none'; return; } box.style.display = '';
  const rush = MP.mode === 'rush'; const rows = MP.roster.map((q, i) => {
    let v, sortV; const r = MP.remote.get(q.id), z = q.id === MP.me.id ? pig.z : r ? r.z : 1e9;
    if (rush) { v = MP.score[q.id] | 0; sortV = -v; }
    else { const f = MP.fins.find(x => x.id === q.id); if (f) { v = '🏁'; sortV = -1e6 + f.place; } else { const pr = clamp((dash.startZ - z) / Math.max(1, dash.len), 0, 1); v = Math.round(pr * 100) + '%'; sortV = -pr; } }
    return { q, i, v, sortV };
  }).sort((a, b) => a.sortV - b.sortV);
  box.innerHTML = rows.map((r, k) => `<div class="mps${r.q.id === MP.me.id ? ' me' : ''}"><i style="background:${MP_COL[r.i % 4]}"></i>${k + 1}. ${r.q.name.split(' ')[0]} <b>${r.v}</b></div>`).join('');
  if (rush) { const o = objs.find(q => q.type === 'rush'); if (o) { o.got = MP.score[MP.me.id] | 0; renderObjs(); } }
}
/* ---- host: star rush */
function spawnMpStar() {
  for (let i = 0; i < 30; i++) {
    const a = rand(0, TAU), r = Math.sqrt(Math.random()) * 76, x = Math.cos(a) * r, z = Math.sin(a) * r; if (blocked(x, z, 2.5)) continue;
    const id = ++MP.starId, v = Math.random() < .12 ? 3 : 1, y = Math.random() < .4 ? rand(3.6, 7.5) : 1.6; MP.stars.set(id, v); const m = { t: 'star', i: id, x: r2(x), y: r2(y), z: r2(z), v }; bc(m); mpStar(id, x, y, z, v); return;
  }
}
function mpStar(i, x, y, z, v) {
  if (ents.some(q => q.mpid === i)) return;
  const g = new THREE.Group(), sg = new THREE.Group(), big = v === 3; g.add(sg);
  const m = new THREE.Mesh(getStarGeo(), M(big ? 0xff8ad8 : 0xffd93a, { emissive: big ? 0x8a2a6a : 0x8a6400 })); m.scale.setScalar(big ? 1.9 : 1.25); sg.add(m);
  for (const s of [-1, 1]) { const ey = Chars.eye(.14 * (big ? 1.5 : 1)); ey.position.set(s * .24 * (big ? 1.5 : 1), .1, .42 * (big ? 1.5 : 1)); ey.scale.multiplyScalar(1.0); sg.add(ey); }
  const e = addEnt({ kind: 'star', mp: true, mpid: i, big, g, x, z, y, cy: 0, r: 1.4, hittable: false, ph: rand(0, TAU) }); g.position.set(x, y, z);
  e.update = dt => {
    sg.rotation.y += dt * 2.2; sg.rotation.z = Math.sin(clock * 2.2 + e.ph) * .12; g.position.y = e.y + Math.sin(clock * 2 + e.ph) * .3;
    if (state === 'play' && !MP.over && !(pig.stun > 0) && Math.hypot(e.x - pig.x, e.y - (pig.y + 1.4), e.z - pig.z) < (big ? 3 : 2.6)) {
      e.dead = true; burst(e.x, e.y, e.z, 0xffe45c, 12, 5, .6); sfx.star(); buzz(10); popText(big ? '+3 ⭐' : '+1 ⭐', e.x, e.y + 1.5, e.z, 'gold');
      if (MP.role === 'host') hostTake(MP.me.id, i); else tx(MP.hostConn, { t: 'take', i });
    }
  };
  return e;
}
function hostTake(by, i) {
  const v = MP.stars.get(i); if (!v || MP.over) return; MP.stars.delete(i); MP.score[by] = (MP.score[by] | 0) + v; bc({ t: 'took', i, by }, by); bcScore(); refreshScore();
  if (MP.score[by] >= MP.goal) hostEnd();
}
function hostLost(victim, by) {
  if (MP.over || victim === by || !MP.roster.some(p => p.id === by) || (MP.score[victim] | 0) <= 0) return;
  MP.score[victim]--; MP.score[by] = (MP.score[by] | 0) + 1; bcScore(); refreshScore();
}
const bcScore = () => bc({ t: 'sc', s: MP.score });
/* ---- race */
function hostFin(id, time) {
  if (MP.over || MP.fins.some(f => f.id === id)) return; const place = MP.fins.length + 1; MP.fins.push({ id, time, place }); bc({ t: 'fin', id, time, place }); onFin(id, time, place);
  if (place === 1) MP.endAt = performance.now() + 25000; if (MP.fins.length >= MP.roster.length) hostEnd();
}
function onFin(id, time, place) {
  if (!MP.fins.some(f => f.id === id)) MP.fins.push({ id, time, place }); const p = MP.roster.find(q => q.id === id);
  if (p) { toast(`${place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🏁'} ${p.name} finished!`, 2400); if (id !== MP.me.id) sfx.flag(); } refreshScore();
}
MP.onWin = () => {   // I crossed the finish line of the race
  if (MP.mode !== 'race' || MP.myFin != null) return; MP.myFin = levelT; state = 'win'; dpadReset(); sfx.win(); confetti(pig.x, 2, pig.z, 60); pig.mood = 'cheer'; pig.moodT = 5;
  el.combo.textContent = '🏁 You made it! Waiting for the others…'; el.combo.style.opacity = 1;
  if (MP.role === 'host') hostFin(MP.me.id, r2(levelT)); else tx(MP.hostConn, { t: 'fin', time: r2(levelT) });
};
MP.onFail = msg => {   // online games never end with a game-over: rush has no damage, the race respawns you
  if (MP.mode === 'race' && L.dash) { hearts = 3; invuln = 2.2; updateHearts(); popText('Back to the checkpoint!', pig.x, pig.y + 4, pig.z, 'bad'); dashResume(dash.ckptZ != null ? dash.ckptZ : dash.startZ - 6); pig.x = [-7, -2.5, 2.5, 7][Math.max(0, MP.roster.findIndex(q => q.id === MP.me.id)) % 4]; }
  else { hearts = 3; invuln = 1.5; updateHearts(); }
};
function hostEnd() {
  if (MP.role !== 'host' || MP.over) return; const rush = MP.mode === 'rush';
  const res = MP.roster.map(q => { const r = MP.remote.get(q.id), z = q.id === MP.me.id ? pig.z : r ? r.z : 1e9, f = MP.fins.find(x => x.id === q.id); return { id: q.id, name: q.name, val: rush ? (MP.score[q.id] | 0) : f ? f.time : null, z: Math.round(z) }; });
  rush ? res.sort((a, b) => b.val - a.val) : res.sort((a, b) => (a.val == null ? 1e9 + a.z : a.val) - (b.val == null ? 1e9 + b.z : b.val));
  bc({ t: 'end', mode: MP.mode, res }); endGame(res, MP.mode);
}
function endGame(res, mode) {
  if (!MP.active || MP.over) return; MP.over = true; MP.active = false; dpadReset(); setHud(false); el.banner.classList.remove('show'); el.combo.style.opacity = 0;
  for (const r of MP.remote.values()) removeRemote(r); MP.remote.clear(); MP.stars.clear();
  const w = Math.floor((Math.min(save.max, TOTAL_LEVELS) - 1) / 10); loadLevel(w * 10 + 1, true); state = 'lobby'; camYaw = Math.PI;
  const won = res[0] && res[0].id === MP.me.id && (mode === 'rush' ? res[0].val > 0 : res[0].val != null); const prize = won ? 30 : 10;
  save.coins += prize; save.mpGames++; if (won) save.mpWins++; updCoins(); writeSave(); if (won) { sfx.win(); confetti(pig.x, 3, pig.z, 60); pig.mood = 'cheer'; pig.moodT = 4; } else sfx.end();
  $('mpTitle').textContent = (mode === 'rush' ? '⭐ Star Rush' : '🏁 Dash Race') + ' results';
  $('mpList').innerHTML = res.map((r, i) => { const t = mode === 'rush' ? `${r.val} ⭐` : r.val != null ? `${r.val.toFixed(1)}s` : 'DNF'; return `<div class="mpr${r.id === MP.me.id ? ' me' : ''}"><span>${['🥇', '🥈', '🥉', '4️⃣'][i] || ''}</span><em>${String(r.name).replace(/[<>&]/g, '')}</em><b>${t}</b></div>`; }).join('');
  $('mpPrize').textContent = won ? `You won! +${prize} 🪙` : `Nice game! +${prize} 🪙`; hideAll(); $('mpEnd').classList.add('show');
}
/* ---- per-frame */
MP.update = dt => {
  if (!MP.inRoom) return;
  if (MP.role === 'host' && !MP.active && MP.autoT >= 0 && state === 'lobby') { if (MP.roster.length < 2) MP.autoT = -1; else { MP.autoT -= dt; renderRoom(); if (MP.autoT <= 0) { MP.mode = Math.random() < .5 ? 'rush' : 'race'; hostStart(); } } }
  if (!MP.active) return;
  if (!MP.over && (state === 'play' || state === 'intro' || state === 'win')) {
    MP.sendT -= dt; if (MP.sendT <= 0) { MP.sendT = .075; netSend({ t: 's', x: r2(pig.x), y: r2(pig.y), z: r2(pig.z), h: r2(pig.heading), sp: r2(Math.hypot(pig.vx, pig.vz)), g: pig.grounded ? 1 : 0, th: pig.thrusting ? 1 : 0, vy: r2(pig.vy), md: pig.stun > 0 ? 1 : pig.mood === 'cheer' ? 2 : 0 }); }
  }
  if (MP.role === 'host' && !MP.over && state === 'play') {
    if (MP.mode === 'rush') { MP.spawnT -= dt; if (MP.spawnT <= 0 && MP.stars.size < 6 + 2 * MP.roster.length) { MP.spawnT = .55; spawnMpStar(); } MP.rt -= dt; if (MP.rt <= 0) hostEnd(); }
    else if (MP.endAt && performance.now() > MP.endAt) hostEnd();
  }
  MP.scoreT -= dt; if (MP.scoreT <= 0) { MP.scoreT = .6; refreshScore(); }
  const w = window.innerWidth, h = window.innerHeight;
  for (const p of MP.remote.values()) {
    const k = Math.min(1, 11 * dt); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; p.h += angDiff(p.h, p.th) * Math.min(1, 12 * dt);
    p.rig.g.position.set(p.x, p.y, p.z); p.rig.g.rotation.y = p.h; p.rig.g.visible = true; p.sh.position.set(p.x, .06, p.z); p.sh.visible = p.y > -.5;
    p.rig.animate(dt, { t: clock, speed: p.sp, grounded: p.gr, thrusting: p.thr, vy: p.vy, squash: 1, recoil: 0, mood: p.mood });
    _v.set(p.x, p.y + 3.9, p.z).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) p.tag.style.display = 'none'; else { p.tag.style.display = 'block'; p.tag.style.transform = `translate(${(_v.x * .5 + .5) * w}px,${(-_v.y * .5 + .5) * h}px) translate(-50%,-100%)`; }
  }
};
MP.leave = silent => {
  const had = MP.inRoom || MP.peer; MP.sess++;
  try { if (MP.role === 'host') bc({ t: 'bye' }); } catch (_) { }
  for (const c of MP.conns.values()) { try { c.close(); } catch (_) { } } MP.conns.clear(); try { MP.hostConn && MP.hostConn.close(); } catch (_) { } try { MP.peer && MP.peer.destroy(); } catch (_) { }
  MP.peer = null; MP.hostConn = null; MP.role = null; MP.inRoom = false; MP.active = false; MP.over = false; MP.roster = []; MP.autoT = -1; MP.quick = 0; MP.mode = 'rush';
  for (const r of MP.remote.values()) removeRemote(r); MP.remote.clear(); MP.stars.clear(); ntags.innerHTML = '';
  $('mpScore').style.display = 'none'; $('emotes').style.display = 'none'; return had;
};
/* ---- buttons */
function quickPlay(k) {
  k = k || 1; if (k > 6) { MP.leave(true); lbStatus('No open games right now – create a room for your friends! 🏠'); $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = false; return; }
  lbStatus(k === 1 ? 'Looking for a game…' : `Looking for a game… (${k}/6)`); MP.leave(true); state = 'lobby';
  const id = 'pfarm-q' + k;
  hostRoom(id, k, () => joinRoom(id, k, () => quickPlay(k + 1)));
}
$('btnOnline').onclick = () => { audioInit(); showLobbyHome(); };
$('lbBack').onclick = () => { MP.leave(true); openMenu(); };
$('lbReroll').onclick = () => { MP.me.name = save.mpName = newName(); writeSave(); $('lbName').textContent = MP.me.name; sfx.boing(); };
$('lbCreate').onclick = () => { $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = true; lbStatus('Making your room…'); const mk = () => { const code = rid(5).toUpperCase().replace(/[IO01L]/g, 'X'); hostRoom('pfarm-' + code, 0, mk); }; MP.leave(true); mk(); };
$('lbJoin').onclick = () => {
  const code = $('lbCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); if (code.length < 5) { lbStatus('Type the 5 letter room code first ✏️'); return; }
  $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = true; lbStatus('Joining…'); MP.leave(true); joinRoom('pfarm-' + code, 0);
};
$('lbQuick').onclick = () => { $('lbQuick').disabled = $('lbCreate').disabled = $('lbJoin').disabled = true; quickPlay(1); };
$('lbRush').onclick = () => { if (MP.role !== 'host') return; MP.mode = 'rush'; bc({ t: 'roster', list: MP.roster, mode: MP.mode }); renderRoom(); };
$('lbRace').onclick = () => { if (MP.role !== 'host') return; MP.mode = 'race'; bc({ t: 'roster', list: MP.roster, mode: MP.mode }); renderRoom(); };
$('lbStart').onclick = () => hostStart();
$('lbLeave').onclick = () => { MP.leave(true); showLobbyHome(); };
$('lbCopy').onclick = () => { const t = MP.code; try { navigator.clipboard.writeText(t).then(() => toast('Code copied! 📋'), () => toast('Code: ' + t)); } catch (_) { toast('Code: ' + t); } };
$('mpBack').onclick = () => { if (!MP.inRoom) { openMenu(); return; } showRoom(); };
$('mpLeaveEnd').onclick = () => { MP.leave(true); openMenu(); };

/* ======== 13_start.js ======== */
/* ============================================================ start-up + test hooks */
applyTheme(THEMES[0]); camera.position.set(0, 16, 32);
openMenu();
requestAnimationFrame(frame);
window.__game = {
  cols, ents, pig, input, MP, dash, THEMES, TOTAL_LEVELS, genLevel, loadLevel, startLevel, tick, rig, save: () => save,
  spawn: { cupcake: spawnCupcake, snowman: spawnSnowman, jack: spawnJack, bee: spawnBee, robot: spawnRobot, gift: spawnGift, chick: spawnChick, chicks: spawnChicks, crabby: spawnCrabby, boo: spawnBoo, spinny: spawnSpinny, rexy: spawnRexy, drizzle: spawnDrizzle, gummy: spawnGummy, firefly: spawnFirefly, seed: spawnSeed, cage: spawnCage }, chickGrp, CHEERS, cheerIdx, cheerFxIdx, hatInfo, skinInfo, levelDone, archInfo: () => archList.map(o => ({ kind: o.kind, x: o.x, z: o.z, r: o.rad })), renderWard, setWardW: v => { wardW = v; }, cheerState: () => ({ on: cheerOn, t: cheerT, flip: cheerFlip }), hurt: () => hearts, hasFlag: () => ({ wind: windMode, bounce: bounceMode, party: partyMode }),
  setBot: v => { botMode = v; }, setYaw: v => { camYaw = v; }, camYawGet: () => camYaw, camPitchGet: () => camPitch, applyCosmetic, dressRig, winNow: () => { if (state === 'play') { state = 'play'; winLevel(); } },
  forceHearts: () => { hearts = 3; invuln = 0; }, setTime: v => { timeLeft = v; }, ballsFire: shoot, openMenu, openLevels, openShop, beginStage, stageClear, dashResume, hostStart,
  get state() { return state; }, set state(v) { state = v; }, get L() { return L; }, get objs() { return objs; }, get hearts() { return hearts; }, get timeLeft() { return timeLeft; }, get boss() { return bossRef; },
  get simon() { return simon; }, get bprojs() { return bprojs; }, get flagState() { return flagState; }, get waves() { return waves; }, get stageIdx() { return stageIdx; }, get levelT() { return levelT; }, get coins() { return save.coins; }, get dashRun() { return dashRun; }, get foxQueue() { return foxQueue; },
  get camera() { return camera; }, get perf() { return { pr: pixelRatio, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; }
};

})();
