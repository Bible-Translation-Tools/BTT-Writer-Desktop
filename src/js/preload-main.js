/**
 * Preload script for the main application window.
 * Initializes the app context and exposes it
 * to the renderer via contextBridge (nodeIntegration is disabled).
 */

'use strict';

const { contextBridge, ipcRenderer, shell, clipboard } = require('electron');

/*
 * Redirect all standard output to the console.
 * NB: This is required for the sql.js library to work.
 */
process.stderr.write = console.error.bind(console);
process.stdout.write = console.log.bind(console);

(function () {
    const setMsg = function (msg) {
        ipcRenderer.send('loading-status', msg);
    };

    setMsg('Bootstrapping...');

    const DATA_PATH = ipcRenderer.sendSync('main-window', 'dataPath');

    // stub globals
    let path = null;
    let fs = null;
    let mkdirp = null;
    let Db = null;
    let Reporter = null;
    let Configurator = null;
    let GitManager = null;
    let KeyManager = null;
    let ProjectsManager = null;
    let MigrateManager = null;
    let DataManager = null;
    let UserManager = null;
    let ImportManager = null;
    let ExportManager = null;
    let PrintManager = null;
    let Renderer = null;
    let i18n = null;
    let utils = null;
    let sanitize = null;

    // Load and initialize configurator first, because it's necessary to get user selected localization language
    try {
        setMsg('Loading path...');
        path = require('path');
        fs = require('fs');
        require('fs-extra');

        setMsg("Loading Configurator...");
        Configurator = require('../js/configurator').Configurator;
    } catch(err) {
        setMsg(err.message);
        throw err;
    }

    // TODO: refactor this so we can just pass an object to the constructor
    const configurator = (function () {
        const c = new Configurator();
        c.setStorage(localStorage);

        const defaults = require('../config/defaults');

        try {
            const privateDefaults = require('../config/private.json');
            c.loadConfig(privateDefaults);
        } catch (e) {
            console.info('No private settings.');
        }

        c.loadConfig(defaults);
        c.setValue('rootDir', DATA_PATH, {'mutable': false});
        c.setValue('targetTranslationsDir', path.join(DATA_PATH, 'targetTranslations'), {'mutable': false});
        c.setValue('tempDir', path.join(DATA_PATH, 'temp'), {'mutable': false});
        c.setValue('libraryDir', path.join(DATA_PATH, 'library'), {'mutable': false});
        c.setValue('indexDir', path.join(DATA_PATH, 'index'), {'mutable': false});
        return c;
    })();

    // catch startup errors
    try {
        setMsg('Loading Locale...');
        const loc = configurator.getUserSetting("localization");
        i18n = require('../js/i18n').Locale(path.resolve(path.join(__dirname, '..', '..', 'i18n')));
        if (loc) i18n.setLocale(loc.id);

        setMsg(i18n.translate("loading_mkdirp"));
        mkdirp = require('mkdirp');

        setMsg(i18n.translate("loading_db"));
        Db = require('door43-client-fork');

        setMsg(i18n.translate("loading_reporter"));
        Reporter = require('../js/reporter').Reporter;

        setMsg(i18n.translate("loading_git_mgr"));
        GitManager = require('../js/gitnative').GitManager;

        setMsg(i18n.translate("loading_key_mgr"));
        KeyManager = require('../js/keys').KeyManager;

        setMsg(i18n.translate("loading_projects_mgr"));
        ProjectsManager = require('../js/projects').ProjectsManager;

        setMsg(i18n.translate("loading_migrate_mgr"));
        MigrateManager = require('../js/migrator').MigrateManager;

        setMsg(i18n.translate("loading_data_mgr"));
        DataManager = require('../js/database').DataManager;

        setMsg(i18n.translate("loading_user_mgr"));
        UserManager = require('../js/user').UserManager;

        setMsg(i18n.translate("loading_import_mgr"));
        ImportManager = require('../js/importer').ImportManager;

        setMsg(i18n.translate("loading_export_mgr"));
        ExportManager = require('../js/exporter').ExportManager;

        setMsg(i18n.translate("loading_print_mgr"));
        PrintManager = require('../js/printer').PrintManager;

        setMsg(i18n.translate("loading_renderer"));
        Renderer = require('../js/render').Renderer;

        setMsg(i18n.translate("loading_utils"));
        utils = require('../js/lib/utils');

        sanitize = require('../js/lib/sanitize');
        const spellcheckEnabled = configurator.getUserSetting("enable_spell_checking");
        ipcRenderer.send('update-spellcheck', spellcheckEnabled);
    } catch (err) {
        setMsg(err.message);
        throw err;
    }
    setMsg(i18n.translate("init_config"));

    const reporter = new Reporter({
        logPath: path.join(configurator.getValue('rootDir'), 'log.txt'),
        oauthToken: configurator.getValue('github-oauth'),
        repoOwner: configurator.getValue('repoOwner'),
        repo: configurator.getValue('repo'),
        maxLogFileKb: configurator.getValue('maxLogFileKb'),
        helpdeskWebhookToken: configurator.getValue('helpdeskWebhookToken'),
        appVersion: require('../../package.json').version,
        verbose: true
    });

    // Funnel uncaught renderer errors to both the log and the help desk.
    // Throttled so a tight error loop doesn't spam tickets.
    let lastTicketAt = 0;
    const TICKET_THROTTLE_MS = 60 * 1000;
    const submitTicket = function (summary, stack) {
        const now = Date.now();
        if (now - lastTicketAt < TICKET_THROTTLE_MS) return;
        lastTicketAt = now;
        reporter.sendHelpdeskTicket(summary, { isCrash: true, stack: stack })
            .catch(function (e) { console.error('helpdesk submit failed:', e && e.message); });
    };

    window.addEventListener('error', function (event) {
        const err = event.error || event.message;
        reporter.logError(err, 'Uncaught renderer error');
        submitTicket('Renderer error: ' + (event.message || 'unknown'),
                     event.error && event.error.stack);
    });

    window.addEventListener('unhandledrejection', function (event) {
        const reason = event.reason;
        reporter.logError(reason, 'Unhandled promise rejection');
        submitTicket('Unhandled rejection: ' + (reason && (reason.message || reason)),
                     reason && reason.stack);
    });

    const dataManager = (function () {
        const libraryDir = configurator.getValue('libraryDir');
        const libraryPath = path.join(libraryDir, "index.sqlite");
        const srcDir = path.resolve(path.join(__dirname, '..'));
        const resourceDir = path.join(libraryDir, 'resource_containers');
        const srcDB = path.join(srcDir, 'index', 'index.sqlite');
        const srcResource = path.join(srcDir, 'index', 'resource_containers');
        let indexstat;

        try {
            indexstat = fs.statSync(libraryPath);
        } catch (e) {
        }

        if (!indexstat) {
            setMsg(i18n.translate("setting_index_file"));
            mkdirp.sync(libraryDir);
            const content = fs.readFileSync(srcDB);
            fs.writeFileSync(libraryPath, content);
        }
        mkdirp.sync(resourceDir);

        const db = new Db(libraryPath, resourceDir, {userAgent: navigator.userAgent});

        return new DataManager(db, resourceDir, srcResource, configurator, i18n.translate);
    })();

    setMsg(i18n.translate("init_modules"));

    const gitManager = new GitManager(i18n.translate);

    const migrateManager = new MigrateManager(configurator, gitManager, reporter, dataManager, i18n.translate);
    const renderer = new Renderer(i18n.translate);
    const keyManager = new KeyManager(DATA_PATH);
    const printManager = new PrintManager(configurator, i18n);
    const projectManager = new ProjectsManager(dataManager, configurator, reporter, gitManager, migrateManager, i18n.translate);
    const userManager = new UserManager(
        {token: configurator.getValue('gogs-token')},
        configurator.getUserSetting("dataserver"),
        navigator.userAgent,
        i18n.translate
    )
    const importManager = new ImportManager(configurator, migrateManager, dataManager, i18n.translate)
    const exportManager = new ExportManager(configurator, gitManager, reporter, i18n.translate)

    // TODO: where should this be?
    mkdirp.sync(configurator.getValue('targetTranslationsDir'));

    // --- Safe IPC wrapper with channel whitelists ---
    const SEND_CHANNELS = [
        'fire-reload', 'theme-changed', 'theme-loaded', 'localization-changed',
        'update-spellcheck', 'loading-status', 'show-devtools', 'main-loading-done',
        'open-manual', 'debug-crash'
    ];
    const SEND_SYNC_CHANNELS = ['main-window', 'open-file', 'save-as'];
    const ON_CHANNELS = ['maximize', 'unmaximize'];

    const safeIpc = {
        send: function (channel) {
            if (SEND_CHANNELS.indexOf(channel) !== -1) {
                const args = [].slice.call(arguments);
                ipcRenderer.send.apply(ipcRenderer, args);
            }
        },
        sendSync: function (channel) {
            if (SEND_SYNC_CHANNELS.indexOf(channel) !== -1) {
                const args = [].slice.call(arguments);
                return ipcRenderer.sendSync.apply(ipcRenderer, args);
            }
            return null;
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

    // --- Window controls ---
    const windowControl = {
        close: function () {
            ipcRenderer.sendSync('main-window', 'close');
        },
        minimize: function () {
            ipcRenderer.sendSync('main-window', 'minimize');
        },
        maximize: function () {
            ipcRenderer.sendSync('main-window', 'maximize');
        },
        unmaximize: function () {
            ipcRenderer.sendSync('main-window', 'unmaximize');
        },
        isMaximized: function () {
            return ipcRenderer.sendSync('main-window', 'isMaximized');
        }
    };

    const App = {
        appName: 'BTT Writer',
        locale: i18n,
        ipc: safeIpc,
        window: windowControl,
        srcDir: path.resolve(path.join(__dirname, "..")),
        shell: {
            openExternal: function (url) {
                if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
                    shell.openExternal(url);
                }
            }
        },
        clipboard: {
            writeText: function (text) {
                if (typeof text === 'string') {
                    clipboard.writeText(text);
                }
            }
        },
        path: path,
        untildify: require('untildify'),
        utils: utils,
        configurator: configurator,
        reporter: reporter,
        dataManager: dataManager,
        gitManager: gitManager,
        migrateManager: migrateManager,
        renderer: renderer,
        keyManager: keyManager,
        printManager: printManager,
        projectsManager: projectManager,
        userManager: userManager,
        importManager: importManager,
        exportManager: exportManager,
        translate: i18n.translate,
        getLocale: i18n.getLocale,
        sanitize: sanitize,
        showDevTools: function () {
            ipcRenderer.send('show-devtools');
        },
        close: function () {
            windowControl.close();
        }
    };

    setMsg(i18n.translate("loading_ui"));

    contextBridge.exposeInMainWorld('App', App);
})();
