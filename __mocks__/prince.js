'use strict';

const mockExecute = jest.fn().mockResolvedValue(true);
const mockInstance = {
    binary: jest.fn().mockReturnThis(),
    prefix: jest.fn().mockReturnThis(),
    inputs: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    execute: mockExecute
};

const Prince = jest.fn(() => mockInstance);
Prince.mockExecute = mockExecute;

module.exports = Prince;
