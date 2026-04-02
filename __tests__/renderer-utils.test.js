/**
 * @jest-environment jsdom
 */

'use strict';

describe('renderer-utils (Log)', () => {
    let mockLogWithCaller;

    beforeEach(() => {
        mockLogWithCaller = jest.fn().mockReturnValue(Promise.resolve('logged'));

        global.App = {
            reporter: {
                logWithCaller: mockLogWithCaller
            }
        };

        delete global.window.Log;

        require('../src/js/renderer-utils');
    });

    afterEach(() => {
        jest.resetModules();
        delete global.App;
    });

    describe('Log object', () => {
        it('should be defined on window', () => {
            expect(window.Log).toBeDefined();
        });

        it('should have error, warning, and notice methods', () => {
            expect(typeof window.Log.error).toBe('function');
            expect(typeof window.Log.warning).toBe('function');
            expect(typeof window.Log.notice).toBe('function');
        });
    });

    describe('Log.error', () => {
        it('should call logWithCaller with level E', () => {
            Log.error('some error', 'Error Title');

            expect(mockLogWithCaller).toHaveBeenCalledTimes(1);
            expect(mockLogWithCaller.mock.calls[0][0]).toBe('E');
            expect(mockLogWithCaller.mock.calls[0][1]).toBe('some error');
            expect(mockLogWithCaller.mock.calls[0][2]).toBe('Error Title');
        });

        it('should pass a caller location string', () => {
            Log.error('err', 'title');

            const callerLocation = mockLogWithCaller.mock.calls[0][3];
            expect(typeof callerLocation).toBe('string');
            expect(callerLocation.length).toBeGreaterThan(0);
        });

        it('should include file name and line number in caller location', () => {
            Log.error('err', 'title');

            const callerLocation = mockLogWithCaller.mock.calls[0][3];
            // Should match pattern like "filename.js:123"
            expect(callerLocation).toMatch(/\.js:\d+/);
        });

        it('should return the result from logWithCaller', () => {
            const result = Log.error('err', 'title');
            expect(result).toEqual(expect.any(Promise));
        });
    });

    describe('Log.warning', () => {
        it('should call logWithCaller with level W', () => {
            Log.warning('some warning', 'Warning Title');

            expect(mockLogWithCaller).toHaveBeenCalledTimes(1);
            expect(mockLogWithCaller.mock.calls[0][0]).toBe('W');
            expect(mockLogWithCaller.mock.calls[0][1]).toBe('some warning');
            expect(mockLogWithCaller.mock.calls[0][2]).toBe('Warning Title');
        });

        it('should include caller location', () => {
            Log.warning('warn', 'title');

            const callerLocation = mockLogWithCaller.mock.calls[0][3];
            expect(callerLocation).toMatch(/\.js:\d+/);
        });
    });

    describe('Log.notice', () => {
        it('should call logWithCaller with level I', () => {
            Log.notice('some notice', 'Notice Title');

            expect(mockLogWithCaller).toHaveBeenCalledTimes(1);
            expect(mockLogWithCaller.mock.calls[0][0]).toBe('I');
            expect(mockLogWithCaller.mock.calls[0][1]).toBe('some notice');
            expect(mockLogWithCaller.mock.calls[0][2]).toBe('Notice Title');
        });

        it('should include caller location', () => {
            Log.notice('info', 'title');

            const callerLocation = mockLogWithCaller.mock.calls[0][3];
            expect(callerLocation).toMatch(/\.js:\d+/);
        });
    });

    describe('caller location accuracy', () => {
        it('should point to the caller, not the renderer-utils module', () => {
            Log.error('err', 'title');

            const callerLocation = mockLogWithCaller.mock.calls[0][3];
            // The caller location should reference the test file (the caller),
            // not renderer-utils.js (the module itself without .test suffix)
            expect(callerLocation).toMatch(/renderer-utils\.test\.js:\d+/);
            expect(callerLocation).not.toMatch(/renderer-utils\.js:/);
        });

        it('should produce different locations for calls from different lines', () => {
            Log.error('err1', 'title1');
            Log.error('err2', 'title2');

            const loc1 = mockLogWithCaller.mock.calls[0][3];
            const loc2 = mockLogWithCaller.mock.calls[1][3];
            // Same file but different line numbers
            expect(loc1).not.toBe(loc2);
        });
    });

    describe('edge cases', () => {
        it('should work with no title', () => {
            Log.error('err');

            expect(mockLogWithCaller).toHaveBeenCalledTimes(1);
            expect(mockLogWithCaller.mock.calls[0][1]).toBe('err');
            expect(mockLogWithCaller.mock.calls[0][2]).toBeUndefined();
        });

        it('should work with Error objects', () => {
            const error = new Error('test error');
            Log.error(error, 'title');

            expect(mockLogWithCaller.mock.calls[0][1]).toBe(error);
        });

        it('should work with null/undefined err', () => {
            Log.error(null, 'title');
            expect(mockLogWithCaller.mock.calls[0][1]).toBeNull();

            Log.error(undefined, 'title');
            expect(mockLogWithCaller.mock.calls[1][1]).toBeUndefined();
        });
    });
});
