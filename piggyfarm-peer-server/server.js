'use strict';
/**
 * Piggy Farm signaling server (PeerJS).
 *
 * It only brokers the WebRTC handshake (offer/answer/ICE) between phones. Game traffic then flows
 * peer-to-peer, so this process stays tiny: no game state, no accounts, nothing written to disk.
 *
 * Config (environment variables):
 *   PORT             listen port                                   default 9000
 *   PEER_PATH        mount path; must match PIGGY_PEER.path        default /
 *   PEER_KEY         API key; must match PIGGY_PEER.key if changed default peerjs
 *   ALLOWED_ORIGINS  comma list of browser origins allowed (CORS)  default https://appassets.androidplatform.net
 *                    use * to allow any origin (e.g. when you also host the web build yourself)
 *   MAX_PEERS        concurrent connected peers                    default 2000
 *   TRUST_PROXY      1 when behind Fly/Render/nginx/Caddy (client IP from X-Forwarded-For)  default 1
 */
const http = require('http');
const express = require('express');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');

const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };

const PORT = num(process.env.PORT, 9000);
const PEER_PATH = (process.env.PEER_PATH || '/').replace(/\/+$/, '') || '/';
const KEY = process.env.PEER_KEY || 'peerjs';
const MAX_PEERS = num(process.env.MAX_PEERS, 2000);
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://appassets.androidplatform.net')
  .split(',').map(s => s.trim()).filter(Boolean);
const ANY_ORIGIN = ORIGINS.includes('*');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if ((process.env.TRUST_PROXY || '1') !== '0') app.set('trust proxy', 1);

  // A browser at an origin that is not on the list gets no CORS headers, so the PeerJS client's
  // id request fails and nobody can use your server from another site.
  const corsOptions = {
    origin: ANY_ORIGIN ? true : (origin, cb) => cb(null, !origin || ORIGINS.includes(origin)),
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 600,
  };

  // Health check for the platform (Fly/Render/Docker). Not part of the PeerJS protocol.
  app.get('/healthz', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

  const server = http.createServer(app);
  const peerServer = ExpressPeerServer(server, {
    path: PEER_PATH,
    key: KEY,
    proxied: true,               // behind a TLS-terminating proxy
    allow_discovery: false,      // nobody can list connected peer ids
    concurrent_limit: MAX_PEERS,
    alive_timeout: 60000,        // drop silent peers after 60 s
    corsOptions,
  });

  peerServer.on('connection', c => console.log(`[peer] + ${c.getId()}`));
  peerServer.on('disconnect', c => console.log(`[peer] - ${c.getId()}`));
  peerServer.on('error', e => console.error('[peer] error', e && e.message));

  // PeerJS answers under <PEER_PATH>/peerjs/* (id, peers) and the WebSocket at <PEER_PATH>/peerjs.
  app.use('/', peerServer);
  return { app, server, peerServer };
}

if (require.main === module) {
  const { server } = createApp();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Piggy Farm signaling on :${PORT} path=${PEER_PATH} key=${KEY} origins=${ORIGINS.join(',')}`);
  });
  const stop = sig => { console.log(`${sig}: shutting down`); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

module.exports = { createApp };
