/* =====================================================================
   BOSSES – ten big, expressive, soft-shaded characters
   C.makeBoss(type, tier) -> { g, mats, blade, floatY, eyes, faceY }
   Faces +z. Roughly 5-6 units tall at scale 1.
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell;
const HUE = [0, .08, .16, .5, .7];
function tint(hex, tier) { const c = new T.Color(hex), h = {}; c.getHSL(h); c.setHSL((h.h + HUE[tier % 5]) % 1, h.s, h.l); return c.getHex(); }

C.makeBoss = function (type, tier) {
  const g = new T.Group(), mats = [], eyes = [];
  const M = (hex, o) => { o = o || {}; const m = C.toon(o.notint ? hex : tint(hex, tier), Object.assign({ unique: true, rim: 0xffffff, rimK: .2 }, o)); mats.push(m); return m; };
  const F = (x, y, z, s, iris) => { const e = C.eye(s, { iris: iris }); e.position.set(x, y, z); g.add(e); eyes.push(e); return e; };
  const brow = (x, y, z, w, t) => C.brow(g, x, y, z, w, t, 0x2a1830);
  const out = { g, mats, eyes, blade: null, floatY: 0 };
  const ink = (c) => C.basic(c);
  switch (type) {
    case 0: { // King Woolly
      const wool = M(0xfffaf0, { notint: false }), face = M(0x5a4a56), gold = M(0xffd23a, { notint: true, emissive: 0x6a4a00 });
      ell(g, G.sph, wool, 0, 2.3, 0, 2.5, 2.1, 2.7);
      for (const [x, y, z, r] of [[-1.7, 3.3, .8, 1.2], [1.7, 3.3, .8, 1.2], [0, 3.9, -.6, 1.3], [-2.3, 2.3, -.8, 1.2], [2.3, 2.3, -.8, 1.2], [0, 1.4, -2.2, 1.2], [-1.4, 3.6, -1.2, 1.1], [1.4, 3.6, -1.2, 1.1], [0, 2.4, -2.6, 1.3]]) ell(g, G.sphM, wool, x, y, z, r);
      const HC = [0, 2.5, 2.3], HR = [1.5, 1.55, 1.3]; ell(g, G.sph, face, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
      ell(g, G.sphM, wool, 0, 3.8, 1.9, 1.0, .75, .95);
      F(-.62, 2.75, 3.25, .5); F(.62, 2.75, 3.25, .5); brow(-.65, 3.45, 3.3, .6, -.4); brow(.65, 3.45, 3.3, .6, .4);
      C.frown(g, HC, HR, 0, -.38, .38); ell(g, G.sphM, M(0xff9ab0, { notint: true }), 0, 2.2, 3.4, .22, .16, .1);
      for (const s of [-1, 1]) { const e = ell(g, G.sphM, face, s * 1.55, 2.9, 2.2, .7, .26, .4); e.rotation.z = s * -.45; }
      ell(g, G.cyl, gold, 0, 4.55, 1.9, 1.0, .35, 1.0); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ell(g, G.cone, gold, Math.cos(a) * .85, 5.0, 1.9 + Math.sin(a) * .85, .28, .7, .28); ell(g, G.sphS, M([0xff3a5a, 0x3aa0ff, 0x4aff7a][k % 3], { notint: true }), Math.cos(a) * .85, 5.4, 1.9 + Math.sin(a) * .85, .15); }
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { ell(g, G.cyl, face, sx * 1.3, .7, sz * 1.6, .38, 1.4, .38); }
      break; }
    case 1: { // Captain Fox
      const fm = M(0xff8a2a), wh = M(0xfff6ec, { notint: true }), dk = M(0x3a2430, { notint: true }), hat = M(0x1c1a2a, { notint: true });
      ell(g, G.sph, fm, 0, 2.3, 0, 2.2, 1.95, 2.8);
      ell(g, G.sph, wh, 0, 1.7, 1.2, 1.4, 1.2, 1.5).userData.noOutline = true;
      const HC = [0, 3.5, 2.5], HR = [1.7, 1.45, 1.5]; ell(g, G.sph, fm, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
      for (const s of [-1, 1]) ell(g, G.sphM, wh, s * 1.0, 3.1, 3.2, .8, .6, .8).userData.noOutline = true;
      ell(g, G.sphM, wh, 0, 3.2, 3.7, .7, .55, .9); ell(g, G.sphS, C.basic(0x1a1018), 0, 3.3, 4.45, .26, .2, .2);
      F(-.72, 3.85, 3.75, .42, 0x4a2a10); F(.72, 3.85, 3.75, .42, 0x4a2a10); brow(-.75, 4.45, 3.9, .55, -.5); brow(.75, 4.45, 3.9, .55, .5);
      for (const s of [-1, 1]) ell(g, G.cone, fm, s * 1.2, 4.9, 2.2, .5, 1.25, .4);
      ell(g, G.cyl, hat, 0, 4.85, 2.4, 1.9, .2, 1.4); ell(g, G.sph, hat, 0, 5.2, 2.4, 1.15, .75, 1.0); ell(g, G.sphM, C.toon(0xffffff), 0, 5.2, 3.35, .32, .32, .1).userData.noOutline = true;
      const tl = ell(g, G.sph, fm, 0, 2.6, -3.6, .9, .9, 2.0); tl.rotation.x = -.5; ell(g, G.sphM, wh, 0, 3.4, -5.4, .75, .75, .8);
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) ell(g, G.cyl, dk, sx * 1.2, .7, sz * 1.5, .42, 1.4, .42);
      break; }
    case 2: { // Mega Mower
      const red = M(0xe03a2e), gr = M(0x5a6068, { notint: true }), bk = M(0x2a2a32, { notint: true });
      ell(g, G.sph, red, 0, 2.4, 0, 2.4, 1.7, 3.1);
      ell(g, G.sph, gr, 0, 4.0, -1.1, 1.3, .8, 1.3); ell(g, G.cyl, bk, 0, 4.7, -1.1, .4, .8, .4);
      F(-1.05, 3.0, 2.55, .6); F(1.05, 3.0, 2.55, .6); brow(-1.1, 3.9, 2.8, .85, -.5); brow(1.1, 3.9, 2.8, .85, .5);
      ell(g, G.sphM, C.basic(0x4a0a14), 0, 1.7, 3.0, 1.2, .5, .25).userData.noOutline = true; for (let k = -2; k <= 2; k++) ell(g, G.sphS, C.basic(0xffffff), k * .42, 1.95, 3.18, .17, .2, .06).userData.noOutline = true;
      out.blade = ell(g, G.box, M(0xd4d8e0, { notint: true }), 0, .8, 3.6, 5.4, .16, .55);
      for (const [x, z] of [[-2.5, 2], [2.5, 2], [-2.5, -2], [2.5, -2]]) { const w = ell(g, G.cyl, bk, x, 1.05, z, 1.05, .6, 1.05); w.rotation.z = Math.PI / 2; ell(g, G.cyl, M(0xffd23a, { notint: true }), x + Math.sign(x) * .33, 1.05, z, .5, .2, .5).rotation.z = Math.PI / 2; }
      break; }
    case 3: { // Grumpy Cloud
      const cl = M(0x8a96b8), dark = M(0x6a76a0);
      out.floatY = 6;
      for (const [x, y, z, r] of [[0, 2, 0, 2.6], [-2.7, 1.6, 0, 1.9], [2.7, 1.6, 0, 1.9], [-1.4, 3.1, -.3, 1.8], [1.5, 3.0, -.3, 1.9], [0, 1.2, -.8, 2.2], [-3.6, 1.3, -.5, 1.2], [3.6, 1.3, -.5, 1.2]]) ell(g, G.sph, cl, x, y, z, r, r * .82, r * .9);
      const BC = [0, 2, 0], BR = [2.6, 2.1, 2.3];
      F(-.9, 2.4, 2.1, .55, 0x1a2a5a); F(.9, 2.4, 2.1, .55, 0x1a2a5a); brow(-.95, 3.25, 2.3, .8, -.55); brow(.95, 3.25, 2.3, .8, .55);
      C.frown(g, BC, BR, 0, -.35, .5); for (const s of [-1, 1]) C.blush(g, BC, BR, s * .75, -.05, .35, .2, 0xff8ab0);
      for (let k = 0; k < 5; k++) { const d = ell(g, G.sphM, C.toon(0x6ab8ff, { opacity: .85, rim: 0xffffff }), (k - 2) * .95, -.7 - (k % 2) * .5, 0, .16, .42, .16); d.userData.noOutline = true; }
      break; }
    case 4: { // Jelly Giant
      const jm = M(0x5aff7a, { opacity: .86, rimK: .4 }), core = M(0xaaffbb);
      ell(g, G.sph, jm, 0, 2.3, 0, 3.0, 2.5, 3.0);
      ell(g, G.sphM, core, 0, 1.4, -.5, 1.4, 1.0, 1.3).userData.noOutline = true;
      for (const [x, y, z, r] of [[-1.3, 1.4, -1.4, .38], [1.5, 2.1, -1.6, .3], [.4, 3.1, -1.1, .26]]) ell(g, G.sphM, M(0x2a8a3a), x, y, z, r).userData.noOutline = true;
      const BC = [0, 2.3, 0], BR = [3, 2.5, 3];
      F(-.95, 2.85, 2.55, .65); F(.95, 2.85, 2.55, .65); brow(-1.0, 3.8, 2.8, .9, -.4); brow(1.0, 3.8, 2.8, .9, .4);
      C.smile(g, BC, BR, 0, -.3, .5, 0x1d6a2e); for (const s of [-1, 1]) C.blush(g, BC, BR, s * .72, -.12, .4, .23, 0xffe45c);
      C.shine(g, BC, BR, -.55, .75, .7, .35, .6);
      ell(g, G.sphM, M(0xffe45c, { notint: true, emissive: 0x806000 }), 0, 4.95, 0, .55, .45, .55);
      break; }
    case 5: { // Robo Sheep
      const met = M(0xaab4c8, { notint: false }), dk = M(0x3a4252, { notint: true }), red = M(0xff3d3d, { notint: true, emissive: 0xaa0000 });
      ell(g, C.rbox(.3), met, 0, 2.3, 0, 4.2, 2.8, 4.8);
      for (const [x, y, z] of [[-1.3, 3.9, .5], [0, 4.1, -.4], [1.3, 3.9, .5], [-1.8, 3.2, -1.2], [1.8, 3.2, -1.2]]) ell(g, G.sph, M(0xe8eef8), x, y, z, 1.0);
      ell(g, C.rbox(.3), dk, 0, 3.4, 2.2, 2.8, 2.2, 2.4);
      for (const s of [-1, 1]) { ell(g, G.sphM, C.basic(0x120a0a), s * .65, 3.5, 3.4, .55, .55, .12).userData.noOutline = true; const e = ell(g, G.sphM, red, s * .65, 3.5, 3.5, .38, .38, .1); e.userData.noOutline = true; }
      brow(-.68, 4.25, 3.45, .6, -.45); brow(.68, 4.25, 3.45, .6, .45);
      ell(g, G.box, C.basic(0x1a1a22), 0, 2.7, 3.4, 1.2, .26, .1).userData.noOutline = true;
      ell(g, G.cyl, M(0x888a98, { notint: true }), 0, 5.5, 2.2, .1, 1.2, .1); ell(g, G.sphM, red, 0, 6.2, 2.2, .35).userData.noOutline = true;
      for (const s of [-1, 1]) { ell(g, G.sphS, M(0xff7aa0, { notint: true }), s * 1.25, 2.4, 3.3, .3, .2, .1).userData.noOutline = true; for (const z of [-1.4, 1.4]) { const w = ell(g, G.cyl, M(0x555a66, { notint: true }), s * 2.3, .85, z, .85, .7, .85); w.rotation.z = Math.PI / 2; } }
      break; }
    case 6: { // Pumpkin King
      const pm = M(0xff7a1a), glow = M(0xffcc33, { notint: true, emissive: 0xffaa00, rim: 0 });
      for (const k of [-1.35, 0, 1.35]) ell(g, G.sph, pm, k, 2.3, k === 0 ? .3 : -.1, k === 0 ? 2.0 : 1.55, 2.2, 2.2);
      ell(g, G.cyl, M(0x3a9a3a, { notint: true }), 0, 4.8, 0, .5, 1.0, .5); const leaf = ell(g, G.sphM, M(0x4ab04a, { notint: true }), .7, 4.8, 0, .6, .12, .3); leaf.rotation.z = .4;
      for (const s of [-1, 1]) { const e = ell(g, G.cone, glow, s * 1.0, 3.2, 2.35, .5, .75, .15); e.rotation.z = Math.PI + s * .15; e.userData.noOutline = true; ell(g, G.sphS, C.basic(0x2a1000), s * 1.0, 3.1, 2.5, .13, .22, .05).userData.noOutline = true; }
      ell(g, G.cone, glow, 0, 2.5, 2.45, .3, .45, .12).rotation.z = Math.PI;
      const mo = ell(g, G.sphM, glow, 0, 1.7, 2.3, 1.45, .55, .2); mo.userData.noOutline = true; for (let k = -2; k <= 2; k++) ell(g, G.cone, M(0xff7a1a), k * .55, k % 2 ? 2.0 : 1.35, 2.45, .2, .35, .1).rotation.z = k % 2 ? 0 : Math.PI;
      const HC = [0, 2.3, .3], HR = [2, 2.2, 2.2];
      for (const [x, y, z, r] of [[-3, 1.4, .2, .5], [3, 1.4, .2, .5]]) ell(g, G.sphM, pm, x, y, z, r);
      break; }
    case 7: { // Ice Golem
      const ice = M(0x9ad8ff), ice2 = M(0xc8ecff);
      ell(g, C.rbox(.28), ice, 0, 2.0, 0, 3.6, 3.4, 2.9);
      ell(g, C.rbox(.3), ice2, 0, 4.7, .3, 2.6, 2.1, 2.2);
      for (const s of [-1, 1]) { ell(g, C.rbox(.3), M(0x8ac8ee), s * 2.6, 2.4, .2, 1.4, 2.8, 1.4); ell(g, G.sphM, M(0xeaf8ff), s * 2.6, .85, .2, .85); }
      for (const [x, z] of [[-1.1, 0], [1.1, 0]]) ell(g, C.rbox(.3), M(0x8ac8ee), x, .5, z, 1.4, 1.0, 1.6);
      F(-.62, 4.85, 1.45, .4, 0x1a4aaa); F(.62, 4.85, 1.45, .4, 0x1a4aaa); brow(-.65, 5.5, 1.5, .55, -.45); brow(.65, 5.5, 1.5, .55, .45);
      C.frown(g, [0, 4.7, .3], [1.3, 1.05, 1.1], 0, -.45, .35);
      ell(g, G.cone, M(0xffffff, { notint: true }), 0, 6.3, .3, .5, 1.3, .5); for (const s of [-1, 1]) ell(g, G.cone, ice2, s * 1.0, 6.0, .3, .3, .9, .3).rotation.z = -s * .4;
      ell(g, G.sphM, M(0x2a6aff, { notint: true, emissive: 0x1a4acc }), 0, 2.7, 1.5, .42).userData.noOutline = true;
      for (const [x, y] of [[-1.2, 3.0], [1.1, 1.3], [-.4, 1.0]]) { const c = ell(g, G.cone, ice2, x, y, 1.5, .26, .6, .26); c.rotation.x = Math.PI / 2; }
      break; }
    case 8: { // Space Blob
      const bm = M(0xb06aff, { rimK: .3 }), tn2 = M(0x9a4aef);
      out.floatY = 1.5;
      ell(g, G.sph, bm, 0, 2.5, 0, 2.8, 2.5, 2.8);
      const BC = [0, 2.5, 0], BR = [2.8, 2.5, 2.8];
      F(-1.1, 3.3, 2.35, .55, 0x2a1a5a); F(1.1, 3.3, 2.35, .55, 0x2a1a5a); F(0, 2.3, 2.6, .46, 0x2a1a5a);
      C.smile(g, BC, BR, 0, -.4, .45, 0x2a0a5a); for (const s of [-1, 1]) C.blush(g, BC, BR, s * .9, -.15, .4, .22, 0xff8ad0);
      C.shine(g, BC, BR, -.5, .8, .7, .35, .5);
      ell(g, G.cyl, M(0x888a98, { notint: true }), 0, 5.4, 0, .12, 1.3, .12); ell(g, G.sphM, M(0x7af0ff, { notint: true, emissive: 0x2a9ab0 }), 0, 6.3, 0, .55).userData.noOutline = true;
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; const tt = ell(g, G.sph, tn2, Math.cos(a) * 2.0, .6, Math.sin(a) * 2.0, .5, 1.1, .5); tt.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); }
      break; }
    default: { // Rainbow Dragon
      const pm = M(0xff7ad0), pl = M(0xffb8e8), wing = M(0xffd0f0, { opacity: .85, double: true });
      out.floatY = 2;
      ell(g, G.sph, pm, 0, 2.3, 0, 2.5, 2.3, 2.9);
      ell(g, G.sph, pl, 0, 1.5, 1.1, 1.5, 1.4, 1.5).userData.noOutline = true;
      const HC = [0, 3.6, 2.3], HR = [1.7, 1.45, 1.55]; ell(g, G.sph, pm, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
      ell(g, G.sphM, pl, 0, 3.15, 3.5, .95, .65, .7);
      for (const s of [-1, 1]) ell(g, G.sphS, C.basic(0x7a2a5a), s * .3, 3.3, 4.15, .1, .14, .06).userData.noOutline = true;
      F(-.78, 4.1, 3.4, .42, 0x5a1a6a); F(.78, 4.1, 3.4, .42, 0x5a1a6a); brow(-.8, 4.7, 3.5, .6, -.4); brow(.8, 4.7, 3.5, .6, .4);
      for (const s of [-1, 1]) { ell(g, G.cone, M(0xffe45c, { notint: true }), s * .8, 5.1, 2.1, .3, 1.0, .3).rotation.z = -s * .25; }
      ['#ff5a5a', '#ffa03a', '#ffe45c', '#7ae05a', '#5ac8ff', '#9a6aff'].forEach((c, i) => { const r = new T.Mesh(G.tor, M(parseInt(c.slice(1), 16), { notint: true, rim: 0 })); r.scale.set(2.85 - i * .31, 2.6 - i * .28, 1.5); r.position.set(0, 2.3, -.5 - i * .12); g.add(r); });
      for (const s of [-1, 1]) { const w = ell(g, G.sphM, wing, s * 3.4, 3.4, -.7, 2.1, .16, 1.5); w.rotation.z = s * .45; w.userData.noOutline = true; }
      const tl = ell(g, G.sph, pm, 0, 1.6, -3.4, .8, .8, 1.8); tl.rotation.x = .3; ell(g, G.cone, M(0xffe45c, { notint: true }), 0, 1.8, -5.3, .55, 1.0, .55).rotation.x = -Math.PI / 2;
      break; }
  }
  C.outline(g, .08);
  return out;
};
})();
