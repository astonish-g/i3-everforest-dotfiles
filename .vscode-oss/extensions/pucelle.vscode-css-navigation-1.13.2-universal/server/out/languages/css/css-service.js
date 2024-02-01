"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSService = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const range_parsers_1 = require("./range-parsers");
const css_scanner_1 = require("./css-scanner");
const vscode_uri_1 = require("vscode-uri");
const file_1 = require("../../helpers/file");
/** Gives CSS service for one CSS file. */
class CSSService {
    uri;
    ranges;
    importPaths;
    constructor(document, ranges, importPaths) {
        this.uri = document.uri;
        this.ranges = ranges;
        this.importPaths = importPaths;
    }
    /** Get resolved imported css paths from `@import ...`. */
    async getResolvedImportPaths() {
        if (this.importPaths.length > 0) {
            let filePaths = [];
            for (let importPath of this.importPaths) {
                let filePath = await (0, file_1.resolveImportPath)(vscode_uri_1.URI.parse(this.uri).fsPath, importPath);
                if (filePath) {
                    filePaths.push(filePath);
                }
            }
            return filePaths;
        }
        else {
            return [];
        }
    }
    /** Find definitions match one selector. */
    findDefinitionsMatchSelector(selector) {
        let locations = [];
        let selectorRaw = selector.raw;
        for (let range of this.ranges) {
            let isMatch = range.names.some(({ mains }) => {
                return mains !== null && mains.includes(selectorRaw);
            });
            if (isMatch) {
                locations.push(vscode_languageserver_1.Location.create(this.uri, range.range));
            }
        }
        return locations;
    }
    /**
     * Query symbols from a wildmatch query string.
     *
     * Query string 'p' will match:
     *	p* as tag name
     *	.p* as class name
     *	#p* as id
     * and may have more decorated selectors followed.
     */
    findSymbolsMatchQuery(query) {
        let symbols = [];
        let lowerQuery = query.toLowerCase();
        for (let range of this.ranges) {
            for (let { full } of range.names) {
                let isMatch = this.isMatchQuery(full, lowerQuery);
                if (isMatch) {
                    symbols.push(vscode_languageserver_1.SymbolInformation.create(full, vscode_languageserver_1.SymbolKind.Class, range.range, this.uri));
                }
            }
        }
        return symbols;
    }
    /** Test if one selector match a symbol query string, they will match when left word boundaris matched. */
    isMatchQuery(selector, query) {
        let lowerSelector = selector.toLowerCase();
        let index = lowerSelector.indexOf(query);
        if (index === -1) {
            return false;
        }
        //match at start position
        if (index === 0) {
            return true;
        }
        //if search only 1 character, must match at start word boundary
        if (query.length === 1) {
            let charactersBeforeMatch = selector.slice(0, index);
            let hasNoWordCharacterBeforeMatch = !/[a-z]/.test(charactersBeforeMatch);
            return hasNoWordCharacterBeforeMatch;
        }
        //starts with a not word characters
        if (!/[a-z]/.test(query[0])) {
            return true;
        }
        //'abc' not match query 'bc', but 'ab-bc' matches
        while (/[a-z]/.test(lowerSelector[index - 1])) {
            lowerSelector = lowerSelector.slice(index + query.length);
            index = lowerSelector.indexOf(query);
            if (index === -1) {
                return false;
            }
        }
        return true;
    }
    /** Find completion label pieces from selector. */
    findCompletionLabelsMatchSelector(selector) {
        let labelSet = new Set();
        let selectorRaw = selector.raw;
        for (let range of this.ranges) {
            for (let { mains } of range.names) {
                if (mains === null) {
                    continue;
                }
                let main = mains.find(main => main.startsWith(selectorRaw));
                if (main) {
                    let label = main.slice(1); //only id or class selector, no tag selector provided
                    labelSet.add(label);
                }
            }
        }
        return [...labelSet.values()];
    }
}
exports.CSSService = CSSService;
/** Global help functions of CSSService. */
(function (CSSService) {
    /** Create a CSSService from a CSS document. */
    function create(document, includeImportedFiles) {
        let { ranges, importPaths } = (0, range_parsers_1.parseCSSLikeOrSassRanges)(document);
        if (!includeImportedFiles) {
            importPaths = [];
        }
        return new CSSService(document, ranges, importPaths);
    }
    CSSService.create = create;
    /** Check if CSS language supports nesting. */
    function isLanguageSupportsNesting(languageId) {
        let supportedNestingLanguages = ['less', 'scss', 'sass'];
        return supportedNestingLanguages.includes(languageId);
    }
    CSSService.isLanguageSupportsNesting = isLanguageSupportsNesting;
    /**
     * Get current selector from a CSS document and the cursor position.
     * May return multiple selectors because of nesting.
     */
    function getSimpleSelectorsAt(document, position) {
        let offset = document.offsetAt(position);
        return new css_scanner_1.CSSScanner(document, offset).scanForSelectors();
    }
    CSSService.getSimpleSelectorsAt = getSimpleSelectorsAt;
    /**
     * Get current selector and raw text from a CSS document and the cursor position.
     * May return multiple selectors because of nesting.
     */
    function getSimpleSelectorResultsAt(document, position) {
        let offset = document.offsetAt(position);
        return new css_scanner_1.CSSScanner(document, offset).scanForSelectorResults();
    }
    CSSService.getSimpleSelectorResultsAt = getSimpleSelectorResultsAt;
    /** If click `goto definition` at a `<link href="...">` or `<style src="...">`. */
    async function getImportPathAt(document, position) {
        let offset = document.offsetAt(position);
        return await (new css_scanner_1.CSSScanner(document, offset).scanForImportPath());
    }
    CSSService.getImportPathAt = getImportPathAt;
})(CSSService = exports.CSSService || (exports.CSSService = {}));
//# sourceMappingURL=css-service.js.map