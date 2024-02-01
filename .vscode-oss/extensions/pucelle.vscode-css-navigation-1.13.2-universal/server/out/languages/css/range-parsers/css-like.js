"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSLikeRangeParser = exports.LeafNameType = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const helpers_1 = require("../../../helpers");
const css_service_1 = require("../css-service");
var LeafNameType;
(function (LeafNameType) {
    LeafNameType[LeafNameType["Selector"] = 0] = "Selector";
    LeafNameType[LeafNameType["Keyframes"] = 1] = "Keyframes";
    LeafNameType[LeafNameType["Import"] = 2] = "Import";
    LeafNameType[LeafNameType["AtRoot"] = 3] = "AtRoot";
    LeafNameType[LeafNameType["OtherCommand"] = 4] = "OtherCommand";
    LeafNameType[LeafNameType["Others"] = 5] = "Others";
})(LeafNameType = exports.LeafNameType || (exports.LeafNameType = {}));
/**
 * To parse one css, or a css-like file to declarations.
 * It lists all the declarations, and mapped selector names.
 */
class CSSLikeRangeParser {
    supportedLanguages = ['css', 'less', 'scss'];
    supportsNesting = false;
    document;
    leaves = [];
    stack = [];
    current;
    ignoreDeep = 0;
    /**
     * When having `@import ...`, we need to load the imported files even they are inside `node_modules`.
     * So we list the import paths here and load them later.
     */
    importPaths = [];
    constructor(document) {
        this.document = document;
        this.initializeNestingSupporting();
        this.parseAsLeaves();
    }
    initializeNestingSupporting() {
        let { languageId } = this.document;
        if (!this.supportedLanguages.includes(languageId)) {
            languageId = 'css';
            helpers_1.console.warn(`Language "${languageId}" is not a declared css language name, using css language instead.`);
        }
        this.supportsNesting = css_service_1.CSSService.isLanguageSupportsNesting(languageId);
    }
    parseAsLeaves() {
        let text = this.document.getText();
        let re = /\s*(?:\/\/.*|\/\*[\s\S]*?\*\/|((?:\(.*?\)|".*?"|'.*?'|\/\/.*|\/\*[\s\S]*?\*\/|[\s\S])*?)([;{}]))/g;
        /*
            \s*						--- match white spaces in left
            (?:
                \/\/.*				--- match comment line
                |
                \/\*[\s\S]*?\*\/	--- match comment seagment
                |
                (?:
                    \(.*?\)			--- (...), sass code may include @include fn(${name})
                    ".*?"			--- double quote string
                    |
                    '.*?'			--- double quote string
                    |
                    [\s\S]			--- others
                )*?					--- declaration or selector
                ([;{}])
            )
        */
        let match;
        while (match = re.exec(text)) {
            let chars = match[1] || '';
            let endChar = match[2] || '';
            let rangeStartIndex = re.lastIndex - chars.length - 1;
            if (endChar === '{' && chars) {
                let names = this.parseSelectorNames(chars);
                if (names.length === 0) {
                    continue;
                }
                if (this.ignoreDeep > 0 || names[0].type === LeafNameType.Keyframes) {
                    this.ignoreDeep++;
                }
                this.current = this.newLeaf(names, rangeStartIndex);
                this.leaves.push(this.current);
            }
            else if (endChar === '}') {
                if (this.ignoreDeep > 0) {
                    this.ignoreDeep--;
                }
                if (this.current) {
                    this.current.rangeEnd = re.lastIndex;
                    this.current = this.stack.pop();
                }
            }
            // Likes `@...` command in top level.
            // Will only parse `@import ...` and push them to `importPaths` property.
            else if (chars && !this.current) {
                this.parseSelectorNames(chars);
            }
        }
        // .a{$
        if (this.current) {
            if (this.current.rangeEnd === 0) {
                this.current.rangeEnd = text.length;
            }
        }
    }
    parse() {
        return {
            ranges: this.formatLeavesToRanges(this.leaves),
            importPaths: this.importPaths
        };
    }
    /** Parse selector to name array. */
    parseSelectorNames(selectorString) {
        // May selectors like this: '[attr="]"]', but this is not a very strict parser.
        // If want to handle it, use `/((?:\[(?:"(?:\\"|.)*?"|'(?:\\'|.)*?'|[\s\S])*?\]|\((?:"(?:\\"|.)*?"|'(?:\\'|.)*?'|[\s\S])*?\)|[\s\S])+?)(?:,|$)/g`
        let re = /(@[\w-]+)|\/\/.*|\/\*[\s\S]*?\*\/|((?:\[.*?\]|\(.*?\)|.)+?)(?:,|$)/g;
        /*
            ^\s*@[\w-]+ 		--- Matches like `@at-root`
            |
            \/\/.*      		--- Matches single line comment
            |
            \/\*[\s\S]*?\*\/	--- Matches multiple lines comment
            (?:
                \[.*?\] 		--- Matches [...]
                |
                \(.*?\) 		--- Matches (...)
                |
                . 				--- Matches other characters
            )
            +?
            (?:,|$)				--- if Matches ',' or '$', end
        */
        let match;
        let names = [];
        while (match = re.exec(selectorString)) {
            let command = match[1];
            let selector = match[2]?.trim();
            // Parse a command.
            if (command) {
                let type = this.getCommandType(command);
                if (type === LeafNameType.Import) {
                    this.parseImportPaths(selectorString);
                }
                // `@at-root` may still have selectors followed.
                if (type === LeafNameType.AtRoot) {
                    names.push({
                        type,
                        raw: command,
                        full: command,
                    });
                }
                // Otherwise commands eat off whole line.
                else {
                    names.push({
                        type,
                        raw: selectorString,
                        full: selectorString,
                    });
                    break;
                }
            }
            // Parse selectors.
            else if (selector) {
                names.push({
                    type: this.ignoreDeep === 0 ? LeafNameType.Selector : LeafNameType.Others,
                    raw: selector,
                    full: selector,
                });
            }
        }
        return names;
    }
    /** Get command type. */
    getCommandType(command) {
        switch (command) {
            case '@at-root':
                return LeafNameType.AtRoot;
            case '@keyframes':
                return LeafNameType.Keyframes;
            case '@import':
                return LeafNameType.Import;
            default:
                return LeafNameType.OtherCommand;
        }
    }
    /** Parse `@import ...` to `importPaths` properties. */
    parseImportPaths(selectors) {
        let match = selectors.match(/^@import\s+(['"])(.+?)\1/);
        if (match) {
            let isURL = /^https?:|^\/\//.test(match[2]);
            if (!isURL) {
                this.importPaths.push(match[2]);
            }
        }
    }
    /** Create a leaf node. */
    newLeaf(names, rangeStart) {
        if (this.supportsNesting && this.ignoreDeep === 0 && this.current && this.haveSelectorInNames(names)) {
            names = this.combineNestingNames(names);
        }
        let parent = this.current;
        if (parent) {
            this.stack.push(parent);
        }
        return {
            names,
            rangeStart,
            rangeEnd: 0,
            parent,
        };
    }
    /** Check whether having selector in names. */
    haveSelectorInNames(names) {
        return names.length > 1 || names[0].type === LeafNameType.Selector;
    }
    /** Combine nesting names into a name stack group. */
    combineNestingNames(oldNames) {
        let re = /(?<=^|[\s+>~])&/g;
        let names = [];
        let parentFullNames = this.getClosestSelectorFullNames();
        let currentCommandType;
        for (let oldName of oldNames) {
            // When not a selector.
            if (oldName.type !== LeafNameType.Selector) {
                names.push(oldName);
                currentCommandType = oldName.type;
            }
            // `a{&-b` -> `a-b`, not handle joining multiply & when several `&` exist.
            else if (parentFullNames && re.test(oldName.full)) {
                for (let parentFullName of parentFullNames) {
                    let full = oldName.full.replace(re, parentFullName);
                    names.push({
                        type: LeafNameType.Selector,
                        full,
                        raw: oldName.raw,
                    });
                }
            }
            // `a{b}` -> `a b`, but doesn't handle `@at-root a{b}`.
            else if (currentCommandType !== LeafNameType.AtRoot && parentFullNames) {
                for (let parentFullName of parentFullNames) {
                    let full = parentFullName + ' ' + oldName.full;
                    names.push({
                        type: LeafNameType.Selector,
                        full,
                        raw: oldName.raw,
                    });
                }
            }
            else {
                names.push(oldName);
            }
        }
        return names;
    }
    /** Get names of closest parent selector. */
    getClosestSelectorFullNames() {
        let parent = this.current;
        while (parent) {
            if (this.haveSelectorInNames(parent.names)) {
                break;
            }
            parent = parent.parent;
        }
        if (!parent) {
            return null;
        }
        let fullNames = [];
        for (let name of parent.names) {
            if (name.type === LeafNameType.Selector) {
                fullNames.push(name.full);
            }
        }
        return fullNames;
    }
    /** Leaves -> ranges. */
    formatLeavesToRanges(leaves) {
        return leaves.map(leaf => this.formatOneLeafToRange(leaf));
    }
    /** Leaf -> ranges. */
    formatOneLeafToRange(leaf) {
        return {
            names: leaf.names.map(leafName => this.formatLeafNameToDeclarationName(leafName)),
            // `positionAt` uses a binary search algorithm, it should be fast enough,
            // we should have no need to count lines here to mark line and column number here,
            // although it should be faster.
            range: vscode_languageserver_1.Range.create(this.document.positionAt(leaf.rangeStart), this.document.positionAt(leaf.rangeEnd))
        };
    }
    /** Leaf name -> names. */
    formatLeafNameToDeclarationName({ raw, full, type }) {
        if (type !== LeafNameType.Selector) {
            return {
                full,
                mains: null
            };
        }
        // If raw selector is like `&:...`, ignore processing the main.
        let shouldHaveMain = !this.hasSingleReferenceInRightMostDescendant(raw);
        if (!shouldHaveMain) {
            return {
                full,
                mains: null
            };
        }
        let mains = this.getMainSelectors(full);
        return {
            full,
            mains,
        };
    }
    /** Checks whether having a reference tag `&` in right most part, returns `true` for '&:hover', 'a &:hover'. */
    hasSingleReferenceInRightMostDescendant(selector) {
        let rightMost = this.getRightMostDescendant(selector);
        return /^&(?:[^\w-]|$)/.test(rightMost);
    }
    /**
     * Returns the start of the right most descendant as the main part.
     * e.g., selectors below will returns `.a`:
     * 	.a[...]
     * 	.a:actived
     * 	.a::before
     * 	.a.b
     */
    getMainSelectors(selector) {
        let rightMost = this.getRightMostDescendant(selector);
        if (!rightMost) {
            return null;
        }
        let match = rightMost.match(/^\w[\w-]*/);
        if (match) {
            //if main is a tag selector, it must be the only
            if (match[0].length === selector.length) {
                return match;
            }
            rightMost = rightMost.slice(match[0].length);
        }
        //class and id selectors must followed each other
        let mains = [];
        while (match = rightMost.match(/^[#.]\w[\w-]*/)) {
            mains.push(match[0]);
            rightMost = rightMost.slice(match[0].length);
        }
        return mains.length > 0 ? mains : null;
    }
    /** Returns descendant combinator used to split ancestor and descendant: space > + ~. */
    getRightMostDescendant(selector) {
        // It's not a strict regexp, if want so, use /(?:\[(?:"(?:\\"|.)*?"|'(?:\\'|.)*?'|[^\]])*?+?\]|\((?:"(?:\\"|.)*?"|'(?:\\'|.)*?'|[^)])*?+?\)|[^\s>+~|])+?$/
        let descendantRE = /(?:\[[^\]]*?\]|\([^)]*?\)|[^\s+>~])+?$/;
        /*
            (?:
                \[[^\]]+?\]	--- [...]
                |
                \([^)]+?\)	--- (...)
                |
                [^\s>+~]	--- others which are not descendant combinator
            )+? - must have ?, or the greedy mode will cause unnecessary exponential fallback
            $
        */
        let match = selector.match(descendantRE);
        return match ? match[0] : '';
    }
}
exports.CSSLikeRangeParser = CSSLikeRangeParser;
//# sourceMappingURL=css-like.js.map