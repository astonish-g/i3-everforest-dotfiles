"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SassRangeParser = void 0;
const css_service_1 = require("../css-service");
const css_like_1 = require("./css-like");
class SassRangeParser extends css_like_1.CSSLikeRangeParser {
    supportedLanguages = ['sass'];
    initializeNestingSupporting() {
        this.supportsNesting = css_service_1.CSSService.isLanguageSupportsNesting(this.document.languageId);
    }
    parse() {
        let text = this.document.getText();
        let ranges = [];
        let lines = this.parseToLines();
        for (let i = 0; i < lines.length; i++) {
            let { tabCount, content, startIndex, endIndex } = lines[i];
            let nextTabCount = i < lines.length - 1 ? lines[i + 1].tabCount : 0;
            // |.class1
            //     color: red
            if (tabCount < nextTabCount) {
                let selector = content.trimRight().replace(/\s+/g, ' ');
                let names = this.parseSelectorNames(selector);
                if (names.length === 0) {
                    continue;
                }
                if (this.ignoreDeep > 0 || names[0].type === css_like_1.LeafNameType.Keyframes) {
                    this.ignoreDeep++;
                }
                this.current = this.newLeaf(names, startIndex);
                ranges.push(this.current);
            }
            //     color: red
            // |.class1
            else if (tabCount > nextTabCount) {
                if (this.ignoreDeep > 0) {
                    this.ignoreDeep += tabCount - nextTabCount;
                }
                for (let j = 0; j < tabCount - nextTabCount; j++) {
                    if (this.current) {
                        this.current.rangeEnd = endIndex;
                        this.current = this.stack.pop();
                    }
                }
            }
            // `@...` command in top level
            // parse `@import ...` to `this.importPaths`
            else if (content && !this.current) {
                this.parseSelectorNames(content);
            }
        }
        while (this.current) {
            if (this.current.rangeEnd === 0) {
                this.current.rangeEnd = text.length;
            }
            this.current = this.stack.pop();
        }
        return {
            ranges: this.formatLeavesToRanges(ranges),
            importPaths: this.importPaths
        };
    }
    /** Check indent characters. */
    checkIndentChars() {
        let text = this.document.getText();
        let re = /\n(\s+)/g;
        let match;
        while (match = re.exec(text)) {
            let content = match[1];
            if (content === '\t' || content === '  ' || content === '    ') {
                return content;
            }
        }
        return '\t';
    }
    /** Parse text to lines */
    parseToLines() {
        let text = this.document.getText();
        let indentChars = this.checkIndentChars();
        let re = /^(\s*)(.+)/gm;
        let match;
        let lines = [];
        while (match = re.exec(text)) {
            let tabs = match[1] || '';
            let tabCount = Math.floor(tabs.length / indentChars.length);
            let content = match[2] || '';
            let endIndex = re.lastIndex;
            let startIndex = endIndex - match[0].length + tabs.length;
            if (!content) {
                continue;
            }
            lines.push({
                tabCount,
                content,
                startIndex,
                endIndex,
            });
        }
        return lines;
    }
}
exports.SassRangeParser = SassRangeParser;
//# sourceMappingURL=sass-indented.js.map