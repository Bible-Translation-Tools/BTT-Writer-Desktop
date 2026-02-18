/**
 * @jest-environment node
 */

'use strict';

// 1. Setup Mocks
jest.mock('fs');
jest.mock('mkdirp');
jest.mock('sql.js'); // Uses __mocks__/sql.js.js

describe('DB Library', () => {
    let Db;
    let fs;
    let mkdirp;
    let SQL;

    const SCHEMA_PATH = '/path/to/schema.sql';
    const DB_PATH = '/path/to/database.sqlite';

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        fs = require('fs');
        mkdirp = require('mkdirp');
        SQL = require('sql.js');

        // Setup FS default behaviors
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue('SCHEMA SQL');
        fs.writeFileSync.mockImplementation(() => {});

        const DbModule = require('../../src/js/lib/db');
        Db = DbModule.Db;
    });

    describe('Initialization', () => {
        it('should create a NEW database if file does not exist', () => {
            // Setup: existsSync returns false (default)

            Db(SCHEMA_PATH, DB_PATH);

            // 1. Should read schema
            expect(fs.readFileSync).toHaveBeenCalledWith(SCHEMA_PATH);

            // 2. Should initialize new SQL.Database (no args)
            expect(SQL.Database).toHaveBeenCalledWith(); // Now this works because Database is jest.fn()

            // 3. Should execute schema
            // Access the instance created during THIS test
            const dbInstance = SQL.Database.mock.instances[0];
            expect(dbInstance.exec).toHaveBeenCalledWith('SCHEMA SQL');

            // 4. Should save (export -> write)
            expect(dbInstance.export).toHaveBeenCalled();
            expect(mkdirp.sync).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(DB_PATH, expect.any(Buffer));
        });

        it('should load an EXISTING database if file exists', () => {
            // Setup
            fs.existsSync.mockReturnValue(true);
            const mockBuffer = Buffer.from([9, 9, 9]);
            fs.readFileSync.mockReturnValue(mockBuffer);

            Db(SCHEMA_PATH, DB_PATH);

            // 1. Should read DB file, NOT schema
            expect(fs.readFileSync).toHaveBeenCalledWith(DB_PATH);
            expect(fs.readFileSync).not.toHaveBeenCalledWith(SCHEMA_PATH);

            // 2. Should initialize SQL.Database WITH buffer
            expect(SQL.Database).toHaveBeenCalledWith(mockBuffer);

            // 3. Should NOT execute schema
            const dbInstance = SQL.Database.mock.instances[0];
            // Since we cleared mocks in beforeEach, this instance is fresh
            expect(dbInstance.exec).not.toHaveBeenCalled();
        });
    });

    describe('Operations', () => {
        let db;
        let sqlInstance;

        beforeEach(() => {
            // Initialize DB
            db = Db(SCHEMA_PATH, DB_PATH);
            // Grab the mock instance created by the constructor
            sqlInstance = SQL.Database.mock.instances[0];

            // Clear the calls from the initialization phase
            // so we can assert on operation calls cleanly
            sqlInstance.exec.mockClear();
            sqlInstance.export.mockClear();
            fs.writeFileSync.mockClear();
        });

        it('should execute queries', () => {
            const sql = 'SELECT * FROM table';

            // The Db function returns { query: ..., save: ... }
            // where query is bound to sql.exec
            db.query(sql);

            expect(sqlInstance.exec).toHaveBeenCalledWith(sql);
        });

        it('should save database to disk', () => {
            db.save();

            expect(sqlInstance.export).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(DB_PATH, expect.any(Buffer));
        });
    });
});
