const fs = jest.createMockFromModule('fs');

let mockFiles = {};
let mockStats = {};

function __setMockFiles(newMockFiles) {
    mockFiles = Object.create(null);
    for (const path in newMockFiles) {
        mockFiles[path] = newMockFiles[path];
    }
}

function __setMockStats(path, statObj) {
    mockStats[path] = statObj;
}

function __reset() {
    mockFiles = {};
    mockStats = {};
}

// Mock implementations
fs.statSync = jest.fn((path) => {
    if (mockStats[path]) return mockStats[path];
    throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
});

fs.readFileSync = jest.fn((path) => {
    return mockFiles[path] || '';
});

fs.writeFileSync = jest.fn((path, content) => {
    mockFiles[path] = content;
});

fs.existsSync = jest.fn((path) => {
    return !!mockFiles[path] || !!mockStats[path];
});

fs.__setMockFiles = __setMockFiles;
fs.__setMockStats = __setMockStats;
fs.__reset = __reset;

module.exports = fs;
