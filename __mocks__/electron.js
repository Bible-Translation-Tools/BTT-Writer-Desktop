module.exports = {
    ipcRenderer: {
        send: jest.fn(),
        sendSync: jest.fn((channel, arg) => {
            if (channel === 'main-window' && arg === 'dataPath') {
                return '/mock/data/path';
            }
            return null;
        }),
        on: jest.fn(),
    }
};
