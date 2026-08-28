/**
 * @jest-environment node
 */

describe('utils.shellEscape', () => {
    let utils;
    let originalPlatform;

    const setPlatform = (platform) => {
        Object.defineProperty(process, 'platform', {
            value: platform
        });
    };

    beforeAll(() => {
        originalPlatform = process.platform;
        utils = require('../../src/js/lib/utils');
    });

    afterAll(() => {
        setPlatform(originalPlatform);
    });

    it('should single-quote on Linux/macOS and escape inner single quotes', () => {
        setPlatform('linux');
        expect(utils.shellEscape('plain')).toBe("'plain'");
        expect(utils.shellEscape("it's")).toBe("'it'\\''s'");
    });

    it('should double-quote on Windows, since cmd.exe ignores single quotes', () => {
        setPlatform('win32');
        expect(utils.shellEscape('C:\\Users\\u u\\proj')).toBe('"C:\\Users\\u u\\proj"');
        expect(utils.shellEscape('say "hi"')).toBe('"say ""hi"""');
    });

    it('should stringify non-string input', () => {
        setPlatform('linux');
        expect(utils.shellEscape(42)).toBe("'42'");
    });
});
