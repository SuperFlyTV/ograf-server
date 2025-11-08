import Router from '@koa/router'
import { WebSocket } from 'ws'
import { JSONRPCServerAndClient, JSONRPCServer, JSONRPCClient } from 'json-rpc-2.0'
import { RendererManager } from './managers/RendererManager.js'

export function setupRendererApi(wsRouter: Router, rendererManager: RendererManager): void {
	// Set up websocket server, listen to connection requests at /rendererApi/v1
	wsRouter.all('/rendererApi/v1', async (ctx, next) => {
		// A client has connected,
		// accept the websocket upgrade request
		const ws: WebSocket = await ctx.upgrade()
		await next()

		setupClientConnection(ws, rendererManager)
	})
}

function setupClientConnection(ws: WebSocket, rendererManager: RendererManager) {
	console.log('New Renderer connected')
	const jsonRpcConnection = new JSONRPCServerAndClient(
		new JSONRPCServer(),
		new JSONRPCClient(async (request) => {
			try {
				ws.send(JSON.stringify(request))
				return Promise.resolve()
			} catch (error) {
				return Promise.reject(error instanceof Error ? error : new Error(`${error}`))
			}
		})
	)

	// Track Renderer
	const rendererInstance = rendererManager.addRenderer(jsonRpcConnection)

	// Register incoming methods:
	jsonRpcConnection.addMethod('unregister', rendererInstance.unregister)
	jsonRpcConnection.addMethod('register', rendererInstance.register)
	jsonRpcConnection.addMethod('onInfo', rendererInstance.onInfo)
	jsonRpcConnection.addMethod('debug', rendererInstance.debug)

	// Handle incoming messages
	ws.on('message', (message: Buffer) => {
		const messageString = message.toString()

		Promise.resolve()
			.then(async () => {
				try {
					await jsonRpcConnection.receiveAndSend(JSON.parse(messageString))
				} catch (error) {
					console.error('Error handling message:', error)
				}
			})
			.catch(console.error)
	})
	ws.on('close', (_code, reason) => {
		rendererManager.closeRenderer(rendererInstance)
		jsonRpcConnection.rejectAllPendingRequests(`Connection is closed (${reason}).`)
	})
}
