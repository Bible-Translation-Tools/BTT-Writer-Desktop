const mockExec = jest.fn();
const mockExport = jest.fn(() => new Uint8Array([0, 1, 2, 3]));

// We define Database as a Jest Mock Function that behaves like a constructor
const Database = jest.fn(function(buffer) {
    this.buffer = buffer;
    this.exec = mockExec;
    this.export = mockExport;
});

module.exports = {
    Database
};
