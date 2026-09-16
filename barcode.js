'use strict';

const KEY_CODES = new Map();
for (let code = 4; code <= 29; code += 1) KEY_CODES.set(code, [String.fromCharCode(93 + code), String.fromCharCode(61 + code)]);
for (let code = 30; code <= 38; code += 1) KEY_CODES.set(code, [String(code - 29), '!@#$%^&*('[code - 30]]);
KEY_CODES.set(39, ['0', ')']);
[
  [44, ' ', ' '], [45, '-', '_'], [46, '=', '+'], [47, '[', '{'], [48, ']', '}'],
  [49, '\\', '|'], [51, ';', ':'], [52, "'", '"'], [53, '`', '~'], [54, ',', '<'],
  [55, '.', '>'], [56, '/', '?'], [85, '*', '*'], [86, '-', '-'], [87, '+', '+'],
  [89, '1', '1'], [90, '2', '2'], [91, '3', '3'], [92, '4', '4'], [93, '5', '5'],
  [94, '6', '6'], [95, '7', '7'], [96, '8', '8'], [97, '9', '9'], [98, '0', '0'],
  [99, '.', '.']
].forEach(([code, plain, shifted]) => KEY_CODES.set(code, [plain, shifted]));

class BarcodeDecoder {
  constructor(type, onScan) {
    this.type = type;
    this.onScan = onScan;
    this.pending = '';
    this.previousKeys = new Set();
  }

  pushRead(read) {
    if (this.type === 'hidraw') {
      const reports = Array.isArray(read?.reports) ? read.reports : [];
      for (const report of reports) {
        const dataBase64 = typeof report === 'string' ? report : report?.dataBase64;
        if (dataBase64) this.pushHidReport(Buffer.from(dataBase64, 'base64'));
      }
      return;
    }
    if (read?.dataBase64) this.pushSerial(Buffer.from(read.dataBase64, 'base64'));
  }

  pushSerial(bytes) {
    const text = bytes.toString('utf8').replace(/\0/g, '');
    for (const character of text) {
      if (character === '\r' || character === '\n') this.finish();
      else if (this.pending.length < 512) this.pending += character;
    }
  }

  pushHidReport(report) {
    if (report.length < 8) return;
    const offset = report.length >= 9 && report[0] !== 0 ? 1 : 0;
    if (report.length < offset + 8) return;
    const modifier = report[offset];
    const keys = new Set([...report.subarray(offset + 2, offset + 8)].filter(Boolean));
    const shift = Boolean(modifier & 0x22);
    for (const code of keys) {
      if (this.previousKeys.has(code)) continue;
      if (code === 40 || code === 43 || code === 88) this.finish();
      else if (code === 42) this.pending = this.pending.slice(0, -1);
      else {
        const pair = KEY_CODES.get(code);
        if (pair && this.pending.length < 512) this.pending += pair[shift ? 1 : 0];
      }
    }
    this.previousKeys = keys;
  }

  finish() {
    const value = this.pending.trim();
    this.pending = '';
    if (value) this.onScan(value);
  }
}

module.exports = { BarcodeDecoder };
