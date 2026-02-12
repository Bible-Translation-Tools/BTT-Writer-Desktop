'use strict';

jest.unmock('../src/js/lib/diacritics');

const { removeDiacritics } = require('../src/js/lib/diacritics');

describe('removeDiacritics', () => {
    it('should remove diacritics from accented characters', () => {
        expect(removeDiacritics('café')).toBe('cafe');
        expect(removeDiacritics('naïve')).toBe('naive');
        expect(removeDiacritics('résumé')).toBe('resume');
        expect(removeDiacritics('mañana')).toBe('manana');
    });

    it('should handle uppercase accented characters', () => {
        expect(removeDiacritics('CAFÉ')).toBe('CAFE');
        expect(removeDiacritics('NAÏVE')).toBe('NAIVE');
        expect(removeDiacritics('RÉSUMÉ')).toBe('RESUME');
    });

    it('should handle mixed case strings', () => {
        expect(removeDiacritics('Café au Lait')).toBe('Cafe au Lait');
        expect(removeDiacritics('Mañana Será Otro Día')).toBe('Manana Sera Otro Dia');
    });

    it('should handle strings with no diacritics unchanged', () => {
        expect(removeDiacritics('hello world')).toBe('hello world');
        expect(removeDiacritics('123456')).toBe('123456');
        expect(removeDiacritics('!@#$%^&*()')).toBe('!@#$%^&*()');
    });

    it('should handle empty string', () => {
        expect(removeDiacritics('')).toBe('');
    });

    it('should handle various European characters', () => {
        expect(removeDiacritics('Björk')).toBe('Bjork');
        expect(removeDiacritics('François')).toBe('Francois');
        expect(removeDiacritics('Müller')).toBe('Muller');
        expect(removeDiacritics('São Paulo')).toBe('Sao Paulo');
        expect(removeDiacritics('Čeština')).toBe('Cestina');
    });

    it('should handle characters not in the map unchanged', () => {
        // Characters outside ASCII range that aren't in the diacritics map
        expect(removeDiacritics('hello 中文 world')).toBe('hello 中文 world');
        expect(removeDiacritics('test 😀 emoji')).toBe('test 😀 emoji');
    });

    it('should handle multiple diacritics in one word', () => {
        expect(removeDiacritics('naïveté')).toBe('naivete');
        expect(removeDiacritics('Mëllër')).toBe('Meller');
    });
});