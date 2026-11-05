/* =====================================================================
   CHARACTER KIT – core: soft toon material, smooth outlines, eyes, helpers
   Everything is built from smooth ellipsoids so characters look like
   soft, rounded, "rendered" cartoon toys instead of flat low-poly shapes.
   ===================================================================== */
(function () {
'use strict';
const T = THREE, TAU = Math.PI * 2;
const C = window.Chars = {};

/* ---------- soft 3-band toon ramp (smooth edges) */
const ramp = (() => {
  const N = 64, d = new Uint8Array(N);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < N; i++) { const x = i / (N - 1); d[i] = Math.round(255 * (0.60 + 0.20 * sm(.36, .52, x) + 0.20 * sm(.60, .78, x))); }
  const t = new T.DataTexture(d, N, 1, T.RedFormat); t.minFilter = t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
C.ramp = ramp;
C.OUTLINE = 0x3a1a3c;

const cache = new Map();
function rimPatch(m, rc, rk) {
  m.onBeforeCompile = sh => {
    sh.uniforms.rimC = { value: new T.Color(rc) }; sh.uniforms.rimK = { value: rk };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 rimC; uniform float rimK;')
      .replace('#include <opaque_fragment>', 'float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.4);\n outgoingLight += rimC * rimF * rimK;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'rim';
}
/* toon(color, {rim, rimK, emissive, opacity, unique, double}) -> MeshToonMaterial */
C.toon = function (color, o) {
  o = o || {};
  const key = 't' + color + '|' + (o.rim == null ? '' : o.rim) + '|' + (o.rimK || '') + '|' + (o.emissive || '') + '|' + (o.opacity || '') + '|' + (o.double ? 1 : 0);
  if (!o.unique && cache.has(key)) return cache.get(key);
  const m = new T.MeshToonMaterial({ color, gradientMap: ramp });
  if (o.emissive != null) { m.emissive = new T.Color(o.emissive); }
  if (o.opacity != null && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = o.depthWrite !== false; }
  if (o.double) m.side = T.DoubleSide;
  if (o.rim !== 0) rimPatch(m, o.rim == null ? 0xffffff : o.rim, o.rimK == null ? .16 : o.rimK);
  if (!o.unique) cache.set(key, m);
  return m;
};
C.basic = function (color, o) {
  o = o || {};
  const key = 'b' + color + '|' + (o.opacity || '') + '|' + (o.double ? 1 : 0) + '|' + (o.fog === false ? 0 : 1);
  if (!o.unique && cache.has(key)) return cache.get(key);
  const m = new T.MeshBasicMaterial({ color });
  if (o.opacity != null && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.double) m.side = T.DoubleSide; if (o.fog === false) m.fog = false;
  if (!o.unique) cache.set(key, m);
  return m;
};

/* ---------- shared smooth geometry */
const G = C.G = {
  sph: new T.SphereGeometry(1, 24, 16), sphM: new T.SphereGeometry(1, 16, 11), sphS: new T.SphereGeometry(1, 10, 7),
  cyl: new T.CylinderGeometry(1, 1, 1, 16, 1), cone: new T.ConeGeometry(1, 1, 14, 1), box: new T.BoxGeometry(1, 1, 1),
  tor: new T.TorusGeometry(1, .2, 8, 22), disc: new T.CircleGeometry(1, 20)
};
const ZAXIS = new T.Vector3(0, 0, 1);

/* mesh helper: ell(parent, geo, mat, x,y,z, rx,ry,rz) */
C.ell = function (parent, geo, mat, x, y, z, rx, ry, rz) {
  const m = new T.Mesh(geo || G.sph, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.scale.set(rx == null ? 1 : rx, ry == null ? (rx == null ? 1 : rx) : ry, rz == null ? (rx == null ? 1 : rx) : rz);
  if (parent) parent.add(m); return m;
};
/* place `obj` on the surface of an ellipsoid (centre c, radii r) at azimuth az (0 = +z, +x = right) and elevation el, facing outwards */
C.onSurface = function (obj, c, r, az, el, push) {
  const ce = Math.cos(el), x = ce * Math.sin(az), y = Math.sin(el), z = ce * Math.cos(az);
  const px = x * r[0], py = y * r[1], pz = z * r[2];
  const n = new T.Vector3(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2])).normalize();
  obj.position.set(c[0] + px + n.x * (push || 0), c[1] + py + n.y * (push || 0), c[2] + pz + n.z * (push || 0));
  obj.quaternion.setFromUnitVectors(ZAXIS, n); return obj;
};

/* ---------- outline: inverted hull pushed along the normals, constant world thickness */
const olCache = new Map();
function outlineMat(th, color) {
  const key = th.toFixed(4) + '|' + color; if (olCache.has(key)) return olCache.get(key);
  const m = new T.MeshBasicMaterial({ color, side: T.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * ' + th.toFixed(4) + ';'); };
  m.customProgramCacheKey = () => 'ol' + th.toFixed(4);
  olCache.set(key, m); return m;
}
/* hull geometry with averaged normals so hard edges (cylinders, boxes, poles) never crack open */
const hullCache = new WeakMap();
function smoothHull(geo) {
  if (hullCache.has(geo)) return hullCache.get(geo);
  const nor = geo.attributes.normal; if (!nor) { hullCache.set(geo, geo); return geo; }
  const g = geo.clone(), pos = g.attributes.position, n2 = g.attributes.normal, map = new Map(), key = i => Math.round(pos.getX(i) * 1e3) + ',' + Math.round(pos.getY(i) * 1e3) + ',' + Math.round(pos.getZ(i) * 1e3);
  for (let i = 0; i < pos.count; i++) { const k = key(i); let a = map.get(k); if (!a) { a = [0, 0, 0]; map.set(k, a); } a[0] += n2.getX(i); a[1] += n2.getY(i); a[2] += n2.getZ(i); }
  for (let i = 0; i < pos.count; i++) { const a = map.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n2.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  g.deleteAttribute('uv'); hullCache.set(geo, g); return g;
}
C.outline = function (root, worldTh, color) {
  worldTh = worldTh || .055; color = color == null ? C.OUTLINE : color;
  const list = [];
  (function walk(o, s) {
    const sc = s * (Math.abs(o.scale.x) + Math.abs(o.scale.y) + Math.abs(o.scale.z)) / 3;
    if (o.isMesh && !o.userData.ol && !o.userData.noOutline && o.material && !(o.material.transparent && o.material.opacity < .7) && o.material.type !== 'MeshBasicMaterial') list.push([o, sc]);
    for (const c of o.children) if (!c.userData.ol) walk(c, o === root ? 1 : sc);
  })(root, 1);
  root.userData.hasOl = true;
  for (const [m, sc] of list) {
    const ol = new T.Mesh(smoothHull(m.geometry), outlineMat(worldTh / Math.max(.05, sc), color)); ol.userData.ol = true; ol.renderOrder = -1; m.add(ol);
  }
  return root;
};

/* ---------- eyes: big glossy cartoon eyes (faces +z). o = {iris, white, lid} */
C.eye = function (r, o) {
  o = o || {};
  const g = new T.Group(), ball = new T.Group(); g.add(ball);
  const ring = C.ell(g, G.sphM, C.basic(C.OUTLINE), 0, 0, -r * .05, r * 1.12, r * 1.27, r * .7); ring.userData.noOutline = true;
  const sc = C.ell(g, G.sphM, C.basic(o.white || 0xffffff), 0, 0, 0, r, r * 1.14, r * .7);
  const ir = C.ell(ball, G.sphM, C.basic(o.iris || 0x2a1830), 0, -r * .04, r * .38, r * .68, r * .82, r * .4); ir.userData.noOutline = true;
  const pu = C.ell(ball, G.sphS, C.basic(0x0a0610), 0, -r * .04, r * .52, r * .38, r * .48, r * .3); pu.userData.noOutline = true;
  const h1 = C.ell(ball, G.sphS, C.basic(0xffffff), r * .26, r * .3, r * .72, r * .27, r * .3, r * .12); h1.userData.noOutline = true;
  const h2 = C.ell(ball, G.sphS, C.basic(0xffffff), -r * .22, -r * .26, r * .68, r * .12, r * .12, r * .08); h2.userData.noOutline = true;
  // eyelid used for blinking / expressions: a skin coloured shell that slides down
  g.userData = { ball, sc, r, blink: 0, lookX: 0, lookY: 0, base: 1 };
  g.blink = v => { g.scale.y = Math.max(.08, 1 - v * .92); };
  g.look = (x, y) => { ball.position.x += (x * r * .22 - ball.position.x) * .3; ball.position.y += (y * r * .18 - ball.position.y) * .3; };
  return g;
};
/* eye placed on a head ellipsoid */
C.headEye = function (parent, c, rad, az, el, r, o) {
  const e = C.eye(r, o); C.onSurface(e, c, rad, az, el, -r * .22); parent.add(e); return e;
};
/* angry/worried eyebrow (thin rounded bar) */
C.brow = function (parent, x, y, z, w, tilt, col) {
  const b = C.ell(parent, G.sphS, C.toon(col == null ? 0x2a1830 : col, { rim: 0 }), x, y, z, w, w * .22, w * .22); b.rotation.z = tilt; b.userData.noOutline = true; return b;
};
/* glossy highlight decal on a surface */
C.shine = function (parent, c, rad, az, el, w, h, op) {
  const m = new T.Mesh(G.sphS, C.basic(0xffffff, { opacity: op == null ? .42 : op })); m.scale.set(w, h, .03);
  C.onSurface(m, c, rad, az, el, -.004); m.userData.noOutline = true; m.renderOrder = 2; parent.add(m); return m;
};
/* soft blush cheek */
C.blush = function (parent, c, rad, az, el, w, h, col) {
  const m = new T.Mesh(G.sphS, C.basic(col == null ? 0xff5f8e : col, { opacity: .55 })); m.scale.set(w, h, .035);
  C.onSurface(m, c, rad, az, el, -.006); m.userData.noOutline = true; m.renderOrder = 1; parent.add(m); return m;
};
/* smile arc */
C.smile = function (parent, c, rad, az, el, w, col) {
  const m = new T.Mesh(new T.TorusGeometry(1, .13, 8, 18, Math.PI), C.basic(col == null ? 0x4a1c34 : col, { fog: true }));
  m.scale.set(w, w * .8, w); C.onSurface(m, c, rad, az, el, -.01);
  const q = new T.Quaternion().setFromAxisAngle(ZAXIS, Math.PI); m.quaternion.multiply(q); // arc opens upwards => smile
  m.userData.noOutline = true; parent.add(m); return m;
};
C.noOl = o => { o.userData.noOutline = true; return o; };
/* rounded box geometry (unit size 1 -> scale it), radius r in 0..0.5 */
const rbCache = {};
C.rbox = function (r) {
  r = r == null ? .18 : r; const k = r.toFixed(3); if (rbCache[k]) return rbCache[k];
  const g = new T.BoxGeometry(1, 1, 1, 8, 8, 8), p = g.attributes.position, v = new T.Vector3(), q = new T.Vector3(), h = .5 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); q.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z)));
    const d = v.clone().sub(q); if (d.lengthSq() > 1e-9) d.normalize().multiplyScalar(r); p.setXYZ(i, q.x + d.x, q.y + d.y, q.z + d.z);
  }
  g.computeVertexNormals(); return (rbCache[k] = g);
};
G.rbox = C.rbox;
/* frown arc (for grumpy enemies) */
C.frown = function (parent, c, rad, az, el, w, col) {
  const m = new T.Mesh(new T.TorusGeometry(1, .13, 8, 18, Math.PI), C.basic(col == null ? 0x3a1a2a : col));
  m.scale.set(w, w * .7, w); C.onSurface(m, c, rad, az, el, -.01); m.userData.noOutline = true; parent.add(m); return m;
};
/* make every material in `root` its own transparent copy so the whole model can fade (returns setter) */
C.fadeable = function (root) {
  const list = [];
  root.traverse(o => { if (o.isMesh && o.material) { const m = o.material, c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.transparent = true; o.material = c; list.push(c); } });
  return op => { for (const m of list) { m.opacity = op; m.depthWrite = op > .95; } };
};

/* blink every eye of a rig (rig.eyes, rig.bt) – used by enemies */
C.blinkAll = function (rig, dt, hold) {
  if (!rig || !rig.eyes) return; rig.bt = (rig.bt == null ? Math.random() * 3 : rig.bt) - dt; if (rig.bt <= -.14) rig.bt = 1.6 + Math.random() * 3;
  const bl = rig.bt < 0 ? Math.sin(Math.min(1, -rig.bt / .14) * Math.PI) : 0, v = Math.max(bl, hold || 0);
  for (const e of rig.eyes) e.blink(v);
};
/* ---------- common critter animation (blink, legs, tail, ears) */
C.tickCritter = function (c, dt, t, speed, look) {
  if (!c) return; c.bt = (c.bt || 0) - dt;
  if (c.bt <= -.14) c.bt = 1.6 + Math.random() * 3;           // schedule next blink
  const bl = c.bt < 0 ? Math.sin(Math.min(1, -c.bt / .14) * Math.PI) : 0;
  if (c.eyes) for (const e of c.eyes) { e.blink(bl); if (look) e.look(look.x, look.y); }
  const k = Math.min(1, speed / 3);
  if (c.legs) c.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 11 + (i === 0 || i === 3 ? 0 : Math.PI)) * .7 * k; });
  if (c.tail) c.tail.rotation.y = Math.sin(t * (6 + speed)) * .5;
  if (c.ears) c.ears.forEach((e, i) => { e.rotation.z = (e.userData.rz || 0) + Math.sin(t * 9 + i) * .1 * k; });
};
})();
