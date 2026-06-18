'use strict';

const _ = require('lodash');
const utils = require('../js/lib/utils');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

function DataManager(db, resourceDir, sourceDir, configurator, translate) {

    return {

        getResourceDir: function () {
            return resourceDir;
        },

        updateLanguages: function (onProgress) {
            return db.updateCatalogs(onProgress);
        },

        /**
         * Changes the language catalog URL (langnames.json)
         */
        updateLanguageUrl: function(languageUrl) {
            return db.setLanguageUrl(languageUrl);
        },

        updateSources: function (onProgress) {
            const apiURL = configurator.getUserSetting("mediaserver") + "/v2/ts/catalog.json";
            return db.updateSources(apiURL, onProgress);
        },

        updateIndex: async function (progressCallback) {
            const url = configurator.getUserSetting('indexsqliteurl');
            const libraryDir = configurator.getValue('libraryDir');
            const libraryPath = path.join(libraryDir, "index.sqlite");

            return await fetch(url)
                .then(async function (response) {
                    const reader = response.body.getReader();
                    const writer = fs.createWriteStream(libraryPath);
                    let bytesDone = 0;
                    const total = parseInt(response.headers.get('Content-Length') || 0);

                    while (true) {
                        const result = await reader.read();
                        if (result.done) break;

                        const chunk = result.value;
                        if (chunk !== null) {
                            writer.write(Buffer.from(chunk));

                            if (typeof progressCallback === 'function') {
                                bytesDone += chunk.byteLength;
                                const percent = total === 0 ? null : Math.floor(bytesDone / total * 100);
                                progressCallback(percent);
                            }
                        } else {
                            throw "empty chunk downloaded";
                        }
                    }

                    writer.end();
                });
        },

        updateChunks: function () {
            return db.updateChunks();
        },

        importContainer: function (filePath) {
            return db.importResourceContainer(filePath);
        },

        checkForContainer: function (filePath) {
            const mythis = this;

            return db.loadResourceContainer(filePath)
                .then(function (container) {
                    return mythis.containerExists(container.slug);
                })
                .catch(function (e) {
                    return false;
                });
        },

        containerExists: function (container) {
            const resourcePath = path.join(resourceDir, container);
            const sourcePath = path.join(sourceDir, container + ".tsrc");

            return utils.fs.stat(resourcePath).then(utils.ret(true)).catch(utils.ret(false))
                .then(function (resexists) {
                    return utils.fs.stat(sourcePath).then(utils.ret(true)).catch(utils.ret(false))
                        .then(function (srcexists) {
                            return resexists || srcexists;
                        });
                });
        },

        getMetrics: function () {
            return db.indexSync.getMetrics();
        },

        getSourceLanguages: function () {
            return db.indexSync.getSourceLanguages();
        },

        getTranslations: function () {
            return db.indexSync.findTranslations();
        },

        getTargetLanguages: function () {
            let list;
            try {
                list = db.indexSync.getTargetLanguages();
            } catch (e) {
                return [];
            }

            return list.map(function (item) {
                return {id: item.slug, name: item.name, direction: item.direction};
            });
        },

        getProjects: function (lang) {
            return db.indexSync.getProjects(lang || 'en');
        },

        getSourcesByProject: function (project) {
            const mythis = this;
            let allres;

            try {
                allres = db.indexSync.getResources(null, project);
            } catch (e) {
                return Promise.resolve(true)
                    .then(function () {
                        return [];
                    });
            }

            const filterres = allres.filter(function (item) {
                return item.type === 'book' && (item.status.checking_level === "3" || item.imported);
            });

            const mapped = filterres.map(function (res) {
                return mythis.getSourceDetails(res.project_slug, res.source_language_slug, res.slug);
            });

            return utils.chain(this.validateExistence.bind(this))(mapped);
        },

        validateExistence: function (source) {
            const container = source.language_id + "_" + source.project_id + "_" + source.resource_id;

            return this.containerExists(container)
                .then(function (exists) {
                    source.updating = false;
                    source.exists = exists;
                    return source;
                });
        },

        validateCurrent: function (source) {
            const lang = source.language_id;
            const proj = source.project_id;
            const res = source.resource_id;
            const container = lang + "_" + proj + "_" + res;
            const manifest = path.join(resourceDir, container, "package.json");

            return this.activateProjectContainers(lang, proj, res)
                .then(function () {
                    return utils.fs.readFile(manifest)
                        .then(function (contents) {
                            const json = JSON.parse(contents);
                            source.current = json.resource.status.pub_date === source.date_modified;
                            return source;
                        });
                });
        },

        downloadContainer: function (language, project, resource) {
            return db.downloadResourceContainer(language, project, resource)
                .catch(function (err) {
                    throw err;
                });
        },

        downloadProjectContainers: function (item) {
            const mythis = this;
            const language = item.language_id || item.language.slug;
            const project = item.project_id || item.project.slug;
            const resource = item.resource_id || item.resource.slug;

            return mythis.downloadContainer(language, project, resource)
                .then(function () {
                    item.success = true;
                    return Promise.resolve(true);
                })
                .catch(function (err) {
                    let errmessage = translate("download_unknown_error");
                    if (err.syscall === "getaddrinfo") {
                        errmessage = translate("connection_error");
                    }
                    if (err.syscall === "read") {
                        errmessage = translate("read_error");
                    }
                    if (err.status === 404) {
                        errmessage = translate("source_on_server_not_found");
                    }
                    item.failure = true;
                    item.errmsg = errmessage;
                })
                .then(function () {
                    return mythis.downloadContainer(language, project, "tn")
                        .catch(function () {
                            return true;
                        });
                })
                .then(function () {
                    return mythis.downloadContainer(language, project, "tq")
                        .catch(function () {
                            return true;
                        });
                })
                .then(function () {
                    return mythis.downloadContainer(language, project, "udb")
                        .catch(function () {
                            return true;
                        });
                })
				.then(function () {
                    return mythis.downloadContainer(language, "bible", "tw")
                        .catch(function () {
                            return true;
                        });
                })
                .then(function () {
                    return item;
                });
        },

        activateContainer: function (language, project, resource) {
            const container = language + "_" + project + "_" + resource;
            const resourcePath = path.join(resourceDir, container);
            const tempPath = path.join(resourceDir, container + ".tsrc");
            const sourcePath = path.join(sourceDir, container + ".tsrc");

            return utils.fs.stat(resourcePath).then(utils.ret(true)).catch(utils.ret(false))
                .then(function (resexists) {
                    if (!resexists) {
                        return utils.fs.stat(sourcePath).then(utils.ret(true)).catch(utils.ret(false))
                            .then(function (srcexists) {
                                if (srcexists) {
                                    return utils.fs.copy(sourcePath, tempPath, {clobber: true})
                                        .then(function () {
                                            return db.openResourceContainer(language, project, resource);
                                        })
                                        .then(function () {
                                            return utils.fs.remove(tempPath);
                                        })
                                        .then(function () {
                                            return Promise.resolve(true);
                                        });
                                }
                                return Promise.resolve(translate("rc_doesnt_exist", container));
                            });
                    }
                    return Promise.resolve(true);
                })
                .catch ((error) => {
                    console.log(error);
                });
        },

        activateProjectContainers: function (language, project, resource) {
            const mythis = this;

            return mythis.activateContainer(language, project, resource)
                .then(function (msg) {
                    if (typeof msg === 'string') {
                        console.log(msg);
                    }
                })
                .then(function () {
                    return mythis.activateContainer(language, project, "tn");
                })
                .then(function () {
                    return mythis.activateContainer(language, project, "tq");
                })
                .then(function () {
                    return mythis.activateContainer(language, project, "udb");
                })
				.then(function () {
                    return mythis.activateContainer(language, "bible", "tw");
                });
        },

        extractContainer: function (container) {
            const contentpath = path.join(resourceDir, container, "content");
            const data = [];

            try {
                const alldirs = fs.readdirSync(contentpath);
                const contentdirs = alldirs.filter(function (dir) {
                    const stat = fs.statSync(path.join(contentpath, dir));
                    return stat.isDirectory();
                });

                contentdirs.forEach(function (dir) {
                    const files = fs.readdirSync(path.join(contentpath, dir));

                    files.forEach(function (file) {
                        const filename = file.split(".")[0];
                        const content = fs.readFileSync(path.join(contentpath, dir, file), 'utf8');

                        data.push({chapter: dir, chunk: filename, content: content});
                    });
                });

                return data;
            } catch (err) {
                return data;
            }
        },

        getContainerData: function (container) {
            const frames = this.extractContainer(container);
            const toc = this.parseYaml(container, "toc.yml");
            const sorted = [];

            if (toc && typeof toc === "object") {
                toc.forEach (function (chapter) {
                    if (chapter.chunks) {
                        chapter.chunks.forEach (function (chunk) {
                            const results = frames.filter(function (item) {
                                return item.chapter === chapter.chapter && item.chunk === chunk;
                            });

                            if (results.length) {
                                sorted.push(results[0]);
                            } else {
                                console.log(translate("cannot_find_data", container, chapter, chunk));
                            }
                        });
                    }
                });

                return sorted;
            } else {
                return frames;
            }
        },

        getProjectName: function (id) {
            let project;
            try {
                project = db.indexSync.getProject('en', id);
            } catch (e) {
                return "";
            }

            if (project) {
                return project.name;
            } else {
                return "";
            }
        },

		getChunkMarkers: function (id) {
            return db.indexSync.getChunkMarkers(id, 'en-US');
		},

        getSourceDetails: function (project_id, language_id, resource_id) {
            let res, lang, id;
            try {
                res = db.indexSync.getResource(language_id, project_id, resource_id);
                lang = db.indexSync.getSourceLanguage(language_id);
                id = language_id + "_" + project_id + "_" + resource_id;
            } catch (e) {
                return null;
            }

            if (!res || !lang) {
                return null;
            }

            return {
                unique_id: id,
                language_id: language_id,
                resource_id: resource_id,
                checking_level: res.status.checking_level,
                date_modified: res.status.pub_date,
                version: res.status.version,
                project_id: project_id,
                resource_name: res.name,
                language_name: lang.name,
                direction: lang.direction
            }
        },

        getSourceUdb: function (source) {
            const container = source.language_id + "_" + source.project_id + "_udb";

            return this.extractContainer(container);
        },

        getSourceNotes: function (source) {
            const mythis = this;
            const container = source.language_id + "_" + source.project_id + "_tn";

            const frames = this.extractContainer(container);

            frames.forEach(function (item) {
                if (item.content) {
                    item.content = mythis.parseHelps(item.content);
                }
            });

            return frames;
        },

        getSourceQuestions: function (source) {
            const mythis = this;
            const container = source.language_id + "_" + source.project_id + "_tq";

            const frames = this.extractContainer(container);

            frames.forEach(function (item) {
                if (item.content) {
                    item.content = mythis.parseHelps(item.content);
                }
            });

            return frames;
        },

        getSourceWords: function (source) {
            const container = source.language_id + "_" + source.project_id + "_" + source.resource_id;
            const words = this.parseYaml(container, "config.yml");

            if (words && words.content) {
                return words.content;
            } else {
                return [];
            }
        },

        parseHelps: function (content) {
            const array = [];
            const contentarray = content.split("\n\n");

            for (let i = 0; i < contentarray.length; i++) {
                array.push({title: contentarray[i].replace(/^#/, ''), body: contentarray[i+1]});
                i++;
            }

            return array;
        },

        parseYaml: function (container, filename) {
            const filepath = path.join(resourceDir, container, "content", filename);

            try {
                const file = fs.readFileSync(filepath, "utf8");
                return yaml.load(file, 'utf8');
            } catch (e) {
                console.log("Cannot read file:", filepath);
                return null;
            }
        },

        getRelatedWords: function (source, slug) {
            const mythis = this;
            let dict = "bible";
            if (source.resource_id === "obs") {
                dict = "bible-obs";
            }
            const container = source.language_id + "_" + dict + "_tw";
            const list = this.parseYaml(container, "config.yml");

            if (list && list[slug] && list[slug]["see_also"]) {
                const slugs = list[slug]["see_also"];

                return slugs.map(function (item) {
                    return mythis.getWord(source.language_id, dict, item);
                });
            } else {
                return [];
            }
        },

        getWord: function (language_id, dict, slug) {
            const container = language_id + "_" + dict + '_tw';
            const contentpath = path.join(resourceDir, container, "content", slug, "01.md");

            try {
                const data = this.parseHelps(fs.readFileSync(contentpath, 'utf8'))[0];
                data.slug = slug;
                return data;
            } catch (err) {
                return null;
            }
        },

        getAllWords: function (language_id, dict) {
            const mythis = this;
            const container = language_id + "_" + dict + "_tw";
            const frames = this.extractContainer(container);

            return frames.map(function (item) {
                const data = mythis.parseHelps(item.content)[0];
                data.slug = item.chapter;
                return data;
            });
        },

        getWordExamples: function (source, slug) {
            let dict = "bible";
            if (source.resource_id === "obs") {
                dict = "bible-obs";
            }
            const container = source.language_id + "_" + dict + "_tw";
            const list = this.parseYaml(container, "config.yml");

            if (list && list[slug] && list[slug]["examples"]) {
                const references = list[slug]["examples"];

                return references.map(function (item) {
                    const split = item.split("-");
                    return {chapter: parseInt(split[0]), frame: parseInt(split[1])};
                });
            } else {
                return [];
            }
        },
    };
}

module.exports.DataManager = DataManager;
