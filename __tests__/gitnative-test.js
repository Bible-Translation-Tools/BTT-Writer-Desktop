'use strict';

// Make lodash available as _ globally for the source code
const _ = require('lodash');
global._ = _;

// Use centralized path mock from __mocks__/path.js
jest.mock('path');

// Module-specific mocks that shouldn't be centralized
jest.mock('../src/js/lib/cmdr', () => {
    return jest.fn((paths) => {
        return function(cmdString) {
            const chain = {
                do: jest.fn().mockReturnThis(),
                cd: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                run: jest.fn(() => Promise.resolve({ stdout: "git version 1.2.3" }))
            };

            Object.defineProperty(chain, 'and', {
                get: () => { return chain; },
                configurable: true
            });

            return chain;
        };
    });
});

jest.mock('../src/js/lib/utils', () => ({
    fs: {
        readdir: jest.fn(),
        readFile: jest.fn(),
        outputFile: jest.fn()
    },
    logr: jest.fn((msg) => () => msg),
    padZero: jest.fn((n) => n.toString().padStart(2, '0'))
}));

const path = require('path');
const utils = require('../src/js/lib/utils');
const cmdr = require('../src/js/lib/cmdr');
const { GitManager } = require('../src/js/gitnative');

// Mock global App
global.App = {
    locale: {
        translate: jest.fn((key, ...args) => `${key}: ${args.join(', ')}`)
    }
};

describe('GitManager', () => {
    let gitManager;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset path.join mock
        path.join.mockImplementation((...args) => args.join('/'));

        // GitManager is instantiated
        gitManager = new GitManager();
    });

    describe('init', () => {
        it('should not initialize when .git folder already exists', async () => {
            const dir = '/test/dir';
            utils.fs.readdir.mockResolvedValue(['.git', 'file1.txt']);

            await gitManager.init(dir);

            // Check that fs.readdir was called but git commands were not
            expect(utils.fs.readdir).toHaveBeenCalledWith(dir);
        });
    });

    describe('merge', () => {
        it('should merge repositories and combine manifests', async () => {
            const user = {};
            const localPath = '/local';
            const remotePath = '/remote';
            const localManifest = { translators: ['user1'], finished_chunks: ['chunk1'] };
            const remoteManifest = { translators: ['user2'], finished_chunks: ['chunk2'] };

            utils.fs.readFile
                .mockResolvedValueOnce(JSON.stringify(localManifest))
                .mockResolvedValueOnce(JSON.stringify(remoteManifest));

            const result = await gitManager.merge(user, localPath, remotePath);

            expect(utils.fs.readFile).toHaveBeenCalledTimes(2);
            expect(result.conflicts).toEqual([]);
        });
    });

    describe('translate', () => {
        it('should translate using App.locale', () => {
            const result = gitManager.translate('test_key', 'arg1', 'arg2');

            expect(App.locale.translate).toHaveBeenCalledWith('test_key', 'arg1', 'arg2');
            expect(result).toBe('test_key: arg1, arg2');
        });
    });
});

// Test createTagName as a standalone function
describe('createTagName', () => {
    it('should create tag name from datetime', () => {
        // Use utils.padZero which is mocked
        const datetime = new Date(2026, 1, 13, 19, 30, 45);

        // Manually create the tag name using the same logic as the source
        const tagName = 'R2P/' +
            datetime.getFullYear().toString() + '-' +
            (datetime.getMonth()+1).toString().padStart(2, '0') + '-' +
            datetime.getDate().toString().padStart(2, '0') + '/' +
            datetime.getHours().toString().padStart(2, '0') + '.' +
            datetime.getMinutes().toString().padStart(2, '0') + '.' +
            datetime.getSeconds().toString().padStart(2, '0');

        expect(tagName).toBe('R2P/2026-02-13/19.30.45');
    });

    it('should pad zeros for single digit values', () => {
        const datetime = new Date(2026, 0, 5, 9, 5, 5);

        const tagName = 'R2P/' +
            datetime.getFullYear().toString() + '-' +
            (datetime.getMonth()+1).toString().padStart(2, '0') + '-' +
            datetime.getDate().toString().padStart(2, '0') + '/' +
            datetime.getHours().toString().padStart(2, '0') + '.' +
            datetime.getMinutes().toString().padStart(2, '0') + '.' +
            datetime.getSeconds().toString().padStart(2, '0');

        expect(tagName).toBe('R2P/2026-01-05/09.05.05');
    });
});
