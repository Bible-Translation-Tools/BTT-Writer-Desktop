'use strict';

const _ = require('lodash'),
    path = require('path'),
    utils = require('../js/lib/utils'),
    AdmZip = require("adm-zip"),
    trash = require('trash');

function ProjectsManager(dataManager, configurator, reporter, git, migrator, translate) {

    const targetDir = configurator.getValue('targetTranslationsDir'),
        write = utils.fs.outputFile,
        read = utils.fs.readFile,
        mkdirp = utils.fs.mkdirs,
        readdir = utils.fs.readdir,
        map = utils.lodash.map,
        flatten = utils.lodash.flatten,
        toJSON = _.partialRight(JSON.stringify, null, '\t'),
        fromJSON = JSON.parse.bind(JSON);

    const custom = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
        "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
        "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
        "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
        "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John",
        "3 John", "Jude", "Revelation", "Open Bible Stories", "translationWords", "translationWords OBS"];

    return {

        moveBackups: function(oldPath, newPath) {
            return utils.fs.mkdirs(configurator.getUserPath('datalocation', 'automatic_backups'))
                .then(function () {
                    return utils.fs.mkdirs(configurator.getUserPath('datalocation', 'backups'));
                })
                .then(function () {
                    return utils.fs.stat(oldPath).then(utils.ret(true)).catch(utils.ret(false));
                })
                .then(function (exists) {
                    if (exists) {
                        return Promise.all([
                            utils.fs.mover(path.join(oldPath, 'automatic_backups'), path.join(newPath, 'automatic_backups')),
                            utils.fs.mover(path.join(oldPath, 'backups'), path.join(newPath, 'backups'))
                        ]).then(function() {
                            return true;
                        });
                    }

                    return Promise.resolve(true);
                });
        },

        sortProjectList: function (list) {
            const sort = configurator.getValue("sort") || {project: "bible", order: "project"};

            if (sort.order === "project") {
                if (sort.project === "bible") {
                    return this.sortByBibleLang(list);
                } else {
                    return this.sortByAlphaLang(list);
                }
            } else if (sort.order === "language") {
                if (sort.project === "bible") {
                    return this.sortByLangBible(list);
                } else {
                    return this.sortByLangAlpha(list);
                }
            } else if (sort.order === "progress") {
                if (sort.project === "bible") {
                    return this.sortByProgBible(list);
                } else {
                    return this.sortByProgAlpha(list);
                }
            } else {
                return this.sortByBibleLang(list);
            }
        },

        sortByBibleLang: function (list) {
            return list.sort(function (a, b) {
                if (custom.indexOf(a.project.name) > custom.indexOf(b.project.name)) {
                    return 1;
                } else if (custom.indexOf(a.project.name) < custom.indexOf(b.project.name)) {
                    return -1;
                } else {
                    if (a.target_language.name > b.target_language.name) {
                        return 1;
                    } else if (a.target_language.name < b.target_language.name) {
                        return -1;
                    } else {
                        if (a.resource.id > b.resource.id) {
                            return -1;
                        } else if (a.resource.id < b.resource.id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }
            });
        },

        sortByAlphaLang: function (list) {
            return list.sort(function (a, b) {
                if (a.project.name > b.project.name) {
                    return 1;
                } else if (a.project.name < b.project.name) {
                    return -1;
                } else {
                    if (a.target_language.name > b.target_language.name) {
                        return 1;
                    } else if (a.target_language.name < b.target_language.name) {
                        return -1;
                    } else {
                        if (a.resource.id > b.resource.id) {
                            return -1;
                        } else if (a.resource.id < b.resource.id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }
            });
        },

        sortByLangAlpha: function (list) {
            return list.sort(function (a, b) {
                if (a.target_language.name > b.target_language.name) {
                    return 1;
                } else if (a.target_language.name < b.target_language.name) {
                    return -1;
                } else {
                    if (a.project.name > b.project.name) {
                        return 1;
                    } else if (a.project.name < b.project.name) {
                        return -1;
                    } else {
                        if (a.resource.id > b.resource.id) {
                            return -1;
                        } else if (a.resource.id < b.resource.id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }
            });
        },

        sortByLangBible: function (list) {
            return list.sort(function (a, b) {
                if (a.target_language.name > b.target_language.name) {
                    return 1;
                } else if (a.target_language.name < b.target_language.name) {
                    return -1;
                } else {
                    if (custom.indexOf(a.project.name) > custom.indexOf(b.project.name)) {
                        return 1;
                    } else if (custom.indexOf(a.project.name) < custom.indexOf(b.project.name)) {
                        return -1;
                    } else {
                        if (a.resource.id > b.resource.id) {
                            return -1;
                        } else if (a.resource.id < b.resource.id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }
            });
        },

        sortByProgAlpha: function (list) {
            return list.sort(function (a, b) {
                if (a.completion > b.completion) {
                    return -1;
                } else if (a.completion < b.completion) {
                    return 1;
                } else {
                    if (a.project.name > b.project.name) {
                        return 1;
                    } else if (a.project.name < b.project.name) {
                        return -1;
                    } else {
                        if (a.resource.id > b.resource.id) {
                            return -1;
                        } else if (a.resource.id < b.resource.id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }
            });
        },

        sortByProgBible: function (list) {
            return list.sort(function (a, b) {
                if (a.completion > b.completion) {
                    return -1;
                } else if (a.completion < b.completion) {
                    return 1;
                } else {
                    if (custom.indexOf(a.project.name) > custom.indexOf(b.project.name)) {
                        return 1;
                    } else if (custom.indexOf(a.project.name) < custom.indexOf(b.project.name)) {
                        return -1;
                    } else {
                        if (a.resource.id > b.resource.id) {
                            return -1;
                        } else if (a.resource.id < b.resource.id) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }
            });
        },

        updateManifestToMeta: function (manifest) {
            const meta = manifest;

            try {
                if (manifest.project.name === "") {
                    meta.project.name = dataManager.getProjectName(manifest.project.id);
                }

                if (manifest.type.name === "" && manifest.type.id === "text") {
                    meta.type.name = "Text";
                }

                const sources = [];

                if ('source_translations' in manifest) {
                    for (let j = 0; j < manifest.source_translations.length; j++) {
                        let details = dataManager.getSourceDetails(manifest.project.id, manifest.source_translations[j].language_id, manifest.source_translations[j].resource_id);

                        if (manifest.source_translations[j].resource_id === "udb" && manifest.resource.id !== "udb") {
                            details = false;
                        }

                        if (details) {
                            sources.push(details);
                        }
                    }
                }

                meta.source_translations = _.uniqBy(sources, 'unique_id');

                if (meta.source_translations.length) {
                    meta.currentsource = 0;
                } else {
                    meta.currentsource = null;
                }

                if (manifest.type.id === "tw") {
                    meta.project_type_class = "extant";
                } else if (manifest.type.id === "tn" || manifest.type.id === "tq") {
                    meta.project_type_class = "helps";
                } else {
                    meta.project_type_class = "standard";
                }

                meta.unique_id = this.makeUniqueId(manifest);

                if (!manifest.finished_chunks) {
                    meta.finished_chunks = [];
                }

                const framenum = this.getProjectFrameNum(meta);

                if (meta.finished_chunks && framenum) {
                    meta.completion = Math.floor((meta.finished_chunks.length / framenum) * 100);
                } else {
                    meta.completion = 0;
                }

            } catch (err) {
                reporter.logError(err);
                return null;
            }
            return meta;
        },

        getProjectFrameNum: function (meta) {
            let frames = [];
            let sourceList = meta.source_translations;

            if (meta.type.id === "tw") {
                let dict = meta.project.id;
                let sourceLanguage = (sourceList.length) ? sourceList[0].language_id : "en";
                frames = dataManager.getAllWords(sourceLanguage, dict);
            } else if (sourceList.length) {
                let source = sourceList[0];
                let container = source.language_id + "_" + source.project_id + "_" + source.resource_id;
                frames = dataManager.getContainerData(container);
            }
            return frames.length;
        },

        makeUniqueId: function (manifest) {
            let id = manifest.target_language.id + "_" + manifest.project.id + "_" + manifest.type.id;
            if (manifest.resource.id !== "") {
                id += "_" + manifest.resource.id;
            }
            return id;
        },

        updateChunk: function (meta, chunk) {
            const paths = utils.makeProjectPaths(targetDir, meta);
            const projectClass = meta.project_type_class;
            const file = path.join(paths.projectDir, chunk.chunkmeta.chapterid, chunk.chunkmeta.frameid + '.txt');
            let standardcontent = chunk.transcontent;
            let hasContent = false;

            if (projectClass === "standard") {
                hasContent = !!chunk.transcontent;
            }
            if (projectClass === "helps") {
                hasContent = !!chunk.helpscontent.length;
            }
            if (projectClass === "extant" && chunk.helpscontent[0] && (!!chunk.helpscontent[0].title || !!chunk.helpscontent[0].body)) {
                hasContent = true;
            }
            if (projectClass === "standard" && hasContent && chunk.chunkmeta.frame === 1 && chunk.projectmeta.project.id !== "obs") {
                standardcontent = "\\c " + chunk.chunkmeta.chapter + " " + standardcontent;
            }
            return hasContent ? write(file, projectClass === "standard" ? standardcontent : toJSON(chunk.helpscontent)) : trash([file]);
        },

        makeChapterDir: function (meta, chunk) {
            const paths = utils.makeProjectPaths(targetDir, meta);

            return mkdirp(path.join(paths.projectDir, chunk.chunkmeta.chapterid));
        },

        saveTargetChunk: function (chunk, meta) {
            const mythis = this;

            return mythis.makeChapterDir(meta, chunk)
                .then(function () {
                    return mythis.updateChunk(meta, chunk);
                })
                .catch(function (err) {
                    reporter.logError(err);
                    throw "Unable to write to chunk file.";
                });
        },

        saveTargetManifest: function (meta) {
            const paths = utils.makeProjectPaths(targetDir, meta);
            const build = configurator.getAppData().build;

            const sources = meta.source_translations.map(function (source) {
                return {
                    language_id: source.language_id,
                    resource_id: source.resource_id,
                    checking_level: source.checking_level,
                    date_modified: source.date_modified,
                    version: source.version
                };
            });

            const manifest = {
                package_version: meta.package_version,
                format: meta.format,
                generator: {
                    name: 'ts-desktop',
                    build: build
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

            return write(paths.manifest, toJSON(manifest))
                .catch(function (err) {
                    reporter.logError(err);
                    throw "Unable to write to manifest file.";
                });
        },

        createTargetTranslation: function (translation, meta, user) {
            const mythis = this;
            const paths = utils.makeProjectPaths(targetDir, meta);
            const makeChapterDir = mythis.makeChapterDir.bind(this, meta);
            const updateChunk = mythis.updateChunk.bind(this, meta);

            const makeChapterDirs = function (data) {
                return function () {
                    return Promise.all(_.map(data, makeChapterDir));
                };
            };

            const updateChunks = function (data) {
                return function () {
                    return Promise.all(_.map(data, updateChunk));
                };
            };

            const setLicense = function () {
                const srcDir = path.resolve(path.join(__dirname, '..'));
                return read(path.join(srcDir, 'assets', 'LICENSE.md'))
                    .then(function (data) {
                        return write(paths.license, data);
                    });
            };

            return mythis.deleteTargetTranslation(meta).then(utils.ret(true)).catch(utils.ret(false))
                .then(function () {
                    mythis.unsetValues(meta.unique_id);
                    return mkdirp(paths.projectDir)
                })
                .then(setLicense)
                .then(function () {
                    return mythis.saveTargetManifest(meta);
                })
                .then(makeChapterDirs(translation))
                .then(updateChunks(translation))
                .then(function () {
                    return mythis.cleanProject(translation, meta);
                })
                .then(function () {
                    return mythis.commitProject(meta, user);
                })
                .catch(function (err) {
                    throw "Error creating new project: " + ((err && err.error && err.error.message) || err);
                });
        },

        cleanProject: function (translation, meta) {
            const paths = utils.makeProjectPaths(targetDir, meta);

            const cleanChapterDir = function (data, chapter) {
                const chapterpath = path.join(paths.projectDir, chapter);
                return readdir(chapterpath)
                    .then(function (dir) {
                        return !dir.length ? trash([chapterpath]) : true;
                    })
                    .catch(utils.ret(true));
            };

            const cleanChapterDirs = function () {
                const data = _.groupBy(translation, function (chunk) {
                    return chunk.chunkmeta.chapterid;
                });
                return Promise.all(_.map(data, cleanChapterDir));
            };

            return cleanChapterDirs();
        },

        commitProject: function (meta, user) {
            const paths = utils.makeProjectPaths(targetDir, meta);

            return git.init(paths.projectDir)
                .then(function () {
                    return git.commitAll(user, paths.projectDir);
                });
        },

        loadProjectsList: function () {
            return readdir(targetDir);
        },

        retrieveManifest: function (projectDir) {
            const manifestPath = path.join(projectDir, 'manifest.json');

            return read(manifestPath)
                .then(function (data) {
                    return fromJSON(data);
                });
        },

        loadTargetTranslationsList: function () {
            const mythis = this;
            const paths = utils.makeProjectPaths.bind(utils, targetDir);
            return this.loadProjectsList()
                .then(map(paths))
                .then(map('manifest'))
                .then(function (list) {
                    return _.filter(list, function (path) {
                        let test;
                        try {
                            // this needs changed
                            test = require('fs').statSync(path);
                        } catch (e) {
                            test = false;
                        }
                        return test;
                    })
                })
                .then(map(function(manifestFile) {
                    const projectDir = path.dirname(manifestFile);
                    return read(manifestFile)
                        .then(fromJSON)
                        .then(function (meta) {
                            meta.projectDir = projectDir;
                            return meta;
                        })
                        .catch(function (err) {
                            reporter.logError(`Error in ${manifestFile}`, err);

                            mythis.backupProject(projectDir);
                        });
                }))
                .then(Promise.all.bind(Promise))
        },

        migrateTargetTranslationsList: function () {
            const paths = utils.makeProjectPaths.bind(utils, targetDir);
            return this.loadProjectsList()
                .then(map(paths))
                .then(migrator.migrateAll.bind(migrator))
        },

        loadTargetTranslation: function (meta) {
            const paths = utils.makeProjectPaths(targetDir, meta);

            const parseChunkName = function (f) {
                const p = path.parse(f);
                const ch = p.dir.split(path.sep).slice(-1)[0];

                return ch + '-' + p.name;
            };

            const readChunk = function (f) {
                return read(f)
                    .then(function (c) {
                        const parsed = {
                            name: parseChunkName(f)
                        };
                        if (meta.project_type_class === "standard") {
                            parsed['transcontent'] = c.toString();
                        } else {
                            parsed['helpscontent'] = c.toString();
                        }
                        return parsed;
                    });
            };

            const makeFullPath = function (parent) {
                return function (f) {
                    return path.join(parent, f);
                };
            };

            const readdirs = function (dirs) {
                return Promise.all(_.map(dirs, function (d) {
                    return readdir(d)
                        .then(map(function (f) {
                            return path.join(d, f);
                        }));
                }));
            };

            const isDir = function (f) {
                return utils.fs.stat(f)
                    .then(function (s) {
                        return s.isDirectory();
                    });
            };

            const isVisibleDir = function (f) {
                return isDir(f)
                    .then(function (isFolder) {
                        const name = path.parse(f).name,
                            isHidden = /^\..*/.test(name);
                        return (isFolder && !isHidden) ? f : false;
                    });
            };

            const filterDirs = function (dirs) {
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
                .then(utils.lodash.keyBy('name'));
        },

        unsetValues: function (key) {
            configurator.unsetValue(key + "-chapter");
            configurator.unsetValue(key + "-index");
            configurator.unsetValue(key + "-selected");
            configurator.unsetValue(key + "-source");
        },

        deleteTargetTranslation: function (meta) {
            const paths = utils.makeProjectPaths(targetDir, meta);
            let projectDir = paths.projectDir;

            return utils.fileExists(projectDir)
                .then(function (exists) {
                    if (!exists) {
                        projectDir = meta.projectDir;
                        return utils.fileExists(projectDir)
                    }
                    return true;
                })
                .then(function (exists) {
                    if (exists) {
                        return trash([projectDir]);
                    } else {
                        throw translate("project_dir_doesnt_exist");
                    }
                })
                .catch(function (err) {
                    throw err || translate("unable_delete_file");
                });
        },

        backupProject: function (projectDir) {
            const projectName = path.basename(projectDir);
            const autoBackupDir = configurator.getUserPath('datalocation', 'automatic_backups');
            const filePath = path.join(autoBackupDir, `${projectName}_${utils.getDateAndTime()}.zip`);

            return utils.fileExists(projectDir)
                .then(function (exists) {
                    if (!exists) {
                        throw translate("project_dir_doesnt_exist");
                    }
                })
                .then(function () {
                    const zip = new AdmZip(undefined, {});
                    zip.addLocalFolder(projectDir, projectName);
                    zip.writeZip(filePath, (err) => {
                        if (err) reporter.logError(err);
                    });
                });
        },
    };
}

module.exports.ProjectsManager = ProjectsManager;
