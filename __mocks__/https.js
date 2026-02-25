'use strict';

const https = jest.createMockFromModule('https');

let mockResponse = {
    statusCode: 201,
    setEncoding: jest.fn(),
    on: jest.fn(function(event, cb) {
        if (event === 'data') cb('{"id": 123}');
        if (event === 'end') cb();
        return this;
    })
};

const request = jest.fn((options, callback) => {
    if (callback) callback(mockResponse);
    return {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn()
    };
});

https.request = request;
https.__setResponse = (res) => { mockResponse = { ...mockResponse, ...res }; };

module.exports = https;
