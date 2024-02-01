"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLService = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const html_range_parser_1 = require("./html-range-parser");
const html_scanner_1 = require("./html-scanner");
const jsx_scanner_1 = require("../jsx/jsx-scanner");
const css_service_1 = require("../css/css-service");
const vscode_uri_1 = require("vscode-uri");
const file_1 = require("../../helpers/file");
const helpers_1 = require("../../helpers");
const utils_1 = require("../../helpers/utils");
const jsx_range_parser_1 = require("../jsx/jsx-range-parser");
/** Scan html code pieces in files that can include HTML codes, like html, js, jsx, ts, tsx. */
class HTMLService {
    uri;
    ranges;
    constructor(document, ranges) {
        this.uri = document.uri;
        this.ranges = ranges;
    }
    /** Find the location in the HTML document for specified selector label. */
    findLocationsMatchSelector(selector) {
        let locations = [];
        for (let range of this.ranges) {
            if (range.name === selector.raw) {
                locations.push(vscode_languageserver_1.Location.create(this.uri, range.range));
            }
        }
        return locations;
    }
    /** Find completion label for a CSS document, from selectors in HTML document. */
    findCompletionLabelsMatch(prefix) {
        let labelSet = new Set();
        for (let range of this.ranges) {
            if (range.name.startsWith(prefix)) {
                let label = range.name;
                labelSet.add(label);
            }
        }
        return [...labelSet.values()];
    }
}
exports.HTMLService = HTMLService;
(function (HTMLService) {
    /** Create a temporary HTMLService. */
    function create(document) {
        let ranges;
        if (isJSXDocument(document)) {
            ranges = new jsx_range_parser_1.JSXRangeParser(document).parse();
        }
        else {
            ranges = new html_range_parser_1.HTMLRangeParser(document).parse();
        }
        return new HTMLService(document, ranges);
    }
    HTMLService.create = create;
    /** Search a selector from specified position in a document. */
    async function getSimpleSelectorAt(document, position) {
        let offset = document.offsetAt(position);
        if (isJSXDocument(document)) {
            let selector = await new jsx_scanner_1.JSXScanner(document, offset).scanSelector();
            if (selector) {
                return selector;
            }
        }
        return new html_scanner_1.HTMLScanner(document, offset).scanForSelector();
    }
    HTMLService.getSimpleSelectorAt = getSimpleSelectorAt;
    /** Whether document is a js, jsx, ts, tsx document. */
    function isJSXDocument(document) {
        return ['javascriptreact', 'typescriptreact', 'javascript', 'typescript'].includes(document.languageId);
    }
    /**
     * If click `goto definition` at a `<link href="...">` or `<style src="...">`.
     * Returned result has been resolved to an absolute path.
     */
    async function getImportPathAt(document, position) {
        let offset = document.offsetAt(position);
        let importPath = await (new html_scanner_1.HTMLScanner(document, offset).scanForImportPath());
        if (!importPath && isJSXDocument(document)) {
            importPath = await (new jsx_scanner_1.JSXScanner(document, offset).scanForImportPath());
        }
        return importPath;
    }
    HTMLService.getImportPathAt = getImportPathAt;
    /** Find definitions in style tag for curent document. */
    function findDefinitionsInInnerStyle(document, select) {
        let services = findInnerCSSServices(document);
        let locations = [];
        for (let { document: cssDocument, service: cssService, index: styleIndex } of services) {
            let cssLocations = cssService.findDefinitionsMatchSelector(select);
            for (let location of cssLocations) {
                let startIndexInCSS = cssDocument.offsetAt(location.range.start);
                let endIndexInCSS = cssDocument.offsetAt(location.range.end);
                let startIndexInHTML = startIndexInCSS + styleIndex;
                let endIndexInHTML = endIndexInCSS + styleIndex;
                locations.push(vscode_languageserver_1.Location.create(document.uri, vscode_languageserver_1.Range.create(document.positionAt(startIndexInHTML), document.positionAt(endIndexInHTML))));
            }
        }
        return locations;
    }
    HTMLService.findDefinitionsInInnerStyle = findDefinitionsInInnerStyle;
    /** Find auto completion labels in style tag for curent document. */
    function findCompletionLabelsInInnerStyle(document, select) {
        let services = findInnerCSSServices(document);
        let labels = [];
        for (let { service: cssService } of services) {
            labels.push(...cssService.findCompletionLabelsMatchSelector(select));
        }
        return labels;
    }
    HTMLService.findCompletionLabelsInInnerStyle = findCompletionLabelsInInnerStyle;
    /** Get all inner CSS services. */
    function findInnerCSSServices(document) {
        let text = document.getText();
        let re = /<style\b(.*?)>(.*?)<\/style>|\bcss`(.*?)`/gs;
        let match;
        let services = [];
        while (match = re.exec(text)) {
            let languageId = match[1] ? getLanguageTypeFromPropertiesText(match[1] || '') : 'css';
            let cssText = match[2] || match[3] || '';
            let styleIndex = match[2]
                ? re.lastIndex - 8 - cssText.length // 8 is the length of '</style>'
                : re.lastIndex - 1 - cssText.length; // 1 is the length of '`'
            let cssDocument = vscode_languageserver_textdocument_1.TextDocument.create('untitled.' + languageId, languageId, 0, cssText);
            let service = css_service_1.CSSService.create(cssDocument, false);
            services.push({
                document: cssDocument,
                service,
                index: styleIndex,
            });
        }
        return services;
    }
    /** Find references in current HTML document, from inner style declaration in <style>. */
    function findReferencesInInnerHTML(document, position, htmlService) {
        let text = document.getText();
        let re = /<style\b(.*?)>(.*?)<\/style>/gs;
        let match;
        let offset = document.offsetAt(position);
        while (match = re.exec(text)) {
            let languageId = getLanguageTypeFromPropertiesText(match[1] || '');
            let cssText = match[2];
            let styleStartIndex = re.lastIndex - 8 - cssText.length;
            let styleEndIndex = styleStartIndex + cssText.length;
            let locations = [];
            if (offset >= styleStartIndex && offset < styleEndIndex) {
                let cssDocument = vscode_languageserver_textdocument_1.TextDocument.create('untitled.' + languageId, languageId, 0, cssText);
                let selectors = css_service_1.CSSService.getSimpleSelectorsAt(cssDocument, cssDocument.positionAt(offset - styleStartIndex));
                if (selectors) {
                    for (let selector of selectors) {
                        locations.push(...htmlService.findLocationsMatchSelector(selector));
                    }
                }
                return locations;
            }
        }
        return null;
    }
    HTMLService.findReferencesInInnerHTML = findReferencesInInnerHTML;
    /** Get sass / scss / less / css language type. */
    function getLanguageTypeFromPropertiesText(text) {
        let propertiesMatch = text.match(/\b(scss|sass|less|css)\b/i);
        let languageId = propertiesMatch ? propertiesMatch[1].toLowerCase() : 'css';
        return languageId;
    }
    /** Scan paths of linked or imported style files. */
    async function scanStyleImportPaths(document) {
        let text = document.getText();
        let re = /<link[^>]+rel\s*=\s*['"]stylesheet['"]>/g;
        let hrefRE = /\bhref\s*=['"](.*?)['"]/;
        let match;
        let documentPath = vscode_uri_1.URI.parse(document.uri).fsPath;
        let documentExtension = helpers_1.file.getPathExtension(document.uri);
        let importFilePaths = [];
        while (match = re.exec(text)) {
            let relativePath = (0, utils_1.firstMatch)(match[0], hrefRE);
            if (!relativePath) {
                continue;
            }
            let filePath = await (0, file_1.resolveImportPath)(documentPath, relativePath);
            if (filePath) {
                importFilePaths.push(filePath);
            }
        }
        if (documentExtension === 'vue') {
            importFilePaths.push(...await scanVueStyleImportPaths(document));
        }
        return importFilePaths;
    }
    HTMLService.scanStyleImportPaths = scanStyleImportPaths;
    /** Scan paths of imported style files for vue files. */
    async function scanVueStyleImportPaths(document) {
        let text = document.getText();
        let re = /<style[^>]+src\s*=['"](.*?)['"]>/g;
        let match;
        let documentPath = vscode_uri_1.URI.parse(document.uri).fsPath;
        let importFilePaths = [];
        while (match = re.exec(text)) {
            let relativePath = match[1];
            let filePath = await (0, file_1.resolveImportPath)(documentPath, relativePath);
            if (filePath) {
                importFilePaths.push(filePath);
            }
        }
        return importFilePaths;
    }
})(HTMLService = exports.HTMLService || (exports.HTMLService = {}));
//# sourceMappingURL=html-service.js.map