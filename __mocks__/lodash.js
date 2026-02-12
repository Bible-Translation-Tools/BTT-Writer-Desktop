'use strict';

/**
 * Centralized Lodash Mock for Jest Testing - Customizable Version
 * 
 * Usage:
 *   Basic: jest.mock('lodash'); // Uses defaults
 *   Custom: jest.mock('lodash', () => createLodashMock({ map: jest.fn(...) }));
 */

// Helper function to create simple mocks
function createSimpleMock(defaultFn) {
    return jest.fn(defaultFn || (x => x));
}

// Factory function to create customizable lodash mocks
function createLodashMock(customFunctions = {}) {
    // Default implementations
    const defaults = {
        map: createSimpleMock((collection, iteratee) => {
            if (Array.isArray(collection)) {
                if (typeof iteratee === 'function') {
                    return collection.map(iteratee);
                }
                return [...collection];
            }
            // For objects, return array of mapped values (like real lodash)
            const result = [];
            for (const key in collection) {
                if (collection.hasOwnProperty(key)) {
                    result.push(iteratee ? iteratee(collection[key], key) : collection[key]);
                }
            }
            return result;
        }),
        
        filter: createSimpleMock((array, predicate) => {
            if (!Array.isArray(array)) return [];
            if (typeof predicate !== 'function') return [...array];
            return array.filter(predicate);
        }),
        
        find: createSimpleMock((array, predicate) => {
            if (!Array.isArray(array)) return undefined;
            return array.find(predicate);
        }),
        
        findIndex: createSimpleMock((array, predicate) => {
            if (!Array.isArray(array)) return -1;
            return array.findIndex(predicate);
        }),
        
        reduce: createSimpleMock((array, reducer, initialValue) => {
            if (!Array.isArray(array)) return initialValue;
            return array.reduce(reducer, initialValue);
        }),
        
        get: createSimpleMock((object, path, defaultValue) => {
            if (!object || typeof object !== 'object') return defaultValue;
            const keys = Array.isArray(path) ? path : path.split('.');
            let current = object;
            for (const key of keys) {
                if (current === null || current === undefined || !current.hasOwnProperty(key)) {
                    return defaultValue;
                }
                current = current[key];
            }
            return current !== undefined ? current : defaultValue;
        }),
        
        set: createSimpleMock((object, path, value) => {
            if (!object || typeof object !== 'object') return object;
            const keys = Array.isArray(path) ? path : path.split('.');
            let current = object;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current.hasOwnProperty(key) || current[key] === null || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;
            return object;
        }),
        
        merge: createSimpleMock((...objects) => {
            const result = {};
            for (const obj of objects) {
                if (obj && typeof obj === 'object') {
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            result[key] = obj[key];
                        }
                    }
                }
            }
            return result;
        }),
        
        groupBy: createSimpleMock((array, iteratee) => {
            if (!Array.isArray(array)) return {};
            const result = {};
            const getKey = typeof iteratee === 'function' 
                ? (item) => iteratee(item)
                : (item) => String(item[iteratee]);
            for (const item of array) {
                const key = getKey(item);
                if (!result[key]) {
                    result[key] = [];
                }
                result[key].push(item);
            }
            return result;
        }),
        
        flatten: createSimpleMock((array, depth = 1) => {
            if (!Array.isArray(array)) return [];
            const flattenOneLevel = (arr) => {
                return arr.reduce((acc, val) => {
                    return acc.concat(Array.isArray(val) && depth > 0 ? flattenOneLevel(val) : val);
                }, []);
            };
            return flattenOneLevel(array);
        }),
        
        union: createSimpleMock((...arrays) => {
            const seen = new Set();
            const result = [];
            for (const array of arrays) {
                if (Array.isArray(array)) {
                    for (const item of array) {
                        const key = JSON.stringify(item);
                        if (!seen.has(key)) {
                            seen.add(key);
                            result.push(item);
                        }
                    }
                }
            }
            return result;
        }),
        
        uniq: createSimpleMock((array) => {
            if (!Array.isArray(array)) return [];
            const seen = new Set();
            const result = [];
            for (const item of array) {
                const key = JSON.stringify(item);
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(item);
                }
            }
            return result;
        }),
        
        sortBy: createSimpleMock((array, key) => {
            if (!Array.isArray(array)) return [];
            return [...array].sort((a, b) => {
                const aVal = typeof key === 'function' ? key(a) : a[key];
                const bVal = typeof key === 'function' ? key(b) : b[key];
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
                return 0;
            });
        }),
        
        cloneDeep: createSimpleMock((value) => {
            if (value === null || typeof value !== 'object') return value;
            return JSON.parse(JSON.stringify(value));
        }),
        
        isEmpty: createSimpleMock((value) => {
            if (value === null || value === undefined) return true;
            if (typeof value === 'string') return value.length === 0;
            if (Array.isArray(value)) return value.length === 0;
            if (typeof value === 'object') return Object.keys(value).length === 0;
            return false;
        }),
        
        pick: createSimpleMock((object, keys) => {
            if (!object || typeof object !== 'object') return {};
            const result = {};
            for (const key of keys) {
                if (object.hasOwnProperty(key)) {
                    result[key] = object[key];
                }
            }
            return result;
        }),
        
        omit: createSimpleMock((object, keys) => {
            if (!object || typeof object !== 'object') return {};
            const result = {};
            const keysSet = new Set(keys);
            for (const key in object) {
                if (object.hasOwnProperty(key) && !keysSet.has(key)) {
                    result[key] = object[key];
                }
            }
            return result;
        }),

        partialRight: createSimpleMock((fn, ...args) => {
            return (...moreArgs) => fn(...moreArgs, ...args);
        }),

        compact: createSimpleMock((array) => {
            if (!Array.isArray(array)) return [];
            return array.filter(Boolean);
        })
    };
    
    // Merge defaults with custom functions
    const mock = { ...defaults };
    
    for (const key in customFunctions) {
        if (customFunctions.hasOwnProperty(key) && mock.hasOwnProperty(key)) {
            if (typeof customFunctions[key] === 'function') {
                mock[key] = jest.fn(customFunctions[key]);
            } else {
                mock[key] = customFunctions[key];
            }
        }
    }
    
    return mock;
}

// Default lodash mock (used when jest.mock('lodash') is called without factory)
const lodash = createLodashMock();

module.exports = lodash;
module.exports.createLodashMock = createLodashMock;
