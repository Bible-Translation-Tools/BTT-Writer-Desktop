/**
 * Mock for the cmdr library
 */
'use strict';

const mockRunner = jest.fn();

// Create the builder object
const mockBuilder = {};

// Helper to make methods chainable (return the builder itself)
const chain = () => jest.fn().mockReturnValue(mockBuilder);

mockBuilder.cd = chain();
mockBuilder.set = chain();
mockBuilder.do = chain();
mockBuilder.run = mockRunner;
mockBuilder.toString = jest.fn(() => 'mock command string');

// 'and' is a getter that returns the builder for chaining
Object.defineProperty(mockBuilder, 'and', {
    get: () => mockBuilder,
    configurable: true
});

// The module exports a factory: cmdr(paths) -> returns cmd function
const cmdrMock = jest.fn(() => {
    // The cmd function: cmd(str) -> returns builder object
    return jest.fn(() => mockBuilder);
});

// Attach the runner to the export so tests can control it
cmdrMock.mockRunner = mockRunner;

module.exports = cmdrMock;
