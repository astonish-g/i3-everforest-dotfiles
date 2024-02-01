"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveImportPath = exports.replacePathExtension = exports.getPathExtension = exports.generateGlobPatternFromExtensions = exports.generateGlobPatternFromPatterns = void 0;
const path = require("path");
const fs = require("fs-extra");
function generateGlobPatternFromPatterns(patterns) {
    if (patterns.length > 1) {
        return '{' + patterns.join(',') + '}';
    }
    else if (patterns.length === 1) {
        return patterns[0];
    }
    return null;
}
exports.generateGlobPatternFromPatterns = generateGlobPatternFromPatterns;
function generateGlobPatternFromExtensions(extensions) {
    if (extensions.length > 1) {
        return '**/*.{' + extensions.join(',') + '}';
    }
    else if (extensions.length === 1) {
        return '**/*.' + extensions[0];
    }
    return null;
}
exports.generateGlobPatternFromExtensions = generateGlobPatternFromExtensions;
function getPathExtension(filePath) {
    return path.extname(filePath).slice(1).toLowerCase();
}
exports.getPathExtension = getPathExtension;
function replacePathExtension(filePath, toExtension) {
    return filePath.replace(/\.\w+$/, '.' + toExtension);
}
exports.replacePathExtension = replacePathExtension;
/** Resolve import path, will search `node_modules` directory to find final import path. */
async function resolveImportPath(fromPath, toPath) {
    let isModulePath = toPath.startsWith('~');
    let fromDir = path.dirname(fromPath);
    let beModuleImport = false;
    // `~modulename/...`
    if (isModulePath) {
        toPath = toPath.slice(1);
        toPath = fixPathExtension(toPath, fromPath);
        toPath = 'node_modules/' + toPath;
        beModuleImport = true;
    }
    else {
        toPath = fixPathExtension(toPath, fromPath);
        // Import relative path.
        let filePath = path.resolve(fromDir, toPath);
        if (await fs.pathExists(filePath)) {
            return filePath;
        }
        // .xxx or ../xxx is not module import.
        if (!/^\./.test(toPath)) {
            toPath = 'node_modules/' + toPath;
            beModuleImport = true;
        }
    }
    if (beModuleImport) {
        while (fromDir) {
            let filePath = path.resolve(fromDir, toPath);
            if (await fs.pathExists(filePath)) {
                return filePath;
            }
            let dir = path.dirname(fromDir);
            if (dir === fromDir) {
                break;
            }
            fromDir = dir;
        }
    }
    return null;
}
exports.resolveImportPath = resolveImportPath;
/** Fix imported path with extension. */
function fixPathExtension(toPath, fromPath) {
    let fromPathExtension = getPathExtension(fromPath);
    if (fromPathExtension === 'scss') {
        // @import `b` -> `b.scss`
        if (path.extname(toPath) === '') {
            toPath += '.scss';
        }
    }
    // One issue here:
    //   If we rename `b.scss` to `_b.scss` in `node_modules`,
    //   we can't get file changing notification from VSCode,
    //   and we can't reload it from path because nothing changes in it.
    // So we may need to validate if imported paths exist after we got definition results,
    // although we still can't get new contents in `_b.scss`.
    return toPath;
}
//# sourceMappingURL=file.js.map