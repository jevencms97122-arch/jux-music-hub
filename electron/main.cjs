'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const DISCORD_CLIENT_ID = '1501360327122620548';
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow = null;
let rpcClient = null;
let pendingPresence = null;
let rpcReady = false;

// ── Discord RPC ────────────────────────────────────────────────────────────────

function initDiscord() {
  try {
    const DiscordRPC = require('discord-rpc');
    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

    rpcClient.on('ready', () => {
      console.log('[Discord RPC] Connecté en tant que', rpcClient.user?.username);
      rpcReady = true;
      if (pendingPresence) {
        rpcClient.setActivity(pendingPresence).catch(() => {});
        pendingPresence = null;
      }
    });

    rpcClient.on('disconnected', () => {
      console.warn('[Discord RPC] Déconnecté');
      rpcReady = false;
      // Retry after 15s
      setTimeout(initDiscord, 15000);
    });

    rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch((err) => {
      console.warn('[Discord RPC] Connexion échouée (Discord ouvert ?):', err.message);
      // Retry after 15s
      setTimeout(initDiscord, 15000);
    });
  } catch (err) {
    console.warn('[Discord RPC] Module introuvable:', err.message);
  }
}

function applyActivity(presence) {
  if (!rpcClient || !rpcReady) {
    pendingPresence = presence;
    return;
  }
  rpcClient.setActivity(presence).catch(() => {});
}

function removeActivity() {
  pendingPresence = null;
  if (!rpcClient || !rpcReady) return;
  rpcClient.clearActivity().catch(() => {});
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.on('discord:updatePresence', (_, data) => {
  const activity = {
    details: (data.title || 'Sans titre').slice(0, 128),
    state: ('par ' + (data.author || 'Artiste inconnu')).slice(0, 128),
    largeImageKey: data.coverUrl || 'jux_logo',
    largeImageText: 'Jux Music',
    smallImageKey: data.isPlaying ? 'play' : 'pause',
    smallImageText: data.isPlaying ? 'En lecture' : 'En pause',
    instance: false,
  };

  if (data.isPlaying && data.startTimestamp) {
    activity.startTimestamp = data.startTimestamp;
  }

  applyActivity(activity);
});

ipcMain.on('discord:clearPresence', () => {
  removeActivity();
});

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    title: 'Nexora Music',
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080').catch((err) => {
      console.error('[Window] Impossible de charger le serveur de dev:', err.message);
      console.error('Lance "npm run dev" dans un autre terminal d\'abord.');
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  initDiscord();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (rpcClient) {
    try { rpcClient.destroy(); } catch {}
  }
  if (process.platform !== 'darwin') app.quit();
});
