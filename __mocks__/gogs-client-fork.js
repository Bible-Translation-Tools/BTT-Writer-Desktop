'use strict';

const Gogs = jest.fn().mockImplementation(() => ({
    searchRepos: jest.fn().mockResolvedValue([]),
    deleteUser: jest.fn().mockResolvedValue(true),
    createUser: jest.fn().mockResolvedValue({}),
    createToken: jest.fn().mockResolvedValue({ sha1: 'mock-sha1', id: 1 }),
    getUser: jest.fn().mockResolvedValue({}),
    listTokens: jest.fn().mockResolvedValue([]),
    listPublicKeys: jest.fn().mockResolvedValue([]),
    createPublicKey: jest.fn().mockResolvedValue({}),
    deletePublicKey: jest.fn().mockResolvedValue(true),
    createRepo: jest.fn().mockResolvedValue({}),
    searchUsers: jest.fn().mockResolvedValue([])
}));

module.exports = Gogs;
