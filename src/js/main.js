'use strict';

var electron = require('electron'),
    Menu = electron.Menu,
    dialog = electron.dialog,
    path = require('path'),
    app = electron.app,
    BrowserWindow = electron.BrowserWindow,
    ipcMain = electron.ipcMain,
    nativeTheme = electron.nativeTheme;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // We couldn't obtain the lock.
    // This means another instance of the app is running.
    // So quitting the second instance.
    app.quit();
    return;
}

const userAgent = 'btt-writer-desktop'

app.setPath('userData', (function (dataDir) {
    var base = process.env.LOCALAPPDATA ||
        (process.platform == 'darwin'
            ? path.join(process.env.HOME, 'Library', 'Application Support')
            : path.join(process.env.HOME, '.config'));

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
            nodeIntegration: true,
            contextIsolation: false,
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
            nodeIntegration: true,
            contextIsolation: false,
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
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.dataPath = app.getPath('userData');

    // mainWindow.webContents.openDevTools();

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
}

function createAppMenus() {
    // Create the Application's main menu
    var path = require('path');
    var i18n = require('../js/i18n').Locale(path.resolve(path.join(__dirname, '..', '..', 'i18n')));
    var template = [
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
                        var w = BrowserWindow.getFocusedWindow();
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
        splashScreen.show();
        setTimeout(function () {
            if (mainWindow) {
                mainWindow.hide();
                mainWindow.reload();
            }
        }, 500);
    }, 500);
}

ipcMain.on('main-window', function (event, arg) {
    if (typeof mainWindow[arg] === 'function') {
        let ret = mainWindow[arg]();
        event.returnValue = !!ret;
    } else if (mainWindow[arg]) {
        event.returnValue = mainWindow[arg];
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
