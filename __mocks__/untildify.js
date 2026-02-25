module.exports = jest.fn((str) => {
    // Mock expansion of tilde
    return str.replace(/^~($|\/|\\)/, '/mock/home$1');
});
