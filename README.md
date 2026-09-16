# Orenda Barcode Reader

Orenda Barcode Reader displays scans from an approved USB barcode scanner connected to an OrendaBox. It supports scanners that expose a USB HID keyboard report or a serial port and keeps the latest 25 scans in memory for the current app process.

## Install

Install the app from Orenda App Market. During installation, approve the barcode scanner for the app's `usb:read` permission. Open the app from Edge Console and scan a barcode; no separate login or setup is required.

Only devices granted by the Box administrator are visible to the app. Scans are not written to disk or sent over the network. The active reader and in-memory history are shared by viewers of this app instance.

## Supported scanners

- USB HID keyboard scanners exposed by OrendaBox as an approved `hidraw` device
- USB serial scanners exposed as an approved `serial` device
- Barcode terminators: Enter, keypad Enter, Tab, carriage return, or line feed

A scanner exposed only as a Linux input-event device is not available through the OrendaBox app runtime. Configure it for HID raw or serial mode when the scanner supports either mode.

## Development

Requires Node.js 20 or newer.

```sh
npm run check
npm test
npm run dev
```

`npm run dev` serves the UI at `http://127.0.0.1:3100`. USB calls work only after the app is installed on an OrendaBox with its declared permission approved.

The release workflow builds natively on GitHub's ARM64 runner, publishes a digest-pinned image to GHCR, signs it with Cosign, and attaches a validated market manifest to the GitHub release.
