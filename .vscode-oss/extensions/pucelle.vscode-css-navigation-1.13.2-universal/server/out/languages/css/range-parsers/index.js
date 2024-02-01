"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSSLikeOrSassRanges = void 0;
const css_like_1 = require("./css-like");
const sass_indented_1 = require("./sass-indented");
/** Parse a CSS-like (in `{...}` syntax), or a Sass document (strict indent syntax) to ranges. */
function parseCSSLikeOrSassRanges(document) {
    let languageId = document.languageId;
    if (languageId === 'sass') {
        return new sass_indented_1.SassRangeParser(document).parse();
    }
    else {
        return new css_like_1.CSSLikeRangeParser(document).parse();
    }
}
exports.parseCSSLikeOrSassRanges = parseCSSLikeOrSassRanges;
//# sourceMappingURL=index.js.map