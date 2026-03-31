/**
 * @jest-environment node
 */

'use strict';

const path = require('path');

// 1. Setup Global lodash with the required alias
jest.mock('lodash', () => {
    const actual = jest.requireActual('lodash');
    actual.unique = actual.uniq;
    return actual;
});
global._ = require('lodash');

// 2. Setup Mocks
jest.mock('fs');
jest.mock('adm-zip');
jest.mock('mkdirp');
jest.mock('prince');
jest.mock('../src/js/prince-packager', () => ({
    info: jest.fn(() => ({ binary: 'prince-bin', prefix: 'prince-pre' }))
}));
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('PrintManager', () => {
    let PrintManager;
    let printer;
    let mockUtils;
    let mockFs;
    let mockAdmZip;

    const ROOT_DIR = '/app/data';
    const TEMP_DIR = '/tmp/print';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');
        mockFs = require('fs');
        mockAdmZip = require('adm-zip');

        // Ensure all utility methods return promises
        mockUtils.fs.mkdirs.mockResolvedValue(true);
        mockUtils.fs.remove.mockResolvedValue(true);
        mockUtils.download.mockResolvedValue(true);

        const mockConfigurator = {
            getValue: jest.fn(key => {
                if (key === 'rootdir') return ROOT_DIR;
                if (key === 'tempDir') return TEMP_DIR;
                return null;
            }),
            getUserSetting: jest.fn(key => {
                if (key === 'mediaserver') return 'https://server.com/';
                if (key === 'targetfont') return { name: 'Noto' };
                if (key === 'targetsize') return { name: 'Normal' };
                return null;
            })
        };

        const i18n = {
            getLocale: () => ({ code: 'en' }),
            translate: jest.fn(k => k)
        };

        const PrinterModule = require('../src/js/printer');
        PrintManager = PrinterModule.PrintManager;
        printer = new PrintManager(mockConfigurator, i18n);
    });

    describe('downloadImages', () => {
        it('should download if zip does not exist', async () => {
            mockUtils.fs.stat.mockRejectedValue(new Error('ENOENT'));

            await printer.downloadImages();

            expect(mockUtils.download).toHaveBeenCalled();
        });

        it('should skip download if zip already exists', async () => {
            mockUtils.fs.stat.mockResolvedValue({ size: 1234 });

            await printer.downloadImages();

            expect(mockUtils.download).not.toHaveBeenCalled();
        });
    });

    describe('extractImages', () => {
        it('should extract and flatten the directory structure', () => {
            // Mocking readdirSync for flattening logic
            mockFs.readdirSync
                .mockReturnValueOnce(['subdir']) // First call: find directories
                .mockReturnValueOnce(['image1.jpg']); // Second call: find files in subdir

            mockFs.statSync.mockReturnValue({ isDirectory: () => true });

            printer.extractImages();

            // Check if it attempted to rename the file to the root image path
            expect(mockFs.renameSync).toHaveBeenCalled();
            expect(mockFs.rmdirSync).toHaveBeenCalled();
        });
    });

    describe('savePdf', () => {
        it('should generate HTML and call Prince PDF generator', async () => {
            const mockPrince = require('prince');
            const mkdirp = require('mkdirp');

            await printer.savePdf('Gen', 'Genesis', 'CC-BY-SA', 'Content', '/out.pdf', 'ltr');

            expect(mkdirp.sync).toHaveBeenCalledWith(TEMP_DIR);
            expect(mockFs.writeFileSync).toHaveBeenCalled();
            expect(mockPrince().execute).toHaveBeenCalled();
            expect(mockUtils.fs.remove).toHaveBeenCalledWith(TEMP_DIR);
        });

        it('should handle permission errors during PDF generation', async () => {
            const mockPrince = require('prince');
            // Mock the execute rejection to simulate a Prince error
            mockPrince().execute.mockRejectedValue({ stderr: 'Permission denied' });

            await expect(printer.savePdf('r', 't', 'l', 'b', 'f', 'ltr'))
                .rejects.toBe('write_to_file_failed');

            // Should still attempt cleanup
            expect(mockUtils.fs.remove).toHaveBeenCalledWith(TEMP_DIR);
        });
    });

    describe('getLicense', () => {
        it('should read the correct license asset based on locale', () => {
            mockFs.readFileSync.mockReturnValue('License Content');

            const content = printer.getLicense('LICENSE.md');

            expect(mockFs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining(path.join('assets', 'licenses', 'en', 'LICENSE.md')),
                'utf8'
            );
            expect(content).toBe('License Content');
        });
    });
});
