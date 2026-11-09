/* =====================================================================
   v5.3 NEW CHARACTERS – same grumpy-cute toon + outline recipe as ch_extra.js
     villains : makeCrabby, makeBoo, makeSpinny, makeRexy, makeDrizzle, makeGummy(col)
     bosses   : type 12 Captain Crabby, 13 Boo King, 14 Rex the Roar, 15 Sundae Sam,
                16 Teddy Titan, 17 Professor Hoot   (C.makeBoss falls through to these)
     pals     : elephant, owl, turtle, lion, koala, dino  (C.makeCritter falls through to these)
   Every villain is built by a *Parts(mk) function, so the boss version re-uses the very same
   model with tinted, flash-able materials (M) instead of the shared cached ones.
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell, tn = C.toon;
const AX = new T.Vector3(0, 0, 1);

/* a pair of eyes on a head ellipsoid, with optional angry brows */
const eyeSet = (g, c, r, az, el, er, tilt, iris) => {
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(C.headEye(g, c, r, s * az, el, er, { iris }));
    if (tilt != null) { const b = C.brow(g, 0, 0, 0, er * 1.25, s * tilt); C.onSurface(b, c, r, s * (az - .05), el + .5, .01); b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(AX, s * tilt)); }
  }
  return eyes;
};
const plain = (hex, o) => tn(hex, o);

/* ---------------------------------------------------------------- Crabby */
function crabbyParts(mk) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const red = mk(0xff6a3a, { rim: 0xffd0b0, rimK: .25 }), dk = mk(0xe0482a, { rim: 0xffc0a0 }), cream = mk(0xffd9b8, { rim: 0xffffff }, true);
  const BC = [0, 1.05, 0], BR = [1.55, .9, 1.15];
  ell(body, G.sph, red, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  for (const [x, z] of [[-.75, -.3], [0, -.55], [.75, -.3]]) { const s = ell(body, G.sphM, dk, x, 1.84, z, .24, .12, .24); s.userData.noOutline = true; }
  ell(body, G.sph, cream, 0, .62, .72, .85, .3, .5).userData.noOutline = true;
  const eyes = [];
  for (const s of [-1, 1]) {
    ell(body, G.cyl, dk, s * .5, 1.9, .62, .07, .55, .07);
    const e = C.eye(.27, { iris: 0x2a1a10 }); e.position.set(s * .5, 2.28, .68); body.add(e); eyes.push(e);
    C.brow(body, s * .5, 2.62, .74, .3, s * .45);
  }
  C.frown(body, BC, BR, 0, -.2, .12, 0x5a1a1a); for (const s of [-1, 1]) C.blush(body, BC, BR, s * .8, -.05, .16, .09);
  const mkClaw = s => {
    const pv = new T.Group(); pv.position.set(s * 1.5, 1.15, .5); body.add(pv);
    ell(pv, G.sph, dk, s * .38, 0, .1, .4, .24, .3);
    const hand = new T.Group(); hand.position.set(s * .85, .05, .6); pv.add(hand);
    ell(hand, G.sph, red, 0, 0, 0, .66, .55, .6);
    const jaws = [];
    for (const k of [1, -1]) { const j = new T.Group(); j.position.set(0, k * .16, .35); hand.add(j); ell(j, G.cone, dk, 0, 0, .5, .27, 1.0, .2).rotation.x = Math.PI / 2; jaws.push(j); }
    pv.jaws = jaws; pv.hand = hand; return pv;
  };
  const clawL = mkClaw(-1), clawR = mkClaw(1), legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const pv = new T.Group(); pv.position.set(s * 1.2, .65, -.55 + i * .45); ell(pv, G.cyl, dk, s * .38, -.2, 0, .09, .85, .09).rotation.z = s * 1.0; body.add(pv); legs.push(pv); }
  return { g, body, clawL, clawR, eyes, legs, open(c, a) { c.jaws[0].rotation.x = -a; c.jaws[1].rotation.x = a; } };
}
C.makeCrabby = function () { const o = crabbyParts(plain); C.outline(o.g, .05); o.bt = Math.random() * 3; o.open(o.clawL, .1); o.open(o.clawR, .1); return o; };

/* ---------------------------------------------------------------- Boo (peek-a-boo ghost) */
function booParts(mk) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const sh = mk(0xf0f6ff, { rim: 0xbfd8ff, rimK: .35 }), sh2 = mk(0xdbe8ff, { rim: 0xffffff, rimK: .3 }), ink = C.basic(0x2a2a4a);
  const HC = [0, 2.0, 0], HR = [1.2, 1.2, 1.1];
  ell(body, G.sph, sh, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(body, G.cyl, sh, 0, 1.0, 0, 1.18, 1.5, 1.08);
  const skirt = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; skirt.push(ell(body, G.sph, sh2, Math.sin(a) * 1.0, .38, Math.cos(a) * .92, .46, .55, .46)); }
  const eyes = eyeSet(body, HC, HR, .46, .12, .24, null, 0x2a3a6a);
  const mouth = ell(body, G.sphS, ink, 0, 1.55, 1.04, .2, .27, .06); mouth.userData.noOutline = true;
  for (const s of [-1, 1]) C.blush(body, HC, HR, s * .82, -.12, .18, .1, 0xffa0c8);
  const mkArm = s => { const pv = new T.Group(); pv.position.set(s * 1.1, 1.55, .25); body.add(pv); ell(pv, G.sph, sh2, s * .5, 0, .08, .55, .27, .27); pv.rotation.z = -s * .5; return pv; };
  const armL = mkArm(-1), armR = mkArm(1);
  const tail = ell(body, G.cone, sh2, 0, .35, -1.2, .3, .7, .3); tail.rotation.x = -Math.PI / 2 - .5;
  return { g, body, armL, armR, eyes, mouth, skirt, tail };
}
C.makeBoo = function () { const o = booParts(plain); C.outline(o.g, .05); o.bt = Math.random() * 3; return o; };

/* ---------------------------------------------------------------- Spinny Top */
function spinnyParts(mk) {
  const g = new T.Group(), spinner = new T.Group(), head = new T.Group(); g.add(spinner); g.add(head);
  const cols = [mk(0xff4f6a, { rim: 0xffd0d8, rimK: .25 }), mk(0xffd93a, { rim: 0xffffff, rimK: .25 }), mk(0x4fb8ff, { rim: 0xd0ecff, rimK: .25 })];
  const metal = mk(0xc8ccd8, { rim: 0xffffff }), wood = mk(0xc88a4a, { rim: 0xffe0b0 }, true);
  for (let i = 0; i < 3; i++) { const y = .35 + i * .5, r = .35 + i * .42; ell(spinner, G.cyl, cols[i], 0, y, 0, r, .52, r); }
  ell(spinner, G.cone, metal, 0, .1, 0, .22, .45, .22).rotation.x = Math.PI;
  const HC = [0, 2.35, 0], HR = [1.2, 1.0, 1.2];
  ell(head, G.sph, cols[2], HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(head, G.cyl, wood, 0, 3.4, 0, .1, .85, .1); ell(head, G.sphM, cols[0], 0, 3.9, 0, .28);
  const eyes = eyeSet(head, HC, HR, .5, .1, .24, .4, 0x1a2a5a);
  C.smile(head, HC, HR, 0, -.38, .14, 0x2a1a30); for (const s of [-1, 1]) C.blush(head, HC, HR, s * .9, -.2, .16, .09);
  return { g, spinner, head, eyes };
}
C.makeSpinny = function () { const o = spinnyParts(plain); C.outline(o.g, .05); o.bt = Math.random() * 3; return o; };

/* ---------------------------------------------------------------- Rexy (baby T-rex) */
function rexyParts(mk) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const gr = mk(0x6ad46a, { rim: 0xe0ffd0, rimK: .25 }), gd = mk(0x4aaa4a, { rim: 0xc0f0b0 }), cream = mk(0xfff0c0, { rim: 0xffffff }), wh = mk(0xffffff, { rim: 0xffffff }), ink = C.basic(0x4a1a2a);
  ell(body, G.sph, gr, 0, 1.55, -.1, 1.0, 1.0, 1.35); ell(body, G.sph, cream, 0, 1.2, .45, .7, .6, .75).userData.noOutline = true;
  const head = new T.Group(); head.position.set(0, 2.6, .95); body.add(head);
  const HC = [0, 0, 0], HR = [1.0, .9, 1.0];
  ell(head, G.sph, gr, 0, 0, 0, HR[0], HR[1], HR[2]);
  ell(head, G.sph, gr, 0, -.2, .75, .62, .45, .65);
  const eyes = eyeSet(head, HC, HR, .52, .38, .25, .45, 0x2a3a10);
  for (const s of [-1, 1]) { ell(head, G.sphS, gd, s * .2, -.05, 1.36, .07, .05, .05).userData.noOutline = true; ell(head, G.cone, wh, s * .3, -.5, 1.05, .09, .2, .09).rotation.x = Math.PI; }
  const mouth = ell(head, G.sphS, ink, 0, -.46, 1.1, .3, .09, .26); mouth.userData.noOutline = true; mouth.visible = false;
  for (const s of [-1, 1]) C.blush(head, HC, HR, s * .92, .0, .15, .09, 0xff9ab0);
  for (let i = 0; i < 5; i++) { const sp = ell(body, G.cone, cream, 0, 2.5 - i * .32, -.45 - i * .38, .2, .4 - i * .03, .2); sp.rotation.x = -.7 - i * .1; }
  const tail = new T.Group(); tail.position.set(0, 1.2, -1.25); body.add(tail);
  ell(tail, G.sph, gr, 0, 0, -.55, .62, .55, .85); const tail2 = new T.Group(); tail2.position.set(0, 0, -1.1); tail.add(tail2); ell(tail2, G.sph, gr, 0, 0, -.5, .42, .38, .65); ell(tail2, G.cone, cream, 0, 0, -1.2, .16, .38, .16).rotation.x = -Math.PI / 2; tail.tail2 = tail2;
  const mkArm = s => { const pv = new T.Group(); pv.position.set(s * .88, 1.55, .78); body.add(pv); ell(pv, G.sphM, gd, 0, -.2, .2, .17, .4, .17).rotation.x = .5; return pv; };
  const armL = mkArm(-1), armR = mkArm(1), legs = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .55, .85, -.1); body.add(pv); ell(pv, G.cyl, gr, 0, -.3, 0, .3, .75, .3); ell(pv, G.sphM, gd, 0, -.7, .25, .38, .22, .55); legs.push(pv); }
  return { g, body, head, tail, armL, armR, legs, eyes, mouth };
}
C.makeRexy = function () { const o = rexyParts(plain); C.outline(o.g, .05); o.bt = Math.random() * 3; return o; };

/* ---------------------------------------------------------------- Drizzle (grumpy rain cloud) */
function drizzleParts(mk) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const cl = mk(0xb4c4dc, { rim: 0xffffff, rimK: .35 }), cl2 = mk(0xa0b2cc, { rim: 0xf0f6ff, rimK: .3 }), drop = mk(0x5ab8ff, { rim: 0xd0ecff, rimK: .4 }, true);
  const HC = [0, 0, 0], HR = [1.7, 1.25, 1.2];
  ell(body, G.sph, cl, 0, 0, 0, HR[0], HR[1], HR[2]);
  const puffs = [[-1.45, -.3, 0, .8], [1.45, -.3, 0, .8], [-.8, .85, -.1, .85], [.8, .85, -.1, .85], [0, 1.1, -.2, .75], [-.4, -.85, -.1, .6], [.4, -.85, -.1, .6]];
  for (const [x, y, z, r] of puffs) ell(body, G.sph, cl2, x, y, z, r, r * .85, r * .9);
  const eyes = eyeSet(body, HC, HR, .38, .1, .25, .38, 0x2a3a6a);
  C.frown(body, HC, HR, 0, -.36, .13, 0x2a3050); for (const s of [-1, 1]) C.blush(body, HC, HR, s * .72, -.14, .2, .1, 0xff9ac0);
  const drops = [];
  for (let i = 0; i < 3; i++) { const d = new T.Group(); d.position.set((i - 1) * .9, -1.6, .2); body.add(d); ell(d, G.cone, drop, 0, .15, 0, .22, .5, .22); ell(d, G.sphM, drop, 0, -.12, 0, .22); d.userData.ph = i * 2.1; drops.push(d); }
  return { g, body, puffs, drops, eyes };
}
C.makeDrizzle = function () { const o = drizzleParts(plain); C.outline(o.g, .05); o.bt = Math.random() * 3; return o; };

/* ---------------------------------------------------------------- Gummy Bear (jelly) */
const GUMMY = [0xff3a4a, 0x4aff7a, 0xffa02a, 0xffe03a, 0xb06aff, 0x3ac8ff];
function gummyParts(mk, col) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const j = mk(col, { rim: 0xffffff, rimK: .55, emissive: new T.Color(col).multiplyScalar(.28).getHex() }), jd = mk(col, { rim: 0xffffff, rimK: .4, emissive: new T.Color(col).multiplyScalar(.18).getHex() });
  ell(body, G.sph, j, 0, 1.05, 0, .95, 1.05, .8);
  const HC = [0, 2.3, .05], HR = [.82, .76, .74];
  ell(body, G.sph, j, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  for (const s of [-1, 1]) ell(body, G.sphM, jd, s * .62, 2.9, -.05, .3, .3, .2);
  ell(body, G.sphM, jd, 0, 2.15, .62, .3, .22, .22);
  const eyes = eyeSet(body, HC, HR, .5, .2, .17, .32, 0x2a1a10);
  C.smile(body, HC, HR, 0, -.5, .1, 0x3a1a20);
  const shine = ell(body, G.sphS, C.basic(0xffffff), -.35, 2.65, .5, .13, .2, .06); shine.userData.noOutline = true; shine.material = C.basic(0xffffff);
  const mkArm = s => { const pv = new T.Group(); pv.position.set(s * .95, 1.5, .1); body.add(pv); ell(pv, G.sphM, jd, s * .3, -.2, 0, .28, .52, .28).rotation.z = s * .5; return pv; };
  const armL = mkArm(-1), armR = mkArm(1), legs = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .45, .5, 0); body.add(pv); ell(pv, G.sphM, jd, 0, -.1, .08, .38, .5, .4); legs.push(pv); }
  return { g, body, armL, armR, legs, eyes };
}
C.makeGummy = function (col) { const o = gummyParts(plain, col == null ? GUMMY[(Math.random() * GUMMY.length) | 0] : col); C.outline(o.g, .05); o.bt = Math.random() * 3; return o; };
C.GUMMY_COLS = GUMMY;

/* =====================================================================  BOSSES 12 – 17 */
const HUE = [0, .08, .16, .5, .7];
const tint = (hex, tier) => { const c = new T.Color(hex), h = {}; c.getHSL(h); c.setHSL((h.h + HUE[tier % 5]) % 1, h.s, h.l); return c.getHex(); };
const prevBoss = C.makeBoss;
C.makeBoss = function (type, tier) {
  if (type < 12) return prevBoss(type, tier);
  const g = new T.Group(), mats = [], eyes = [];
  /* unique, tinted, flash-able toon material; 3rd arg `true` = keep the colour untinted */
  const M = (hex, o, keep) => { o = Object.assign({ unique: true, rim: 0xffffff, rimK: .2 }, o || {}); const m = tn(keep || o.notint ? hex : tint(hex, tier), o); mats.push(m); return m; };
  const K = (hex, o) => M(hex, o, true);
  const out = { g, mats, eyes, blade: null, floatY: 0, tick: null };
  const grow = (o, s) => { o.g.scale.setScalar(s); g.add(o.g); eyes.push(...o.eyes); };
  if (type === 12) {                                   // ---- Captain Crabby
    const o = crabbyParts((h, op, keep) => keep ? K(h, op) : M(h, op)); grow(o, 2.3); out.parts = o;
    const hat = new T.Group(); hat.position.set(0, 4.25, -1.5); hat.rotation.x = -.25; hat.scale.setScalar(1.25); g.add(hat);
    const blk = K(0x2a2030, { rim: 0x8a80a0 }), gold = K(0xffd23a, { emissive: 0x6a4a00 }), wh = K(0xfff8ee);
    ell(hat, G.sph, blk, 0, .1, 0, 1.9, .55, 1.6); ell(hat, G.sphM, blk, 0, .55, 1.55, 1.5, .4, .45); for (const s of [-1, 1]) ell(hat, G.sphM, blk, s * 1.55, .45, 0, .6, .38, 1.2).rotation.z = -s * .5;
    ell(hat, G.cyl, gold, 0, .02, 0, 1.2, .1, .95); ell(hat, G.sphM, wh, 0, .75, 1.95, .55, .5, .1);
    for (const k of [-1, 1]) ell(hat, G.cyl, wh, 0, .75, 1.98, .08, .95, .08).rotation.z = k * .9;
    out.cy = 2.4;
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5, sn = Math.sin(t * 5 * w); o.open(o.clawL, .1 + Math.max(0, sn) * .55); o.open(o.clawR, .1 + Math.max(0, -sn) * .55); o.clawL.rotation.y = Math.sin(t * 2.4) * .18; o.clawR.rotation.y = -Math.sin(t * 2.4 + 1) * .18; o.legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 12 * w + i) * .22; }); hat.position.y = 4.25 + Math.sin(t * 3) * .06; };
  } else if (type === 13) {                            // ---- Boo King
    const o = booParts((h, op, keep) => keep ? K(h, op) : M(h, op)); grow(o, 2.4); out.parts = o;
    const crown = new T.Group(); crown.position.set(0, 7.45, 0); crown.scale.setScalar(1.35); g.add(crown);
    const gold = K(0xffd23a, { emissive: 0x6a4a00 }), jew = K(0xe8283c), jew2 = K(0x3aa0ff);
    ell(crown, G.cyl, gold, 0, 0, 0, 1.25, .5, 1.25); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(crown, G.cone, gold, Math.cos(a) * 1.05, .75, Math.sin(a) * 1.05, .26, .9, .26); ell(crown, G.sphS, i % 2 ? jew : jew2, Math.cos(a) * 1.05, 1.28, Math.sin(a) * 1.05, .17); }
    ell(crown, G.sphM, jew, 0, .3, 1.25, .26);
    out.floatY = 1.6; out.cy = 3.2; out.parts.mouth.scale.set(.2, .3, .06);
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5; o.armL.rotation.z = .5 + Math.sin(t * 3 * w) * .45; o.armR.rotation.z = -.5 - Math.sin(t * 3 * w + 1) * .45; o.skirt.forEach((s, i) => { s.scale.y = .55 + Math.sin(t * 5 + i) * .12; }); o.tail.rotation.z = Math.sin(t * 4) * .3; crown.rotation.y = Math.sin(t * 1.6) * .25; };
  } else if (type === 14) {                            // ---- Rex the Roar
    const o = rexyParts((h, op, keep) => keep ? K(h, op) : M(h, op)); grow(o, 2.35); out.parts = o;
    out.cy = 3.3;
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5, roar = Math.max(0, Math.sin(t * 1.9 * w)); o.head.rotation.x = -roar * .5; o.mouth.visible = roar > .25; o.mouth.scale.set(.3, .09 + roar * .22, .26); o.tail.rotation.y = Math.sin(t * 3.2 * w) * .55; o.tail.tail2.rotation.y = Math.sin(t * 3.2 * w - .8) * .5; o.armL.rotation.x = Math.sin(t * 6) * .3; o.armR.rotation.x = -Math.sin(t * 6) * .3; o.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 7 * w + i * Math.PI) * .35; }); };
  } else if (type === 15) {                            // ---- Sundae Sam
    const glass = K(0xcfeeff, { rim: 0xffffff, rimK: .5, opacity: .78, double: true }), cream = M(0xfff4e0), straw = M(0xff6ab0), choc = M(0x7a4a2a), mint = M(0x7af0c0), cherry = K(0xe8283c), wafer = K(0xe8c07a), sauce = M(0xff7aa8);
    const cup = new T.Group(); g.add(cup);
    ell(cup, G.cyl, glass, 0, .12, 0, 1.4, .24, 1.4); ell(cup, G.cyl, glass, 0, .75, 0, .22, 1.1, .22); ell(cup, new T.CylinderGeometry(1, .5, 1, 20), glass, 0, 2.2, 0, 2.5, 1.9, 2.5);
    ell(cup, new T.CylinderGeometry(1, .5, 1, 20), sauce, 0, 2.2, 0, 2.3, 1.75, 2.3).userData.noOutline = true;
    const SC = [0, 3.65, 0], SR = [2.4, 1.55, 2.4];
    ell(g, G.sph, cream, SC[0], SC[1], SC[2], SR[0], SR[1], SR[2]);
    ell(g, G.sph, choc, -1.5, 3.45, -.6, 1.3, 1.0, 1.3); ell(g, G.sph, mint, 1.55, 3.5, -.5, 1.25, .95, 1.25);
    for (const s of [-1, 1]) { const e = C.headEye(g, SC, SR, s * .36, .05, .5, { iris: 0x5a2a20 }); eyes.push(e); const b = C.brow(g, 0, 0, 0, .62, s * .45); C.onSurface(b, SC, SR, s * .34, .55, .01); b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(AX, s * .45)); C.blush(g, SC, SR, s * .8, -.25, .36, .2, 0xff9ab0); }
    C.frown(g, SC, SR, 0, -.4, .46, 0x5a1a2a);
    const top = new T.Group(); top.position.set(0, 5.2, 0); g.add(top);
    ell(top, G.sph, cream, 0, 0, 0, 1.3, .75, 1.3); ell(top, G.sphM, cherry, 0, .85, 0, .5); ell(top, G.cyl, straw, .3, .8, 0, .06, .8, .06).rotation.z = -.5;
    ell(g, G.box, wafer, 2.3, 4.7, .3, .3, 2.4, .9).rotation.z = -.3; ell(g, G.box, wafer, -2.3, 4.8, .3, .3, 2.1, .9).rotation.z = .35;
    out.cy = 3.1;
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5; top.scale.set(1 + Math.sin(t * 3) * .04 * w, 1 - Math.sin(t * 3) * .05 * w, 1 + Math.sin(t * 3) * .04 * w); top.rotation.y += dt * 1.2; cup.rotation.y = Math.sin(t * 2) * .08; };
  } else if (type === 16) {                            // ---- Teddy Titan
    const br = M(0xc88a52, { rim: 0xffe0b8, rimK: .25 }), brd = M(0xa86a38, { rim: 0xffd0a0 }), cr = M(0xffe0b8, { rim: 0xffffff }), pa = K(0xff6ab0), but = K(0xffd23a, { emissive: 0x6a4a00 });
    const body = new T.Group(); g.add(body);
    ell(body, G.sph, br, 0, 2.6, 0, 2.4, 2.5, 2.0); ell(body, G.sph, cr, 0, 2.3, 1.3, 1.5, 1.7, 1.0).userData.noOutline = true;
    ell(body, G.sph, pa, 1.1, 3.1, 1.9, .55, .55, .12).rotation.z = .5; ell(body, G.sphM, but, 1.1, 3.1, 2.0, .16).userData.noOutline = true;
    const HC = [0, 5.8, .1], HR = [1.9, 1.7, 1.7];
    ell(body, G.sph, br, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
    for (const s of [-1, 1]) { ell(body, G.sph, br, s * 1.5, 7.0, -.1, .75, .75, .45); ell(body, G.sph, brd, s * 1.5, 7.0, .15, .42, .42, .2).userData.noOutline = true; }
    ell(body, G.sph, cr, 0, 5.3, 1.3, .85, .65, .65); ell(body, G.sphM, K(0x3a2a30, { rim: 0 }), 0, 5.55, 1.85, .28, .2, .2);
    for (const s of [-1, 1]) { const e = C.headEye(body, HC, HR, s * .42, .2, .4, { iris: 0x2a1a10 }); eyes.push(e); const b = C.brow(body, 0, 0, 0, .55, s * .45); C.onSurface(b, HC, HR, s * .36, .66, .01); b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(AX, s * .45)); C.blush(body, HC, HR, s * .85, -.22, .3, .17, 0xff9ab0); }
    C.frown(body, HC, HR, 0, -.5, .36, 0x4a1a2a);
    const mkArm = s => { const pv = new T.Group(); pv.position.set(s * 2.3, 3.8, 0); body.add(pv); ell(pv, G.sph, br, s * .9, 0, 0, 1.3, .7, .7); ell(pv, G.sph, cr, s * 1.9, 0, 0, .65, .6, .6).userData.noOutline = true; return pv; };
    const armL = mkArm(-1), armR = mkArm(1);
    for (const s of [-1, 1]) { ell(body, G.sph, br, s * 1.25, .6, .3, 1.0, .9, 1.2); ell(body, G.sph, cr, s * 1.25, .5, 1.1, .6, .5, .4).userData.noOutline = true; }
    out.cy = 3.4;
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5; armL.rotation.z = Math.sin(t * 2.6 * w) * .35 + .15; armR.rotation.z = -Math.sin(t * 2.6 * w + 1.3) * .35 - .15; armL.rotation.x = Math.sin(t * 2.6 * w) * .4; armR.rotation.x = -Math.sin(t * 2.6 * w + 1.3) * .4; body.rotation.z = Math.sin(t * 2.2 * w) * .035; };
  } else {                                             // ---- 17 Professor Hoot
    const br = M(0x8a6a4a, { rim: 0xffe0b8, rimK: .25 }), lt = M(0xe8c89a, { rim: 0xffffff }), wg = M(0x6a4a30, { rim: 0xffd0a0 }), og = K(0xffa02a), wh = K(0xffffff), blk = K(0x2a2030, { rim: 0x8a80a0 }), gold = K(0xffd23a, { emissive: 0x6a4a00 });
    const body = new T.Group(); g.add(body);
    const BC = [0, 3.0, 0], BR = [2.5, 3.0, 2.2];
    ell(body, G.sph, br, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]); ell(body, G.sph, lt, 0, 2.6, 1.15, 1.6, 2.0, 1.2).userData.noOutline = true;
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) ell(body, G.sphS, br, s * (.5 + (i % 2) * .5), 3.4 - i * .55, 2.05, .2, .09, .06).userData.noOutline = true;
    const HC = [0, 5.4, .75], HR = [2.1, 1.0, 1.15];
    for (const s of [-1, 1]) {
      ell(body, G.sph, wh, s * .9, 5.6, 1.45, .98, .98, .22);
      const e = C.eye(.62, { iris: 0x2a1a10, white: 0xfff8d0 }); e.position.set(s * .9, 5.6, 1.62); body.add(e); eyes.push(e);
      const rim = new T.Mesh(G.tor, gold); rim.scale.set(1.12, 1.12, 1.12); rim.position.set(s * .9, 5.6, 1.62); body.add(rim);
      C.brow(body, s * .9, 6.55, 1.5, .8, s * .4);
    }
    ell(body, G.cyl, gold, 0, 5.6, 1.64, .22, .08, .06).rotation.z = Math.PI / 2;
    ell(body, G.cone, og, 0, 4.9, 2.15, .3, .85, .3).rotation.x = Math.PI / 2 + .35;
    const cap = new T.Group(); cap.position.set(0, 7.1, 0); body.add(cap);
    ell(cap, G.box, blk, 0, 0, 0, 3.4, .22, 3.4); ell(cap, G.cyl, blk, 0, -.3, 0, 1.3, .55, 1.3); ell(cap, G.cyl, gold, 1.7, -.7, 1.7, .06, 1.4, .06); ell(cap, G.sphM, gold, 1.7, -1.5, 1.7, .22);
    const mkWing = s => { const pv = new T.Group(); pv.position.set(s * 2.35, 4.0, -.1); body.add(pv); ell(pv, G.sph, wg, s * .5, -1.2, 0, .6, 2.3, 1.0).rotation.z = s * .25; return pv; };
    const wingL = mkWing(-1), wingR = mkWing(1);
    for (const s of [-1, 1]) { ell(body, G.cone, og, s * .8, .12, 1.0, .3, .5, .55).rotation.x = Math.PI / 2; ell(body, G.cone, og, s * 1.2, .12, 1.0, .3, .5, .55).rotation.x = Math.PI / 2; }
    for (const s of [-1, 1]) ell(body, G.cone, br, s * 1.35, 7.0, -.3, .4, 1.1, .4);
    out.floatY = 1.2; out.cy = 3.5; out.parts = { body, wingL, wingR };
    out.tick = (dt, t, phase) => { const w = 1 + (phase - 1) * .5, f = Math.sin(t * 6 * w); wingL.rotation.z = .15 + f * .35; wingR.rotation.z = -.15 - f * .35; body.rotation.z = Math.sin(t * 1.8) * .04; cap.rotation.y = Math.sin(t * 1.3) * .15; };
  }
  C.outline(g, .1);
  return out;
};

/* =====================================================================  PALS (farm animals for the celebration crowd) */
const pk = gold => (c, o) => gold ? tn(0xffd23a, Object.assign({ emissive: 0x6a4600, rim: 0xfff2b0 }, o || {})) : tn(c, Object.assign({ rim: 0xffffff, rimK: .16 }, o || {}));
const pleg = (parent, x, z, mat, h, r, y0) => { const pv = new T.Group(); pv.position.set(x, y0 == null ? h : y0, z); ell(pv, G.cyl, mat, 0, -h * .48, 0, r, h * .85, r); ell(pv, G.sphM, mat, 0, -h * .06, 0, r * 1.05, h * .22, r * 1.05); parent.add(pv); return pv; };
const pface = (g, c, rad, eaz, eel, er, iris) => { const eyes = []; for (const s of [-1, 1]) { eyes.push(C.headEye(g, c, rad, s * eaz, eel, er, { iris })); C.blush(g, c, rad, s * .98, -.22, .13, .08); } return eyes; };
const PALS = {};
PALS.elephant = function (gold) {
  const K = pk(gold), g = new T.Group(), gr = K(0xaab8d0), pk2 = K(0xffb0c8), wh = K(0xffffff);
  ell(g, G.sph, gr, 0, 1.05, 0, .9, .85, 1.1);
  const HC = [0, 1.55, .85], HR = [.62, .6, .55]; ell(g, G.sph, gr, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const eyes = pface(g, HC, HR, .5, .2, .15);
  const trunk = new T.Group(); trunk.position.set(0, 1.4, 1.3); g.add(trunk); ell(trunk, G.cyl, gr, 0, -.3, .2, .16, .8, .16).rotation.x = .35; ell(trunk, G.sphM, gr, 0, -.72, .38, .17, .14, .17);
  const ears = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .55, 1.6, .65); pv.rotation.z = s * -.4; pv.userData.rz = s * -.4; ell(pv, G.sph, gr, s * .38, 0, 0, .42, .5, .09); ell(pv, G.sph, pk2, s * .38, 0, .06, .26, .34, .05).userData.noOutline = true; g.add(pv); ears.push(pv); }
  for (const s of [-1, 1]) ell(g, G.cone, wh, s * .26, 1.15, 1.35, .06, .3, .06).rotation.x = Math.PI / 2 + .3;
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => pleg(g, sx * .5, sz * .6, gr, .6, .24));
  const tail = new T.Group(); tail.position.set(0, 1.1, -1.1); ell(tail, G.cyl, gr, 0, -.2, -.05, .05, .5, .05); g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears, tail, trunk, body: g };
};
PALS.owl = function (gold) {
  const K = pk(gold), g = new T.Group(), br = K(0x9a7a5a), lt = K(0xf0d8b0), og = K(0xffa02a), wh = K(0xffffff);
  const BC = [0, 1.1, 0], BR = [.85, 1.05, .8]; ell(g, G.sph, br, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]); ell(g, G.sph, lt, 0, .95, .45, .55, .7, .4).userData.noOutline = true;
  const eyes = []; for (const s of [-1, 1]) { ell(g, G.sph, wh, s * .38, 1.5, .6, .38, .38, .14); const e = C.eye(.24, { iris: 0x3a2a10 }); e.position.set(s * .38, 1.5, .72); g.add(e); eyes.push(e); }
  ell(g, G.cone, og, 0, 1.28, .82, .14, .3, .14).rotation.x = Math.PI / 2 + .3;
  const ears = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .55, 2.05, .1); pv.userData.rz = s * .25; pv.rotation.z = s * .25; ell(pv, G.cone, br, 0, .2, 0, .2, .5, .16); g.add(pv); ears.push(pv); }
  const wings = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .8, 1.2, 0); ell(pv, G.sph, K(0x7a5a3a), s * .12, -.2, 0, .18, .65, .45); g.add(pv); wings.push(pv); }
  const legs = [-1, 1].map(s => { const pv = new T.Group(); pv.position.set(s * .3, .3, .2); ell(pv, G.cyl, og, 0, -.1, 0, .06, .3, .06); ell(pv, G.sphM, og, 0, -.26, .1, .17, .06, .22); g.add(pv); return pv; });
  const tail = new T.Group(); tail.position.set(0, .5, -.7); ell(tail, G.cone, br, 0, 0, -.2, .25, .55, .1).rotation.x = -Math.PI / 2 - .4; g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears, tail, wings, body: g };
};
PALS.turtle = function (gold) {
  const K = pk(gold), g = new T.Group(), gr = K(0x6ac86a), sh = K(0x8a6a3a), shl = K(0xc8a060), sk = K(0x9ad88a);
  ell(g, G.sph, sh, 0, .85, -.1, 1.0, .72, 1.1); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(g, G.sphM, shl, Math.sin(a) * .5, 1.3, Math.cos(a) * .5 - .1, .26, .1, .26).userData.noOutline = true; } ell(g, G.sphM, shl, 0, 1.4, -.1, .28, .1, .28).userData.noOutline = true;
  const HC = [0, 1.0, 1.2], HR = [.48, .46, .5]; ell(g, G.sph, sk, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const eyes = pface(g, HC, HR, .5, .2, .14); C.smile(g, HC, HR, 0, -.35, .1, 0x2a3a20);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => pleg(g, sx * .62, sz * .65, sk, .4, .2));
  const tail = new T.Group(); tail.position.set(0, .5, -1.1); ell(tail, G.cone, sk, 0, 0, -.2, .12, .35, .12).rotation.x = -Math.PI / 2; g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears: [], tail, body: g };
};
PALS.lion = function (gold) {
  const K = pk(gold), g = new T.Group(), fur = K(0xf0b860), mane = K(0xc8742a), cr = K(0xffe8c0), nose = K(0xe8708a);
  ell(g, G.sph, fur, 0, .95, -.1, .72, .66, .95);
  const HC = [0, 1.45, .78], HR = [.58, .54, .5];
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ell(g, G.sph, mane, Math.sin(a) * .62, 1.45 + Math.cos(a) * .55, .6, .3, .3, .28); }
  ell(g, G.sph, mane, 0, 1.45, .6, .7, .66, .4); ell(g, G.sph, fur, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(g, G.sph, cr, 0, 1.28, 1.15, .28, .2, .2); ell(g, G.sphS, nose, 0, 1.38, 1.3, .09, .06, .06);
  const eyes = pface(g, HC, HR, .5, .2, .15); C.smile(g, HC, HR, 0, -.5, .08, 0x5a2a30);
  const ears = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .5, 1.95, .7); pv.userData.rz = s * .2; pv.rotation.z = s * .2; ell(pv, G.sphM, fur, 0, 0, 0, .2, .2, .12); g.add(pv); ears.push(pv); }
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => pleg(g, sx * .42, sz * .55, fur, .5, .15));
  const tail = new T.Group(); tail.position.set(0, 1.0, -1.0); ell(tail, G.cyl, fur, 0, 0, -.35, .05, .8, .05).rotation.x = Math.PI / 2; ell(tail, G.sphM, mane, 0, 0, -.8, .18); g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears, tail, body: g };
};
PALS.koala = function (gold) {
  const K = pk(gold), g = new T.Group(), gr = K(0xb4b8c4), lt = K(0xf0f0f4), nose = K(0x3a3040, { rim: 0xa090b0 }), pk2 = K(0xffb0c8);
  ell(g, G.sph, gr, 0, 1.0, 0, .8, .78, .78); ell(g, G.sph, lt, 0, .9, .4, .5, .55, .4).userData.noOutline = true;
  const HC = [0, 1.62, .35], HR = [.7, .62, .6]; ell(g, G.sph, gr, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const ears = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .6, 1.98, .3); pv.userData.rz = s * .1; ell(pv, G.sph, gr, 0, 0, 0, .34, .34, .15); ell(pv, G.sph, pk2, 0, 0, .1, .2, .2, .06).userData.noOutline = true; g.add(pv); ears.push(pv); }
  ell(g, G.sph, nose, 0, 1.55, .92, .2, .27, .14);
  const eyes = pface(g, HC, HR, .52, .25, .14); C.smile(g, HC, HR, 0, -.48, .08, 0x3a2a30);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => pleg(g, sx * .45, sz * .35, gr, .5, .15));
  const tail = new T.Group(); tail.position.set(0, .8, -.8); ell(tail, G.sphM, lt, 0, 0, -.05, .18); g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears, tail, body: g };
};
PALS.dino = function (gold) {
  const K = pk(gold), g = new T.Group(), gr = K(0x7ad87a), cr = K(0xfff0c0), sp = K(0xff9a4a);
  ell(g, G.sph, gr, 0, 1.0, 0, .75, .75, 1.0); ell(g, G.sph, cr, 0, .8, .35, .5, .5, .55).userData.noOutline = true;
  const HC = [0, 1.7, .75], HR = [.6, .56, .6]; ell(g, G.sph, gr, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]); ell(g, G.sph, gr, 0, 1.55, 1.2, .34, .26, .34);
  const eyes = pface(g, HC, HR, .5, .3, .15); C.smile(g, HC, HR, 0, -.45, .08, 0x2a4a20);
  for (let i = 0; i < 4; i++) ell(g, G.cone, sp, 0, 1.8 - i * .22, -.1 - i * .3, .14, .3, .14).rotation.x = -.5;
  const legs = [-1, 1].map(s => pleg(g, s * .4, .0, gr, .55, .2, .55));
  const tail = new T.Group(); tail.position.set(0, 1.0, -.85); ell(tail, G.cone, gr, 0, 0, -.6, .32, 1.3, .32).rotation.x = -Math.PI / 2; g.add(tail);
  const ears = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .55, 1.1, .3); ell(pv, G.sphM, gr, s * .1, -.3, 0, .1, .3, .1).rotation.x = .6; g.add(pv); }
  C.outline(g, .05); return { g, eyes, legs, ears, tail, body: g };
};
C.NEW_PALS = Object.keys(PALS);
const prevCritter = C.makeCritter;
C.makeCritter = function (sp, gold) {
  if (!PALS[sp]) return prevCritter(sp, gold);
  const b = PALS[sp](gold); b.sp = sp; b.bt = Math.random() * 3; b.hopS = 0;
  if (gold) { const r = new T.Mesh(new T.TorusGeometry(.55, .06, 8, 24), C.basic(0xffe45c)); r.rotation.x = Math.PI / 2; r.position.y = 2.7; r.userData.noOutline = true; b.g.add(r); b.halo = r; }
  return b;
};
})();
