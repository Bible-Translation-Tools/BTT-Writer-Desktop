/**
 * @jest-environment node
 */

'use strict';

const path = require('path');

// 1. Setup Global lodash
global._ = require('lodash');

// 2. Setup Mocks
jest.mock('lodash');
jest.mock('https');
jest.mock('fs');
jest.mock('os', () => ({
    type: () => 'Linux',
    platform: () => 'linux',
    release: () => '5.15.0',
    arch: () => 'x64'
}));
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('Reporter', () => {
    let Reporter;
    let reporter;
    let mockUtils;
    let mockHttps;

    const LOG_FILE = './test-log.txt';
    const OAUTH = 'mock-token';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');
        mockHttps = require('https');

        // Defensive Mocking for utility functions
        const fsMethods = ['mkdirs', 'appendFile', 'writeFile', 'readFile', 'stat', 'unlink'];
        fsMethods.forEach(method => {
            if (!mockUtils.fs[method]) mockUtils.fs[method] = jest.fn();
            mockUtils.fs[method].mockResolvedValue(true);
        });

        mockUtils.fs.readFile.mockResolvedValue('existing log data');
        mockUtils.fs.stat.mockResolvedValue({ size: 1024 });

        const ReporterModule = require('../src/js/reporter');
        Reporter = ReporterModule.Reporter;

        reporter = new Reporter({
            logPath: LOG_FILE,
            oauthToken: OAUTH,
            repoOwner: 'owner',
            repo: 'repo',
            appVersion: '1.2.3'
        });
    });

    describe('Log Truncation', () => {
        it('should truncate and rewrite the log file when it exceeds size limit', async () => {
            // Setup input: 6 lines
            const input = 'L1\nL2\nL3\nL4\nL5\nL6';
            mockUtils.fs.stat.mockResolvedValue({ size: 300 * 1024 }); // 300KB
            mockUtils.fs.readFile.mockResolvedValue(input);

            // We need to clear call history to be sure appendFile is called during truncation
            mockUtils.fs.appendFile.mockClear();
            mockUtils.fs.appendFile.mockResolvedValue(true);

            await reporter.truncateLogFile();

            // Slicing logic: lines.slice(3, 5) -> ["L4", "L5"]
            expect(mockUtils.fs.appendFile).toHaveBeenCalledWith(
                path.normalize(LOG_FILE),
                'L4\nL5'
            );
        });
    });

    describe('GitHub Issue Reporting', () => {
        it('should handle the chained .on() calls in the https response', async () => {
            // DECISIVE FIX: Mock response to support chaining .on('data').on('end')
            const mockRes = {
                setEncoding: jest.fn(),
                statusCode: 200,
                on: jest.fn().mockReturnThis()
            };

            mockHttps.request.mockImplementation((opts, cb) => {
                // Immediately call the callback to trigger the 'data'/'end' listeners
                if (cb) cb(mockRes);

                // Trigger the 'end' event to resolve the promise
                const endHandler = mockRes.on.mock.calls.find(call => call[0] === 'end');
                if (endHandler) endHandler[1]();

                return {
                    on: jest.fn().mockReturnThis(),
                    write: jest.fn(),
                    end: jest.fn()
                };
            });

            await reporter.reportBug('Test bug');

            expect(mockHttps.request).toHaveBeenCalled();
            expect(mockRes.setEncoding).toHaveBeenCalledWith('utf8');
        });

        it('should reject if bug report message is missing', async () => {
            await expect(reporter.reportBug(null)).rejects.toBe('reporter.reportBug requires a message.');
        });
    });
});
