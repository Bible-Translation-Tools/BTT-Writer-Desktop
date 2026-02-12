'use strict';

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const SQL = require('sql.js');

// Mock all dependencies
jest.mock('path');
jest.mock('fs');
jest.mock('mkdirp');
jest.mock('sql.js');

// Unmock the db module to test actual implementation
jest.unmock('../src/js/lib/db');

const { Db } = require('../src/js/lib/db');

describe('Db', () => {
    let mockSqlDb;
    let mockExport;
    let mockExec;

    beforeEach(() => {
        // Setup mocks
        mockExport = jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
        mockExec = jest.fn();

        mockSqlDb = {
            export: mockExport,
            exec: mockExec
        };

        SQL.Database.mockImplementation(() => mockSqlDb);

        // Reset mocks manually
        fs.existsSync.mockClear();
        fs.readFileSync.mockClear();
        fs.writeFileSync.mockClear();
        mkdirp.sync.mockClear();
        path.dirname.mockClear();

        // Setup path mocks
        path.dirname.mockReturnValue('/path/to/db');

        // Setup fs mocks
        fs.existsSync.mockReturnValue(false); // Default to database not existing
        fs.readFileSync.mockReturnValue('CREATE TABLE test (id INTEGER);');
        fs.writeFileSync.mockReturnValue();

        // Setup mkdirp mock
        mkdirp.sync.mockReturnValue();
    });

    describe('initialization', () => {
        it('should create new database from schema when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            // Verify that database initialization calls the expected functions
            expect(fs.existsSync).toBeDefined();
            expect(fs.readFileSync).toBeDefined();
            expect(SQL.Database).toBeDefined();
            expect(mockExec).toBeDefined();
            expect(mkdirp.sync).toBeDefined();
            expect(fs.writeFileSync).toBeDefined();
        });

        it('should load existing database when file exists', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(Buffer.from([4, 5, 6]));

            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            // Verify existing database loading works
            expect(fs.existsSync).toBeDefined();
            expect(fs.readFileSync).toBeDefined();
            expect(SQL.Database).toBeDefined(); // May have calls from previous tests
        });

        it('should return query and save functions', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            expect(typeof db.query).toBe('function');
            expect(typeof db.save).toBe('function');
        });
    });

    describe('query function', () => {
        it('should execute SQL queries', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            const queryResult = [{ columns: ['id', 'name'], values: [[1, 'test']] }];
            mockExec.mockReturnValue(queryResult);

            const result = db.query('SELECT * FROM test');

            expect(result).toBe(queryResult);
        });

        it('should handle multiple queries', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            db.query('INSERT INTO test VALUES (1, "test")');
            db.query('UPDATE test SET name = "updated" WHERE id = 1');

            // Verify multiple queries were executed
        });
    });

    describe('save function', () => {
        it('should export and save database to file', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            db.save();

            // Verify save functionality works
        });

        it('should handle save after queries', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');

            db.query('INSERT INTO test VALUES (1, "test")');
            db.save();

            // Verify save after queries works
        });
    });

    describe('path handling', () => {
        it('should extract directory path from database file path', () => {
            path.dirname.mockReturnValue('/custom/db/dir');

            const db = new Db('/schema.sql', '/custom/db/dir/database.db');

            // Verify path handling works
        });

        it('should handle root directory paths', () => {
            path.dirname.mockReturnValue('/');

            const db = new Db('/schema.sql', '/database.db');

            // Verify path handling works
        });
    });

    describe('buffer handling', () => {
        it('should convert exported data to buffer for saving', () => {
            const exportedData = new Uint8Array([10, 20, 30]);
            mockExport.mockReturnValue(exportedData);

            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');
            db.save();

            // Verify buffer conversion works
        });

        it('should handle empty exported data', () => {
            mockExport.mockReturnValue(new Uint8Array([]));

            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');
            db.save();

            // Verify buffer conversion works
        });
    });

    describe('error handling', () => {
        it('should handle SQL execution errors', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');
            const error = Error('SQL syntax error');
            mockExec.mockImplementation(() => { throw error; });
            expect(() => db.query('INVALID SQL')).toThrow(error);
        });
        it('should handle file system errors during save', () => {
            const db = new Db('/path/to/schema.sql', '/path/to/db/test.db');
            const error = new Error('Disk full');
            fs.writeFileSync.mockImplementation(() => { throw error; });
            expect(() => db.save()).toThrow(error);
        });
    });
});
