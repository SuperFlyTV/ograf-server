import { action, autorun, computed, makeObservable, observable, ObservableMap, reaction, runInAction } from 'mobx'
import { OgrafApi } from '../lib/ografApi.js'
import * as OGraf from 'ograf'
import { appSettingsStore } from './appSettings.js'
import { isEqual } from '../lib/lib.js'

class ServerData {
	private ografApi = OgrafApi.getSingleton()

	public currentOperation: string = ''
	public connectedStatus: string = 'Initializing'
	public isConnected: boolean = false
	public lastError: string | null = null
	public graphicsList: OGraf.ServerApi.components['schemas']['GraphicInfo'][] = []
	public renderersList: OGraf.ServerApi.paths['/renderers']['get']['responses'][200]['content']['application/json']['renderers'] =
		[]
	public serverInfo: OGraf.ServerApi.paths['/']['get']['responses'][200]['content']['application/json'] | undefined

	public renderersInfo = new ObservableMap<string, OGraf.ServerApi.components['schemas']['RendererInfo']>()
	public graphicsInfo = new ObservableMap<
		string,
		{
			graphic: OGraf.ServerApi.components['schemas']['GraphicInfo']
			manifest: OGraf.ServerApi.components['schemas']['GraphicManifest']
		}
	>()
	public graphicsInstanceMap = new ObservableMap<string, GraphicsInstanceMapEntry>()

	public get severIsOurs(): boolean {
		return this.serverInfo?.name === 'Simple OGraf Server'
	}
	constructor() {
		// Load any stored states

		makeObservable(this, {
			currentOperation: observable,
			connectedStatus: observable,
			isConnected: observable,
			graphicsList: observable,
			renderersList: observable,
			serverInfo: observable,
			severIsOurs: computed,
			// renderersInfo: ,
			// getSelectedRenderer: computed,
			// increment: action,
			// fetch: flow
		})

		// Trigger initial load:
		this.triggerReloadData(true)

		// Trigger reload if any of these change:
		reaction(
			() => appSettingsStore.serverApiUrl,
			() => {
				this.triggerReloadData(true)
			}
		)
		reaction(
			() => appSettingsStore.selectedRendererId,
			() => {
				this.triggerReloadData('renderer')
			}
		)
		reaction(
			() => appSettingsStore.queuedGraphics.entries(),
			() => {
				this.triggerReloadData('graphic')
			}
		)

		autorun(() => {
			if (this.renderersList.length === 1) {
				const renderer = this.renderersList[0]
				if (appSettingsStore.selectedRendererId !== renderer.id) {
					// Select the only renderer, if there's only one:
					runInAction(() => {
						appSettingsStore.selectedRendererId = renderer.id
					})
				}
			}
		})
		// observe(appSettingsStore.serverApiUrl, () => {
		//   this.triggerReloadData(true);
		// });
	}

	public triggerReloadData(asap: boolean | string) {
		if (this._reloadDataTimeout !== undefined) {
			if (asap) clearTimeout(this._reloadDataTimeout)
			else return
		}
		this._reloadDataTimeout = setTimeout(
			() => {
				this._reloadDataTimeout = undefined
				Promise.resolve()
					.then(async () => {
						// wait for previous execution to finish:
						if (this._reloadDataPromise !== undefined) await this._reloadDataPromise

						this._reloadDataPromise = this._reloadData(asap)
						return this._reloadDataPromise
					})
					.catch((e) => {
						runInAction(() => {
							const errorStr = `${e}`
							this.setCurrentOperation('Error in operation: ' + errorStr)
							this.lastError = errorStr
							this.isConnected = false
							this.connectedStatus = errorStr.includes('Failed to fetch') ? 'Disconnected' : 'Error in connection'
						})
						console.error(e)
					})
					.finally(() => {
						this._reloadDataPromise = undefined
						// schedule another trigger for later:
						this.triggerReloadData(false)
					})
			},
			asap ? 1 : 2000
		)
	}

	private setCurrentOperation = action((value: string) => {
		this.currentOperation = value
	})

	private _reloadDataPromise: Promise<void> | undefined
	private _reloadDataTimeout: number | undefined

	private async _reloadData(asap: boolean | string) {
		await this._loadServerInfo(typeof asap === 'string' ? asap.includes(`serverInfo`) : asap)
		await this._loadGraphicsList(typeof asap === 'string' ? asap.includes(`graphicsList`) : asap)
		await this._loadRendererList(typeof asap === 'string' ? asap.includes(`rendererList`) : asap)
		await this._loadRenderer(typeof asap === 'string' ? asap.includes(`renderer`) : asap)
		{
			const renderTargetMap = new Map<string, { rendererId: string; renderTarget: unknown }>()

			for (const q of appSettingsStore.queuedGraphics.values()) {
				if (!this.graphicsInfo.has(q.graphicId)) {
					await this._loadGraphic(q.graphicId, typeof asap === 'string' ? asap.includes(`graphic`) : asap)
				}

				if (q.renderTarget) {
					renderTargetMap.set(`${q.rendererId}::${JSON.stringify(q.renderTarget)}`, {
						rendererId: q.rendererId,
						renderTarget: q.renderTarget,
					})
				}
			}

			for (const rt of renderTargetMap.values()) {
				await this._loadGraphicsInstances(
					rt.rendererId,
					rt.renderTarget,
					typeof asap === 'string' ? asap.includes(`renderTarget::${JSON.stringify(rt.renderTarget)}`) : asap
				)
			}
		}

		this.setCurrentOperation('')
		runInAction(() => {
			this.isConnected = true
			this.connectedStatus = 'Connected'
		})
	}
	private doIfEnoughTimeHasPassedMap = new Map<string, number>()
	private async doIfEnoughTimeHasPassed<T>(
		key: string,
		duration: number,
		cb: () => Promise<T>
	): Promise<T | undefined> {
		const MAX_DURATION = 65 * 1000
		if (duration > MAX_DURATION) throw new Error(`Duration too long: ${duration}. Max is ${MAX_DURATION}`)
		if (Math.random() < 0.001) {
			// cleanup
			this.doIfEnoughTimeHasPassedMap.forEach((time, k) => {
				if (Date.now() - time > MAX_DURATION * 2) {
					this.doIfEnoughTimeHasPassedMap.delete(k)
				}
			})
		}

		const lastTime = this.doIfEnoughTimeHasPassedMap.get(key) ?? 0
		if (Date.now() - lastTime > duration) {
			this.doIfEnoughTimeHasPassedMap.set(key, Date.now())
			return await cb()
		}
		return undefined
	}
	private async _loadServerInfo(asap: boolean) {
		await this.doIfEnoughTimeHasPassed('_loadServerInfo', asap ? 0 : 60 * 1000, async () => {
			this.setCurrentOperation('Retrieving server info...')
			const r = await this.ografApi.getServerInfo()
			if (r.status === 200)
				runInAction(() => {
					if (!isEqual(this.serverInfo, r.content)) this.serverInfo = r.content
				})
		})
	}
	private async _loadGraphicsList(asap: boolean) {
		await this.doIfEnoughTimeHasPassed('_loadGraphicsList', asap ? 0 : 10000, async () => {
			this.setCurrentOperation('Retrieving list of graphics...')
			const r = await this.ografApi.listGraphics()
			if (r.status === 200)
				runInAction(() => {
					if (!isEqual(this.graphicsList, r.content.graphics)) this.graphicsList = r.content.graphics
				})
		})
	}
	private async _loadRendererList(asap: boolean) {
		await this.doIfEnoughTimeHasPassed(
			'_loadRendererList',
			asap ? 0 : this.renderersList.length === 0 ? 1000 : 3000,
			async () => {
				this.setCurrentOperation('Retrieving list of renderers...')
				const r = await this.ografApi.listRenderers()
				if (r.status === 200)
					runInAction(() => {
						if (!isEqual(this.renderersList, r.content.renderers)) this.renderersList = r.content.renderers
					})
			}
		)
	}
	private async _loadRenderer(asap: boolean) {
		const rendererId = appSettingsStore.getSelectedRendererId()
		if (rendererId) {
			await this.doIfEnoughTimeHasPassed('_loadRenderer', asap ? 0 : 10000, async () => {
				this.setCurrentOperation('Retrieving list of renderers...')
				const r = await this.ografApi.getRenderer({
					rendererId: rendererId,
				})
				if (r.status === 200) runInAction(() => mapSetIfNotEqual(this.renderersInfo, rendererId, r.content.renderer))
			})
		}
	}
	private async _loadGraphic(graphicId: string, asap: boolean) {
		await this.doIfEnoughTimeHasPassed(`_loadGraphic::${graphicId}`, asap ? 0 : 10000, async () => {
			this.setCurrentOperation(`Retrieving graphic info for "${graphicId}"...`)
			const r = await this.ografApi.getGraphic({
				graphicId: graphicId,
			})
			if (r.status === 200) runInAction(() => mapSetIfNotEqual(this.graphicsInfo, graphicId, r.content))
		})
	}
	private async _loadGraphicsInstances(rendererId: string, renderTarget: unknown, asap: boolean) {
		await this.doIfEnoughTimeHasPassed(
			`_loadGraphicsInstances::${rendererId}::${JSON.stringify(renderTarget)}`,
			asap ? 0 : 1000,
			async () => {
				this.setCurrentOperation('Retrieving renderTarget...')
				const r = await this.ografApi.getRenderTarget(
					{
						rendererId: rendererId,
					},
					{
						renderTarget: renderTarget,
					}
				)
				if (r.status === 200)
					runInAction(() => {
						if (r.content.graphicInstances) {
							// Replace any existing on the renderTarget with new ones:

							const newKeySet = new Set<string>()
							for (const gi of r.content.graphicInstances) {
								const entry: GraphicsInstanceMapEntry = {
									rendererId: rendererId,
									renderTarget: renderTarget,
									graphicId: gi.graphic.id,
									graphicInstanceId: gi.graphicInstanceId,
								}

								this.addToGraphicsInstanceMap(entry)

								newKeySet.add(this.graphicsInstanceMapKey(entry))
							}
							// Remove those that are no longer present:
							this.graphicsInstanceMap.forEach((gi, key) => {
								if (gi.rendererId === rendererId && isEqual(gi.renderTarget, renderTarget) && !newKeySet.has(key)) {
									this.graphicsInstanceMap.delete(key)
								}
							})
						}
					})
			}
		)
	}

	graphicsInstanceMapKey(entry: GraphicsInstanceMapEntry): string {
		return `${entry.rendererId}::${JSON.stringify(entry.renderTarget)}::${entry.graphicInstanceId}`
	}
	addToGraphicsInstanceMap = action((entry: GraphicsInstanceMapEntry) => {
		mapSetIfNotEqual(this.graphicsInstanceMap, this.graphicsInstanceMapKey(entry), entry)
	})
	removeFromGraphicsInstanceMap = action((entry: GraphicsInstanceMapEntry) => {
		this.graphicsInstanceMap.delete(this.graphicsInstanceMapKey(entry))
	})
}

interface GraphicsInstanceMapEntry {
	rendererId: string
	renderTarget: unknown
	graphicId: string
	graphicInstanceId: string
}

function mapSetIfNotEqual<K, T>(map: Map<K, T>, key: K, value: T) {
	if (!isEqual(map.get(key), value)) {
		map.set(key, value)
	}
}

export const serverDataStore = new ServerData()
