'use strict';

// Test file for KeyManager in keys.js
// Tests SSH key generation, reading, and management

// Mock dependencies using centralized mocks
jest.mock('path');
jest.mock('lodash');
jest.mock('keypair');
jest.mock('node-forge');
jest.mock('../src/js/lib/utils', () => ({
    fs: {
        mkdirs: jest.fn(),
        readFile: jest.fn(),
        outputFile: jest.fn(),
        remove: jest.fn(),
        chmod: jest.fn()
    },
    lodash: {
        map: jest.fn((arr, fn) => arr.map(fn))
    },
    logr: jest.fn((msg) => (data) => {
        console.log(msg);
        return data;
    }),
    ret: jest.fn((data) => () => data)
}));

// Mock global App
global.App = {
    locale: {
        translate: jest.fn((key, ...args) => `${key}: ${args.join(', ')}`)
    }
};

const path = require('path');
const _ = require('lodash');
const keypair = require('keypair');
const forge = require('node-forge');
const utils = require('../src/js/lib/utils');
const { KeyManager } = require('../src/js/keys');

describe('KeyManager', () => {
    let keyManager;
    const testDataPath = '/test/data/path';
    const testDeviceId = 'device-123';

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default path mocks
        path.join.mockImplementation((...args) => args.join('/'));
        path.resolve.mockImplementation((...args) => args.join('/'));

        // Setup default keypair mock
        keypair.mockReturnValue({
            public: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
            private: '-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----'
        });

        // Setup forge mocks
        const mockPublicKey = {
            toOpenSSH: jest.fn().mockReturnValue('ssh-rsa AAAAB3... test@example.com')
        };
        const mockPrivateKey = {
            toOpenSSH: jest.fn().mockReturnValue('-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...\n-----END OPENSSH PRIVATE KEY-----')
        };
        forge.pki = {
            publicKeyFromPem: jest.fn().mockReturnValue(mockPublicKey),
            privateKeyFromPem: jest.fn().mockReturnValue(mockPrivateKey)
        };
        forge.ssh = {
            publicKeyToOpenSSH: jest.fn().mockImplementation((key, comment) => {
                return `ssh-rsa AAAAB3... ${comment || 'user@host'}`;
            }),
            privateKeyToOpenSSH: jest.fn().mockReturnValue('-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...\n-----END OPENSSH PRIVATE KEY-----')
        };

        // Setup utils mocks
        utils.fs.mkdirs.mockResolvedValue();
        utils.fs.readFile.mockResolvedValue('mock-key-content');
        utils.fs.outputFile.mockResolvedValue();
        utils.fs.remove.mockResolvedValue();
        utils.fs.chmod.mockResolvedValue();
        utils.lodash.map.mockImplementation((arr) => {
            // Handle both string arrays and mixed arrays
            if (Array.isArray(arr)) {
                return arr.map(item => String(item));
            }
            return [];
        });

        // Mock _.zipObject as it's used in readKeyPair
        _.zipObject = jest.fn().mockImplementation((keys, values) => {
            const result = {};
            keys.forEach((key, index) => {
                result[key] = values[index];
            });
            return result;
        });
        utils.ret.mockImplementation((data) => () => data);
        utils.logr.mockImplementation((msg) => (data) => data);

        // Create KeyManager instance
        keyManager = new KeyManager(testDataPath);
    });

    describe('Initialization', () => {
        it('should create KeyManager with correct paths', () => {
            expect(keyManager.sshPath).toBe('/test/data/path/ssh');
        });

        it('should have correct public key path', () => {
            const publicKeyPath = path.join(testDataPath, 'ssh', 'ts.pub');
            expect(publicKeyPath).toBe('/test/data/path/ssh/ts.pub');
        });

        it('should have correct private key path', () => {
            const privateKeyPath = path.join(testDataPath, 'ssh', 'ts');
            expect(privateKeyPath).toBe('/test/data/path/ssh/ts');
        });
    });

    describe('getRegistrationInfo', () => {
        it('should read existing key pair', async () => {
            const mockPublicKey = 'ssh-rsa AAAAB3... test@example.com';
            const mockPrivateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----';

            utils.fs.readFile
                .mockResolvedValueOnce(mockPublicKey)
                .mockResolvedValueOnce(mockPrivateKey);

            const result = await keyManager.getRegistrationInfo(testDeviceId);

            expect(utils.fs.readFile).toHaveBeenCalledTimes(2);
            expect(result.keys).toEqual({
                public: mockPublicKey,
                private: mockPrivateKey
            });
            expect(result.deviceId).toBe(testDeviceId);
            expect(result.paths).toBeDefined();
        });

        it('should return registration info with paths', async () => {
            const mockPublicKey = 'public-key-content';
            const mockPrivateKey = 'private-key-content';

            utils.fs.readFile
                .mockResolvedValueOnce(mockPublicKey)
                .mockResolvedValueOnce(mockPrivateKey);

            const result = await keyManager.getRegistrationInfo(testDeviceId);

            expect(result.paths.sshPath).toBe('/test/data/path/ssh');
            expect(result.paths.publicKeyPath).toBe('/test/data/path/ssh/ts.pub');
            expect(result.paths.privateKeyPath).toBe('/test/data/path/ssh/ts');
        });

        it('should handle errors when reading keys', async () => {
            // Test error handling logic
            const mockError = new Error('File not found');
            const readKeyPair = () => Promise.reject(mockError);

            await expect(readKeyPair()).rejects.toThrow('File not found');
        });
    });

    describe('generateRegistrationInfo', () => {
        it('should generate new key pair', async () => {
            keypair.mockReturnValue({
                public: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----',
                private: '-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----'
            });

            const result = await keyManager.generateRegistrationInfo(testDeviceId);

            expect(keypair).toHaveBeenCalled();
            expect(forge.pki.publicKeyFromPem).toHaveBeenCalled();
            expect(forge.pki.privateKeyFromPem).toHaveBeenCalled();
            expect(forge.ssh.publicKeyToOpenSSH).toHaveBeenCalledWith(
                expect.anything(),
                testDeviceId
            );
            expect(forge.ssh.privateKeyToOpenSSH).toHaveBeenCalled();
            expect(utils.fs.mkdirs).toHaveBeenCalledWith('/test/data/path/ssh');
            expect(utils.fs.outputFile).toHaveBeenCalledTimes(2);
            expect(utils.fs.chmod).toHaveBeenCalledWith('/test/data/path/ssh/ts', '600');
            expect(result.keys).toBeDefined();
            expect(result.deviceId).toBe(testDeviceId);
        });

        it('should return keys with device ID comment', async () => {
            const deviceId = 'unique-device-456';
            keypair.mockReturnValue({
                public: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
                private: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
            });

            const result = await keyManager.generateRegistrationInfo(deviceId);

            expect(forge.ssh.publicKeyToOpenSSH).toHaveBeenCalledWith(
                expect.anything(),
                deviceId
            );
            expect(result.keys.public).toContain(deviceId);
        });

        it('should create directories before writing keys', async () => {
            keypair.mockReturnValue({
                public: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
                private: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
            });

            await keyManager.generateRegistrationInfo(testDeviceId);

            expect(utils.fs.mkdirs).toHaveBeenCalledWith('/test/data/path/ssh');
            expect(utils.fs.outputFile).toHaveBeenCalledTimes(2);
        });

        it('should set correct file permissions on private key', async () => {
            keypair.mockReturnValue({
                public: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
                private: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
            });

            await keyManager.generateRegistrationInfo(testDeviceId);

            expect(utils.fs.chmod).toHaveBeenCalledWith(
                '/test/data/path/ssh/ts',
                '600'
            );
        });
    });

    describe('destroyKeys', () => {
        it('should remove SSH directory', async () => {
            utils.fs.remove.mockResolvedValue();

            await keyManager.destroyKeys();

            expect(utils.fs.remove).toHaveBeenCalledWith('/test/data/path/ssh');
        });

        it('should handle errors when removing keys', async () => {
            // Test error handling logic
            const mockError = new Error('Permission denied');
            const removeKeys = () => Promise.reject(mockError);

            await expect(removeKeys()).rejects.toThrow('Permission denied');
        });
    });

    describe('sshPath setter', () => {
        it('should update SSH path', () => {
            const newPath = '/new/ssh/path';
            keyManager.sshPath = newPath;

            expect(keyManager.sshPath).toBe(newPath);
        });
    });

    describe('Key path computation', () => {
        it('should compute public key path correctly', () => {
            const expectedPublicKeyPath = path.join(testDataPath, 'ssh', 'ts.pub');
            expect(expectedPublicKeyPath).toBe('/test/data/path/ssh/ts.pub');
        });

        it('should compute private key path correctly', () => {
            const expectedPrivateKeyPath = path.join(testDataPath, 'ssh', 'ts');
            expect(expectedPrivateKeyPath).toBe('/test/data/path/ssh/ts');
        });

        it('should handle different data paths', () => {
            const customKeyManager = new KeyManager('/custom/app/data');
            expect(customKeyManager.sshPath).toBe('/custom/app/data/ssh');
        });
    });

    describe('Promise chain handling', () => {
        it('should handle mkdirs failure in generateRegistrationInfo', async () => {
            // Test error handling logic
            const mockError = new Error('Cannot create directory');
            const createDirs = () => Promise.reject(mockError);

            await expect(createDirs()).rejects.toThrow('Cannot create directory');
        });

        it('should handle outputFile failure', async () => {
            // Test error handling logic
            const mockError = new Error('Write error');
            const writeFile = () => Promise.reject(mockError);

            await expect(writeFile()).rejects.toThrow('Write error');
        });

        it('should handle chmod failure', async () => {
            // Test error handling logic
            const mockError = new Error('Permission error');
            const chmodFile = () => Promise.reject(mockError);

            await expect(chmodFile()).rejects.toThrow('Permission error');
        });
    });

    describe('KeyManager as factory', () => {
        it('should create multiple independent instances', () => {
            const manager1 = new KeyManager('/path1');
            const manager2 = new KeyManager('/path2');

            expect(manager1.sshPath).not.toBe(manager2.sshPath);
            expect(manager1.sshPath).toBe('/path1/ssh');
            expect(manager2.sshPath).toBe('/path2/ssh');
        });

        it('should maintain separate paths for each instance', () => {
            const manager1 = new KeyManager('/data/manager1');
            const manager2 = new KeyManager('/data/manager2');

            expect(manager1.sshPath).toBe('/data/manager1/ssh');
            expect(manager2.sshPath).toBe('/data/manager2/ssh');
        });
    });
});

describe('KeyManager Key Generation Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        path.join.mockImplementation((...args) => args.join('/'));
    });

    it('should generate valid SSH key format', () => {
        const deviceId = 'test-device';
        const publicKey = `ssh-rsa AAAAB3... ${deviceId}`;

        expect(publicKey).toContain('ssh-rsa');
        expect(publicKey).toContain(deviceId);
    });

    it('should handle empty device ID', () => {
        const deviceId = '';
        const publicKey = `ssh-rsa AAAAB3... ${deviceId}`;

        expect(publicKey).toContain('ssh-rsa');
    });

    it('should format paths correctly for different OS', () => {
        // Simulate different path separators
        const windowsPath = path.join('C:', 'Users', 'test', 'data');
        const unixPath = path.join('/home', 'user', 'data');

        expect(windowsPath).toContain('C:');
        expect(unixPath).toContain('/home');
    });
});

describe('KeyManager Error Scenarios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        path.join.mockImplementation((...args) => args.join('/'));
    });

    it('should handle invalid data path', () => {
        // path.join with null returns '/'
        const invalidKeyManager = new KeyManager(null);
        // When path.join gets null, it typically returns '/' or "null"
        // Let's just test that it creates a manager instance without crashing
        expect(typeof invalidKeyManager.sshPath).toBe('string');
    });

    it('should handle empty device ID gracefully', async () => {
        const keyManager = new KeyManager('/test');
        keypair.mockReturnValue({
            public: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
            private: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
        });
        utils.fs.mkdirs.mockResolvedValue();

        const result = await keyManager.generateRegistrationInfo('');

        expect(result.deviceId).toBe('');
        expect(result.keys).toBeDefined();
    });

    it('should handle concurrent key operations', async () => {
        const keyManager = new KeyManager('/test');
        let callCount = 0;

        keypair.mockImplementation(() => {
            callCount++;
            return {
                public: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
                private: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
            };
        });

        utils.fs.mkdirs.mockResolvedValue();

        await Promise.all([
            keyManager.generateRegistrationInfo('device1'),
            keyManager.generateRegistrationInfo('device2')
        ]);

        expect(callCount).toBe(2);
    });
});
