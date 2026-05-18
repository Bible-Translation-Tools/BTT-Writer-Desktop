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
    let mockConfigurator;

    const ROOT_DIR = '.';
    const LOG_FILE = path.normalize(path.join(ROOT_DIR, 'log.txt'));
    const HELPDESK_TOKEN = 'mock-helpdesk-token';

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

        mockConfigurator = {
            getValue: jest.fn((key) => {
                const values = {
                    rootDir: ROOT_DIR,
                    userdata: { username: 'tester' }
                };
                return values[key];
            }),
            getUserSetting: jest.fn(() => ({ name: 'test-server' }))
        };

        const ReporterModule = require('../src/js/reporter');
        Reporter = ReporterModule.Reporter;

        reporter = new Reporter({
            helpdeskToken: HELPDESK_TOKEN,
            configurator: mockConfigurator
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

    describe('Helpdesk Ticket Submission', () => {
        const setupHttpsMock = (statusCode = 200) => {
            const mockRes = {
                setEncoding: jest.fn(),
                statusCode: statusCode,
                on: jest.fn().mockReturnThis()
            };

            mockHttps.request.mockImplementation((opts, cb) => {
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

            return mockRes;
        };

        it('should POST a multipart ticket to the helpdesk webhook', async () => {
            const mockRes = setupHttpsMock(200);

            await reporter.sendHelpdeskTicket('Test bug');

            expect(mockHttps.request).toHaveBeenCalled();
            const requestOptions = mockHttps.request.mock.calls[0][0];
            expect(requestOptions.host).toBe('helpdesk.techadvancement.com');
            expect(requestOptions.method).toBe('POST');
            expect(requestOptions.path).toContain(HELPDESK_TOKEN);
            expect(requestOptions.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/);
            expect(mockRes.setEncoding).toHaveBeenCalledWith('utf8');
        });

        it('should include stack trace when isCrash is true', async () => {
            setupHttpsMock(200);

            const writtenChunks = [];
            mockHttps.request.mockImplementation((opts, cb) => {
                const mockRes = {
                    setEncoding: jest.fn(),
                    statusCode: 200,
                    on: jest.fn().mockReturnThis()
                };
                if (cb) cb(mockRes);
                const endHandler = mockRes.on.mock.calls.find(call => call[0] === 'end');
                if (endHandler) endHandler[1]();

                return {
                    on: jest.fn().mockReturnThis(),
                    write: jest.fn((payload) => writtenChunks.push(payload)),
                    end: jest.fn()
                };
            });

            await reporter.sendHelpdeskTicket('Crash summary', {
                isCrash: true,
                stack: 'Error: boom\n  at foo'
            });

            const body = Buffer.concat(writtenChunks.map(c => Buffer.isBuffer(c) ? c : Buffer.from(c))).toString('utf8');
            expect(body).toContain('## Stack Trace');
            expect(body).toContain('Error: boom');
        });

        it('should reject if helpdesk webhook token is not configured', async () => {
            const tokenless = new Reporter({
                configurator: mockConfigurator
            });

            await expect(tokenless.sendHelpdeskTicket('summary')).rejects.toThrow(
                'Helpdesk webhook token not configured'
            );
        });

        it('should reject when server responds with error status', async () => {
            setupHttpsMock(500);

            await expect(reporter.sendHelpdeskTicket('Test bug')).rejects.toThrow(
                /Helpdesk submission failed: 500/
            );
        });
    });
});
