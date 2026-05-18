/**
 * @jest-environment jsdom
 */

'use strict';

// 1. Setup Control Flags for Mocks
// Variable name MUST start with 'mock' to be used inside jest.mock factory

let mockThrowConfiguratorError = false;

// 2. Setup Mocks for Node Modules
jest.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: jest.fn(k => k)
    },
    ipcRenderer: {
        send: jest.fn(),
        sendSync: jest.fn(),
    }
}));
jest.mock('fs');
jest.mock('mkdirp');
jest.mock('door43-client-fork');
jest.mock('fs-extra');
jest.mock('path');

// 3. Setup Mocks for Internal Modules
const mockConfiguratorInstance = {
    setStorage: jest.fn(),
    loadConfig: jest.fn(),
    setValue: jest.fn(),
    getValue: jest.fn((key) => {
        const defaults = {
            rootDir: '/mock/data/path',
            libraryDir: '/mock/data/path/library',
            targetTranslationsDir: '/mock/data/path/target'
        };
        return defaults[key] || `mock_${key}`;
    }),
    getUserSetting: jest.fn((key) => {
        if (key === 'localization') return { id: 'en' };
        return true;
    })
};

// Configurator Mock with Error Injection on IMPORT
jest.mock('../src/js/configurator', () => {
    // FIX: Check the flag at the MODULE level, not inside the class constructor.
    // This ensures require('../src/js/configurator') throws immediately,
    // which triggers the try/catch block in preload-main.js.
    if (mockThrowConfiguratorError) {
        throw new Error('Configurator missing');
    }

    return {
        Configurator: jest.fn(() => mockConfiguratorInstance)
    };
});

const mockI18nInstance = {
    setLocale: jest.fn(),
    translate: jest.fn(key => `translated_${key}`)
};
jest.mock('../src/js/i18n', () => ({
    Locale: jest.fn(() => mockI18nInstance)
}));

const MockManager = jest.fn(() => ({}));

jest.mock('../src/js/reporter', () => ({ Reporter: MockManager }));
jest.mock('../src/js/gitnative', () => ({ GitManager: MockManager }));
jest.mock('../src/js/keys', () => ({ KeyManager: MockManager }));
jest.mock('../src/js/projects', () => ({ ProjectsManager: MockManager }));
jest.mock('../src/js/migrator', () => ({ MigrateManager: MockManager }));
jest.mock('../src/js/database', () => ({ DataManager: MockManager }));
jest.mock('../src/js/user', () => ({ UserManager: MockManager }));
jest.mock('../src/js/importer', () => ({ ImportManager: MockManager }));
jest.mock('../src/js/exporter', () => ({ ExportManager: MockManager }));
jest.mock('../src/js/printer', () => ({ PrintManager: MockManager }));
jest.mock('../src/js/render', () => ({ Renderer: MockManager }));
jest.mock('../src/js/lib/utils', () => ({}));

jest.mock('../package.json', () => ({ version: '1.0.0' }), { virtual: true });
jest.mock('../src/config/defaults', () => ({ defaultSetting: true }), { virtual: true });
jest.mock('../src/config/private.json', () => ({ privateSetting: true }), { virtual: true });

describe('Application Bootstrap', () => {
    let fs;
    let electron;
    let path;
    let contextBridge;

    const PRELOAD_FILE = '../src/js/preload-main.js';

    beforeEach(() => {
        // 1. Reset Module Registry (Clear cache)
        jest.resetModules();

        // 2. Reset Mock State
        jest.clearAllMocks();
        mockThrowConfiguratorError = false;

        // 3. Re-require modules
        fs = require('fs');
        electron = require('electron');
        contextBridge = electron.contextBridge;
        path = require('path');
        fs.__reset();

        // 4. Mock Window & Console
        delete window.App;
        jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
            writable: true
        });
    });

    afterEach(() => {
        contextBridge.exposeInMainWorld.mockClear();
        jest.restoreAllMocks();
    });

    it('should bootstrap the application and assign window.App', () => {
        require(PRELOAD_FILE);

        const exposedApp = contextBridge.exposeInMainWorld.mock.calls[0][1];

        expect(electron.ipcRenderer.send).toHaveBeenCalledWith('loading-status', 'Bootstrapping...');
        expect(electron.ipcRenderer.sendSync).toHaveBeenCalledWith('main-window', 'dataPath');

        expect(mockConfiguratorInstance.setStorage).toHaveBeenCalledWith(window.localStorage);
        expect(mockConfiguratorInstance.loadConfig).toHaveBeenCalledTimes(1);

        const mkdirp = require('mkdirp');
        expect(mkdirp.sync).toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalled();

        expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('App', expect.anything());
        expect(typeof exposedApp.translate).toBe('function');
        expect(exposedApp.translate('test_key')).toContain('translated');

        expect(exposedApp).toBeDefined();
        expect(exposedApp.appName).toBe('BTT Writer');

        expect(exposedApp.window).toBeDefined();
        exposedApp.close();
        expect(electron.ipcRenderer.sendSync).toHaveBeenCalledWith('main-window', 'close');
    });

    it('should not overwrite library database if it already exists', () => {
        fs.__setMockStats('/mock/data/path/library/index.sqlite', { isFile: () => true });

        require(PRELOAD_FILE);

        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully (by throwing)', () => {
        // Enable the error flag for this test only
        mockThrowConfiguratorError = true;

        // Verify that the bootstrap process throws the error back up
        expect(() => {
            require(PRELOAD_FILE);
        }).toThrow();

        // Verify that before throwing, it tried to send the error via IPC
        expect(electron.ipcRenderer.send).toHaveBeenCalledWith('loading-status', 'Configurator missing');
    });

    it('should initialize locale based on user settings', () => {
        require(PRELOAD_FILE);
        expect(mockI18nInstance.setLocale).toHaveBeenCalledWith('en');
    });
});
