'use strict';

const _ = require('lodash');
const path = require('path');
const AdmZip = require('adm-zip');
const fs = require('fs');
const readline = require('readline');
const utils = require('../js/lib/utils');
const {USFMParser, USFMRenderer, HMarker, CLMarker, CMarker, VMarker} = require("usfmtools");

const chunkRenderer = new USFMRenderer({
    unwrapWordEntries: true,
    excludeMarkers: ["s"]
});

function ImportManager(configurator, migrator, dataManager, translate) {

    return {

        extractBackup: function(filePath) {
            const tmpDir = configurator.getValue('tempDir');
            const targetDir = configurator.getValue('targetTranslationsDir');
            const basename = path.basename(filePath, '.tstudio');
            const extractPath = path.join(tmpDir, basename);

            return migrator.listTargetTranslations(filePath)
                .then(function(targetPaths) {
                    const zip = new AdmZip(filePath, {});

                    zip.extractAllTo(extractPath, true);
                    return targetPaths;
                })
                .then(function (targetPaths) {
                    return _.map(targetPaths, function (targetPath) {
                        return utils.makeProjectPaths(extractPath, targetPath);
                    });
                })
                .then(migrator.migrateAll.bind(migrator))
                .then(function (results) {
                    if (!results.length) {
                        throw new Error (translate("could_not_restore_project"));
                    }
                    return results;
                })
                .then(function (results) {
                    return _.map(results, function (result) {
                        return result.paths.projectDir.substring(result.paths.projectDir.lastIndexOf(path.sep) + 1);
                    });
                })
                .then(function (targetPaths) {
                    return _.map(targetPaths, function(p) {
                        const tmpPath = path.join(extractPath, p),
                            targetPath = path.join(targetDir, p);

                        return utils.fs.stat(targetPath).then(utils.ret(true)).catch(utils.ret(false))
                            .then(function (exists) {
                                return {tmpPath: tmpPath, targetPath: targetPath, targetExists: exists};
                            });
                    });
                })
                .catch(function (err) {
                    throw translate("extract_file_error", err);
                })
                .then(Promise.all.bind(Promise));
        },

        retrieveUSFMProjectID: function (filepath) {
            let id = "";

            return new Promise(function (resolve, reject) {
                const lineReader = readline.createInterface({
                    input: fs.createReadStream(filepath)
                });
                lineReader.on('line', function (line) {
                    if (line && line.trim().split(" ")[0] === "\\id") {
                        id = line.trim().split(" ")[1].toLowerCase();
                        lineReader.close();
                    }
                });
                lineReader.on('close', function(){
                    resolve(id);
                });
            });
        },

        importFromUSFM: function (filepath, projectmeta) {
            return new Promise((resolve) => {
                const parser = new USFMParser(null, true, true);
                const contents = fs.readFileSync(filepath, "utf-8");
                resolve(parser.parseFromString(contents.toString()));
            })
                .then(document => {
                    if (document.contents.length === 0) {
                        throw new Error(translate("not_valid_usfm_file"));
                    }

                    const chapters = document.getChildMarkers(CMarker);
                    const chunks = [];
                    const markers = dataManager.getChunkMarkers(projectmeta.project.id);

                    const heading = document.getChildMarkers(HMarker)[0];
                    if (heading) {
                        chunks.push({
                            chunkmeta: {
                                chapterid: "front",
                                frameid: "title"
                            },
                            transcontent: heading.headerText,
                            completed: false
                        })
                    }

                    for (let i = 0; i < markers.length; i++) {
                        const chapter = markers[i].chapter;
                        const frameId = markers[i].verse;
                        const isLastChunkOfChapter = !markers[i + 1] || markers[i + 1].chapter !== chapter;
                        const first = parseInt(frameId);
                        const last = isLastChunkOfChapter ? Number.MAX_VALUE : parseInt(markers[i + 1].verse) - 1;

                        const chapterObj = chapters.find(c => {
                            let chap = c.number.toString();
                            if (chap.length === 1) {
                                chap = "0" + chap;
                            }
                            return chap === chapter
                        });

                        if (chapterObj) {
                            const chapterLabel = chapterObj.getChildMarkers(CLMarker)[0];
                            if (chapterLabel) {
                                chunks.push({
                                    chunkmeta: {
                                        chapterid: chapter,
                                        frameid: "title"
                                    },
                                    transcontent: chapterLabel.label,
                                    completed: false
                                });
                            }

                            const verses = chapterObj.getChildMarkers(VMarker);
                            let transContent = _.chain(verses).filter(function (verse) {
                                return verse.endingVerse <= last && verse.startingVerse >= first;
                            }).map(v => chunkRenderer.render(v)).value().join(" ");

                            if (verses.length > 0 && first === 1) {
                                // Retrieve markers that precede the first verse marker
                                // so we can prepend their contents in the first chunk
                                const siblingsBefore = verses[0].getSiblingsBefore(chapterObj);
                                let contentsBefore = ""
                                for (const marker of siblingsBefore) {
                                    if (marker instanceof CMarker) continue;
                                    if (marker instanceof CLMarker) continue;
                                    contentsBefore += chunkRenderer.render(marker)
                                }
                                transContent = contentsBefore + transContent;
                            }

                            chunks.push({
                                chunkmeta: {
                                    chapterid: chapter,
                                    frameid: frameId
                                },
                                transcontent: transContent.trim(),
                                completed: false
                            });
                        }
                    }

                    return chunks;
                })
                .catch(function (err) {
                    throw translate("parse_file_error", err);
                });
        },
    };
}

module.exports.ImportManager = ImportManager;
