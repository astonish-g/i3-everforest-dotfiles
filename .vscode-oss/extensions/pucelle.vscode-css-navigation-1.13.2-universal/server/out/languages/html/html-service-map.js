"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLServiceMap = void 0;
const html_service_1 = require("./html-service");
const helpers_1 = require("../../helpers");
class HTMLServiceMap extends helpers_1.FileTracker {
    serviceMap = new Map();
    onFileTracked() { }
    onFileExpired(uri) {
        this.serviceMap.delete(uri);
    }
    onFileUntracked(uri) {
        this.serviceMap.delete(uri);
    }
    async parseDocument(uri, document) {
        this.serviceMap.set(uri, html_service_1.HTMLService.create(document));
    }
    /** Get service by uri. */
    async get(uri) {
        await this.makeFresh();
        return this.serviceMap.get(uri);
    }
    async findReferencesMatchSelector(selector) {
        await this.makeFresh();
        let locations = [];
        for (let htmlService of this.serviceMap.values()) {
            locations.push(...htmlService.findLocationsMatchSelector(selector));
        }
        return locations;
    }
    /** Find completion label in for CSS document, from selectors in HTML document. */
    async findCompletionLabelsMatch(prefix) {
        await this.makeFresh();
        let labels = [];
        for (let htmlService of this.serviceMap.values()) {
            labels.push(...htmlService.findCompletionLabelsMatch(prefix));
        }
        return labels;
    }
}
exports.HTMLServiceMap = HTMLServiceMap;
//# sourceMappingURL=html-service-map.js.map