import { action, autorun, computed, makeObservable, observable, ObservableMap, reaction, runInAction } from 'mobx'
import { OgrafApi } from '../lib/ografApi.js'
import * as OGraf from 'ograf'
import { appSettingsStore, PRELIMINARY_RENDERER_ID } from './appSettings.js'
import { aiAudioStore } from './aiAudioStore.js'
import { isEqual } from '../lib/lib.js'

export interface ScannedGraphicInfo {
	id: string
	graphic: OGraf.ServerApi.components['schemas']['GraphicManifest']
	metadata?: OGraf.ServerApi.components['schemas']['GraphicMetadata']
}

class ServerData {
	private ografApi = OgrafApi.getSingleton()

	public currentOperation: string = ''
	public connectedStatus: string = 'Initializing'
	public isConnected: boolean = false
	public lastError: string | null = null
	public graphicsList: OGraf.ServerApi.components['schemas']['GraphicListInfo'][] = []
	public renderersList: OGraf.ServerApi.paths['/renderers']['get']['responses'][200]['content']['application/json']['renderers'] =
		[]
	public serverInfo: OGraf.ServerApi.paths['/']['get']['responses'][200]['content']['application/json'] | undefined

	public renderersInfo = new ObservableMap<string, OGraf.ServerApi.components['schemas']['RendererInfo']>()
	public graphicsInfo = new ObservableMap<
		string,
		{
			graphic: OGraf.ServerApi.components['schemas']['GraphicManifest']
			metadata?: OGraf.ServerApi.components['schemas']['GraphicMetadata']
		}
	>()
	public graphicsInstanceMap = new ObservableMap<string, GraphicsInstanceMapEntry>()

	public get severIsOurs(): boolean {
		return this.serverInfo?.name === 'Simple OGraf Server'
	}

	constructor() {
		makeObservable(this, {
			currentOperation: observable,
			connectedStatus: observable,
			isConnected: observable,
			graphicsList: observable,
			renderersList: observable,
			serverInfo: observable,
			severIsOurs: computed,
		})

		this.triggerReloadData(true)

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
		queueMicrotask(() => {
			autorun(() => {
				if (this.renderersList.length > 0) {
					const renderer = this.renderersList[0]
					if (
						!appSettingsStore.selectedRendererId ||
						appSettingsStore.selectedRendererId === PRELIMINARY_RENDERER_ID ||
						!this.renderersList.find((r) => r.id === appSettingsStore.selectedRendererId)
					) {
						runInAction(() => {
							appSettingsStore.selectedRendererId = renderer.id
						})
					}
					const selectedId = appSettingsStore.getSelectedRendererId() || renderer.id
					if (selectedId && selectedId !== PRELIMINARY_RENDERER_ID) {
						aiAudioStore.migratePreliminaryRenderer(selectedId)
					}
				}
			})
		})
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
	private _reloadDataTimeout: ReturnType<typeof setTimeout> | undefined

	private async _reloadData(asap: boolean | string) {
		if (!this.ografApi.baseURL) return

		await this._loadServerInfo(typeof asap === 'string' ? asap.includes(`serverInfo`) : asap)
		await this._loadGraphicsList(typeof asap === 'string' ? asap.includes(`graphicsList`) : asap)
		await this._loadRendererList(typeof asap === 'string' ? asap.includes(`rendererList`) : asap)
		await this._loadRenderer(typeof asap === 'string' ? asap.includes(`renderer`) : asap)
		{
			const renderTargetMap = new Map<string, { rendererId: string; renderTarget: unknown }>()

			const allItems = aiAudioStore.allActiveItems
			for (const q of allItems) {
				if (!this.graphicsInfo.has(q.graphicId)) {
					await this.loadGraphic(q.graphicId, typeof asap === 'string' ? asap.includes(`graphic`) : asap)
				}

				if (q.rendererId && q.rendererId !== PRELIMINARY_RENDERER_ID) {
					renderTargetMap.set(`${q.rendererId}::${JSON.stringify(q.renderTarget)}`, {
						rendererId: q.rendererId,
						renderTarget: q.renderTarget,
					})
				}
			}

			for (const rt of renderTargetMap.values()) {
				await this.loadGraphicsInstances(
					rt.rendererId,
					rt.renderTarget,
					typeof asap === 'string' ? asap.includes(`renderTarget::${JSON.stringify(rt.renderTarget)}`) : asap
				)
			}
		}

		this.setCurrentOperation('')
		runInAction(() => {
			this.isConnected = this.serverInfo !== undefined
			this.connectedStatus = this.serverInfo ? 'Connected' : 'Connection Failed'
		})
		this.syncLoadedStatusToStore()
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
			this.doIfEnoughTimeHasPassedMap.forEach((time, k) => {
				if (Date.now() - time > MAX_DURATION * 2) {
					this.doIfEnoughTimeHasPassedMap.delete(k)
				}
			})
		}

		const lastTime = this.doIfEnoughTimeHasPassedMap.get(key) ?? 0
		if (duration === 0 || Date.now() - lastTime > duration) {
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
			if (r.status === 200) {
				runInAction(() => {
					if (!isEqual(this.graphicsList, r.content.graphics)) this.graphicsList = r.content.graphics
				})
				for (const g of r.content.graphics) {
					if (!this.graphicsInfo.has(g.id)) {
						await this.loadGraphic(g.id, false)
					}
				}
			}
		})
	}

	/**
	 * Performs a full, immediate re-scan of all graphics & manifests on the OGraf server.
	 */
	public async scanAllGraphicsForLLM(): Promise<ScannedGraphicInfo[]> {
		if (!this.ografApi.baseURL) return []
		this.setCurrentOperation('Scanning OGraf manifests...')
		const listRes = await this.ografApi.listGraphics()
		if (listRes.status !== 200) {
			this.setCurrentOperation('')
			throw new Error(`Failed to list graphics (status ${listRes.status})`)
		}

		const graphics = listRes.content.graphics
		runInAction(() => {
			this.graphicsList = graphics
		})

		const scanned: ScannedGraphicInfo[] = []
		for (const g of graphics) {
			const res = await this.ografApi.getGraphic({ graphicId: g.id })
			if (res.status === 200) {
				runInAction(() => {
					mapSetIfNotEqual(this.graphicsInfo, g.id, res.content)
				})
				scanned.push({
					id: g.id,
					graphic: res.content.graphic,
					metadata: res.content.metadata,
				})
			}
		}
		this.setCurrentOperation('')
		return scanned
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

	public async loadRenderer(rendererId: string, asap: boolean = true) {
		await this.doIfEnoughTimeHasPassed(`_loadRenderer::${rendererId}`, asap ? 0 : 10000, async () => {
			this.setCurrentOperation(`Retrieving renderer info for "${rendererId}"...`)
			const r = await this.ografApi.getRenderer({
				rendererId: rendererId,
			})
			if (r.status === 200) runInAction(() => mapSetIfNotEqual(this.renderersInfo, rendererId, r.content.renderer))
		})
		return this.renderersInfo.get(rendererId)
	}

	private async _loadRenderer(asap: boolean) {
		const rendererIdsToLoad = new Set<string>()
		for (const r of this.renderersList) {
			rendererIdsToLoad.add(r.id)
		}
		const selected = appSettingsStore.getSelectedRendererId()
		if (selected && selected !== PRELIMINARY_RENDERER_ID) rendererIdsToLoad.add(selected)

		for (const rendererId of rendererIdsToLoad) {
			await this.loadRenderer(rendererId, asap)
		}
	}

	public async loadGraphic(graphicId: string, asap: boolean = true) {
		await this.doIfEnoughTimeHasPassed(`_loadGraphic::${graphicId}`, asap ? 0 : 10000, async () => {
			this.setCurrentOperation(`Retrieving graphic info for "${graphicId}"...`)
			const r = await this.ografApi.getGraphic({
				graphicId: graphicId,
			})
			if (r.status === 200) {
				runInAction(() => mapSetIfNotEqual(this.graphicsInfo, graphicId, r.content))
			}
		})
		return this.graphicsInfo.get(graphicId)
	}

	public async loadGraphicsInstances(rendererId: string, renderTarget: unknown, asap: boolean = true) {
		return await this.doIfEnoughTimeHasPassed(
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
				if (r.status === 200) {
					runInAction(() => {
						if (r.content.graphicInstances) {
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
							this.graphicsInstanceMap.forEach((gi, key) => {
								if (gi.rendererId === rendererId && isEqual(gi.renderTarget, renderTarget) && !newKeySet.has(key)) {
									this.graphicsInstanceMap.delete(key)
								}
							})
						}
					})
					return r.content.graphicInstances
				}
				return undefined
			}
		)
	}

	public getGraphicInstanceId(rendererId: string, renderTarget: unknown, graphicId: string): string | undefined {
		const instances = Array.from(this.graphicsInstanceMap.values()).filter(
			(g) => g.rendererId === rendererId && isEqual(g.renderTarget, renderTarget) && g.graphicId === graphicId
		)
		return instances.length > 0 ? instances[instances.length - 1].graphicInstanceId : undefined
	}

	public hasRenderer(rendererId: string | undefined): boolean {
		if (!rendererId || rendererId === PRELIMINARY_RENDERER_ID) return false
		return this.renderersList.some((r) => r.id === rendererId)
	}

	public isRendererMissing(rendererId: string | undefined): boolean {
		if (!rendererId || rendererId === PRELIMINARY_RENDERER_ID) return true
		if (this.connectedStatus === 'Initializing') return false
		return !this.renderersList.some((r) => r.id === rendererId)
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

	public syncLoadedStatusToStore = action(() => {
		for (const item of aiAudioStore.allActiveItems) {
			if (item.rendererId && item.rendererId !== PRELIMINARY_RENDERER_ID) {
				const activeInstanceId = this.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
				if (item.graphicInstanceId && item.graphicInstanceId !== activeInstanceId) {
					aiAudioStore.updateItemData(item.id, {
						graphicInstanceId: undefined,
						isPlaying: false,
						stopHoldRemainingMs: 0,
					})
				}
			}
		}
	})

	public async refreshLoadedStatusForAllGraphics() {
		const renderers = new Set<string>()
		for (const r of this.renderersList) {
			renderers.add(r.id)
		}
		const selected = appSettingsStore.getSelectedRendererId()
		if (selected && selected !== PRELIMINARY_RENDERER_ID) renderers.add(selected)

		for (const rendererId of renderers) {
			await this.loadRenderer(rendererId, true)
		}

		const renderTargetMap = new Map<string, { rendererId: string; renderTarget: unknown }>()
		for (const q of aiAudioStore.allActiveItems) {
			if (q.rendererId && q.rendererId !== PRELIMINARY_RENDERER_ID) {
				renderTargetMap.set(`${q.rendererId}::${JSON.stringify(q.renderTarget)}`, {
					rendererId: q.rendererId,
					renderTarget: q.renderTarget,
				})
			}
		}

		for (const rt of renderTargetMap.values()) {
			await this.loadGraphicsInstances(rt.rendererId, rt.renderTarget, true)
		}

		this.syncLoadedStatusToStore()
	}
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
