"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSXScanner = void 0;
const simple_selector_1 = require("../common/simple-selector");
const text_scanner_1 = require("../common/text-scanner");
const path = require("path");
const vscode_uri_1 = require("vscode-uri");
const file_1 = require("../../helpers/file");
/**
 * JSXScanner scans things in a js, jsx, ts, tsx document.
 * It was used as a child service of HTMLScanner.
 */
class JSXScanner extends text_scanner_1.TextScanner {
    supportedLanguages = ['css', 'less', 'scss', 'sass'];
    /** Scan a JSX / JS / TS / TSX document from a specified offset to find a CSS selector. */
    async scanSelector() {
        // <tag
        // 	 id="a'
        // 	 class="a"
        // 	 class="a b"
        // >
        let match = this.match(/<\w+\s*([\s\S]*?)>/g, /\b(?<type>id|class|className)\s*=\s*['"`](.*?)['"`]/g, /([\w-]+)/g);
        if (match) {
            if (match.groups.type === 'id') {
                return simple_selector_1.SimpleSelector.create('#' + match.text, match.index);
            }
            else if (match.groups.type === 'class' || match.groups.type === 'className') {
                return simple_selector_1.SimpleSelector.create('.' + match.text, match.index);
            }
        }
        // Syntax `:class.property=...`
        match = this.match(/\bclass\.([\w-]+)/g);
        if (match) {
            return simple_selector_1.SimpleSelector.create('.' + match.text, match.index);
        }
        // Syntax: `:class=${{property: boolean}}`.
        match = this.match(/\bclass\s*=\s*\$\{\s*\{(.*?)\}\s*\}/g, /(\w+)\s*:/g);
        if (match) {
            return simple_selector_1.SimpleSelector.create('.' + match.text, match.index);
        }
        // React syntax:
        // `class={['...']}, '...' part
        // `class={'...'}
        match = this.match(/\b(?:class|className)\s*=\s*\{((?:\{[\s\S]*?\}|.)*?)\}/g, /['"`](.*?)['"`]/g, /([\w-]+)/g);
        if (match) {
            return simple_selector_1.SimpleSelector.create('.' + match.text, match.index);
        }
        // React syntax:
        // `class={[..., {...}]}, {...} part.
        match = this.match(/\b(?:class|className)\s*=\s*\{((?:\{[\s\S]*?\}|.)*?)\}/g, /\{(.*?)\}/g, /(\w+)\s*:/g);
        if (match) {
            return simple_selector_1.SimpleSelector.create('.' + match.text, match.index);
        }
        // Due to https://github.com/gajus/babel-plugin-react-css-modules and issue #60.
        // `styleName='...'.
        match = this.match(/\bstyleName\s*=\s*['"`](.*?)['"`]/g, /([\w-]+)/g);
        if (match) {
            return this.scanDefaultCSSModule(match.text, match.index);
        }
        // React Module CSS, e.g.
        // `class={style.className}`.
        // `class={style['class-name']}`.
        match = this.match(/\b(?:class|className)\s*=\s*\{(.*?)\}/g, /(?<moduleName>\w+)(?:\.(\w+)|\[\s*['"`](\w+)['"`]\s*\])/);
        if (match) {
            return this.scanCSSModule(match.groups.moduelName, match.text, match.index);
        }
        // jQuery selector, e.g.
        // `$('.abc')`
        match = this.match(/\$\((.*?)\)/g, /['"`](.*?)['"`]/g, /(?<identifier>^|\s|.|#)([\w-]+)/g);
        if (match) {
            if (match.groups.identifier === '#' || match.groups.identifier === '.') {
                return simple_selector_1.SimpleSelector.create(match.groups.identifier + match.text, match.index);
            }
            else {
                return simple_selector_1.SimpleSelector.create(match.text, match.index);
            }
        }
        return null;
    }
    /** Scan imported CSS module. */
    async scanCSSModule(moduleName, moduleProperty, wordLeftOffset) {
        let modulePath = this.parseImportedPathFromVariableName(moduleName);
        if (modulePath) {
            let fullPath = await (0, file_1.resolveImportPath)(path.dirname(vscode_uri_1.URI.parse(this.document.uri).fsPath), modulePath);
            if (fullPath) {
                return simple_selector_1.SimpleSelector.create('.' + moduleProperty, wordLeftOffset, vscode_uri_1.URI.file(fullPath).toString());
            }
        }
        return simple_selector_1.SimpleSelector.create('.' + moduleProperty, wordLeftOffset);
    }
    /** Parse `import ...`. */
    parseImportedPathFromVariableName(nameToMatch) {
        let re = /import\s+(\w+)\s+from\s+['"`](.+?)['"`]/g;
        let match;
        while (match = re.exec(this.text)) {
            let name = match[1];
            if (name === nameToMatch) {
                return match[2];
            }
        }
        return null;
    }
    /** Scan imported CSS module. */
    async scanDefaultCSSModule(moduleProperty, wordLeftOffset) {
        let modulePath = this.parseDefaultImportedPath();
        if (modulePath) {
            let fullPath = await (0, file_1.resolveImportPath)(path.dirname(vscode_uri_1.URI.parse(this.document.uri).fsPath), modulePath);
            if (fullPath) {
                return simple_selector_1.SimpleSelector.create('.' + moduleProperty, wordLeftOffset, vscode_uri_1.URI.file(fullPath).toString());
            }
        }
        return simple_selector_1.SimpleSelector.create('.' + moduleProperty, wordLeftOffset);
    }
    /** Parse `import '....css'`. */
    parseDefaultImportedPath() {
        let re = /import\s+['"`](.+?)['"`]/g;
        let match;
        while (match = re.exec(this.text)) {
            let path = match[1];
            let extension = (0, file_1.getPathExtension)(path);
            if (this.supportedLanguages.includes(extension)) {
                return path;
            }
        }
        return null;
    }
    /** Scan for relative import path. */
    async scanForImportPath() {
        // import * from '...'
        // import abc from '...'
        // import '...'
        let modulePath = this.match(/import\s+(?:(?:\w+|\*)\s+from\s+)?['"`](.+?)['"`]/g)?.text || null;
        if (modulePath) {
            return await (0, file_1.resolveImportPath)(path.dirname(vscode_uri_1.URI.parse(this.document.uri).fsPath), modulePath);
        }
        return null;
    }
}
exports.JSXScanner = JSXScanner;
//# sourceMappingURL=jsx-scanner.js.map