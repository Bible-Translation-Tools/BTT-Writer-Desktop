'use strict';

/**
 * Centralized Path Mock for Jest Testing - Customizable Version
 * 
 * Usage:
 *   Basic: jest.mock('path'); // Uses defaults
 *   Custom: jest.mock('path', () => createPathMock({ join: jest.fn(...) }));
 */

// Factory function to create customizable path mocks
function createPathMock(customFunctions = {}) {
    // Default implementations
    const defaults = {
        join: jest.fn((...segments) => {
            return segments.filter(s => s && s.length > 0).join('/');
        }),
        
        resolve: jest.fn((...segments) => {
            return segments.filter(s => s && s.length > 0).join('/');
        }),
        
        sep: '/',
        
        dirname: jest.fn((p) => {
            if (!p || p === '/') return '/';
            const parts = p.split('/').filter(Boolean);
            parts.pop();
            return parts.length > 0 ? '/' + parts.join('/') : '/';
        }),
        
        basename: jest.fn((p) => {
            if (!p) return '';
            const parts = p.split('/').filter(Boolean);
            return parts[parts.length - 1] || '';
        }),
        
        extname: jest.fn((p) => {
            if (!p) return '';
            const base = defaults.basename(p);
            const lastDot = base.lastIndexOf('.');
            return lastDot > 0 ? base.slice(lastDot) : '';
        }),
        
        parse: jest.fn((p) => {
            const basename = defaults.basename(p);
            const extname = defaults.extname(p);
            const dirname = defaults.dirname(p);
            
            return {
                root: p.startsWith('/') ? '/' : '',
                dir: dirname,
                base: basename,
                ext: extname,
                name: basename.replace(extname, '')
            };
        }),
        
        isAbsolute: jest.fn((p) => {
            return Boolean(p && p.startsWith('/'));
        }),
        
        relative: jest.fn((from, to) => {
            if (to.startsWith('/')) {
                return to;
            }
            return to;
        }),
        
        normalize: jest.fn((p) => {
            if (!p) return '';
            return '/' + p.split('/').filter(Boolean).join('/');
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

// Default path mock (used when jest.mock('path') is called without factory)
const path = createPathMock();

module.exports = path;
module.exports.createPathMock = createPathMock;
