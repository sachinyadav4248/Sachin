/* =====================================================================
   v5.3 WARDROBE + ARCHITECTURE
     hats      : 14 new shapes (HATS_NEW) + the 13 older ones = 27 shapes.  Every level n unlocks hat "h<n>":
                 shape = SHAPES[(n-1) % 27], colourway = floor((n-1)/27)  (hue-rotated clone, never mutates the shared toon cache)
     skins     : every level n unlocks skin "s<n>": generated colour pair + one of 8 patterns (spots, stripes, belly …)
     buildings : 12 toon landmarks (castle, lighthouse, igloo, pagoda, tipi, treehouse, rocket, pyramid, clock tower,
                 carousel, gingerbread house, mushroom house) -> C.makeBuilding(kind) = { g, r, name }
   ===================================================================== */
(function () {
'use strict';
const T = THREE, C = Chars, G = C.G, TAU = Math.PI * 2, ell = C.ell, tn = C.toon;
const PYR = new T.ConeGeometry(1, 1, 4, 1), HALF = new T.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2), TAPER = new T.CylinderGeometry(.62, 1, 1, 18, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------------- 14 new hat shapes (origin = top of the head) */
const HATS_NEW = {
  viking() {
    const g = new T.Group(), mt = tn(0xb8bcc8, { rim: 0xffffff }), gd = tn(0xffd23a, { emissive: 0x4a3a00 }), hn = tn(0xfff4e0, { rim: 0xffffff });
    ell(g, G.sph, mt, 0, .1, 0, .66, .52, .66); ell(g, G.cyl, gd, 0, -.02, 0, .68, .1, .68);
    for (const s of [-1, 1]) { const h = new T.Group(); h.position.set(s * .6, .2, 0); h.rotation.z = -s * .75; g.add(h); ell(h, G.cone, hn, 0, .4, 0, .24, .85, .24); ell(h, G.sphM, hn, 0, .02, 0, .26); }
    return g;
  },
  astro() {
    const g = new T.Group(), wh = tn(0xffffff, { rim: 0xffffff }), gl = tn(0xbfe6ff, { opacity: .42, double: true, rim: 0xffffff, rimK: .5 }), rd = tn(0xe8283c, { rim: 0xffb0b8 });
    const r = new T.Mesh(G.tor, wh); r.scale.setScalar(.74); r.rotation.x = Math.PI / 2; r.position.y = -.1; g.add(r);
    ell(g, G.sph, gl, 0, .3, 0, .9, .85, .9); ell(g, G.cyl, wh, .55, .8, 0, .04, .5, .04); ell(g, G.sphM, rd, .55, 1.08, 0, .1);
    return g;
  },
  beanie() {
    const g = new T.Group(), a = tn(0x3a8aff, { rim: 0xc8e0ff }), b = tn(0x2a6ad8, { rim: 0xb0d0ff }), wh = tn(0xffffff, { rim: 0xffffff });
    ell(g, G.sph, a, 0, .12, 0, .64, .55, .64); ell(g, G.cyl, b, 0, -.04, 0, .66, .2, .66); ell(g, G.sphM, wh, 0, .75, 0, .22);
    for (let i = 0; i < 6; i++) { const t = i / 6 * TAU; ell(g, G.sphS, wh, Math.sin(t) * .5, .02, Math.cos(t) * .5, .06, .06, .06).userData.noOutline = true; }
    return g;
  },
  straw() {
    const g = new T.Group(), st = tn(0xf0d070, { rim: 0xfff4c0 }), bd = tn(0xff5a7a, { rim: 0xffd0d8 }), fl = tn(0xffffff, { rim: 0xffffff });
    ell(g, G.cyl, st, 0, .04, 0, 1.12, .06, 1.12); ell(g, G.sph, st, 0, .12, 0, .52, .42, .52); ell(g, G.cyl, bd, 0, .1, 0, .54, .12, .54);
    for (let i = 0; i < 4; i++) { const t = i / 4 * TAU; ell(g, G.sphS, fl, Math.sin(t) * .7 + .0, .12, Math.cos(t) * .7, .1, .1, .1); }
    return g;
  },
  headphones() {
    const g = new T.Group(), bk = tn(0x2a2030, { rim: 0x8a80a0 }), pk = tn(0xff5aa0, { rim: 0xffd0e8 });
    const r = new T.Mesh(G.tor, bk); r.scale.set(.88, .88, .4); r.position.y = -.1; g.add(r);
    for (const s of [-1, 1]) { ell(g, G.cyl, pk, s * .93, -.12, 0, .34, .26, .34).rotation.z = Math.PI / 2; ell(g, G.cyl, bk, s * 1.05, -.12, 0, .22, .08, .22).rotation.z = Math.PI / 2; }
    return g;
  },
  antenna() {
    const g = new T.Group(), gr = tn(0x7aff6a, { rim: 0xe0ffd0 }), gl = tn(0xffe45c, { emissive: 0x806000, rim: 0xffffff });
    const r = new T.Mesh(G.tor, gr); r.scale.setScalar(.64); r.rotation.x = Math.PI / 2; r.position.y = .02; g.add(r);
    for (const s of [-1, 1]) { const a = new T.Group(); a.position.set(s * .3, .05, .05); a.rotation.z = -s * .32; g.add(a); ell(a, G.cyl, gr, 0, .45, 0, .04, .9, .04); ell(a, G.sphM, gl, 0, .95, 0, .17); }
    return g;
  },
  ninja() {
    const g = new T.Group(), rd = tn(0xe8283c, { rim: 0xffb0b8 }), mt = tn(0xc8ccd8, { rim: 0xffffff }), bk = tn(0x2a2030, { rim: 0x8a80a0 });
    const r = new T.Mesh(G.tor, rd); r.scale.set(.74, .74, .9); r.rotation.x = Math.PI / 2; r.position.set(0, -.28, .0); g.add(r);
    ell(g, G.box, mt, 0, -.28, .78, .46, .26, .06); ell(g, G.sphS, bk, 0, -.28, .82, .06, .06, .03).userData.noOutline = true;
    for (const s of [-1, 1]) { const t = ell(g, G.cone, rd, s * .12, -.34, -.9, .14, .7, .06); t.rotation.set(-Math.PI / 2 - .5, 0, s * .3); }
    return g;
  },
  santa() {
    const g = new T.Group(), rd = tn(0xe83a3a, { rim: 0xffc0c0 }), wh = tn(0xffffff, { rim: 0xffffff });
    ell(g, G.cone, rd, 0, .5, -.1, .62, 1.1, .62).rotation.x = -.35; const r = new T.Mesh(G.tor, wh); r.scale.setScalar(.66); r.rotation.x = Math.PI / 2; r.position.y = .02; g.add(r);
    ell(g, G.sphM, wh, 0, .98, -.52, .2); return g;
  },
  tophat() {
    const g = new T.Group(), bk = tn(0x2a2030, { rim: 0x8a80a0 }), rd = tn(0xe83a5a, { rim: 0xffc0c8 }), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
    ell(g, G.cyl, bk, 0, .02, 0, .92, .08, .92); ell(g, G.cyl, bk, 0, .48, 0, .56, .94, .56); ell(g, G.cyl, rd, 0, .17, 0, .58, .18, .58); ell(g, G.box, gd, 0, .17, .57, .2, .2, .04).userData.noOutline = true;
    return g;
  },
  grad() {
    const g = new T.Group(), bk = tn(0x2a2a40, { rim: 0x8a8ac0 }), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
    ell(g, G.cyl, bk, 0, .15, 0, .52, .36, .52); const bd = ell(g, G.box, bk, 0, .4, 0, 1.6, .1, 1.6); bd.rotation.y = .8;
    ell(g, G.sphM, gd, 0, .48, 0, .1); const c = new T.Group(); c.rotation.y = .8; g.add(c); ell(c, G.cyl, gd, .78, .22, 0, .025, .45, .025); ell(c, G.sphM, gd, .78, -.04, 0, .09); ell(c, G.cyl, gd, .39, .46, 0, .02, .8, .02).rotation.z = Math.PI / 2;
    return g;
  },
  sailor() {
    const g = new T.Group(), wh = tn(0xfffaf0, { rim: 0xffffff }), bl = tn(0x2a5ad8, { rim: 0xb8d0ff }), rd = tn(0xe83a3a, { rim: 0xffc0c0 });
    ell(g, G.cyl, wh, 0, .22, 0, .58, .46, .58); ell(g, G.cyl, bl, 0, .02, 0, .62, .14, .62); ell(g, G.cyl, wh, 0, .5, 0, .7, .08, .7); ell(g, G.sphM, rd, 0, .6, 0, .12);
    return g;
  },
  fez() {
    const g = new T.Group(), rd = tn(0xd8283a, { rim: 0xffb0b8 }), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
    ell(g, TAPER, rd, 0, .35, 0, .78, .72, .78); ell(g, G.cyl, gd, 0, .72, 0, .5, .05, .5).userData.noOutline = true;
    ell(g, G.cyl, gd, .3, .5, .0, .03, .6, .03).rotation.z = -.5; ell(g, G.sphM, gd, .56, .28, 0, .09);
    return g;
  },
  catears() {
    const g = new T.Group(), pk = tn(0xff7ab8, { rim: 0xffd0e8 }), dk = tn(0x3a3040, { rim: 0xa090b0 }), pi = tn(0xffb0d0, { rim: 0xffffff });
    const r = new T.Mesh(G.tor, pk); r.scale.setScalar(.64); r.rotation.x = Math.PI / 2; r.position.y = .02; g.add(r);
    for (const s of [-1, 1]) { const e = new T.Group(); e.position.set(s * .42, .3, 0); e.rotation.z = -s * .25; g.add(e); ell(e, G.cone, dk, 0, .25, 0, .26, .6, .14); ell(e, G.cone, pi, 0, .2, .06, .14, .4, .06).userData.noOutline = true; }
    return g;
  },
  witch() {
    const g = new T.Group(), pu = tn(0x4a2a7a, { rim: 0xc8a8ff }), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
    ell(g, G.cyl, pu, 0, .04, 0, 1.02, .06, 1.02); const c = ell(g, G.cone, pu, 0, .72, 0, .56, 1.45, .56); c.rotation.z = .12; ell(g, G.cyl, tn(0x2a1a4a, { rim: 0x9a80d0 }), 0, .2, 0, .58, .18, .58); ell(g, G.box, gd, 0, .2, .59, .22, .2, .04).userData.noOutline = true;
    return g;
  }
};
const HATS_NEW_ORDER = ['viking', 'astro', 'beanie', 'straw', 'headphones', 'antenna', 'ninja', 'santa', 'tophat', 'grad', 'sailor', 'fez', 'catears', 'witch'];
/* shape list in unlock order: new ones interleaved with the older ones so neighbours look different */
const SHAPES = ['party', 'viking', 'cap', 'astro', 'cowboy', 'beanie', 'chef', 'straw', 'crown', 'headphones', 'prop', 'antenna', 'wizard', 'ninja', 'pirate', 'santa', 'bunny', 'tophat', 'flower', 'grad', 'duck', 'sailor', 'cupcake', 'fez', 'unicorn', 'catears', 'witch'];
const SHAPE_EMOJI = { party: '🥳', viking: '⚔️', cap: '🧢', astro: '👩‍🚀', cowboy: '🤠', beanie: '🧶', chef: '👨‍🍳', straw: '👒', crown: '👑', headphones: '🎧', prop: '🚁', antenna: '👽', wizard: '🧙', ninja: '🥋', pirate: '🏴‍☠️', santa: '🎅', bunny: '🐰', tophat: '🎩', flower: '🌼', grad: '🎓', duck: '🦆', sailor: '⚓', cupcake: '🧁', fez: '🎪', unicorn: '🦄', catears: '🐱', witch: '🧹' };
const SHAPE_NAME = { party: 'Party', viking: 'Viking', cap: 'Cap', astro: 'Astronaut', cowboy: 'Cowboy', beanie: 'Beanie', chef: 'Chef', straw: 'Sun Hat', crown: 'Crown', headphones: 'Beats', prop: 'Copter', antenna: 'Alien', wizard: 'Wizard', ninja: 'Ninja', pirate: 'Pirate', santa: 'Santa', bunny: 'Bunny', tophat: 'Top Hat', flower: 'Flowers', grad: 'Graduate', duck: 'Ducky', sailor: 'Sailor', cupcake: 'Cupcake', fez: 'Fez', unicorn: 'Unicorn', catears: 'Kitty', witch: 'Witch' };
const ADJ = ['Sparkly', 'Zippy', 'Fuzzy', 'Jolly', 'Bouncy', 'Sunny', 'Dreamy', 'Wacky', 'Silly', 'Giggly', 'Mighty', 'Minty', 'Peachy', 'Cosmic', 'Snazzy', 'Cheery', 'Tiny', 'Royal', 'Lucky', 'Frosty', 'Breezy', 'Gleamy', 'Zesty', 'Fizzy', 'Magic', 'Rainbow', 'Velvet', 'Candy', 'Turbo', 'Happy', 'Glowy', 'Super', 'Merry', 'Epic', 'Funky', 'Dandy', 'Lively', 'Golden'];
const NSH = SHAPES.length, NVAR = Math.ceil(1000 / NSH);

/* hue-rotated clone of every toon material in a hat (cache per source material + colourway) */
const rcCache = new Map();
function recolor(root, variant) {
  if (!variant) return root;
  const hs = (variant * .0813 + .03) % 1, satK = [1, .88, 1.1][variant % 3], litK = [0, .07, -.05][(variant * 7) % 3], h = {};
  const shift = (col, isEm) => {
    col.getHSL(h); let hh = (h.h + hs) % 1, s = h.s, l = h.l;
    if (s < .12) { if (l > .85) { s = .55; l = .8; } else if (l < .25) { s = .5; l = l + .12; } else if (!isEm) { s = .5; } hh = (hs + (variant % 5) * .11) % 1; }
    else { s = clamp(s * satK, 0, 1); }
    col.setHSL(hh, s, clamp(l + (isEm ? 0 : litK), 0, .97));
  };
  root.traverse(m => {
    if (!m.isMesh || !m.material || !m.material.color || m.userData.ol) return;
    const src = m.material, key = src.uuid + '|' + variant; let k = rcCache.get(key);
    if (!k) {
      k = src.clone(); k.onBeforeCompile = src.onBeforeCompile; k.customProgramCacheKey = src.customProgramCacheKey;
      shift(k.color, false); if (k.emissive && k.emissive.getHex() !== 0) shift(k.emissive, true);
      rcCache.set(key, k);
    }
    m.material = k;
  });
  return root;
}
const prevHat = C.makeHat;
const baseHat = id => HATS_NEW[id] ? HATS_NEW[id]() : prevHat(id);
C.hatSpec = n => { n = clamp(n | 0, 1, 1000); return { shape: SHAPES[(n - 1) % NSH], variant: Math.floor((n - 1) / NSH) }; };
C.hatInfo = n => { const s = C.hatSpec(n); return { n: ADJ[s.variant % ADJ.length] + ' ' + SHAPE_NAME[s.shape], e: SHAPE_EMOJI[s.shape] }; };
C.makeHat = function (id) {
  const m = /^h(\d{1,4})$/.exec(id || '');
  if (!m) return baseHat(id);
  const s = C.hatSpec(+m[1]); const g = baseHat(s.shape); recolor(g, s.variant);
  return g;
};
C.HAT_SHAPES = SHAPES; C.HATS_NEW_ORDER = HATS_NEW_ORDER;

/* ---------------------------------------------------------------- skins: generated colour pair + pattern */
/* skin names follow the real colour: [max hue, [[name, emoji], ...]] */
const SKIN_NAMES = [[.03, [['Strawberry', '🍓'], ['Cherry', '🍒'], ['Apple', '🍎'], ['Tomato', '🍅']]], [.09, [['Mango', '🥭'], ['Peach', '🍑'], ['Carrot', '🥕'], ['Tangerine', '🍊']]], [.17, [['Lemon', '🍋'], ['Honey', '🍯'], ['Banana', '🍌'], ['Sunny', '🌻']]],
  [.28, [['Lime', '🍏'], ['Kiwi', '🥝'], ['Pear', '🍐'], ['Pickle', '🥒']]], [.45, [['Mint', '🍃'], ['Melon', '🍈'], ['Clover', '🍀'], ['Froggy', '🐸']]], [.56, [['Ocean', '🌊'], ['Lagoon', '🐬'], ['Glacier', '🧊'], ['Splash', '💦']]],
  [.7, [['Blueberry', '💙'], ['Sky', '🌤️'], ['Sapphire', '💎'], ['Whale', '🐳']]], [.82, [['Grape', '🍇'], ['Lavender', '💜'], ['Galaxy', '🌌'], ['Plum', '🔮']]], [.97, [['Candy', '🍬'], ['Bubblegum', '🎀'], ['Cotton', '🍭'], ['Sherbet', '🍧']]], [2, [['Strawberry', '🍓'], ['Cherry', '🍒'], ['Apple', '🍎'], ['Tomato', '🍅']]]];
const PATS = ['none', 'spots', 'stripes', 'belly', 'freckles', 'dots', 'cheeks', 'mask'];
const PAT_NAME = { none: 'Plain', spots: 'Spotty', stripes: 'Stripy', belly: 'Tummy', freckles: 'Freckled', dots: 'Dotty', cheeks: 'Rosy', mask: 'Masked' };
const hsl = (h, s, l) => new T.Color().setHSL(((h % 1) + 1) % 1, clamp(s, 0, 1), clamp(l, 0, 1)).getHex();
C.skinSpec = n => {
  n = clamp(n | 0, 1, 1000); const h = (n * .61803398875 + .07) % 1, s = .52 + ((n * 37) % 40) / 100, l = .56 + ((n * 17) % 5) * .028;
  const pat = PATS[(n * 5 + (n >> 3)) % PATS.length];
  return { h, c: [hsl(h, s, l), hsl(h + .015, s * .78, l + .13)], pat, c3: pat === 'belly' ? hsl(h, .45, .93) : pat === 'mask' ? hsl(h, s, l * .45) : pat === 'stripes' ? hsl(h, s, l * .62) : hsl(h + .5, .72, .52) };
};
C.skinInfo = n => { n = clamp(n | 0, 1, 1000); const k = C.skinSpec(n), row = SKIN_NAMES.find(r => k.h < r[0])[1], nm = row[n % row.length]; return { n: nm[0] + ' ' + PAT_NAME[k.pat], e: nm[1], c: k.c, pat: k.pat, c3: k.c3 }; };

/* pattern decals sit on the pig's body / head ellipsoids; rig.setSkin(c1,c2,pat,c3) redraws them */
const BC = [0, 1.0, -.1], BR = [.98, .92, 1.04], HC = [0, 1.66, .74], HR = [.9, .84, .82], DECG = new T.SphereGeometry(1, 12, 8);
const prevPig = C.makePig;
C.makePig = function () {
  const rig = prevPig(), setBase = rig.setSkin, pat = new T.Group(); rig.inner.add(pat); rig.pat = pat;
  rig.setSkin = function (c1, c2, kind, c3) {
    setBase(c1, c2);
    for (const ch of pat.children.slice()) { pat.remove(ch); ch.material.dispose(); }
    if (!kind || kind === 'none') return;
    const dot = (c, r, az, el, w, h, col, push) => { const m = new T.Mesh(DECG, new T.MeshToonMaterial({ color: col, gradientMap: C.ramp })); m.scale.set(w, h, .05); C.onSurface(m, c, r, az, el, push == null ? .0 : push); m.userData.noOutline = true; pat.add(m); return m; };
    if (kind === 'spots') { [[.7, .75, .2], [-.6, .95, .17], [1.55, .45, .22], [-1.5, .55, .2], [2.6, .7, .18], [-2.5, .85, .16], [0, 1.25, .15], [3.14, .4, .2]].forEach(([a, e, r]) => dot(BC, BR, a, e, r, r, c3)); }
    else if (kind === 'stripes') { for (let i = 0; i < 5; i++) { const el = .1 + i * .24; dot(BC, BR, Math.PI, el, .88 * Math.cos(el) + .05, .07, c3); } for (let i = 0; i < 3; i++) dot(BC, BR, Math.PI + .0, .1 + i * .24, .02, .02, c3); }
    else if (kind === 'belly') { dot(BC, BR, 0, -.35, .62, .46, c3, .005); }
    else if (kind === 'freckles') { for (const s of [-1, 1]) [[.8, -.02], [.95, -.14], [.7, -.16], [.88, .08]].forEach(([a, e]) => dot(HC, HR, s * a, e, .045, .045, c3)); }
    else if (kind === 'dots') { const pal = [0xff4f9a, 0x4fb8ff, 0xffe45c, 0x7aff6a, 0xb06aff, 0xff8a2a]; [[.6, .6], [-.7, .8], [1.5, .3], [-1.5, .4], [2.5, .6], [-2.4, .7], [0, 1.15], [3.1, .3], [2, .9]].forEach(([a, e], i) => dot(BC, BR, a, e, .13, .13, pal[i % 6])); }
    else if (kind === 'cheeks') { for (const s of [-1, 1]) dot(HC, HR, s * 1.0, -.2, .24, .17, c3, .004); }
    else if (kind === 'mask') { for (const s of [-1, 1]) dot(HC, HR, s * .56, .2, .3, .26, c3, -.01); }
  };
  return rig;
};

/* ---------------------------------------------------------------- architecture (toon landmarks) */
const B = {};
const flag = (g, x, y, z, col) => { ell(g, G.cyl, tn(0xffffff), x, y + .7, z, .05, 1.4, .05); const f = ell(g, G.box, tn(col, { rim: 0xffffff }), x + .45, y + 1.25, z, .8, .45, .06); return f; };
B.castle = function () {
  const g = new T.Group(), st = tn(0xd8cce8, { rim: 0xffffff, rimK: .2 }), st2 = tn(0xbcaed4, { rim: 0xffffff }), rf = tn(0xe8486a, { rim: 0xffc0c8 }), dr = tn(0x6a4a30, { rim: 0xd8b090 }), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
  ell(g, G.box, st, 0, 2.2, 0, 10, 4.4, 8); ell(g, G.cyl, st, 0, 5.2, -.5, 2.8, 6.0, 2.8); ell(g, G.cone, rf, 0, 9.6, -.5, 3.3, 3.2, 3.3); flag(g, 0, 11.2, -.5, 0xffd23a);
  for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) { ell(g, G.cyl, st2, x, 3.6, z, 1.5, 7.2, 1.5); ell(g, G.cone, rf, x, 8.2, z, 1.9, 2.4, 1.9); ell(g, G.cyl, gd, x, 7.3, z, 1.6, .2, 1.6); }
  for (let i = -4; i <= 4; i += 2) ell(g, G.box, st, i, 4.7, 4, .9, .8, .9);
  ell(g, G.box, dr, 0, 1.4, 4.05, 2.4, 2.8, .2); ell(g, G.cyl, dr, 0, 2.8, 4.05, 1.2, .2, 1.2).rotation.x = Math.PI / 2;
  for (const x of [-3.2, 3.2]) ell(g, G.box, tn(0x4a7ad8, { rim: 0xc0d8ff }), x, 3.2, 4.05, .8, 1.1, .15);
  return { g, r: 8.2 };
};
B.lighthouse = function () {
  const g = new T.Group(), rd = tn(0xe8483a, { rim: 0xffc8c0 }), wh = tn(0xfffaf0, { rim: 0xffffff }), gl = tn(0xffe45c, { emissive: 0xaa8a10, rim: 0xffffff }), rk = tn(0x9a9ab0, { rim: 0xe0e0f0 });
  for (let i = 0; i < 5; i++) { const r0 = 2.8 - i * .32, hh = 2.6; const geo = new T.CylinderGeometry(r0 - .32, r0, 1, 18, 1); ell(g, geo, i % 2 ? wh : rd, 0, 1.3 + i * 2.6, 0, 1, hh, 1); }
  ell(g, G.cyl, wh, 0, 13.3, 0, 2.3, .35, 2.3); ell(g, G.cyl, gl, 0, 14.4, 0, 1.3, 1.9, 1.3); ell(g, G.cone, rd, 0, 16.5, 0, 1.9, 2.2, 1.9); ell(g, G.sphM, gl, 0, 17.8, 0, .3);
  for (const [x, z, r] of [[-3, 1, 1.4], [2.5, 2, 1.1], [3.2, -2, 1.5], [-1.5, -3, 1.2]]) ell(g, G.sph, rk, x, .2, z, r, r * .6, r);
  ell(g, G.box, tn(0x6a4a30), 0, 1.0, 2.4, 1.1, 2, .2);
  return { g, r: 3.4 };
};
B.igloo = function () {
  const g = new T.Group(), ic = tn(0xf0f8ff, { rim: 0xa8d0ff, rimK: .3 }), ib = tn(0xd8ecff, { rim: 0xffffff }), dk = tn(0x2a3a5a);
  const d = ell(g, HALF, ic, 0, 0, 0, 5, 4.2, 5);
  for (let i = 0; i < 3; i++) { const y = .8 + i * 1.1, r = 4.9 * Math.sqrt(Math.max(0, 1 - ((y) / 4.2) ** 2)); ell(g, G.tor, ib, 0, y, 0, r, r, .3).rotation.x = Math.PI / 2; }
  ell(g, G.cyl, ic, 0, 1.2, 4.7, 1.8, 2.4, 1.8).rotation.x = 0; ell(g, G.sph, dk, 0, 1.2, 6.4, 1.1, 1.3, .3);
  return { g, r: 5.2 };
};
B.pagoda = function () {
  const g = new T.Group(), wl = tn(0xfff0e0, { rim: 0xffffff }), rf = tn(0xd8283a, { rim: 0xffb0b8 }), wd = tn(0x8a5a3a, { rim: 0xe0c0a0 }), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
  ell(g, G.box, wd, 0, .4, 0, 8, .8, 8);
  for (let i = 0; i < 4; i++) { const w = 4.6 - i * .85, y = 1.0 + i * 2.7; ell(g, G.box, wl, 0, y + .9, 0, w, 1.8, w); const r = ell(g, PYR, rf, 0, y + 2.25, 0, w * 1.45, 1.4, w * 1.45); r.rotation.y = Math.PI / 4; ell(g, G.box, wd, 0, y + 1.0, w / 2, .8, 1.2, .1); }
  ell(g, G.cyl, gd, 0, 12.8, 0, .08, 2.4, .08); ell(g, G.sphM, gd, 0, 13.6, 0, .35);
  return { g, r: 4.6 };
};
B.tipi = function () {
  const g = new T.Group(), cv = tn(0xf5d8a8, { rim: 0xffffff }), rd = tn(0xe8483a, { rim: 0xffc0b8 }), bl = tn(0x3a8ad8, { rim: 0xc0e0ff }), wd = tn(0x8a5a3a, { rim: 0xe0c0a0 }), dk = tn(0x4a2a1a);
  ell(g, G.cone, cv, 0, 3.4, 0, 3.4, 6.8, 3.4);
  for (const [y, r, c] of [[1.1, 3.1, rd], [2.4, 2.45, bl], [3.7, 1.8, rd]]) ell(g, G.cyl, c, 0, y, 0, r - .05, .45, r - .05).scale.y = .45;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const p = ell(g, G.cyl, wd, Math.sin(a) * .5, 7.4, Math.cos(a) * .5, .09, 2.4, .09); p.rotation.set(Math.cos(a) * .22, 0, -Math.sin(a) * .22); }
  ell(g, G.cone, dk, 0, 1.3, 2.4, 1.0, 2.6, .15).rotation.x = -.25;
  return { g, r: 3.5 };
};
B.treehouse = function () {
  const g = new T.Group(), bk = tn(0x8a5a3a, { rim: 0xe0c0a0 }), lf = tn(0x4ac86a, { rim: 0xd0ffd8 }), lf2 = tn(0x38a858, { rim: 0xc0f0c8 }), wd = tn(0xd8a060, { rim: 0xfff0d0 }), rf = tn(0xe8483a, { rim: 0xffc0b8 });
  ell(g, G.cyl, bk, 0, 4, 0, 1.5, 8, 1.5);
  for (const [x, y, z, r] of [[0, 10.5, 0, 4.2], [-3, 9, 1, 3], [3, 9, -1, 3.2], [0, 12.5, -.5, 3], [1.5, 9.5, 3, 2.6]]) ell(g, G.sph, (x + z) % 2 ? lf : lf2, x, y, z, r, r * .85, r);
  ell(g, G.cyl, wd, 0, 5.4, 0, 3.3, .35, 3.3); ell(g, G.box, wd, 0, 7.1, 0, 3.1, 2.7, 3.1); const r = ell(g, PYR, rf, 0, 9.4, 0, 4.7, 2.0, 4.7); r.rotation.y = Math.PI / 4;
  ell(g, G.box, tn(0x4a7ad8, { rim: 0xc0d8ff }), 0, 7.1, 1.58, 1.1, 1.1, .1); for (let i = 0; i < 6; i++) ell(g, G.cyl, wd, 0, .8 + i * .9, 2.2, .85, .12, .1).rotation.z = Math.PI / 2; for (const s of [-1, 1]) ell(g, G.cyl, wd, s * .85, 3.0, 2.2, .07, 6, .07);
  return { g, r: 1.9 };
};
B.rocket = function () {
  const g = new T.Group(), wh = tn(0xfffaf0, { rim: 0xffffff }), rd = tn(0xe8283a, { rim: 0xffb0b8 }), bl = tn(0x3a8aff, { rim: 0xc0e0ff }), gl = tn(0xbfe6ff, { rim: 0xffffff, rimK: .5 }), fl = tn(0xff9a2a, { emissive: 0xaa5a10 });
  ell(g, G.sph, wh, 0, 6.2, 0, 2.2, 5.0, 2.2); ell(g, G.cone, rd, 0, 11.6, 0, 1.9, 3.2, 1.9);
  for (const y of [4.6, 7.8]) ell(g, G.tor, bl, 0, y, 0, 2.1, 2.1, .4).rotation.x = Math.PI / 2;
  ell(g, G.sphM, gl, 0, 7.2, 1.75, .85, .85, .35); const w = ell(g, G.tor, bl, 0, 7.2, 1.9, .9, .9, .5);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; const f = ell(g, G.cone, rd, Math.sin(a) * 2.1, 2.2, Math.cos(a) * 2.1, .7, 3.2, .35); f.rotation.y = a; f.rotation.x = -.15; }
  ell(g, G.cone, fl, 0, .2, 0, 1.0, 1.6, 1.0).rotation.x = Math.PI;
  return { g, r: 2.8 };
};
B.pyramid = function () {
  const g = new T.Group(), sd = tn(0xf0d088, { rim: 0xfff4c8, rimK: .3 }), sd2 = tn(0xc89a50, { rim: 0xffe8a8 }), dk = tn(0x3a2a1a), gd = tn(0xffd23a, { emissive: 0x6a4a00 });
  const p = ell(g, PYR, sd, 0, 6, 0, 11.5, 12, 11.5); p.rotation.y = Math.PI / 4;
  for (let i = 1; i < 6; i++) { const y = i * 2.0, w = 16.3 * (1 - y / 12) + .35; const s = ell(g, G.box, sd2, 0, y, 0, w, .22, w); s.userData.noOutline = true; }
  ell(g, G.box, dk, 0, 1.4, 7.1, 2.2, 2.8, .7); ell(g, G.cone, gd, 0, 12.4, 0, .9, 1.2, .9);
  return { g, r: 8.6 };
};
B.clocktower = function () {
  const g = new T.Group(), br = tn(0xd8785a, { rim: 0xffd8c8 }), br2 = tn(0xb85a40, { rim: 0xffc0a8 }), wh = tn(0xfffaf0, { rim: 0xffffff }), rf = tn(0x3a6ad8, { rim: 0xc0d8ff }), bk = tn(0x2a2030), gd = tn(0xffd23a, { emissive: 0x4a3a00 });
  ell(g, G.box, br, 0, 4.5, 0, 4.6, 9, 4.6); ell(g, G.box, br2, 0, 9.4, 0, 5.2, .6, 5.2); ell(g, G.box, br, 0, 11.2, 0, 4.2, 3.2, 4.2);
  const fc = new T.Group(); fc.position.set(0, 11.2, 2.15); g.add(fc); ell(fc, G.cyl, wh, 0, 0, 0, 1.45, .2, 1.45).rotation.x = Math.PI / 2; ell(fc, G.cyl, gd, 0, 0, 0, 1.5, .15, 1.5).rotation.x = Math.PI / 2; ell(fc, G.cyl, wh, 0, 0, .1, 1.35, .15, 1.35).rotation.x = Math.PI / 2;
  ell(fc, G.box, bk, 0, .45, .2, .1, .9, .08); ell(fc, G.box, bk, .3, 0, .2, .7, .09, .08).rotation.z = .5; ell(fc, G.sphS, bk, 0, 0, .22, .12);
  ell(g, G.cone, rf, 0, 14.8, 0, 3.2, 3.8, 3.2).rotation.y = .3; ell(g, G.sphM, gd, 0, 17, 0, .35); ell(g, G.box, tn(0x6a4a30), 0, 1.2, 2.35, 1.5, 2.4, .1);
  return { g, r: 3.4 };
};
B.carousel = function () {
  const g = new T.Group(), pk = tn(0xff6ab0, { rim: 0xffd0e8 }), wh = tn(0xffffff, { rim: 0xffffff }), gd = tn(0xffd23a, { emissive: 0x4a3a00 }), bl = tn(0x4fb8ff, { rim: 0xd0ecff }), wd = tn(0xd8a060, { rim: 0xfff0d0 });
  ell(g, G.cyl, wd, 0, .4, 0, 4.6, .8, 4.6); ell(g, G.cyl, bl, 0, .9, 0, 4.2, .2, 4.2); ell(g, G.cyl, gd, 0, 4.2, 0, .3, 7.2, .3);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ell(g, G.cyl, gd, Math.sin(a) * 3.6, 3.0, Math.cos(a) * 3.6, .1, 4.2, .1);
    const h = new T.Group(); h.position.set(Math.sin(a) * 2.6, 2.0, Math.cos(a) * 2.6); h.rotation.y = a + Math.PI / 2; g.add(h); ell(h, G.sph, i % 2 ? wh : pk, 0, 0, 0, .5, .4, .85); ell(h, G.sph, i % 2 ? wh : pk, 0, .55, .75, .3, .35, .3); ell(h, G.cyl, gd, 0, .2, 0, .04, 2.0, .04); }
  ell(g, G.cone, pk, 0, 7.6, 0, 5.2, 2.8, 5.2); ell(g, G.cyl, wh, 0, 6.5, 0, 5.15, .5, 5.15); ell(g, G.sphM, gd, 0, 9.3, 0, .5); flag(g, 0, 9.4, 0, 0x4fb8ff);
  return { g, r: 4.9 };
};
B.gingerbread = function () {
  const g = new T.Group(), gb = tn(0xc88a4a, { rim: 0xffd8a8 }), ic = tn(0xffffff, { rim: 0xffffff }), pk = tn(0xff6ab0, { rim: 0xffd0e8 }), dk = tn(0x7a4a2a), gm = [0xff3a4a, 0x4aff7a, 0xffe03a, 0x4fb8ff, 0xb06aff];
  ell(g, G.box, gb, 0, 2.0, 0, 7, 4, 6); const r = ell(g, PYR, pk, 0, 5.4, 0, 9.6, 2.8, 8.2); r.rotation.y = Math.PI / 4; r.scale.set(6.4, 2.8, 5.4);
  for (let i = 0; i < 8; i++) ell(g, G.sphM, ic, -2.9 + i * .83, 4.15, 3.0 + .0, .3, .3, .3).userData.noOutline = true;
  ell(g, G.box, dk, 0, 1.4, 3.05, 1.6, 2.8, .2); ell(g, G.sphM, tn(0xffd23a), .5, 1.4, 3.2, .12);
  for (const x of [-2.2, 2.2]) { ell(g, G.box, tn(0x4fb8ff, { rim: 0xd0ecff }), x, 2.4, 3.05, 1.1, 1.1, .15); ell(g, G.box, ic, x, 2.4, 3.1, 1.3, .12, .12); }
  for (let i = 0; i < 5; i++) ell(g, G.sphM, tn(gm[i], { rim: 0xffffff, rimK: .4 }), -2.6 + i * 1.3, 5.9 - Math.abs(i - 2) * .55, 1.6, .35, .35, .35);
  for (const s of [-1, 1]) { ell(g, G.cyl, ic, s * 4.4, 1.6, 3.2, .18, 3.2, .18); ell(g, G.sphM, pk, s * 4.4, 3.3, 3.2, .3).userData.noOutline = true; }
  return { g, r: 4.4 };
};
B.mushroom = function () {
  const g = new T.Group(), st = tn(0xfff0d8, { rim: 0xffffff }), cp = tn(0xe8283a, { rim: 0xffb0b8 }), wh = tn(0xffffff, { rim: 0xffffff }), dr = tn(0x8a5a3a, { rim: 0xe0c0a0 });
  ell(g, G.cyl, st, 0, 2.2, 0, 2.2, 4.4, 2.2); ell(g, HALF, cp, 0, 4.0, 0, 5.2, 3.6, 5.2);
  for (const [a, e, r] of [[0, 1.2, .6], [1.3, .9, .7], [2.6, 1.0, .55], [-1.3, .9, .65], [-2.6, 1.1, .6], [3.5, .8, .6]]) { const m = ell(g, G.sphM, wh, 0, 0, 0, r, r * .35, r); C.onSurface(m, [0, 4.0, 0], [5.2, 3.6, 5.2], a, e, .0); m.userData.noOutline = true; }
  ell(g, G.box, dr, 0, 1.3, 2.1, 1.3, 2.4, .2); ell(g, G.cyl, dr, 0, 2.5, 2.1, .65, .2, .65).rotation.x = Math.PI / 2; ell(g, G.sphM, tn(0xffd23a), .3, 1.2, 2.25, .1);
  for (const s of [-1, 1]) { ell(g, G.sph, tn(0x4fb8ff, { rim: 0xd0ecff }), s * 1.3, 3.0, 1.45, .55, .55, .3); }
  return { g, r: 2.6 };
};
C.BUILDINGS = Object.keys(B);
C.BUILDING_NAMES = { castle: 'Castle', lighthouse: 'Lighthouse', igloo: 'Igloo', pagoda: 'Pagoda', tipi: 'Tipi', treehouse: 'Treehouse', rocket: 'Rocket', pyramid: 'Pyramid', clocktower: 'Clock Tower', carousel: 'Carousel', gingerbread: 'Gingerbread House', mushroom: 'Mushroom House' };
C.makeBuilding = function (kind) { const o = (B[kind] || B.castle)(); C.outline(o.g, .09); o.kind = kind; return o; };
})();
