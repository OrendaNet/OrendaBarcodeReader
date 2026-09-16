'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { authenticateEdgeRequest, createRuntimeClient } = require('./sdk');
const { BarcodeDecoder } = require('./barcode');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const PUBLIC = path.join(__dirname, 'public');
const runtime = createRuntimeClient();

class ScannerService {
  constructor(client, { retryMs = 1000, viewerTimeoutMs = 12000 } = {}) {
    this.client = client;
    this.retryMs = retryMs;
    this.viewerTimeoutMs = viewerTimeoutMs;
    this.devices = [];
    this.selectedId = '';
    this.decoder = null;
    this.scans = [];
    this.error = '';
    this.lastDevicesAt = 0;
    this.lastViewerAt = 0;
    this.running = false;
    this.timer = null;
  }

  touch() {
    this.lastViewerAt = Date.now();
    if (!this.running) this.start();
  }

  async refreshDevices(force = false) {
    if (!force && Date.now() - this.lastDevicesAt < 5000) return this.devices;
    const response = await this.client.usb.devices();
    const devices = Array.isArray(response) ? response : response.devices;
    this.devices = (Array.isArray(devices) ? devices : []).filter((device) => device && ['hidraw', 'serial'].includes(device.type));
    this.lastDevicesAt = Date.now();
    if (!this.devices.some((device) => device.id === this.selectedId)) this.select(this.devices[0]?.id || '');
    return this.devices;
  }

  select(id) {
    const device = this.devices.find((item) => item.id === id);
    if (id && !device) throw Object.assign(new Error('Choose an approved barcode reader'), { status: 400 });
    this.selectedId = device?.id || '';
    this.decoder = device ? new BarcodeDecoder(device.type, (value) => this.addScan(value)) : null;
    this.error = '';
  }

  addScan(value) {
    this.scans.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value, scannedAt: new Date().toISOString() });
    this.scans.length = Math.min(this.scans.length, 25);
  }

  state() {
    return {
      devices: this.devices.map(({ id, name, type, vendor, product }) => ({ id, name: name || product || 'USB barcode reader', type, vendor, product })),
      selectedId: this.selectedId,
      status: !this.selectedId ? 'waiting' : this.error ? 'error' : this.running ? 'listening' : 'idle',
      error: this.error,
      scans: this.scans
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  async loop() {
    if (!this.running) return;
    let delay = 0;
    try {
      if (Date.now() - this.lastViewerAt > this.viewerTimeoutMs) {
        this.running = false;
        return;
      }
      if (!this.selectedId || !this.decoder) await this.refreshDevices();
      if (this.selectedId && this.decoder) {
        const read = await this.client.usb.read(this.selectedId, { maxBytes: 4096, timeoutMs: 5000 });
        this.decoder.pushRead(read);
        this.error = '';
      } else delay = this.retryMs;
    } catch (error) {
      this.error = safeError(error);
      delay = this.retryMs;
      if (error.status === 403 || error.status === 404) {
        this.selectedId = '';
        this.decoder = null;
      }
    }
    if (this.running) this.timer = setTimeout(() => this.loop(), delay);
  }
}

function safeError(error) {
  const message = String(error?.message || 'Barcode reader is unavailable').replace(/[\r\n\t]/g, ' ').slice(0, 180);
  return message || 'Barcode reader is unavailable';
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

function readJson(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let body = '';
    let failed = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (failed) return;
      body += chunk;
      if (body.length > limit) {
        failed = true;
        body = '';
        reject(Object.assign(new Error('Request is too large'), { status: 413 }));
      }
    });
    req.on('end', () => {
      if (failed) return;
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function serveAsset(route, res) {
  const filename = route === '/' ? 'index.html' : route.slice(1);
  if (!['index.html', 'app.js', 'style.css', 'icon.svg'].includes(filename)) return false;
  const file = path.join(PUBLIC, filename);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': filename === 'index.html' ? 'no-store' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
  res.end(fs.readFileSync(file));
  return true;
}

function createServer(client = runtime) {
  const scanner = new ScannerService(client);
  const server = http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && route === '/health') return sendJson(res, 200, { ok: true });
    const user = authenticateEdgeRequest(req.headers);
    if (!user) return sendJson(res, 401, { error: 'Open this app from Edge Console to continue' });
    try {
      if (req.method === 'GET' && route === '/api/state') {
        scanner.touch();
        await scanner.refreshDevices();
        return sendJson(res, 200, scanner.state());
      }
      if (req.method === 'POST' && route === '/api/device') {
        const { id } = await readJson(req);
        await scanner.refreshDevices(true);
        scanner.select(id);
        scanner.touch();
        return sendJson(res, 200, scanner.state());
      }
      if (req.method === 'POST' && route === '/api/clear') {
        scanner.scans = [];
        return sendJson(res, 200, scanner.state());
      }
      if (req.method === 'GET' && serveAsset(route, res)) return;
      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      return sendJson(res, error.status || 503, { error: safeError(error) });
    }
  });
  server.scanner = scanner;
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(Number(process.env.PORT || 3101), process.env.HOST || '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.scanner.stop(); server.close(); });
}

module.exports = { ScannerService, createServer };
