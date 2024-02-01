"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSScanner = void 0;
const simple_selector_1 = require("../common/simple-selector");
const text_scanner_1 = require("../common/text-scanner");
const file_1 = require("../../helpers/file");
const vscode_uri_1 = require("vscode-uri");
const range_parsers_1 = require("./range-parsers");
const css_service_1 = require("./css-service");
class CSSScanner extends text_scanner_1.TextScanner {
    supportsNesting;
    startOffset;
    constructor(document, offset) {
        super(document, offset);
        this.supportsNesting = css_service_1.CSSService.isLanguageSupportsNesting(document.languageId);
        this.startOffset = offset;
    }
    /** Scan CSS selectors in a CSS document from specified offset. */
    scanForSelectorResults() {
        // Will not match css properties.
        let propertyMatch = this.match(/([\w-]+)\s*:\s*([^;]+)/g);
        if (propertyMatch) {
            return null;
        }
        let match = this.match(/([\w-]+|[#.&][\w-]*)/g);
        if (!match) {
            return null;
        }
        let mayIdentifier = match.text[0];
        let selectors = [];
        let parentSelectors = null;
        if (mayIdentifier === '.' || mayIdentifier === '#') {
            let selector = simple_selector_1.SimpleSelector.create(match.text, match.index);
            if (selector) {
                selectors.push(selector);
            }
        }
        else if (this.supportsNesting && mayIdentifier === '&') {
            parentSelectors = this.parseParentSelectors();
            if (parentSelectors) {
                selectors.push(...this.makeReferenceSelectors(parentSelectors, match.text, match.index));
            }
        }
        else {
            let selector = simple_selector_1.SimpleSelector.create(match.text, match.index);
            if (selector) {
                selectors.push(selector);
            }
        }
        // `selectors` may be empty.
        return {
            selectors,
            parentSelectors,
            raw: match.text,
            startIndex: match.index
        };
    }
    /** Scan CSS selectors in a CSS document from specified offset. */
    scanForSelectors() {
        return this.scanForSelectorResults()?.selectors || null;
    }
    /** Parse whole ranges for document and get selector. */
    makeReferenceSelectors(parentSelectors, rawReferenceText, startIndex) {
        return parentSelectors.map(s => {
            return simple_selector_1.SimpleSelector.create(s.raw + rawReferenceText.slice(1), startIndex);
        });
    }
    /** Parse whole ranges for document and get selector. */
    parseParentSelectors() {
        let { ranges } = (0, range_parsers_1.parseCSSLikeOrSassRanges)(this.document);
        let currentRange;
        let closestParentRange;
        // Binary searching should be better, but not help much.
        for (let i = 0; i < ranges.length; i++) {
            let range = ranges[i];
            let start = this.document.offsetAt(range.range.start);
            let end = this.document.offsetAt(range.range.end);
            // Is an ancestor and has selector.
            if (this.startOffset >= start && this.startOffset < end) {
                if (currentRange && this.isRangeHaveSelector(currentRange)) {
                    closestParentRange = currentRange;
                }
                currentRange = range;
            }
            if (this.startOffset < start) {
                break;
            }
        }
        // May `.a{.b}`, `.b` doesn't make range.
        closestParentRange = closestParentRange || currentRange;
        if (!closestParentRange) {
            return null;
        }
        let selectors = [];
        for (let { full } of closestParentRange.names) {
            if (full[0] === '.' || full[0] === '#') {
                let selector = simple_selector_1.SimpleSelector.create(full, 0);
                if (selector) {
                    selectors.push(selector);
                }
            }
        }
        return selectors;
    }
    /** Checks whether the range have a selector. */
    isRangeHaveSelector(range) {
        return range.names.some(({ mains }) => mains !== null);
    }
    /** Scan for relative import path. */
    async scanForImportPath() {
        let importPath = this.match(/@import\s*['"](.*?)['"]\s*;/g)?.text;
        if (importPath) {
            return await (0, file_1.resolveImportPath)(vscode_uri_1.URI.parse(this.document.uri).fsPath, importPath);
        }
        return null;
    }
}
exports.CSSScanner = CSSScanner;
//# sourceMappingURL=css-scanner.js.map