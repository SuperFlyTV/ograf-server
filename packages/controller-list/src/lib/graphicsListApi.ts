import { OgrafApi } from './ografApi.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { graphicsListStore, PlaybackItem } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { isEqual } from './lib.js'
import { OgrafBridge, getStartEvent, getEndEvent } from '@ograf-server/shared'

let bridgeCmdCounter = 0
export const customGuiBridgeRegistry = {
	bridges: new Map<string, Set<OgrafBridge>>(),

	register(itemId: string, bridge: OgrafBridge): void {
		let set = this.bridges.get(itemId)
		if (!set) {
			set = new Set()
			this.bridges.set(itemId, set)
		}
		set.add(bridge)
	},

	unregister(itemId: string, bridge: OgrafBridge): void {
		const set = this.bridges.get(itemId)
		if (set) {
			set.delete(bridge)
			if (set.size === 0) this.bridges.delete(itemId)
		}
	},

	notifyStart(itemId: string, actionName: string, arg: unknown): string {
		const commandId = `cmd_${Date.now()}_${++bridgeCmdCounter}`
		const set = this.bridges.get(itemId)
		if (set) {
			for (const bridge of set) {
				const startEvent = getStartEvent(`${actionName}Start`, commandId, arg)
				bridge.emit(`${actionName}Start`, startEvent)
			}
		}
		return commandId
	},

	notifyEnd(itemId: string, actionName: string, commandId: string, arg: unknown, result: unknown): void {
		const set = this.bridges.get(itemId)
		if (set) {
			for (const bridge of set) {
				const endEvent = getEndEvent(`${actionName}End`, commandId, arg, result)
				bridge.emit(`${actionName}End`, endEvent)
				const aliasEvent = getEndEvent(actionName, commandId, arg, result)
				bridge.emit(actionName, aliasEvent)
			}
		}
	},
}

class GraphicsListAPIClass {
	private ografApi = OgrafApi.getSingleton()

	public init() {
		// Expose to window for easy debug or external triggers if needed
		;(window as any).GraphicsListAPI = this
		void serverDataStore.refreshLoadedStatusForAllGraphics()
	}

	private isBadResponse(response: any): boolean {
		if (!response) return true
		if (typeof response.status === 'number' && response.status !== 200) return true
		if (response.content?.statusCode && response.content.statusCode !== 200) return true
		return false
	}

	private notifyBadResponse(actionLabel: string, responseOrError: any) {
		let message = 'Unknown error'
		if (responseOrError instanceof Error) {
			message = responseOrError.message
		} else if (responseOrError) {
			const content = responseOrError.content || responseOrError
			message =
				content?.title ||
				content?.detail ||
				content?.error ||
				content?.statusMessage ||
				content?.message ||
				(responseOrError.status ? `Server returned status ${responseOrError.status}` : undefined) ||
				'Request failed'
		}
		graphicsListStore.showError(`${actionLabel} failed: ${message}`)
		void serverDataStore.refreshLoadedStatusForAllGraphics()
	}

	public async clearRenderTarget(rendererId: string, renderTarget: unknown) {
		if (!rendererId) return
		console.log(`Clearing all graphics on target ${JSON.stringify(renderTarget)} for renderer ${rendererId}`)
		try {
			const res = await this.ografApi.renderTargetGraphicClear(
				{
					rendererId,
				},
				{
					filters: [
						{
							renderTarget,
						},
					],
				}
			)

			if (this.isBadResponse(res)) {
				this.notifyBadResponse('Clear target', res)
				return
			}

			// Remove instance references for this renderTarget
			for (const item of graphicsListStore.items) {
				if (item.rendererId === rendererId && isEqual(item.renderTarget, renderTarget)) {
					graphicsListStore.updateItemData(item.id, { graphicInstanceId: undefined })
				}
			}

			await serverDataStore.loadGraphicsInstances(rendererId, renderTarget, true)
		} catch (error) {
			console.error(`Failed to clear renderTarget ${JSON.stringify(renderTarget)} on renderer ${rendererId}`, error)
			this.notifyBadResponse('Clear target', error)
		}
	}

	public async clearAll(rendererId?: string) {
		const rId = rendererId || appSettingsStore.getSelectedRendererId()
		if (!rId) return
		console.log(`Clearing ALL graphics on renderer ${rId} (no filters)`)
		try {
			const res = await this.ografApi.renderTargetGraphicClear(
				{
					rendererId: rId,
				},
				{
					filters: [{}],
				}
			)

			if (this.isBadResponse(res)) {
				this.notifyBadResponse('Clear all', res)
				return
			}

			// Invalidate graphicInstanceId on all items
			for (const item of graphicsListStore.items) {
				if (!rId || item.rendererId === rId) {
					graphicsListStore.updateItemData(item.id, { graphicInstanceId: undefined })
				}
			}

			// Reload active instances for all render targets in the list
			const renderTargets = new Set<string>()
			for (const item of graphicsListStore.items) {
				if ((!rId || item.rendererId === rId) && item.renderTarget) {
					const key = JSON.stringify(item.renderTarget)
					if (!renderTargets.has(key)) {
						renderTargets.add(key)
						await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)
					}
				}
			}
		} catch (error) {
			console.error(`Failed to clear all graphics on renderer ${rId}`, error)
			this.notifyBadResponse('Clear all', error)
		}
	}

	public async clearAllRenderers() {
		console.log('Clearing graphics on ALL renderers')
		if (serverDataStore.renderersList.length === 0) {
			await this.clearAll()
			return
		}
		for (const renderer of serverDataStore.renderersList) {
			await this.clearAll(renderer.id)
		}
	}

	public async performAction(item: PlaybackItem, actionId: string, customParams?: any): Promise<any> {
		if (!item || !actionId) return

		if (actionId === 'clear' || actionId === 'clearTarget') {
			await this.clearRenderTarget(item.rendererId, item.renderTarget)
			return
		}

		if (actionId === 'clearAll') {
			await this.clearAll(item.rendererId)
			return
		}

		let actionEventName: string
		let actionArg: any
		if (actionId === 'play' || actionId === 'loadplay') {
			actionEventName = 'playAction'
			actionArg = customParams || (item.customActionData?.['play'] as any) || {}
		} else if (actionId === 'stop') {
			actionEventName = 'stopAction'
			actionArg = customParams || (item.customActionData?.['stop'] as any) || {}
		} else if (actionId === 'update') {
			actionEventName = 'updateAction'
			actionArg = {
				...((item.customActionData?.['update'] as any) || {}),
				...(customParams || {}),
				data: customParams?.data !== undefined ? customParams.data : item.graphicData,
			}
		} else if (actionId === 'load') {
			actionEventName = 'load'
			actionArg = { data: item.graphicData }
		} else {
			actionEventName = 'customAction'
			actionArg = {
				id: actionId,
				payload:
					customParams?.payload !== undefined ? customParams.payload : (item.customActionData?.[actionId] as any),
			}
		}

		const commandId = customGuiBridgeRegistry.notifyStart(item.id, actionEventName, actionArg)

		let graphicInstanceId =
			item.graphicInstanceId || serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)

		// Check load state if auto-load is enabled
		let needsLoad = false
		if (appSettingsStore.autoLoad && actionId !== 'load') {
			needsLoad = !graphicInstanceId
		}
		if (actionId === 'loadplay') {
			actionId = 'play'
			needsLoad = true
		}

		const graphicInfo = serverDataStore.graphicsInfo.get(item.graphicId)
		const itemName = graphicInfo?.graphic?.name || item.graphicId

		try {
			if (actionId === 'load' || (needsLoad && actionId !== 'stop')) {
				if (needsLoad) {
					console.log(`Auto-loading item ${item.id} before action ${actionId}`)
				} else {
					console.log(`Loading item ${item.id}`)
				}

				const loadResult = await this.ografApi.renderTargetGraphicLoad(
					{
						rendererId: item.rendererId,
					},
					{
						graphicId: item.graphicId,
						renderTarget: item.renderTarget,
						params: {
							data: item.graphicData,
						},
					}
				)

				if (this.isBadResponse(loadResult)) {
					this.notifyBadResponse(`Load "${itemName}"`, loadResult)
					customGuiBridgeRegistry.notifyEnd(
						item.id,
						actionEventName,
						commandId,
						actionArg,
						loadResult?.content || { error: 'Load failed' }
					)
					return loadResult?.content
				}

				if (loadResult.status === 200) {
					graphicInstanceId = loadResult.content.graphicInstanceId
					serverDataStore.addToGraphicsInstanceMap({
						rendererId: item.rendererId,
						renderTarget: item.renderTarget,
						graphicId: item.graphicId,
						graphicInstanceId: loadResult.content.graphicInstanceId,
					})
					graphicsListStore.updateItemData(item.id, { graphicInstanceId: loadResult.content.graphicInstanceId })
				}

				// Check the renderTarget status to get a list of graphicsInstances available
				await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)

				if (!graphicInstanceId) {
					graphicInstanceId = serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
				}

				if (actionId === 'load') {
					customGuiBridgeRegistry.notifyEnd(item.id, actionEventName, commandId, actionArg, loadResult.content)
					return loadResult.content
				}
			}

			// If graphicInstanceId is not found yet, check renderTarget status
			if (!graphicInstanceId) {
				await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)
				graphicInstanceId = serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
			}

			if (!graphicInstanceId) {
				console.warn(
					`Cannot perform action ${actionId} for item ${item.id}: No graphicInstanceId available (item is not loaded)`
				)
				graphicsListStore.showNotification(`Cannot ${actionId} "${itemName}": Graphic is not loaded`, 'warning')
				const notLoadedError = { error: `Cannot ${actionId} "${itemName}": Graphic is not loaded` }
				customGuiBridgeRegistry.notifyEnd(item.id, actionEventName, commandId, actionArg, notLoadedError)
				return notLoadedError
			}

			console.log(`Performing action ${actionId} for item ${item.id} (graphicInstanceId: ${graphicInstanceId})`)
			const pathParams = { rendererId: item.rendererId }

			let res: any
			if (actionId === 'play') {
				res = await this.ografApi.renderTargetGraphicPlay(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: customParams || (item.customActionData?.[actionId] as any) || {},
				})

				if (this.isBadResponse(res) && appSettingsStore.autoLoad) {
					const is404 =
						res?.status === 404 ||
						res?.content?.statusCode === 404 ||
						JSON.stringify(res?.content || '')
							.toLowerCase()
							.includes('graphicinstance not found')

					if (is404) {
						console.log(
							`Play failed with 404 for item ${item.id} (GraphicInstance not found on Renderer). Auto-load is enabled: retrying via load and play...`
						)
						graphicsListStore.updateItemData(item.id, { graphicInstanceId: undefined })
						return await this.performAction(item, 'loadplay', customParams)
					}
				}
			} else if (actionId === 'stop') {
				res = await this.ografApi.renderTargetGraphicStop(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: customParams || (item.customActionData?.[actionId] as any) || {},
				})
			} else if (actionId === 'update') {
				res = await this.ografApi.renderTargetGraphicUpdate(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: {
						...((item.customActionData?.[actionId] as any) || {}),
						...(customParams || {}),
						data: customParams?.data !== undefined ? customParams.data : item.graphicData,
					},
				})
			} else {
				res = await this.ografApi.renderTargetGraphicInvokeCustomAction(
					{
						rendererId: item.rendererId,
						customActionId: actionId,
					},
					{
						renderTarget: item.renderTarget,
						graphicInstanceId: graphicInstanceId,
						params: {
							payload:
								customParams?.payload !== undefined ? customParams.payload : (item.customActionData?.[actionId] as any),
						},
					}
				)
			}

			if (this.isBadResponse(res)) {
				this.notifyBadResponse(`${actionId.charAt(0).toUpperCase() + actionId.slice(1)} "${itemName}"`, res)
			}

			customGuiBridgeRegistry.notifyEnd(item.id, actionEventName, commandId, actionArg, res?.content)
			return res?.content
		} catch (error) {
			console.error(`Failed to perform action ${actionId} on item ${item.id}`, error)
			this.notifyBadResponse(`${actionId.charAt(0).toUpperCase() + actionId.slice(1)} "${itemName}"`, error)
			customGuiBridgeRegistry.notifyEnd(item.id, actionEventName, commandId, actionArg, {
				error: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}

	public async performQuickPlay(item: PlaybackItem) {
		console.log(`Performing quickPlay (clear + load + play) for item ${item.id}`)
		try {
			await this.clearRenderTarget(item.rendererId, item.renderTarget)

			await this.performAction(item, 'loadplay')
		} catch (error) {
			console.error(`Failed to quickPlay item ${item.id}`, error)
		}
	}

	public async performBatchAction(items: PlaybackItem[], actionId: string) {
		if (!items || items.length === 0) return

		if (actionId === 'clear' || actionId === 'clearTarget') {
			// Deduplicate render targets
			const seenTargets = new Set<string>()
			for (const item of items) {
				const key = `${item.rendererId}::${JSON.stringify(item.renderTarget)}`
				if (!seenTargets.has(key)) {
					seenTargets.add(key)
					await this.clearRenderTarget(item.rendererId, item.renderTarget)
				}
			}
			return
		}

		if (actionId === 'clearAll') {
			const seenRenderers = new Set<string>()
			for (const item of items) {
				if (!seenRenderers.has(item.rendererId)) {
					seenRenderers.add(item.rendererId)
					await this.clearAll(item.rendererId)
				}
			}
			return
		}

		// Execute sequentially across items
		for (const item of items) {
			await this.performAction(item, actionId)
			await new Promise((r) => setTimeout(r, 50))
		}
	}

	public async performBatchQuickPlay(items: PlaybackItem[]) {
		if (!items || items.length === 0) return

		// Clear targets first
		const seenTargets = new Set<string>()

		await Promise.all(
			items.map(async (item) => {
				const key = `${item.rendererId}::${JSON.stringify(item.renderTarget)}`
				if (!seenTargets.has(key)) {
					seenTargets.add(key)
					await this.clearRenderTarget(item.rendererId, item.renderTarget)
				}
			})
		)

		// await new Promise((r) => setTimeout(r, 80))

		// Load each
		// for (const item of items) {
		// 	await this.performAction(item, 'load')
		// 	await new Promise((r) => setTimeout(r, 50))
		// }

		// await new Promise((r) => setTimeout(r, 80))

		// Play each
		await Promise.all(
			items.map(async (item) => {
				await this.performAction(item, 'loadplay')
			})
		)
	}
}

export const GraphicsListAPI = new GraphicsListAPIClass()
