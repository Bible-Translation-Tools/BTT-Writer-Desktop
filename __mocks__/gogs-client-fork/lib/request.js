'use strict';

module.exports = jest.fn(() => jest.fn().mockResolvedValue({ status: 204 }));
