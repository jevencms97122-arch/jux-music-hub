'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const APP_VERSION = '1.0.5';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  updateDiscordPresence: (data) => ipcRenderer.send('discord:updatePresence', data),
  clearDiscordPresence: () => ipcRenderer.send('discord:clearPresence'),
});

// Bridge lu par versionCheck.ts pour savoir si une MAJ est dispo
contextBridge.exposeInMainWorld('JuxDesktop', {
  getAppVersion: () => APP_VERSION,
});
