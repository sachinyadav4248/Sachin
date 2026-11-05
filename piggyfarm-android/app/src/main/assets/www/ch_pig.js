/* =====================================================================
   HERO PIGGY – cute chubby pink pig, bee-stripe jetpack, head cannon
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell;
const BALL_COLORS = [0xff4f9a, 0x4fb8ff, 0xffd23a, 0x7aff6a, 0xb06aff, 0xff8a2a];

C.makePig = function () {
  const g = new T.Group(), inner = new T.Group(); g.add(inner);
  const pinkM = C.toon(0xff80b6, { unique: true, rim: 0xffd9ea, rimK: .22 });      // main skin (re-coloured by skins)
  const pink2M = C.toon(0xffb3d0, { unique: true, rim: 0xffffff, rimK: .18 });     // lighter: snout / belly
  const dkM = C.toon(0xe0587f, { unique: true, rim: 0xffc0d8, rimK: .12 });        // darker: ears, hooves
  const ink = C.basic(0x4a1c34), nostrilM = C.basic(0x7a2a52);

  // ---- body: round and chubby, slightly pear shaped
  const BC = [0, 1.0, -.1], BR = [.98, .92, 1.04];
  const body = ell(inner, G.sph, pinkM, BC[0], BC[1], BC[2], BR[0], BR[1], BR[2]);
  C.shine(inner, BC, BR, -.5, .85, .3, .16, .38);

  // ---- head: big, round, kawaii proportions
  const HC = [0, 1.66, .74], HR = [.9, .84, .82];
  const head = ell(inner, G.sph, pinkM, HC[0], HC[1], HC[2], HR[0], HR[1], HR[2]);
  C.shine(inner, HC, HR, -.38, .88, .30, .17, .45);

  // snout (lighter, soft) + nostrils
  const SC = [0, 1.5, 1.52], SR = [.4, .31, .26];
  const snout = ell(inner, G.sphM, pink2M, SC[0], SC[1], SC[2], SR[0], SR[1], SR[2]);
  for (const s of [-1, 1]) { const n = new T.Mesh(G.sphS, nostrilM); n.scale.set(.065, .105, .03); C.onSurface(n, SC, SR, s * .42, .06, -.012); n.userData.noOutline = true; inner.add(n); }
  C.shine(inner, SC, SR, -.3, .75, .13, .07, .5);

  // eyes (big + glossy + blinking) and rosy cheeks
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(C.headEye(inner, HC, HR, s * .56, .2, .235));
    C.blush(inner, HC, HR, s * .98, -.2, .2, .12);
  }
  // mouths: smile (default) and open "O" (ouch / cheer)
  const smile = C.smile(inner, HC, HR, 0, -.42, .17);
  const mouthO = new T.Mesh(G.sphS, C.basic(0x6a1a3a)); mouthO.scale.set(.1, .13, .04); C.onSurface(mouthO, HC, HR, 0, -.44, -.01); mouthO.visible = false; mouthO.userData.noOutline = true; inner.add(mouthO);
  const tongue = new T.Mesh(G.sphS, C.basic(0xff7aa0)); tongue.scale.set(.06, .05, .03); tongue.position.set(0, -.04, .02); mouthO.add(tongue);

  // ears (floppy, pivot at the base)
  const ears = [];
  for (const s of [-1, 1]) {
    const pv = new T.Group(); pv.position.set(s * .6, 2.34, .5); pv.rotation.set(.35, 0, s * .5); pv.userData.rz = s * .5; pv.userData.s = s;
    const ear = ell(pv, G.sphM, pinkM, s * .1, .26, 0, .34, .45, .13);
    const inn = ell(pv, G.sphS, dkM, s * .1, .22, .08, .2, .3, .05); C.noOl(inn);
    inner.add(pv); ears.push(pv);
  }

  // ---- legs: short, stubby, with little hooves
  const legs = [];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const pv = new T.Group(); pv.position.set(sx * .52, .68, sz * .62 - .08);
    ell(pv, G.cyl, pinkM, 0, -.26, 0, .25, .46, .25);
    ell(pv, G.sphM, pinkM, 0, -.03, 0, .26, .22, .26);
    ell(pv, G.sphM, dkM, 0, -.5, .03, .27, .17, .3);
    inner.add(pv); legs.push(pv);
  });

  // ---- curly tail
  const tailG = new T.Group(); tailG.position.set(0, .96, -1.08);
  { const pts = []; for (let i = 0; i <= 26; i++) { const t = i / 26, a = t * 2.6 * Math.PI; pts.push(new T.Vector3(Math.sin(a) * .13 * (1 - t * .15), .02 + t * .34 + Math.cos(a) * .13 * (1 - t * .15) - .13, -t * .24)); }
    const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, .05, 8, false), dkM); tailG.add(tube);
    ell(tailG, G.sphS, dkM, pts[26].x, pts[26].y, pts[26].z, .06); }
  inner.add(tailG);

  // ---- bee-stripe jetpack (as in the video) with little wings
  const jp = new T.Group(); jp.position.set(0, 1.8, -.92); inner.add(jp);
  const yel = C.toon(0xffc928, { rim: 0xfff0a0 }), blk = C.toon(0x2b2330, { rim: 0x6a5a8a, rimK: .2 });
  ell(jp, G.sph, yel, 0, 0, 0, .5, .66, .44);
  for (const h of [-.2, .16]) { const rr = Math.sqrt(1 - (h / .66) ** 2); const r = new T.Mesh(G.tor, blk); r.rotation.x = Math.PI / 2; r.position.y = h; r.scale.set(.5 * rr * 1.01, .44 * rr * 1.01, .55); r.userData.noOutline = true; jp.add(r); }
  ell(jp, G.cyl, blk, 0, -.64, 0, .2, .2, .2);
  const wingM = C.toon(0xeaf7ff, { opacity: .8, double: true, rim: 0xffffff, depthWrite: false });
  const wings = [];
  for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * .36, .22, -.12); const w = ell(pv, G.sphM, wingM, s * .5, .1, 0, .62, .05, .34); w.userData.noOutline = true; jp.add(pv); wings.push([pv, s]); }
  const flame = new T.Group(); flame.position.set(0, -.78, 0); flame.visible = false; jp.add(flame);
  { const f1 = new T.Mesh(G.cone, C.basic(0xff8a1a)); f1.scale.set(.26, .95, .26); f1.rotation.x = Math.PI; f1.position.y = -.4; flame.add(f1); const f2 = new T.Mesh(G.cone, C.basic(0xffe45c)); f2.scale.set(.15, .6, .15); f2.rotation.x = Math.PI; f2.position.y = -.28; flame.add(f2); }
  // tiny straps
  for (const s of [-1, 1]) { const st = ell(inner, G.sphS, blk, s * .56, 1.5, -.5, .07, .5, .07); st.rotation.z = s * -.15; st.rotation.x = .2; C.noOl(st); }

  // ---- head cannon (cute candy cannon sitting on the forehead)
  const cannon = new T.Group(); cannon.position.set(0, 2.3, 1.12); cannon.scale.setScalar(.82); inner.add(cannon);
  const gold = C.toon(0xffcf3a, { rim: 0xfff2b0 }), blue = C.toon(0x3b82f0, { rim: 0xbfe0ff });
  ell(cannon, G.cyl, gold, 0, -.02, 0, .34, .2, .34);
  const tilt = new T.Group(); tilt.rotation.x = 1.0; tilt.position.y = .1; cannon.add(tilt);
  ell(tilt, G.cyl, blue, 0, .34, 0, .22, .64, .22);
  const rim = new T.Mesh(G.tor, gold); rim.scale.set(.25, .25, .25); rim.rotation.x = Math.PI / 2; rim.position.y = .68; tilt.add(rim);
  const loadedM = C.toon(BALL_COLORS[0], { unique: true, rim: 0xffffff, rimK: .3 });
  const loaded = ell(tilt, G.sphM, loadedM, 0, .82, 0, .24); loaded.userData.noOutline = false;
  ell(tilt, G.sphS, C.basic(0xffffff, { opacity: .6 }), .08, .9, .1, .06, .04, .03);

  // hat anchor (hats sit on top of the head, slightly behind the cannon)
  const hatA = new T.Group(); hatA.position.set(0, 2.5, .08); hatA.scale.setScalar(.9); inner.add(hatA);

  C.outline(g, .06);
  const rig = { g, inner, pinkM, pink2M, dkM, legs, ears, tail: tailG, wings, flame, cannon, loaded, loadedM, hatA, eyes, smile, mouthO, head, body, bt: 2, mood: 'normal', moodT: 0, hat: null, shades: null, ballColors: BALL_COLORS, t: 0, runPh: 0 };

  /* ---- animation: s = {t, speed, grounded, thrusting, vy, recoil, mood, look} */
  rig.animate = function (dt, s) {
    const t = s.t, k = Math.min(1, s.speed / 8);
    rig.runPh += dt * (6 + s.speed * 1.1);
    const ph = rig.runPh;
    // blink
    rig.bt -= dt; if (rig.bt <= -.15) rig.bt = 1.5 + Math.random() * 3.2;
    let bl = rig.bt < 0 ? Math.sin(Math.min(1, -rig.bt / .15) * Math.PI) : 0;
    const mood = s.mood || 'normal';
    const squint = mood === 'hurt' ? .85 : mood === 'happy' ? .55 : s.thrusting ? .35 : 0;
    for (const e of eyes) { e.blink(Math.max(bl, squint)); e.look(s.look ? s.look.x : 0, s.look ? s.look.y : (s.grounded ? 0 : .5)); }
    smile.visible = mood !== 'hurt' && mood !== 'cheer'; mouthO.visible = !smile.visible;
    if (mood === 'cheer') mouthO.scale.set(.12, .14 + Math.sin(t * 14) * .03, .04);
    // body bounce / roll while running, stretch while flying
    const bob = s.grounded ? Math.abs(Math.sin(ph)) * .13 * k : Math.sin(t * 6) * .04;
    inner.position.y = bob;
    inner.rotation.z = s.grounded ? Math.sin(ph) * .07 * k : 0;
    inner.rotation.x = s.grounded ? Math.sin(ph * 2) * .02 * k : Math.max(-.35, Math.min(.35, -s.vy * .022)) + (s.thrusting ? .14 : 0);
    // squash & stretch
    const sq = s.squash || 1; inner.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // legs
    legs.forEach((l, i) => { const sw = s.grounded ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * .85 * k : .55 + Math.sin(t * 9 + i) * .08; l.rotation.x += (sw - l.rotation.x) * Math.min(1, 20 * dt); });
    // floppy ears follow motion
    ears.forEach((e, i) => { const fl = s.grounded ? Math.sin(ph * 2 + i) * .25 * k : .5 + Math.sin(t * 30) * .2 * (s.thrusting ? 1 : .3); e.rotation.x = .35 + fl; e.rotation.z = e.userData.rz + (s.grounded ? 0 : e.userData.s * .3); });
    // tail wiggle
    tailG.rotation.z = Math.sin(t * 9) * .4; tailG.rotation.x = Math.sin(t * 7) * .2;
    // jetpack wings + flame
    const flap = s.grounded ? Math.sin(t * 8) * .12 : Math.sin(t * 40) * .55; for (const [pv, sg] of wings) pv.rotation.z = sg * (.85 + flap * .6);
    flame.visible = !!s.thrusting; if (s.thrusting) { flame.scale.set(1, .8 + Math.random() * .6, 1); }
    // cannon recoil + reload pop
    cannon.position.z = 1.12 - (s.recoil || 0) * .6; const ls = loaded.scale.x; loaded.scale.setScalar(Math.min(.24, ls + dt * .9));
    // hat spin (copter)
    if (rig.hat && rig.hat.userData.spin) rig.hat.userData.spin.rotation.y += dt * (s.grounded ? 12 : 30);
  };
  rig.reload = function (colorIdx) { loadedM.color.setHex(BALL_COLORS[colorIdx % BALL_COLORS.length]); loaded.scale.setScalar(.05); };
  rig.setSkin = function (c1, c2) { pinkM.color.setHex(c1); pink2M.color.setHex(c2); dkM.color.setHex(c1).multiplyScalar(.82); };
  return rig;
};
C.BALL_COLORS = BALL_COLORS;

/* ---------- hats (smooth, glossy) */
C.makeHat = function (id) {
  const g = new T.Group(), tn = C.toon, e = C.ell;
  if (id === 'party') { e(g, G.cone, tn(0xff4f9a), 0, .55, 0, .42, 1.1, .42); e(g, G.sphM, tn(0xffe45c), 0, 1.13, 0, .15); const r = new T.Mesh(G.tor, tn(0x4fb8ff)); r.scale.set(.38, .38, .38); r.rotation.x = Math.PI / 2; r.position.y = .12; g.add(r); }
  else if (id === 'cap') { e(g, G.sphM, tn(0xe83a3a), 0, .12, 0, .55, .4, .55); e(g, G.sphM, tn(0xb82a2a), 0, .02, .55, .5, .07, .36); e(g, G.sphS, tn(0xffffff), 0, .5, 0, .09); }
  else if (id === 'cowboy') { e(g, G.cyl, tn(0x9a6a3a), 0, .08, 0, .95, .07, .95); e(g, G.cyl, tn(0x8a5a2a), 0, .38, 0, .45, .55, .45); e(g, G.cyl, tn(0xffd23a), 0, .2, 0, .47, .08, .47); }
  else if (id === 'chef') { e(g, G.cyl, tn(0xffffff), 0, .3, 0, .42, .6, .42); e(g, G.sphM, tn(0xffffff), 0, .8, 0, .58, .48, .58); }
  else if (id === 'crown') { const gm = tn(0xffd23a, { emissive: 0x6a4a00 }); e(g, G.cyl, gm, 0, .2, 0, .48, .35, .48); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; e(g, G.cone, gm, Math.cos(a) * .42, .6, Math.sin(a) * .42, .13, .4, .13); e(g, G.sphS, tn([0xff3a5a, 0x3aa0ff, 0x4aff7a][i % 3]), Math.cos(a) * .42, .86, Math.sin(a) * .42, .08); } }
  else if (id === 'prop') { e(g, G.sphM, tn(0x3a8aff), 0, .15, 0, .5, .35, .5); e(g, G.cyl, tn(0xffffff), 0, .5, 0, .05, .3, .05); const bl = new T.Group(); bl.position.y = .68; g.add(bl); e(bl, G.box, tn(0xffd23a), 0, 0, 0, 1.5, .05, .2); e(bl, G.box, tn(0xff4f6a), 0, 0, 0, .2, .05, 1.5); g.userData.spin = bl; }
  else if (id === 'wizard') { e(g, G.cone, tn(0x6a3ad8), 0, .8, 0, .5, 1.6, .5); e(g, G.cyl, tn(0x5a2ac8), 0, .06, 0, .85, .07, .85); e(g, G.sphS, tn(0xffe45c, { emissive: 0x806000 }), .15, .7, .45, .12); e(g, G.sphS, tn(0xffe45c, { emissive: 0x806000 }), -.2, 1.1, .35, .09); }
  return g;
};
/* cool shades sit on the face rather than the head top */
C.makeShades = function () {
  const g = new T.Group(), dk = C.toon(0x16121e, { rim: 0 }), gl = C.toon(0x2a4a7a, { emissive: 0x112244, rim: 0x9ad0ff });
  for (const s of [-1, 1]) { C.ell(g, G.sphM, gl, s * .34, 0, 0, .27, .2, .08); }
  C.ell(g, G.box, dk, 0, .04, -.01, .2, .05, .06);
  return g;
};
})();
