'use strict';

/**
 * HTTPS Mock Module for Jest Testing
 * Provides a mock implementation of the Node.js https module
 * for testing HTTP request functionality
 */

// Module-level state for tracking mock calls
let mockState = {
    responseMessage: 'success',
    statusCode: 200,
    lastWritten: '',
    lastOptions: {},
    requestCount: 0
};

/**
 * Create a mock HTTPS request response object
 * @param {string} message - The response body
 * @param {number} status - The HTTP status code
 * @returns {object} Mock response object
 */
function createMockResponse(message, status) {
    const callbacks = {};
    
    return {
        statusCode: status,
        
        setEncoding: function(encoding) {
            // No-op for mock
        },
        
        on: function(event, callback) {
            callbacks[event] = callback;
            
            // Automatically trigger 'data' and 'end' events
            if (event === 'end') {
                if (callbacks['data']) {
                    callbacks['data'](message);
                }
                callbacks['end']();
            }
            
            return this; // Enable chaining
        }
    };
}

/**
 * Create a mock HTTPS request object
 * @param {object} options - HTTP request options
 * @param {function} callback - Response callback
 * @returns {object} Mock request object
 */
function createMockRequest(options, callback) {
    const requestCallbacks = {};
    mockState.lastOptions = options;
    mockState.requestCount++;
    
    return {
        on: function(event, cb) {
            requestCallbacks[event] = cb;
            return this; // Enable chaining
        },
        
        write: function(data) {
            mockState.lastWritten = data;
        },
        
        end: function() {
            // Simulate async response
            const response = createMockResponse(
                mockState.responseMessage,
                mockState.statusCode
            );
            callback(response);
        }
    };
}

// Create the main https mock object
const https = {
    /**
     * Get the last options passed to request()
     * @returns {object} Last request options
     */
    get __lastOptions() {
        return mockState.lastOptions;
    },
    
    /**
     * Get the last data written to the request
     * @returns {string} Last written data
     */
    get __lastWritten() {
        return mockState.lastWritten;
    },
    
    /**
     * Get the total number of requests made
     * @returns {number} Request count
     */
    get __requestCount() {
        return mockState.requestCount;
    },
    
    /**
     * Set the response message for the next request
     * @param {string} message - Response body
     */
    set __responseMessage(message) {
        mockState.responseMessage = message;
    },
    
    /**
     * Set the HTTP status code for the next request
     * @param {number} code - HTTP status code
     */
    set __statusCode(code) {
        mockState.statusCode = code;
    },
    
    /**
     * Reset all mock state to initial values
     */
    __reset: function() {
        mockState = {
            responseMessage: 'success',
            statusCode: 200,
            lastWritten: '',
            lastOptions: {},
            requestCount: 0
        };
    },
    
    /**
     * Mock implementation of https.request()
     * @param {object} options - Request options
     * @param {function} callback - Response callback
     * @returns {object} Mock request object
     */
    request: jest.fn(function(options, callback) {
        return createMockRequest(options, callback);
    }),
    
    /**
     * Mock implementation of https.get()
     * @param {object} options - Request options
     * @param {function} callback - Response callback
     * @returns {object} Mock request object
     */
    get: jest.fn(function(options, callback) {
        const request = createMockRequest(options, callback);
        request.end();
        return request;
    })
};

module.exports = https;
