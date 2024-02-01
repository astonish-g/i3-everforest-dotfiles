"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSNavigationExtension = exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const util_1 = require("./util");
process.on('unhandledRejection', function (reason) {
    console.log("Unhandled Rejection: ", reason);
});
let extension;
/** Output interface to activate plugin. */
function activate(context) {
    extension = new CSSNavigationExtension(context);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('CSSNavigation')) {
            extension.loadConfig();
            extension.restartAllClients();
        }
    }), vscode.workspace.onDidOpenTextDocument((document) => {
        extension.ensureClientForOpenedDocument(document);
    }), vscode.workspace.onDidChangeWorkspaceFolders(event => {
        for (let folder of event.removed) {
            extension.stopClient(folder);
        }
        // Even only removes a folder, we may still need to restart all servers for every folder,
        // because some client folder may be contained in removed folders.
        extension.ensureClients();
    }));
    return extension;
}
exports.activate = activate;
/** Output interface to deactivate plugin. */
function deactivate() {
    return extension.stopAllClients();
}
exports.deactivate = deactivate;
class CSSNavigationExtension {
    /** Channel public for testing. */
    channel = vscode.window.createOutputChannel('CSS Navigation');
    context;
    config;
    clients = new Map();
    gitIgnoreWatchers = new Map();
    constructor(context) {
        this.context = context;
        this.loadConfig();
        this.ensureClients();
    }
    /** Load or reload configuration. */
    loadConfig() {
        this.config = vscode.workspace.getConfiguration('CSSNavigation');
    }
    /** Get configuration object. */
    getConfigObject() {
        let config = this.config;
        return {
            enableGoToDefinition: config.get('enableGoToDefinition', true),
            enableIdAndClassNameCompletion: config.get('enableIdAndClassNameCompletion', true),
            enableWorkspaceSymbols: config.get('enableWorkspaceSymbols', true),
            enableFindAllReferences: config.get('enableFindAllReferences', true),
            activeHTMLFileExtensions: config.get('activeHTMLFileExtensions', []),
            activeCSSFileExtensions: config.get('activeCSSFileExtensions', []),
            excludeGlobPatterns: config.get('excludeGlobPatterns') || [],
            alwaysIncludeGlobPatterns: config.get('alwaysIncludeGlobPatterns', []),
            alwaysIncludeImportedFiles: config.get('alwaysIncludeImportedFiles', true),
            alsoSearchDefinitionsInStyleTag: config.get('alsoSearchDefinitionsInStyleTag', false),
            ignoreSameNameCSSFile: config.get('ignoreSameNameCSSFile', true),
            ignoreCustomElement: config.get('ignoreCustomElement', false),
            ignoreFilesBy: config.get('ignoreFilesBy', []),
            enableLogLevelMessage: config.get('enableLogLevelMessage', false),
        };
    }
    /** Sync server with workspace folders. */
    ensureClients() {
        let searchAcrossWorkspaceFolders = this.config.get('searchAcrossWorkspaceFolders', false);
        if (searchAcrossWorkspaceFolders) {
            for (let workspaceFolder of vscode.workspace.workspaceFolders || []) {
                this.ensureClientForworkspace(workspaceFolder);
            }
        }
        else {
            for (let document of vscode.workspace.textDocuments) {
                this.ensureClientForOpenedDocument(document);
            }
        }
    }
    /** Make sure client to be started for workspace folder. */
    ensureClientForworkspace(workspaceFolder) {
        let workspaceURI = workspaceFolder.uri.toString();
        let workspaceURIs = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri.toString());
        let outmostWorkspaceURI = (0, util_1.getOutmostWorkspaceURI)(workspaceURI, workspaceURIs);
        //was covered by another folder, stop it
        if (outmostWorkspaceURI && workspaceURI !== outmostWorkspaceURI && this.clients.has(workspaceURI)) {
            this.stopClient(workspaceFolder);
        }
        if (outmostWorkspaceURI && !this.clients.has(outmostWorkspaceURI)) {
            let workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(outmostWorkspaceURI));
            if (workspaceFolder) {
                this.startClientFor(workspaceFolder);
            }
        }
    }
    /** If client and server is not exist for workspace, start it. */
    ensureClientForOpenedDocument(document) {
        if (document.uri.scheme !== 'file') {
            return;
        }
        let activeHTMLFileExtensions = this.config.get('activeHTMLFileExtensions', []);
        let activeCSSFileExtensions = this.config.get('activeCSSFileExtensions', []);
        let extension = (0, util_1.getPathExtension)(document.uri.fsPath);
        if (!activeHTMLFileExtensions.includes(extension) && !activeCSSFileExtensions.includes(extension)) {
            return;
        }
        // Not in any workspace.
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return;
        }
        this.ensureClientForworkspace(workspaceFolder);
    }
    /** Start client & server for workspace folder. */
    async startClientFor(workspaceFolder) {
        let workspaceFolderPath = workspaceFolder.uri.fsPath;
        let activeHTMLFileExtensions = this.config.get('activeHTMLFileExtensions', []);
        let activeCSSFileExtensions = this.config.get('activeCSSFileExtensions', []);
        let searchAcrossWorkspaceFolders = this.config.get('searchAcrossWorkspaceFolders', false);
        let serverModule = this.context.asAbsolutePath(path.join('server', 'out', 'server.js'));
        // One port for only one server to debug should be ok.
        let debugOptions = { execArgv: ["--nolazy", '--inspect=6009'] };
        let serverOptions = {
            run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
            debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
        };
        // To notify open / close / content changed for html & css files in specified range, and provide language service.
        let htmlCSSPattern = (0, util_1.generateGlobPatternFromExtensions)([...activeHTMLFileExtensions, ...activeCSSFileExtensions]);
        let configuration = this.getConfigObject();
        let clientOptions = {
            documentSelector: [{
                    scheme: 'file',
                    //language: 'plaintext', //plaintext is not work, just ignore it if match all plaintext files
                    pattern: searchAcrossWorkspaceFolders ? htmlCSSPattern : `${workspaceFolderPath}/${htmlCSSPattern}`
                }],
            // `connection.console` will use this channel as output channel.
            outputChannel: this.channel,
            synchronize: {
                // Same as client.register(DidChangeConfigurationNotification.type), config section changes will be captured by `onDidChangeConfiguration` in server.
                //configurationSection: 'CSSNavigation',
                // To notify the server workspace file or folder changes, no matter changes come from vscode or outside, and trigger `onDidChangeWatchedFiles`.
                fileEvents: vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolderPath, `**`))
            },
            initializationOptions: {
                workspaceFolderPath,
                configuration
            }
        };
        let client = new vscode_languageclient_1.LanguageClient('css-navigation', 'CSS Navigation', serverOptions, clientOptions);
        client.start();
        this.clients.set(workspaceFolder.uri.toString(), client);
        this.showChannelMessage((0, util_1.getTimeMarker)()
            + `Client for workspace folder "${workspaceFolder.name}" started`
            + (searchAcrossWorkspaceFolders ? ', and search across all workspace folders.' : ''));
        this.watchGitIgnoreFile(workspaceFolder);
    }
    async restartClient(workspaceFolder) {
        await this.stopClient(workspaceFolder);
        this.ensureClients();
    }
    /** Stop one client and matched server. */
    async stopClient(workspaceFolder) {
        this.unwatchLastWatchedGitIgnoreFile(workspaceFolder);
        let uri = workspaceFolder.uri.toString();
        let client = this.clients.get(uri);
        if (client) {
            this.clients.delete(uri);
            await client.stop();
            this.showChannelMessage((0, util_1.getTimeMarker)() + `Client for workspace folder "${workspaceFolder.name}" stopped`);
        }
    }
    /** Push message to output channel. */
    showChannelMessage(message) {
        this.channel.appendLine(message);
    }
    /** Restart all clients and servers. */
    async restartAllClients() {
        await this.stopAllClients();
        this.ensureClients();
    }
    /** Stop all clients and servers. */
    async stopAllClients() {
        let promises = [];
        for (let uri of this.clients.keys()) {
            let workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(uri));
            if (workspaceFolder) {
                this.stopClient(workspaceFolder);
            }
        }
        await Promise.all(promises);
        this.clients.clear();
    }
    /** Only watch `.gitignore` in root directory. */
    watchGitIgnoreFile(workspaceFolder) {
        this.unwatchLastWatchedGitIgnoreFile(workspaceFolder);
        let watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceFolder.uri.fsPath, `.gitignore`));
        let onGitIgnoreChange = () => {
            this.restartClient(workspaceFolder);
        };
        watcher.onDidCreate(onGitIgnoreChange);
        watcher.onDidDelete(onGitIgnoreChange);
        watcher.onDidChange(onGitIgnoreChange);
        this.gitIgnoreWatchers.set(workspaceFolder.uri.fsPath, watcher);
    }
    /** unwatch `.gitignore`. */
    unwatchLastWatchedGitIgnoreFile(workspaceFolder) {
        let watcher = this.gitIgnoreWatchers.get(workspaceFolder.uri.fsPath);
        if (watcher) {
            watcher.dispose();
        }
    }
}
exports.CSSNavigationExtension = CSSNavigationExtension;
//# sourceMappingURL=extension.js.map