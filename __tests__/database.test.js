/**
 * @jest-environment node
 */
'use strict';

// 1. Setup Mocks
jest.mock('fs-extra');
jest.mock('lodash');

// Mock the local utils library using our helper file
jest.mock('../src/js/lib/utils', () => require('../__mocks__/local-utils'));

describe('DataManager', () => {
    let DataManager;
    let dataManager;

    // Dependencies
    let mockDb;
    let mockConfigurator;
    let mockUtils;
    let mockFs;
    let mockYaml;

    const RESOURCE_DIR = '/mock/resources';
    const SOURCE_DIR = '/mock/sources';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Load Mocks
        mockUtils = require('../src/js/lib/utils');
        mockFs = require('fs-extra');
        mockYaml = require('js-yaml');
        mockFs.__reset();

        // Mock DB Adapter
        mockDb = {
            updateCatalogs: jest.fn(),
            setLanguageUrl: jest.fn(),
            updateSources: jest.fn(),
            updateChunks: jest.fn(),
            importResourceContainer: jest.fn(),
            loadResourceContainer: jest.fn(),
            downloadResourceContainer: jest.fn(),
            openResourceContainer: jest.fn(),
            indexSync: {
                getMetrics: jest.fn(),
                getSourceLanguages: jest.fn(),
                findTranslations: jest.fn(),
                getTargetLanguages: jest.fn(),
                getProjects: jest.fn(),
                getResources: jest.fn(),
                getProject: jest.fn(),
                getChunkMarkers: jest.fn(),
                getResource: jest.fn(),
                getSourceLanguage: jest.fn()
            }
        };

        // Mock Configurator
        mockConfigurator = {
            getUserSetting: jest.fn((key) => {
                if (key === 'mediaserver') return 'http://api.door43.org';
                if (key === 'indexsqliteurl') return 'http://test.url/index.sqlite';
                return '';
            }),
            getValue: jest.fn((key) => {
                if (key === 'libraryDir') return '/mock/library';
                return '';
            })
        };

        // Mock Global App (for translation)
        global.App = {
            locale: {
                translate: jest.fn((key) => `translated_${key}`)
            }
        };

        // Mock Global Fetch
        global.fetch = jest.fn();

        // Instantiate
        const DatabaseModule = require('../src/js/database');
        DataManager = DatabaseModule.DataManager;
        dataManager = new DataManager(mockDb, RESOURCE_DIR, SOURCE_DIR, mockConfigurator);
    });

    describe('Basic Operations', () => {
        it('should return resource directory', () => {
            expect(dataManager.getResourceDir()).toBe(RESOURCE_DIR);
        });

        it('should delegate simple updates to db', () => {
            dataManager.updateLanguages();
            expect(mockDb.updateCatalogs).toHaveBeenCalled();

            dataManager.updateLanguageUrl('http://test');
            expect(mockDb.setLanguageUrl).toHaveBeenCalledWith('http://test');

            dataManager.updateChunks();
            expect(mockDb.updateChunks).toHaveBeenCalled();

            dataManager.importContainer('/path/to/file');
            expect(mockDb.importResourceContainer).toHaveBeenCalledWith('/path/to/file');
        });

        it('should update sources with config url', () => {
            dataManager.updateSources();
            expect(mockDb.updateSources).toHaveBeenCalledWith(
                'http://api.door43.org/v2/ts/catalog.json',
                undefined
            );
        });
    });

    describe('updateIndex (Streaming)', () => {
        it('should download and write index file', async () => {
            const mockReader = {
                read: jest.fn()
                    .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
                    .mockResolvedValueOnce({ done: true })
            };

            global.fetch.mockResolvedValue({
                headers: { get: () => '3' },
                body: { getReader: () => mockReader }
            });

            const progressCb = jest.fn();
            await dataManager.updateIndex(progressCb);

            const writeStream = mockFs.createWriteStream();
            expect(mockFs.createWriteStream).toHaveBeenCalledWith('/mock/library/index.sqlite');
            expect(writeStream.write).toHaveBeenCalled();
            expect(writeStream.end).toHaveBeenCalled();
            expect(progressCb).toHaveBeenCalledWith(100);
        });
    });

    describe('Container Existence & Activation', () => {
        it('should check if container exists (Resource Dir)', async () => {
            const container = 'en_ulb_jud';
            // Mock utils.fs.stat success for resource path
            mockUtils.fs.stat.mockImplementation((p) => {
                return p.includes(RESOURCE_DIR) ? Promise.resolve() : Promise.reject();
            });

            const exists = await dataManager.containerExists(container);
            expect(exists).toBe(true);
        });

        it('should check if container exists (Source Dir)', async () => {
            const container = 'en_ulb_jud';
            // Fail resource, succeed source
            mockUtils.fs.stat.mockImplementation((p) => {
                return p.includes(SOURCE_DIR) ? Promise.resolve() : Promise.reject();
            });

            const exists = await dataManager.containerExists(container);
            expect(exists).toBe(true);
        });

        it('should activate container (Copy Source -> Resource)', async () => {
            const [lang, proj, res] = ['en', 'ulb', 'jud'];
            const container = `${lang}_${proj}_${res}`;

            // 1. Resource does NOT exist
            // 2. Source DOES exist
            mockUtils.fs.stat.mockImplementation((p) => {
                return p.includes(SOURCE_DIR) ? Promise.resolve() : Promise.reject();
            });
            mockUtils.fs.copy.mockResolvedValue();
            mockUtils.fs.remove.mockResolvedValue();
            mockDb.openResourceContainer.mockResolvedValue();

            await dataManager.activateContainer(lang, proj, res);

            expect(mockUtils.fs.copy).toHaveBeenCalled();
            expect(mockDb.openResourceContainer).toHaveBeenCalledWith(lang, proj, res);
            expect(mockUtils.fs.remove).toHaveBeenCalled();
        });
    });

    describe('Project & Resource Retrieval', () => {
        it('should get target languages', () => {
            mockDb.indexSync.getTargetLanguages.mockReturnValue([
                { slug: 'en', name: 'English', direction: 'ltr' }
            ]);
            const langs = dataManager.getTargetLanguages();
            expect(langs[0].id).toBe('en');
        });

        it('should get sources by project and validate existence', async () => {
            const project = 'gen';
            // Mock db resources
            mockDb.indexSync.getResources.mockReturnValue([
                {
                    type: 'book',
                    status: { checking_level: "3" },
                    project_slug: 'gen',
                    source_language_slug: 'en',
                    slug: 'ulb',
                    imported: true
                }
            ]);

            // Mock getResource for details
            mockDb.indexSync.getResource.mockReturnValue({
                status: { checking_level: "3", pub_date: '2022', version: '1' },
                name: 'ULB'
            });
            mockDb.indexSync.getSourceLanguage.mockReturnValue({ name: 'English', direction: 'ltr' });

            // Mock container exists
            mockUtils.fs.stat.mockResolvedValue(); // validation returns true

            const sources = await dataManager.getSourcesByProject(project);

            expect(sources).toHaveLength(1);
            expect(sources[0].resource_name).toBe('ULB');
            expect(sources[0].exists).toBe(true);
        });
    });

    describe('File System Data Extraction', () => {
        const CONTAINER = 'en_gen_ulb';
        const CONTENT_PATH = `${RESOURCE_DIR}/${CONTAINER}/content`;

        it('should extract container content', () => {
            // Setup FS structure
            mockFs.__setMockDirs({
                [CONTENT_PATH]: true,
                [`${CONTENT_PATH}/01`]: true
            });
            mockFs.__setMockFiles({
                [`${CONTENT_PATH}/01/01.md`]: 'In the beginning'
            });

            // Mock readdirSync
            mockFs.readdirSync.mockImplementation((p) => {
                if (p === CONTENT_PATH) return ['01'];
                if (p === `${CONTENT_PATH}/01`) return ['01.md'];
                return [];
            });

            const data = dataManager.extractContainer(CONTAINER);

            expect(data).toHaveLength(1);
            expect(data[0]).toEqual({
                chapter: '01',
                chunk: '01',
                content: 'In the beginning'
            });
        });

        it('should get container data with TOC sorting', () => {
            // 1. Mock content extraction (via extractContainer logic inside)
            // We need to setup FS mocks again as above
            mockFs.__setMockDirs({
                [CONTENT_PATH]: true,
                [`${CONTENT_PATH}/01`]: true,
                [`${CONTENT_PATH}/02`]: true
            });
            mockFs.__setMockFiles({
                [`${CONTENT_PATH}/01/01.md`]: 'Chap 1',
                [`${CONTENT_PATH}/02/01.md`]: 'Chap 2',
                // Mock TOC yaml
                [`${CONTENT_PATH}/toc.yml`]: JSON.stringify([
                    { chapter: '02', chunks: ['01'] }, // Chap 2 first
                    { chapter: '01', chunks: ['01'] }
                ])
            });

            mockFs.readdirSync.mockImplementation((p) => {
                if (p === CONTENT_PATH) return ['01', '02'];
                if (p === `${CONTENT_PATH}/01`) return ['01.md'];
                if (p === `${CONTENT_PATH}/02`) return ['01.md'];
                return [];
            });

            const data = dataManager.getContainerData(CONTAINER);

            // TOC puts 02 before 01
            expect(data).toHaveLength(2);
            expect(data[0].chapter).toBe('02');
            expect(data[1].chapter).toBe('01');
        });
    });

    describe('Download Operations', () => {
        it('should download project containers (main + helpers)', async () => {
            mockDb.downloadResourceContainer.mockResolvedValue(true);

            const item = { language: { slug: 'en' }, project: { slug: 'gen' }, resource: { slug: 'ulb' } };

            await dataManager.downloadProjectContainers(item);

            // Should download main resource
            expect(mockDb.downloadResourceContainer).toHaveBeenCalledWith('en', 'gen', 'ulb');
            // Should download helpers
            expect(mockDb.downloadResourceContainer).toHaveBeenCalledWith('en', 'gen', 'tn');
            expect(mockDb.downloadResourceContainer).toHaveBeenCalledWith('en', 'gen', 'tq');
            expect(mockDb.downloadResourceContainer).toHaveBeenCalledWith('en', 'bible', 'tw'); // Global dict

            expect(item.success).toBe(true);
        });

        it('should handle download failure', async () => {
            const error = new Error('Net error');
            error.syscall = 'getaddrinfo';
            mockDb.downloadResourceContainer.mockRejectedValue(error);

            const item = { language: { slug: 'en' }, project: { slug: 'gen' }, resource: { slug: 'ulb' } };

            await dataManager.downloadProjectContainers(item);

            expect(item.failure).toBe(true);
            expect(global.App.locale.translate).toHaveBeenCalledWith('connection_error');
        });
    });

    describe('Helps & Words', () => {
        it('should parse helps (TN/TQ)', () => {
            const container = 'en_gen_tn';
            const CONTENT_PATH = `${RESOURCE_DIR}/${container}/content`;

            // Setup FS for extractContainer
            mockFs.__setMockDirs({
                [CONTENT_PATH]: true,
                [`${CONTENT_PATH}/01`]: true
            });
            // Content with # Title \n\n Body
            mockFs.__setMockFiles({
                [`${CONTENT_PATH}/01/01.md`]: '# Note Title\n\nNote Body'
            });

            mockFs.readdirSync.mockImplementation((p) => {
                if (p.endsWith('content')) return ['01'];
                if (p.endsWith('01')) return ['01.md'];
                return [];
            });

            const notes = dataManager.getSourceNotes({ language_id: 'en', project_id: 'gen' });

            expect(notes).toHaveLength(1);
            expect(notes[0].content[0]).toEqual({
                title: ' Note Title',
                body: 'Note Body'
            });
        });

        it('should get related words via yaml config', () => {
            const container = 'en_bible_tw';
            const pathConfig = `${RESOURCE_DIR}/${container}/content/config.yml`;
            const pathWord = `${RESOURCE_DIR}/${container}/content/grace/01.md`;

            // Mock config
            const config = { "god": { "see_also": ["grace"] } };

            mockFs.__setMockFiles({
                [pathConfig]: JSON.stringify(config), // Using JSON mock for yaml
                [pathWord]: '# Grace\n\nDefinition'
            });

            const words = dataManager.getRelatedWords({ language_id: 'en', resource_id: 'ulb' }, 'god');

            expect(words).toHaveLength(1);
            expect(words[0].title).toBe(' Grace');
            expect(words[0].slug).toBe('grace');
        });
    });
});
