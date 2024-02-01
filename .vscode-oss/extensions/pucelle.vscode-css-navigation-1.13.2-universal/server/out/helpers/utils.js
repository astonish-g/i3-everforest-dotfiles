"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firstMatch = void 0;
/** Get first sub match. */
function firstMatch(string, re) {
    let m = string.match(re);
    if (!m) {
        return null;
    }
    return m[1];
}
exports.firstMatch = firstMatch;
//# sourceMappingURL=utils.js.map