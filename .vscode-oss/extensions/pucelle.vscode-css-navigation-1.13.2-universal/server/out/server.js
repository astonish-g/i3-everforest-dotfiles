"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const simple_selector_1 = require("./languages/common/simple-selector");
const html_1 = require("./languages/html");
const css_1 = require("./languages/css");
const helpers_1 = require("./helpers");
const vscode_uri_1 = require("vscode-uri");
const utils_1 = require("./utils");
let connection = (0, vscode_languageserver_1.createConnection)(vscode_languageserver_1.ProposedFeatures.all);
let configuration;
let documents = new vscode_languageserver_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let server;
// Do initializing.
connection.onInitialize((params) => {
    let options = params.initializationOptions;
    configuration = options.configuration;
    server = new CSSNaigationServer(options);
    // Initialize console channel and log level.
    helpers_1.console.setLogEnabled(configuration.enableLogLevelMessage);
    helpers_1.console.pipeTo(connection);
    // Print error messages after unprojected promise.
    process.on('unhandledRejection', function (reason) {
        helpers_1.console.warn("Unhandled Rejection: " + reason);
    });
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: vscode_languageserver_1.TextDocumentSyncKind.Full
            },
            completionProvider: configuration.enableIdAndClassNameCompletion ? {
                resolveProvider: false
            } : undefined,
            definitionProvider: configuration.enableGoToDefinition,
            referencesProvider: configuration.enableFindAllReferences,
            workspaceSymbolProvider: configuration.enableWorkspaceSymbols
        }
    };
});
// Listening events.
connection.onInitialized(() => {
    if (configuration.enableGoToDefinition) {
        connection.onDefinition(helpers_1.console.logListQuerierExecutedTime(server.findDefinitions.bind(server), 'definition'));
    }
    if (configuration.enableWorkspaceSymbols) {
        connection.onWorkspaceSymbol(helpers_1.console.logListQuerierExecutedTime(server.findSymbolsMatchQueryParam.bind(server), 'workspace symbol'));
    }
    if (configuration.enableIdAndClassNameCompletion) {
        connection.onCompletion(helpers_1.console.logListQuerierExecutedTime(server.provideCompletion.bind(server), 'completion'));
    }
    if (configuration.enableFindAllReferences) {
        connection.onReferences(helpers_1.console.logListQuerierExecutedTime(server.findRefenerces.bind(server), 'reference'));
    }
});
documents.listen(connection);
connection.listen();
class CSSNaigationServer {
    options;
    cssServiceMap;
    htmlServiceMap = null;
    serviceMaps = [];
    constructor(options) {
        this.options = options;
        this.cssServiceMap = new css_1.CSSServiceMap(documents, {
            includeFileGlobPattern: helpers_1.file.generateGlobPatternFromExtensions(configuration.activeCSSFileExtensions),
            excludeGlobPattern: helpers_1.file.generateGlobPatternFromPatterns(configuration.excludeGlobPatterns) || undefined,
            alwaysIncludeGlobPattern: helpers_1.file.generateGlobPatternFromPatterns(configuration.alwaysIncludeGlobPatterns) || undefined,
            includeImportedFiles: configuration.alwaysIncludeImportedFiles,
            startPath: options.workspaceFolderPath,
            ignoreSameNameCSSFile: configuration.ignoreSameNameCSSFile && configuration.activeCSSFileExtensions.length > 1 && configuration.activeCSSFileExtensions.includes('css'),
            ignoreFilesBy: configuration.ignoreFilesBy,
        });
        this.serviceMaps = [this.cssServiceMap];
        // All those events can't been registered for twice, or the first one will not work.
        documents.onDidChangeContent((event) => {
            for (let map of this.serviceMaps) {
                map.onDocumentOpenOrContentChanged(event.document);
            }
        });
        documents.onDidSave((event) => {
            for (let map of this.serviceMaps) {
                map.onDocumentSaved(event.document);
            }
        });
        documents.onDidClose((event) => {
            for (let map of this.serviceMaps) {
                map.onDocumentClosed(event.document);
            }
        });
        connection.onDidChangeWatchedFiles((params) => {
            for (let map of this.serviceMaps) {
                map.onWatchedFileOrFolderChanged(params);
            }
        });
        helpers_1.console.log(`Server for workspace folder "${path.basename(this.options.workspaceFolderPath)}" started`);
    }
    /** Provide finding definition service. */
    async findDefinitions(positonParams) {
        let documentIdentifier = positonParams.textDocument;
        let document = documents.get(documentIdentifier.uri);
        if (!document) {
            return null;
        }
        let documentExtension = helpers_1.file.getPathExtension(document.uri);
        let position = positonParams.position;
        let isHTMLFile = configuration.activeHTMLFileExtensions.includes(documentExtension);
        let isCSSFile = configuration.activeCSSFileExtensions.includes(documentExtension);
        if (isHTMLFile) {
            return await this.findDefinitionsInHTMLLikeDocument(document, position);
        }
        else if (isCSSFile) {
            return await this.findDefinitionsInCSSLikeDocument(document, position);
        }
        return null;
    }
    /** In HTML files, or files that can include HTML codes. */
    async findDefinitionsInHTMLLikeDocument(document, position) {
        let locations = [];
        // After Clicking `<link rel="stylesheet" href="...">` or `<style src="...">`
        let resolvedImportPath = await html_1.HTMLService.getImportPathAt(document, position);
        if (resolvedImportPath) {
            locations.push(vscode_languageserver_1.Location.create(vscode_uri_1.URI.file(resolvedImportPath).toString(), vscode_languageserver_1.Range.create(0, 0, 0, 0)));
        }
        // Searching for normal css selector.
        else {
            let selector = await html_1.HTMLService.getSimpleSelectorAt(document, position);
            if (!selector) {
                return null;
            }
            // Is custom tag.
            if (configuration.ignoreCustomElement && simple_selector_1.SimpleSelector.isCustomTag(selector)) {
                return null;
            }
            // Having `@import...` in a JSX file.
            if (selector.importURI) {
                this.cssServiceMap.trackMoreFile(vscode_uri_1.URI.parse(selector.importURI).fsPath);
                await this.cssServiceMap.makeFresh();
                // Only find in one imported file.
                let cssService = await this.cssServiceMap.get(selector.importURI);
                if (cssService) {
                    return cssService.findDefinitionsMatchSelector(selector);
                }
                else {
                    return null;
                }
            }
            // Parse `<style src=...>` and load imported files.
            let resolvedImportPaths = await html_1.HTMLService.scanStyleImportPaths(document);
            for (let filePath of resolvedImportPaths) {
                this.cssServiceMap.trackMoreFile(filePath);
            }
            // Find across all CSS files.
            locations.push(...await this.cssServiceMap.findDefinitionsMatchSelector(selector));
            // Find in inner style tags.
            if (configuration.alsoSearchDefinitionsInStyleTag) {
                locations.unshift(...html_1.HTMLService.findDefinitionsInInnerStyle(document, selector));
            }
        }
        return locations;
    }
    /** In CSS files, or a sass file. */
    async findDefinitionsInCSSLikeDocument(document, position) {
        let locations = [];
        // Clicking `@import '...';` in a CSS file.
        let resolvedImportPath = await css_1.CSSService.getImportPathAt(document, position);
        if (resolvedImportPath) {
            locations.push(vscode_languageserver_1.Location.create(vscode_uri_1.URI.file(resolvedImportPath).toString(), vscode_languageserver_1.Range.create(0, 0, 0, 0)));
        }
        return locations;
    }
    /** Provide finding symbol service. */
    async findSymbolsMatchQueryParam(symbol) {
        let query = symbol.query;
        if (!query) {
            return null;
        }
        //should have at least one word character
        if (!/[a-z]/i.test(query)) {
            return null;
        }
        return await this.cssServiceMap.findSymbolsMatchQuery(query);
    }
    /** Provide auto completion service for HTML or CSS document. */
    async provideCompletion(params) {
        let documentIdentifier = params.textDocument;
        let document = documents.get(documentIdentifier.uri);
        let position = params.position;
        if (!document) {
            return null;
        }
        // HTML or CSS file.
        let documentExtension = helpers_1.file.getPathExtension(document.uri);
        let isHTMLFile = configuration.activeHTMLFileExtensions.includes(documentExtension);
        let isCSSFile = configuration.activeCSSFileExtensions.includes(documentExtension);
        if (isHTMLFile) {
            return await this.provideHTMLDocumentCompletion(document, position);
        }
        else if (isCSSFile) {
            return await this.provideCSSDocumentCompletion(document, position);
        }
        return null;
    }
    /** Provide completion for HTML document. */
    async provideHTMLDocumentCompletion(document, position) {
        // Search for current selector.
        let selector = await html_1.HTMLService.getSimpleSelectorAt(document, position);
        if (!selector || selector.type === simple_selector_1.SimpleSelector.Type.Tag) {
            return null;
        }
        // Having `@import...` in a JSX file, returns results that extactly in imported document.
        if (selector.importURI) {
            this.cssServiceMap.trackMoreFile(vscode_uri_1.URI.parse(selector.importURI).fsPath);
            await this.cssServiceMap.makeFresh();
            // Only find in one imported file.
            let cssService = await this.cssServiceMap.get(selector.importURI);
            if (cssService) {
                let labels = cssService.findCompletionLabelsMatchSelector(selector);
                return (0, utils_1.formatLabelsToCompletionItems)(labels, selector.startIndex, selector.raw.length, document);
            }
            else {
                return null;
            }
        }
        // Get auto completion labels.
        let labels = await this.cssServiceMap.findCompletionLabelsMatchSelector(selector);
        // Find completion in inner style tags.
        if (configuration.alsoSearchDefinitionsInStyleTag) {
            labels.unshift(...html_1.HTMLService.findCompletionLabelsInInnerStyle(document, selector));
        }
        return (0, utils_1.formatLabelsToCompletionItems)(labels, selector.startIndex, selector.raw.length, document);
    }
    /** Provide completion for CSS document. */
    async provideCSSDocumentCompletion(document, position) {
        // Searching for css selectors in current position.
        let selectorResults = css_1.CSSService.getSimpleSelectorResultsAt(document, position);
        if (!selectorResults) {
            return null;
        }
        this.ensureHTMLServiceMap();
        let completionItems = [];
        let havingReference = selectorResults.raw.startsWith('&');
        let parentSelectorNames = selectorResults.parentSelectors?.map(s => s.raw) || null;
        if (selectorResults.raw === '.' || selectorResults.raw === '#') {
            let labels = await this.htmlServiceMap.findCompletionLabelsMatch(selectorResults.raw);
            let items = (0, utils_1.formatLabelsToCompletionItems)(labels, selectorResults.startIndex, selectorResults.raw.length, document);
            completionItems.push(...items);
        }
        else {
            for (let selector of selectorResults.selectors) {
                let labels = await this.htmlServiceMap.findCompletionLabelsMatch(selector.raw);
                // `.a-bc`, parent `.a`,  -> `&-b`.
                if (labels.length > 0 && havingReference && parentSelectorNames) {
                    labels = labels.map(label => {
                        return (0, utils_1.removeReferencePrefix)(label, parentSelectorNames);
                    }).flat();
                }
                let items = (0, utils_1.formatLabelsToCompletionItems)(labels, selector.startIndex, selectorResults.raw.length, document);
                completionItems.push(...items);
            }
        }
        return completionItems;
    }
    /** Provide finding reference service. */
    async findRefenerces(params) {
        let documentIdentifier = params.textDocument;
        let document = documents.get(documentIdentifier.uri);
        let position = params.position;
        if (!document) {
            return null;
        }
        let documentExtension = helpers_1.file.getPathExtension(document.uri);
        let isHTMLFile = configuration.activeHTMLFileExtensions.includes(documentExtension);
        // Find HTML references inside a style tag.
        if (isHTMLFile && configuration.alsoSearchDefinitionsInStyleTag) {
            let htmlService = this.htmlServiceMap ? await this.htmlServiceMap.get(document.uri) : undefined;
            if (!htmlService) {
                htmlService = html_1.HTMLService.create(document);
            }
            let locations = html_1.HTMLService.findReferencesInInnerHTML(document, position, htmlService);
            if (locations) {
                return locations;
            }
        }
        let selectors = [];
        let locations = [];
        // From current HTML document.
        if (isHTMLFile) {
            let selector = await html_1.HTMLService.getSimpleSelectorAt(document, position);
            if (selector) {
                selectors.push(selector);
            }
        }
        // From current CSS document.
        let isCSSFile = configuration.activeCSSFileExtensions.includes(documentExtension);
        if (isCSSFile) {
            selectors.push(...css_1.CSSService.getSimpleSelectorsAt(document, position) || []);
        }
        // From HTML documents.
        if (selectors.length > 0) {
            this.ensureHTMLServiceMap();
            for (let selector of selectors) {
                locations.push(...await this.htmlServiceMap.findReferencesMatchSelector(selector));
            }
        }
        return locations;
    }
    /** Ensure having HTML service map. */
    ensureHTMLServiceMap() {
        let { options } = this;
        if (!this.htmlServiceMap) {
            this.htmlServiceMap = new html_1.HTMLServiceMap(documents, {
                includeFileGlobPattern: helpers_1.file.generateGlobPatternFromExtensions(configuration.activeHTMLFileExtensions),
                excludeGlobPattern: helpers_1.file.generateGlobPatternFromPatterns(configuration.excludeGlobPatterns) || undefined,
                startPath: options.workspaceFolderPath
            });
            this.serviceMaps.push(this.htmlServiceMap);
        }
    }
}
//# sourceMappingURL=server.js.map