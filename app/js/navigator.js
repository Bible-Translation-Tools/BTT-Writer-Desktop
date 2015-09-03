// navigator module

;(function () {
    'use strict';

    let Downloader = require('./downloader').Downloader;
    let Indexer = require('./indexer').Indexer;
    let async = require('async');

    function Navigator () {
        // used to maintain state while performing async operations
        let asyncState = {
            availableUpdates: {}
        };

        let config = {
            asyncLimit: App.configurator.getValue('asyncLimit')
        };

        // create indexes
        let indexConfig = {
            apiUrl: App.configurator.getValue('apiUrl'),
            indexDir: App.configurator.getValue('indexDir')
        };
        let downloadIndex = new Indexer('downloads', indexConfig);
        let serverIndex = new Indexer('server', indexConfig);
        let appIndex = new Indexer('app', indexConfig);

        // create downloader
        let downloader = new Downloader(downloadIndex, {
            apiUrl: App.configurator.getValue('apiUrl')
        });

        let downloadResourceList = function (projectId, sourceLanguageId, done) {
            let promise = downloader.downloadResourceList(projectId, sourceLanguageId);
            promise.then(function () {
                for (let resourceId of downloadIndex.getResources(projectId, sourceLanguageId)) {
                    let latestResourceModified = downloadIndex.getResource(projectId, sourceLanguageId, resourceId)['date_modified'];
                    // TRICKY: we must use the app index to check for updates
                    let localResource = appIndex.getResource(projectId, sourceLanguageId, resourceId);
                    let localResourceModified = null;
                    if (localResource !== null) {
                        localResourceModified = localResource['date_modified'];
                    }
                    if (localResourceModified === null || parseInt(localResourceModified) < parseInt(latestResourceModified)) {
                        // build update list
                        if (typeof asyncState.availableUpdates[projectId] === 'undefined') {
                            asyncState.availableUpdates[projectId] = [];
                        }
                        if (typeof asyncState.availableUpdates[projectId][sourceLanguageId] === 'undefined') {
                            asyncState.availableUpdates[projectId][sourceLanguageId] = [];
                        }
                        asyncState.availableUpdates[projectId][sourceLanguageId].push(resourceId);
                    }
                }
                done();
            });
            promise.catch(function (err) {
                App.reporter.logWarning(err.message + ': Could not download the resource list for ' + projectId + ':' + sourceLanguageId);
                done();
            });
        };

        let downloadSourceLanguageList = function (projectId, done) {

            let promise = downloader.downloadSourceLanguageList(projectId);
            promise.then(function () {
                // queue resource downloads
                let queue = async.queue(function (task, callback) {
                    downloadResourceList(task.projectId, task.sourceLanguageId, callback);
                }, config.asyncLimit);
                queue.drain = function () {
                    done();
                };
                for (let sourceLanguageId of downloadIndex.getSourceLanguages(projectId)) {
                    let latestSourceLanguageModified = downloadIndex.getSourceLanguage(projectId, sourceLanguageId)['date_modified'];
                    let lastSourceLanguage = serverIndex.getSourceLanguage(projectId, sourceLanguageId);
                    let lastSourceLanguageModified = null;
                    if (lastSourceLanguage !== null) {
                        lastSourceLanguageModified = lastSourceLanguage['date_modified'];
                    }
                    if (lastSourceLanguageModified === null || parseInt(lastSourceLanguageModified) < parseInt(latestSourceLanguageModified)) {
                        queue.push({
                            projectId: projectId,
                            sourceLanguageId: sourceLanguageId
                        });
                    }
                }
                if (queue.length() === 0) {
                    done();
                }
            });
            promise.catch(function (err) {
                App.reporter.logWarning(err.message + ': Could not download the source language list for ' + projectId);
                done();
            });
        };

        let navigator = {
            /**
             * Returns an index of the server library
             */
            getServerLibraryIndex: function () {
                return new Promise(function (resolve, reject) {
                    let promise = downloader.downloadProjectList();
                    promise.then(function () {
                        // queue source language downloads
                        let queue = async.queue(function (task, callback) {
                            downloadSourceLanguageList(task.projectId, callback);
                        }, config.asyncLimit);
                        queue.drain = function () {
                            serverIndex.mergeIndex(downloadIndex);
                            resolve(serverIndex, asyncState.availableUpdates);
                        };
                        for (let projectId of downloadIndex.getProjects()) {
                            let latestProjectModified = downloadIndex.getProject(projectId)['date_modified'];
                            let lastProject = serverIndex.getProject(projectId);
                            let lastProjectModified = null;
                            if (lastProject !== null) {
                                lastProjectModified = lastProject['date_modified'];
                            }
                            if (lastProjectModified === null || parseInt(lastProjectModified) < parseInt(latestProjectModified)) {
                                queue.push({projectId: projectId});
                            }
                        }
                        if (queue.length() === 0) {
                            resolve(serverIndex, asyncState.availableUpdates);
                        }
                    });
                    promise.catch(function (err) {
                        App.reporter.logWarning(err.message + ': Could not download project list');
                        reject();
                    });
                });
            },

            /**
             * Returns a list of data to populate the list of projects the user can choose from
             */
            getProjectListData: function (callback) {
                // TODO: load data and return to callback
                callback();
            },

            /**
             * Returns a list of data to populate the list of chapters the user can choose from
             * @param callback
             */
            getChapterListData: function (callback) {
                // TODO: load data and return to callback
                callback();
            },

            /**
             * Returns a list of data to populate the list of frames the user can choose from
             * @param callback
             */
            getFrameListData: function (callback) {
                // TODO: load data and return to callback
                callback();
            }
        };
        return navigator;
    }

    exports.Navigator = Navigator;
}());
