'use strict';

module.exports = {
    pki: {
        publicKeyFromPem: jest.fn(pem => ({ type: 'public', pem })),
        privateKeyFromPem: jest.fn(pem => ({ type: 'private', pem }))
    },
    ssh: {
        publicKeyToOpenSSH: jest.fn((key, comment) => `ssh-rsa ${key.pem} ${comment}`),
        privateKeyToOpenSSH: jest.fn((key) => `ssh-private ${key.pem}`)
    }
};
