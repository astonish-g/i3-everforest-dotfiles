"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSServiceMap = void 0;
const path = require("path");
const helpers_1 = require("../../helpers");
const css_service_1 = require("./css-service");
/** Gives CSS service for multiple files. */
class CSSServiceMap extends helpers_1.FileTracker {
    includeImportedFiles;
    ignoreSameNameCSSFile;
    serviceMap = new Map();
    constructor(documents, options) {
        super(documents, options);
        this.includeImportedFiles = options.includeImportedFiles;
        this.ignoreSameNameCSSFile = options.ignoreSameNameCSSFile;
    }
    /** Get service by uri. */
    async get(uri) {
        await this.makeFresh();
        return this.serviceMap.get(uri);
    }
    onFileTracked(uri) {
        // If same name scss or less files exist, ignore css files.
        if (this.ignoreSameNameCSSFile) {
            let ext = path.extname(uri).slice(1).toLowerCase();
            if (ext === 'css') {
                let sassOrLessExist = this.has(helpers_1.file.replacePathExtension(uri, 'scss'))
                    || this.has(helpers_1.file.replacePathExtension(uri, 'less'))
                    || this.has(helpers_1.file.replacePathExtension(uri, 'sass'));
                if (sassOrLessExist) {
                    this.ignore(uri);
                }
            }
            else {
                let cssPath = helpers_1.file.replacePathExtension(uri, 'css');
                if (this.has(cssPath)) {
                    this.ignore(cssPath);
                }
            }
        }
    }
    onFileExpired(uri) {
        this.serviceMap.delete(uri);
    }
    onFileUntracked(uri) {
        this.serviceMap.delete(uri);
        // If same name scss files deleted, unignore css files.
        if (this.ignoreSameNameCSSFile) {
            let ext = path.extname(uri).slice(1).toLowerCase();
            if (ext !== 'css') {
                let cssPath = helpers_1.file.replacePathExtension(uri, 'css');
                if (this.has(cssPath)) {
                    this.notIgnore(cssPath);
                }
            }
        }
    }
    /** Parse document to CSS service. */
    async parseDocument(uri, document) {
        let cssService = css_service_1.CSSService.create(document, this.includeImportedFiles);
        this.serviceMap.set(uri, cssService);
        // If having `@import ...`
        let importPaths = await cssService.getResolvedImportPaths();
        if (importPaths.length > 0) {
            for (let importPath of importPaths) {
                // Will also parse imported file because are updating.
                this.trackMoreFile(importPath);
            }
        }
    }
    async findDefinitionsMatchSelector(selector) {
        await this.makeFresh();
        let locations = [];
        for (let cssService of this.iterateAvailableCSSServices()) {
            locations.push(...cssService.findDefinitionsMatchSelector(selector));
        }
        return locations;
    }
    async findSymbolsMatchQuery(query) {
        await this.makeFresh();
        let symbols = [];
        for (let cssService of this.iterateAvailableCSSServices()) {
            symbols.push(...cssService.findSymbolsMatchQuery(query));
        }
        return symbols;
    }
    async findCompletionLabelsMatchSelector(selector) {
        await this.makeFresh();
        let labelSet = new Set();
        for (let cssService of this.iterateAvailableCSSServices()) {
            for (let label of cssService.findCompletionLabelsMatchSelector(selector)) {
                labelSet.add(label);
            }
        }
        return [...labelSet.values()];
    }
    *iterateAvailableCSSServices() {
        for (let [uri, cssService] of this.serviceMap.entries()) {
            if (!this.hasIgnored(uri)) {
                yield cssService;
            }
        }
    }
}
exports.CSSServiceMap = CSSServiceMap;
//# sourceMappingURL=css-service-map.js.map