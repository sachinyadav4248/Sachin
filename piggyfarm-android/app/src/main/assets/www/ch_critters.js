/* =====================================================================
   FARM FRIENDS – ten cute critters with big glossy eyes
   C.makeCritter(species, gold) -> { g, eyes, legs, tail, ears, ... } (faces +z)
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell, tn = C.toon;

function mk(gold) {
  const K = (c, o) => gold ? tn(0xffd23a, Object.assign({ emissive: 0x6a4600, rim: 0xfff2b0 }, o || {})) : tn(c, Object.assign({ rim: 0xffffff, rimK: .16 }, o || {}));
  return K;
}
function leg(parent, x, z, mat, hoofMat, h, r, y0) {
  const pv = new T.Group(); pv.position.set(x, y0 == null ? h : y0, z);
  ell(pv, G.cyl, mat, 0, -h * .48, 0, r, h * .85, r); ell(pv, G.sphM, mat, 0, -h * .06, 0, r * 1.05, h * .22, r * 1.05);
  if (hoofMat) ell(pv, G.sphM, hoofMat, 0, -h * .94, r * .15, r * 1.08, h * .2, r * 1.25);
  parent.add(pv); return pv;
}
function face(g, c, rad, o) {
  o = o || {}; const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(C.headEye(g, c, rad, s * (o.eaz || .55), o.eel == null ? .15 : o.eel, o.er || .17, { iris: o.iris }));
    if (o.blush !== false) C.blush(g, c, rad, s * (o.baz || .98), o.bel == null ? -.22 : o.bel, .13, .08);
  }
  return eyes;
}

const B = {};

B.sheep = function (gold) {
  const K = mk(gold), g = new T.Group(), wool = K(0xfdfbf6), dark = tn(0x4b3d48, { rim: 0x9a8aa0 }), faceM = tn(0x5a4a56, { rim: 0xb0a0b8 });
  ell(g, G.sph, wool, 0, 1.0, 0, .86, .78, 1.0);
  const puffs = [[-.55, 1.45, .35], [.55, 1.45, .35], [0, 1.6, -.3], [-.65, 1.0, -.4], [.65, 1.0, -.4], [0, .55, -.75], [-.55, .6, .55], [.55, .6, .55], [0, 1.0, -.95], [-.4, 1.5, -.55], [.4, 1.5, -.55]];
  for (const [x, y, z] of puffs) ell(g, G.sphM, wool, x, y, z, .42);
  const HC = [0, 1.32, .98], HR = [.46, .5, .44];
  ell(g, G.sph, faceM, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(g, G.sphM, wool, 0, 1.82, .85, .34, .26, .32);
  const eyes = face_(g, HC, HR);
  function face_(g, c, r) { return face(g, c, r, { eaz: .52, er: .17 }); }
  const ears = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .42, 1.45, .95); pv.rotation.z = s * -.7; pv.userData.rz = s * -.7; ell(pv, G.sphM, dark, s * .2, 0, 0, .3, .13, .2); g.add(pv); ears.push(pv); }
  C.smile(g, HC, HR, 0, -.5, .09, 0x2a1830);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => leg(g, sx * .42, sz * .55, dark, null, .55, .11, .55));
  const tail = new T.Group(); tail.position.set(0, 1.05, -1.0); ell(tail, G.sphM, wool, 0, 0, -.1, .22); g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears, tail, body: g };
};

B.cow = function (gold) {
  const K = mk(gold), g = new T.Group(), white = K(0xfffaf2), blk = tn(0x2c2630, { rim: 0x9088a0 }), pink = K(0xffb0c4), cream = K(0xf4e6c0);
  ell(g, G.sph, white, 0, 1.05, 0, .82, .76, 1.08);
  const BC = [0, 1.05, 0], BR = [.82, .76, 1.08];
  for (const [az, el, w, h] of [[.9, .5, .38, .3], [-.8, .1, .34, .42], [2.6, .6, .4, .32], [-2.3, .2, .3, .36]]) { const p = new T.Mesh(G.sphM, blk); p.scale.set(w, h, .05); C.onSurface(p, BC, BR, az, el, -.02); p.userData.noOutline = true; g.add(p); }
  const HC = [0, 1.45, 1.02], HR = [.55, .5, .5];
  ell(g, G.sph, white, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const mz = ell(g, G.sphM, pink, 0, 1.28, 1.42, .4, .28, .25);
  for (const s of [-1, 1]) { const n = new T.Mesh(G.sphS, C.basic(0x9a3a5a)); n.scale.set(.06, .08, .03); C.onSurface(n, [0, 1.28, 1.42], [.4, .28, .25], s * .45, .05, -.01); n.userData.noOutline = true; g.add(n); }
  const eyes = face(g, HC, HR, { eaz: .6, eel: .25, er: .16 });
  const ears = [];
  for (const s of [-1, 1]) {
    const pv = new T.Group(); pv.position.set(s * .5, 1.58, 1.0); pv.rotation.z = s * -.35; pv.userData.rz = s * -.35; ell(pv, G.sphM, white, s * .22, 0, 0, .3, .12, .2); ell(pv, G.sphS, pink, s * .22, 0, .06, .16, .07, .1); g.add(pv); ears.push(pv);
    const h = ell(g, G.cone, cream, s * .28, 1.94, .95, .09, .3, .09); h.rotation.z = s * -.25;
  }
  ell(g, G.sphM, blk, 0, 1.95, .98, .26, .13, .2);   // little hair tuft
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => leg(g, sx * .45, sz * .65, white, blk, .6, .14, .6));
  const tail = new T.Group(); tail.position.set(0, 1.3, -1.05); ell(tail, G.cyl, white, 0, -.3, -.04, .04, .65, .04); ell(tail, G.sphM, blk, 0, -.65, -.04, .13, .17, .13); g.add(tail);
  C.outline(g, .05); return { g, eyes, legs, ears, tail };
};

B.chicken = function (gold) {
  const K = mk(gold), g = new T.Group(), white = K(0xfffdf6), og = tn(0xff9a1a, { rim: 0xffe0a0 }), red = tn(0xea3a3a, { rim: 0xffb0b0 });
  const BC = [0, 1.02, 0], BR = [.78, .8, .88];
  ell(g, G.sph, white, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  const HC = [0, 1.72, .5], HR = [.5, .48, .46];
  ell(g, G.sph, white, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  for (const [x, y, s] of [[0, 2.25, .19], [-.16, 2.17, .15], [.16, 2.17, .15]]) ell(g, G.sphM, red, x, y, .45, s, s * 1.1, s);
  const beak = ell(g, G.cone, og, 0, 1.64, .98, .14, .28, .14); beak.rotation.x = Math.PI / 2;
  ell(g, G.sphM, red, 0, 1.38, .88, .08, .16, .08);
  const eyes = face(g, HC, HR, { eaz: .6, eel: .2, er: .14, bel: -.1 });
  const wings = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .72, 1.1, 0); pv.userData.rz = s * .15; pv.rotation.z = s * .15; ell(pv, G.sphM, white, s * .1, -.1, 0, .14, .42, .5); g.add(pv); wings.push(pv); }
  const tail = new T.Group(); tail.position.set(0, 1.4, -.8); for (const a of [-.4, 0, .4]) { const f = ell(tail, G.cone, K(0xf0ead8), Math.sin(a) * .2, .2, -.1, .13, .6, .13); f.rotation.x = -.7; f.rotation.z = -a; } g.add(tail);
  const legs = [-1, 1].map(s => { const pv = new T.Group(); pv.position.set(s * .28, .25, .05); ell(pv, G.cyl, og, 0, -.12, 0, .05, .26, .05); ell(pv, G.sphM, og, 0, -.24, .12, .17, .05, .22); g.add(pv); return pv; });
  C.outline(g, .05); return { g, eyes, legs, ears: wings, tail };
};

B.bunny = function (gold) {
  const K = mk(gold), g = new T.Group(), fur = K(0xf2e6d6), pinkIn = K(0xffb8cc), white = K(0xffffff);
  ell(g, G.sph, fur, 0, .95, 0, .7, .66, .82);
  const HC = [0, 1.5, .62], HR = [.55, .5, .48];
  ell(g, G.sph, fur, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const eyes = face(g, HC, HR, { eaz: .52, eel: .12, er: .17 });
  const nose = ell(g, G.sphS, tn(0xff7aa0), 0, 1.42, 1.08, .07, .055, .05);
  for (const s of [-1, 1]) ell(g, G.sphS, white, s * .06, 1.28, 1.02, .06, .09, .03);
  C.smile(g, HC, HR, 0, -.3, .08, 0x5a2a3a);
  const ears = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .22, 1.9, .5); pv.rotation.z = s * .12; pv.rotation.x = -.12; pv.userData.rz = s * .12; ell(pv, G.sph, fur, 0, .62, 0, .17, .72, .11); ell(pv, G.sphM, pinkIn, 0, .6, .07, .09, .55, .04); g.add(pv); ears.push(pv); }
  const tail = new T.Group(); tail.position.set(0, .95, -.82); ell(tail, G.sphM, white, 0, 0, -.1, .3); g.add(tail);
  const legs = [[-1, 1], [1, 1]].map(([sx, sz]) => leg(g, sx * .36, .55, fur, null, .42, .15, .42));
  for (const s of [-1, 1]) ell(g, G.sphM, fur, s * .55, .26, -.4, .26, .22, .52);
  C.outline(g, .05); return { g, eyes, legs, ears, tail };
};

B.duck = function (gold) {
  const K = mk(gold), g = new T.Group(), yel = K(0xffe14a), og = tn(0xff9a1a, { rim: 0xffe0a0 }), dy = K(0xf5c92a);
  ell(g, G.sph, yel, 0, 1.0, 0, .74, .64, .95);
  const HC = [0, 1.68, .5], HR = [.5, .48, .46];
  ell(g, G.sph, yel, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  ell(g, G.sphM, og, 0, 1.55, 1.0, .26, .1, .3);
  C.shine(g, HC, HR, -.4, .85, .18, .1, .4);
  const eyes = face(g, HC, HR, { eaz: .62, eel: .22, er: .14, bel: -.1 });
  const wings = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .68, 1.05, -.05); pv.userData.rz = s * .25; pv.rotation.z = s * .25; ell(pv, G.sphM, dy, s * .06, -.05, 0, .12, .4, .55); g.add(pv); wings.push(pv); }
  const tail = new T.Group(); tail.position.set(0, 1.25, -.9); const tf = ell(tail, G.cone, yel, 0, .15, -.1, .2, .5, .2); tf.rotation.x = -1.1; g.add(tail);
  const legs = [-1, 1].map(s => { const pv = new T.Group(); pv.position.set(s * .3, .2, .1); ell(pv, G.sphM, og, 0, -.17, .16, .26, .06, .34); g.add(pv); return pv; });
  C.outline(g, .05); return { g, eyes, legs, ears: wings, tail };
};

B.penguin = function (gold) {
  const K = mk(gold), g = new T.Group(), navy = K(0x2a3452), white = K(0xffffff), og = tn(0xff9a1a, { rim: 0xffe0a0 });
  const BC = [0, 1.22, 0], BR = [.76, 1.0, .7];
  ell(g, G.sph, navy, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  const bel = ell(g, G.sph, white, 0, 1.12, .17, .58, .8, .58); C.noOl(bel);
  const HC = [0, 2.2, .08], HR = [.58, .5, .54];
  ell(g, G.sph, navy, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const fc = ell(g, G.sphM, white, 0, 2.12, .26, .4, .36, .3); C.noOl(fc);
  const beak = ell(g, G.cone, og, 0, 2.08, .72, .12, .22, .12); beak.rotation.x = Math.PI / 2;
  const eyes = face(g, [0, 2.2, .1], [.58, .5, .54], { eaz: .42, eel: .2, er: .16, bel: -.1, baz: .75 });
  const wings = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .72, 1.5, 0); pv.userData.rz = s * .35; pv.rotation.z = s * .35; ell(pv, G.sphM, navy, s * .1, -.25, 0, .12, .55, .3); g.add(pv); wings.push(pv); }
  const legs = [-1, 1].map(s => { const pv = new T.Group(); pv.position.set(s * .3, .18, .1); ell(pv, G.sphM, og, 0, -.12, .18, .3, .07, .4); g.add(pv); return pv; });
  C.outline(g, .05); return { g, eyes, legs, ears: wings, tail: null };
};

B.frog = function (gold) {
  const K = mk(gold), g = new T.Group(), gr = K(0x58d150), lt = K(0xd4f7a8), dk = K(0x35a03a);
  ell(g, G.sph, gr, 0, .78, 0, .92, .64, .98);
  const bel = ell(g, G.sph, lt, 0, .62, .25, .66, .44, .7); C.noOl(bel);
  const eyes = [];
  for (const s of [-1, 1]) { ell(g, G.sph, gr, s * .46, 1.34, .62, .34); const e = C.eye(.27); e.position.set(s * .46, 1.4, .88); g.add(e); eyes.push(e); C.blush(g, [0, .78, 0], [.92, .64, .98], s * 1.05, -.1, .18, .1); }
  const HC = [0, .78, .1], HR = [.92, .64, .98];
  const sm = new T.Mesh(new T.TorusGeometry(1, .1, 8, 20, Math.PI), C.basic(0x2a5a30)); sm.scale.set(.34, .2, .2); sm.position.set(0, .82, 1.0); sm.rotation.z = Math.PI; sm.userData.noOutline = true; g.add(sm);
  for (const [x, z, r] of [[-.4, -.3, .13], [.35, -.5, .1], [0, -.7, .12]]) { const sp = new T.Mesh(G.sphS, dk); sp.scale.set(r, .04, r); sp.position.set(x, 1.4, z); sp.userData.noOutline = true; g.add(sp); }
  const legs = [];
  for (const s of [-1, 1]) { ell(g, G.sphM, gr, s * .82, .4, -.5, .3, .34, .62); const f = ell(g, G.sphM, gr, s * .66, .14, .8, .22, .12, .32); }
  C.outline(g, .05); return { g, eyes, legs, ears: null, tail: null };
};

B.panda = function (gold) {
  const K = mk(gold), g = new T.Group(), wh = K(0xffffff), bk = tn(0x2a2630, { rim: 0x9088a8 });
  ell(g, G.sph, wh, 0, 1.0, 0, .85, .78, .96);
  const band = ell(g, G.sph, bk, 0, 1.12, .55, .9, .6, .25); band.rotation.x = -.1;   // shoulder band
  const HC = [0, 1.5, .85], HR = [.62, .56, .54];
  ell(g, G.sph, wh, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  for (const s of [-1, 1]) { ell(g, G.sphM, bk, s * .46, 1.98, .72, .22, .22, .12); const p = new T.Mesh(G.sphM, bk); p.scale.set(.2, .26, .05); p.rotation.z = s * .5; C.onSurface(p, HC, HR, s * .55, .16, -.015); p.userData.noOutline = true; g.add(p); }
  const eyes = face(g, HC, HR, { eaz: .55, eel: .16, er: .13, blush: false });
  for (const s of [-1, 1]) C.blush(g, HC, HR, s * 1.0, -.2, .12, .08);
  ell(g, G.sphS, C.basic(0x1a1420), 0, 1.38, 1.38, .1, .07, .06);
  C.smile(g, HC, HR, 0, -.38, .08, 0x1a1420);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => leg(g, sx * .46, sz * .6, bk, null, .55, .17, .55));
  const tail = new T.Group(); tail.position.set(0, 1.0, -.98); ell(tail, G.sphM, wh, 0, 0, -.1, .2); g.add(tail);
  const ears = [];
  C.outline(g, .05); return { g, eyes, legs, ears, tail };
};

B.cat = function (gold) {
  const K = mk(gold), g = new T.Group(), or = K(0xffa24a), wh = K(0xfff4e6), st = K(0xe07a22), pk = K(0xff9aa8);
  ell(g, G.sph, or, 0, .98, 0, .64, .62, .96);
  const BC = [0, .98, 0], BR = [.64, .62, .96];
  for (const z of [-.5, -.1, .3]) { const p = new T.Mesh(G.sphM, st); p.scale.set(.5, .05, .1); p.position.set(0, 1.5, z); p.rotation.z = 0; p.userData.noOutline = true; g.add(p); }
  const HC = [0, 1.5, .82], HR = [.56, .5, .48];
  ell(g, G.sph, or, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const mz = ell(g, G.sphM, wh, 0, 1.33, 1.2, .26, .17, .17); C.noOl(mz);
  ell(g, G.sphS, tn(0xff7a9a), 0, 1.4, 1.34, .06, .045, .04);
  C.smile(g, HC, HR, 0, -.4, .09, 0x4a2030);
  const eyes = face(g, HC, HR, { eaz: .55, eel: .2, er: .15, iris: 0x3a9a5a });
  for (const s of [-1, 1]) { for (const k of [-.1, .05]) { const w = ell(g, G.cyl, C.basic(0x4a2a2a), s * .42, 1.33 + k, 1.22, .008, .42, .008); w.rotation.z = Math.PI / 2 + s * k * 1.2; w.userData.noOutline = true; } }
  const ears = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .36, 1.92, .72); pv.rotation.z = s * -.25; pv.userData.rz = s * -.25; ell(pv, G.cone, or, 0, .2, 0, .24, .5, .13); ell(pv, G.cone, pk, 0, .16, .06, .13, .32, .06).userData.noOutline = true; g.add(pv); ears.push(pv); }
  const tail = new T.Group(); tail.position.set(0, 1.0, -.95);
  { const pts = [new T.Vector3(0, 0, 0), new T.Vector3(0, .2, -.35), new T.Vector3(0, .65, -.5), new T.Vector3(0, 1.05, -.35), new T.Vector3(0, 1.2, -.1)]; tail.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, .1, 8), or)); ell(tail, G.sphM, wh, 0, 1.2, -.1, .13); } g.add(tail);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => leg(g, sx * .36, sz * .6, or, wh, .55, .13, .55));
  C.outline(g, .05); return { g, eyes, legs, ears, tail };
};

B.puppy = function (gold) {
  const K = mk(gold), g = new T.Group(), tan = K(0xd9a066), cream = K(0xfff0d4), brown = K(0x7a4a2a), pk = tn(0xff7a9a);
  ell(g, G.sph, tan, 0, .98, 0, .66, .62, .94);
  const HC = [0, 1.48, .84], HR = [.58, .52, .5];
  ell(g, G.sph, tan, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  const mz = ell(g, G.sphM, cream, 0, 1.3, 1.22, .3, .22, .24); C.noOl(mz);
  ell(g, G.sphS, C.basic(0x2a1820), 0, 1.38, 1.44, .1, .075, .07);
  ell(g, G.sphM, pk, 0, 1.12, 1.3, .08, .12, .05).userData.noOutline = true;
  const eyes = face(g, HC, HR, { eaz: .55, eel: .2, er: .16 });
  { const p = new T.Mesh(G.sphM, brown); p.scale.set(.2, .22, .05); C.onSurface(p, HC, HR, .6, .22, -.015); p.userData.noOutline = true; g.add(p); }
  const ears = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .5, 1.8, .8); pv.rotation.z = s * -.35; pv.userData.rz = s * -.35; ell(pv, G.sphM, brown, s * .12, -.28, 0, .17, .4, .12); g.add(pv); ears.push(pv); }
  const tail = new T.Group(); tail.position.set(0, 1.12, -.9); const tc = ell(tail, G.cone, tan, 0, .25, -.1, .12, .5, .12); tc.rotation.x = -.8; g.add(tail);
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => leg(g, sx * .38, sz * .6, tan, cream, .55, .14, .55));
  C.outline(g, .05); return { g, eyes, legs, ears, tail };
};

/* gold variants of every species get a halo ring + sparkle feel */
C.makeCritter = function (sp, gold) {
  const b = (B[sp] || B.sheep)(gold);
  b.sp = sp; b.bt = Math.random() * 3; b.hopS = 0;
  if (gold) { const r = new T.Mesh(new T.TorusGeometry(.55, .06, 8, 24), C.basic(0xffe45c)); r.rotation.x = Math.PI / 2; r.position.y = 2.7; r.userData.noOutline = true; b.g.add(r); b.halo = r; }
  return b;
};
C.CRITTERS = Object.keys(B);
})();
