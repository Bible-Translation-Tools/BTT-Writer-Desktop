/**
 * Preload script for the splash screen window.
 * Exposes only the APIs needed by splash-screen.html via contextBridge.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const pack = require('../../package.json');
const i18n = require('../js/i18n').Locale(path.resolve(path.join(__dirname, '..', '..', 'i18n')));
const Configurator = require('../js/configurator').Configurator;

const configurator = new Configurator();
configurator.setStorage(localStorage);
const theme = configurator.getUserSetting("colortheme").name;

const loc = configurator.getUserSetting("localization");
if (loc) i18n.setLocale(loc.id);

contextBridge.exposeInMainWorld('splashAPI', {
    version: pack.version,
    theme: theme,
    translate: function (key, val) {
        return i18n.translate(key, val);
    },
    sendThemeLoaded: function () {
        ipcRenderer.send('theme-loaded', theme);
    },
    onLoadingStatus: function (callback) {
        ipcRenderer.on('loading-status', function (_event, status) {
            callback(status);
        });
    }
});
