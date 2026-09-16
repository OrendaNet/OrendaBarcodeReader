'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

function fakeRuntime() {
  return { usb: {
    devices: async () => ({ devices: [{ id: `usb-${'a'.repeat(32)}`, name: 'Test Scanner', type: 'serial', vendor: 'Test', product: 'Scanner' }] }),
    read: async () => ({ dataBase64: '' })
  } };
}

async function start() {
  process.env.ORENDA_EDGE_APP_PROXY_SECRET = 'test-secret';
  const server = createServer(fakeRuntime());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'x-orenda-edge-proxy-secret': 'test-secret', 'x-orenda-auth-source': 'test', 'x-orenda-username': 'operator' };
  return { server, base, headers };
}

test('health is public while application routes require Edge authentication', async (t) => {
  const { server, base } = await start();
  t.after(() => { server.scanner.stop(); server.close(); });
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/`)).status, 401);
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
});

test('authenticated state returns only approved reader metadata', async (t) => {
  const { server, base, headers } = await start();
  t.after(() => { server.scanner.stop(); server.close(); });
  const response = await fetch(`${base}/api/state`, { headers });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.devices.length, 1);
  assert.equal(state.devices[0].name, 'Test Scanner');
  assert.equal(state.selectedId, `usb-${'a'.repeat(32)}`);
  assert.equal(JSON.stringify(state).includes('/dev/'), false);
});
