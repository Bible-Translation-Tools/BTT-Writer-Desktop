/**
 * @jest-environment node
 */

'use strict';

// 1. Setup Global lodash for the project to find
// We require it here and attach to global for any non-modular code
global._ = require('lodash');

// 2. Setup Mocks
// This will automatically use __mocks__/lodash.js
jest.mock('lodash');
jest.mock('trash');
jest.mock('archiver');
jest.mock('fs');
// Uses __mocks__/local-utils.js
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('ProjectsManager', () => {
    let ProjectsManager;
    let projectsManager;

    // Dependencies
    let mockDataManager;
    let mockConfigurator;
    let mockReporter;
    let mockGit;
    let mockMigrator;
    let mockUtils;
    let mockTrash;

    const TARGET_DIR = '/mock/target';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockUtils = require('../src/js/lib/utils');
        mockTrash = require('trash');

        mockDataManager = {
            getProjectName: jest.fn().mockReturnValue('Genesis'),
            getSourceDetails: jest.fn().mockReturnValue({ unique_id: 'src_1' }),
            getAllWords: jest.fn().mockReturnValue([{ id: 1 }, { id: 2 }]),
            getContainerData: jest.fn().mockReturnValue([{ id: 1 }])
        };

        mockConfigurator = {
            getValue: jest.fn((key) => {
                if (key === 'targetTranslationsDir') return TARGET_DIR;
                if (key === 'sort') return { order: 'project', project: 'bible' };
                return null;
            }),
            getUserPath: jest.fn((key, subdir) => `/mock/user/${subdir}`),
            unsetValue: jest.fn(),
            getAppData: jest.fn().mockReturnValue({ build: '100' })
        };

        mockReporter = { logError: jest.fn() };
        mockGit = {
            init: jest.fn().mockResolvedValue(true),
            commitAll: jest.fn().mockResolvedValue(true)
        };
        mockMigrator = { migrateAll: jest.fn().mockResolvedValue(true) };

        global.App = {
            locale: { translate: jest.fn(k => `translated_${k}`) }
        };

        const ProjectsModule = require('../src/js/projects');
        ProjectsManager = ProjectsModule.ProjectsManager;
        projectsManager = new ProjectsManager(mockDataManager, mockConfigurator, mockReporter, mockGit, mockMigrator);
    });

    describe('Manifest & Metadata Logic', () => {
        const sampleManifest = {
            project: { id: 'gen', name: '' },
            target_language: { id: 'en', name: 'English' },
            type: { id: 'text', name: '' },
            resource: { id: 'ulb' },
            source_translations: [{ language_id: 'en', resource_id: 'ulb' }]
        };

        it('should update manifest to meta with calculated fields', () => {
            const meta = projectsManager.updateManifestToMeta(sampleManifest);
            expect(meta.unique_id).toBe('en_gen_text_ulb');
            expect(meta.project.name).toBe('Genesis');
        });

        it('should calculate completion percentage', () => {
            const metaWithChunks = {
                ...sampleManifest,
                finished_chunks: ['chunk1'],
                source_translations: [{ language_id: 'en', project_id: 'gen', resource_id: 'ulb' }]
            };
            mockDataManager.getContainerData.mockReturnValue([{}, {}]);
            const meta = projectsManager.updateManifestToMeta(metaWithChunks);
            expect(meta.completion).toBe(50);
        });
    });

    describe('Sorting', () => {
        const list = [
            { project: { name: 'Exodus' }, target_language: { name: 'English' } },
            { project: { name: 'Genesis' }, target_language: { name: 'English' } }
        ];

        it('should sort by Bible order', () => {
            const sorted = projectsManager.sortByBibleLang(list);
            expect(sorted[0].project.name).toBe('Genesis');
        });
    });

    describe('Chunk & Manifest Persistence', () => {
        const meta = {
            unique_id: 'en_gen_text_ulb',
            project_type_class: 'standard',
            target_language: { id: 'en' },
            project: { id: 'gen', name: 'Genesis' },
            resource: { id: 'ulb' },
            source_translations: [],
            package_version: 1,
            format: 'usfm'
        };

        it('should save target manifest', async () => {
            await projectsManager.saveTargetManifest(meta);
            expect(mockUtils.fs.outputFile).toHaveBeenCalled();
        });

        it('should update chunk file (Standard USFM)', async () => {
            const chunk = {
                chunkmeta: { chapter: '1', chapterid: '01', frameid: '01', frame: 1 },
                transcontent: 'In the beginning',
                projectmeta: { project: { id: 'gen' } }
            };
            await projectsManager.updateChunk(meta, chunk);
            expect(mockUtils.fs.outputFile).toHaveBeenCalledWith(
                expect.stringContaining('01/01.txt'),
                expect.stringContaining('\\c 1 In the beginning')
            );
        });
    });

    describe('Project Lifecycle', () => {
        it('should delete target translation using calculated path', async () => {
            const meta = { unique_id: 'en_gen_text' };
            const expectedPath = `${TARGET_DIR}/en_gen_text`;
            await projectsManager.deleteTargetTranslation(meta);
            expect(mockTrash).toHaveBeenCalledWith([expectedPath]);
        });

        it('should move backups during path changes', async () => {
            mockUtils.fs.stat.mockResolvedValue({ isDirectory: () => true });
            await projectsManager.moveBackups('/old', '/new');
            expect(mockUtils.fs.mover).toHaveBeenCalled();
        });
    });
});
