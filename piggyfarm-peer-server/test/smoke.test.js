'use strict';
// Protocol-level smoke test (no browser): health, CORS allow/deny, and a real PeerJS WebSocket handshake.
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');

process.env.ALLOWED_ORIGINS = 'https://appassets.androidplatform.net';
const { createApp } = require('../server');

let server, base, port;
test.before(async () => {
  ({ server } = createApp());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});
test.after(() => new Promise(r => server.close(r)));

test('GET /healthz is ok', async () => {
  const r = await fetch(`${base}/healthz`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test('id endpoint: CORS allows the app origin, not a stranger', async () => {
  const ok = await fetch(`${base}/peerjs/id?key=peerjs`, { headers: { Origin: 'https://appassets.androidplatform.net' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  const bad = await fetch(`${base}/peerjs/id?key=peerjs`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

const open = (id) => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/peerjs?key=peerjs&id=${id}&token=t-${id}`);
  const t = setTimeout(() => reject(new Error('no OPEN from server')), 4000);
  ws.on('message', m => { if (JSON.parse(m).type === 'OPEN') { clearTimeout(t); resolve(ws); } });
  ws.on('error', reject);
});

test('two peers handshake and an OFFER is relayed A -> B', async () => {
  const a = await open('pfarm-AAAAA');
  const b = await open('pfarm-BBBBB');
  const got = new Promise(res => b.on('message', m => { const j = JSON.parse(m); if (j.type === 'OFFER') res(j); }));
  a.send(JSON.stringify({ type: 'OFFER', dst: 'pfarm-BBBBB', payload: { sdp: 'x', type: 'offer', connectionId: 'c1' } }));
  const offer = await got;
  assert.equal(offer.src, 'pfarm-AAAAA');
  a.close(); b.close();
});

test('an id that is already taken is refused (quick play relies on this)', async () => {
  const a = await open('pfarm-q1');
  const second = new WebSocket(`ws://127.0.0.1:${port}/peerjs?key=peerjs&id=pfarm-q1&token=other`);
  const msg = await new Promise((res, rej) => { second.on('message', m => res(JSON.parse(m))); setTimeout(() => rej(new Error('no reply')), 4000); });
  assert.equal(msg.type, 'ID-TAKEN');
  a.close(); second.close();
});
