import { EmptyPayload, VendorExtend, ServerApi } from 'ograf'
import { JSONRPCServerAndClient } from 'json-rpc-2.0'
import * as RendererAPI from '@ograf-server/shared'
import { RendererInfo } from '@ograf-server/shared'

/**
 * How long to wait for a Renderer to answer a request before giving up on it.
 * A Renderer that never answers (a suspended tab, a paused browser source, a
 * laptop with its lid closed) must not be able to stall the API.
 */
const RPC_TIMEOUT = 10 * 1000
/** Loading a Graphic fetches its module and runs its load(), so it gets longer. */
const LOAD_TIMEOUT = 60 * 1000
/**
 * When loading, how long to wait for the mirror instances after the primary has
 * finished, so that a play right after the load reaches them too. Mirrors that
 * take longer keep loading in the background.
 */
const MIRROR_LOAD_GRACE = 3 * 1000

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

type LoadGraphicPayload = Parameters<RendererAPI.MethodsOnRenderer['loadGraphic']>[0]

/**
 * Represents a group of connected Renderer instances (that share the same ID).
 *
 * The first instance is the primary: the API reports its state and returns its
 * results. The rest mirror it: every command is forwarded to them, with the
 * graphicInstanceId re-mapped to their own (see GraphicInstanceIdTracker).
 * An instance that connects (or re-connects) after a graphic was loaded is
 * brought up to date by syncInstance().
 */
class RendererRegistration {
	private rendererInstances: RendererInstance[] = []
	/**
	 * The last load per renderTarget (keyed by JSON.stringify(renderTarget)) and
	 * the step it has been played to, so that an instance joining later can be
	 * given the same graphic at the same step.
	 */
	private lastLoads = new Map<
		string,
		{ payload: LoadGraphicPayload; primaryInstanceId: string; currentStep: number | undefined }
	>()

	constructor(
		private manager: RendererManagerNS,
		initialRendererInstance: RendererInstance
	) {
		this.rendererInstances.push(initialRendererInstance)
	}
	addInstance(rendererInstance: RendererInstance) {
		this.rendererInstances.push(rendererInstance)
		this.syncInstance(rendererInstance).catch((err) => {
			console.error(`Error syncing a Renderer instance with its primary: ${err instanceof Error ? err.message : err}`)
		})
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
	/**
	 * Refreshes the primary's info (what the API reports). The mirrors are
	 * refreshed in the background: a stalled mirror must not stall the API.
	 */
	async updateInfo(): Promise<void> {
		for (const instance of this.restInstances) {
			instance.updateInfo().catch(() => {})
		}
		await this.firstInstance.updateInfo()
	}

	/**
	 * Brings an instance that joined late (or re-connected) in line with the
	 * primary: graphic instances it already has (kept across a re-connect) are
	 * mapped, the ones it lacks are loaded and jumped to the current step.
	 */
	private async syncInstance(instance: RendererInstance): Promise<void> {
		const primary = this.firstInstance
		if (!primary || primary === instance) return

		try {
			await primary.updateInfo()
		} catch (_err) {
			// Use the last known info
		}
		if (!this.rendererInstances.includes(instance)) return // disconnected meanwhile

		for (const target of primary.info?.renderTargets ?? []) {
			const targetKey = JSON.stringify(target.renderTarget)
			for (const graphicInstance of target.graphicInstances ?? []) {
				const own = (instance.info?.renderTargets ?? [])
					.find((t) => JSON.stringify(t.renderTarget) === targetKey)
					?.graphicInstances?.find((g) => g.graphic.id === graphicInstance.graphic.id)

				const last = this.lastLoads.get(targetKey)
				const known = last && last.primaryInstanceId === graphicInstance.graphicInstanceId ? last : undefined

				let ownInstanceId: string
				if (own) {
					ownInstanceId = own.graphicInstanceId
				} else {
					if (!known) continue // nothing to replay
					const result = await instance.api.loadGraphic(known.payload)
					if (!this.rendererInstances.includes(instance)) return
					ownInstanceId = result.graphicInstanceId
				}
				instance.graphicsInstanceIdTracker.addGraphicsId(
					target.renderTarget,
					graphicInstance.graphicInstanceId,
					ownInstanceId
				)
				// Jump to the current step (also heals a play missed during a re-connect):
				if (known?.currentStep !== undefined) {
					await instance.api.invokeGraphicPlayAction({
						renderTarget: target.renderTarget,
						graphicInstanceId: ownInstanceId,
						params: { goto: known.currentStep, skipAnimation: true },
					})
				}
			}
		}
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

			// The mirrors load concurrently. Their ids are tracked once both they
			// and the primary have finished; a failing mirror is logged, not fatal.
			const pMirrors = this.restInstances.map(async (instance) => {
				const pMine = instance.api.loadGraphic(payload)
				const [first, mine] = await Promise.all([pFirst, pMine])
				instance.graphicsInstanceIdTracker.addGraphicsId(
					payload.renderTarget,
					first.graphicInstanceId,
					mine.graphicInstanceId
				)
			})
			for (const p of pMirrors) {
				p.catch((err) => console.error('A mirror Renderer failed to load the graphic:', err))
			}

			const first = await pFirst
			this.lastLoads.set(JSON.stringify(payload.renderTarget), {
				payload,
				primaryInstanceId: first.graphicInstanceId,
				currentStep: undefined,
			})

			// Give the mirrors a moment to catch up, so that an action sent right
			// after the load reaches them too — but never wait on a broken one.
			await Promise.race([
				Promise.allSettled(pMirrors),
				new Promise((resolve) => setTimeout(resolve, MIRROR_LOAD_GRACE)),
			])

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

				const result = await pResult
				for (const cleared of result.graphicInstances ?? []) {
					this.lastLoads.delete(JSON.stringify(cleared.renderTarget))
				}
				return result
			} else {
				for (const instance of this.rendererInstances) {
					instance.graphicsInstanceIdTracker.clear()
				}
				this.lastLoads.clear()
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

		const result = await pFirst

		// Remember the step the graphic is on, for instances that join later:
		if (command === 'invokeGraphicPlayAction') {
			const last = this.lastLoads.get(JSON.stringify(payload.renderTarget))
			const currentStep = (result as { result?: { currentStep?: unknown } } | undefined)?.result?.currentStep
			if (last && last.primaryInstanceId === payload.graphicInstanceId && typeof currentStep === 'number') {
				last.currentStep = currentStep
			}
		}
		return result
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
		// getManifest: async (payload) => this.request('getManifest', payload),
		// listGraphicInstances: async (payload) => this.request('listGraphicInstances', payload),
		getInfo: async (payload) => this.request('getInfo', payload),
		getTargetStatus: async (payload) => this.request('getTargetStatus', payload),
		invokeRendererAction: async (payload) => this.request('invokeRendererAction', payload),
		loadGraphic: async (payload) => this.request('loadGraphic', payload, LOAD_TIMEOUT),
		clearGraphics: async (payload) => this.request('clearGraphics', payload),

		invokeGraphicUpdateAction: async (payload) => this.request('invokeGraphicUpdateAction', payload),
		invokeGraphicPlayAction: async (payload) => this.request('invokeGraphicPlayAction', payload),
		invokeGraphicStopAction: async (payload) => this.request('invokeGraphicStopAction', payload),
		invokeGraphicCustomAction: async (payload) => this.request('invokeGraphicCustomAction', payload),
	}

	constructor(
		private manager: RendererManagerNS,
		private jsonRpcConnection: JSONRPCServerAndClient<void, void>
	) {
		this.internalId = RendererInstance.InternalIdIndex++
	}

	/** Sends a request to the Renderer. Rejects with "Request timeout" if it doesn't answer in time. */
	private async request(method: string, payload: unknown, timeout = RPC_TIMEOUT): Promise<any> {
		return this.jsonRpcConnection.timeout(timeout).request(method, payload as any)
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
		console.log('DEBUG Renderer', payload)
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
