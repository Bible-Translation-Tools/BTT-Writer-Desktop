const lodash = require('lodash');

module.exports = {
    fs: {
        stat: jest.fn(),
        copy: jest.fn(),
        remove: jest.fn(),
        readdir: jest.fn().mockResolvedValue([]),
        readFile: jest.fn(),
        mkdirs: jest.fn().mockResolvedValue(true),
        outputFile: jest.fn().mockResolvedValue(true),
        mover: jest.fn().mockResolvedValue(true),
        chmod: jest.fn().mockResolvedValue(true),
        appendFile: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn().mockResolvedValue(true),
    },
    // Returns a function that returns the value (matches source usage)
    ret: (val) => () => val,

    // Mocking the chain function used in getSourcesByProject
    // Source: utils.chain(this.validateExistence.bind(this))(mapped);
    chain: (fn) => (array) => {
        // Simple Promise.all implementation to simulate sequential/parallel processing
        return Promise.all(array.map(fn));
    },
    makeProjectPaths: jest.fn((dir, meta) => ({
        projectDir: `${dir}/${meta.unique_id}`,
        manifestPath: `${dir}/${meta.unique_id}/manifest.json`,
        manifest: `${dir}/${meta.unique_id}/manifest.json`,
        license: `${dir}/${meta.unique_id}/LICENSE.md`
    })),
    padZero: jest.fn(n => (n < 10 ? '0' + n : n)),
    logr: jest.fn(msg => () => msg), // Returns a function that returns the message,
    getDateAndTime: jest.fn(() => '2026-02-18_16-00-00'),
    fileExists: jest.fn().mockResolvedValue(true),
    lodash: {
        map: lodash.map,
        flatten: lodash.flatten,
        compact: () => lodash.compact,
        keyBy: (key) => (data) => lodash.keyBy(data, key)
    },
    download: jest.fn()
};
