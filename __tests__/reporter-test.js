'use strict';

/**
 * @jest-environment node
 */

// 1. Setup Mocks
jest.mock('../src/js/lib/utils', () => ({
    fs: {
        appendFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(),
        readFile: jest.fn().mockResolvedValue('test content'),
        unlink: jest.fn().mockResolvedValue(),
        mkdirs: jest.fn().mockResolvedValue(),
        stat: jest.fn().mockResolvedValue({size: 0})
    }
}));
jest.mock('https');
jest.unmock('../src/js/reporter');

const utils = require('../src/js/lib/utils');
const https = require('https');

const config = {
    logPath: 'mylogpath.txt',
    verbose: false
};

describe('Reporter', () => {
    let reporter;

    beforeEach(() => {
        jest.clearAllMocks();
        const Reporter = require('../src/js/reporter').Reporter;
        reporter = new Reporter(config);
    });

    describe('logWarning', () => {
        it('should log a string', async () => {
            await reporter.logWarning('test warning');
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });

        it('should log a flat object', async () => {
            await reporter.logWarning({ test: 'object' });
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });

        it('should log with a null title', async () => {
            await reporter.logWarning(null, null);
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });
    });

    describe('logError', () => {
        it('should log a string', async () => {
            await reporter.logError('test error');
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });

        it('should log a flat object', async () => {
            await reporter.logError({ test: 'object' });
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });

        it('should log with a null title', async () => {
            await reporter.logError(null, null);
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });
    });

    describe('logNotice', () => {
        it('should log a string', async () => {
            await reporter.logNotice('test notice');
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });

        it('should log a flat object', async () => {
            await reporter.logNotice({ test: 'object' });
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });

        it('should log with a null title', async () => {
            await reporter.logNotice(null, null);
            expect(utils.fs.appendFile).toHaveBeenCalled();
        });
    });

    describe('clearLog', () => {
        it('should clear the contents of the log', async () => {
            await reporter.clearLog();
            expect(utils.fs.writeFile).toHaveBeenCalled();
        });
    });

    describe('ReporterNetworkCalls', () => {
        describe('reportBug', () => {
            it('should successfully submit the report', async () => {
                // Setup https mock
                const mockResponse = {
                    statusCode: 201,
                    setEncoding: jest.fn(),
                    on: jest.fn((event, callback) => {
                        if (event === 'data') callback('response data');
                        if (event === 'end') callback();
                        return mockResponse;
                    })
                };

                const mockRequest = {
                    on: jest.fn(),
                    write: jest.fn(),
                    end: jest.fn()
                };

                https.request.mockImplementation((options, callback) => {
                    callback(mockResponse);
                    return mockRequest;
                });

                // Mock canReportToGithub to return true
                reporter.canReportToGithub = jest.fn().mockReturnValue(true);

                // Note: reportBug doesn't call the callback parameter - it returns a Promise
                await reporter.reportBug('Test bug report');

                expect(https.request).toHaveBeenCalled();
            });
        });
    });
});
