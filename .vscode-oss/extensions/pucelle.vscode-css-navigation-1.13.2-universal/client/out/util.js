"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeMarker = exports.generateGlobPatternFromExtensions = exports.getPathExtension = exports.getOutmostWorkspaceURI = void 0;
const path = require("path");
/** If a workspace folder contains another, what we need is to return the outmost one. */
function getOutmostWorkspaceURI(folderURI, allFolderURIs) {
    let parentURIs = allFolderURIs.filter(parentURI => folderURI.startsWith(parentURI + '/'));
    parentURIs.sort((a, b) => a.length - b.length);
    return parentURIs[0] || folderURI;
}
exports.getOutmostWorkspaceURI = getOutmostWorkspaceURI;
/** Get path extension in lowercase, without dot. */
function getPathExtension(filePath) {
    return path.extname(filePath).slice(1).toLowerCase();
}
exports.getPathExtension = getPathExtension;
/** Generate a glob pattern from file extension list. */
function generateGlobPatternFromExtensions(extensions) {
    if (extensions.length > 1) {
        return '**/*.{' + extensions.join(',') + '}';
    }
    else if (extensions.length === 1) {
        return '**/*.' + extensions[0];
    }
    return undefined;
}
exports.generateGlobPatternFromExtensions = generateGlobPatternFromExtensions;
/** Generate current time marker in `h:MM:ss` format. */
function getTimeMarker() {
    let date = new Date();
    return '['
        + String(date.getHours())
        + ':'
        + String(date.getMinutes()).padStart(2, '0')
        + ':'
        + String(date.getSeconds()).padStart(2, '0')
        + '] ';
}
exports.getTimeMarker = getTimeMarker;
//# sourceMappingURL=util.js.map