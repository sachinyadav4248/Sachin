/* =====================================================================
   v5.2 NEW CHARACTERS – grumpy-cute, never scary (same toon + outline recipe as ch_enemies.js)
     villains : makeCupcake, makeSnowman, makeJack, makeBee, makeRobot
     bosses   : type 10 Cupcake Queen, type 11 Big Jack   (C.makeBoss falls through to these)
     props    : makeGift (a gift box with a face), makeChick (a lost baby chick)
     hats     : pirate, bunny, flower, duck, cupcake, unicorn (C.makeHat falls through to these)
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell, tn = C.toon;
const CUPG = new T.CylinderGeometry(1, .72, 1, 20, 1);      // tapered cupcake wrapper: wide on top, narrow at the bottom
const SPOON = new T.SphereGeometry(1, 14, 10);

const eyeSet = (g, c, r, az, el, er, tilt, iris) => {
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(C.headEye(g, c, r, s * az, el, er, { iris }));
    if (tilt != null) { const b = C.brow(g, 0, 0, 0, er * 1.25, s * tilt); C.onSurface(b, c, r, s * (az - .05), el + .5, .01); b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), s * tilt)); }
  }
  return eyes;
};
const sprinkleCols = [0xff4f9a, 0x4fd0ff, 0xffe45c, 0x7af07a, 0xc07aff, 0xffffff];
/* tiny sprinkles scattered over an ellipsoid cap (no outline: they are just colour) */
function sprinkles(parent, c, r, n, seed) {
  let s = seed || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const az = rnd() * TAU, el = .15 + rnd() * 1.15;
    const m = new T.Mesh(G.sphS, tn(sprinkleCols[i % sprinkleCols.length], { rim: 0 })); m.scale.set(.07 * (r[0] > 1.5 ? 2 : 1), .07 * (r[0] > 1.5 ? 2 : 1), .2 * (r[0] > 1.5 ? 2 : 1));
    C.onSurface(m, c, r, az, el, .02); m.rotateZ(rnd() * TAU); m.userData.noOutline = true; parent.add(m);
  }
}
const cupStripes = (g, y, rMid, h, n, mat, sc) => {
  for (let i = 0; i < n; i++) { const a = i / n * TAU, s = ell(g, G.sphS, mat, Math.sin(a) * rMid, y, Math.cos(a) * rMid, .07 * sc, h * .5, .05 * sc); s.rotation.y = a; s.userData.noOutline = true; }
};

/* ---- Grumpy Cupcake: waddles, then squirts three sprinkle shots */
C.makeCupcake = function () {
  const g = new T.Group(), cup = tn(0xffa94a, { rim: 0xffe0b0 }), cupDk = tn(0xe8862a, { rim: 0xffd0a0 }), sponge = tn(0xf5cd8a, { rim: 0xfff0d0 }), pink = tn(0xff8ec9, { rim: 0xffe0f2, rimK: .25 }), cherry = tn(0xe8283c, { rim: 0xffb0b8 });
  ell(g, CUPG, cup, 0, .62, 0, 1.05, 1.0, 1.05);
  cupStripes(g, .62, .9, .8, 8, cupDk, 1);
  const SC = [0, 1.3, 0], SR = [1.12, .62, 1.12];
  ell(g, G.sph, sponge, SC[0], SC[1], SC[2], SR[0], SR[1], SR[2]);
  const eyes = eyeSet(g, SC, SR, .5, .15, .2, -.45, 0x5a3a20);
  C.frown(g, SC, SR, 0, -.32, .13); for (const s of [-1, 1]) C.blush(g, SC, SR, s * .85, -.12, .16, .09);
  const top = new T.Group(); top.position.set(0, 1.62, 0); g.add(top);
  const TS = [[0, .1, 1.0, .5], [0, .52, .74, .42], [0, .88, .48, .36]];
  for (const [x, y, r, h] of TS) ell(top, G.sph, pink, x, y, 0, r, h, r);
  ell(top, G.cone, pink, 0, 1.28, 0, .2, .42, .2);
  ell(top, G.sphM, cherry, 0, 1.58, 0, .27);
  sprinkles(top, [0, .1, 0], [1.0, .5, 1.0], 12, 11);
  const feet = [-1, 1].map(s => ell(g, G.sphM, cupDk, s * .45, .1, .22, .32, .18, .42));
  C.outline(g, .05); return { g, top, eyes, feet, bt: Math.random() * 3 };
};

/* ---- Snowball Sam: throws snowballs, loses his hat when bonked */
C.makeSnowman = function () {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const sn = tn(0xffffff, { rim: 0xbfe0ff, rimK: .3 }), coal = tn(0x2a2a3a, { rim: 0x8a8aa8 }), carrot = tn(0xff8a1a, { rim: 0xffd0a0 }), scarf = tn(0xe83a4a, { rim: 0xffb0b8 }), hatM = tn(0x2a2440, { rim: 0x8a80c0 }), wood = tn(0x7a5232, { rim: 0xd8b090 });
  ell(body, G.sph, sn, 0, .95, 0, 1.2, .98, 1.2);
  const HC = [0, 2.3, 0], HR = [.82, .76, .82];
  ell(body, G.sph, sn, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const nose = ell(body, G.cone, carrot, 0, 2.22, .98, .13, .55, .13); nose.rotation.x = Math.PI / 2;
  const eyes = eyeSet(body, HC, HR, .42, .22, .17, -.45, 0x2a3a5a);
  C.frown(body, HC, HR, 0, -.33, .12, 0x3a2a3a); for (const s of [-1, 1]) C.blush(body, HC, HR, s * .8, -.1, .14, .08, 0xff8ab0);
  const sc = new T.Mesh(G.tor, scarf); sc.scale.set(.8, .8, .8); sc.rotation.x = Math.PI / 2; sc.position.y = 1.66; body.add(sc);
  ell(body, G.sphM, scarf, .55, 1.28, .55, .2, .55, .12).rotation.z = -.25;
  for (const [y, z] of [[1.2, 1.12], [.8, 1.18], [.4, 1.1]]) ell(body, G.sphS, coal, 0, y, z, .1, .1, .07);
  const mkArm = s => { const pv = new T.Group(); pv.position.set(s * 1.05, 1.45, 0); body.add(pv); ell(pv, G.cyl, wood, s * .62, 0, 0, .06, 1.25, .06).rotation.z = Math.PI / 2; for (const k of [-1, 1]) ell(pv, G.cyl, wood, s * 1.22, k * .12, 0, .04, .32, .04).rotation.z = Math.PI / 2 + k * s * .6; return pv; };
  const armL = mkArm(-1), armR = mkArm(1);
  const hat = new T.Group(); hat.position.set(0, 2.92, 0); body.add(hat);
  ell(hat, G.cyl, hatM, 0, 0, 0, .8, .09, .8); ell(hat, G.cyl, hatM, 0, .42, 0, .5, .82, .5); ell(hat, G.cyl, scarf, 0, .12, 0, .52, .14, .52);
  C.outline(g, .05); return { g, body, hat, armL, armR, eyes, bt: Math.random() * 3 };
};

/* ---- Jack-in-the-Box: hops about; when it pops, the spring boings a grinning head out of the box */
function makeJackParts(sc, boss) {
  const g = new T.Group(), box = tn(0x7a4ad8, { rim: 0xd8c0ff, rimK: .2 }), boxDk = tn(0x5a30b0, { rim: 0xb090f0 }), yel = tn(0xffd93a, { rim: 0xffffff, emissive: 0x4a3a00 }), skin = tn(0xffe2c4, { rim: 0xffffff }), red = tn(0xe8283c, { rim: 0xffb0b8 }), grey = tn(0xb8bcc8, { rim: 0xffffff });
  const W = 2.0 * sc, H = 1.8 * sc;
  ell(g, C.rbox(.12), box, 0, H / 2, 0, W, H, W);
  ell(g, C.rbox(.1), yel, 0, .12 * sc, 0, W * 1.05, .22 * sc, W * 1.05);
  for (const x of [-.5, .5]) { const st = ell(g, G.sphM, yel, x * W * .9, H * .5, W * .51, .24 * sc, .24 * sc, .05); st.userData.noOutline = true; }
  const crank = new T.Group(); crank.position.set(W * .52, H * .5, 0); g.add(crank);
  ell(crank, G.cyl, grey, .16 * sc, 0, 0, .09 * sc, .4 * sc, .09 * sc).rotation.z = Math.PI / 2;
  const arm = new T.Group(); arm.position.x = .34 * sc; crank.add(arm); ell(arm, G.cyl, grey, 0, .3 * sc, 0, .07 * sc, .6 * sc, .07 * sc); ell(arm, G.sphM, red, 0, .64 * sc, 0, .17 * sc);
  const lid = new T.Group(); lid.position.set(0, H, -W * .5); g.add(lid); ell(lid, C.rbox(.1), boxDk, 0, .09 * sc, W * .5, W * 1.04, .18 * sc, W * 1.04);
  const spring = new T.Group(); spring.position.y = H - .05; g.add(spring);
  const coilM = tn(0xc8ccd8, { rim: 0xffffff }), N = 6, gap = .4 * sc;
  for (let i = 0; i < N; i++) { const c = new T.Mesh(G.tor, coilM); c.rotation.x = Math.PI / 2; c.scale.setScalar(.55 * sc); c.position.y = gap * (i + .5); spring.add(c); }
  const head = new T.Group(); g.add(head);
  const hr = 1.0 * sc, HC = [0, hr * .95, 0], HR = [hr, hr * .95, hr * .92];
  ell(head, G.sph, skin, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(head, G.sphM, red, 0, hr * .88, hr * .88, .22 * sc, .22 * sc, .22 * sc);
  const eyes = []; for (const s of [-1, 1]) eyes.push(C.headEye(head, HC, HR, s * .42, .28, .22 * sc, { iris: 0x2a3a8a }));
  C.smile(head, HC, HR, 0, -.32, .36 * sc); for (const s of [-1, 1]) C.blush(head, HC, HR, s * .8, -.12, .18 * sc, .1 * sc, 0xff6a9a);
  const hair = [0xff4f9a, 0x4fd0ff, 0xffe45c]; hair.forEach((c, i) => { for (const s of [-1, 1]) ell(head, G.sphM, tn(c, { rim: 0xffffff }), s * hr * (.95 + i * .1), hr * (1.0 + i * .22 - .25), 0, .3 * sc, .3 * sc, .3 * sc); });
  const cap = ell(head, G.cone, red, -.15 * sc, hr * 2.05, 0, .55 * sc, .9 * sc, .55 * sc); cap.rotation.z = .35; ell(head, G.sphS, yel, -.5 * sc, hr * 2.4, 0, .16 * sc);
  const out = { g, lid, spring, head, crank, arm, eyes, bt: Math.random() * 3, N, gap, H, hr };
  /* ext 0 = closed box, 1 = fully sprung */
  out.setExt = k => {
    k = Math.max(0, Math.min(1, k)); out.ext = k;
    lid.rotation.x = -2.0 * Math.min(1, k * 4);
    spring.scale.y = Math.max(.04, k); spring.visible = k > .02;
    head.position.y = H - .05 + (k < .02 ? -hr * .9 : N * gap * k + .05);
    head.visible = k > .02;
  };
  out.setExt(0);
  return out;
}
C.makeJack = function () { const o = makeJackParts(1); C.outline(o.g, .05); return o; };

/* ---- Buzzy Bee */
C.makeBee = function () {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const yel = tn(0xffd93a, { rim: 0xfff4b0, rimK: .25 }), blk = tn(0x2a2030, { rim: 0x8a80a0 }), wingM = tn(0xdff4ff, { opacity: .72, double: true, rim: 0xffffff, rimK: .4 });
  const BC = [0, 0, 0], BR = [.72, .68, .96];
  ell(body, G.sph, yel, 0, 0, 0, BR[0], BR[1], BR[2]);
  for (const z of [-.42, .0]) { const r = Math.sqrt(Math.max(0, 1 - (z / .96) ** 2)); const rg = ell(body, G.tor, blk, 0, 0, z, .72 * r * 1.0, .68 * r * 1.0, .85); rg.userData.noOutline = true; }
  ell(body, G.cone, blk, 0, 0, -1.12, .12, .38, .12).rotation.x = -Math.PI / 2;
  const eyes = eyeSet(body, BC, BR, .46, .2, .21, -.4, 0x3a2a10);
  C.smile(body, BC, BR, 0, -.28, .12, 0x4a1c34);
  for (const s of [-1, 1]) { ell(body, G.cyl, blk, s * .26, .78, .72, .035, .42, .035).rotation.x = .45; ell(body, G.sphS, blk, s * .26, 1.0, .84, .1); }
  const mkWing = s => { const w = new T.Group(); w.position.set(s * .3, .64, -.05); const m = ell(w, G.sphM, wingM, s * .6, 0, 0, .7, .05, .38); m.userData.noOutline = true; body.add(w); return w; };
  const wingL = mkWing(-1), wingR = mkWing(1);
  C.outline(g, .045); return { g, body, wingL, wingR, eyes, bt: Math.random() * 3 };
};

/* ---- Wind-up Robot: key spins on its back; it winds up, then its fist shoots out */
C.makeRobot = function () {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const tl = tn(0x3ab8c8, { rim: 0xc8f4ff, rimK: .25 }), tlDk = tn(0x2a8a9a, { rim: 0xb0e8f0 }), gold = tn(0xffd23a, { rim: 0xffffff, emissive: 0x4a3a00 }), red = tn(0xe8283c, { rim: 0xffb0b8 }), grey = tn(0xb8bcc8, { rim: 0xffffff });
  const lampMat = tn(0x4aff7a, { unique: true, emissive: 0x1a8a3a, rim: 0 });
  ell(body, C.rbox(.2), tl, 0, 1.4, 0, 1.5, 1.4, 1.1);
  ell(body, C.rbox(.12), gold, 0, 1.3, .52, .9, .55, .12);
  ell(body, G.sphM, lampMat, 0, 1.32, .62, .17);
  ell(body, C.rbox(.25), tlDk, 0, 2.6, 0, 1.4, 1.0, 1.15);
  const eyes = []; for (const s of [-1, 1]) { const e = C.eye(.25, { iris: 0x1a3a6a }); e.position.set(s * .34, 2.62, .6); body.add(e); eyes.push(e); C.brow(body, s * .36, 3.02, .62, .3, s * .45); }
  C.frown(body, [0, 2.6, 0], [.7, .5, .58], 0, -.35, .09, 0x1a2a3a);
  ell(body, G.cyl, grey, 0, 3.3, 0, .05, .5, .05); ell(body, G.sphM, red, 0, 3.62, 0, .17);
  const mkArm = s => { const pv = new T.Group(); pv.position.set(s * .98, 1.95, 0); body.add(pv); ell(pv, G.cyl, grey, 0, -.5, 0, .14, .9, .14); const fist = ell(pv, G.sphM, red, 0, -1.08, 0, .32); pv.fist = fist; return pv; };
  const armL = mkArm(-1), armR = mkArm(1);
  for (const s of [-1, 1]) { ell(body, G.cyl, grey, s * .4, .5, 0, .17, .6, .17); ell(body, C.rbox(.2), red, s * .4, .13, .2, .55, .26, .8); }
  const key = new T.Group(); key.position.set(0, 1.55, -.58); body.add(key);
  ell(key, G.cyl, gold, 0, 0, -.18, .08, .45, .08).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const lp = new T.Mesh(G.tor, gold); lp.scale.setScalar(.32); lp.position.set(s * .3, 0, -.45); key.add(lp); }
  C.outline(g, .05); return { g, body, key, armL, armR, lampMat, eyes, bt: Math.random() * 3 };
};

/* ---- a gift box with a cheeky face (collect them!) */
C.makeGift = function (col) {
  const g = new T.Group(), bx = tn(col, { rim: 0xffffff, rimK: .22 }), rib = tn(0xffffff, { rim: 0xffffff }), bow = tn(0xffe45c, { rim: 0xffffff, emissive: 0x3a2a00 });
  const body = new T.Group(); g.add(body);
  ell(body, C.rbox(.14), bx, 0, .85, 0, 1.5, 1.4, 1.5);
  ell(body, C.rbox(.1), bx, 0, 1.62, 0, 1.62, .32, 1.62);
  ell(body, G.box, rib, 0, 1.0, 0, .3, 1.42, 1.52).userData.noOutline = true;
  ell(body, G.box, rib, 0, 1.64, 0, 1.64, .34, .3).userData.noOutline = true;
  for (const s of [-1, 1]) { const lp = ell(body, G.sph, bow, s * .38, 1.98, 0, .4, .26, .22); lp.rotation.z = -s * .5; }
  ell(body, G.sphM, bow, 0, 1.94, 0, .2);
  const eyes = []; for (const s of [-1, 1]) { const e = C.eye(.2); e.position.set(s * .42, .98, .78); body.add(e); eyes.push(e); }
  C.smile(body, [0, .85, 0], [.75, .7, .75], 0, -.2, .2); for (const s of [-1, 1]) C.blush(body, [0, .85, 0], [.75, .7, .75], s * .62, -.12, .12, .07);
  C.outline(g, .05); return { g, body, eyes, bt: Math.random() * 3 };
};

/* ---- lost baby chick */
C.makeChick = function () {
  const g = new T.Group(), y = tn(0xffe45c, { rim: 0xffffff, rimK: .25 }), og = tn(0xff9a1a, { rim: 0xffe0a0 });
  const BC = [0, .62, 0], BR = [.62, .6, .58];
  ell(g, G.sph, y, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  const eyes = []; for (const s of [-1, 1]) { eyes.push(C.headEye(g, BC, BR, s * .5, .22, .15)); C.blush(g, BC, BR, s * .82, -.1, .1, .06); }
  ell(g, G.cone, og, 0, .55, .68, .1, .22, .1).rotation.x = Math.PI / 2;
  ell(g, G.sphM, y, 0, 1.2, .1, .1, .2, .1).rotation.z = .2;
  const wings = []; for (const s of [-1, 1]) { const w = ell(g, G.sphM, y, s * .6, .6, -.02, .13, .3, .36); wings.push(w); }
  const feet = [-1, 1].map(s => ell(g, G.sphM, og, s * .22, .06, .12, .12, .06, .18));
  C.outline(g, .045); return { g, eyes, wings, feet, bt: Math.random() * 3 };
};

/* =====================================================================  BOSSES 10 + 11 */
const HUE = [0, .08, .16, .5, .7];
const tint = (hex, tier) => { const c = new T.Color(hex), h = {}; c.getHSL(h); c.setHSL((h.h + HUE[tier % 5]) % 1, h.s, h.l); return c.getHex(); };
const prevBoss = C.makeBoss;
C.makeBoss = function (type, tier) {
  if (type < 10) return prevBoss(type, tier);
  const g = new T.Group(), mats = [], eyes = [];
  const M = (hex, o) => { o = o || {}; const m = tn(o.notint ? hex : tint(hex, tier), Object.assign({ unique: true, rim: 0xffffff, rimK: .2 }, o)); mats.push(m); return m; };
  const out = { g, mats, eyes, blade: null, floatY: 0, tick: null };
  if (type === 10) {                                   // ---- Cupcake Queen
    const cup = M(0xffa94a), cupDk = M(0xe8862a), sponge = M(0xf5cd8a), pink = M(0xff8ec9), white = M(0xfff0f8), gold = M(0xffd23a, { notint: true, emissive: 0x6a4a00 }), cherry = M(0xe8283c, { notint: true }), wood = M(0xd8a060, { notint: true });
    ell(g, CUPG, cup, 0, 1.0, 0, 2.6, 2.0, 2.6); cupStripes(g, 1.0, 2.25, 1.6, 12, cupDk, 2.4);
    const SC = [0, 2.5, 0], SR = [2.9, 1.5, 2.9];
    ell(g, G.sph, sponge, SC[0], SC[1], SC[2], SR[0], SR[1], SR[2]);
    for (const s of [-1, 1]) { const e = C.headEye(g, SC, SR, s * .38, .15, .5, { iris: 0x5a2a20 }); eyes.push(e); const b = C.brow(g, 0, 0, 0, .62, -s * .45); C.onSurface(b, SC, SR, s * .34, .62, .01); b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -s * .45)); C.blush(g, SC, SR, s * .72, -.12, .4, .22); }
    C.frown(g, SC, SR, 0, -.3, .52, 0x5a1a2a);
    const top = new T.Group(); top.position.set(0, 3.5, 0); g.add(top);
    ell(top, G.sph, pink, 0, .2, 0, 2.4, .9, 2.4); ell(top, G.sph, white, 0, .95, 0, 1.8, .8, 1.8); ell(top, G.sph, pink, 0, 1.6, 0, 1.2, .7, 1.2);
    sprinkles(top, [0, .2, 0], [2.4, .9, 2.4], 22, 5); sprinkles(top, [0, .95, 0], [1.8, .8, 1.8], 14, 9);
    const crown = new T.Group(); crown.position.set(0, 2.15, 0); top.add(crown);
    ell(crown, G.cyl, gold, 0, 0, 0, .8, .34, .8); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(crown, G.cone, gold, Math.cos(a) * .66, .5, Math.sin(a) * .66, .17, .6, .17); ell(crown, G.sphS, [cherry, M(0x3aa0ff, { notint: true }), M(0x4aff7a, { notint: true })][i % 3], Math.cos(a) * .66, .9, Math.sin(a) * .66, .1); }
    ell(crown, G.sphM, cherry, 0, .38, 0, .4);
    const spoon = new T.Group(); spoon.position.set(3.6, .6, .8); g.add(spoon); ell(spoon, G.cyl, wood, 0, 1.8, 0, .16, 3.6, .16); ell(spoon, SPOON, wood, 0, 3.85, 0, .62, .8, .22);
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5; top.scale.set(1 + Math.sin(t * 3) * .02 * w, 1 - Math.sin(t * 3) * .03 * w, 1 + Math.sin(t * 3) * .02 * w); crown.rotation.y += dt * (.8 + phase * .4); spoon.rotation.z = Math.sin(t * 2.2) * .12 * w; };
  } else {                                             // ---- Big Jack
    const o = makeJackParts(1.5, true); g.add(o.g); eyes.push(...o.eyes); out.jack = o;
    /* make every box/head material tintable + flashable: swap in unique tinted copies */
    o.g.traverse(m => { if (m.isMesh && m.material && !m.userData.ol) { const k = m.material.clone(); k.onBeforeCompile = m.material.onBeforeCompile; k.customProgramCacheKey = m.material.customProgramCacheKey; if (k.color) k.color.setHex(tint(k.color.getHex(), tier)); m.material = k; if (k.emissive) mats.push(k); } });   // only lit (toon) materials can take the hit-flash
    o.setExt(1);
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5; o.setExt(.82 + Math.sin(t * 2.6 * w) * .18); o.head.rotation.z = Math.sin(t * 2) * .14 * w; o.head.rotation.y = Math.sin(t * 1.3) * .2; o.crank.rotation.x += dt * 5 * w; };
    out.faceY = 5; out.cy = 3.0;
  }
  C.outline(g, .1);
  return out;
};

/* =====================================================================  HATS */
const prevHat = C.makeHat;
const HATS = {
  pirate() {
    const g = new T.Group(), blk = tn(0x2a2030, { rim: 0x8a80a0 }), wh = tn(0xfff8ee, { rim: 0xffffff }), gold = tn(0xffd23a, { emissive: 0x4a3a00 });
    ell(g, G.sph, blk, 0, .22, 0, .86, .3, .72); ell(g, G.sphM, blk, 0, .4, .55, .56, .24, .36);
    for (const s of [-1, 1]) ell(g, G.sphM, blk, s * .66, .38, 0, .36, .2, .56).rotation.z = -s * .5;
    ell(g, G.cyl, gold, 0, .2, .0, .6, .05, .5).userData.noOutline = true;
    ell(g, G.sphM, wh, 0, .42, .86, .2, .18, .06); for (const s of [-1, 1]) ell(g, G.sphS, blk, s * .07, .44, .91, .045);
    for (const k of [-1, 1]) ell(g, G.cyl, wh, 0, .24, .86, .03, .34, .03).rotation.z = k * .9;
    g.scale.setScalar(1.25); g.position.y = .06;
    return g;
  },
  bunny() {
    const g = new T.Group(), wh = tn(0xfffaf4, { rim: 0xffffff }), pk = tn(0xffa0c0, { rim: 0xffffff }), band = tn(0xff6ab0, { rim: 0xffd0e8 });
    const b = new T.Mesh(G.tor, band); b.scale.setScalar(.5); b.rotation.x = Math.PI / 2; b.position.y = .08; g.add(b);
    for (const s of [-1, 1]) { const ear = new T.Group(); ear.position.set(s * .26, .1, 0); ear.rotation.z = -s * .16; g.add(ear); ell(ear, G.sph, wh, 0, .72, 0, .2, .72, .12); ell(ear, G.sph, pk, 0, .68, .08, .1, .5, .05).userData.noOutline = true; }
    return g;
  },
  flower() {
    const g = new T.Group(), leaf = tn(0x5ac85a, { rim: 0xd0ffd0 }), ctr = tn(0xffe45c, { rim: 0xffffff });
    const r = new T.Mesh(G.tor, leaf); r.scale.setScalar(.64); r.rotation.x = Math.PI / 2; r.position.y = .1; g.add(r);
    const cols = [0xff6ab0, 0xffffff, 0xffb03a, 0xb08aff];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, x = Math.cos(a) * .66, z = Math.sin(a) * .66; const pm = tn(cols[i % 4], { rim: 0xffffff }); for (let k = 0; k < 5; k++) { const b = k / 5 * TAU; ell(g, G.sphS, pm, x + Math.cos(b) * .1, .18, z + Math.sin(b) * .1, .08, .05, .08).userData.noOutline = true; } ell(g, G.sphS, ctr, x, .22, z, .07); }
    g.children.forEach(c => { c.position.y += .1; }); g.scale.setScalar(1.35);
    return g;
  },
  duck() {
    const g = new T.Group(), yl = tn(0xffe03a, { rim: 0xffffff, rimK: .25 }), og = tn(0xff9a1a, { rim: 0xffe0a0 }), blk = tn(0x1a1018, { rim: 0 });
    ell(g, G.sph, yl, 0, .3, -.05, .5, .38, .55); ell(g, G.sph, yl, 0, .68, .26, .3, .28, .28);
    ell(g, G.cone, yl, 0, .52, -.58, .14, .3, .14).rotation.x = -Math.PI / 2 + .3;
    ell(g, G.sphM, og, 0, .64, .55, .18, .07, .16); for (const s of [-1, 1]) ell(g, G.sphS, blk, s * .13, .75, .44, .045);
    for (const s of [-1, 1]) ell(g, G.sphM, yl, s * .5, .32, -.05, .1, .2, .34).rotation.z = s * .3;
    return g;
  },
  cupcake() {
    const g = new T.Group(), cup = tn(0xffa94a, { rim: 0xffe0b0 }), sp = tn(0xf5cd8a, { rim: 0xfff0d0 }), pk = tn(0xff8ec9, { rim: 0xffe0f2 }), ch = tn(0xe8283c, { rim: 0xffb0b8 });
    ell(g, CUPG, cup, 0, .2, 0, .55, .36, .55); ell(g, G.sph, sp, 0, .46, 0, .52, .26, .52);
    ell(g, G.sph, pk, 0, .68, 0, .44, .24, .44); ell(g, G.sph, pk, 0, .92, 0, .3, .2, .3); ell(g, G.sphM, ch, 0, 1.15, 0, .13);
    return g;
  },
  unicorn() {
    const g = new T.Group(), horn = tn(0xfff4fa, { rim: 0xffffff }), gold = tn(0xffd23a, { emissive: 0x4a3a00 }), pk = tn(0xffa0c8, { rim: 0xffffff }), wh = tn(0xffffff, { rim: 0xffffff });
    const hg = new T.Group(); hg.position.set(0, .35, .22); hg.rotation.x = .28; g.add(hg);
    ell(hg, G.cone, horn, 0, .6, 0, .2, 1.2, .2);
    for (const [y, s] of [[.25, .2], [.55, .16], [.82, .12]]) { const r = new T.Mesh(G.tor, gold); r.scale.setScalar(s * 1.05); r.rotation.x = Math.PI / 2; r.position.y = y; r.userData.noOutline = true; hg.add(r); }
    for (const s of [-1, 1]) { ell(g, G.cone, wh, s * .5, .3, -.05, .15, .42, .12).rotation.z = -s * .3; ell(g, G.cone, pk, s * .5, .28, 0, .08, .26, .06).userData.noOutline = true; }
    ell(g, G.sphS, tn(0xffe45c, { emissive: 0x806000 }), .0, 1.5, .5, .1).userData.noOutline = true;
    return g;
  }
};
C.makeHat = function (id) { return HATS[id] ? HATS[id]() : prevHat(id); };
C.EXTRA_HATS = Object.keys(HATS);
})();
