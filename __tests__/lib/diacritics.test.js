/**
 * @jest-environment node
 */

'use strict';

// Adjust path to point to src/js/lib/diacritics.js
const { removeDiacritics } = require('../../src/js/lib/diacritics');

describe('Diacritics Library', () => {

    describe('removeDiacritics()', () => {

        it('should return empty string for empty input', () => {
            expect(removeDiacritics('')).toBe('');
        });

        it('should leave standard ASCII strings unchanged', () => {
            const str = 'Hello World 123 !@#';
            expect(removeDiacritics(str)).toBe(str);
        });

        it('should remove common lower case accents', () => {
            const input = 'éàèùâêîôûëïüÿçñ';
            const expected = 'eaeuaeioueiuycn';
            expect(removeDiacritics(input)).toBe(expected);
        });

        it('should remove common upper case accents', () => {
            const input = 'ÉÀÈÙÂÊÎÔÛËÏÜŸÇÑ';
            const expected = 'EAEUAEIOUEIUYCN';
            expect(removeDiacritics(input)).toBe(expected);
        });

        it('should handle mixed strings', () => {
            const input = 'Crème Brûlée';
            const expected = 'Creme Brulee';
            expect(removeDiacritics(input)).toBe(expected);
        });

        it('should expand ligatures and special mappings', () => {
            // Based on the mapping in source:
            // Æ -> AE
            // œ -> oe
            // ß (\u00DF) -> s (Note: Some libraries map to 'ss', but this one maps to 's')

            expect(removeDiacritics('Æon Flux')).toBe('AEon Flux');
            expect(removeDiacritics('Cœur')).toBe('Coeur');
            expect(removeDiacritics('Straße')).toBe('Strase');
        });

        it('should handle complex extended latin characters', () => {
            // Testing random selections from the large map
            expect(removeDiacritics('ĀāĂăĄą')).toBe('AaAaAa'); // A group
            expect(removeDiacritics('ĎďĐđ')).toBe('DdDd');     // D group
            expect(removeDiacritics('Łł')).toBe('Ll');         // L group
            expect(removeDiacritics('Øø')).toBe('Oo');         // O group
        });

        it('should handle multi-character replacements', () => {
            // Some bases are multi-letter, e.g. 'DZ', 'LJ', 'NJ'
            // \u01F1 -> DZ
            expect(removeDiacritics('Ǳ')).toBe('DZ');
            // \u01C9 -> lj
            expect(removeDiacritics('ǉ')).toBe('lj');
        });

        it('should ignore non-ASCII characters that are NOT in the map', () => {
            // The regex selects [^\u0000-\u007E], so these trigger the callback.
            // But if they aren't in the map, they return themselves.

            const greek = 'Ω'; // Not in map
            const emoji = '🙂'; // Not in map
            const chinese = '汉'; // Not in map

            expect(removeDiacritics(greek)).toBe(greek);
            expect(removeDiacritics(emoji)).toBe(emoji);
            expect(removeDiacritics(chinese)).toBe(chinese);
        });
    });
});
