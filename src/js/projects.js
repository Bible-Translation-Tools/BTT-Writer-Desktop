'use strict';

var _ = require('lodash'),
    path = require('path'),
    utils = require('../js/lib/utils'),
    fs = require('fs');

function ProjectsManager(dataManager, configurator, reporter, git, migrator) {

    var targetDir = configurator.getValue('targetTranslationsDir'),
        write = utils.fs.outputFile,
        read = utils.fs.readFile,
        mkdirp = utils.fs.mkdirs,
        rm = utils.fs.remove,
        readdir = utils.fs.readdir,
        map = utils.lodash.map,
        flatten = utils.lodash.flatten,
        toJSON = _.partialRight(JSON.stringify, null, '\t'),
        fromJSON = JSON.parse.bind(JSON);

    return {

        moveBackups: function(oldPath, newPath) {
            utils.fs.move(path.join(oldPath, 'automatic_backups'), path.join(newPath, 'automatic_backups'), {clobber: true});
            utils.fs.move(path.join(oldPath, 'backups'), path.join(newPath, 'backups'), {clobber: true});
        },

        updateManifestToMeta: function (manifest) {
            var meta = manifest;
            try {
                if (manifest.project.name === "") {
                    meta.project.name = dataManager.getProjectName(manifest.project.id)[0].name;
                }

                if (manifest.type.name === "" && manifest.type.id === "text") {
                    meta.type.name = "Text";
                }

                for (var j = 0; j < manifest.source_translations.length; j++) {
                    var details = dataManager.getSourceDetails(manifest.project.id, manifest.source_translations[j].language_id, manifest.source_translations[j].resource_id)[0];
                    meta.source_translations[j].project_id = details.project_id;
                    meta.source_translations[j].id = details.id;
                    meta.source_translations[j].language_name = details.language_name;
                    meta.source_translations[j].resource_name = details.resource_name;
                }

                if (manifest.source_translations.length) {
                    meta.currentsource = 0;
                } else {
                    meta.currentsource = null;
                }

                if (manifest.type.id === "tw" || manifest.type.id === "ta") {
                    meta.project_type_class = "extant";
                } else if (manifest.type.id === "tn" || manifest.type.id === "tq") {
                    meta.project_type_class = "helps";
                } else {
                    meta.project_type_class = "standard";
                }

                meta.unique_id = manifest.target_language.id + "_" + manifest.project.id + "_" + manifest.type.id;
                if (manifest.resource.id !== "") {
                    meta.unique_id += "_" + manifest.resource.id;
                }

                var completion = configurator.getValue(meta.unique_id + "-completion");
                if (completion !== undefined && completion !== "") {
                    meta.completion = completion;
                } else {
                    if (manifest.source_translations.length) {
                        var frames = dataManager.getSourceFrames(manifest.source_translations[0]);
                        meta.completion = Math.round((meta.finished_chunks.length / frames.length) * 100);
                    } else {
                        meta.completion = 0;
                    }
                }
            } catch (err) {
                reporter.logError(err);
                return null;
            }
            return meta;
        },

        saveTargetTranslation: function (translation, meta, user) {
            var paths = utils.makeProjectPaths(targetDir, meta);
            var projectClass = meta.project_type_class;
            var sources = meta.source_translations.map(function (source) {
                    return {
                        language_id: source.language_id,
                        resource_id: source.resource_id,
                        checking_level: source.checking_level,
                        date_modified: source.date_modified,
                        version: source.version
                    };
                });

            var manifest = {
                package_version: meta.package_version,
                format: meta.format,
                generator: {
                    name: 'ts-desktop',
                    build: ''
                },
                target_language: meta.target_language,
                project: meta.project,
                type: meta.type,
                resource: meta.resource,
                source_translations: sources,
                parent_draft: meta.parent_draft,
                translators: meta.translators,
                finished_chunks: meta.finished_chunks
            };

            var writeFile = function (name, data) {
                return function () {
                    return write(name, toJSON(data));
                };
            };

            var makeChapterDir = function (chunk) {
                return mkdirp(path.join(paths.projectDir, chunk.chunkmeta.chapterid));
            };

            var makeChapterDirs = function (data) {
                return function () {
                    return Promise.all(_.map(data, makeChapterDir));
                };
            };

            var cleanChapterDir = function (data, chapter) {
                var chapterpath = path.join(paths.projectDir, chapter);
                return readdir(chapterpath).then(function (dir) {
                    return !dir.length ? rm(chapterpath): true;
                });
            };

            var cleanChapterDirs = function () {
                return function () {
                    var data = _.groupBy(translation, function (chunk) {
                        return chunk.chunkmeta.chapterid;
                    });
                    return Promise.all(_.map(data, cleanChapterDir));
                };
            };

            var updateChunk = function (chunk) {
                var file = path.join(paths.projectDir, chunk.chunkmeta.chapterid, chunk.chunkmeta.frameid + '.txt');
                var hasContent = false;
                if (projectClass === "standard") {
                    hasContent = !!chunk.transcontent;
                }
                if (projectClass === "helps") {
                    hasContent = !!chunk.helpscontent.length;
                }
                if (projectClass === "extant" && (!!chunk.helpscontent[0].title || !!chunk.helpscontent[0].body)) {
                    hasContent = true;
                }
                return hasContent ? write(file, projectClass === "standard" ? chunk.transcontent : toJSON(chunk.helpscontent)) : rm(file);
            };

            var updateChunks = function (data) {
                return function () {
                    return Promise.all(_.map(data, updateChunk));
                };
            };

            var setLicense = function () {
                var srcDir = path.resolve(path.join(__dirname, '..'));
                return read(path.join(srcDir, 'assets', 'LICENSE.md'))
                    .then(function(data) {
                        return write(paths.license, data);
                    });
            };

            return mkdirp(paths.projectDir)
                .then(setLicense())
                .then(writeFile(paths.manifest, manifest))
                .then(makeChapterDirs(translation))
                .then(updateChunks(translation))
                .then(cleanChapterDirs())
                .then(function () {
                    return git.init(paths.projectDir);
                })
                .then(function () {
                    return git.stage(user, paths.projectDir);
                });
        },

        loadProjectsList: function () {
            return readdir(targetDir);
        },

        loadTargetTranslationsList: function () {
            var paths = utils.makeProjectPaths.bind(utils, targetDir);
            return this.loadProjectsList()
                .then(map(paths))
                .then(map('manifest'))
                .then(function (list) {
                    return _.filter(list, function (path) {
                        try {
                            // this needs changed
                            var test = require('fs').statSync(path);
                        } catch (e) {
                            test = false;
                        }
                        return test;
                    })
                })
                .then(map(read))
                .then(Promise.all.bind(Promise))
                .then(map(fromJSON))
        },

        migrateTargetTranslationsList: function () {
            var paths = utils.makeProjectPaths.bind(utils, targetDir);
            return this.loadProjectsList()
                .then(map(paths))
                .then(migrator.migrateAll.bind(migrator))
        },

        loadTargetTranslation: function (meta) {
            var paths = utils.makeProjectPaths(targetDir, meta);

            var parseChunkName = function (f) {
                var p = path.parse(f),
                    ch = p.dir.split(path.sep).slice(-1);
                return ch + '-' + p.name;
            };

            var readChunk = function (f) {
                return read(f).then(function (c) {
                    var parsed = {
                        name: parseChunkName(f)
                    };
                    if (meta.project_type_class === "standard") {
                        parsed['transcontent'] = c.toString();
                    } else {
                        parsed['helpscontent'] = JSON.parse(c);
                    }
                    return parsed;
                });
            };

            var makeFullPath = function (parent) {
                return function (f) {
                    return path.join(parent, f);
                };
            };

            var readdirs = function (dirs) {
                return Promise.all(_.map(dirs, function (d) {
                    return readdir(d).then(map(function (f) {
                        return path.join(d, f);
                    }));
                }));
            };

            var isDir = function (f) {
                return utils.fs.stat(f).then(function (s) {
                    return s.isDirectory();
                });
            };

            var isVisibleDir = function (f) {
                return isDir(f).then(function (isFolder) {
                    var name = path.parse(f).name,
                        isHidden = /^\..*/.test(name);
                    return (isFolder && !isHidden) ? f : false;
                });
            };

            var filterDirs = function (dirs) {
                return Promise.all(_.map(dirs, isVisibleDir)).then(utils.lodash.compact());
            };

            return readdir(paths.projectDir)
                .then(map(makeFullPath(paths.projectDir)))
                .then(filterDirs)
                .then(flatten())
                .then(readdirs)
                .then(flatten())
                .then(map(readChunk))
                .then(Promise.all.bind(Promise))
                .then(utils.lodash.indexBy('name'));
        },

        deleteTargetTranslation: function (meta) {
            var paths = utils.makeProjectPaths(targetDir, meta);
            return rm(paths.projectDir);
        }
    };
}

module.exports.ProjectsManager = ProjectsManager;