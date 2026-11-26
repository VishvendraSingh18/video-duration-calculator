'use strict';

const fs = require('fs');
const path = require('path');

async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const baseDir = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    '@ffprobe-installer'
  );

  if (!fs.existsSync(baseDir)) return;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const binPath = path.join(baseDir, entry.name, 'ffprobe');
    if (fs.existsSync(binPath)) {
      fs.chmodSync(binPath, 0o755);
    }
  }
}

afterPack.default = afterPack;
module.exports = afterPack;
