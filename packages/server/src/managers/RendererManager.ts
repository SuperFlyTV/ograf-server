import { EmptyPayload, VendorExtend, ServerApi } from 'ograf'
import { JSONRPCServerAndClient } from 'json-rpc-2.0'
import * as RendererAPI from '@ograf-server/shared'
import { RendererInfo } from '@ograf-server/shared'

export class RendererManagerNS {
	private rendererInstances = new Set<RendererInstance>()
	private rendererRegistrations = new Map<string, RendererRegistration>()

	constructor(public readonly namespaceId: string) {}

	public addRenderer(jsonRpcConnection: JSONRPCServerAndClient<void, void>): RendererInstance {
		// const id = RendererInstance.ID()
		const rendererInstance = new RendererInstance(this, jsonRpcConnection)
		this.rendererInstances.add(rendererInstance)

		return rendererInstance
	}

	public closeRenderer(rendererInstance: RendererInstance): void {
		this.rendererInstances.delete(rendererInstance)

		for (const reg of this.rendererRegistrations.values()) {
			reg.removeInstance(rendererInstance)
		}
	}
	public registerRenderer(rendererInstance: RendererInstance, id: string): void {
		let existing: RendererRegistration | undefined = this.rendererRegistrations.get(id)
		if (!existing) {
			existing = new RendererRegistration(this, rendererInstance)
			this.rendererRegistrations.set(id, existing)
		} else {
			existing.addInstance(rendererInstance)
		}
	}
	public unregisterRenderer(registration: RendererRegistration): void {
		for (const [id, reg] of this.rendererRegistrations.entries()) {
			if (reg === registration) {
				this.rendererRegistrations.delete(id)
				break
			}
		}
	}

	/** A ServerAPI Method */
	async listRenderers(): Promise<ServerApi.components['schemas']['RendererInfo'][]> {
		const renderers: ServerApi.components['schemas']['RendererInfo'][] = []
		for (const registration of this.rendererRegistrations.values()) {
			if (!registration.info) continue
			renderers.push(registration.info)
		}
		return renderers
	}
	/** A ServerAPI Method */
	async getRendererRegistration(id: string): Promise<RendererRegistration | undefined> {
		return this.rendererRegistrations.get(id)
	}
}

/**
 * Represents a group of connected Renderer instances (that share the same ID)
 */
class RendererRegistration {
	private rendererInstances: RendererInstance[] = []

	constructor(
		private manager: RendererManagerNS,
		initialRendererInstance: RendererInstance
	) {
		this.rendererInstances.push(initialRendererInstance)
	}
	addInstance(initialRendererInstance: RendererInstance) {
		this.rendererInstances.push(initialRendererInstance)
	}
	removeInstance(rendererInstance: RendererInstance) {
		const index = this.rendererInstances.indexOf(rendererInstance)
		if (index !== -1) this.rendererInstances.splice(index, 1)

		if (this.rendererInstances.length === 0) {
			this.manager.unregisterRenderer(this)
		}
	}
	get firstInstance(): RendererInstance {
		return this.rendererInstances[0]
	}
	get restInstances(): RendererInstance[] {
		return this.rendererInstances.slice(1)
	}
	get info(): RendererInfo | undefined {
		return this.firstInstance.info
	}
	async updateInfo(): Promise<void> {
		await Promise.all(this.rendererInstances.map(async (instance) => instance.updateInfo()))
	}

	private async forwardCommand(command: keyof RendererAPI.MethodsOnRenderer, payload: any): Promise<any> {
		let firstPromise: Promise<any> | null = null
		for (const instance of this.rendererInstances) {
			const p = instance.api[command](payload)
			if (!firstPromise)
				firstPromise = p // only care about the response of the first instance
			else p.catch(() => {}) // ignore subsequent errors
		}

		return firstPromise
	}

	public api: RendererAPI.MethodsOnRenderer = {
		getInfo: async (payload) => this.firstInstance.api.getInfo(payload),
		getTargetStatus: async (payload) => this.firstInstance.api.getTargetStatus(payload),
		invokeRendererAction: async (payload) => this.forwardCommand('invokeRendererAction', payload),
		loadGraphic: async (payload) => {
			const pFirst = this.firstInstance.api.loadGraphic(payload)
			const pRest = this.restInstances.map((instance) => ({
				instance,
				pResult: instance.api.loadGraphic(payload),
			}))

			const first = await pFirst

			// Track the graphicsInstanceIds, so that we can re-map subsequent graphics operations:
			for (const { instance, pResult } of pRest) {
				const result = await pResult
				instance.graphicsInstanceIdTracker.addGraphicsId(
					payload.renderTarget,
					first.graphicInstanceId,
					result.graphicInstanceId
				)
			}
			return first
		},
		clearGraphics: async (payload) => {
			if (payload.filters) {
				const pResult = this.firstInstance.api.clearGraphics(payload)
				const orgFilters = payload.filters

				Promise.all(
					this.restInstances.map(async (instance) => {
						const restFilters = orgFilters.map((orgFilter) => {
							const filter = { ...orgFilter }
							if (filter.graphicInstanceId) {
								if (filter.renderTarget) {
									filter.graphicInstanceId = instance.graphicsInstanceIdTracker.getTrackedId(
										filter.renderTarget,
										filter.graphicInstanceId
									)

									instance.graphicsInstanceIdTracker.clear(filter.renderTarget)
								} else {
									// can't really handle that, so we omit the graphicInstanceId completely
									delete filter.graphicInstanceId
								}
							}

							if (!filter.graphicId && !filter.graphicInstanceId && !filter.renderTarget) {
								instance.graphicsInstanceIdTracker.clear()
							}

							return filter
						})

						return instance.api.clearGraphics({ filters: restFilters })
					})
				).catch((e) => {
					console.log('Rest error')
					console.log(e)
				})

				return pResult
			} else {
				for (const instance of this.rendererInstances) {
					instance.graphicsInstanceIdTracker.clear()
				}
				return this.forwardCommand('clearGraphics', payload)
			}
		},

		invokeGraphicUpdateAction: async (payload) => this.handleGraphicsAction('invokeGraphicUpdateAction', payload),
		invokeGraphicPlayAction: async (payload) => this.handleGraphicsAction('invokeGraphicPlayAction', payload),
		invokeGraphicStopAction: async (payload) => this.handleGraphicsAction('invokeGraphicStopAction', payload),
		invokeGraphicCustomAction: async (payload) => this.handleGraphicsAction('invokeGraphicCustomAction', payload),
	}
	async handleGraphicsAction(
		command: keyof RendererAPI.MethodsOnRenderer,
		payload: {
			renderTarget: unknown
			graphicInstanceId: string
		}
	): Promise<any> {
		const pFirst = this.firstInstance.api[command](payload as any)

		for (const instance of this.restInstances) {
			// We need to re-map the graphicsInstanceId of the secondary instances, since their ids likely aren't the same as the primary
			const trackedGraphicsInstanceId = instance.graphicsInstanceIdTracker.getTrackedId(
				payload.renderTarget,
				payload.graphicInstanceId
			)
			if (trackedGraphicsInstanceId === undefined) {
				continue
			}
			const payload2 = {
				...payload,
				graphicInstanceId: trackedGraphicsInstanceId,
			} as any

			instance.api[command](payload2).catch(() => {})
		}

		return pFirst
	}
}
/** Represents a connection to one (1) connected Renderer */
class RendererInstance implements RendererAPI.MethodsOnServer {
	static RandomIndex = 0
	static InternalIdIndex = 0

	public graphicsInstanceIdTracker = new GraphicInstanceIdTracker()

	private isRegistered = false
	public internalId: number
	public info: RendererInfo | undefined
	// private _manifest: (RendererInfo & RendererManifest) | null = null

	/** Methods that can be called on the Renderer */
	public api: RendererAPI.MethodsOnRenderer = {
		// getManifest: async (payload) => this.jsonRpcConnection.request('getManifest', payload),
		// listGraphicInstances: async (payload) => this.jsonRpcConnection.request('listGraphicInstances', payload),
		getInfo: async (payload) => this.jsonRpcConnection.request('getInfo', payload),
		getTargetStatus: async (payload) => this.jsonRpcConnection.request('getTargetStatus', payload),
		invokeRendererAction: async (payload) => this.jsonRpcConnection.request('invokeRendererAction', payload),
		loadGraphic: async (payload) => this.jsonRpcConnection.request('loadGraphic', payload),
		clearGraphics: async (payload) => this.jsonRpcConnection.request('clearGraphics', payload),

		invokeGraphicUpdateAction: async (payload) => this.jsonRpcConnection.request('invokeGraphicUpdateAction', payload),
		invokeGraphicPlayAction: async (payload) => this.jsonRpcConnection.request('invokeGraphicPlayAction', payload),
		invokeGraphicStopAction: async (payload) => this.jsonRpcConnection.request('invokeGraphicStopAction', payload),
		invokeGraphicCustomAction: async (payload) => this.jsonRpcConnection.request('invokeGraphicCustomAction', payload),
	}

	constructor(
		private manager: RendererManagerNS,
		private jsonRpcConnection: JSONRPCServerAndClient<void, void>
	) {
		this.internalId = RendererInstance.InternalIdIndex++
	}

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
		this.onClose()
		return {}
	}
	public onClose() {
		this.manager.closeRenderer(this)
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

class GraphicInstanceIdTracker {
	/** Maps renderTarget -> primaryId -> trackId */
	private trackedIds = new Map<string, Map<string, string>>()

	addGraphicsId(renderTarget: unknown, primaryId: string, trackId: string): void {
		const renderTargetKey = JSON.stringify(renderTarget)
		let primaryMap = this.trackedIds.get(renderTargetKey)
		if (!primaryMap) {
			primaryMap = new Map<string, string>()
			this.trackedIds.set(renderTargetKey, primaryMap)
		}

		primaryMap.set(primaryId, trackId)
	}

	getTrackedId(renderTarget: unknown, primaryId: string): string | undefined {
		const renderTargetKey = JSON.stringify(renderTarget)
		const primaryMap = this.trackedIds.get(renderTargetKey)
		if (!primaryMap) {
			return undefined
		}
		const trackedId = primaryMap.get(primaryId)
		if (trackedId === undefined) {
		}
		return trackedId
	}
	clear(renderTarget?: unknown) {
		if (renderTarget) {
			const renderTargetKey = JSON.stringify(renderTarget)
			this.trackedIds.delete(renderTargetKey)
		} else {
			this.trackedIds.clear()
		}
	}
}
