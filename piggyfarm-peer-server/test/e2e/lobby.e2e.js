'use strict';
/**
 * Optional end-to-end check: two real browser pages play the game's own lobby against THIS server.
 * create room -> join with the code -> host sees 2 players -> host starts -> both leave the lobby.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   node test/e2e/lobby.e2e.js ../piggyfarm-android/app/src/main/assets/www
 *
 * Uses the game's `?peer=host:port` override (plain http, no STUN), so it runs fully on localhost.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const www = path.resolve(process.argv[2] || path.join(__dirname, '../../../piggyfarm-android/app/src/main/assets/www'));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const web = http.createServer((q, r) => {
  const f = path.join(www, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(www) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

const listen = (s, port) => new Promise(ok => s.listen(port, '127.0.0.1', () => ok(s.address().port)));

(async () => {
  const webPort = await listen(web, 0);
  process.env.ALLOWED_ORIGINS = `http://127.0.0.1:${webPort}`;
  const { createApp } = require('../../server');
  const { server: sig } = createApp();
  const sigPort = await listen(sig, 0);
  console.log(`web :${webPort}  signaling :${sigPort}`);

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-features=WebRtcHideLocalIpsWithMdns'],   // headless has no mDNS: expose plain host candidates
  });
  const errs = [];
  const mk = async name => {
    const p = await (await browser.newContext({ viewport: { width: 800, height: 400 } })).newPage();
    p.on('pageerror', e => errs.push(`${name}: ${String(e).slice(0, 160)}`));
    await p.goto(`http://127.0.0.1:${webPort}/index.html?peer=127.0.0.1:${sigPort}`);
    await p.waitForFunction('window.__game && __game.state === "menu"', null, { timeout: 30000 });
    return p;
  };
  const [host, guest] = [await mk('host'), await mk('guest')];

  await host.click('#btnOnline');
  await host.click('#lbCreate');
  await host.waitForFunction(() => document.getElementById('lbRoom').style.display !== 'none', null, { timeout: 15000 });
  const code = (await host.textContent('#lbRoomCode')).trim();
  console.log('room code:', code);
  if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error('bad room code: ' + code);

  await guest.click('#btnOnline');
  await guest.fill('#lbCode', code);
  await guest.click('#lbJoin');
  await guest.waitForFunction(() => document.getElementById('lbRoom').style.display !== 'none', null, { timeout: 20000 });
  await host.waitForFunction(() => document.getElementById('lbPlayers').children.length === 2, null, { timeout: 20000 });
  console.log('host sees 2 players:', JSON.stringify(await host.$$eval('#lbPlayers > *', n => n.map(x => x.textContent.trim().slice(0, 30)))));
  console.log('guest sees', await guest.$$eval('#lbPlayers > *', n => n.length), 'players');

  await host.click('#lbStart');
  for (const [n, p] of [['host', host], ['guest', guest]]) {
    await p.waitForFunction(() => __game.state !== 'lobby', null, { timeout: 25000 });
    console.log(n, 'state after start:', await p.evaluate(() => __game.state));
  }
  await host.waitForTimeout(1500);
  const tags = await host.$eval('#ntags', e => e.children.length).catch(() => -1);
  console.log('host sees remote name tags:', tags);

  await host.context().close(); await guest.context().close();   // 4 software-GL pages at once starve a small CI box
  // Quick play: the first player claims the well-known id pfarm-q1, the second is refused (ID-TAKEN) and joins it instead.
  const [q1, q2] = [await mk('quick1'), await mk('quick2')];
  await q1.click('#btnOnline'); await q1.click('#lbQuick');
  await q1.waitForFunction(() => document.getElementById('lbRoom').style.display !== 'none', null, { timeout: 15000 });
  await q2.click('#btnOnline'); await q2.click('#lbQuick');
  await q1.waitForFunction(() => document.getElementById('lbPlayers').children.length === 2, null, { timeout: 25000 });
  console.log('quick play: both players matched in', await q1.textContent('#lbRoomCode'));

  console.log('page errors:', JSON.stringify(errs.slice(0, 5)));
  await browser.close(); sig.close(); web.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
