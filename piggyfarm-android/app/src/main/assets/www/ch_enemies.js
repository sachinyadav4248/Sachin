/* =====================================================================
   ENEMIES & HAZARDS – grumpy-cute, never scary
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell, tn = C.toon;
const eyeSet = (g, c, r, az, el, er, tilt, iris) => {
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(C.headEye(g, c, r, s * az, el, er, { iris }));
    if (tilt != null) { const b = C.brow(g, 0, 0, 0, er * 1.25, s * tilt); C.onSurface(b, c, r, s * (az - .05), el + .5, .01); b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), s * tilt)); }
  }
  return eyes;
};

/* ---- grumpy shroom (the "goomba") */
C.makeShroom = function () {
  const g = new T.Group(), cap = tn(0x9a5ad8, { rim: 0xe0c0ff, rimK: .22 }), cream = tn(0xffeccc, { rim: 0xffffff }), spot = tn(0xffd2e6, { rim: 0xffffff }), dk = tn(0x4a2a4a, { rim: 0xb090c0 });
  const SC = [0, .62, 0], SR = [.64, .66, .62];
  ell(g, G.sph, cream, SC[0], SC[1], SC[2], SR[0], SR[1], SR[2]);
  const head = new T.Group(); head.position.y = 1.15; g.add(head);
  const HC = [0, .22, 0], HR = [1.12, .84, 1.12];
  ell(head, G.sph, cap, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  for (const [az, el, r] of [[0, 1.2, .3], [.9, .6, .24], [-.9, .55, .26], [2.3, .7, .26], [-2.2, .65, .24], [3.1, .6, .22], [1.6, .9, .2], [-1.6, .85, .2]]) { const sp = new T.Mesh(G.sphM, spot); sp.scale.set(r, r, .05); C.onSurface(sp, HC, HR, az, el, -.015); sp.userData.noOutline = true; head.add(sp); }
  C.shine(head, HC, HR, -.5, .75, .3, .14, .4);
  const eyes = eyeSet(g, SC, SR, .5, .22, .2, -.5);
  C.frown(g, SC, SR, 0, -.32, .13);
  const feet = [-1, 1].map(s => ell(g, G.sphM, dk, s * .42, .17, .2, .32, .2, .5));
  C.outline(g, .05); return { g, head, feet, eyes, bt: Math.random() * 3 };
};

/* ---- jelly slime */
C.makeSlime = function (size) {
  const g = new T.Group(), big = size === 2, sc = big ? 1.35 : .8;
  const col = big ? 0x4bd86a : 0x8af09a, jm = tn(col, { unique: true, opacity: .9, rim: 0xe0ffe8, rimK: .35 });
  const BC = [0, .85 * sc, 0], BR = [1.05 * sc, .82 * sc, 1.05 * sc];
  ell(g, G.sph, jm, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  const core = ell(g, G.sphM, tn(col, { unique: true, rim: 0 }), 0, .55 * sc, -.1, .5 * sc, .3 * sc, .5 * sc); core.material.color.multiplyScalar(.85); C.noOl(core);
  C.shine(g, BC, BR, -.5, .8, .28 * sc, .15 * sc, .55);
  const eyes = [];
  for (const s of [-1, 1]) { eyes.push(C.headEye(g, BC, BR, s * .45, .22, .24 * sc)); C.blush(g, BC, BR, s * .85, -.15, .14 * sc, .08 * sc); }
  const m = new T.Mesh(new T.TorusGeometry(1, .14, 8, 14, Math.PI), C.basic(0x1d6a2e)); m.scale.set(.2 * sc, .16 * sc, .2 * sc); C.onSurface(m, BC, BR, 0, -.12, -.01); m.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI)); m.userData.noOutline = true; g.add(m);
  C.outline(g, .05); return { g, eyes, mat: jm, sc };
};

/* ---- fluffy bat */
function wingShape(len, hgt) {
  const sh = new T.Shape(); sh.moveTo(0, .25 * hgt); sh.quadraticCurveTo(len * .4, hgt * 1.1, len, hgt * .55);
  sh.lineTo(len * .82, hgt * .1); sh.lineTo(len * .86, -hgt * .28); sh.lineTo(len * .6, -hgt * .02); sh.lineTo(len * .55, -hgt * .5); sh.lineTo(len * .3, -hgt * .1); sh.lineTo(0, -hgt * .3); sh.closePath();
  return new T.ShapeGeometry(sh, 8);
}
C.makeBat = function () {
  const g = new T.Group(), bm = tn(0x7a46c0, { rim: 0xd8b8ff, rimK: .22 }), wm = tn(0x5a30a0, { double: true, rim: 0xb090f0 }), pk = tn(0xff9ab8);
  const BC = [0, 0, 0], BR = [.68, .62, .62];
  ell(g, G.sph, bm, 0, 0, 0, BR[0], BR[1], BR[2]);
  const bel = ell(g, G.sphM, tn(0xb890f0), 0, -.12, .22, .42, .38, .3); C.noOl(bel);
  const eyes = eyeSet(g, BC, BR, .45, .2, .2, -.35, 0x3a2a6a);
  for (const s of [-1, 1]) { ell(g, G.cone, bm, s * .36, .62, .05, .2, .5, .13).rotation.z = -s * .25; ell(g, G.cone, pk, s * .36, .58, .1, .1, .3, .06).userData.noOutline = true; ell(g, G.cone, C.basic(0xffffff), s * .14, -.34, .52, .05, .15, .05).rotation.x = Math.PI; }
  const wings = {};
  for (const s of [-1, 1]) { const w = new T.Group(); w.position.set(s * .5, .1, 0); const m = new T.Mesh(wingShape(1.9, 1.0), wm); m.rotation.x = -Math.PI / 2; m.scale.x = s; w.add(m); g.add(w); wings[s] = w; }
  C.outline(g, .045); return { g, wings, eyes, wingL: wings[-1], wingR: wings[1] };
};

/* ---- mole with a tiny hard hat */
C.makeMole = function () {
  const g = new T.Group(), fur = tn(0x8a5a3a, { rim: 0xe0b090 }), hole = ell(g, G.cyl, tn(0x2a1a10, { rim: 0 }), 0, .05, 0, 1.7, .1, 1.7); hole.userData.noOutline = true;
  const body = new T.Group(); g.add(body);
  const BC = [0, 1.05, 0], BR = [.95, 1.05, .9];
  ell(body, G.sph, fur, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  const nose = ell(body, G.sphM, tn(0xff8fb0, { rim: 0xffffff }), 0, .98, .9, .3, .26, .28);
  const eyes = [];
  for (const s of [-1, 1]) { eyes.push(C.headEye(body, BC, BR, s * .5, .3, .16)); ell(body, G.sphM, tn(0xffd2a8), s * .86, .5, .55, .34, .2, .22); }
  C.smile(body, BC, BR, 0, -.12, .09, 0x2a1020);
  const hat = ell(body, G.sph, tn(0xffc928, { rim: 0xfff0a0 }), 0, 1.95, .05, .62, .38, .62); ell(body, G.cyl, tn(0xe8a800), 0, 1.78, .05, .8, .08, .8); ell(body, G.sphS, tn(0xfff7a0, { emissive: 0xaaa040 }), 0, 1.98, .55, .16);
  C.outline(g, .05); return { g, body, eyes };
};

/* ---- cartoon bomb buddy */
C.makeBomber = function () {
  const g = new T.Group(), bm = tn(0x2a2a3c, { unique: true, rim: 0x8a8ab8, rimK: .3 }), metal = tn(0x8a8aa0, { rim: 0xffffff });
  const BC = [0, 1.2, 0], BR = [1.02, 1.0, 1.0];
  ell(g, G.sph, bm, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  C.shine(g, BC, BR, -.55, .7, .3, .17, .5);
  ell(g, G.cyl, metal, 0, 2.2, 0, .34, .3, .34);
  const fuse = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 2.3, 0), new T.Vector3(.1, 2.65, 0), new T.Vector3(.3, 2.8, 0)]), 8, .06, 6), tn(0xc89a5a)); g.add(fuse);
  const spark = ell(g, G.sphM, tn(0xffc83a, { emissive: 0xffa010, rim: 0 }), .32, 2.85, 0, .22);
  const eyes = eyeSet(g, BC, BR, .45, .12, .24, -.45);
  C.frown(g, BC, BR, 0, -.3, .16);
  for (const s of [-1, 1]) ell(g, G.sphM, tn(0xff8a2a), s * .45, .25, .1, .28, .22, .4);
  C.outline(g, .05); return { g, bm, spark, eyes };
};

/* ---- naughty fox */
C.makeFox = function (col) {
  const g = new T.Group(), fm = tn(col, { unique: true, rim: 0xffe0c0, rimK: .2 }), wh = tn(0xfff6ec, { rim: 0xffffff }), dk = tn(0x3a2430, { rim: 0xa08090 });
  ell(g, G.sph, fm, 0, 1.0, 0, .72, .7, 1.12);
  const HC = [0, 1.45, 1.0], HR = [.64, .56, .56];
  ell(g, G.sph, fm, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  for (const s of [-1, 1]) { const ck = ell(g, G.sphM, wh, s * .46, 1.28, 1.28, .3, .22, .3); C.noOl(ck); }
  ell(g, G.sphM, wh, 0, 1.3, 1.5, .26, .2, .36);
  ell(g, G.sphS, C.basic(0x1a1018), 0, 1.36, 1.86, .1, .08, .07);
  const eyes = eyeSet(g, HC, HR, .52, .26, .15, -.55, 0x4a2a10);
  const ears = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .42, 1.9, .9); pv.rotation.z = s * -.2; ell(pv, G.cone, fm, 0, .22, 0, .26, .55, .15); ell(pv, G.cone, dk, 0, .3, .03, .17, .3, .09).userData.noOutline = true; g.add(pv); ears.push(pv); }
  const tail = new T.Group(); tail.position.set(0, 1.0, -1.0); g.add(tail);
  const tl = ell(tail, G.sph, fm, 0, .1, -.6, .36, .38, .85); tl.rotation.x = .3; ell(tail, G.sphM, wh, 0, .3, -1.35, .3, .3, .34);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const pv = new T.Group(); pv.position.set(sx * .4, .55, sz * .6); ell(pv, G.cyl, dk, 0, -.26, 0, .14, .5, .14); ell(pv, G.sphM, dk, 0, -.5, .05, .17, .1, .22); g.add(pv); return pv; });
  C.outline(g, .05); return { g, mat: fm, tail, legs, eyes, ears };
};

/* ---- spiky hedgehog roller */
C.makeHedgehog = function () {
  const g = new T.Group(), body = new T.Group(); g.add(body); const fur = tn(0x9a6a4a, { rim: 0xf0c8a0 }), cr = tn(0xffe0c0, { rim: 0xffffff }), sp = tn(0x5a3a3a, { rim: 0xc0a0a0 });
  const BC = [0, 1.0, 0], BR = [1.0, .95, 1.15];
  ell(body, G.sph, sp, 0, 1.0, -.15, 1.12, 1.05, 1.1);
  for (let i = 0; i < 26; i++) { const a = i * 2.399, y = 1 - (i + .5) / 26 * 1.25, r = Math.sqrt(Math.max(0, 1 - y * y)); const c = new T.Mesh(G.cone, sp); c.position.set(Math.cos(a) * r * 1.0, 1.0 + y * .98 + .1, -.2 - Math.abs(Math.sin(a)) * r * .6 - .1); c.scale.set(.14, .55, .14); c.lookAt(c.position.x * 3, c.position.y * 3 - 1.6, c.position.z * 3 - .6); c.rotateX(Math.PI / 2); c.userData.noOutline = true; body.add(c); }
  const HC = [0, .85, .85], HR = [.62, .55, .6];
  ell(body, G.sph, cr, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(body, G.sphS, C.basic(0x2a1820), 0, .92, 1.42, .1, .09, .08);
  const eyes = eyeSet(body, HC, HR, .5, .25, .15, -.5, 0x2a1820);
  for (const s of [-1, 1]) ell(body, G.sphM, cr, s * .5, 1.25, .6, .17, .17, .1);
  const feet = [-1, 1].map(s => ell(body, G.sphM, cr, s * .4, .17, .6, .22, .17, .3));
  C.outline(g, .05); return { g, body, eyes, feet };
};

/* ---- roaming hazards: mower, rolling ball, crab, ghost, ufo */
C.makeHazard = function (kind, col) {
  const g = new T.Group(); let blade = null, roll = null, rad = 1.5, fl = 0, eyes = [];
  if (kind === 'mower') {
    const red = tn(0xe03a2e, { rim: 0xffb0a0 }), gr = tn(0x5a6068, { rim: 0xd0d8e0 }), bk = tn(0x2a2a32, { rim: 0x8a8a9a });
    const BC = [0, 1.05, 0], BR = [1.15, .72, 1.5];
    ell(g, G.sph, red, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
    ell(g, G.sph, gr, 0, 1.75, -.5, .6, .35, .6); ell(g, G.cyl, bk, 0, 2.0, -.5, .2, .35, .2);
    eyes = eyeSet(g, BC, BR, .45, .3, .24, -.5);
    const mouth = ell(g, G.sphM, C.basic(0x4a0a14), 0, .85, 1.45, .45, .17, .1); C.noOl(mouth); for (const k of [-.28, -.09, .1, .29]) { const t = ell(g, G.sphS, C.basic(0xffffff), k, .93, 1.52, .07, .08, .04); C.noOl(t); }
    blade = ell(g, G.box, tn(0xd4d8e0, { rim: 0xffffff }), 0, .38, 1.55, 2.5, .08, .28);
    for (const [x, z, r] of [[-1.25, 1, .52], [1.25, 1, .52], [-1.25, -1, .62], [1.25, -1, .62]]) { const w = ell(g, G.cyl, bk, x, r, z, r, .24, r); w.rotation.z = Math.PI / 2; ell(g, G.cyl, tn(0xffd23a), x + Math.sign(x) * .13, r, z, r * .45, .1, r * .45).rotation.z = Math.PI / 2; }
    const hnd = ell(g, G.cyl, tn(0xb0b4bc), 0, 1.9, -1.2, .06, 1.2, .06); hnd.rotation.x = .9;
    rad = 1.9;
  } else if (kind === 'ball') {
    const bm = tn(col, { unique: true, rim: 0xffffff, rimK: .25 });
    roll = ell(g, G.sph, bm, 0, 1.5, 0, 1.5);
    for (const [x, y, z] of [[.9, 1.0, .1], [-.8, -.3, .9], [.2, -1.0, -.8], [-.5, .8, -.9], [.8, -.4, -.9]]) { const sp = ell(roll, G.sphM, tn(0xffffff, { rim: 0xffffff }), x, y, z, .28); sp.userData.noOutline = true; }
    const f = new T.Group(); g.add(f); f.position.set(0, 1.5, 0);
    eyes = eyeSet(f, [0, 0, 0], [1.52, 1.52, 1.52], .42, .22, .3, -.5);
    C.frown(f, [0, 0, 0], [1.52, 1.52, 1.52], 0, -.3, .22);
    rad = 1.6;
  } else if (kind === 'crab') {
    const cm = tn(col, { rim: 0xffc0a0 }), BC = [0, 1.0, 0], BR = [1.5, .85, 1.1];
    ell(g, G.sph, cm, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
    for (const s of [-1, 1]) {
      ell(g, G.sph, cm, s * 1.95, 1.25, .6, .6, .5, .5); ell(g, G.sphM, cm, s * 2.4, 1.55, .7, .3, .3, .28);
      ell(g, G.cyl, cm, s * .5, 1.85, .55, .09, .5, .09); const e = C.eye(.27); e.position.set(s * .5, 2.2, .55); g.add(e); eyes.push(e);
      for (let k = 0; k < 3; k++) { const l = ell(g, G.cyl, cm, s * 1.55, .5, -.55 + k * .5, .4, .09, .09); l.rotation.z = s * .3; }
    }
    C.smile(g, BC, BR, 0, -.1, .22, 0x4a1010); C.frown(g, BC, BR, 0, -.08, .001);
    rad = 1.9;
  } else if (kind === 'ghost') {
    const gm = tn(0xf4f6ff, { unique: true, opacity: .9, rim: 0xc8d8ff, rimK: .4 });
    const BC = [0, 2.1, 0], BR = [1.15, 1.2, 1.1];
    ell(g, G.sph, gm, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
    ell(g, G.cyl, gm, 0, 1.2, 0, 1.12, 1.3, 1.07);
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; ell(g, G.sphM, gm, Math.cos(a) * .82, .55, Math.sin(a) * .8, .38, .45, .38); }
    eyes = []; for (const s of [-1, 1]) { eyes.push(C.headEye(g, BC, BR, s * .38, .1, .22, { iris: 0x1a1a3a })); C.blush(g, BC, BR, s * .75, -.18, .17, .1, 0xff8ab0); }
    const mo = ell(g, G.sphS, C.basic(0x2a2050), 0, 1.7, 1.1, .16, .2, .05); C.noOl(mo);
    fl = 1; rad = 1.6;
  } else { // ufo
    const sm = tn(0xaab4c8, { rim: 0xffffff, rimK: .3 }), gl = tn(0x7ad0ff, { opacity: .55, rim: 0xffffff, rimK: .5 });
    ell(g, G.sph, sm, 0, 2.3, 0, 2.1, .6, 2.1);
    const al = ell(g, G.sphM, tn(0x6ae08a), 0, 2.85, 0, .55, .6, .55); const ae = []; for (const s of [-1, 1]) { const e = C.eye(.16); e.position.set(s * .22, 2.9, .5); g.add(e); ae.push(e); } eyes = ae;
    ell(g, G.sph, gl, 0, 2.8, 0, 1.0, .95, 1.0).userData.noOutline = true;
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ell(g, G.sphS, tn(0xffe45c, { emissive: 0xc09010, rim: 0 }), Math.cos(a) * 1.8, 2.15, Math.sin(a) * 1.8, .2); }
    ell(g, G.sphM, tn(0x7a8498), 0, 1.7, 0, .9, .3, .9);
    fl = 1; rad = 2.2;
  }
  C.outline(g, .05); return { g, blade, roll, rad, fl, eyes };
};

/* ---- the angry rolling boulder that chases you in dash levels */
C.makeChaser = function () {
  const g = new T.Group(), rock = new T.Group(); g.add(rock);
  const st = tn(0x9a8a7a, { rim: 0xffffff, rimK: .18 }), st2 = tn(0x7a6a5a, { rim: 0xe0d0c0 });
  ell(rock, G.sph, st, 0, 0, 0, 4.4);
  for (const [x, y, z, s] of [[2.6, 2.4, 1.6, 1.2], [-2.6, 2.0, 1.4, 1.1], [0, 3.8, -1, 1.2], [-1.2, -3.2, 2, 1.1], [3.4, -1.2, -1.5, 1.2], [-3.4, -.6, -1.8, 1.3]]) ell(rock, G.sphM, st2, x, y, z, s);
  const face = new T.Group(); g.add(face); face.position.set(0, 4.6, -2.9); face.rotation.y = Math.PI;
  const FR = [3, 3, 3];
  for (const s of [-1, 1]) { const e = C.eye(.95, { iris: 0xcc2020 }); e.position.set(s * 1.4, 1, 0); face.add(e); const b = C.brow(face, s * 1.45, 2.35, .1, 1.5, s * .5); }
  const mo = ell(face, G.sphM, C.basic(0x2a1410), 0, -.75, -.1, 1.5, .55, .25); const tc = ell(face, G.sphS, C.basic(0xffffff), -.7, -.45, -.3, .35, .3, .1); const tc2 = ell(face, G.sphS, C.basic(0xffffff), .7, -.45, -.3, .35, .3, .1);
  C.outline(g, .12);
  const setFade = C.fadeable(g);
  return { g, rock, setFade };
};
})();
