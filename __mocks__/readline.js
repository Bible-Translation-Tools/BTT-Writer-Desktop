'use strict';

const EventEmitter = require('events');

const mockLineReader = new EventEmitter();
mockLineReader.close = jest.fn();

const readline = {
    createInterface: jest.fn(() => mockLineReader),
    // Helper for tests to trigger lines
    __emitLine: (line) => mockLineReader.emit('line', line),
    __emitClose: () => mockLineReader.emit('close')
};

module.exports = readline;
