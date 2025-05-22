import Router from "@koa/router";
import * as RendererAPI from "./types/rendererAPI";
import { WebSocket } from "ws";
import {
  JSONRPCServerAndClient,
  JSONRPCServer,
  JSONRPCClient,
} from "json-rpc-2.0";
import { RendererManager } from "./managers/RendererManager";
import { GraphicsStore } from "./managers/GraphicsStore";

export function setupRendererApi(
  wsRouter: Router,
  rendererManager: RendererManager
): void {
  // Set up websocket server, listen to connection requests at /rendererApi/v1
  wsRouter.all("/rendererApi/v1", async (ctx, next) => {
    // A client has connected,
    // accept the websocket upgrade request
    const ws: WebSocket = await ctx.upgrade();
    await next();

    setupClientConnection(ws, rendererManager);
  });
}

function setupClientConnection(
  ws: WebSocket,
  rendererManager: RendererManager
) {
  console.log("New Renderer connected");
  const jsonRpcConnection = new JSONRPCServerAndClient(
    new JSONRPCServer(),
    new JSONRPCClient((request) => {
      try {
        ws.send(JSON.stringify(request));
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      }
    })
  );

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
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });
  ws.on("close", (code, reason) => {
    rendererManager.closeRenderer(rendererInstance);
    jsonRpcConnection.rejectAllPendingRequests(
      `Connection is closed (${reason}).`
    );
  });
}
