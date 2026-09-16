'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BarcodeDecoder } = require('../barcode');

function report(modifier, ...keys) { return Buffer.from([modifier, 0, ...keys, ...Array(Math.max(0, 6 - keys.length)).fill(0)]); }
function tap(decoder, modifier, code) { decoder.pushHidReport(report(modifier, code)); decoder.pushHidReport(report(0)); }

test('serial input preserves fragments and emits complete non-empty lines', () => {
  const scans = [];
  const decoder = new BarcodeDecoder('serial', (value) => scans.push(value));
  decoder.pushRead({ dataBase64: Buffer.from('ABC1').toString('base64') });
  decoder.pushRead({ dataBase64: Buffer.from('23\r\n\nXYZ\n').toString('base64') });
  assert.deepEqual(scans, ['ABC123', 'XYZ']);
});

test('HID keyboard reports decode letters, shifted symbols, digits and enter', () => {
  const scans = [];
  const decoder = new BarcodeDecoder('hidraw', (value) => scans.push(value));
  tap(decoder, 0x02, 4);  // A
  tap(decoder, 0, 5);     // b
  tap(decoder, 0, 30);    // 1
  tap(decoder, 0x02, 30); // !
  tap(decoder, 0, 40);    // Enter
  assert.deepEqual(scans, ['Ab1!']);
});

test('HID reports use the SDK base64 array response', () => {
  const scans = [];
  const decoder = new BarcodeDecoder('hidraw', (value) => scans.push(value));
  decoder.pushRead({ reports: [report(0, 4).toString('base64'), report(0).toString('base64'), report(0, 40).toString('base64')] });
  assert.deepEqual(scans, ['a']);
});

test('HID report ids and held keys are handled safely', () => {
  const scans = [];
  const decoder = new BarcodeDecoder('hidraw', (value) => scans.push(value));
  decoder.pushHidReport(Buffer.from([1, 0, 0, 27, 0, 0, 0, 0, 0]));
  decoder.pushHidReport(Buffer.from([1, 0, 0, 27, 0, 0, 0, 0, 0]));
  decoder.pushHidReport(Buffer.from([1, 0, 0, 0, 0, 0, 0, 0, 0]));
  decoder.pushHidReport(Buffer.from([1, 0, 0, 40, 0, 0, 0, 0, 0]));
  assert.deepEqual(scans, ['x']);
});
