'use strict';

const mockExtractAllTo = jest.fn();
const mockReadAsText = jest.fn();

function AdmZip(path) {
    this.path = path;
    this.extractAllTo = mockExtractAllTo;
    this.readAsText = mockReadAsText;
}

AdmZip.mockExtractAllTo = mockExtractAllTo;
AdmZip.mockReadAsText = mockReadAsText;

module.exports = AdmZip;
