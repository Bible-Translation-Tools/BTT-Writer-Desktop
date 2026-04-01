'use strict';

const path = require('path'),
    utils = require('../js/lib/utils'),
    cmdr = require('../js/lib/cmdr'),
    _ = require("lodash");

/**
 * Escape a string for safe inclusion in a shell command.
 * Wraps in single quotes and escapes any embedded single quotes.
 */
function shellEscape(s) {
    if (typeof s !== 'string') s = String(s);
    return "'" + s.replace(/'/g, "'\\''") + "'";
}

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

function GitManager(translate) {

    const logr = utils.logr;
    const toJSON = function (obj) {
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
            const status = cmd().do('git --version');

            return status.run()
                .then(function (log) {
                    const wordArray = log.stdout.split('\n')[0].split(" ");
                    const versionString = wordArray[2];
                    const versionArray = versionString.split(".");

                    return {
                        major: parseInt(versionArray[0]),
                        minor: parseInt(versionArray[1]),
                        patch: parseInt(versionArray[2]),
                        toString: function () {
                            return wordArray.slice(2).join(' ');
                        }
                    };
                });
        },

        verifyGit: function () {
            let installed = false;

            return this.getVersion()
                .then(function (version) {
                    if (version.major < minGitVersion.major || (version.major === minGitVersion.major && version.minor < minGitVersion.minor)) {
                        installed = true;
                        throw version;
                    }
                    return version;
                })
                .catch(function (err) {
                    let msg;
                    if (installed) {
                        msg = translate("git_ver_outdated", err, minGitVersion);
                    } else {
                        msg = translate("git_not_installed")
                    }
                    throw msg;
                });
        },

        getHash: function (dir) {
            return cmd().cd(dir).and.do('git rev-parse HEAD').run();
        },

        init: function (dir) {
            return utils.fs.readdir(dir).then(function (files) {
                const init = cmd().cd(dir).and.do('git init -b master');
                const hasGitFolder = (files.indexOf('.git') >= 0);

                return !hasGitFolder && init.run();
            }).then(logr(translate("git_initialized")));
        },

        commitAll: function (user, dir) {
            const msg = new Date();
            const username = user.username || 'tsDesktop';
            const email = user.email || 'you@example.com';
            const stage = cmd().cd(dir)
                .and.do(`git config user.name ${shellEscape(username)}`)
                .and.do(`git config user.email ${shellEscape(email)}`)
                .and.do('git config core.autocrlf input')
                .and.do('git add --all')
                .and.do(`git commit -am ${shellEscape(msg)}`);

            return stage.run()
                .catch(function (err) {
                    if (!err.stdout.includes('nothing to commit')) {
                        throw err;
                    }
                    return true;
                })
                .then(logr(translate("files_committed")));
        },

        merge: function (user, localPath, remotePath) {
            const mythis = this;
            const localManifestPath = path.join(localPath, 'manifest.json');
            const remoteManifestPath = path.join(remotePath, 'manifest.json');
            let mergedManifest = {};
            let conflictList = [];
            const conflicts = [];

            return Promise.all([utils.fs.readFile(localManifestPath), utils.fs.readFile(remoteManifestPath)])
                .then(function (fileData) {
                    const localManifest = JSON.parse(fileData[0]);
                    const remoteManifest = JSON.parse(fileData[1]);
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
                    let pullCommand = `git pull ${shellEscape(remotePath)} master ${NO_REBASE}`;

                    if (version.major > 2 || (version.major === 2 && version.minor > 8)) {
                        pullCommand += ` ${ALLOW_UNRELATED_HISTORIES}`;
                    }

                    const pull = cmd().cd(localPath).and.do(pullCommand);
                    return pull.run()
                        .catch(function (err) {
                            if (err.stdout.includes('fix conflicts')) {
                                return diff.run()
                                    .then(function (list) {
                                        conflictList =  list.stdout.split("\n");
                                    });
                            }
                            throw err;
                        });
                })
                .then(function () {
                    if (conflictList.length) {
                        conflictList.forEach(function (item) {
                            if (item.includes('.txt')) {
                                const splitindex = item.indexOf('/');
                                const dotindex = item.indexOf('.');
                                const chunk = item.substring(0, splitindex) + "-" + item.substring(splitindex + 1, dotindex);
                                conflicts.push(chunk);
                                const index = mergedManifest.finished_chunks.indexOf(chunk);
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
                    if (err.stderr !== undefined) {
                        throw translate("projects_merge_error", err.stderr);
                    } else {
                        console.error(err);
                    }
                })
                .then(utils.logr(translate("merge_finished")))
                .then(function () {
                    return {conflicts: conflicts, manifest: mergedManifest};
                });

        },

        push: function (user, dir, repo, opts) {
            opts = opts || {};

            const ssh = `ssh -i ${shellEscape(user.reg.paths.privateKeyPath)} -o StrictHostKeyChecking=no`;
            const pushUrl = user.reg ? repo.ssh_url : repo.html_url;
            const gitSshPush = `git push -u ${shellEscape(pushUrl)} master --follow-tags`;
            const push = cmd().cd(dir).and.set('GIT_SSH_COMMAND', ssh).do(gitSshPush);
            const tagName = createTagName(new Date());
            const tag = opts.requestToPublish ? cmd().cd(dir).and.do(`git tag -a ${shellEscape(tagName)} -m ${shellEscape('Request to Publish')}`).run() : Promise.resolve();

            console.log(translate("starting_push", push));

            return tag
                .then(function () {
                    return push.run();
                })
                .then(logr(translate("files_pushed")));
        },

        clone: function (repoUrl, localPath) {
            const repoName = repoUrl.replace(/\.git/, '').split('/').pop();
            const savePath = localPath.includes(repoName) ? localPath : path.join(localPath, repoName);
            const clone = cmd().do(`git clone ${shellEscape(repoUrl)} ${shellEscape(savePath)}`);

            return clone.run()
                .catch(function (err) {
                    if (err.error) {
                        throw err;
                    }
                    return err;
                })
                .then(logr(translate("project_cloned")));
        },
    };
}

module.exports.GitManager = GitManager;
