/**
 * BTT-Writer gulpfile
 *
 * Copyright 2016
 */

const gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    rimraf = require('rimraf'),
    argv = require('yargs').argv,
    packager = require('@electron/packager'),
    rebuild = require('@electron/rebuild'),
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    util = require('./src/js/lib/utils'),
    princePackager = require('./src/js/prince-packager'),
    debInstaller = require('electron-installer-debian'),
    dmgInstaller = require('electron-installer-dmg'),
    packageJson = require("./package.json"),
    AdmZip = require('adm-zip');

const APP_NAME = 'BTT-Writer',
    JS_FILES = './src/js/**/*.js',
    UNIT_TEST_FILES = './unit_tests/**/*.js',
    BUILD_DIR = 'out/',
    RELEASE_DIR = 'release/';


function clean(done) {
    rimraf.sync('src/logs');
    rimraf.sync('logs');
    rimraf.sync('ssh');
    done();
}

gulp.task('clean', clean);

function test() {
    return gulp.src(UNIT_TEST_FILES, { read: false })
        .pipe(mocha({ reporter: 'spec', grep: (argv.grep || argv.g) }));
}

gulp.task('test', test);

/**
 * This will download and install prince binaries for all os'
 */
gulp.task('prince', function(done) {
    const tempDir = 'src/prince';

    util.chain(princePackager.install.bind(null, tempDir))(['win', 'linux', 'osx'])
        .then(function() {
            done();
        })
        .catch(() => done());
});

function zipDirectory(sourceDir, destPath, outPath) {
    return new Promise((resolve, reject) => {
        const zip = new AdmZip(undefined, {});
        zip.addLocalFolder(sourceDir, destPath);
        zip.writeZip(outPath, err => err ? reject(err) : resolve());
    });
}

function build(done) {

    const platforms = [];

    if (argv.win) platforms.push('win32');
    if (argv.osx) platforms.push('darwin');
    if (argv.linux) platforms.push('linux');
    if (!platforms.length) platforms.push('win32', 'darwin', 'linux');

    const ignored = [
        'unit_tests',
        'acceptance_tests',
        '__tests__',
        '__mocks__',
        'out',
        'release',
        'vendor',
        'scripts',
        'bower.json',
        'crowdin.yml',
        'Dockerfile',
        'gogs-client-lib-request.diff',
        'gulpfile.js',
        'jest.config.js',
        'makefile',
        'win64_installer.iss',
        'pioneer.json',
        'config.json.enc'
    ].map(function (name) {
        return new RegExp('^/' + name + '($|/)');
    });

    // Also ignore all dot files and folders
    ignored.push(/[/\\]\.[^/\\]+/);

    packager({
        arch: ['x64', 'universal'],
        platform: platforms,
        dir: '.',
        prune: true,
        ignore: ignored,
        out: BUILD_DIR,
        appVersion: packageJson.version,
        icon: './icons/icon',
        osxUniversal: {
            'x64ArchFiles': '*'
        },
        afterCopy: [
            (buildPath, electronVersion, platform, arch, callback) => {
                rebuild.rebuild({ buildPath, electronVersion, arch })
                    .then(() => callback())
                    .catch((error) => callback(error));
            },
        ],
    }).then(() => done())
    .catch(err => {
        console.log(err)
        done()
    });
}

// pass parameters like: gulp build --win --osx --linux
gulp.task('build', gulp.series(clean, build));

function release(done){

    const exec = require('child_process').exec;

    const promises = [];
    const platforms = [];
    const gitVersion = '2.33.0';

    if (argv.win) platforms.push('win64');
    if (argv.osx) platforms.push('darwin');
    if (argv.linux) platforms.push('linux');
    if (!platforms.length) platforms.push('win64', 'darwin', 'linux');

    /**
     *
     * @param version 2.33.0
     * @param arch 64|32
     * @returns {Promise}
     */
    const downloadGit = function (version, arch) {
        return new Promise(function (resolve, reject) {
            const cmd = `./scripts/git/download_git.sh ./vendor ${version} ${arch}`;
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
    const releaseWin = function (arch, os) {
        // TRICKY: the iss script cannot take the .exe extension on the file name
        const file = `BTT-Writer-${packageJson.version}-win-x${arch}`;
        const cmd = `iscc scripts/win_installer.iss /DArch=${arch === '64' ? 'x64' : 'x86'} /DRootPath=../ /DVersion=${packageJson.version} /DGitVersion=${gitVersion} /DDestFile=${file} /DDestDir=${RELEASE_DIR} /DBuildDir=${BUILD_DIR}`;
        console.log(cmd);
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

    const releaseDeb = function (arch) {
        let buildPath = BUILD_DIR + `BTT-Writer-linux-x64/`;
        const options = {
            name: "btt-writer",
            src: buildPath,
            dest: RELEASE_DIR,
            arch: arch,
            icon: "icons/icon.png",
            compression: "gzip",
            categories: [
                "Translation", "Languages"
            ],
            depends: [
                "git"
            ],
            maintainer: "<wycliffeassociates.org>",
            homepage: "https://bibletranslationtools.org/writer"
        }
        return debInstaller(options);
    }

    const releaseDmg = function (arch) {
        const name = `BTT-Writer-${packageJson.version}-osx`;
        let buildPath = BUILD_DIR + `BTT-Writer-darwin-${arch}/BTT-Writer.app`;
        const options = {
            appPath: buildPath,
            name: name,
            out: RELEASE_DIR,
            icon: "icons/icon.icns"
        }
        return new Promise(function(resolve, reject) {
            resolve(dmgInstaller.createDMG(options))
        });
    }

    function _release() {
        const tasks = platforms.map(async (os) => {
            try {
                switch (os) {
                    case 'win64':
                        if (!fs.existsSync(BUILD_DIR + 'BTT-Writer-win32-x64/')) {
                            throw new Error('Missing build');
                        }
                        await downloadGit(gitVersion, '64');
                        return await releaseWin('64', os);

                    case 'darwin':
                        let arch = 'universal';
                        let macBuildPath = BUILD_DIR + `BTT-Writer-darwin-${arch}/`;
                        if (!fs.existsSync(macBuildPath)) {
                            // fallback to x64 arch
                            arch = "x64";
                            macBuildPath = BUILD_DIR + `BTT-Writer-darwin-${arch}/`;
                        }

                        if (!fs.existsSync(macBuildPath)) {
                            throw new Error('Missing build');
                        }

                        const macDest = `${RELEASE_DIR}BTT-Writer-${packageJson.version}-osx-${arch}.zip`;

                        await zipDirectory(macBuildPath + 'BTT-Writer.app/', 'BTT-Writer.app', macDest);
                        await releaseDmg(arch);

                        return {os: os, status: 'ok', path: macDest};

                    case 'linux':
                        const linuxBuildPath = BUILD_DIR + 'BTT-Writer-linux-x64/';
                        if (!fs.existsSync(linuxBuildPath)) {
                            throw new Error('Missing build');
                        }

                        const linuxDest = `${RELEASE_DIR}BTT-Writer-${packageJson.version}-linux-x64.zip`;

                        await zipDirectory(linuxBuildPath, 'BTT-Writer', linuxDest);
                        await releaseDeb("amd64", os);

                        return {os: os, status: 'ok', path: linuxDest};

                    default:
                        console.warn('No release procedure for ' + os);
                        return null;
                }
            } catch (err) {
                console.error(`Failed to release ${os}:`, err.message);
                return {os: os, status: 'error', path: null, error: err};
            }
        });

        Promise.all(tasks).then(() => done());
    }

    mkdirp.sync('release')
    _release();
}

gulp.task('release', release);

gulp.task('default', test);
