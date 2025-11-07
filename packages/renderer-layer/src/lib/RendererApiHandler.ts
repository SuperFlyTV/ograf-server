import * as OGraf from 'ograf'
import { LayersManager, RenderTarget } from './LayersManager.js'

export class RendererApiHandler {
	// this.layersManager = layersManager
	// constructor(layersManager) {
	private messageId = 0

	private waitingForReply = new Map<number, { resolve: (result: unknown) => void; reject: (e: unknown) => void }>()
	private ws: WebSocket | null = null
	public actions: Record<string, (params: unknown) => void> = {}

	private rendererId = 'N/A'

	private connected = false

	private rendererApiUrl: string | undefined = undefined

	/** Unix timestamp, last reconnect attempt*/
	private lastReconnect = 0

	constructor(
		private layersManager: LayersManager,
		private info: {
			rendererId: string | undefined
			rendererName: string
		}
	) {
		this.actions['shake-it'] = (params: any) => {
			const el = document.querySelector('#main-container') as HTMLDivElement | null

			if (!el) return

			const endTime = Date.now() + (params.duration || 0)

			const shakeIt = () => {
				if (Date.now() < endTime) {
					el.style.transform = `rotate3d(${Math.random()}, ${Math.random()}, ${Math.random()}, ${Math.random() * 5}deg)`

					setTimeout(() => {
						shakeIt()
					}, 1000 / 30)
				} else {
					el.style.transform = ''
				}
			}
			shakeIt()
		}

		// Reconnection logic:
		setInterval(() => {
			if (!this.rendererApiUrl) return
			if (this.connected) return

			const timeSinceLastReconnect = Date.now() - this.lastReconnect
			if (timeSinceLastReconnect < 5000) return

			this.lastReconnect = Date.now()
			this.connect()
		}, 1000)
	}
	connect(rendererApiUrl?: string) {
		if (rendererApiUrl) this.rendererApiUrl = rendererApiUrl

		if (!this.rendererApiUrl) throw new Error('Not rendererApiUrl set!')

		console.log('connecting to Renderer API at', this.rendererApiUrl)
		this.ws = new WebSocket(this.rendererApiUrl)

		this.ws.onopen = (ev) => {
			console.log('Connected to Renderer API', ev)

			this.connected = true

			// The first thing the render MUST do after connecting is send a "register" message
			this._sendMessage('register', {
				info: this.getInfo().rendererInfo,
			})
				.then((response: any) => {
					console.log('Registered, ready to go!')
					this.rendererId = response.rendererId
				})
				.catch((error) => {
					console.error('Failed to register with Renderer API:', error)
				})
		}

		this.ws.onmessage = (event) => {
			console.log('Received message:', event.data)
			const message = JSON.parse(event.data) as WsMessage

			// Handle incoming message:

			if ('method' in message) {
				try {
					const fcn = (this as any)[message.method]
					if (typeof fcn === 'function') {
						Promise.resolve(fcn.call(this, message.params))
							.then((result) => {
								this._replyMessage(message.id, null, result)
							})
							.catch((err) => {
								console.error(err)
								this._replyMessage(message.id, { code: 400, message: err.message }, null)
							})
					} else {
						throw new Error(`Unknown method: "${message.method}"`)
					}
				} catch (err) {
					console.error('Error handling message:', err)
					this._replyMessage(message.id, { code: 400, message: err instanceof Error ? err.message : `${err}` }, null)
				}
			} else {
				// is a reply
				const waiting = this.waitingForReply.get(message.id)
				if (!waiting) return
				if ('error' in message) {
					waiting.reject(message.error)
				} else {
					waiting.resolve(message.result)
				}
			}
		}

		this.ws.onclose = (ev) => {
			console.log('Connection to Renderer API closed', ev)

			this.connected = false
		}

		this.ws.onerror = (error) => {
			console.error('Error in connection to Renderer API:', error)
		}
	}
	_sendMessage(method: string, params: unknown) {
		console.log('Send message', method, params)
		/*
                        register: (params: { info: Partial<RendererInfo> } & VendorExtend) => PromiseLike<EmptyPayload>
                        unregister: (params: EmptyPayload) => PromiseLike<EmptyPayload>
                        status: (params: { status: RendererInfo } & VendorExtend) => PromiseLike<EmptyPayload>
                        debug: (params: { message: string } & VendorExtend) => PromiseLike<EmptyPayload>
                    */

		return new Promise((resolve, reject) => {
			if (!this.ws) throw new Error('Not connected to Renderer API!')

			const id = this.messageId++
			this.ws.send(
				JSON.stringify({
					jsonrpc: '2.0',
					id,
					method,
					params,
				})
			)
			this.waitingForReply.set(id, { resolve, reject })
		})
	}
	_replyMessage(id: number, error: unknown, result: unknown) {
		if (!this.ws) throw new Error('Not connected to Renderer API!')

		console.log('send Reply', error, result)
		if (error) {
			this.ws.send(
				JSON.stringify({
					jsonrpc: '2.0',
					id,
					error,
				})
			)
		} else {
			this.ws.send(
				JSON.stringify({
					jsonrpc: '2.0',
					id,
					result: result ?? null,
				})
			)
		}
	}

	getManifest() {
		// JSON RPC Method
		return {
			rendererManifest: {
				id: this.rendererId,
				name: this.info.rendererName,
				description: 'A basic browser-based, layered Renderer',
				actions: {},

				renderTargets: this.layersManager.getAllLayers().map((layer) => {
					return {
						id: layer.renderTarget,
						name: layer.name,
						// description: `Layer ${layer.id}`
					}
				}),
			},
		}
	}
	// listGraphicInstances (_params) {
	//     // JSON RPC Method
	//     return { graphicInstances: layersManager.listGraphicInstances() }
	// }
	getInfo() {
		// JSON RPC Method
		return {
			rendererInfo: {
				id: this.info.rendererId || '',
				name: this.info.rendererName,
				// description?: string
				// targets: this.layersManager.getAllLayers().map((layer) => ({
				//   id: layer.id,
				//   name: `Layer ${layer.id}`,
				//   // description: `Layer ${layer.id}`
				// })),
				customActions: [
					{
						id: 'shake-it',
						name: 'Shake it up!',
						schema: {
							type: 'object',
							properties: {
								duration: {
									type: 'number',
									title: 'Duration (ms)',
									default: 2000,
								},
							},
						},
					},
				],
				renderTargetSchema: {
					type: 'object',
					properties: {
						layerId: {
							/**
							 * This Renderer uses a string to identify its layers:
							 * Using the GDD Select to define the layer.
							 * @see https://superflytv.github.io/GraphicsDataDefinition/#select
							 */
							type: 'string',
							title: 'Layer',
							enum: this.layersManager.getAllLayers().map((layer) => layer.renderTarget.layerId),
							gddType: 'select',
							gddOptions: {
								labels: Object.fromEntries(
									this.layersManager.getAllLayers().map((layer) => [layer.renderTarget.layerId, layer.name])
								),
							},
						},
					},
					default: this.layersManager.getAllLayers()[0].renderTarget,
				},
				// renderCharacteristics?: components["schemas"]["RenderCharacteristics"];
				status: {
					status: 'ok', // OK, WARNING, ERROR
					// message: ''
					renderTargets: this.layersManager
						.getAllLayers()
						.map((layer) => {
							if (!layer.graphicInstance) return null

							return layer.getInfo()
						})
						.filter(Boolean),
				},
			},
		}
	}
	getTargetStatus(params: { renderTarget: RenderTarget }) {
		// JSON RPC Method
		// console.log("getTargetStatus", getTargetStatus);

		const layer = this.layersManager.getLayer(params.renderTarget)
		if (!layer) throw new Error(`Layer not found: ${JSON.stringify(params.renderTarget)}`)

		return {
			renderTargetInfo: layer.getInfo(),
		}
	}
	/** Invokes an action on the Renderer. Actions are defined by the Renderer Manifest */
	async invokeRendererAction(params: {
		action: {
			id: string
			payload: unknown
		}
	}) {
		console.log('incoke', params)
		// JSON RPC Method
		const fcn = this.actions[params.action.id]
		if (!fcn) throw new Error(`Unknown action: ${params.action.id}`)
		return { value: await fcn(params.action.payload) }
	}

	/** Instantiate a Graphic on a RenderTarget. Returns when the load has finished. */
	async loadGraphic(params: {
		renderTarget: RenderTarget
		graphicId: string
		params: {
			data: unknown
		}
	}) {
		// JSON RPC Method
		const layer = this.layersManager.getLayer(params.renderTarget)
		if (!layer) {
			// console.log('layers', this.layersManager.getAllLayers(), renderTarget.layerId)
			throw new Error(`Layer not found: ${JSON.stringify(params.renderTarget)}`)
		}

		console.log('params', params)
		return layer.loadGraphic(params.graphicId, params.params)
	}
	/** Clear/unloads a GraphicInstance on a RenderTarget */
	clearGraphic(params: {
		filters?: {
			renderTarget?: RenderTarget
			graphicId?: string
			graphicInstanceId?: string
		}
	}) {
		// JSON RPC Method
		// console.log('params', params)

		let layers = []
		if (params.filters?.renderTarget) {
			const layer = this.layersManager.getLayer(params.filters?.renderTarget)
			if (!layer) throw new Error(`Layer not found: ${JSON.stringify(params.filters?.renderTarget)}`)
			layers = [layer]
		} else {
			layers = this.layersManager.getAllLayers()
		}

		const clearedGraphicInstancesOnLayer = []
		for (const layer of layers) {
			const graphicInstance = layer.getGraphicInstance()

			if (graphicInstance) {
				// Should it be cleared?
				let clear = true
				if (params.filters?.graphicId && graphicInstance.graphicId !== params.filters?.graphicId) clear = false
				if (params.filters?.graphicInstanceId && graphicInstance.id !== params.filters?.graphicInstanceId) clear = false

				if (clear) {
					layer.clearGraphic()

					clearedGraphicInstancesOnLayer.push({
						renderTarget: layer.renderTarget,
						graphicInstanceId: graphicInstance.id,
						graphicId: graphicInstance.graphicId,
					})
				}
			}
		}

		return {
			graphicInstance: clearedGraphicInstancesOnLayer,
		}
	}
	/** Invokes an action on a graphicInstance. Actions are defined by the Graphic's manifest */
	async invokeGraphicUpdateAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['updateAction']>[0]
	}) {
		// JSON RPC Method
		const layer = this.layersManager.getLayer(params.renderTarget)
		if (!layer) throw new Error(`Layer not found: ${JSON.stringify(params.renderTarget)}`)

		return layer.invokeUpdateAction(params)
	}
	async invokeGraphicPlayAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['playAction']>[0]
	}) {
		// JSON RPC Method
		const layer = this.layersManager.getLayer(params.renderTarget)
		if (!layer) throw new Error(`Layer not found: ${JSON.stringify(params.renderTarget)}`)

		return layer.invokePlayAction(params)
	}
	async invokeGraphicStopAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['stopAction']>[0]
	}) {
		// JSON RPC Method
		const layer = this.layersManager.getLayer(params.renderTarget)
		if (!layer) throw new Error(`Layer not found: ${JSON.stringify(params.renderTarget)}`)

		return layer.invokeStopAction(params)
	}
	async invokeGraphicCustomAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['customAction']>[0]
	}) {
		// JSON RPC Method
		const layer = this.layersManager.getLayer(params.renderTarget)
		if (!layer) throw new Error(`Layer not found: ${JSON.stringify(params.renderTarget)}`)

		return layer.invokeCustomAction(params)
	}
}

type WsMessage =
	| {
			method: string
			id: number
			params: unknown
	  }
	| {
			id: number
			error: unknown
	  }
	| {
			id: number
			result: unknown
	  }
