(function () {

    /**
     * Global error handler for synchronous runtime exceptions occurring within the Renderer process.
     * * Extracts error details, formats the source file position, writes an entry to the local
     * logging subsystem via [App.reporter], and forwards the payload to the Main process to
     * display the full-window crash dialog.
     *
     * @param {string} message - The error message associated with the thrown exception.
     * @param {string} source - The absolute URL/path of the script file where the error occurred.
     * @param {number} lineno - The line number in the source script where the error was triggered.
     * @param {number} colno - The column number in the source script line where the error was triggered.
     * @param {Error} [error] - The native JavaScript Error object containing the runtime stack trace.
     * @returns {boolean} Returns false to allow the exception to propagate to the default browser console logging.
     */
    window.onerror = function (message, source, lineno, colno, error) {
        const filename = source.substring(source.lastIndexOf('/') + 1);
        const location = `${filename}:${lineno}`;
        const stack = error ? error.stack : `Error: ${message}\n    at ${source}:${lineno}:${colno}`;

        App.reporter.logWithCaller('E', error, "Unhandled renderer exception", location);

        if (window.App && App.ipc) {
            App.ipc.send('renderer-exception', {message, stack});
        }

        return false;
    };

    /**
     * Global error handler for asynchronous Promise rejections that lack a `.catch()` block.
     * * Safely handles both native Error objects and primitive rejections (strings, objects).
     * It dynamically extracts original file source locations and line metadata directly out
     * of the parsed error stack trace, logs the event locally, and dispatches the data to
     * the Main process to render the crash view.
     *
     * @param {PromiseRejectionEvent} event - The unhandled promise rejection event emitted by the browser engine.
     * @param {any} event.reason - The value or Error instance passed into the rejection logic.
     */
    window.onunhandledrejection = function(event) {
        const error = event.reason;
        const isErrorInstance = error instanceof Error;
        const message = isErrorInstance ? error.message : (error ? String(error) : 'Unknown promise rejection');
        let stack = isErrorInstance ? error.stack : `Error: ${message}\n    at UnhandledPromiseRejection (unknown)`;

        let source = 'unknown';
        let lineno = '0';
        let colno = '0';

        if (isErrorInstance && error.stack) {
            // Parse the first file path found in the stack trace
            const stackLines = error.stack.split('\n');
            const firstLocationLine = stackLines.find(line => line.includes('at ') && line.includes(':'));
            if (firstLocationLine) {
                const match = firstLocationLine.match(/\((.*?):(\d+):(\d+)\)/) || firstLocationLine.match(/at (.*?):(\d+):(\d+)/);
                if (match) {
                    source = match[1];
                    lineno = match[2];
                    colno = match[3];
                }
            }
        }

        const filename = source.substring(source.lastIndexOf('/') + 1);
        const location = `${filename}:${lineno}:${colno}`;

        App.reporter.logWithCaller('E', error, "Unhandled renderer exception", location);

        if (window.App && App.ipc) {
            App.ipc.send('renderer-exception', { message, stack });
        }
    };

    /**
     * Renderer-side logging wrapper.
     * Captures the caller's file:line from the stack trace in the renderer's
     * main world (where the real source frames exist), then passes it through
     * contextBridge to the reporter in the preload.
     */
    function getCallerLocation() {
        const stack = (new Error()).stack || '';
        const lines = stack.split('\n');
        const frame = lines[3] || '';
        const match = frame.match(/([^\\/]+:\d+):\d+\)?$/);
        return match ? match[1] : frame.trim();
    }

    window.Log = {
        error: function (err, title) {
            return App.reporter.logWithCaller('E', err, title, getCallerLocation());
        },
        warning: function (err, title) {
            return App.reporter.logWithCaller('W', err, title, getCallerLocation());
        },
        notice: function (err, title) {
            return App.reporter.logWithCaller('I', err, title, getCallerLocation());
        }
    };
})();
