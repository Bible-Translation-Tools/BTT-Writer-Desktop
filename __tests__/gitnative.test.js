/**
 * @jest-environment node
 */

'use strict';

// 1. Force lodash into the global scope for the module to find
const lodash = require('lodash');
global._ = lodash;

// 2. Setup Mocks
jest.mock('../src/js/lib/cmdr', () => require('../__mocks__/local-cmdr'));
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('GitManager', () => {
    let GitManager;
    let gitManager;
    let mockCmdrRunner;
    let mockUtils;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');
        const mockCmdrModule = require('../src/js/lib/cmdr');
        mockCmdrRunner = mockCmdrModule.mockRunner;

        const translate = jest.fn((key) => `translated_${key}`);

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const GitModule = require('../src/js/gitnative');
        GitManager = GitModule.GitManager;
        gitManager = new GitManager(translate);
    });

    describe('Environment Verification', () => {
        it('should get git version strings and parse them', async () => {
            mockCmdrRunner.mockResolvedValue({ stdout: 'git version 2.25.1' });
            const version = await gitManager.getVersion();
            expect(version.major).toBe(2);
            expect(version.toString()).toBe('2.25.1');
        });

        it('should verify git meets requirements', async () => {
            mockCmdrRunner.mockResolvedValue({ stdout: 'git version 2.30.0' });
            const version = await gitManager.verifyGit();
            expect(version.major).toBe(2);
        });
    });

    describe('Repository Operations', () => {
        it('should get the hash of HEAD', async () => {
            mockCmdrRunner.mockResolvedValue({ stdout: 'abc123hash' });
            const result = await gitManager.getHash('/repo');
            expect(result.stdout).toBe('abc123hash');
        });

        it('should initialize a git repository if .git is missing', async () => {
            mockUtils.fs.readdir.mockResolvedValue(['file.txt']);
            mockCmdrRunner.mockResolvedValue({ stdout: 'Initialized' });
            const result = await gitManager.init('/repo');
            expect(result).toBe('translated_git_initialized');
        });

        it('should commit all changes', async () => {
            const user = { username: 'tester', email: 'test@example.com' };
            mockCmdrRunner.mockResolvedValue({ stdout: 'committed' });
            const result = await gitManager.commitAll(user, '/repo');
            expect(result).toBe('translated_files_committed');
        });
    });

    describe('Merge Logic', () => {
        const localPath = '/local';
        const remotePath = '/remote';
        const user = { username: 'D', email: 'd@d.com' };

        it('should merge remote changes and union manifest data', async () => {
            const localM = { translators: ['A'], finished_chunks: ['01-01'] };
            const remoteM = { translators: ['B'], finished_chunks: ['01-02'] };

            mockUtils.fs.readFile
                .mockResolvedValueOnce(JSON.stringify(localM))
                .mockResolvedValueOnce(JSON.stringify(remoteM));

            // Chain of command responses
            mockCmdrRunner
                .mockResolvedValueOnce({ stdout: 'git version 2.25.0' }) // getVersion
                .mockResolvedValueOnce({ stdout: 'Merged', stderr: '' }) // pull
                .mockResolvedValue({ stdout: 'ok' }); // commitAll sequence

            const result = await gitManager.merge(user, localPath, remotePath);

            expect(result.conflicts).toEqual([]);
            // Verify union logic (now using actual lodash via global._)
            expect(result.manifest.translators).toContain('A');
            expect(result.manifest.translators).toContain('B');
            expect(result.manifest.finished_chunks).toContain('01-01');
            expect(result.manifest.finished_chunks).toContain('01-02');
        });

        it('should detect conflicts and remove them from finished_chunks', async () => {
            const localM = { translators: ['A'], finished_chunks: ['01-01', '01-02'] };
            const remoteM = { translators: ['B'], finished_chunks: ['01-03'] };

            mockUtils.fs.readFile
                .mockResolvedValueOnce(JSON.stringify(localM))
                .mockResolvedValueOnce(JSON.stringify(remoteM));

            mockCmdrRunner
                .mockResolvedValueOnce({ stdout: 'git version 2.25.0' }) // getVersion
                .mockRejectedValueOnce({ stdout: 'fix conflicts', stderr: 'Automatic merge failed' }) // pull fail
                .mockResolvedValueOnce({ stdout: '01/01.txt\n01/02.txt' }) // diff --name-only
                .mockResolvedValue({ stdout: 'ok' }); // commitAll

            const result = await gitManager.merge(user, localPath, remotePath);

            // Parsing: 01/01.txt -> 01-01
            expect(result.conflicts).toContain('01-01');
            expect(result.conflicts).toContain('01-02');

            // Should be removed from finished_chunks
            expect(result.manifest.finished_chunks).not.toContain('01-01');
            expect(result.manifest.finished_chunks).not.toContain('01-02');
            expect(result.manifest.finished_chunks).toContain('01-03');
        });
    });

    describe('Push & Tagging', () => {
        const repo = { ssh_url: 'git@ssh.com', html_url: 'http://git.com' };

        it('should tag and push to remote using SSH keys', async () => {
            const user = {
                reg: { paths: { privateKeyPath: '/key' } }
            };

            mockCmdrRunner.mockResolvedValue({ stdout: 'ok' });

            const result = await gitManager.push(user, '/repo', repo, { requestToPublish: true });
            expect(result).toBe('translated_files_pushed');
        });

        it('should fail gracefully if user reg is missing (testing source crash point)', async () => {
            // Source line 207: user.reg.paths.privateKeyPath will throw if reg is null
            const user = { reg: null };

            expect(() => {
                gitManager.push(user, '/repo', repo, { requestToPublish: false });
            }).toThrow();
        });
    });
});
