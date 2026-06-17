/**
 * @jest-environment node
 */

'use strict';

// 1. Setup Global lodash
const lodash = require('lodash');
global._ = lodash;

// 2. Setup Mocks
jest.mock('lodash');
jest.mock('gogs-client-fork');
jest.mock('gogs-client-fork/lib/request');
jest.mock('os', () => ({ hostname: () => 'test-host' }));
jest.mock('../src/js/lib/utils', () => {
    const mock = require('../__mocks__/local-utils');
    mock.getMachineIdSync = jest.fn(() => 'machine-123');
    return mock;
});

describe('UserManager', () => {
    let UserManager;
    let userManager;
    let mockApi;
    let mockRequester;

    const MOCK_SERVER = 'https://git.server.com';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const Gogs = require('gogs-client-fork');
        mockRequester = require('gogs-client-fork/lib/request');

        const UserModule = require('../src/js/user');
        UserManager = UserModule.UserManager;
        userManager = new UserManager(MOCK_SERVER);

        mockApi = Gogs.mock.results[0].value;

        global.App = {
            locale: { translate: jest.fn(k => k) }
        };
    });

    describe('Account Management', () => {
        it('should handle login and refresh tokens', async () => {
            const userObj = { username: 'bob', password: 'password' };
            // Platform in JSDOM/Node usually returns 'linux' or 'darwin'
            const platform = process.platform;
            const expectedTokenName = `btt-writer-desktop_test-host_${platform}__machine-123`;
            const existingToken = { name: expectedTokenName, id: 50 };

            mockApi.getUser.mockResolvedValue({ id: 10, username: 'bob' });
            mockApi.listTokens.mockResolvedValue([existingToken]);

            const mockApiRequest = jest.fn().mockResolvedValue({ status: 204 });
            mockRequester.mockReturnValue(mockApiRequest);

            await userManager.login(userObj);

            expect(mockApiRequest).toHaveBeenCalledWith(
                expect.stringContaining('tokens/50'),
                expect.any(Object),
                null,
                'DELETE'
            );
        });
    });

    describe('Repository Operations', () => {
        it('should fetch repos exhaustively across pages', async () => {
            // Page 1 returns a repo, Page 2 is empty
            mockApi.searchRepos
                .mockResolvedValueOnce([{ full_name: 'bob/repo1', id: 1 }])
                .mockResolvedValueOnce([]);

            await userManager.createRepo({ id: 10, username: 'bob' }, 'new-repo');

            expect(mockApi.searchRepos).toHaveBeenCalledTimes(2);

            // Matches the logic: `${query}&page=${page}` where query defaults to "_"
            expect(mockApi.searchRepos).toHaveBeenCalledWith('_&page=1', 10, 50);
            expect(mockApi.searchRepos).toHaveBeenCalledWith('_&page=2', 10, 50);

            expect(mockApi.createRepo).toHaveBeenCalled();
        });
    });

    describe('SSH Key Management', () => {
        it('should register a public key', async () => {
            const user = {
                username: 'bob',
                reg: { keys: { public: 'ssh-rsa XYZ' } }
            };
            mockApi.listPublicKeys.mockResolvedValue([]);

            await userManager.register(user, 'device-456');

            expect(mockApi.createPublicKey).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'btt-writer-desktop device-456' }),
                user
            );
        });

        it('should unregister a public key', async () => {
            const user = { username: 'bob' };
            const existingKey = { title: 'btt-writer-desktop device-456', id: 123 };
            mockApi.listPublicKeys.mockResolvedValue([existingKey]);

            await userManager.unregister(user, 'device-456');

            expect(mockApi.deletePublicKey).toHaveBeenCalledWith(existingKey, user);
        });
    });
});
