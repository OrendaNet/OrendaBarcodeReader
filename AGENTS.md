# Repository instructions

- Preserve Edge Console authentication. Do not add a separate app login.
- Access USB devices only through the vendored OrendaBox SDK and declared `usb:read` permission.
- Never expose host device paths or accept arbitrary paths from the browser.
- Keep scan data in memory unless a product requirement explicitly adds storage and the matching permission.
- Release images must be ARM64, digest pinned, and built on a native ARM64 runner.
