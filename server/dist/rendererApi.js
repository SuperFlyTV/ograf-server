"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRendererApi = setupRendererApi;
const json_rpc_2_0_1 = require("json-rpc-2.0");
function setupRendererApi(wsRouter, rendererManager) {
    // Set up websocket server, listen to connection requests at /rendererApi/v1
    wsRouter.all("/rendererApi/v1", async (ctx, next) => {
        // A client has connected,
        // accept the websocket upgrade request
        const ws = await ctx.upgrade();
        await next();
        setupClientConnection(ws, rendererManager);
    });
}
function setupClientConnection(ws, rendererManager) {
    console.log("New Renderer connected");
    const jsonRpcConnection = new json_rpc_2_0_1.JSONRPCServerAndClient(new json_rpc_2_0_1.JSONRPCServer(), new json_rpc_2_0_1.JSONRPCClient((request) => {
        try {
            ws.send(JSON.stringify(request));
            return Promise.resolve();
        }
        catch (error) {
            return Promise.reject(error);
        }
    }));
    // Track Renderer
    const rendererInstance = rendererManager.addRenderer(jsonRpcConnection);
    // Register incoming methods:
    jsonRpcConnection.addMethod("unregister", rendererInstance.unregister);
    jsonRpcConnection.addMethod("register", rendererInstance.register);
    jsonRpcConnection.addMethod("onInfo", rendererInstance.onInfo);
    jsonRpcConnection.addMethod("debug", rendererInstance.debug);
    // Handle incoming messages
    ws.on("message", (message) => {
        const messageString = message.toString();
        // console.log('got message', messageString)
        try {
            jsonRpcConnection.receiveAndSend(JSON.parse(messageString));
        }
        catch (error) {
            console.error("Error handling message:", error);
        }
    });
    ws.on("close", (code, reason) => {
        rendererManager.closeRenderer(rendererInstance);
        jsonRpcConnection.rejectAllPendingRequests(`Connection is closed (${reason}).`);
    });
}
