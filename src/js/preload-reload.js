/**
 * Preload script for the reload splash screen window.
 * Exposes only the APIs needed by reload-screen.html via contextBridge.
 */

'use strict';

const { contextBridge } = require('electron');
const path = require('path');
const i18n = require('../js/i18n').Locale(path.resolve(path.join(__dirname, '..', '..', 'i18n')));
const Configurator = require('../js/configurator').Configurator;

const configurator = new Configurator();
configurator.setStorage(localStorage);
const theme = configurator.getUserSetting("colortheme").name;

const loc = configurator.getUserSetting("localization");
if (loc) i18n.setLocale(loc.id);

contextBridge.exposeInMainWorld('reloadAPI', {
    translate: function (key, val) {
        return i18n.translate(key, val);
    }
});
