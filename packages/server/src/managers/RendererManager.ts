import { EmptyPayload, VendorExtend, ServerApi } from 'ograf'
import { JSONRPCServerAndClient } from 'json-rpc-2.0'
import * as RendererAPI from '../types/rendererAPI.js'
import { RendererInfo } from '../types/renderer.js'

export class RendererManager {
	private rendererInstances: Set<RendererInstance> = new Set()
	private registeredRenderers: Map<string, RendererInstance> = new Map()

	public addRenderer(jsonRpcConnection: JSONRPCServerAndClient<void, void>): RendererInstance {
		// const id = RendererInstance.ID()
		const rendererInstance = new RendererInstance(this, jsonRpcConnection)
		this.rendererInstances.add(rendererInstance)

		return rendererInstance
	}
	public closeRenderer(rendererInstance: RendererInstance): void {
		this.rendererInstances.delete(rendererInstance)
		if (rendererInstance.info) this.registeredRenderers.delete(rendererInstance.info.id)
	}
	public registerRenderer(rendererInstance: RendererInstance, id: string): void {
		this.registeredRenderers.set(id, rendererInstance)
	}

	/** A ServerAPI Method */
	async listRenderers(): Promise<ServerApi.components['schemas']['RendererInfo'][]> {
		const renderers: ServerApi.components['schemas']['RendererInfo'][] = []
		for (const rendererInstance of this.rendererInstances) {
			console.log('rendererInstance', rendererInstance)
			if (!rendererInstance.info) continue
			renderers.push(rendererInstance.info)
		}
		return renderers
	}
	/** A ServerAPI Method */
	async getRendererInstance(id: string): Promise<RendererInstance | undefined> {
		return this.registeredRenderers.get(id)
	}
}

class RendererInstance implements RendererAPI.MethodsOnServer {
	static RandomIndex = 0
	// static ID(): string {
	//     return `renderer-${RendererInstance._ID++}`
	// }

	private isRegistered = false
	public info: RendererInfo | undefined
	// private _manifest: (RendererInfo & RendererManifest) | null = null

	/** Methods that can be called on the Renderer */
	public api: RendererAPI.MethodsOnRenderer = {
		getManifest: (payload) => this.jsonRpcConnection.request('getManifest', payload),
		// listGraphicInstances: (payload) => this.jsonRpcConnection.request('listGraphicInstances', payload),
		getInfo: (payload) => this.jsonRpcConnection.request('getInfo', payload),
		getTargetStatus: (payload) => this.jsonRpcConnection.request('getTargetStatus', payload),
		invokeRendererAction: (payload) => this.jsonRpcConnection.request('invokeRendererAction', payload),
		loadGraphic: (payload) => this.jsonRpcConnection.request('loadGraphic', payload),
		clearGraphic: (payload) => this.jsonRpcConnection.request('clearGraphic', payload),

		invokeGraphicUpdateAction: (payload) => this.jsonRpcConnection.request('invokeGraphicUpdateAction', payload),
		invokeGraphicPlayAction: (payload) => this.jsonRpcConnection.request('invokeGraphicPlayAction', payload),
		invokeGraphicStopAction: (payload) => this.jsonRpcConnection.request('invokeGraphicStopAction', payload),
		invokeGraphicCustomAction: (payload) => this.jsonRpcConnection.request('invokeGraphicCustomAction', payload),
	}

	constructor(
		private manager: RendererManager,
		private jsonRpcConnection: JSONRPCServerAndClient<void, void>
	) {}

	public register = async (payload: { info: RendererInfo }): Promise<{ rendererId: string } & VendorExtend> => {
		// JSONRPC METHOD, called by the Renderer
		this.isRegistered = true

		let id: string
		if (payload.info.id === undefined || payload.info.id === '') {
			id = `renderer:${RendererInstance.RandomIndex++}`
		} else {
			id = `renderer-${payload.info.id}`
		}

		this.info = {
			...payload.info,
			id,
		}
		if (!this.info.name) this.info.name = id

		this.manager.registerRenderer(this, this.info.id)

		console.log(`Renderer "${id}" registered`)

		setTimeout(() => {
			// Ask the renderer for its manifest and initial status
			// this.updateManifest().catch(console.error)
			this.updateInfo().catch(console.error)
		}, 10)
		return {
			rendererId: this.info.id,
		}
	}

	public unregister = async (): Promise<EmptyPayload> => {
		// JSONRPC METHOD, called by the Renderer
		this.isRegistered = false
		this.manager.closeRenderer(this)
		return {}
	}

	public onInfo = async (payload: { info: RendererInfo }): Promise<EmptyPayload> => {
		// JSONRPC METHOD, called by the Renderer
		if (!this.isRegistered) throw new Error('Renderer is not registered')

		this.info = {
			...payload.info,
			id: this.info?.id ?? 'N/A',
		}
		return {}
	}

	public debug = async (payload: { message: string }): Promise<EmptyPayload> => {
		// JSONRPC METHOD, called by the Renderer
		if (!this.isRegistered) throw new Error('Renderer is not registered')

		console.log('DEBUG Renderer', payload.message)
		return {}
	}

	// private async updateManifest() {
	// 	const result = await this.api.getManifest({})
	// 	this._manifest = result.rendererManifest
	// }
	public async updateInfo() {
		const result = await this.api.getInfo({})
		this.info = {
			...result.rendererInfo,
			id: this.info?.id ?? 'N/A',
		}
	}
}
