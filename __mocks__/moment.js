'use strict';

/**
 * Moment.js Mock Module for Jest Testing
 * Provides a lightweight mock implementation of moment.js
 * for testing date/time formatting functionality
 */

/**
 * Create a mock moment instance
 * @param {*} value - Optional value to wrap (Date, string, number, etc.)
 * @returns {object} Mock moment instance
 */
function createMockMoment(value) {
    const momentValue = value instanceof Date ? value : new Date();
    
    return {
        /**
         * Format the date using the specified format string
         * @param {string} format - Format pattern (e.g., 'YYYY-MM-DD')
         * @returns {string} Formatted date string
         */
        format: function(format) {
            // If no format specified, return ISO string
            if (!format) {
                return momentValue.toISOString();
            }
            
            // Simple format handling
            const year = momentValue.getFullYear();
            const month = String(momentValue.getMonth() + 1).padStart(2, '0');
            const day = String(momentValue.getDate()).padStart(2, '0');
            const hours = String(momentValue.getHours()).padStart(2, '0');
            const minutes = String(momentValue.getMinutes()).padStart(2, '0');
            const seconds = String(momentValue.getSeconds()).padStart(2, '0');
            
            return format
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day)
                .replace('HH', hours)
                .replace('mm', minutes)
                .replace('ss', seconds)
                .replace('x', momentValue.getTime());
        },
        
        /**
         * Get the Unix timestamp (seconds)
         * @returns {number} Unix timestamp
         */
        unix: function() {
            return Math.floor(momentValue.getTime() / 1000);
        },
        
        /**
         * Get the Unix timestamp in milliseconds
         * @returns {number} Millisecond timestamp
         */
        valueOf: function() {
            return momentValue.getTime();
        },
        
        /**
         * Add time to the moment
         * @param {number} amount - Amount to add
         * @param {string} unit - Unit of time ('days', 'months', etc.)
         * @returns {object} Modified moment instance
         */
        add: function(amount, unit) {
            const methods = {
                'days': 'setDate',
                'months': 'setMonth',
                'years': 'setFullYear',
                'hours': 'setHours',
                'minutes': 'setMinutes',
                'seconds': 'setSeconds'
            };
            
            if (methods[unit]) {
                const current = momentValue[`get${methods[unit].charAt(3).toUpperCase() + methods[unit].slice(4)}`]();
                momentValue[methods[unit]](current + amount);
            }
            
            return this;
        },
        
        /**
         * Subtract time from the moment
         * @param {number} amount - Amount to subtract
         * @param {string} unit - Unit of time
         * @returns {object} Modified moment instance
         */
        subtract: function(amount, unit) {
            return this.add(-amount, unit);
        },
        
        /**
         * Start of time unit (e.g., start of day, month)
         * @param {string} unit - Unit to start of
         * @returns {object} Modified moment instance
         */
        startOf: function(unit) {
            const methods = {
                'day': () => momentValue.setHours(0, 0, 0, 0),
                'month': () => momentValue.setDate(1),
                'year': () => momentValue.setMonth(0, 1)
            };
            
            if (methods[unit]) {
                methods[unit]();
            }
            
            return this;
        },
        
        /**
         * Get a specific date component
         * @param {string} unit - Component to get ('date', 'month', 'year', 'day', etc.)
         * @returns {number} The component value
         */
        get: function(unit) {
            const getters = {
                'date': () => momentValue.getDate(),
                'month': () => momentValue.getMonth(),
                'year': () => momentValue.getFullYear(),
                'day': () => momentValue.getDay(),
                'hour': () => momentValue.getHours(),
                'minute': () => momentValue.getMinutes(),
                'second': () => momentValue.getSeconds()
            };
            
            return getters[unit] ? getters[unit]() : 0;
        },
        
        /**
         * Get the native Date object
         * @returns {Date} Native Date object
         */
        toDate: function() {
            return new Date(momentValue);
        },
        
        /**
         * Check if moment is before another moment/date
         * @param {*} other - Other moment or Date to compare
         * @returns {boolean} True if this moment is before other
         */
        isBefore: function(other) {
            const otherDate = other instanceof Date ? other : new Date(other);
            return momentValue < otherDate;
        },
        
        /**
         * Check if moment is after another moment/date
         * @param {*} other - Other moment or Date to compare
         * @returns {boolean} True if this moment is after other
         */
        isAfter: function(other) {
            const otherDate = other instanceof Date ? other : new Date(other);
            return momentValue > otherDate;
        },
        
        /**
         * Clone the moment
         * @returns {object} Cloned moment instance
         */
        clone: function() {
            return createMockMoment(new Date(momentValue));
        }
    };
}

/**
 * Main moment function
 * Creates a mock moment instance
 * @param {*} value - Optional initial value
 * @returns {object} Mock moment instance
 */
function moment(value) {
    return createMockMoment(value);
}

/**
 * Create a moment from a Unix timestamp
 * @param {number} value - Unix timestamp (seconds or milliseconds)
 * @returns {object} Mock moment instance
 */
moment.unix = function(value) {
    const date = new Date(value > 9999999999 ? value : value * 1000);
    return createMockMoment(date);
};

/**
 * Create a moment from now
 * @returns {object} Mock moment instance for current time
 */
moment.prototype = createMockMoment();

module.exports = moment;
