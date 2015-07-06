/**
 * Created by Emmitt on 6/26/2015.
 */
/* settings
 * TODO: Hook to configurator once it is done
 * */
var logPath = './';
var logName = 'log.txt';
var oauth_token = '';
var repoOwner = 'unfoldingWord-dev';
var repo = 'ts-desktop';
var maxLogFileKbs = 200;

var version = require('../../package.json').version;
var fs = require('fs');
var os = require('os');
var https = require('https');

var reporter = {
    logNotice: function(string) {
        'use strict';
        if(!string){
            throw new Error('reporter.logNotice requires a message.');
        }
        reporter.toLogFile('I', string);
    },

    logWarning: function(string) {
        'use strict';
        if(!string){
            throw new Error('reporter.logWarning requires a message.');
        }
        reporter.toLogFile('W', string);
    },

    logError: function(string) {
        'use strict';
        if(!string){
            throw new Error('reporter.logError requires a message.');
        }
        reporter.toLogFile('E', string);
    },

    reportBug: function(string, callback) {
        'use strict';
        if(!string){
            throw new Error('reporter.reportBug requires a message.');
        }
        reporter.formGithubIssue('Bug Report', string, function(res){
            if(callback){
                callback(res);
            }
        });
    },

    reportCrash: function(string, callback) {
        'use strict';
        reporter.formGithubIssue('Crash Report', string, function(res){
            if(callback){
                callback(res);
            }
        });
    },

    stackTrace: function () {
        'use strict';
        var err = new Error();
        return err.stack;
    },

    toLogFile: function(level, string){
        'use strict';
        /* We make 3 calls before processing who called the original
         *  log command; therefore, the 4th call will be the original caller.
         * */
        var location = reporter.stackTrace().split('\n')[4];
        try {
            location = location.split(/(\\|\/)/);
            location = location[location.length-1];
            location = location.substr(0,location.length-1);
        }
        catch(e){
            throw new Error(e.message);
        }
        var date = new Date();
        date = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        var message = date + ' ' + level + '/' + location + ': ' + string + '\r\n';
        fs.appendFile(logPath+logName, message, function(err) {
            if(err){throw new Error(err.message);}
        });
        reporter.truncateLogFile();
    },

    stringFromLogFile: function(callback){
        'use strict';
        fs.exists(logPath+logName, function(exists){
            if(exists) {
                fs.readFile(logPath + logName, {encoding: 'utf8'}, function (err, data) {
                    if (err){
                        callback('Could read log file. ERRNO: ' + err.number);
                        throw new Error(err.message);
                    }
                    callback(data);
                });
            }
            else{
                callback('No log file.');
            }
        });
    },

    truncateLogFile: function(){
        'use strict';
        fs.stat(logPath+logName, function(err, stats){
            if(stats){
                var kb = stats.size/1024;
                if(kb >= maxLogFileKbs){
                    reporter.stringFromLogFile(function(res) {
                        res = res.split('\n');
                        res = res.slice(res.length/2, res.length-1);
                        res = res.join('\n');
                        fs.unlink(logPath+logName, function(){
                            fs.appendFile(logPath+logName, res, function(err){
                                if(err){throw new Error(err.message);}
                            });
                        });
                    });
                }
            }
        });
    },

    formGithubIssue: function(type, string, callback){
        'use strict';
        var issueObject = {};
        issueObject.user = repoOwner;
        issueObject.repo = repo;
        issueObject.labels = [type, version];
        if(string){
            if(string.length > 30) {
                issueObject.title = string.substr(0, 29) + '...';
            }
            else{
                issueObject.title = string;
            }
        }
        else{
            issueObject.title = type;
        }

        var bodyBuilder = [];
        /* user notes */
        if(string) {
            bodyBuilder.push('Notes\n======');
            bodyBuilder.push(string);
        }
        /* generated notes */
        bodyBuilder.push('\nEnvironment\n======');
        bodyBuilder.push('Version: ' + version);
        bodyBuilder.push('Operation System: ' + os.type());
        bodyBuilder.push('Platform: ' + os.platform());
        bodyBuilder.push('Release: ' + os.release());
        bodyBuilder.push('Architecture: ' + os.arch());
        if(type === 'Crash Report') {
            bodyBuilder.push('\nStack Trace\n======');
            bodyBuilder.push(reporter.stackTrace());
        }
        bodyBuilder.push('\nLog History\n======');
        reporter.stringFromLogFile(function(results){
            bodyBuilder.push(results);
            issueObject.body = bodyBuilder.join('\n');
            reporter.sendIssueToGithub(issueObject, function(res){
                if(callback){
                    callback(res);
                }
            });
        });
    },

    sendIssueToGithub: function(issue, callback){
        'use strict';
        var params = {};
        params.title = issue.title;
        params.body = issue.body;
        params.labels = issue.labels;
        var paramsJson = JSON.stringify(params);

        var urlPath = '/repos/' + issue.user + '/' + issue.repo + '/issues';
        var post_options = {
            host: 'api.github.com',
            port: 443,
            path: urlPath,
            method: 'POST',
            headers: {
                'User-Agent': 'ts-desktop',
                'Content-Type': 'application/json',
                'Content-Length': paramsJson.length,
                'Authorization': 'token ' + oauth_token
            }
        };

        var post_req = https.request(post_options, function(res){
            res.setEncoding('utf8');
            var completeData = '';
            res.on('data', function(partialData) {
                completeData += partialData;
            }).on('end', function(){
                if(callback){
                    callback(res);
                }
            });
        }).on('error', function (err) {
            throw new Error(err.message);
        });
        post_req.write(paramsJson);
        post_req.end();
    }
};

exports.logNotice = reporter.logNotice;
exports.logWarning = reporter.logWarning;
exports.logError = reporter.logError;
exports.reportBug = reporter.reportBug;
exports.reportCrash = reporter.reportCrash;
exports.stringFromLogFile = reporter.stringFromLogFile;