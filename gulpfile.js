/**
 * BTT-Writer gulpfile
 *
 * Copyright 2016
 */

const gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    rimraf = require('rimraf'),
    argv = require('yargs').argv,
    packager = require('electron-packager'),
    replace = require('gulp-replace'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    util = require('./src/js/lib/utils');
    princePackager = require('./src/js/prince-packager');

const APP_NAME = 'BTT-Writer',
    JS_FILES = './src/js/**/*.js',
    UNIT_TEST_FILES = './unit_tests/**/*.js',
    BUILD_DIR = 'out/',
    RELEASE_DIR = 'release/';

gulp.task('test', function () {
    return gulp.src(UNIT_TEST_FILES, { read: false })
        .pipe(mocha({reporter: 'spec', grep: (argv.grep || argv.g)}));
});

gulp.task('clean', function () {
    rimraf.sync('src/logs');
    rimraf.sync('logs');
    rimraf.sync('ssh');
});

gulp.task('bump', function () {
    var build = require('./package').build;

    var bumped = ++build;

    var replaceString = '$1"' + bumped + '"$2';

    console.log(bumped);
    return gulp.src(['package.json'])
        .pipe(replace(/("build"\s*:\s*)"\d+"(.*)/, replaceString))
        .pipe(gulp.dest('./'));
});

/**
 * This will download and install prince binaries for all os'
 */
gulp.task('prince', function(done) {
    var tempDir = 'src/prince';

    util.chain(princePackager.install.bind(null, tempDir))(['win', 'linux', 'osx'])
        .then(function() {
            done();
        })
        .catch(done);
});

// pass parameters like: gulp build --win --osx --linux
gulp.task('build', ['clean'], function (done) {

    var platforms = [];

    if (argv.win) platforms.push('win32');
    if (argv.osx) platforms.push('darwin');
    if (argv.linux) platforms.push('linux');
    if (!platforms.length) platforms.push('win32', 'darwin', 'linux');

    var p = require('./package');
    var ignored = Object.keys(p['devDependencies']).concat([
        'unit_tests',
        'acceptance_tests',
        '__tests__',
        '__mocks__',
        'out',
        BUILD_DIR,
        RELEASE_DIR,
        'vendor',
        'scripts',
        '\\.'
    ]).map(function (name) {
        return new RegExp('(^/' + name + '|' + '^/node_modules/' + name + ')');
    });

    packager({
        'arch': 'all',
        'platform': platforms,
        'dir': '.',
        'ignore': function (name) {
            for (var i = 0, len = ignored.length; i < len; ++i) {
                if (ignored[i].test(name)) {
                    console.log('\t(Ignoring)\t', name);
                    return true;
                }
            }

            return false;
        },
        'out': BUILD_DIR,
        'app-version': p.version,
        'icon': './icons/icon'
    }, function () {
        console.log('Done building...');
        done();
    });
});

gulp.task('release', function(done) {
    const p = require('./package');
    const archiver = require('archiver');
    const exec = require('child_process').exec;

    var promises = [];
    var platforms = [];
    const gitVersion = '2.9.2';

    if (argv.win) platforms.push('win32', 'win64');
    if (argv.win32) platforms.push('win32');
    if (argv.win64) platforms.push('win64');
    if (argv.osx) platforms.push('darwin');
    if (argv.linux) platforms.push('linux');
    if (!platforms.length) platforms.push('win32', 'win64', 'darwin', 'linux');

    /**
     *
     * @param version 2.9.2
     * @param arch 64|32
     * @returns {Promise}
     */
    const downloadGit = function(version, arch) {
        return new Promise(function (resolve, reject) {
            var cmd = `./scripts/git/download_git.sh ./vendor ${version} ${arch}`;
            exec(cmd, function(err, stdout, stderr) {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    };

    /**
     *
     * @param arch 64|32
     * @param os
     * @returns {Promise}
     */
    const releaseWin = function(arch, os) {
        // TRICKY: the iss script cannot take the .exe extension on the file name
        var file = `BTT-Writer-${p.version}-${p.build}-win-x${arch}`;
        var cmd = `iscc scripts/win_installer.iss /DArch=${arch == '64' ? 'x64' : 'x86'} /DRootPath=../ /DVersion=${p.version} /DBuild=${p.build} /DGitVersion=${gitVersion} /DDestFile=${file} /DDestDir=${RELEASE_DIR} /DBuildDir=${BUILD_DIR}`;
        return new Promise(function(resolve, reject) {
            exec(cmd, function(err, stdout, stderr) {
                if(err) {
                    console.error(err);
                    resolve({
                        os: os,
                        status: 'error',
                        path: null
                    });
                } else {
                    resolve({
                        os: 'win' + arch,
                        status: 'ok',
                        path: RELEASE_DIR + file + '.exe'
                    });
                }
            });
        });
    };

    mkdirp('release', function() {
        for(var os of platforms) {
            switch (os) {
                case 'win32':
                    if (fs.existsSync(BUILD_DIR + 'BTT-Writer-win32-ia32/')) {
                        promises.push(downloadGit(gitVersion, '32')
                            .then(releaseWin.bind(undefined, '32', os)));
                    } else {
                        promises.push(Promise.resolve({
                            os: os,
                            status: 'missing',
                            path: null
                        }));
                    }
                    break;
                case 'win64':
                    if (fs.existsSync(BUILD_DIR + 'BTT-Writer-win32-x64/')) {
                        promises.push(downloadGit(gitVersion, '64')
                            .then(releaseWin.bind(undefined, '64', os)));
                    } else {
                        promises.push(Promise.resolve({
                            os: os,
                            status: 'missing',
                            path: null
                        }));
                    }
                    break;
                case 'darwin':
                    if (fs.existsSync(BUILD_DIR + 'BTT-Writer-darwin-x64/')) {
                        promises.push(new Promise(function (os, resolve, reject) {
                            var dest = `${RELEASE_DIR}BTT-Writer-${p.version}-${p.build}-osx-x64.zip`;
                            try {
                                var output = fs.createWriteStream(dest);
                                output.on('close', function () {
                                    resolve({
                                        os: os,
                                        status: 'ok',
                                        path: dest
                                    });
                                });
                                var archive = archiver.create('zip');
                                archive.on('error', reject);
                                archive.pipe(output);
                                archive.directory(BUILD_DIR + 'BTT-Writer-darwin-x64/BTT-Writer.app/', 'BTT-Writer.app');
                                archive.finalize();
                            } catch (e) {
                                console.error(e);
                                resolve({
                                    os: os,
                                    status: 'error',
                                    path: null
                                });
                            }
                        }.bind(undefined, os)));
                    } else {
                        promises.push(Promise.resolve({
                            os: os,
                            status: 'missing',
                            path: null
                        }));
                    }
                    break;
                case 'linux':
                    let linuxBuildPath = BUILD_DIR + 'BTT-Writer-linux-x64/';
                    if (fs.existsSync(linuxBuildPath)) {
                        promises.push(new Promise(function (os, resolve, reject) {
                            // copy old libs to app's root for linux
                            let files = fs.readdirSync("old_linux_libs/");
                            files.forEach(fileName => {
                                console.log("Copying libs: " + fileName);
                                fs.copyFileSync(
                                    `old_linux_libs/${fileName}`, linuxBuildPath + fileName
                                    );
                            });

                            var dest = `${RELEASE_DIR}BTT-Writer-${p.version}-${p.build}-linux-x64.zip`;
                            try {
                                var output = fs.createWriteStream(dest);
                                output.on('close', function () {
                                    resolve({
                                        os: os,
                                        status: 'ok',
                                        path: dest
                                    });
                                });
                                var archive = archiver.create('zip');
                                archive.on('error', reject);
                                archive.pipe(output);
                                archive.directory(linuxBuildPath, 'BTT-Writer');
                                archive.finalize();
                            } catch (e) {
                                console.error(e);
                                resolve({
                                    os: os,
                                    status: 'error',
                                    path: null
                                });
                            }
                        }.bind(undefined, os)));
                    } else {
                        promises.push(Promise.resolve({
                            os: os,
                            status: 'missing',
                            path: null
                        }));
                    }
                    break;
                default:
                    console.warn('No release procedure has been defined for ' + os);
            }
        }
    });
});

gulp.task('default', ['test']);
