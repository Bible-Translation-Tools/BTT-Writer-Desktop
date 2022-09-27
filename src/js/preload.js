'use strict';

const { ipcRenderer } = require('electron');

window.darkMode = {
  set: (theme) => ipcRenderer.invoke('dark-mode:set', theme)
};