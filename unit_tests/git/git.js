'use strict';

//process.env.NODE_ENV = 'test';

let assert = require('assert');
let rimraf = require('rimraf');
let path = require('path');
let mkdirp = require('mkdirp');
let Uploader = require('../../app/js/uploader').Uploader;
let fs = require('fs');
let _ = require('lodash');
let Git = require('../../app/js/git').Git;
let git = new Git();

describe('@Git', function () {
    this.timeout(30000);

    let repoDir = path.resolve('unit_tests/git/testrepo'),
        testFileName = 'sample.txt',
        testFile = path.join(repoDir, testFileName),
        repo = 'uw-unittest-en';

    function createDummyProject (cb) {
        rimraf(repoDir, function (err) {
            if (err) {
                cb(err);
            } else {
                mkdirp(repoDir, function (err) {
                    if (err) {
                        cb(err);
                    } else {
                        fs.writeFile(testFile, 'A line of text', function () {
                            cb();
                        });
                    }
                });
            }
        });
    }

    function initRepo (cb) {
        createDummyProject(function (err) {
            if (err) {
                cb(err);
            } else {
                return git.init(repoDir).then(function (ret) {
                    cb();
                    return ret;
                }, cb);
            }
        })
    }

    function stageProject (cb) {
        createDummyProject(function (err) {
            if (err) {
                cb(err);
            } else {
                return git.init(repoDir).then(function () {
                    return git.stage(repoDir);
                }).then(function (ret) {
                    cb();
                    return ret;
                }).catch(cb);
            }
        });
    }

    function deleteProject (cb) {
        rimraf(repoDir, cb);
    }

    describe('@GitBasic', function () {

        before(function (done) {
            createDummyProject(done);
        });
        after(function (done) {
            deleteProject(done);
        });

        it('should init a local git repo', function (done) {
            git.init(repoDir).then(function () {
                fs.readdir(repoDir, function (err, files) {
                    if (err) {
                        done(err);
                    } else {
                        assert(_.includes(files, '.git'), 'expected a .git folder');
                        done();
                    }
                });
            }, done);
        });
    });

    describe('@GitLocal', function () {

        before(function (done) {
            initRepo(done);
        });
        after(function (done) {
            deleteProject(done);
        });

        it('should stage the files', function (done) {
            git.stage(repoDir).then(function () {
                fs.readFile(path.join(repoDir, '.git', 'index'), function (err, data) {
                    if (err) {
                        done(err);
                    } else {
                        assert(!!data.toString().match(new RegExp(testFileName)), testFileName + ' should be in the git index');
                        done();
                    }
                });
            }, done);
        });
    });

    describe('@GitRemote', function () {
        let uploader = new Uploader();
        uploader.sshPath = path.resolve('unit_tests/git/ssh');

        before(function (done) {
            //stageProject(done);

            rimraf(repoDir, function (err) {
                mkdirp(repoDir, function (err) {
                    fs.writeFile(testFile, 'A line of text', function () {
                        git.init(repoDir).then(function () {
                            return git.stage(repoDir);
                        }).then(function (ret) {
                            done();
                        });
                    });
                });
            });      
        });

        after(function (done) {
            rimraf(uploader.sshPath, function () {
                rimraf(repoDir, function () {
                    done();
                });
            });
        });

        it('should register the ssh keys with the server', function (done) {
            uploader.register().then(function (reg) {
                var gotOkResponse = reg.response && !reg.response.error && reg.reponse.ok;

                assert(gotOkResponse, 'should get an ok from the server when registering');
                done();
            }, done);
        });

        it('should push to the server', function (done) {
            var gitPush = git.push.bind(git, repoDir, repo);

            uploader.register().then(gitPush).then(function (ret) {
                var success = ret.stdout.indexOf('Branch master set up to track') !== -1;

                assert(success, 'expected good git push response');
                done();
            }).catch(done);
        });
    });
});
