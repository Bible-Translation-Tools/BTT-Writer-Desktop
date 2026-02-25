const mockArchive = {
    pipe: jest.fn(),
    directory: jest.fn(),
    append: jest.fn(),
    finalize: jest.fn().mockResolvedValue(true),
    on: jest.fn()
};

module.exports = {
    create: jest.fn(() => mockArchive)
};
