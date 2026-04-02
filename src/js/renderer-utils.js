(function () {
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
