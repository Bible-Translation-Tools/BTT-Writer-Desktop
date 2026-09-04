'use strict';

const exec = require('child_process').exec;
const utils = require('./utils');

module.exports = function cmdr (paths) {

	const pathStr = (function makePathString (paths) {
	    if (paths && paths.length && process.platform !== 'win32') {
	        return 'PATH=' + paths.join(':') + ':$PATH ';
	    }

	    return '';
	})(paths);

	return function cmd(s, workdir) {
        const str = s || '';

        return {
	        cd: function (dir) {
	            return cmd(str, dir);
	        },

	        get and () {
	            return cmd(str && str + ' && ', workdir);
	        },

	        get then () {
                const c = process.platform === 'win32' ? '& ' : '; ';

                return cmd(str && str + c, workdir);
	        },

	        get or () {
	            return cmd(str && str + ' || ', workdir);
	        },

	        set: function (name, val) {
                const c = process.platform === 'win32' ?
                    `set ${name}=${val} & ` :
                    `${name}=${utils.shellEscape(val)} `;

                return cmd(str + c, workdir);
	        },

	        do: function (c) {
	            return cmd(str + pathStr + c, workdir);
	        },

	        run: function () {
	            return new Promise(function (resolve, reject) {
	                exec(str, workdir ? {cwd: workdir} : {}, function (err, stdout, stderr) {
                        const ret = {
                            stdout: stdout,
                            stderr: stderr,
                            error: err
                        };

                        (err && reject(ret)) || resolve(ret);
	                });
	            });
	        },

	        toString: function () {
	            return workdir ? '[cwd ' + workdir + '] ' + str : str;
	        }
	    };
	};
}
