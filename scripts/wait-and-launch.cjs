'use strict';

// Attend que le serveur Vite soit prêt sur http://localhost:8080,
// puis lance Electron.
const http = require('http');
const { spawn } = require('child_process');

const MAX_WAIT_MS = 60000;
const POLL_MS = 800;
const start = Date.now();

function check() {
  http.get('http://localhost:8080', (res) => {
    if (res.statusCode < 500) {
      console.log('[wait-and-launch] Vite prêt, lancement Electron...');
      const proc = spawn(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['electron', '.'],
        { stdio: 'inherit', shell: false }
      );
      proc.on('exit', (code) => process.exit(code ?? 0));
    } else {
      retry();
    }
  }).on('error', retry);
}

function retry() {
  if (Date.now() - start > MAX_WAIT_MS) {
    console.error('[wait-and-launch] Timeout : Vite ne répond pas sur :8080');
    process.exit(1);
  }
  setTimeout(check, POLL_MS);
}

check();
