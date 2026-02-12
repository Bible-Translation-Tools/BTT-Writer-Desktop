'use strict';

// Mock dependencies
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/'))
}));

jest.mock('archiver', () => ({
    create: jest.fn(() => ({
        pipe: jest.fn(),
        directory: jest.fn(),
        append: jest.fn(),
        finalize: jest.fn().mockResolvedValue()
    }))
}));

jest.mock('fs', () => ({
    createWriteStream: jest.fn(() => ({
        pipe: jest.fn()
    }))
}));

jest.mock('lodash', () => ({
    map: jest.fn((arr, fn) => arr.map(fn))
}));

jest.mock('../src/js/lib/utils', () => ({
    fs: {
        mkdirs: jest.fn().mockResolvedValue(),
        outputFile: jest.fn().mockResolvedValue()
    },
    makeProjectPaths: jest.fn((targetDir, meta) => ({
        projectDir: `/projects/${meta.unique_id}`,
        targetDir: targetDir
    }))
}));

// Mock configurator
const mockConfigurator = {
    getValue: jest.fn((key) => {
        if (key === 'targetTranslationsDir') return '/target/translations';
        return null;
    }),
    getUserPath: jest.fn((type, path) => {
        if (type === 'datalocation') return `/users/${path}`;
        return null;
    })
};

// Mock git
const mockGit = {
    getHash: jest.fn().mockResolvedValue('abc123')
};

// Import after mocking
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');
const lodash = require('lodash');
const utils = require('../src/js/lib/utils');
const { ExportManager } = require('../src/js/exporter');

// Mock global App
global.App = {
    locale: {
        translate: jest.fn((key, ...args) => `${key}: ${args.join(', ')}`)
    }
};

describe('ExportManager', () => {
    let exportManager;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset path.join mock
        path.join.mockImplementation((...args) => args.join('/'));

        exportManager = new ExportManager(mockConfigurator, mockGit);
    });

    describe('backupTranslation', () => {
        it('should add .tstudio extension if not present', async () => {
            const meta = {
                unique_id: 'project123',
                target_language: { direction: 'ltr' }
            };
            const filePath = '/backup/file';

            const result = await exportManager.backupTranslation(meta, filePath);

            expect(result).toBe('/backup/file.tstudio');
        });

        it('should not add extension if .tstudio already present', async () => {
            const meta = {
                unique_id: 'project123',
                target_language: { direction: 'ltr' }
            };
            const filePath = '/backup/file.tstudio';

            const result = await exportManager.backupTranslation(meta, filePath);

            expect(result).toBe('/backup/file.tstudio');
        });

        it('should create backup with manifest', async () => {
            const meta = {
                unique_id: 'project123',
                target_language: { direction: 'ltr' }
            };
            const filePath = '/backup/file.tstudio';

            const result = await exportManager.backupTranslation(meta, filePath);

            expect(mockGit.getHash).toHaveBeenCalled();
            expect(fs.createWriteStream).toHaveBeenCalledWith(filePath);
            expect(archiver.create).toHaveBeenCalledWith('zip');
            expect(result).toBe(filePath);
        });
    });

    describe('backupAllTranslations', () => {
        it('should backup multiple translations', async () => {
            const list = [
                { unique_id: 'project1', target_language: { direction: 'ltr' } },
                { unique_id: 'project2', target_language: { direction: 'ltr' } },
                { unique_id: 'project3', target_language: { direction: 'ltr' } }
            ];

            await exportManager.backupAllTranslations(list);

            expect(utils.fs.mkdirs).toHaveBeenCalledTimes(2);
            expect(lodash.map).toHaveBeenCalledWith(list, expect.any(Function));
        });

        it('should create backup directory paths', async () => {
            const list = [{ unique_id: 'project1', target_language: { direction: 'ltr' } }];

            await exportManager.backupAllTranslations(list);

            expect(mockConfigurator.getUserPath).toHaveBeenCalledWith('datalocation', 'automatic_backups');
            expect(mockConfigurator.getUserPath).toHaveBeenCalledWith('datalocation', 'backups');
        });
    });

    describe('autoBackupTranslation', () => {
        it('should create automatic backup', async () => {
            const meta = {
                unique_id: 'project123',
                target_language: { direction: 'ltr' }
            };

            await exportManager.autoBackupTranslation(meta);

            expect(utils.fs.mkdirs).toHaveBeenCalled();
        });

        it('should use correct backup path', async () => {
            const meta = { unique_id: 'project123', target_language: { direction: 'ltr' } };

            await exportManager.autoBackupTranslation(meta);

            expect(path.join).toHaveBeenCalled();
        });
    });

    describe('exportTranslation', () => {
        it('should reject unsupported project type', async () => {
            const translation = [];
            const meta = { project_type_class: 'unsupported' };
            const filePath = '/export/file';

            await expect(exportManager.exportTranslation(translation, meta, filePath))
                .rejects.toMatch('project_export_type_not_supported');
        });

        it('should reject unsupported format', async () => {
            const translation = [];
            const meta = { 
                project_type_class: 'standard',
                format: 'unsupported'
            };
            const filePath = '/export/file';

            await expect(exportManager.exportTranslation(translation, meta, filePath))
                .rejects.toMatch('project_export_format_not_supported');
        });

        it('should export markdown format', async () => {
            const translation = [
                {
                    chunkmeta: {
                        chapter: 1,
                        chapterid: '01',
                        frameid: '01',
                        title: 'Chapter 1'
                    },
                    transcontent: 'Translation content'
                }
            ];
            const meta = {
                project_type_class: 'standard',
                format: 'markdown',
                project: { id: 'gen', name: 'Genesis' },
                target_language: { id: 'en', name: 'English' }
            };
            const filePath = '/export/file';

            const result = await exportManager.exportTranslation(translation, meta, filePath);

            expect(result).toBe(true);
            expect(archiver.create).toHaveBeenCalledWith('zip');
        });

        it('should add .zip extension for markdown format', async () => {
            const translation = [];
            const meta = {
                project_type_class: 'standard',
                format: 'markdown',
                project: { id: 'gen', name: 'Genesis' },
                target_language: { id: 'en', name: 'English' }
            };
            const filePath = '/export/file';

            await exportManager.exportTranslation(translation, meta, filePath);

            // Should create a zip file
            expect(archiver.create).toHaveBeenCalledWith('zip');
        });

        it('should export usfm format', async () => {
            const translation = [
                {
                    chunkmeta: {
                        chapter: 1,
                        chapterid: '01',
                        frameid: '01'
                    },
                    transcontent: 'Book title'
                },
                {
                    chunkmeta: {
                        chapter: 1,
                        chapterid: '01',
                        frameid: '02'
                    },
                    transcontent: 'Genesis content'
                }
            ];
            const meta = {
                project_type_class: 'standard',
                format: 'usfm',
                project: { id: 'GEN', name: 'Genesis' },
                resource: { name: 'Translation' }
            };
            const filePath = '/export/file';

            const result = await exportManager.exportTranslation(translation, meta, filePath);

            expect(result).toBe(true);
            expect(utils.fs.outputFile).toHaveBeenCalled();
        });

        it('should add .usfm extension for usfm format', async () => {
            const translation = [
                {
                    chunkmeta: {
                        chapter: 1,
                        chapterid: '01',
                        frameid: '01'
                    },
                    transcontent: 'Genesis'
                },
                {
                    chunkmeta: {
                        chapter: 1,
                        chapterid: '01',
                        frameid: '02'
                    },
                    transcontent: 'In the beginning'
                }
            ];
            const meta = {
                project_type_class: 'standard',
                format: 'usfm',
                project: { id: 'GEN', name: 'Genesis' },
                resource: { name: 'Resource' }
            };
            const filePath = '/export/file';

            await exportManager.exportTranslation(translation, meta, filePath);

            expect(utils.fs.outputFile).toHaveBeenCalled();
        });
    });

    describe('translate', () => {
        it('should translate using App.locale', () => {
            const result = exportManager.translate('test_key', 'arg1', 'arg2');

            expect(App.locale.translate).toHaveBeenCalledWith('test_key', 'arg1', 'arg2');
            expect(result).toBe('test_key: arg1, arg2');
        });
    });
});
