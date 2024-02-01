"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleSelector = void 0;
var SimpleSelector;
(function (SimpleSelector) {
    /** Selector types. */
    let Type;
    (function (Type) {
        Type[Type["Tag"] = 0] = "Tag";
        Type[Type["Class"] = 1] = "Class";
        Type[Type["Id"] = 2] = "Id";
    })(Type = SimpleSelector.Type || (SimpleSelector.Type = {}));
    /** Create a selector from raw selector string. */
    function create(raw, startOffset = 0, importURI = null) {
        if (!validate(raw)) {
            return null;
        }
        let type = raw[0] === '.' ? Type.Class
            : raw[0] === '#' ? Type.Id
                : Type.Tag;
        let label = getLabel(raw, type);
        return {
            type,
            raw,
            identifier: type === Type.Tag ? '' : raw[0],
            label,
            startIndex: startOffset,
            importURI,
        };
    }
    SimpleSelector.create = create;
    /** Removes `.` and `#` at start position. */
    function getLabel(raw, type) {
        let label = type === Type.Tag ? raw : raw.slice(1);
        return label;
    }
    /** Whether a stirng is a valid selector. */
    function validate(raw) {
        return /^[#.]?\w[\w-]*$/i.test(raw);
    }
    SimpleSelector.validate = validate;
    /** Whether a tag, but not custom tag. */
    function isNonCustomTag(selector) {
        return selector.type === Type.Tag && !selector.label.includes('-');
    }
    SimpleSelector.isNonCustomTag = isNonCustomTag;
    /** Whether a custom tag. */
    function isCustomTag(selector) {
        return selector.type === Type.Tag && selector.label.includes('-');
    }
    SimpleSelector.isCustomTag = isCustomTag;
})(SimpleSelector = exports.SimpleSelector || (exports.SimpleSelector = {}));
//# sourceMappingURL=simple-selector.js.map