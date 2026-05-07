'use strict';

const electron = require('electron'),
    Menu = electron.Menu,
    dialog = electron.dialog,
    path = require('path'),
    app = electron.app,
    BrowserWindow = electron.BrowserWindow,
    ipcMain = electron.ipcMain,
    nativeTheme = electron.nativeTheme,
    _ = require('lodash');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // We couldn't obtain the lock.
    // This means another instance of the app is running.
    // So quitting the second instance.
    app.quit();
    return;
}

const userAgent = 'btt-writer-desktop';

app.setPath('userData', (function (dataDir) {
    const base = process.env.LOCALAPPDATA ||
        (process.platform === 'darwin' ?
            path.join(process.env.HOME, 'Library', 'Application Support') :
            path.join(process.env.HOME, '.config'));

    return path.join(base, dataDir);
})('BTT-Writer'));

// Lightweight reporter for main-process crashes. Shares the renderer's log file
// so the ticket includes the same recent context. No GitHub creds — main-process
// crashes go to the help desk only. The renderer reads the helpdesk token via
// the configurator; the main process has no configurator, so we pull it from
// defaults.json directly.
const mainReporter = (function () {
    try {
        const Reporter = require('./reporter').Reporter;
        const defaults = require('../config/defaults.json');
        const tokenEntry = defaults.find(function (e) { return e.name === 'helpdeskWebhookToken'; });
        return new Reporter({
            logPath: path.join(app.getPath('userData'), 'log.txt'),
            helpdeskWebhookToken: tokenEntry && tokenEntry.value,
            appVersion: require('../../package.json').version,
            verbose: true
        });
    } catch (e) {
        console.error('Failed to init main-process reporter:', e);
        return null;
    }
})();

let lastMainTicketAt = 0;
const MAIN_TICKET_THROTTLE_MS = 60 * 1000;
function submitMainTicket(summary, stack) {
    if (!mainReporter) return;
    const now = Date.now();
    if (now - lastMainTicketAt < MAIN_TICKET_THROTTLE_MS) return;
    lastMainTicketAt = now;
    mainReporter.sendHelpdeskTicket(summary, { isCrash: true, stack: stack })
        .catch(function (e) { console.error('helpdesk submit failed:', e && e.message); });
}

process.on('uncaughtException', function (err) {
    if (mainReporter) mainReporter.logError(err, 'Uncaught exception in main process');
    submitMainTicket('Main-process crash: ' + (err && err.message),
                     err && err.stack);
});

process.on('unhandledRejection', function (reason) {
    if (mainReporter) mainReporter.logError(reason, 'Unhandled rejection in main process');
    submitMainTicket('Main-process unhandled rejection: ' + (reason && (reason.message || reason)),
                     reason && reason.stack);
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let splashScreen;
let mainWindow;

function createMainSplash() {
    splashScreen = new BrowserWindow({
        width: 400,
        height: 170,
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        center: true,
        show: false,
        title: 'BTT Writer',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload-splash.js'),
        }
    });

    //splashScreen.webContents.openDevTools();

    splashScreen.loadURL('file://' + __dirname + '/../views/splash-screen.html', { userAgent });

    splashScreen.on('closed', function() {
        splashScreen = null;
    });
}

function createReloadSplash() {
    splashScreen = new BrowserWindow({
        width: 400,
        height: 170,
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        center: true,
        show: false,
        title: 'BTT Writer',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload-reload.js'),
        }
    });

    //splashScreen.webContents.openDevTools();

    splashScreen.loadURL('file://' + __dirname + '/../views/reload-screen.html', { userAgent });

    splashScreen.on('closed', function() {
        splashScreen = null;
    });
}

function createMainWindow () {

    mainWindow = new BrowserWindow({
        width: 980,
        height: 580,
        minWidth: 980,
        minHeight: 580,
        useContentSize: true,
        center: true,
        title: 'BTT Writer',
        backgroundColor: '#00796B',
        autoHideMenuBar: true,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload-main.js'),
        }
    });

    mainWindow.dataPath = app.getPath('userData');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });

    mainWindow.loadURL('file://' + __dirname + '/../views/index.html', { userAgent });

    mainWindow.on('closed', function() {
        mainWindow = null;
    });

    mainWindow.on('maximize', function () {
        mainWindow.webContents.send('maximize');
    });

    mainWindow.on('unmaximize', function () {
        mainWindow.webContents.send('unmaximize');
    });

    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    mainWindow.webContents.on('render-process-gone', function (event, details) {
        const reason = (details && details.reason) || 'unknown';
        if (mainReporter) mainReporter.logError(JSON.stringify(details), 'Renderer process gone');
        submitMainTicket('Renderer process gone: ' + reason, null);
    });

    mainWindow.webContents.on('preload-error', function (event, preloadPath, error) {
        if (mainReporter) mainReporter.logError(error, 'Preload error: ' + preloadPath);
        submitMainTicket('Preload error: ' + (error && error.message),
                         error && error.stack);
    });
}

function createAppMenus() {
    // Create the Application's main menu
    const path = require('path');
    const i18n = require('../js/i18n').Locale(path.resolve(path.join(__dirname, '..', '..', 'i18n')));
    const template = [
        {
            label: i18n.translate("application"),
            submenu: [
                { label: i18n.translate("about_application"), selector: "orderFrontStandardAboutPanel:" },
                { type: "separator" },
                { label: i18n.translate("quit"), accelerator: "Command+Q", click: function() { app.quit(); }}
            ]
        },
        {
            label: i18n.translate("edit"),
            submenu: [
                { label: i18n.translate("undo"), accelerator: "CmdOrCtrl+Z", selector: "undo:" },
                { label: i18n.translate("redo"), accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
                { type: "separator" },
                { label: i18n.translate("cut"), accelerator: "CmdOrCtrl+X", selector: "cut:" },
                { label: i18n.translate("copy"), accelerator: "CmdOrCtrl+C", selector: "copy:" },
                { label: i18n.translate("paste"), accelerator: "CmdOrCtrl+V", selector: "paste:" },
                { label: i18n.translate("select_all"), accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
            ]
        },
        {
            label: i18n.translate("view"),
            submenu: [
                {
                    label: i18n.translate("toggle_dev_tools"),
                    accelerator: "Shift+CmdOrCtrl+I",
                    click: function () {
                        const w = BrowserWindow.getFocusedWindow();
                        w && w.webContents.openDevTools();
                    }
                }
            ]
        },
        {
            label: "Debug",
            submenu: [
                {
                    label: "Throw error (main process)",
                    click: function () {
                        setImmediate(function () {
                            throw new Error('Test crash from Debug menu (main process) at ' + new Date().toISOString());
                        });
                    }
                },
                {
                    label: "Throw error (renderer)",
                    click: function () {
                        if (!mainWindow) return;
                        mainWindow.webContents.executeJavaScript(
                            "setTimeout(function () { throw new Error('Test crash from Debug menu (renderer) at ' + new Date().toISOString()); }, 0);"
                        );
                    }
                },
                {
                    label: "Force-kill renderer process",
                    click: function () {
                        if (mainWindow) mainWindow.webContents.forcefullyCrashRenderer();
                    }
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function reloadApplication() {
    if (splashScreen) {
        splashScreen.show();
    } else {
        createReloadSplash();
    }
    setTimeout(function () {
        if (splashScreen) splashScreen.show();
        setTimeout(function () {
            if (mainWindow) {
                mainWindow.hide();
                mainWindow.reload();
            }
        }, 500);
    }, 500);
}

ipcMain.on('main-window', function (event, arg) {
    const allowed = {
        'close': function () { mainWindow.close(); },
        'minimize': function () { mainWindow.minimize(); },
        'maximize': function () { mainWindow.maximize(); },
        'unmaximize': function () { mainWindow.unmaximize(); },
        'isMaximized': function () { return mainWindow.isMaximized(); },
        'dataPath': function () { return mainWindow.dataPath; }
    };

    if (allowed.hasOwnProperty(arg)) {
        const ret = allowed[arg]();
        event.returnValue = ret !== undefined ? ret : true;
    } else {
        event.returnValue = null;
    }
});

ipcMain.on('fire-reload', function () {
    reloadApplication();
});

ipcMain.on('save-as', function (event, arg) {
    dialog.showSaveDialog(mainWindow, arg.options)
        .then(function (saveTo) {
            event.returnValue = saveTo.filePath || saveTo.bookmark || false;
        });
});

ipcMain.on('open-file', function (event, arg) {
    dialog.showOpenDialog(mainWindow, arg.options)
        .then(function (value) {
            event.returnValue = !value.canceled && (value.filePaths || value.bookmarks) || false;
        });
});

ipcMain.on('loading-status', function (event, status) {
    splashScreen && splashScreen.webContents.send('loading-status', status);
});

ipcMain.on('main-loading-done', function () {
    if (splashScreen && mainWindow) {
        mainWindow.show();
        splashScreen.close();
    }
});

ipcMain.on('theme-changed', (event, theme) => {
    theme = theme.replace(/.*?(system|light|dark)/i, "$1").toLowerCase();
    nativeTheme.themeSource = theme;
    reloadApplication();
});

ipcMain.on('theme-loaded', (event, theme) => {
    theme = theme.replace(/.*?(system|light|dark)/i, "$1").toLowerCase();
    nativeTheme.themeSource = theme;
});

ipcMain.on('localization-changed', () => {
    reloadApplication();
});

ipcMain.on('show-devtools', () => {
    BrowserWindow.getFocusedWindow().webContents.openDevTools();
});

ipcMain.on('open-manual', function (event, url) {
    void electron.shell.openExternal(url);
});

ipcMain.on('debug-crash', function (event, target) {
    if (target === 'main') {
        setImmediate(function () {
            throw new Error('Test crash from sidebar Debug menu (main process) at ' + new Date().toISOString());
        });
    } else if (target === 'renderer-kill') {
        if (mainWindow) mainWindow.webContents.forcefullyCrashRenderer();
    }
});

ipcMain.on('update-spellcheck', function(event, enabled) {
    if (mainWindow) {
        mainWindow.webContents.session.setSpellCheckerEnabled(enabled);
    }
});

app.on('ready', function () {
    createAppMenus();
    createMainSplash();
    setTimeout(function () {
        splashScreen.show();
        createMainWindow();
    }, 500);
});

app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    // if (process.platform !== 'darwin') {
        app.quit();
    // }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createMainWindow();
    }
});

app.on('second-instance', function () {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    }
});
