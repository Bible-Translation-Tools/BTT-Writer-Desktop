/**
 * @jest-environment node
 */

'use strict';

const path = require('path');

// 1. Setup Global lodash
global._ = require('lodash');

// 2. Setup Mocks
jest.mock('lodash');
jest.mock('keypair');
jest.mock('node-forge');
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('KeyManager', () => {
    let KeyManager;
    let keyManager;
    let mockUtils;

    const DATA_PATH = '/app/data';
    const SSH_PATH = path.resolve(path.join(DATA_PATH, 'ssh'));
    const DEVICE_ID = 'test-device-123';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');

        // Ensure utility methods return promises
        mockUtils.fs.readFile.mockResolvedValue('mock-content');
        mockUtils.fs.remove.mockResolvedValue(true);

        const KeysModule = require('../src/js/keys');
        KeyManager = KeysModule.KeyManager;
        keyManager = new KeyManager(DATA_PATH);
    });

    describe('Path Management', () => {
        it('should initialize with the correct ssh directory path', () => {
            expect(keyManager.sshPath).toBe(SSH_PATH);
        });

        it('should allow updating the ssh directory path dynamically', () => {
            const newPath = '/custom/ssh/folder';
            keyManager.sshPath = newPath;
            expect(keyManager.sshPath).toBe(newPath);
        });
    });

    describe('getRegistrationInfo', () => {
        it('should read existing keys from disk and zip them into an object', async () => {
            // Mocking sequential reads for Public and Private keys
            mockUtils.fs.readFile
                .mockResolvedValueOnce('read-public-key')
                .mockResolvedValueOnce('read-private-key');

            const info = await keyManager.getRegistrationInfo(DEVICE_ID);

            expect(mockUtils.fs.readFile).toHaveBeenCalledTimes(2);
            expect(info.keys).toEqual({
                public: 'read-public-key',
                private: 'read-private-key'
            });
            expect(info.deviceId).toBe(DEVICE_ID);
        });
    });

    describe('destroyKeys', () => {
        it('should remove the entire ssh directory', async () => {
            await keyManager.destroyKeys();
            expect(mockUtils.fs.remove).toHaveBeenCalledWith(SSH_PATH);
        });
    });
});
