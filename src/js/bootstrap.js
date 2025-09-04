/**
* Defines the application context.
* This context will be available throughout the application
*/

'use strict';
/*
 * Redirect all standard output to the console.
 * NB: This is required for the sql.js library to work.
 */
process.stderr.write = console.error.bind(console);
process.stdout.write = console.log.bind(console);

(function () {
    let ipcRenderer = require('electron').ipcRenderer;
    let setMsg = ipcRenderer.send.bind(ipcRenderer, 'loading-status');

    setMsg('Bootstrapping...');

    const DATA_PATH = ipcRenderer.sendSync('main-window', 'dataPath');

    // stub globals
    let path = null;
    let fs = null;
    let fse = null;
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

    // Load and initialize configurator first, because it's neccessary to get user selected localization language
    try {
        setMsg('Loading path...');
        path = require('path');
        fs = require('fs');
        fse = require('fs-extra');

        setMsg("Loading Configurator...");
        Configurator = require('../js/configurator').Configurator;
    } catch(err) {
        // display error and fail
        setMsg(err.message);
        throw new Error(err);
    }

    // TODO: refactor this so we can just pass an object to the constructor
    let configurator = (function () {
        var c = new Configurator();

        c.setStorage(window.localStorage);

        let defaults = require('../config/defaults');

        try {
            let privateDefaults = require('../config/private.json');
            c.loadConfig(privateDefaults);
        } catch (e) {
            console.info('No private settings.');
        }

        c.loadConfig(defaults);
        c.setValue('rootDir', DATA_PATH, {'mutable':false});
        c.setValue('targetTranslationsDir', path.join(DATA_PATH, 'targetTranslations'), {'mutable':false});
        c.setValue('tempDir', path.join(DATA_PATH, 'temp'), {'mutable':false});
        c.setValue('libraryDir', path.join(DATA_PATH, 'library'), {'mutable':false});
        c.setValue('indexDir', path.join(DATA_PATH, 'index'), {'mutable':false});
        return c;
    })();

    // catch startup errors
    try {
        setMsg('Loading Locale...');
        var loc = configurator.getUserSetting("localization");
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

        const spellcheckEnabled = configurator.getUserSetting("enable_spell_checking");
        ipcRenderer.send('update-spellcheck', spellcheckEnabled);
    } catch (err) {
        // display error and fail
        setMsg(err.message);
        throw new Error(err);
    }
    setMsg(i18n.translate("init_config"));

    let reporter = new Reporter({
        logPath: path.join(configurator.getValue('rootDir'), 'log.txt'),
        oauthToken: configurator.getValue('github-oauth'),
        repoOwner: configurator.getValue('repoOwner'),
        repo: configurator.getValue('repo'),
        maxLogFileKb: configurator.getValue('maxLogFileKb'),
        appVersion: require('../../package.json').version,
        verbose: true
    });

    let dataManager = (function () {
        var libraryDir = configurator.getValue('libraryDir');
        var libraryPath = path.join(libraryDir, "index.sqlite");
        var srcDir = path.resolve(path.join(__dirname, '..'));
        var resourceDir = path.join(libraryDir, 'resource_containers');
        var srcDB = path.join(srcDir, 'index', 'index.sqlite');
        var srcResource = path.join(srcDir, 'index', 'resource_containers');
        var indexstat;

        try {
            indexstat = fs.statSync(libraryPath);
        } catch(e) {}

        if (!indexstat) {
            setMsg(i18n.translate("setting_index_file"));
            mkdirp.sync(libraryDir);
            var content = fs.readFileSync(srcDB);
            fs.writeFileSync(libraryPath, content);
        }
        mkdirp.sync(resourceDir);

        var db = new Db(libraryPath, resourceDir, { userAgent: navigator.userAgent });

        return new DataManager(db, resourceDir, srcResource, configurator);
    })();

    setMsg(i18n.translate("init_modules"));

    let gitManager = new GitManager();

    let migrateManager = new MigrateManager(configurator, gitManager, reporter, dataManager);

    // TODO: where should this be?
    mkdirp.sync(configurator.getValue('targetTranslationsDir'));

    var App = {
        appName: 'BTT Writer',

        locale: i18n,

        ipc: ipcRenderer,

        get window () {
            return this._window('main-window');
        },

        _window: function (windowName) {
            var ipc = ipcRenderer,
                send = ipc.sendSync.bind(ipc, windowName);

            return {
                close: send.bind(ipc, 'close'),
                minimize: send.bind(ipc, 'minimize'),
                maximize: send.bind(ipc, 'maximize'),
                unmaximize: send.bind(ipc, 'unmaximize'),
                isMaximized: send.bind(ipc, 'isMaximized')
            };
        },

        close: function () {
            this.window.close();
        },

        showDevTools: function () {
            this.ipc.send('show-devtools');
        },

        utils: utils,

        configurator: configurator,

        reporter: reporter,

        dataManager: dataManager,

        gitManager: gitManager,

        migrateManager: migrateManager,

        renderer: (function () {
            return new Renderer();
        })(),

        keyManager: (function () {
            return new KeyManager(DATA_PATH);
        })(),

        printManager: (function () {
            return new PrintManager(configurator);
        })(),

        projectsManager: (function () {
            return new ProjectsManager(dataManager, configurator, reporter, gitManager, migrateManager);
        })(),

        userManager: (function () {
            return new UserManager(
                { token: configurator.getValue('gogs-token') },
                configurator.getUserSetting("dataserver")
            );
        })(),

        importManager: (function () {
            return new ImportManager(configurator, migrateManager, dataManager);
        })(),

        exportManager: (function () {
            return new ExportManager(configurator, gitManager);
        })()
    };

    // hook up global exception handler
    // process.removeAllListeners('uncaughtException');
    // process.on('uncaughtException', function (err) {
    //     let date = new Date();
    //     date = date.getFullYear() + '_' + date.getMonth() + '_' + date.getDay();
    //     let crashPath = path.join(DATA_PATH, 'logs', date + '.crash');
    //     let crashReporter = new Reporter({logPath: crashPath});
    //     crashReporter.logError(err.message + '\n' + err.stack, function () {
    //         /**
    //          * TODO: Hook in a UI
    //          * Currently the code quits quietly without notifying the user
    //          * This should probably be the time when the user chooses to submit what happened or not
    //          * then we restart the application
    //          */
    //     });
    // });

    setMsg(i18n.translate("loading_ui"));

    window.App = App;

})();
