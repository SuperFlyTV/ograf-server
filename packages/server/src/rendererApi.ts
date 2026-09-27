import type { Server as HttpServer, IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { WebSocket, WebSocketServer } from 'ws'
import { JSONRPCServerAndClient, JSONRPCServer, JSONRPCClient } from 'json-rpc-2.0'
import { RendererManagerNS } from './managers/RendererManager.js'
import { Namespaces } from './managers/NS.js'
import { ConfigOptions } from './config.js'

/**
 * Sets up the Renderer API: a websocket endpoint at /rendererApi/v1
 * (prefixed with /api and, in namespace mode, /api/:namespaceId).
 *
 * The upgrade is handled on the http server's 'upgrade' event, NOT from inside a
 * regular request handler. Upgrading from a request handler leaves Node's HTTP
 * parser attached to the socket: every websocket frame is then fed to the parser
 * as the start of a new request, its headersTimeout (60 s) expires, and Node
 * writes "HTTP/1.1 408 Request Timeout" into the websocket stream and destroys
 * the socket. That dropped every Renderer about once a minute.
 */
export function setupRendererApi(config: ConfigOptions, server: HttpServer, namespaces: Namespaces): void {
	const wsServer = new WebSocketServer({ noServer: true })

	const pathPattern = config.namespacePath
		? /^\/api\/(?<namespaceId>[^/]+)\/rendererApi\/v1\/?$/
		: /^\/api\/rendererApi\/v1\/?$/

	server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
		Promise.resolve()
			.then(async () => {
				const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
				const m = pathname.match(pathPattern)
				if (!m) return rejectUpgrade(socket, 404, 'Not Found')

				const ns = await namespaces.getNS(m.groups?.namespaceId ?? '')
				if (!ns) return rejectUpgrade(socket, 404, 'Namespace not found')

				wsServer.handleUpgrade(req, socket, head, (ws) => {
					setupClientConnection(ws, ns.rendererManager)
				})
			})
			.catch((err) => {
				console.error('Error handling websocket upgrade:', err)
				rejectUpgrade(socket, 500, 'Internal Server Error')
			})
	})
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
	socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`)
	socket.destroy()
}

function setupClientConnection(ws: WebSocket, rendererManager: RendererManagerNS) {
	const label = `Renderer ${rendererManager.namespaceId}`

	console.log(`${label}: New Renderer connected`)
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

	// Keepalive ping/pong heartbeat
	let isAlive = true
	ws.on('pong', () => {
		isAlive = true
	})
	const pingInterval = setInterval(() => {
		if (!isAlive) {
			console.log(`${label}: Renderer heartbeat timeout, terminating`)
			ws.terminate()
			return
		}
		isAlive = false
		ws.ping()
	}, 30000)

	// Handle incoming messages:
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
		clearInterval(pingInterval)
		rendererInstance.onClose()

		jsonRpcConnection.rejectAllPendingRequests(`Connection is closed (${reason}).`)

		console.log(`${label}: Renderer disconnected`)
	})
	ws.on('error', (err) => {
		console.error(`${label}: Error: ${err}`)
	})
}
