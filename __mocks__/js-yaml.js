module.exports = {
    load: jest.fn((content) => {
        try {
            return JSON.parse(content); // Use JSON for simplicity in tests
        } catch (e) {
            return null;
        }
    })
};
