/**
 * ts.Configurator
 * settings manager that uses local storage by default, but can be overridden to use any storage provider.
 * Configurations are stored by key as stringified JSON (meta includes type, mutability, etc)
 */

;(function () {
    'use strict';

    let _ = require('lodash');
    let path = require('path');
    let untildify = require('untildify');
    let userSetting = require('../config/user-setting');

    function Configurator () {
        let storage = {};

        // A corrupt storage entry must not crash the app
        let parseStoredJson = function (value, fallback) {
            if (typeof value !== 'string' || value === '') {
                return fallback;
            }

            try {
                return JSON.parse(value);
            } catch (e) {
                console.error(e);
                return fallback;
            }
        };

        let getValue = function (key) {
            if (key === undefined) {
                return key;
            }
            key = key.toLowerCase();

            let valueObj = parseStoredJson(storage[key], {});
            let metaObj = valueObj.meta || {'default': ''};

            //load value
            let value = valueObj.value;

            //otherwise use default (if present)
            if (value === undefined && metaObj.default) {
                value = metaObj.default;
            }

            return value;
        };

        let getMetaValue = function (key, metaKey) {
            if (key === undefined) {
                return key;
            }
            key = key.toLowerCase();

            let valueObj = parseStoredJson(storage[key], {});

            return valueObj.meta ? valueObj.meta[metaKey] : '';
        };

        let setValue = function (key, value, meta) {
            if (key === undefined || value === undefined) {
                return;
            }
            key = key.toLowerCase();
            value = (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'object') ? value : value.toString();

            //load value object or create new empty value object
            let emptyStorageObj = {'value': value, 'meta': {'mutable': true, 'type': typeof value, 'default': ''}};
            let valueObj = storage[key] !== undefined ? parseStoredJson(storage[key], emptyStorageObj) : emptyStorageObj;

            //update value
            valueObj.value = value;

            //update meta
            valueObj.meta = _.merge(valueObj.meta, meta);

            //update value in storage
            storage[key] = JSON.stringify(valueObj);

        };

        let unsetValue = function (key) {
            if (key === undefined) {
                return;
            }
            key = key.toLowerCase();

            //remove value from storage
            if (typeof storage.removeItem === 'function') {
                storage.removeItem(key);
            } else {
                storage[key] = undefined;
            }
        };

        let setDefaultValue = function (key, value) {
            setValue(key, value, {'default': value || ''});
        };

        let getKeys = function () {
            return Object.keys(storage);
        };

        /**
         * Map the raw setting array into groups and lists for UI to display
         * @param settingArr array of setting objects
         * @param groupOrder (optional) array of string of group name
         * @return array of setting-group objects
         */
        let mapUserSettings = function(settingArr, groupOrder) {
            // TODO: Order group
            const grouped = _.groupBy(settingArr, 'group');
            return _.map(grouped, function (list, group) {
                return { group, list };
            });
        };

        /**
         */
        let flattenUserSetting = function(settingArr) {
            var flatSetting = [];

            settingArr.forEach(function(groupObj) {
                groupObj.list.forEach(function(setting) {
                    flatSetting.push(setting);
                });
            });

            return flatSetting;
        };

        /**
         */
        let fontSizeMap = {
            'small': '50%',
            'normal': '100%',
            'large': '150%'
        };


        //
        // This is the returned object
        //
        let configurator = {

            /**
             */
            get PATH_SEP() {
                return path.sep;
            },

            /**
             * Fetch the raw and default setting array from JSON file
             * @return setting array from user-setting.json
             */
            _userSetting: function() {
                return userSetting;
            },

            /**
             * Returns the storage being used
             * @returns {object}
             */
            _storage: function() {
                return storage;
            },

            /**
             * Set the storage object used for this app
             * @param storeObject
             */
            setStorage: function (storeObject) {
                storage = storeObject;
            },

            /**
             * Fetch the (mapped) setting array
             * @return setting array from user's storage or from default file
             */
            getUserSettingArr: function() {
                const us = parseStoredJson(storage['user-setting'], null);
                return us || mapUserSettings(this._userSetting());
            },

            /**
             * Write the whole (mapped) setting array to the user's preferred storage
             * @param settingArr
             */
            saveUserSettingArr: function(settingArr) {
                storage['user-setting'] = JSON.stringify(settingArr);
            },

            /**
             * Get the value of a setting
             * @param name of the user setting
             * @return value of the user setting
             */
            getUserSetting: function(name) {
                try {
                    const s = this.getUserSettingArr();
                    const list = _.find(s, {'list': [{'name': name}]}).list;
                    return _.find(list, {'name': name}).value;
                } catch (e) { console.error(e); }
            },

            // TODO: this needs to be refactored. This is due to needing the backup dirs in the UI side.
            //  This might be an okay solution, but it needs to be examined.
            getUserPath: function (key, arg1, arg2, arg3) {
                const val = configurator.getUserSetting(key);

                return val ? path.join(untildify(val), arg1 || '', arg2 || '', arg3 || '') : '';
            },

            /**
             * Set the value of a setting
             * @param name of the user setting
             * @return value of the user setting
             */
            setUserSetting: function(name, value) {
                try {
                    const s = this.getUserSettingArr();
                    const listIndex = _.findIndex(s, {'list': [{'name': name}]});
                    const settingIndex = _.findIndex(s[listIndex].list, {'name': name});
                    s[listIndex].list[settingIndex].value = value;
                    this.saveUserSettingArr(s);
                    return s;
                } catch (e) { console.error(e); }
            },

            /**
             */
            refreshUserSetting: function() {
                const defaults = this._userSetting();
                let current = [];

                try {
                    current = flattenUserSetting(parseStoredJson(storage['user-setting'], []));
                } catch (e) {
                    console.info('No user settings');
                }

                // Keep current values and remove non-existent settings
                for (var i in current) {
                    var j = _.findIndex(defaults, {'name': current[i].name});
                    if (j >= 0) {
                        defaults[j].value = current[i].value;
                    }
                }

                let mappedSettings = mapUserSettings(defaults);
                this.saveUserSettingArr(mappedSettings);
                return mappedSettings;
            },

            /**
             * Apply user preferences for app's look
             */
            applyPrefAppearance: function() {
                const targetfont = this.getUserSetting('targetfont').name;
                const sourcefont = this.getUserSetting('sourcefont').name;
                const targetsizeValue = this.getUserSetting('targetsize').name.toLowerCase();
                const targetsize = fontSizeMap[targetsizeValue];
                const sourcesizeValue = this.getUserSetting('sourcesize').name.toLowerCase();
                const sourcesize = fontSizeMap[sourcesizeValue];
                const sheet = document.styleSheets[0];
                const rules = sheet.cssRules;

                for (let i = 0; i < rules.length; i++) {
                    if (rules[i].selectorText.toLowerCase() === ".targetfont" || rules[i].selectorText.toLowerCase() === ".sourcefont" || rules[i].selectorText.toLowerCase() === ".targetsize" || rules[i].selectorText.toLowerCase() === ".sourcesize") {
                        sheet.deleteRule(i);
                        i--;
                    }
                }

                sheet.insertRule(".targetfont {font-family: " + targetfont + "}", 0);
                sheet.insertRule(".targetsize {font-size: " + targetsize + "}", 1);
                sheet.insertRule(".sourcefont {font-family: " + sourcefont + "}", 2);
                sheet.insertRule(".sourcesize {font-size: " + sourcesize + "}", 3);
            },

            getAppData: function() {
                try {
                    let p = require('../../package');
                    let build = p.version.split("+").pop();
                    return {
                        version: p.version,
                        build: build
                    };
                } catch (e) { console.log(e); }
            },

            /**
             * Retreives a value
             * @param key
             * @returns {object}
             */
            getValue: function (key) {
                return getValue(key) || '';
            },

            /**
             * Adds a new value to the configurator
             * @param key the key used to retrieve the value
             * @param value the value that will be stored
             * @param meta (optional) parameters to help specify how the value should be treated
             */
            setValue: function (key, value, meta) {
                setValue(key, value, meta);
            },

            /**
             * Loads a configuration object into the configurator
             * @param config a JSON object (usually loaded from a file)
             */
            loadConfig: function (config) {
                if (storage === undefined) {
                    throw 'Storage is undefined. Please call setStorage with a valid storage object';
                }

                for (let i = 0; i < config.length; i++) {
                    setDefaultValue(config[i].name, config[i].value);
                }
            },

            /**
             * Destroys a value
             * @param key
             */
            unsetValue: function (key) {
                unsetValue(key);
            },

            /**
             * Clears all values in the configurator
             */
            purgeValues: function () {
                let keys = getKeys();
                for (let i = 0; i < keys.length; i++) {
                    unsetValue(keys[i]);
                }
            }

        };

        return configurator;
    }

    exports.Configurator = Configurator;
})();
