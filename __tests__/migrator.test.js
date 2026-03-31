/**
 * @jest-environment node
 */

'use strict';

const path = require('path');

// 1. Setup Global lodash
// We define it as a mock factory so that every call to 'lodash' (internal or external)
// gets a version of the library that has the .unique alias.
jest.mock('lodash', () => {
    const actualLodash = jest.requireActual('lodash');
    // Polyfill the alias your source code expects
    actualLodash.unique = actualLodash.uniq;
    return actualLodash;
});

// Setup global reference for the tests
global._ = require('lodash');

// 2. Other Mocks
jest.mock('adm-zip');
jest.mock('fs');
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('MigrateManager', () => {
    let MigrateManager;
    let migrator;

    // Dependencies
    let mockConfigurator;
    let mockGit;
    let mockReporter;
    let mockDataManager;
    let mockUtils;
    let mockAdmZip;

    const MOCK_PATHS = {
        manifest: '/projects/gen/manifest.json',
        projectDir: '/projects/gen',
        parentDir: '/projects'
    };

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');
        mockAdmZip = require('adm-zip');

        // Functional mock for utils.chain used in migrateAll
        mockUtils.chain = (fn, errHandler) => (list) => {
            return Promise.all(list.map(item => fn(item).catch(err => errHandler(err, item))));
        };

        mockConfigurator = {
            getValue: jest.fn(key => {
                if (key === 'userdata') return { name: 'testuser' };
                return null;
            }),
            getUserPath: jest.fn(() => '/backups'),
            getAppData: jest.fn(() => ({ build: '100' })),
            setValue: jest.fn(),
            unsetValue: jest.fn()
        };

        mockGit = { commitAll: jest.fn().mockResolvedValue(true) };
        mockReporter = { logWarning: jest.fn(), logNotice: jest.fn() };
        mockDataManager = {
            getResourceDir: jest.fn(() => '/resources'),
            activateContainer: jest.fn().mockResolvedValue(true)
        };

        const translate = jest.fn(k => k);

        const MigratorModule = require('../src/js/migrator');
        MigrateManager = MigratorModule.MigrateManager;
        migrator = new MigrateManager(mockConfigurator, mockGit, mockReporter, mockDataManager, translate);
    });

    describe('Migration Pipeline', () => {
        it('should successfully migrate a V2 project to V7', async () => {
            const v2Manifest = {
                package_version: 2,
                slug: 'gen',
                target_language: { slug: 'en' },
                frames: { '01-01': true },
                chapters: { '01': { finished_title: true } },
                generator: { name: 'old' },
                translators: ['Alice', 'Bob']
            };

            mockUtils.fs.readFile.mockResolvedValue(JSON.stringify(v2Manifest));
            mockUtils.fs.outputFile.mockResolvedValue(true);
            mockUtils.fs.stat.mockRejectedValue(new Error('no title file'));
            mockUtils.fs.mover.mockResolvedValue(true);
            mockUtils.fs.readdir.mockResolvedValue([]);

            const result = await migrator.migrate(MOCK_PATHS);

            expect(result.manifest.package_version).toBe(8);
            expect(result.manifest.project.id).toBe('gen');
            expect(result.manifest.target_language.id).toBe('en');
        });
    });

    describe('Zip Archive Parsing', () => {
        it('should extract paths from a tStudio zip manifest', async () => {
            const zipManifest = {
                package_version: 2,
                target_translations: [ { path: 'en_gen_text_ulb' } ]
            };

            mockAdmZip.mockReadAsText.mockReturnValue(JSON.stringify(zipManifest));

            const paths = await migrator.listTargetTranslations('/backup.tstudio');
            expect(paths).toEqual(['en_gen_text_ulb']);
        });

        it('should fail on unsupported package versions', async () => {
            mockAdmZip.mockReadAsText.mockReturnValue(JSON.stringify({ package_version: 99 }));

            await expect(migrator.listTargetTranslations('file.zip'))
                .rejects.toBe('unsupported_package_version');
        });
    });
});
