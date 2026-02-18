/**
 * @jest-environment node
 */

'use strict';

// Adjust path if needed to point to src/js/lib/content-values.js
const { ContentValues } = require('../../src/js/lib/content-values');

describe('ContentValues', () => {
    let cv;

    beforeEach(() => {
        cv = new ContentValues();
    });

    describe('API', () => {
        it('should initialize with empty fields and values', () => {
            expect(cv.getFields()).toEqual([]);
            expect(cv.getValues()).toEqual({});
        });

        it('should set a field and value', () => {
            const result = cv.set('username', 'admin');

            expect(result).toBe(true);
            // FIX: Value is stored as-is, not prefixed
            expect(cv.get('username')).toBe('admin');
            expect(cv.getFields()).toContain('username');
        });

        it('should handle multiple fields', () => {
            cv.set('id', 1);
            cv.set('name', 'test');

            expect(cv.getFields()).toEqual(['id', 'name']);
            expect(cv.get('id')).toBe(1);
            expect(cv.get('name')).toBe('test');
        });

        it('should update existing values without duplicating field in list', () => {
            cv.set('status', 'active');
            expect(cv.getFields()).toHaveLength(1);
            expect(cv.get('status')).toBe('active');

            // Update
            cv.set('status', 'inactive');

            expect(cv.getFields()).toHaveLength(1); // Still 1 field
            expect(cv.getFields()[0]).toBe('status');
            expect(cv.get('status')).toBe('inactive');
        });

        it('should not set field if undefined', () => {
            cv.set(undefined, 'value');

            expect(cv.getFields()).toHaveLength(0);
        });

        it('should structure internal values with colon prefix for KEYS only', () => {
            cv.set('key', 'val');

            const values = cv.getValues();
            // FIX: Key has colon, Value does NOT
            expect(values).toHaveProperty(':key', 'val');
        });
    });

    describe('Prototype Quirks', () => {
        it('should return a plain object, not a ContentValues instance', () => {
            // Because the constructor explicitly returns {...},
            // the 'new' keyword result is that object, not the instance linked to the prototype.
            expect(cv instanceof ContentValues).toBe(false);
        });

        it('should use native valueOf, ignoring the custom prototype method', () => {
            // The returned object inherits from Object.prototype, so valueOf exists.
            // However, it is NOT the custom one defined in your source (which returns this.values).
            // Native valueOf() returns the object itself.

            expect(cv.valueOf).toBeDefined();
            expect(cv.valueOf()).toBe(cv); // Native behavior

            // Confirm it is NOT returning the internal values object (custom behavior)
            expect(cv.valueOf()).not.toBe(cv.getValues());
        });
    });
});
