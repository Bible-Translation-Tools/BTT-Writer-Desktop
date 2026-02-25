const fs = jest.createMockFromModule('fs-extra');

// In-memory file system for sync operations
let mockFiles = {};
let mockDirs = {};

fs.__setMockFiles = (files) => { mockFiles = files; };
fs.__setMockDirs = (dirs) => { mockDirs = dirs; };
fs.__reset = () => { mockFiles = {}; mockDirs = {}; };

fs.readFileSync = jest.fn((path) => {
    if (mockFiles[path]) return mockFiles[path];
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
});

fs.readdirSync = jest.fn((path) => {
    if (mockDirs[path]) return mockDirs[path];
    return [];
});

fs.statSync = jest.fn((path) => {
    return {
        isDirectory: () => !!mockDirs[path],
        isFile: () => !!mockFiles[path]
    };
});

// Stream Mock for updateIndex
const mockWriteStream = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
};
fs.createWriteStream = jest.fn(() => mockWriteStream);

module.exports = fs;
