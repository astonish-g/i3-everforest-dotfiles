"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTracker = void 0;
const path = require("path");
const minimatch = require("minimatch");
const fs = require("fs-extra");
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const console = require("./console");
const vscode_uri_1 = require("vscode-uri");
const file_walker_1 = require("./file-walker");
const glob_1 = require("glob");
const util_1 = require("util");
/** Class to track one type of files in a directory. */
class FileTracker {
    documents;
    alwaysIncludeGlobPattern;
    ignoreFilesBy;
    startPath;
    includeFileMatcher;
    excludeMatcher;
    alwaysIncludeMatcher;
    map = new Map();
    ignoredFileURIs = new Set();
    allFresh = true;
    startDataLoaded = true;
    updating = null;
    updatePromises = [];
    constructor(documents, options) {
        this.documents = documents;
        this.alwaysIncludeGlobPattern = options.alwaysIncludeGlobPattern || null;
        this.ignoreFilesBy = options.ignoreFilesBy || [];
        this.includeFileMatcher = new minimatch.Minimatch(options.includeFileGlobPattern);
        this.excludeMatcher = options.excludeGlobPattern ? new minimatch.Minimatch(options.excludeGlobPattern) : null;
        this.alwaysIncludeMatcher = this.alwaysIncludeGlobPattern ? new minimatch.Minimatch(this.alwaysIncludeGlobPattern) : null;
        this.startPath = options.startPath || null;
        if (this.startPath) {
            this.allFresh = false;
            this.startDataLoaded = false;
        }
    }
    /** When document opened or content changed from vscode editor. */
    onDocumentOpenOrContentChanged(document) {
        if (!this.startDataLoaded) {
            return;
        }
        // No need to handle file opening because we have preloaded all the files.
        // Open and changed event will be distinguished by document version later.
        if (this.shouldTrackFile(vscode_uri_1.URI.parse(document.uri).fsPath)) {
            this.trackOpenedDocument(document);
        }
    }
    /** After document saved. */
    onDocumentSaved(document) {
        if (!this.startDataLoaded) {
            return;
        }
        let item = this.map.get(document.uri);
        // Since `onDidChangeWatchedFiles` event was triggered so frequently, we only do updating after saved.
        if (item && !item.fresh && this.updating) {
            this.updateFile(document.uri, item);
        }
    }
    /** After document closed. */
    onDocumentClosed(document) {
        if (!this.startDataLoaded) {
            return;
        }
        let item = this.map.get(document.uri);
        if (item) {
            this.retrackClosedFile(document.uri);
        }
    }
    /** After changes of files or folders. */
    async onWatchedFileOrFolderChanged(params) {
        // An issue for `@import ...` resources:
        // It's common that we import resources inside `node_modules`,
        // but we can't get notifications when those files changed.
        if (!this.startDataLoaded) {
            return;
        }
        for (let change of params.changes) {
            let uri = change.uri;
            let fsPath = vscode_uri_1.URI.parse(uri).fsPath;
            // New file or folder.
            if (change.type === vscode_languageserver_1.FileChangeType.Created) {
                this.trackFileOrFolder(fsPath);
            }
            // Content changed file or folder.
            else if (change.type === vscode_languageserver_1.FileChangeType.Changed) {
                if (await fs.pathExists(fsPath)) {
                    let stat = await fs.stat(fsPath);
                    if (stat && stat.isFile()) {
                        if (this.shouldTrackFile(fsPath)) {
                            this.retrackChangedFile(uri);
                        }
                    }
                }
            }
            // Deleted file or folder.
            else if (change.type === vscode_languageserver_1.FileChangeType.Deleted) {
                this.untrackDeletedFile(uri);
            }
        }
    }
    /** Whether tracked file. */
    has(uri) {
        return this.map.has(uri);
    }
    /** Load all files inside `startPath`, and also all opened documents. */
    async loadStartData() {
        console.timeStart('track');
        for (let document of this.documents.all()) {
            if (this.shouldTrackFile(vscode_uri_1.URI.parse(document.uri).fsPath)) {
                this.trackOpenedDocument(document);
            }
        }
        if (this.alwaysIncludeGlobPattern) {
            let alwaysIncludePaths = await (0, util_1.promisify)(glob_1.glob)(this.alwaysIncludeGlobPattern, {
                cwd: this.startPath || undefined,
                absolute: true,
            });
            for (let filePath of alwaysIncludePaths) {
                filePath = vscode_uri_1.URI.file(filePath).fsPath;
                if (this.shouldTrackFile(filePath)) {
                    this.trackFile(filePath);
                }
            }
        }
        await this.trackFileOrFolder(this.startPath);
        console.timeEnd('track', `${this.map.size} files tracked`);
        this.startDataLoaded = true;
    }
    /** Returns whether should track one file. */
    shouldTrackFile(filePath) {
        if (!this.includeFileMatcher.match(filePath)) {
            return false;
        }
        if (this.shouldExcludeFileOrFolder(filePath)) {
            return false;
        }
        return true;
    }
    /** Returns whether should track one file or folder. */
    shouldTrackFileOrFolder(fsPath) {
        if (this.shouldExcludeFileOrFolder(fsPath)) {
            return false;
        }
        return true;
    }
    /** Returns whether should exclude file or folder. */
    shouldExcludeFileOrFolder(fsPath) {
        if (this.alwaysIncludeMatcher && this.alwaysIncludeMatcher.match(fsPath)) {
            return false;
        }
        if (this.excludeMatcher && this.excludeMatcher.match(fsPath)) {
            return true;
        }
        return false;
    }
    /** Track file or folder. */
    async trackFileOrFolder(fsPath) {
        if (!this.shouldTrackFileOrFolder(fsPath)) {
            return;
        }
        if (!await fs.pathExists(fsPath)) {
            return;
        }
        let stat = await fs.stat(fsPath);
        if (stat.isDirectory()) {
            await this.trackFolder(fsPath);
        }
        else if (stat.isFile()) {
            let filePath = fsPath;
            if (this.shouldTrackFile(filePath)) {
                this.trackFile(filePath);
            }
        }
    }
    /** Track folder. */
    async trackFolder(folderPath) {
        let filePathsGenerator = (0, file_walker_1.walkDirectoryToMatchFiles)(folderPath, this.ignoreFilesBy);
        for await (let absPath of filePathsGenerator) {
            if (this.includeFileMatcher.match(absPath) && (!this.excludeMatcher || !this.excludeMatcher.match(absPath))) {
                this.trackFile(absPath);
            }
        }
    }
    /** Track file. */
    trackFile(filePath) {
        let uri = vscode_uri_1.URI.file(filePath).toString();
        let item = this.map.get(uri);
        if (!item) {
            item = {
                document: null,
                version: 0,
                opened: false,
                fresh: false,
                updatePromise: null
            };
            this.map.set(uri, item);
            this.afterTrackedFile(uri, item);
        }
    }
    /** Track more file like imported file. although it may not in `startPath`. */
    trackMoreFile(filePath) {
        if (this.includeFileMatcher.match(filePath)) {
            this.trackFile(filePath);
        }
    }
    /** Track opened file from document, or update tracking, no matter files inside or outside workspace. */
    trackOpenedDocument(document) {
        let uri = document.uri;
        let item = this.map.get(uri);
        if (item) {
            let fileChanged = document.version > item.version;
            item.document = document;
            item.version = document.version;
            item.opened = true;
            if (fileChanged) {
                this.makeFileExpire(uri, item);
            }
        }
        else {
            item = {
                document,
                version: document.version,
                opened: true,
                fresh: false,
                updatePromise: null
            };
            this.map.set(uri, item);
            this.afterTrackedFile(uri, item);
        }
    }
    /** After knows that file expired. */
    makeFileExpire(uri, item) {
        if (this.updating) {
            this.updateFile(uri, item);
        }
        else {
            let beFreshBefore = item.fresh;
            item.fresh = false;
            item.version = 0;
            this.allFresh = false;
            if (beFreshBefore) {
                console.log(`${decodeURIComponent(uri)} expired`);
            }
            this.onFileExpired(uri);
        }
    }
    /** After tracked file, check if it's fresh, if not, set global fresh state or update it. */
    afterTrackedFile(uri, item) {
        if (this.updating) {
            this.updateFile(uri, item);
        }
        else if (item) {
            this.allFresh = false;
        }
        console.log(`${decodeURIComponent(uri)} tracked`);
        this.onFileTracked(uri);
    }
    /** Ignore file, Still keep data for ignored items. */
    ignore(uri) {
        this.ignoredFileURIs.add(uri);
        console.log(`${decodeURIComponent(uri)} ignored`);
    }
    /** Stop ignoring file. */
    notIgnore(uri) {
        this.ignoredFileURIs.delete(uri);
        console.log(`${decodeURIComponent(uri)} restored from ignored`);
    }
    /** Check whether ignored file. */
    hasIgnored(uri) {
        return this.ignoredFileURIs.size > 0 && this.ignoredFileURIs.has(uri);
    }
    /** After file content changed, retrack it. */
    retrackChangedFile(uri) {
        let item = this.map.get(uri);
        if (item) {
            // Alread been handled by document change event.
            let openedAndFresh = item.document && item.version === item.document.version;
            if (!openedAndFresh) {
                this.makeFileExpire(uri, item);
            }
        }
        else {
            this.trackFile(vscode_uri_1.URI.parse(uri).fsPath);
        }
    }
    /** retrack closed file. */
    retrackClosedFile(uri) {
        let item = this.map.get(uri);
        if (item) {
            // Becomes same as not opened, still fresh.
            item.document = null;
            item.version = 0;
            item.opened = false;
            console.log(`${decodeURIComponent(uri)} closed`);
        }
    }
    /** After file or folder deleted from disk. */
    untrackDeletedFile(deletedURI) {
        for (let uri of this.map.keys()) {
            if (uri.startsWith(deletedURI)) {
                let item = this.map.get(uri);
                if (item) {
                    this.untrackFile(uri);
                }
            }
        }
        this.allFresh = false;
    }
    /** Delete one file. */
    untrackFile(uri) {
        this.map.delete(uri);
        if (this.ignoredFileURIs.size > 0) {
            this.ignoredFileURIs.delete(uri);
        }
        console.log(`${decodeURIComponent(uri)} removed`);
        this.onFileUntracked(uri);
    }
    /** Ensure all the content be fresh. */
    async makeFresh() {
        if (this.allFresh) {
            return;
        }
        if (this.updating) {
            await this.updating;
        }
        else {
            this.updating = this.doUpdating();
            await this.updating;
            this.updating = null;
            this.allFresh = true;
        }
    }
    async doUpdating() {
        if (!this.startDataLoaded) {
            await this.loadStartData();
        }
        this.updatePromises = [];
        console.timeStart('update');
        for (let [uri, item] of this.map.entries()) {
            if (!item.fresh) {
                this.updateFile(uri, item);
            }
        }
        // May push more promises even when updating.
        for (let i = 0; i < this.updatePromises.length; i++) {
            let promise = this.updatePromises[i];
            await promise;
        }
        let updatedCount = this.updatePromises.length;
        console.timeEnd('update', `${updatedCount} files loaded`);
        this.updatePromises = [];
    }
    /** Update one file, returns whether updated. */
    async updateFile(uri, item) {
        if (!this.hasIgnored(uri)) {
            if (!item.updatePromise) {
                item.updatePromise = this.createUpdatePromise(uri, item);
                this.updatePromises.push(item.updatePromise);
                await item.updatePromise;
                item.updatePromise = null;
            }
            return true;
        }
        return false;
    }
    /** Doing update and returns a promise. */
    async createUpdatePromise(uri, item) {
        if (!item.document) {
            item.document = await this.loadDocument(uri);
            if (item.document) {
                item.version = item.document.version;
            }
        }
        if (item.document) {
            item.fresh = true;
            await this.parseDocument(uri, item.document);
            // Very important, release document memory usage after symbols generated
            if (!item.opened) {
                item.document = null;
            }
            console.log(`${decodeURIComponent(uri)} loaded${item.opened ? ' from opened document' : ''}`);
        }
    }
    /** Load text content and create one document. */
    async loadDocument(uri) {
        let languageId = path.extname(uri).slice(1).toLowerCase();
        let document = null;
        try {
            let text = (await fs.readFile(vscode_uri_1.URI.parse(uri).fsPath)).toString('utf8');
            // Very low resource usage for creating one document.
            document = vscode_languageserver_textdocument_1.TextDocument.create(uri, languageId, 1, text);
        }
        catch (err) {
            console.error(err);
        }
        return document;
    }
    /** After file tracked. */
    onFileTracked(_uri) { }
    /** After file expired. */
    onFileExpired(_uri) { }
    /** After file untracked. */
    onFileUntracked(_uri) { }
    /** Parsed document. */
    async parseDocument(_uri, _document) { }
}
exports.FileTracker = FileTracker;
//# sourceMappingURL=file-tracker.js.map