"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RendererManager = void 0;
class RendererManager {
    constructor() {
        this.rendererInstances = new Set();
        this.registeredRenderers = new Map();
    }
    addRenderer(jsonRpcConnection) {
        // const id = RendererInstance.ID()
        const rendererInstance = new RendererInstance(this, jsonRpcConnection);
        this.rendererInstances.add(rendererInstance);
        return rendererInstance;
    }
    closeRenderer(rendererInstance) {
        this.rendererInstances.delete(rendererInstance);
        if (rendererInstance.info)
            this.registeredRenderers.delete(rendererInstance.info.id);
    }
    registerRenderer(rendererInstance, id) {
        this.registeredRenderers.set(id, rendererInstance);
    }
    /** A ServerAPI Method */
    async listRenderers() {
        const renderers = [];
        for (const rendererInstance of this.rendererInstances) {
            console.log("rendererInstance", rendererInstance);
            if (!rendererInstance.info)
                continue;
            renderers.push(rendererInstance.info);
        }
        return renderers;
    }
    /** A ServerAPI Method */
    async getRendererInstance(id) {
        return this.registeredRenderers.get(id);
    }
}
exports.RendererManager = RendererManager;
class RendererInstance {
    constructor(manager, jsonRpcConnection) {
        this.manager = manager;
        this.jsonRpcConnection = jsonRpcConnection;
        // static ID(): string {
        //     return `renderer-${RendererInstance._ID++}`
        // }
        this.isRegistered = false;
        this._manifest = null;
        /** Methods that can be called on the Renderer */
        this.api = {
            getManifest: (payload) => this.jsonRpcConnection.request("getManifest", payload),
            // listGraphicInstances: (payload) => this.jsonRpcConnection.request('listGraphicInstances', payload),
            getInfo: (payload) => this.jsonRpcConnection.request("getInfo", payload),
            getTargetStatus: (payload) => this.jsonRpcConnection.request("getTargetStatus", payload),
            invokeRendererAction: (payload) => this.jsonRpcConnection.request("invokeRendererAction", payload),
            loadGraphic: (payload) => this.jsonRpcConnection.request("loadGraphic", payload),
            clearGraphic: (payload) => this.jsonRpcConnection.request("clearGraphic", payload),
            invokeGraphicUpdateAction: (payload) => this.jsonRpcConnection.request("invokeGraphicUpdateAction", payload),
            invokeGraphicPlayAction: (payload) => this.jsonRpcConnection.request("invokeGraphicPlayAction", payload),
            invokeGraphicStopAction: (payload) => this.jsonRpcConnection.request("invokeGraphicStopAction", payload),
            invokeGraphicCustomAction: (payload) => this.jsonRpcConnection.request("invokeGraphicCustomAction", payload),
        };
        this.register = async (payload) => {
            // JSONRPC METHOD, called by the Renderer
            this.isRegistered = true;
            let id;
            if (payload.info.id === undefined || payload.info.id === "") {
                id = `renderer:${RendererInstance.RandomIndex++}`;
            }
            else {
                id = `renderer-${payload.info.id}`;
            }
            this.info = {
                ...payload.info,
                id,
            };
            if (!this.info.name)
                this.info.name = id;
            this.manager.registerRenderer(this, this.info.id);
            console.log(`Renderer "${id}" registered`);
            setTimeout(() => {
                // Ask the renderer for its manifest and initial status
                this.updateManifest().catch(console.error);
                this.updateInfo().catch(console.error);
            }, 10);
            return {
                rendererId: this.info.id,
            };
        };
        this.unregister = async () => {
            // JSONRPC METHOD, called by the Renderer
            this.isRegistered = false;
            this.manager.closeRenderer(this);
            return {};
        };
        this.onInfo = async (payload) => {
            var _a, _b;
            // JSONRPC METHOD, called by the Renderer
            if (!this.isRegistered)
                throw new Error("Renderer is not registered");
            this.info = {
                ...payload.info,
                id: (_b = (_a = this.info) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : "N/A",
            };
            return {};
        };
        this.debug = async (payload) => {
            // JSONRPC METHOD, called by the Renderer
            if (!this.isRegistered)
                throw new Error("Renderer is not registered");
            console.log("DEBUG Renderer", payload.message);
            return {};
        };
    }
    async updateManifest() {
        const result = await this.api.getManifest({});
        this._manifest = result.rendererManifest;
    }
    async updateInfo() {
        var _a, _b;
        const result = await this.api.getInfo({});
        this.info = {
            ...result.rendererInfo,
            id: (_b = (_a = this.info) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : "N/A",
        };
    }
}
RendererInstance.RandomIndex = 0;
