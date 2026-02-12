# Centralized Jest Mocks

This directory contains centralized mock implementations for external dependencies used in Jest tests.

## Overview

Centralized mocks reduce duplication across test files and ensure consistent mock behavior. Jest automatically uses mocks from this directory when you call `jest.mock('module-name')`.

## Available Mocks

### `path.js`
Mock for Node.js path module with all standard functions.

**Available Functions:**
- `join(...segments)` - Join path segments with `/`
- `resolve(...segments)` - Resolve to absolute path
- `sep` - Path separator (`/`)
- `dirname(path)` - Get directory name
- `basename(path)` - Get file name
- `extname(path)` - Get file extension
- `parse(path)` - Parse path into components
- `isAbsolute(path)` - Check if path is absolute
- `relative(from, to)` - Get relative path
- `normalize(path)` - Normalize path

**Usage:**
```javascript
jest.mock('path');
const path = require('path');

// All functions are automatically mocked
const result = path.join('dir', 'subdir', 'file.txt');
```

### `lodash.js`
Mock for Lodash utility library with comprehensive function implementations.

**Available Functions:**
- `map(collection, iteratee)` - Map over arrays or objects
- `filter(array, predicate)` - Filter array elements
- `find(array, predicate)` - Find first matching element
- `findIndex(array, predicate)` - Find first matching index
- `reduce(array, reducer, initialValue)` - Reduce array to single value
- `get(object, path, defaultValue)` - Get nested object value
- `set(object, path, value)` - Set nested object value
- `merge(...objects)` - Merge objects together
- `groupBy(array, iteratee)` - Group array elements by key
- `flatten(array, depth)` - Flatten nested arrays
- `union(...arrays)` - Union of arrays (unique values)
- `uniq(array)` - Get unique values
- `sortBy(array, key)` - Sort array by key
- `cloneDeep(value)` - Deep clone value
- `isEmpty(value)` - Check if value is empty
- `pick(object, keys)` - Pick object properties
- `omit(object, keys)` - Omit object properties
- `partialRight(fn, ...args)` - Partially apply from right
- `compact(array)` - Remove falsy values

**Usage:**
```javascript
jest.mock('lodash');
const _ = require('lodash');

// All functions are automatically mocked with realistic behavior
const result = _.map([1, 2, 3], x => x * 2);
```

### `https.js`
Mock for Node.js HTTPS module with request/response simulation.

**Features:**
- Tracks request count and last options
- Configurable response messages and status codes
- Automatic 'data' and 'end' event simulation

**Special Properties:**
- `__lastOptions` - Last request options used
- `__lastWritten` - Last data written to request
- `__requestCount` - Total requests made
- `__responseMessage` - Response body to return
- `__statusCode` - HTTP status code to return
- `__reset()` - Reset all mock state

**Usage:**
```javascript
jest.mock('https');
const https = require('https');

// Configure response
https.__responseMessage = '{"success": true}';
https.__statusCode = 200;

// Make request
https.request(options, (response) => {
    // Response will have configured message and status
});
```

### `moment.js`
Mock for Moment.js date/time library.

**Available Functions:**
- `format(pattern)` - Format date/time
- `unix()` - Get Unix timestamp
- `valueOf()` - Get milliseconds since epoch
- `add(amount, unit)` - Add time
- `subtract(amount, unit)` - Subtract time
- `startOf(unit)` - Start of time unit
- `get(unit)` - Get date component
- `toDate()` - Convert to native Date
- `isBefore(other)` - Check if before other date
- `isAfter(other)` - Check if after other date
- `clone()` - Clone moment instance

**Usage:**
```javascript
jest.mock('moment');
const moment = require('moment');

const now = moment();
const formatted = now.format('YYYY-MM-DD');
```

## Test File Integration

### Basic Usage
Simply call `jest.mock()` without arguments - Jest will automatically use the centralized mock:

```javascript
jest.mock('path');
jest.mock('lodash');
jest.mock('https');
jest.mock('moment');
```

### Module-Specific Mocks
Some mocks are module-specific and should remain inline in test files:

- `archiver` - Archive creation (test-specific configuration)
- `fs` - File system operations (test-specific setup)
- `cmdr` - Command execution (test-specific behavior)
- `utils` - Utility functions (test-specific mocks)

**Example:**
```javascript
jest.mock('path'); // Centralized mock
jest.mock('archiver', () => ({ // Module-specific mock
    create: jest.fn(() => ({...}))
}));
```

## Migration Guide

### From Inline Mocks
Replace inline mock definitions with centralized mocks:

**Before:**
```javascript
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/'))
}));
```

**After:**
```javascript
jest.mock('path'); // Automatically uses __mocks__/path.js
```

### Adding New Functions
To add functions to centralized mocks:

1. Edit the appropriate file in `__mocks__/`
2. Add the function implementation to the default export
3. Update this README
4. Run tests to verify compatibility

## Best Practices

1. **Use centralized mocks** for generic dependencies (path, lodash, etc.)
2. **Keep module-specific mocks inline** for dependencies that need test-specific behavior
3. **Maintain realistic behavior** - mocks should behave like real modules
4. **Update documentation** when adding new functions
5. **Run all tests** after modifying centralized mocks

## Troubleshooting

### Mock Not Being Used
Ensure `jest.mock('module-name')` is called without a factory function:

```javascript
// Wrong - creates new mock
jest.mock('path', () => ({...}));

// Correct - uses centralized mock
jest.mock('path');
```

### Mock Functions Not Working
Check that the mock function is actually available in the centralized mock:

```javascript
// Verify function exists
const path = require('path');
console.log(typeof path.join); // Should be 'function'
```

### Circular Dependencies
If you encounter circular dependency errors:
- Use `jest.mock('module')` without a factory
- Avoid importing centralized mocks in test files
- Let Jest handle mock resolution automatically

## Files

- `path.js` - Node.js path module mock
- `lodash.js` - Lodash utility library mock  
- `https.js` - Node.js HTTPS module mock
- `moment.js` - Moment.js date/time mock
- `README.md` - This documentation file

## Compatibility

- **Jest 30+**: Uses automatic mock resolution from `__mocks__/` directory
- **Node.js**: All mocks simulate Node.js module behavior
- **ES Modules**: Compatible with ES module imports via Babel/Jest

## Maintenance

When updating mocks:
1. Ensure backward compatibility with existing tests
2. Add realistic default implementations
3. Update this README with new functions
4. Run full test suite to verify changes
5. Consider impact on all test files using the mock
