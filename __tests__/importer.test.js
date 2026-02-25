/**
 * @jest-environment node
 */

'use strict';

// 1. Setup Global lodash for the project to find
global._ = require('lodash');

// 2. Setup Mocks
jest.mock('lodash');
jest.mock('adm-zip');
jest.mock('readline');
jest.mock('fs');
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('ImportManager', () => {
    let ImportManager;
    let importManager;

    // Dependencies
    let mockConfigurator;
    let mockMigrator;
    let mockDataManager;
    let mockUtils;
    let mockReadline;
    let mockAdmZip;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');
        mockReadline = require('readline');
        mockAdmZip = require('adm-zip');

        // Override common mock logic for Importer's specific pathing
        mockUtils.makeProjectPaths.mockImplementation((base, target) => ({
            projectDir: require('path').join(base, target)
        }));

        mockUtils.fs.stat.mockResolvedValue({ isDirectory: () => true });

        mockConfigurator = {
            getValue: jest.fn((key) => {
                if (key === 'tempDir') return '/tmp';
                if (key === 'targetTranslationsDir') return '/target';
                return null;
            })
        };

        mockMigrator = {
            listTargetTranslations: jest.fn().mockResolvedValue(['proj1']),
            migrateAll: jest.fn().mockResolvedValue([{
                paths: { projectDir: '/tmp/extract/proj1' }
            }])
        };

        mockDataManager = {
            getChunkMarkers: jest.fn().mockReturnValue([])
        };

        global.App = {
            locale: { translate: jest.fn(k => `translated_${k}`) }
        };

        const ImporterModule = require('../src/js/importer');
        ImportManager = ImporterModule.ImportManager;
        importManager = new ImportManager(mockConfigurator, mockMigrator, mockDataManager);
    });

    describe('Backup Extraction', () => {
        it('should extract .tstudio backup and return path mapping', async () => {
            const filePath = '/user/backups/my_project.tstudio';

            const results = await importManager.extractBackup(filePath);

            expect(mockMigrator.listTargetTranslations).toHaveBeenCalledWith(filePath);
            expect(mockAdmZip.mockExtractAllTo).toHaveBeenCalledWith('/tmp/my_project', true);
            expect(mockMigrator.migrateAll).toHaveBeenCalled();

            // Should return mapping for the UI to confirm overwrite
            expect(results[0]).toEqual({
                tmpPath: '/tmp/my_project/proj1',
                targetPath: '/target/proj1',
                targetExists: true
            });
        });

        it('should handle cases where the target project does not yet exist', async () => {
            // Force fs.stat to fail (simulate project doesn't exist)
            mockUtils.fs.stat.mockRejectedValue(new Error('ENOENT'));

            const results = await importManager.extractBackup('test.tstudio');
            expect(results[0].targetExists).toBe(false);
        });
    });

    describe('USFM Metadata', () => {
        it('should extract the project ID from a USFM \id marker', async () => {
            const promise = importManager.retrieveUSFMProjectID('genesis.usfm');

            // readline mock helper (emits events directly to the lineReader)
            mockReadline.__emitLine('\\id GEN Translation');
            mockReadline.__emitClose();

            const id = await promise;
            expect(id).toBe('gen');
        });

        it('should return an empty string if no ID marker is present', async () => {
            const promise = importManager.retrieveUSFMProjectID('empty.usfm');

            mockReadline.__emitLine('\\mt Title Only');
            mockReadline.__emitClose();

            const id = await promise;
            expect(id).toBe('');
        });
    });
});
