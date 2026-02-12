'use strict';

// Mock all dependencies
jest.mock('lodash');
jest.mock('path');
jest.mock('../src/js/lib/utils', () => ({
    fs: {
        mkdirs: jest.fn(),
        stat: jest.fn(),
        mover: jest.fn(),
        outputFile: jest.fn(),
        readFile: jest.fn(),
        readdir: jest.fn()
    },
    fileExists: jest.fn(),
    lodash: {
        map: jest.fn(),
        flatten: jest.fn()
    }
}));

// Mock trash with factory to prevent loading dependencies
jest.mock('trash', () => jest.fn());

// Mock archiver with factory to prevent loading dependencies
jest.mock('archiver', () => ({
    create: jest.fn()
}));

// Mock global App
global.App = {
    locale: {
        translate: jest.fn((key, ...args) => `${key}: ${args.join(', ')}`)
    }
};

const lodash = require('lodash');
const path = require('path');
const utils = require('../src/js/lib/utils');

const { ProjectsManager } = require('../src/js/projects');

describe('ProjectsManager', () => {
    let projectsManager;
    let mockConfigurator, mockDataManager, mockReporter, mockGit, mockMigrator;

    beforeEach(() => {
        jest.clearAllMocks(); // Now available in Jest 30

        // Setup mocks
        mockConfigurator = {
            getValue: jest.fn(),
            getUserPath: jest.fn(),
            getAppData: jest.fn(),
            unsetValue: jest.fn()
        };

        mockDataManager = {
            getProjectName: jest.fn(),
            getSourceDetails: jest.fn(),
            getAllWords: jest.fn(),
            getContainerData: jest.fn()
        };

        mockReporter = {
            logError: jest.fn()
        };

        mockGit = {
            init: jest.fn(),
            commitAll: jest.fn()
        };

        mockMigrator = {
            migrateAll: jest.fn()
        };

        // Setup default mock returns
        mockConfigurator.getValue.mockReturnValue('/default/path');
        mockConfigurator.getUserPath.mockReturnValue('/user/path');
        mockConfigurator.getAppData.mockReturnValue({ build: '1.0.0' });
        utils.fs.mkdirs.mockReturnValue(Promise.resolve());
        utils.fs.stat.mockReturnValue(Promise.resolve({ isDirectory: () => true }));
        utils.fs.mover.mockReturnValue(Promise.resolve());
        utils.fs.outputFile.mockReturnValue(Promise.resolve());
        utils.fs.readFile.mockReturnValue(Promise.resolve('file content'));
        utils.fs.readdir.mockReturnValue(Promise.resolve(['file1.txt', 'file2.txt']));
        utils.fileExists.mockReturnValue(Promise.resolve(true));
        lodash.uniq.mockImplementation((arr) => arr);
        lodash.map.mockImplementation((arr, fn) => arr.map(fn));
        lodash.flatten.mockImplementation((arr) => arr.flat());
        lodash.filter.mockImplementation((arr, fn) => arr.filter(fn));
        lodash.groupBy.mockImplementation((arr, fn) => {
            const result = {};
            arr.forEach(item => {
                const key = fn(item);
                if (!result[key]) result[key] = [];
                result[key].push(item);
            });
            return result;
        });
        lodash.partialRight.mockImplementation((fn, ...args) => (...moreArgs) => fn(...moreArgs, ...args));
        lodash.keyBy.mockImplementation((arr, key) => {
            const result = {};
            arr.forEach(item => result[item[key]] = item);
            return result;
        });
        lodash.compact.mockImplementation((arr) => arr.filter(Boolean));

        // Create ProjectsManager instance
        projectsManager = new ProjectsManager(
            mockDataManager,
            mockConfigurator,
            mockReporter,
            mockGit,
            mockMigrator
        );
    });

    describe('sortByBibleLang', () => {
        it('should sort by bible order then language', () => {
            const list = [
                { project: { name: 'Exodus' }, target_language: { name: 'French' }, resource: { id: 'ulb' } },
                { project: { name: 'Genesis' }, target_language: { name: 'English' }, resource: { id: 'ulb' } }
            ];

            const result = projectsManager.sortByBibleLang(list);

            expect(result[0].project.name).toBe('Genesis');
            expect(result[1].project.name).toBe('Exodus');
        });
    });

    describe('sortByAlphaLang', () => {
        it('should sort alphabetically by project then language', () => {
            const list = [
                { project: { name: 'Zechariah' }, target_language: { name: 'French' }, resource: { id: 'ulb' } },
                { project: { name: 'Genesis' }, target_language: { name: 'English' }, resource: { id: 'ulb' } }
            ];

            const result = projectsManager.sortByAlphaLang(list);

            expect(result[0].project.name).toBe('Genesis');
            expect(result[1].project.name).toBe('Zechariah');
        });
    });

    describe('makeUniqueId', () => {
        it('should create unique id from manifest', () => {
            const manifest = {
                target_language: { id: 'en' },
                project: { id: 'gen' },
                type: { id: 'text' },
                resource: { id: 'ulb' }
            };

            const result = projectsManager.makeUniqueId(manifest);

            expect(result).toBe('en_gen_text_ulb');
        });
    });

    describe('unsetValues', () => {
        it('should unset all project-related config values', () => {
            projectsManager.unsetValues('test-project');

            expect(mockConfigurator.unsetValue).toHaveBeenCalledWith('test-project-chapter');
            expect(mockConfigurator.unsetValue).toHaveBeenCalledWith('test-project-index');
            expect(mockConfigurator.unsetValue).toHaveBeenCalledWith('test-project-selected');
            expect(mockConfigurator.unsetValue).toHaveBeenCalledWith('test-project-source');
        });
    });

    describe('translate', () => {
        it('should call App.locale.translate', () => {
            global.App.locale.translate.mockReturnValue('translated text');

            const result = projectsManager.translate('test.key', 'arg1', 'arg2');

            expect(global.App.locale.translate).toHaveBeenCalledWith('test.key', 'arg1', 'arg2');
            expect(result).toBe('translated text');
        });
    });
});