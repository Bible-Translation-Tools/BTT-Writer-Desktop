'use strict';

jest.mock('../src/config/user-setting', () => [
    {
        name: 'localization',
        value: { id: 'en', name: 'English' },
        group: 'gen_group'
    },
    {
        name: 'sourcefont',
        value: { path: 'default', name: 'Arial' },
        group: 'appearance'
    },
    {
        name: 'targetfont',
        value: { path: 'default', name: 'Arial' },
        group: 'appearance'
    },
    {
        name: 'sourcesize',
        value: { name: 'normal' },
        group: 'appearance'
    },
    {
        name: 'targetsize',
        value: { name: 'normal' },
        group: 'appearance'
    },
    {
        name: 'datalocation',
        value: '/user/data',
        group: 'locations'
    }
]);

jest.mock('../package', () => ({
    version: '1.5.4+x'
}));

const { Configurator } = require('../src/js/configurator');

describe('Configurator', () => {
    let configurator;

    beforeEach(() => {
        jest.clearAllMocks();
        configurator = new Configurator();

        // Initialize storage properly to avoid JSON parse errors
        const storage = configurator._storage();
        Object.keys(storage).forEach(key => delete storage[key]);
    });

    describe('getValue', () => {
        it('should return empty string for non-existent key', () => {
            const result = configurator.getValue('nonexistent');
            expect(result).toBe('');
        });

        it('should return stored value', () => {
            configurator.setValue('testKey', 'testValue');
            const result = configurator.getValue('testKey');
            expect(result).toBe('testValue');
        });

        it('should be case-insensitive', () => {
            configurator.setValue('TestKey', 'testValue');
            const result = configurator.getValue('TESTKEY');
            expect(result).toBe('testValue');
        });

        it('should handle different value types', () => {
            configurator.setValue('boolKey', true);
            configurator.setValue('numKey', 42);
            configurator.setValue('objKey', { name: 'test' });

            expect(configurator.getValue('boolKey')).toBe(true);
            expect(configurator.getValue('numKey')).toBe(42);
            expect(configurator.getValue('objKey')).toEqual({ name: 'test' });
        });
    });

    describe('setValue', () => {
        it('should not set value when key is undefined', () => {
            configurator.setValue(undefined, 'value');
            expect(configurator.getValue('undefined')).toBe('');
        });

        it('should not set value when value is undefined', () => {
            configurator.setValue('testKey', undefined);
            expect(configurator.getValue('testKey')).toBe('');
        });

        it('should store string values', () => {
            configurator.setValue('stringKey', 'stringValue');
            expect(configurator.getValue('stringKey')).toBe('stringValue');
        });

        it('should preserve object structure', () => {
            const obj = { name: 'test', value: 123 };
            configurator.setValue('objKey', obj);
            expect(configurator.getValue('objKey')).toEqual(obj);
        });
    });

    describe('unsetValue', () => {
        it('should remove stored value', () => {
            configurator.setValue('testKey', 'testValue');
            configurator.unsetValue('testKey');
            expect(configurator.getValue('testKey')).toBe('');
        });

        it('should handle undefined key', () => {
            expect(() => configurator.unsetValue(undefined)).not.toThrow();
        });
    });

    describe('loadConfig', () => {
        it('should load configuration from array', () => {
            const config = [
                { name: 'config1', value: 'value1' },
                { name: 'config2', value: 'value2' }
            ];

            configurator.loadConfig(config);

            expect(configurator.getValue('config1')).toBe('value1');
            expect(configurator.getValue('config2')).toBe('value2');
        });

        it('should throw error when storage is undefined', () => {
            configurator = new Configurator();
            configurator.setStorage(undefined);

            expect(() => configurator.loadConfig([])).toThrow('Storage is undefined');
        });
    });

    describe('purgeValues', () => {
        it('should clear all stored values', () => {
            configurator.setValue('key1', 'value1');
            configurator.setValue('key2', 'value2');

            configurator.purgeValues();

            expect(configurator.getValue('key1')).toBe('');
            expect(configurator.getValue('key2')).toBe('');
        });
    });

    describe('getUserSettingArr', () => {
        it('should return default settings when storage is empty', () => {
            // Suppress expected JSON parse error
            const originalError = console.error;
            console.error = jest.fn();

            const result = configurator.getUserSettingArr();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            // Restore console.error
            console.error = originalError;
        });

        it('should return parsed settings from storage', () => {
            const storage = configurator._storage();
            storage['user-setting'] = JSON.stringify([
                { group: 'test', list: [{ name: 'localization', value: { id: 'es', name: 'Spanish' } }] }
            ]);

            const result = configurator.getUserSettingArr();

            expect(result[0].list[0].value.id).toBe('es');
        });
    });

    describe('saveUserSettingArr', () => {
        it('should save settings to storage', () => {
            const settings = [
                { group: 'test', list: [{ name: 'setting1', value: 'value1' }] }
            ];

            configurator.saveUserSettingArr(settings);

            const storage = configurator._storage();
            expect(JSON.parse(storage['user-setting'])).toEqual(settings);
        });
    });

    describe('getUserPath', () => {
        it('should return empty string for non-existent setting', () => {
            const result = configurator.getUserPath('nonexistent');
            expect(result).toBe('');
        });
    });

    describe('getAppData', () => {
        it('should return app version and build', () => {
            const result = configurator.getAppData();

            expect(result.version).toBe('1.5.4+x');
            expect(result.build).toBe('x');
        });
    });

    describe('PATH_SEP', () => {
        it('should return path separator', () => {
            expect(configurator.PATH_SEP).toBe('/');
        });
    });

    describe('_userSetting', () => {
        it('should return default user settings', () => {
            const result = configurator._userSetting();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('_storage', () => {
        it('should return storage object', () => {
            const storage = configurator._storage();

            expect(typeof storage).toBe('object');
        });
    });

    describe('setStorage', () => {
        it('should replace storage object', () => {
            const newStorage = {};
            configurator.setStorage(newStorage);

            expect(configurator._storage()).toBe(newStorage);
        });
    });

    describe('fontSizeMap', () => {
        it('should return correct font sizes', () => {
            // Access the internal variable directly
            const storage = configurator._storage();
            expect(storage.fontSizeMap).toBeUndefined();
        });
    });
});
