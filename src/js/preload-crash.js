/**
 * Preload script for the crash dialog screen window.
 * Exposes only the APIs needed by crash-dialog.html via contextBridge.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const i18n = require('../js/i18n').Locale(path.resolve(path.join(__dirname, '..', '..', 'i18n')));
const Configurator = require('../js/configurator').Configurator;

const configurator = new Configurator();
configurator.setStorage(localStorage);

const Reporter = require('../js/reporter').Reporter;
const reporter = new Reporter({
    configurator: configurator,
    verbose: true
});

const loc = configurator.getUserSetting("localization");
if (loc) i18n.setLocale(loc.id);

const SEND_CHANNELS = ['close-crash-dialog'];
const ON_CHANNELS = ['error-data'];

const safeIpc = {
    send: function (channel) {
        if (SEND_CHANNELS.indexOf(channel) !== -1) {
            const args = [].slice.call(arguments);
            ipcRenderer.send.apply(ipcRenderer, args);
        }
    },
    on: function (channel, callback) {
        if (ON_CHANNELS.indexOf(channel) !== -1) {
            ipcRenderer.on(channel, function () {
                const args = [].slice.call(arguments, 1);
                callback.apply(null, args);
            });
        }
    }
};

contextBridge.exposeInMainWorld('crashAPI', {
    ipc: safeIpc,
    reporter: reporter,
    translate: function (key, val) {
        return i18n.translate(key, val);
    }
});
