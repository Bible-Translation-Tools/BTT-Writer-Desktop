'use strict';

var path = require('path'),
    utils = require('../js/lib/utils'),
    cmdr = require('../js/lib/cmdr');

const ALLOW_UNRELATED_HISTORIES = '--allow-unrelated-histories';
const NO_REBASE = '--rebase=false';

// NOTE: could use moment module for this
function createTagName(datetime) {
    return 'R2P/' +
        datetime.getFullYear().toString() + '-' +
        utils.padZero(datetime.getMonth()+1) + '-' +
        utils.padZero(datetime.getDate()) + '/' +
        utils.padZero(datetime.getHours()) + '.' +
        utils.padZero(datetime.getMinutes()) + '.' +
        utils.padZero(datetime.getSeconds());
}

function GitManager() {

    var logr = utils.logr;
    var toJSON = function (obj) {
        return JSON.stringify(obj, null, '\t');
    };

    // NOTE: This could be configured or passed in.
    const paths = ['/usr/local/bin'];

    const cmd = cmdr(paths);

    const minGitVersion = {
        major: 2,
        minor: 3,
        toString: function () {
            return this.major + '.' + this.minor;
        }
    };

    return {
        get _cmd () {
            return cmd;
        },

        getVersion: function () {
            var status = cmd().do('git --version');

            return status.run()
                .then(function (log) {
                    var wordarray = log.stdout.split('\n')[0].split(" ");
                    var versionstring = wordarray[2];
                    var versionarray = versionstring.split(".");

                    return {
                        major: versionarray[0],
                        minor: versionarray[1],
                        patch: versionarray[2],
                        toString: function () {
                            return wordarray.slice(2).join(' ');
                        }
                    };
                });
        },

        verifyGit: function () {
            var mythis = this;
            var installed = false;

            return this.getVersion()
                .then(function (version) {
                    if (version.major < minGitVersion.major || (version.major == minGitVersion.major && version.minor < minGitVersion.minor)) {
                        installed = true;
                        throw version;
                    }
                    return version;
                })
                .catch(function (err) {
                    var msg = "";

                    if (installed) {
                        msg = mythis.translate("git_ver_outdated", err, minGitVersion);
                    } else {
                        msg = mythis.translate("git_not_installed")
                    }
                    throw msg;
                });
        },

        getHash: function (dir) {
            return cmd().cd(dir).and.do('git rev-parse HEAD').run();
        },

        init: function (dir) {
            var mythis = this;
            return utils.fs.readdir(dir).then(function (files) {
                var init = cmd().cd(dir).and.do('git init -b master');
                var hasGitFolder = (files.indexOf('.git') >= 0);

                return !hasGitFolder && init.run();
            }).then(logr(mythis.translate("git_initialized")));
        },

        commitAll: function (user, dir) {
            var mythis = this;
            var msg = new Date();
            var username = user.username || 'tsDesktop';
            var email = user.email || 'you@example.com';
            var stage = cmd().cd(dir)
                    .and.do(`git config user.name "${username}"`)
                    .and.do(`git config user.email "${email}"`)
                    .and.do('git config core.autocrlf input')
                    .and.do('git add --all')
                    .and.do(`git commit -am "${msg}"`);

            return stage.run()
                .catch(function (err) {
                    if (!err.stdout.includes('nothing to commit')) {
                        throw err;
                    }
                    return true;
                })
                .then(logr(mythis.translate("files_committed")));
        },

        merge: function (user, localPath, remotePath) {
            var mythis = this;
            var localManifestPath = path.join(localPath, 'manifest.json');
            var remoteManifestPath = path.join(remotePath, 'manifest.json');
            var mergedManifest = {};
            var conflictlist = [];
            var conflicts = [];

            return Promise.all([utils.fs.readFile(localManifestPath), utils.fs.readFile(remoteManifestPath)])
                .then(function (fileData) {
                    var localManifest = JSON.parse(fileData[0]);
                    var remoteManifest = JSON.parse(fileData[1]);
                    mergedManifest = localManifest;
                    mergedManifest.translators = _.union(localManifest.translators, remoteManifest.translators);
                    mergedManifest.finished_chunks = _.union(localManifest.finished_chunks, remoteManifest.finished_chunks);
                    return Promise.resolve(true);
                })
                .then(function () {
                    return mythis.getVersion();
                })
                .then(function (version) {
                    const diff = cmd().cd(localPath).and.do('git diff --name-only --diff-filter=U');
                    let pullCommand = `git pull "${remotePath}" master ${NO_REBASE}`;
                    
                    if (version.major > 2 || (version.major == 2 && version.minor > 8)) {
                        pullCommand += ` ${ALLOW_UNRELATED_HISTORIES}`;
                    }
                    
                    const pull = cmd().cd(localPath).and.do(pullCommand);
                    return pull.run()
                        .catch(function (err) {
                            if (err.stdout.includes('fix conflicts')) {
                                return diff.run()
                                    .then(function (list) {
                                        conflictlist =  list.stdout.split("\n");
                                    });
                            }
                            throw err;
                        });
                })
                .then(function () {
                    if (conflictlist.length) {
                        conflictlist.forEach(function (item) {
                            if (item.includes('.txt')) {
                                var splitindex = item.indexOf('/');
                                var dotindex = item.indexOf('.');
                                var chunk = item.substring(0, splitindex) + "-" + item.substring(splitindex + 1, dotindex);
                                conflicts.push(chunk);
                                var index = mergedManifest.finished_chunks.indexOf(chunk);
                                if (index >= 0) {
                                    mergedManifest.finished_chunks.splice(index, 1);
                                }
                            }
                        });
                    }
                    return Promise.resolve(true);
                })
                .then(function () {
                    return utils.fs.outputFile(localManifestPath, toJSON(mergedManifest));
                })
                .then(function () {
                    return mythis.commitAll(user, localPath);
                })
                .catch(function (err) {
                    if (err.stderr != undefined) {
                        throw mythis.translate("projects_merge_error", err.stderr);
                    } else {
                        console.error(err);
                    }
                })
                .then(utils.logr(mythis.translate("merge_finished")))
                .then(function () {
                    return {conflicts: conflicts, manifest: mergedManifest};
                });

        },

        push: function (user, dir, repo, opts) {
            opts = opts || {};

            var mythis = this;
            var ssh = `ssh -i "${user.reg.paths.privateKeyPath}" -o "StrictHostKeyChecking no"`;
            var pushUrl = user.reg ? repo.ssh_url : repo.html_url;
            var gitSshPush = `git push -u ${pushUrl} master --follow-tags`;
            var push = cmd().cd(dir).and.set('GIT_SSH_COMMAND', ssh).do(gitSshPush);
            var tagName = createTagName(new Date());
            var tag = opts.requestToPublish ? cmd().cd(dir).and.do(`git tag -a ${tagName} -m "Request to Publish"`).run() : Promise.resolve();

            console.log(mythis.translate("starting_push", push));

            return tag
                .then(function () {
                    return push.run();
                })
                .then(logr(mythis.translate("files_pushed")));
        },

        clone: function (repoUrl, localPath) {
            var mythis = this;
            var repoName = repoUrl.replace(/\.git/, '').split('/').pop();
            var savePath = localPath.includes(repoName) ? localPath : path.join(localPath, repoName);
            var clone = cmd().do(`git clone ${repoUrl} "${savePath}"`);

            return clone.run()
                .catch(function (err) {
                    if (err.error) {
                        throw err;
                    }
                    return err;
                })
                .then(logr(mythis.translate("project_cloned")));
        },

        translate: function (key, ...args) {
            return App.locale.translate(key, ...args);
        },
    };
}

module.exports.GitManager = GitManager;
