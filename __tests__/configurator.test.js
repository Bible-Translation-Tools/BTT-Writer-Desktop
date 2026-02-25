/**
 * @jest-environment jsdom
 */

'use strict';

// 1. Use our manual mock from __mocks__/lodash.js
jest.mock('lodash');

// 2. Mock external dependencies
jest.mock('untildify', () => (str) => str.replace(/^~/, '/mock/home'));

// 3. Mock Configuration Files
const mockDefaultUserSettings = [
    {
        group: 'General',
        name: 'targetfont',
        value: 'Arial'
    },
    {
        group: 'General',
        name: 'targetsize',
        value: 'normal'
    },
    {
        group: 'General',
        name: 'sourcefont',
        value: 'Times New Roman'
    },
    {
        group: 'General',
        name: 'sourcesize',
        value: 'normal'
    },
    {
        group: 'Network',
        name: 'dataserver',
        value: 'https://git.door43.org'
    }
];

jest.mock('../src/config/user-setting', () => mockDefaultUserSettings, { virtual: true });
jest.mock('../package.json', () => ({ version: '1.2.3+build.456' }), { virtual: true });

describe('Configurator', () => {
    let Configurator;
    let configurator;
    let mockStorage;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Suppress console.error expected from JSON parsing of undefined during init
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Setup Mock Storage
        mockStorage = {
            _data: {},
            getItem: jest.fn(key => mockStorage._data[key]),
            setItem: jest.fn((key, val) => { mockStorage._data[key] = val; }),
            removeItem: jest.fn(key => { delete mockStorage._data[key]; })
        };

        // Initialize 'user-setting' to avoid JSON syntax errors in logs
        mockStorage._data['user-setting'] = 'null';

        // Proxy to allow array access syntax: storage['key']
        const proxyStorage = new Proxy(mockStorage, {
            get: (target, prop) => target._data[prop] || target[prop],
            set: (target, prop, value) => {
                target._data[prop] = value;
                return true;
            },
            deleteProperty: (target, prop) => {
                delete target._data[prop];
                return true;
            }
        });

        // Require the module
        const ConfigModule = require('../src/js/configurator');
        Configurator = ConfigModule.Configurator;

        configurator = new Configurator();
        configurator.setStorage(proxyStorage);
    });

    describe('Basic Storage Operations', () => {
        it('should set and get a simple value', () => {
            configurator.setValue('theme', 'dark');
            expect(configurator.getValue('theme')).toBe('dark');

            // Verify internal JSON structure
            const storedRaw = JSON.parse(mockStorage._data['theme']);
            expect(storedRaw.value).toBe('dark');
        });

        it('should return empty string for missing keys', () => {
            // FIX: Implementation returns '' for undefined values
            expect(configurator.getValue('nonExistent')).toBe('');
        });

        it('should unset (remove) a value', () => {
            configurator.setValue('temp', 123);
            expect(configurator.getValue('temp')).toBe(123);

            configurator.unsetValue('temp');
            // FIX: Implementation returns '' after unset
            expect(configurator.getValue('temp')).toBe('');
        });
    });

    describe('User Settings', () => {
        it('should get a specific user setting by name', () => {
            // Because we are using the REAL lodash via our mock,
            // the deep find logic in configurator.js will work correctly against this data.
            jest.spyOn(configurator, 'getUserSettingArr').mockReturnValue([
                {
                    group: 'General',
                    list: [
                        { name: 'targetfont', value: 'Arial' },
                        { name: 'dataserver', value: 'https://git.door43.org' }
                    ]
                }
            ]);

            const font = configurator.getUserSetting('targetfont');
            expect(font).toBe('Arial');

            const server = configurator.getUserSetting('dataserver');
            expect(server).toBe('https://git.door43.org');
        });

        it('should set a user setting and persist it', () => {
            const mockSettings = [
                {
                    group: 'General',
                    list: [{ name: 'targetfont', value: 'Arial' }]
                }
            ];

            jest.spyOn(configurator, 'getUserSettingArr').mockReturnValue(mockSettings);
            jest.spyOn(configurator, 'saveUserSettingArr');

            configurator.setUserSetting('targetfont', 'Courier New');

            expect(mockSettings[0].list[0].value).toBe('Courier New');
            expect(configurator.saveUserSettingArr).toHaveBeenCalledWith(mockSettings);
        });

        it('should getUserPath with tilde expansion', () => {
            jest.spyOn(configurator, 'getUserSetting').mockReturnValue('~/Documents');

            const expandedPath = configurator.getUserPath('someKey', 'subdir');

            // Logic comes from our mocked untildify + path
            const sep = require('path').sep;
            const expected = `/mock/home/Documents${sep}subdir`;

            expect(expandedPath).toBe(expected);
        });
    });

    describe('App Metadata', () => {
        it('should return version and build number from package.json', () => {
            const appData = configurator.getAppData();
            expect(appData.version).toBe('1.2.3+build.456');
            // FIX: The code splits by '+' and takes the last part.
            expect(appData.build).toBe('build.456');
        });
    });

    describe('Appearance (DOM Interaction)', () => {
        let mockSheet;

        beforeEach(() => {
            mockSheet = {
                cssRules: [],
                deleteRule: jest.fn(),
                insertRule: jest.fn()
            };

            Object.defineProperty(document, 'styleSheets', {
                value: [mockSheet],
                writable: true
            });
        });

        it('should insert css rules based on settings', () => {
            // The source code does `this.getUserSetting(...).name`.
            // We must mock getUserSetting to return an object with a .name property
            // for this specific test case.
            jest.spyOn(configurator, 'getUserSetting').mockImplementation((key) => {
                const map = {
                    'targetfont': { name: 'Arial' },
                    'sourcefont': { name: 'Times' },
                    'targetsize': { name: 'normal' },
                    'sourcesize': { name: 'normal' }
                };
                return map[key];
            });

            configurator.applyPrefAppearance();

            expect(mockSheet.insertRule).toHaveBeenCalledTimes(4);
            expect(mockSheet.insertRule).toHaveBeenCalledWith(
                expect.stringContaining('.targetfont {font-family: Arial}'),
                0
            );
        });
    });
});
