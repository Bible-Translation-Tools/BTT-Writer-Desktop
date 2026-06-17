'use strict';

const electron = require('electron'),
    Menu = electron.Menu,
    dialog = electron.dialog,
    path = require('path'),
    app = electron.app,
    BrowserWindow = electron.BrowserWindow,
    ipcMain = electron.ipcMain,
    nativeTheme = electron.nativeTheme,
    _ = require('lodash'),
    unhandled = require('electron-unhandled');

// Lightweight reporter for logging main-process crashes only.
// Sending crash reports won't work
const mainReporter = (function () {
    try {
        const Reporter = require('../js/reporter').Reporter;
        return new Reporter({
            logPath: path.join(app.getPath('userData'), 'log.txt'),
            verbose: true
        });
    } catch (e) {
        console.error('Failed to init main-process reporter:', e);
        return null;
    }
})();

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
        const message = "The application rendering process has crashed."
        const error = new Error(message);
        error.stack = `Reason: ${details.reason}\nExit Code: ${details.exitCode}`;

        mainReporter?.logWithCaller('E', error, message, "Unknown");

        createCrashReportWindow(error);
    });

    mainWindow.webContents.on('preload-error', function (event, preloadPath, error) {
        const message = "Preload script has crashed"
        const updatedError = new Error(message);
        updatedError.stack = error.stack;

        mainReporter?.logWithCaller('E', error, message, preloadPath.split(/[\/\\]/).pop());

        createCrashReportWindow(updatedError);
    });
}

function createCrashReportWindow(error) {
    const bounds = mainWindow.getBounds();

    const errorWin = new BrowserWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        show: false,
        resizable: false,
        frame: false,
        transparent: true,
        movable: false,
        modal: true,
        parent: mainWindow,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload-crash.js')
        }
    });

    ipcMain.removeHandler('get-error-data');
    ipcMain.handle('get-error-data', () => ({
        message: error.message,
        stack: error.stack
    }));

    errorWin.loadFile(__dirname + '/../views/crash-dialog.html');

    errorWin.once('ready-to-show', () => errorWin.show());

    const handleResize = () => {
        if (!errorWin.isDestroyed()) {
            errorWin.setBounds(mainWindow.getBounds());
        }
    };

    mainWindow.on('resize', handleResize);
    mainWindow.on('move', handleResize);

    errorWin.on('closed', () => {
        ipcMain.removeHandler('get-error-data');
        mainWindow.removeListener('resize', handleResize);
        mainWindow.removeListener('move', handleResize);
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

// IPC Main listeners

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
    console.log("debug crash triggered")
    if (target === 'main') {
        setImmediate(function () {
            throw new Error('Test crash from sidebar Debug menu (main process) at ' + new Date().toISOString());
        });
    } else if (target === 'renderer-kill') {
        setTimeout(function () {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.forcefullyCrashRenderer();
            }
        }, 50);
    }
});

ipcMain.on('update-spellcheck', function(event, enabled) {
    if (mainWindow) {
        mainWindow.webContents.session.setSpellCheckerEnabled(enabled);
    }
});

ipcMain.on('renderer-exception', function (event, data) {
    const {message, stack} = data;
    const error = new Error(message);
    error.stack = stack;

    createCrashReportWindow(error)
});

ipcMain.on('close-crash-dialog', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();

    if (mainWindow) {
        mainWindow.reload()
    }
});

// App listeners

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

// Global exception handler
unhandled({
    logger: error => {
        mainReporter?.logError(error, error.message);
        createCrashReportWindow(error);
    },
    showDialog: false
});
