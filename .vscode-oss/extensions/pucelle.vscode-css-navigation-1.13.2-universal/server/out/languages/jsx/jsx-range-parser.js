"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSXRangeParser = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const simple_selector_1 = require("../common/simple-selector");
const html_range_parser_1 = require("../html/html-range-parser");
class JSXRangeParser extends html_range_parser_1.HTMLRangeParser {
    /**
     * Parse CSS ranges for HTML tag attribute.
     * It parses `className=...` additional.
     * It doesn't support computed React syntax like `class={...}`
     */
    makeRangesFromAttribute(attribute, start, end) {
        let re = /\b(class|id|className)(?:[\S]*?)\s*=\s*(?:"(.*?)"|'(.*?)')/g;
        let match;
        let ranges = [];
        while (match = re.exec(attribute)) {
            let attr = match[1].trim();
            let value = match[2] || match[3];
            if (!value) {
                continue;
            }
            if (attr === 'class' || attr === 'className') {
                for (let name of value.split(/\s+/)) {
                    name = '.' + name;
                    if (simple_selector_1.SimpleSelector.validate(name)) {
                        ranges.push({
                            name,
                            range: vscode_languageserver_1.Range.create(this.document.positionAt(start), this.document.positionAt(end))
                        });
                    }
                }
            }
            else {
                let name = '#' + value;
                if (simple_selector_1.SimpleSelector.validate(name)) {
                    ranges.push({
                        name,
                        range: vscode_languageserver_1.Range.create(this.document.positionAt(start), this.document.positionAt(end))
                    });
                }
            }
        }
        return ranges;
    }
}
exports.JSXRangeParser = JSXRangeParser;
//# sourceMappingURL=jsx-range-parser.js.map