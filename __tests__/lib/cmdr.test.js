/**
 * @jest-environment node
 */

// 1. Mock child_process
const mockExec = jest.fn();
jest.mock('child_process', () => ({
    exec: mockExec
}));

describe('Commander (cmdr)', () => {
    let cmdr;
    let originalPlatform;

    // Helper to safely change process.platform
    const setPlatform = (platform) => {
        Object.defineProperty(process, 'platform', {
            value: platform
        });
    };

    beforeAll(() => {
        originalPlatform = process.platform;
        // Dynamically require the module to ensure fresh state if needed,
        // though cmdr is a factory so it's safer than singletons.
        cmdr = require('../../src/js/lib/cmdr');
    });

    afterAll(() => {
        setPlatform(originalPlatform);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Default to linux for most tests
        setPlatform('linux');
    });

    describe('Initialization & Paths', () => {
        it('should prepend PATH variable on Linux/macOS when paths are provided', () => {
            setPlatform('linux');
            const paths = ['/usr/bin', '/usr/local/bin'];

            // cmdr(paths) returns the builder function.
            // builder.do('ls') appends the command to the path string.
            const builder = cmdr(paths);
            const result = builder('').do('ls').toString();

            expect(result).toContain('PATH=/usr/bin:/usr/local/bin:$PATH');
            expect(result).toContain('ls');
        });

        it('should NOT prepend PATH on Windows even if paths are provided', () => {
            setPlatform('win32');
            const paths = ['C:\\Windows'];

            const builder = cmdr(paths);
            const result = builder('').do('dir').toString();

            expect(result).not.toContain('PATH=');
            expect(result).toContain('dir');
        });

        it('should not prepend PATH if paths array is empty or null', () => {
            setPlatform('linux');
            const builder = cmdr([]);
            const result = builder('').do('ls').toString();

            expect(result).not.toContain('PATH=');
            expect(result.trim()).toBe('ls');
        });
    });

    describe('Command Building (Chaining)', () => {
        let builder;

        beforeEach(() => {
            // Initialize without extra paths for cleaner string assertions
            builder = cmdr([]);
        });

        it('should store .cd() as the working directory instead of a shell cd', () => {
            const chained = builder('').cd('/tmp');
            expect(chained.toString()).toBe('[cwd /tmp] ');
            expect(chained.and.do('ls').toString()).toBe('[cwd /tmp] ls');
        });

        it('should chain .and (&&)', () => {
            const result = builder('cmd1').and.do('cmd2').toString();
            expect(result).toBe('cmd1 && cmd2');
        });

        it('should chain .or (||)', () => {
            const result = builder('cmd1').or.do('cmd2').toString();
            expect(result).toBe('cmd1 || cmd2');
        });

        it('should chain .then (sequencing) correctly on Linux (;)', () => {
            setPlatform('linux');
            const result = builder('cmd1').then.do('cmd2').toString();
            expect(result).toBe('cmd1; cmd2');
        });

        it('should chain .then (sequencing) correctly on Windows (&)', () => {
            setPlatform('win32');
            // Re-require or re-initialize logic if platform check happens inside constructor?
            // In your code, `get then` checks process.platform at runtime, so this works:
            const result = builder('cmd1').then.do('cmd2').toString();
            expect(result).toBe('cmd1& cmd2');
        });
    });

    describe('Environment Variables (.set)', () => {
        let builder;

        beforeEach(() => {
            builder = cmdr([]);
        });

        it('should use bash syntax on Linux', () => {
            setPlatform('linux');
            const result = builder('').set('FOO', 'bar').do('echo $FOO').toString();

            // Linux: VAR='val' cmd
            expect(result).toBe("FOO='bar' echo $FOO");
        });

        it('should use set syntax on Windows', () => {
            setPlatform('win32');
            const result = builder('').set('FOO', 'bar').do('echo %FOO%').toString();

            // Windows: set VAR=val & cmd
            expect(result).toBe('set FOO=bar & echo %FOO%');
        });
    });

    describe('Execution (.run)', () => {
        let builder;

        beforeEach(() => {
            builder = cmdr([]);
        });

        it('should execute the command string', async () => {
            // Mock successful execution
            mockExec.mockImplementation((cmd, opts, callback) => {
                callback(null, 'success output', '');
            });

            const result = await builder('echo test').run();

            expect(mockExec).toHaveBeenCalledWith('echo test', {}, expect.any(Function));
            expect(result.stdout).toBe('success output');
            expect(result.error).toBeNull();
        });

        it('should pass the .cd() directory to exec as cwd', async () => {
            mockExec.mockImplementation((cmd, opts, callback) => {
                callback(null, '', '');
            });

            await builder('').cd('/tmp').and.do('git init').run();

            expect(mockExec).toHaveBeenCalledWith('git init', {cwd: '/tmp'}, expect.any(Function));
        });

        it('should reject promise on execution error', async () => {
            const error = new Error('Command failed');
            // Mock failed execution
            mockExec.mockImplementation((cmd, opts, callback) => {
                callback(error, '', 'error output');
            });

            try {
                await builder('fail_cmd').run();
                // Should not reach here
                expect(true).toBe(false);
            } catch (ret) {
                expect(ret.error).toBe(error);
                expect(ret.stderr).toBe('error output');
            }
        });
    });

    describe('Complex Chaining Integration', () => {
        it('should build a complex command sequence', () => {
            setPlatform('linux');
            const builder = cmdr(['/bin']);

            const result = builder('')
                .cd('/var/www')
                .and
                .set('ENV', 'prod')
                .do('npm install')
                .toString();

            // cd is carried as the exec cwd, not as shell text
            expect(result).toBe("[cwd /var/www] ENV='prod' PATH=/bin:$PATH npm install");
        });
    });
});
