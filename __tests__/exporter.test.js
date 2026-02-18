/**
 * @jest-environment node
 */

'use strict';

// 1. Setup Mocks
jest.mock('archiver');
jest.mock('fs');
jest.mock('lodash');

// Mock local utils
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('ExportManager', () => {
    let ExportManager;
    let exportManager;

    // Dependencies
    let mockConfigurator;
    let mockGit;
    let mockFs;
    let mockArchiver;
    let mockUtils;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockFs = require('fs');
        mockArchiver = require('archiver');
        mockUtils = require('../src/js/lib/utils');

        // Mock Configurator
        mockConfigurator = {
            getValue: jest.fn((key) => {
                if (key === 'targetTranslationsDir') return '/mock/target';
                return '';
            }),
            getUserPath: jest.fn((key, subdir) => `/mock/user/${subdir}`)
        };

        // Mock Git
        mockGit = {
            getHash: jest.fn().mockResolvedValue('abc123hash')
        };

        // Mock Global App
        global.App = {
            locale: {
                translate: jest.fn((key) => `translated_${key}`)
            }
        };

        // Mock FS streams
        const mockStream = { on: jest.fn(), end: jest.fn() };
        mockFs.createWriteStream.mockReturnValue(mockStream);

        const ExporterModule = require('../src/js/exporter');
        ExportManager = ExporterModule.ExportManager;
        exportManager = new ExportManager(mockConfigurator, mockGit);
    });

    describe('backupTranslation', () => {
        const meta = {
            unique_id: 'en_ulb',
            target_language: { direction: 'ltr' }
        };

        it('should backup a translation to a .tstudio file', async () => {
            const filePath = '/downloads/backup.tstudio';

            const result = await exportManager.backupTranslation(meta, filePath);

            expect(mockGit.getHash).toHaveBeenCalledWith('/mock/target/en_ulb');
            expect(mockFs.createWriteStream).toHaveBeenCalledWith(filePath);

            const archive = mockArchiver.create();
            expect(archive.directory).toHaveBeenCalledWith('/mock/target/en_ulb', 'en_ulb/');
            expect(archive.append).toHaveBeenCalledWith(
                expect.stringContaining('"generator"'),
                { name: 'manifest.json' }
            );
            expect(archive.finalize).toHaveBeenCalled();
            expect(result).toBe(filePath);
        });

        it('should append extension if missing', async () => {
            await exportManager.backupTranslation(meta, '/downloads/backup');
            expect(mockFs.createWriteStream).toHaveBeenCalledWith('/downloads/backup.tstudio');
        });

        it('should throw error on git failure', async () => {
            mockGit.getHash.mockRejectedValue('Git Error');

            await expect(exportManager.backupTranslation(meta, 'file.tstudio'))
                .rejects.toMatch(/Error creating backup: Git Error/);
        });
    });

    describe('backupAllTranslations', () => {
        it('should backup list of translations', async () => {
            const list = [
                { unique_id: 'en_ulb', target_language: { direction: 'ltr' } },
                { unique_id: 'es_ulb', target_language: { direction: 'ltr' } }
            ];

            await exportManager.backupAllTranslations(list);

            expect(mockUtils.fs.mkdirs).toHaveBeenCalledTimes(2); // AutoBackup + Backups dir
            expect(mockGit.getHash).toHaveBeenCalledTimes(2);
            // Should save to auto backup dir
            expect(mockFs.createWriteStream).toHaveBeenCalledWith(
                expect.stringContaining('/mock/user/automatic_backups/en_ulb.tstudio')
            );
        });

        it('should throw if backup location not found', async () => {
            mockUtils.fs.mkdirs.mockRejectedValue(new Error('Fail'));

            await expect(exportManager.backupAllTranslations([]))
                .rejects.toMatch(/translated_backup_location_not_found/);
        });
    });

    describe('autoBackupTranslation', () => {
        it('should auto backup specific translation', async () => {
            const meta = { unique_id: 'en_ulb', target_language: { direction: 'ltr' } };

            await exportManager.autoBackupTranslation(meta);

            expect(mockUtils.fs.mkdirs).toHaveBeenCalled();
            expect(mockFs.createWriteStream).toHaveBeenCalledWith(
                '/mock/user/automatic_backups/en_ulb.tstudio'
            );
        });
    });

    describe('exportTranslation', () => {
        const meta = {
            project_type_class: 'standard',
            format: 'markdown',
            target_language: { name: 'English', id: 'en' },
            project: { name: 'Project', id: 'proj' },
            resource: { name: 'Resource' }
        };

        const translationData = [
            // Dummy first frame (usually title)
            { chunkmeta: { chapter: 0, frame: 0 }, transcontent: 'Book Title' },
            // Chapter 1, Frame 1
            {
                chunkmeta: { chapter: 1, frame: 1, chapterid: 'c1', frameid: 'f1', title: 'Start' },
                transcontent: 'Hello World'
            }
        ];

        it('should export standard project as markdown (zip)', async () => {
            meta.format = 'markdown';
            const filePath = '/out/export.zip';
            const mediaServer = 'http://media';

            await exportManager.exportTranslation(translationData, meta, filePath, mediaServer);

            expect(mockFs.createWriteStream).toHaveBeenCalledWith(filePath);
            const archive = mockArchiver.create();
            // Should have appended content for chapter 1
            expect(archive.append).toHaveBeenCalledWith(
                expect.any(Buffer),
                { name: '1.md' }
            );
            expect(archive.finalize).toHaveBeenCalled();
        });

        it('should export standard project as USFM', async () => {
            meta.format = 'usfm';
            const filePath = '/out/export.usfm';

            // USFM Data Structure
            const usfmData = [
                { chunkmeta: {}, transcontent: 'Book Name' }, // Book Title
                { chunkmeta: { chapter: 1, frame: 0 }, transcontent: 'Chapter 1' }, // Chapter Label
                { chunkmeta: { chapter: 1, frame: 1 }, transcontent: '\\v 1 Verse Text' } // Verse
            ];

            await exportManager.exportTranslation(usfmData, meta, filePath);

            expect(mockUtils.fs.outputFile).toHaveBeenCalledWith(
                filePath,
                expect.stringContaining('\\id proj Resource')
            );
            expect(mockUtils.fs.outputFile).toHaveBeenCalledWith(
                filePath,
                expect.stringContaining('\\c 1')
            );
            expect(mockUtils.fs.outputFile).toHaveBeenCalledWith(
                filePath,
                expect.stringContaining('\\v 1 Verse Text')
            );
        });

        it('should reject unsupported formats', async () => {
            meta.format = 'xml'; // Unsupported

            await expect(exportManager.exportTranslation([], meta, 'file'))
                .rejects.toBe('translated_project_export_format_not_supported');
        });

        it('should reject unsupported project classes', async () => {
            meta.project_type_class = 'unsupported';

            await expect(exportManager.exportTranslation([], meta, 'file'))
                .rejects.toBe('translated_project_export_type_not_supported');
        });
    });
});
