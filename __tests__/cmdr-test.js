'use strict';

// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

const child_process = require('child_process');

// Unmock cmdr to test actual implementation
jest.unmock('../src/js/lib/cmdr');

const cmdr = require('../src/js/lib/cmdr');

describe('cmdr', () => {
    let cmd;

    beforeEach(() => {
        jest.clearAllMocks(); // Now available in Jest 30
        cmd = cmdr(['/usr/bin', '/bin']);
    });

    describe('path string construction', () => {
        it('should create PATH string for non-Windows platforms', () => {
            // Mock non-Windows platform
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });

            const cmdWithPaths = cmdr(['/usr/bin', '/bin']);
            const result = cmdWithPaths('echo test');

            // The path string is prepended in the do() method
            expect(result.do('echo test').toString()).toContain('PATH=/usr/bin:/bin:$PATH echo test');

            // Restore original platform
            Object.defineProperty(process, 'platform', {
                value: originalPlatform
            });
        });

        it('should not create PATH string for Windows', () => {
            // Mock Windows platform
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });

            const cmdNoPaths = cmdr(['/usr/bin', '/bin']);
            const result = cmdNoPaths('echo test');

            expect(result.do('echo test').toString()).toBe('echo testecho test');

            // Restore original platform
            Object.defineProperty(process, 'platform', {
                value: originalPlatform
            });
        });

        it('should handle empty paths array', () => {
            const cmdEmpty = cmdr([]);
            const result = cmdEmpty('echo test');

            expect(result.do('echo test').toString()).toBe('echo testecho test');
        });

        it('should handle null/undefined paths', () => {
            const cmdNull = cmdr(null);
            const result = cmdNull('echo test');

            expect(result.do('echo test').toString()).toBe('echo testecho test');
        });
    });

    describe('command chaining', () => {
        it('should chain cd commands', () => {
            const result = cmd('echo start').cd('/tmp').cd('/home');

            expect(result.toString()).toBe('echo startcd "/tmp"cd "/home"');
        });

        it('should chain with and operator', () => {
            const result = cmd('echo first').and.do('echo second');

            expect(result.toString()).toBe('echo first && PATH=/usr/bin:/bin:$PATH echo second');
        });

        it('should chain with then operator for non-Windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });

            const result = cmd('echo first').then.do('echo second');

            expect(result.toString()).toBe('echo first; PATH=/usr/bin:/bin:$PATH echo second');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform
            });
        });

        it('should chain with or operator', () => {
            const result = cmd('echo first').or.do('echo second');

            expect(result.toString()).toBe('echo first || PATH=/usr/bin:/bin:$PATH echo second');
        });

        it('should combine multiple chaining operations', () => {
            const result = cmd('mkdir test')
                .and.cd('test')
                .and.do('echo done')
                .or.do('echo failed');

            expect(result.toString()).toBe('mkdir test && cd "test" && PATH=/usr/bin:/bin:$PATH echo done || PATH=/usr/bin:/bin:$PATH echo failed');
        });
    });

    describe('variable setting', () => {
        it('should set variables for non-Windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });

            const result = cmd('echo start').set('MY_VAR', 'my_value').do('echo $MY_VAR');

            expect(result.toString()).toBe('echo startMY_VAR=\'my_value\' PATH=/usr/bin:/bin:$PATH echo $MY_VAR');

            Object.defineProperty(process, 'platform', {
                value: originalPlatform
            });
        });
    });

    describe('command execution', () => {
        it('should execute command and resolve on success', async () => {
            const mockExec = child_process.exec;
            mockExec.mockImplementation((command, callback) => {
                callback(null, 'command output', '');
            });

            const result = await cmd('echo test').run();

            expect(mockExec).toHaveBeenCalledWith('echo test', expect.any(Function));
            expect(result).toEqual({
                stdout: 'command output',
                stderr: '',
                error: null
            });
        });

        it('should execute command and reject on error', async () => {
            const mockExec = child_process.exec;
            const testError = new Error('Command failed');
            mockExec.mockImplementation((command, callback) => {
                callback(testError, '', 'error output');
            });

            await expect(cmd('failing command').run()).rejects.toEqual({
                stdout: '',
                stderr: 'error output',
                error: testError
            });
        });
    });

    describe('string representation', () => {
        it('should return accumulated command string', () => {
            const result = cmd('base command').and.do('additional command');

            expect(result.toString()).toBe('base command && PATH=/usr/bin:/bin:$PATH additional command');
        });
    });
});