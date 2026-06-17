'use strict';

const DOMPurify = require('dompurify');

// Custom elements used by the app's renderer
const CUSTOM_ELEMENTS = ['ts-verse-marker', 'ts-note-marker', 'ts-target-note-marker'];

// Configure DOMPurify to allow app-specific custom elements
DOMPurify.addHook('uponSanitizeElement', function (node, data) {
    if (CUSTOM_ELEMENTS.indexOf(data.tagName) !== -1) {
        data.allowedTags[data.tagName] = true;
    }
});

// Allow attributes used by custom elements
const CUSTOM_ATTRS = ['verse', 'text', 'chunkindex', 'noteindex', 'data-type', 'data-section', 'data-slug', 'id', 'draggable'];

DOMPurify.addHook('uponSanitizeAttribute', function (node, data) {
    if (CUSTOM_ATTRS.indexOf(data.attrName) !== -1) {
        data.forceKeepAttr = true;
    }
});

/**
 * Sanitize HTML string, allowing safe tags plus app custom elements.
 */
function sanitize(dirty) {
    if (typeof dirty !== 'string') return '';
    return DOMPurify.sanitize(dirty, {
        ADD_TAGS: CUSTOM_ELEMENTS,
        ADD_ATTR: CUSTOM_ATTRS,
        ALLOW_DATA_ATTR: true
    });
}

module.exports = sanitize;
