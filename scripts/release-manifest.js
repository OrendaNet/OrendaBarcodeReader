'use strict';
const fs = require('node:fs');
const { validateManifest } = require('../sdk/manifest');
const manifest = require('../orenda-app.json');
const version = require('../package.json').version;
const digest = process.env.IMAGE_DIGEST;
if (!/^sha256:[a-f0-9]{64}$/.test(digest || '')) throw new Error('Provide the published ARM64 image digest');
manifest.versions = [{
  version,
  image: `ghcr.io/orendanet/orenda-barcode-reader@${digest}`,
  digest,
  architectures: ['arm64'],
  minPlatformVersion: '0.2.45',
  releaseNotes: 'Initial release. Reads approved USB HID keyboard and serial barcode scanners, shows the latest scan and a 25-item in-memory history, and stops reading when the app is closed. Requires the usb:read permission and a compatible approved scanner.'
}];
const errors = validateManifest(manifest, { release: true });
if (errors.length) throw new Error(errors.join('\n'));
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/orenda-app.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Validated ${manifest.id} ${version} for ARM64`);
