'use strict';

const os = require('os');
const https = require('https');
const utils = require('./lib/utils');
const path = require('path');
const moment = require('moment');
const appVersion = require('../../package.json').version;

/**
 * Reporter to save logs and send reports to the helpdesk
 * @param {object} options
 * @param {string} [options.configurator]           Configurator instance to get the options from settings
 * @param {string} [options.logPath]                Path to the log file
 * @param {string} [options.maxLogFileKb]           Maximum size of the log file in KB
 * @param {boolean} [options.verbose]               Verbose logging
 * @param {string} [options.helpdeskToken]          Helpdesk token
 * @param {string} [options.defaultSenderEmail]     Default sender email if user didn't specify theirs
 * @returns {Reporter}
 * @constructor
 */
function Reporter (options) {

    options = options || {};

    const _this = this;
    const configurator = options.configurator || null;

    const configLogPath = configurator && path.join(configurator.getValue('rootDir'), 'log.txt');

    const logPath = path.normalize(configLogPath || options.logPath || "./log.txt");
    const maxLogFileKb = configurator && configurator.getValue('maxLogFileKb') || options.maxLogFileKb || 200;
    const verbose = options.verbose || false;
    const helpdeskToken = configurator && configurator.getValue('helpdeskToken') || options.helpdeskToken || '';
    const defaultSenderEmail = options.defaultSenderEmail || 'bttwriter-desktop-feedback@techadvancement.com';

    const HELPDESK_HOST = 'helpdesk.techadvancement.com';
    const HELPDESK_PATH_PREFIX = '/wp-json/fluent-support/v2/public/incoming_webhook/';

    const getUserLogin = () => {
        const userdata = configurator.getValue('userdata');
        return userdata && userdata.username || '';
    };

    const getSelectedServer = () => {
        return configurator.getUserSetting("serversuite").name || '';
    };

    const convertError = function (err) {
        if (!err) return '';

        const indentLines = function (s) {
            return s.split('\n').map(function (line) {
                return '\t' + line;
            }).join('\n');
        };

        const shouldStringify = Array.isArray(err) || err.toString() === '[object Object]';
        const converted = shouldStringify ? JSON.stringify(err, null, 2) : err.toString();

        return indentLines(converted);
    };

    const addTitle = function (err, title) {
        const shouldHaveNewLine = !!err;
        const pre = (title || '') + (shouldHaveNewLine ? '\n' : '');
        return pre + err;
    };

    const makeMessage = function (err, title) {
        const e = convertError(err);
        return addTitle(e, title);
    };

    const log = function (level, err, title, caller) {
        err = err || '';

        const msg = makeMessage(err, title);

        if (typeof caller === 'string') {
            return _this.toLogFile(level, msg, 0, caller);
        }
        return _this.toLogFile(level, msg, caller || 0);
    };

    _this.logWarning = log.bind(_this, 'W');
    _this.logError = log.bind(_this, 'E');
    _this.logNotice = log.bind(_this, 'I');

    _this.logWithCaller = function (level, err, title, callerLocation) {
        return log(level, err, title, callerLocation);
    };

    _this.clearLog = function () {
        return utils.fs.writeFile(logPath, '');
    };

    _this.stackTrace = function () {
        let err = new Error();
        return err.stack;
    };

    _this.toLogFile = function (level, string, stackModifier, callerLocation) {
        let location;
        if (callerLocation) {
            location = callerLocation;
        } else {
            /* We make 3 calls before processing who called the original
             *  log command; therefore, the 4th call will be the original caller.
             */
            let callNumber = 4 + (stackModifier || 0);
            location = _this.stackTrace()
                                ?.split('\n')[callNumber]
                                ?.split(/([\\/])/)
                                .pop()
                                ?.slice(0,-1)
                            || 'unknown';
        }

        let date = moment().format('YYYY-MM-DD HH:mm:ss');

        let message = date + ' ' + level + '/' + location + ': ' + string + '\n';

        let dir = path.dirname(logPath);

        if (verbose) {
            let levels = {
                'I': 'info',
                'W': 'warn',
                'E': 'error'
            };
            let type = levels[level];

            console[type](message);
        }

        return utils.fs.mkdirs(dir).then(function () {
            return utils.fs.appendFile(logPath, message);
        }).then(function () {
            return _this.truncateLogFile();
        }).then(function () {
            return message;
        });
    };

    _this.stringFromLogFile = function (filePath) {
        return utils.fs.readFile(filePath || logPath);
    };

    _this.truncateLogFile = function () {
        return utils.fs.stat(logPath).then(function (stats) {
            let kb = stats.size / 1024;

            if (kb >= maxLogFileKb) {
                return _this.stringFromLogFile().then(function (res) {
                    const lines = res.split('\n');
                    return lines.slice(Math.ceil(lines.length / 2), lines.length - 1)
                                .join('\n');
                }).then(function (res) {
                    return utils.fs.unlink(logPath).then(function () {
                        return utils.fs.appendFile(logPath, res);
                    });
                });
            }
        }).catch(function () {
            return false;
        });
    };

    _this.canReportToHelpdesk = function () {
        return !!helpdeskToken;
    };

    /**
     * Submits a ticket to the Fluent Support help desk webhook.
     * Independent of the GitHub flow — both can be used in parallel.
     *
     * @param {string} summary  short description / first error line
     * @param {object} [opts]
     * @param {string} [opts.senderEmail]  email to associate the ticket with
     * @param {string} [opts.userNotes]    user notes entered in the form field
     * @param {boolean} [opts.isCrash]     include stack trace in body
     * @param {string} [opts.stack]        explicit stack trace to include
     */
    _this.sendHelpdeskTicket = function (summary, opts) {
        if (!_this.canReportToHelpdesk()) {
            return Promise.reject(new Error("Helpdesk webhook token not configured"));
        }
        opts = opts || {};
        const senderEmail = opts.senderEmail || defaultSenderEmail;
        const userNotes = opts.userNotes || "";
        const isCrash = !!opts.isCrash;
        const explicitStack = opts.stack;

        const BOUNDARY_PREFIX = "----bttwriter";

        function stripBoundaryTokens(v) {
            const boundaryTokenRe = new RegExp(
                BOUNDARY_PREFIX.replace(/[.*+?^${}()|[\]\\-]/g,
                    "\\$&") + "[0-9a-f]*",
                "gi"
            );
            return String(v == null ? "" : v).replace(boundaryTokenRe, "");
        }

        function sanitizeHeaderField(v) {
            // For values placed in Content-Disposition: strip CR/LF and quotes
            return stripBoundaryTokens(v).replace(/[\r\n"]/g, " ").trim();
        }

        const title = (summary && summary.length > 80)
            ? summary.substring(0, 77) + '...'
            : (summary || (isCrash ? "Crash report" : "Bug report"));

        return _this.stringFromLogFile(null).catch(function () { return ''; })
            .then(function (logTail) {
                const lines = [];
                if (summary) {
                    lines.push(summary, "");
                }
                if (userNotes) {
                    lines.push("## User notes:")
                    lines.push(userNotes, "");
                }
                lines.push("## Environment");
                lines.push(`Version: ${appVersion}`);
                lines.push(`OS: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`);
                lines.push(`User: ${getUserLogin() || '(unknown)'}`);
                lines.push(`Server: ${getSelectedServer() || '(unknown)'}`);
                if (isCrash) {
                    lines.push("");
                    lines.push("## Stack Trace");
                    lines.push("```");
                    lines.push(explicitStack || _this.stackTrace());
                    lines.push("```");
                }
                lines.push("");
                lines.push("## Recent Log");
                lines.push("```");
                lines.push(logTail || "(empty)");
                lines.push("```");

                const fields = {
                    title: sanitizeHeaderField(title),
                    content: stripBoundaryTokens(lines.join("\n")),
                    "sender[email]": sanitizeHeaderField(senderEmail)
                };

                const boundary = `${BOUNDARY_PREFIX}${Date.now().toString(16)}`;

                const partsArr = [];
                Object.keys(fields).forEach(function (key) {
                    partsArr.push(
                        `--${boundary}\r\n` +
                        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
                        `${fields[key]}\r\n`
                    );
                });
                partsArr.push(`--${boundary}--\r\n`);
                const payload = Buffer.from(partsArr.join(""), "utf8");

                const postOptions = {
                    host: HELPDESK_HOST,
                    port: 443,
                    path: HELPDESK_PATH_PREFIX + helpdeskToken,
                    method: "POST",
                    headers: {
                        "User-Agent": `BTT-Writer-Desktop/${appVersion}`,
                        "Content-Type": `multipart/form-data; boundary=${boundary}`,
                        "Content-Length": payload.length
                    }
                };

                return new Promise(function (resolve, reject) {
                    const req = https.request(postOptions, function (res) {
                        res.setEncoding("utf8");
                        let data = "";
                        res.on("data", function (chunk) { data += chunk; });
                        res.on("end", function () {
                            if (res.statusCode >= 400) {
                                reject(new Error(`Helpdesk submission failed: ${res.statusCode} ${data}`));
                            } else {
                                resolve(data);
                            }
                        });
                    });
                    req.on("error", reject);
                    req.write(payload);
                    req.end();
                });
            });
    };

    return _this;
}

module.exports.Reporter = Reporter;
