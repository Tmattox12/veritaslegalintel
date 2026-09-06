/**
 * On-Prem Tunnel — Azure Relay Hybrid Connection listener (scaffold).
 *
 * When TUNNEL_MODE=relay, this connects OUTBOUND from your on-prem server to
 * an Azure Relay Hybrid Connection, so the Azure-hosted frontend can reach the
 * local API without you opening any inbound firewall ports.
 *
 * This is OPTIONAL. Default (TUNNEL_MODE unset or 'none') does nothing and the
 * app runs purely locally.
 *
 * To enable:
 *   1. npm install hyco-https
 *   2. Set TUNNEL_MODE=relay and RELAY_* values in .env
 *   3. The server starts the relay listener in addition to the local listener.
 */

function startTunnel(localPort) {
  const mode = (process.env.TUNNEL_MODE || 'none').toLowerCase();
  if (mode !== 'relay') {
    return null; // local-only
  }

  const ns = process.env.RELAY_NAMESPACE;
  const path = process.env.RELAY_CONNECTION_NAME;
  const keyName = process.env.RELAY_KEY_NAME;
  const key = process.env.RELAY_KEY;

  if (!ns || !path || !keyName || !key) {
    console.warn('⚠ TUNNEL_MODE=relay but RELAY_* settings are incomplete. Tunnel disabled.');
    return null;
  }

  let relay;
  try {
    relay = require('hyco-https');
  } catch (e) {
    console.warn('⚠ Tunnel requested but package "hyco-https" is not installed.');
    console.warn('  Run: npm install hyco-https');
    return null;
  }

  const uri = relay.getRelayHttpsUri(ns, path);
  const server = relay.createRelayedServer(
    {
      server: relay.getRelayHttpsUri(ns, path),
      token: () => relay.createRelayToken(uri, keyName, key),
    },
    (req, res) => {
      // Proxy the relayed request to the local Express app on localPort.
      const http = require('http');
      const options = {
        hostname: '127.0.0.1',
        port: localPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      };
      const proxy = http.request(options, (pRes) => {
        res.writeHead(pRes.statusCode, pRes.headers);
        pRes.pipe(res);
      });
      proxy.on('error', (err) => {
        res.statusCode = 502;
        res.end('Local API unavailable: ' + err.message);
      });
      req.pipe(proxy);
    }
  );

  server.listen((err) => {
    if (err) {
      console.error('Relay listen error:', err);
      return;
    }
    console.log(`✓ On-prem tunnel active: ${relay.getRelayHttpsUri(ns, path)}`);
  });

  return server;
}

module.exports = { startTunnel };
