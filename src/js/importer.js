'use strict';

var _ = require('lodash');
var path = require('path');
var AdmZip = require('adm-zip');
var request = require('request');
var fs = require('fs');
var readline = require('readline');
var utils = require('../js/lib/utils');

function ImportManager(configurator, migrator, dataManager) {

    return {

        extractBackup: function(filePath) {
            var mythis = this;
            var tmpDir = configurator.getValue('tempDir');
            var targetDir = configurator.getValue('targetTranslationsDir');
            var basename = path.basename(filePath, '.tstudio');
            var extractPath = path.join(tmpDir, basename);

            return migrator.listTargetTranslations(filePath)
                .then(function(targetPaths) {
                    var zip = new AdmZip(filePath);

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
                        throw new Error (mythis.translate("could_not_restore_project"));
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
                        var tmpPath = path.join(extractPath, p),
                            targetPath = path.join(targetDir, p);

                        return utils.fs.stat(targetPath).then(utils.ret(true)).catch(utils.ret(false))
                            .then(function (exists) {
                                return {tmpPath: tmpPath, targetPath: targetPath, targetExists: exists};
                            });
                    });
                })
                .catch(function (err) {
                    throw mythis.translate("extract_file_error", err);
                })
                .then(Promise.all.bind(Promise));
        },

        retrieveUSFMProjectID: function (filepath) {
            var id = "";

            return new Promise(function (resolve, reject) {
                var lineReader = readline.createInterface({
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
            var mythis = this;
            var parser = new UsfmParser();

            return parser.load(filepath)
                .then(function () {
                    var parsedData = parser.parse();

                    if (JSON.stringify(parsedData) === JSON.stringify({})) {
                        throw new Error(mythis.translate("not_valid_usfm_file"));
                    }
                    var chunks = [];
                    var markers = dataManager.getChunkMarkers(projectmeta.project.id);
                    var lastLabeledChapter = null;

                    for (var i = 0; i < markers.length; i++) {
                        var frameid = markers[i].verse;
                        var first = parseInt(frameid);
                        var chapter = markers[i].chapter;
                        var isLastChunkOfChapter = !markers[i+1] || markers[i+1].chapter !== chapter;
                        var last = isLastChunkOfChapter ? Number.MAX_VALUE : parseInt(markers[i+1].verse) - 1;

                        if (parsedData[chapter]) {
                            var transcontent = _.chain(parsedData[chapter].verses).filter(function (verse) {
                                var id = parseInt(verse.id);
                                return id <= last && id >= first;
                            }).map("contents").value().join(" ");

                            chunks.push({
                                chunkmeta: {
                                    chapterid: chapter,
                                    frameid: frameid
                                },
                                transcontent: transcontent.trim(),
                                completed: false
                            });
                            
                            if (parsedData[chapter].verses.title && lastLabeledChapter !== chapter) {
                                var title = parsedData[chapter].verses.title.contents.trim();
                                chunks.unshift({
                                    chunkmeta: {
                                        chapterid: chapter,
                                        frameid: "title"
                                    },
                                    transcontent: title,
                                    completed: false
                                });
                                lastLabeledChapter = chapter;
                            }
                        }
                    }

                    if (parsedData['front'] && parsedData['front'].contents) {
                        chunks.unshift({
                            chunkmeta: {
                                chapterid: 'front',
                                frameid: 'title'
                            },
                            transcontent: parsedData['front'].contents.trim(),
                            completed: false
                        });
                    }
                    return chunks;
                })
                .catch(function (err) {
                    throw mythis.translate("parse_file_error", err);
                });
        },

        translate: function (key, ...args) {
            return App.locale.translate(key, ...args);
        },
    };
}

function UsfmParser () {
    this.contents = [];

    var markerTypes = {
        id: {
            regEx: /\\id/,
            hasOptions: false,
            type: "id"
        },
        encoding: {
            regEx: /\\ide/,
            hasOptions: false,
            type: "encoding"
        },
        majorTitle: {
            regEx: /\\mt[0-9]*/,
            hasOptions: false,
            type: "majorTitle"
        },
        heading: {
            regEx: /\\h[0-9]*/,
            hasOptions: false,
            type: "heading"
        },
        chapterLabel: {
            regEx: /\\cl/,
            hasOptions: false,
            type: "chapterLabel"
        },
        chapter: {
            regEx: /\\c/,
            hasOptions: true,
            type: "chapter"
        },
        verse: {
            regEx: /\\v/,
            hasOptions: true,
            type: "verse"
        },
        sectionHeading: {
            regEx: /\\s[0-9]*/,
            hasOptions: false,
            type: "sectionHeading"
        },
        paragraph: {
            regEx: /\\p/,
            hasOptions: false,
            type: "paragraph"
        },
        tableOfContents: {
            regEx: /\\toc[0-2]*/,
            hasOptions: false,
            type: "tableOfContents"
        }
    };

    var getMarker = function (line) {
        var beginMarker = line.split(" ")[0];
        for (var type in markerTypes) {
            if (markerTypes[type].regEx.test(beginMarker)) {
                return markerTypes[type];
            }
        }
        return false;
    };

    var mythis = this;

    return {
        load: function (file) {
            mythis.file = file;

            return new Promise(function (resolve, reject) {

                var lineReader = readline.createInterface({
                    input: fs.createReadStream(mythis.file, {encoding: "utf8"})
                });

                lineReader.on('line', function (line) {
                    if (line) {
                        mythis.contents.push(line);
                    }
                });

                lineReader.on('close', function() {
                    resolve(mythis);
                });
            });
        },

        parse: function(){
            this.getMarkers();
            return this.buildChapters();
        },

        getMarkers: function () {
            mythis.markers = [];
            mythis.markerCount = 0;
            var currentMarker = null;
            for (var i = 0; i < mythis.contents.length; i++) {
                var line = mythis.contents[i];
                var lineArray = line.split(" ");
                for (var c = 0; c < lineArray.length; c++) {
                    var section = lineArray[c];
                    var marker = getMarker(section);

                    if (marker) {
                        mythis.markers[mythis.markerCount] = {
                            type: marker.type,
                            line: line,
                            contents: ""
                        };
                        if (marker.hasOptions) {
                            mythis.markers[mythis.markerCount].options = lineArray[c + 1];
                            c++;
                        }
                        currentMarker = mythis.markers[mythis.markerCount];
                        if (marker.type === "verse") {
                            currentMarker.contents = section + " " + currentMarker.options + " ";
                        }
                        mythis.markerCount++;
                    } else {
                        if (currentMarker) {
                            currentMarker.contents += section + " ";
                        }
                    }
                }
            }
        },

        buildChapters: function () {
            mythis.chapters = {};
            var chap;
            var chapnum = 0;
            var lastverse = 100;
            var globalChapterLabel = null;
            var localChapterLabel = null;

            var createchapter = function (chapnum) {
                chap = chapnum.toString();
                if (chap.length === 1) {
                    chap = "0" + chap;
                }
                mythis.chapters[chap] = {
                    id: chap,
                    verses: {}
                };
            };

            mythis.markers.forEach(function (marker) {
                if (marker.type === "heading" && chapnum === 0) {
                    createchapter("front");
                    mythis.chapters[chap].contents = marker.contents.trim();
                } else if (marker.type === "chapterLabel") {
                    if (chap === "front") {
                        globalChapterLabel = marker.contents.trim();
                    } else {
                        localChapterLabel = marker.contents.trim();
                    }
                } else if (marker.type === "chapter") {
                    chapnum = parseInt(marker.options);
                    createchapter(chapnum);
                    lastverse = 0;
                    localChapterLabel = null;
                } else if (marker.type === "verse") {
                    if ((globalChapterLabel || localChapterLabel) && !mythis.chapters[chap].verses.title) {
                        const label = localChapterLabel ? localChapterLabel : globalChapterLabel + " " + chapnum;
                        mythis.chapters[chap].verses["title"] = {
                            id: "title",
                            contents: label
                        };
                    }
                    
                    const thisverse = parseInt(marker.options);

                    if (thisverse < lastverse) {
                        chapnum++;
                        createchapter(chapnum);
                    }
                    lastverse = thisverse;

                    mythis.chapters[chap].verses[marker.options] = {
                        id: marker.options,
                        contents: marker.contents.trim()
                    };
                }
            });

            return mythis.chapters;
        }
    }
}

module.exports.ImportManager = ImportManager;
module.exports.UsfmParser = UsfmParser;
