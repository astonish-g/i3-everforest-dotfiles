"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkDirectoryToMatchFiles = void 0;
const fs = require("fs-extra");
const path = require("path");
const minimatch_1 = require("minimatch");
class FileWalker {
    /** Current working directory, default value is `CWD`. */
    currentDir;
    /** Ignores file names, default value is `.gitignore`. */
    ignoreFileNames;
    /** Whether follow symbol links. */
    followSymbolLinks;
    constructor(options) {
        this.currentDir = options.currentDir ?? process.cwd();
        this.ignoreFileNames = options.ignoreFileNames || ['.gitignore'];
        this.followSymbolLinks = options.followSymbolLinks ?? false;
    }
    /** Generate relative paths relative to current directory. */
    async *walk() {
        for await (let relPath of this.walkRecursively('')) {
            yield relPath;
        }
    }
    async *walkRecursively(relDir, ignoreRules = []) {
        let fileNames = await fs.readdir(path.join(this.currentDir, relDir));
        for (let fileName of fileNames) {
            if (this.isIgnoreFile(fileName)) {
                // Must regenerate array.
                ignoreRules = [...ignoreRules, ...await this.parseIgnoreRules(relDir, fileName)];
            }
        }
        // May parallel to increase speed, but will break generator logic.
        for (let fileName of fileNames) {
            if (fileName.startsWith('.')) {
                continue;
            }
            let relPath = path.join(relDir, fileName);
            let stat = await this.readStat(relPath);
            if (this.matchIgnoreRules(relPath, ignoreRules)) {
                continue;
            }
            if (stat.isDirectory()) {
                for await (let subRelPath of this.walkRecursively(relPath, ignoreRules)) {
                    yield subRelPath;
                }
            }
            else {
                yield relPath;
            }
        }
    }
    isIgnoreFile(name) {
        return this.ignoreFileNames.includes(name);
    }
    async readStat(relPath) {
        let absPath = path.join(this.currentDir, relPath);
        return this.followSymbolLinks ? await fs.stat(absPath) : await fs.lstat(absPath);
    }
    async parseIgnoreRules(relDir, fileName) {
        let absPath = path.join(this.currentDir, relDir, fileName);
        let text = await fs.readFile(absPath, 'utf8');
        let globOptions = {
            matchBase: true,
            dot: true,
            flipNegate: true,
            nocase: true
        };
        let ruleLines = text.split(/\r?\n/)
            .filter(line => !/^#|^$/.test(line.trim()));
        // Here it doesn't supports expressions like `!XXX`.
        let rules = ruleLines.map(pattern => {
            if (pattern.startsWith('/')) {
                pattern = pattern.slice(1);
            }
            else {
                pattern = '{**/,}' + pattern;
            }
            if (pattern.endsWith('/')) {
                pattern = pattern.replace(/\/$/, '{/**,}');
            }
            return {
                relDir,
                match: new minimatch_1.Minimatch(pattern, globOptions),
            };
        });
        return rules;
    }
    matchIgnoreRules(relPath, ignoreRules) {
        for (let rule of ignoreRules) {
            let pathRelToRule = path.relative(rule.relDir, relPath);
            if (rule.match.match(pathRelToRule)) {
                return true;
            }
        }
        return false;
    }
}
/** Will walk the file paths, generate each absolute paths, not include folder path. */
async function* walkDirectoryToMatchFiles(currentDir, ignoreFileNames) {
    let walker = new FileWalker({
        currentDir,
        ignoreFileNames,
        followSymbolLinks: false,
    });
    for await (let relPath of walker.walk()) {
        yield path.join(currentDir, relPath);
    }
}
exports.walkDirectoryToMatchFiles = walkDirectoryToMatchFiles;
//# sourceMappingURL=file-walker.js.map