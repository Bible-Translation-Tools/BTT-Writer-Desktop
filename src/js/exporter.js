'use strict';

const _ = require('lodash'),
    path = require('path'),
    AdmZip = require('adm-zip'),
    utils = require('../js/lib/utils');

function ExportManager(configurator, git, reporter, translate) {

    const targetDir = configurator.getValue('targetTranslationsDir');

    return {

        backupTranslation: function (meta, filePath) {
            if(filePath.split('.').pop() !== 'tstudio') {
                filePath += '.tstudio';
            }
            const paths = utils.makeProjectPaths(targetDir, meta);
            const name = meta.unique_id;

            return git.getHash(paths.projectDir)
                .then(function (hash) {
                    const manifest = {
                        generator: {
                            name: 'ts-desktop',
                            build: ''
                        },
                        package_version: 2,
                        timestamp: new Date().getTime(),
                        target_translations: [{path: name, id: name, commit_hash: hash, direction: meta.target_language.direction}]
                    };

                    const zip = new AdmZip(undefined, {});
                    zip.addLocalFolder(paths.projectDir, name);
                    const manifestContent = JSON.stringify(manifest, null, '\t');
                    zip.addFile("manifest.json", Buffer.from(manifestContent));
                    return new Promise((resolve, reject) => {
                        zip.writeZip(filePath, (err) => {
                            if (err) {
                                reporter.logError(err);
                                reject(err);
                            } else {
                                configurator.setValue('last_backup_' + meta.unique_id, utils.getTimeStamp());
                                resolve(filePath);
                            }
                        });
                    });
                })
                .catch(function (err) {
                    throw "Error creating backup: " + (err && err.error && err.error.message) || err;
                });
        },

        backupAllTranslations: function (list) {
            const mythis = this;
            const autoBackupDir = configurator.getUserPath('datalocation', 'automatic_backups');
            const backupDir = configurator.getUserPath('datalocation', 'backups');

            return utils.fs.mkdirs(autoBackupDir)
                .then(function () {
                    return utils.fs.mkdirs(backupDir);
                })
                .catch(function () {
                    throw translate("backup_location_not_found");
                })
                .then(function () {
                    return Promise.all(
                        _.map(list, function(projectmeta) {
                            const filepath = path.join(autoBackupDir, projectmeta.unique_id + ".tstudio");
                            return mythis.backupTranslation(projectmeta, filepath);
                        })
                    );
                });
        },

        autoBackupTranslation: function (meta) {
            const mythis = this;
            const autoBackupDir = configurator.getUserPath('datalocation', 'automatic_backups');
            const filePath = path.join(autoBackupDir, meta.unique_id + ".tstudio");

            return utils.fs.mkdirs(autoBackupDir)
                .catch(function () {
                    throw translate("backup_location_not_found");
                })
                .then(function () {
                    return mythis.backupTranslation(meta, filePath);
                });
        },

        exportTranslation: function (translation, meta, filePath, mediaServer) {
            return new Promise(function(resolve, reject) {
                if (meta.project_type_class === "standard") {

                    if (meta.format === 'markdown') {
                        if(filePath.split('.').pop() !== 'zip') {
                            filePath += '.zip';
                        }
                        let chapterContent = '',
                            currentChapter = -1,
                            zip = new AdmZip(undefined, {}),
                            numFinishedFrames = 0;

                        for(let frame of translation) {
                            // close chapter
                            if(frame.chunkmeta.chapter !== currentChapter) {
                                if(chapterContent !== '' && numFinishedFrames > 0) {
                                    // TODO: we need to get the chapter reference and insert it here
                                    chapterContent += '////\n';
                                    //console.log('chapter ' + currentChapter, chapterContent);
                                    zip.addFile(currentChapter + '.md', Buffer.from(chapterContent));
                                }
                                currentChapter = frame.chunkmeta.chapter;
                                chapterContent = '';
                                numFinishedFrames = 0;
                            }

                            if(frame.transcontent !== '') {
                                numFinishedFrames ++;
                            }

                            // build chapter header
                            if(chapterContent === '') {
                                chapterContent += '//\n';
                                chapterContent += meta.target_language.name + '\n';
                                chapterContent += '//\n\n';

                                chapterContent += '//\n';
                                chapterContent += meta.project.name + '\n';
                                chapterContent += '//\n\n';

                                chapterContent += '//\n';
                                chapterContent += frame.chunkmeta.title + '\n';
                                chapterContent += '//\n\n';
                            }

                            // add frame
                            chapterContent += '{{' + mediaServer + meta.project.id + '/jpg/1/en/360px/' + meta.project.id + '-' + meta.target_language.id + '-' + frame.chunkmeta.chapterid + '-' + frame.chunkmeta.frameid + '.jpg}}\n\n';
                            chapterContent += frame.transcontent + '\n\n';
                        }
                        if(chapterContent !== '' && numFinishedFrames > 0) {
                            // TODO: we need to get the chapter reference and insert it here
                            chapterContent += '////\n';
                            zip.addFile(currentChapter + '.md', Buffer.from(chapterContent));
                        }

                        zip.writeZip(filePath, err => err ? reject(err) : resolve(true));
                    } else if (meta.format === 'usfm') {
                        if(filePath.split('.').pop() !== 'usfm') {
                            filePath += '.usfm';
                        }

                        let content = "";
                        let currentChapter = 0;

                        // Use first element from the translation array as a book meta
                        const bookTranslation = translation[0];
                        const bookTitle = bookTranslation.transcontent || meta.project.name;

                        content += "\\id " + meta.project.id + " " + meta.resource.name + "\n";
                        content += "\\ide " + meta.format + "\n";
                        content += "\\h " + bookTitle + "\n";
                        content += "\\toc1 " + bookTitle + "\n";
                        content += "\\toc2 " + bookTitle + "\n";
                        content += "\\toc3 " + meta.project.id + "\n";
                        content += "\\mt " + bookTitle + "\n";

                        translation.forEach(function (chunk, index) {
                            // Skip first element, because it's a book title
                            // and we don't want to render it as a chapter contents
                            if (index === 0) return;

                            if (chunk.chunkmeta.chapter > 0) {
                                if (chunk.chunkmeta.chapter !== currentChapter) {
                                    content += "\\c " + chunk.chunkmeta.chapter + "\n";
                                    currentChapter = chunk.chunkmeta.chapter;
                                }
                                if (chunk.chunkmeta.frame === 0) {
                                    if (chunk.transcontent) {
                                        // Write chapter label to \cl marker
                                        content += "\\cl " + chunk.transcontent + "\n";
                                    }
                                    content += "\\p\n";
                                    return;
                                }
                                if (chunk.transcontent) {
                                    const text = chunk.transcontent;
                                    let start = 0;
                                    let keepsearching = true;
                                    while (keepsearching) {
                                        const end = text.indexOf("\\v", start + 2);
                                        if (end === -1) {
                                            keepsearching = false;
                                            content += text.substring(start).trim() + "\n";
                                        } else {
                                            content += text.substring(start, end).trim() + "\n";
                                            start = end;
                                        }
                                    }
                                }
                            }
                        });

                        utils.fs.outputFile(filePath, content).then(function () {
                            resolve(true);
                        }).catch(function (err) {
                            reject(err);
                        });
                    } else {
                        reject(translate("project_export_format_not_supported"));
                    }
                } else {
                    // TODO: support exporting other target translation types if needed e.g. notes, words, questions
                    reject(translate("project_export_type_not_supported"));
                }
            });
        },
    };
}

module.exports.ExportManager = ExportManager;
