'use strict';

var _ = require('lodash'),
    Gogs = require('gogs-client'),
    requester = require('gogs-client/lib/request'),
    os = require('os'),
    utils = require('../js/lib/utils');


function UserManager(auth, server) {

    const apiUrl = server + '/api/v1';
    const api = new Gogs(apiUrl);

    const MAX_PAGE_SIZE = 50;

    const tokenStub = {
        name: `btt-writer-desktop_${os.hostname()}_${process.platform}__${utils.getMachineIdSync()}`
    }

    const fetchRepoRecursively = function (uid, query, limit, page, resultList) {
        /* 
         *  due to inadequate parameter (@page) in gogs client api searchRepos(),
         *  this parameter-embedded tweak is temporarily provided to make use of the client api.
         */
        return api.searchRepos(`${query}&page=${page}`, uid, limit)
            .then(_.flatten)
            .then(function (repos) {
                if (repos.length == 0) {
                    // no more repos found
                    return resultList;
                } else {
                    // collect result from current page
                    let newList = resultList.concat(repos); 
                    return fetchRepoRecursively(uid, query, limit, page + 1, newList) // recursive call to get next page
                }
            });
    };


    /* Delete the corresponding token on server (for server account)
     *
     * Note: the gogs-client api currently does not support DELETE token method.
     * However, the endpoint is available for usage.
     */
    const deleteAccessToken = function (user) {
        var mythis = this;
        if (user.tokenId && (user.token || user.password)) {
            const userAuth = {
                username: user.username,
                password: user.password ? user.password : user.token
            }
            let apiRequest = requester(apiUrl);
            let path = `users/${user.username}/tokens/${user.tokenId}`;
            return apiRequest(path, userAuth, null, 'DELETE')
                .then(res => {
                    if (res.status != 204) {
                        console.error(mythis.translate("delete_token_error"), res);
                    }
                });
        } else {
            // local account
            return Promise.resolve();
        }
    }

    const fetchRepoExhaustively = async function (uid, query, limit) {
        limit = limit || MAX_PAGE_SIZE;
        let page = 1;
        let repoList = [];
        let hasMore = true;

        while (hasMore) {
            /*
            *  due to inadequate parameter (@page) in gogs client api searchRepos(),
            *  this parameter-embedded tweak is temporarily provided to make use of the api
            */
            let repos = await api.searchRepos(`${query}&page=${page}`, uid, limit).then(_.flatten);
            if (repos.length > 0) {
                repos.forEach((repo) => repoList.push(repo));
                page++;
            } else {
                hasMore = false;
            }
        }

        return repoList;
    };

    return {

        deleteAccount: function (user) {
            return api.deleteUser(user, auth);
        },

        createAccount: function (user) {
            return api.createUser(user, auth, true)
                .then(function(updatedUser) {
                    return api.createToken(tokenStub, user)
                        .then(function(token) {
                            updatedUser.token = token.sha1;
                            return updatedUser;
                        });
                });
        },

        login: function (userObj) {
            return api.getUser(userObj).then(function (user) {
                return api.listTokens(userObj)
                    .then(function (tokens) {
                        return _.find(tokens, tokenStub);
                    })
                    .then(function (token) {
                        // delete existing token on server
                        if (token) {
                            let usr = { 
                                username: userObj.username, 
                                password: userObj.password, 
                                tokenId: token.id
                            }
                            return deleteAccessToken(usr)
                                    .then(() => api.createToken(tokenStub, userObj));
                        } else {
                            return api.createToken(tokenStub, userObj);
                        }
                    })
                    .then(function (token) { 
                        user.tokenId = token.id;
                        user.token = token.sha1;
                        return user;
                    });
            });
        },

        logout: function(user) {
            return deleteAccessToken(user);
        },

        register: function (user, deviceId) {
            var keyStub = {title: 'btt-writer-desktop ' + deviceId};
            return api.listPublicKeys(user).then(function (keys) {
                return _.find(keys, keyStub);
            }).then(function (key) {
                return key ? key : api.createPublicKey({
                    title: keyStub.title,
                    key: user.reg.keys.public
                }, user);
            });
        },

        unregister: function (user, deviceId) {
            var keyStub = {title: 'btt-writer-desktop ' + deviceId};
            return api.listPublicKeys(user).then(function (keys) {
                return _.find(keys, keyStub);
            }).then(function (key) {
                return key ? api.deletePublicKey(key, user) : false;
            });
        },

        createRepo: function (user, reponame) {
            let query = "_";

            return fetchRepoExhaustively(user.id, query, MAX_PAGE_SIZE)
                .then(function (repos) {
                    return _.find(repos, {full_name: user.username + '/' + reponame});
                })
                .then(function (repo) {
                    return repo ? repo : api.createRepo({
                        name: reponame,
                        description: 'btt-writer-desktop: ' + reponame,
                        private: false
                    }, user);
                });
        },

        retrieveRepos: function (u, q) {
            u = u === '*' ? '' : (u || '');
            q = q === '*' ? '_' : (q || '_');

            let limit = 10;

            function searchRepos(user) {
                var uid = (typeof user === 'object' ? user.id : user) || 0;
                if (uid == 0) {
                    // search repos by query
                    return api.searchRepos(q, uid, limit);
                } else {
                    // search all repos of user (uid)
                    return fetchRepoExhaustively(uid, q, MAX_PAGE_SIZE);
                }
            }

            function searchUsers (visit) {
                return api.searchUsers(u, limit).then(function (users) {
                    var a = users.map(visit);

                    a.push(visit(0).then(function (repos) {
                        return repos.filter(function (repo) {
                            var username = repo.full_name.split('/').shift();
                            return username.includes(u);
                        });
                    }));

                    return Promise.all(a);
                });
            }

            var p = u ? searchUsers(searchRepos) : searchRepos();

            return p.then(_.flatten).then(function (repos) {
                return _.uniq(repos, 'id');
            })
                .then(function (repos) {
                    return _.map(repos, function (repo) {
                        var user = repo.full_name.split("/")[0];
                        var project = repo.full_name.split("/")[1];
                        return {repo: repo.full_name, user: user, project: project};
                    });
                });
        },

        translate: function (key, ...args) {
            return App.locale.translate(key, ...args);
        },

    };
}

module.exports.UserManager = UserManager;
