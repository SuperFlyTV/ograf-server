import { OgrafApi } from './ografApi.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { gridStore, GraphicInstance, GridWidget } from '../stores/gridStore.js'
import { serverDataStore } from '../stores/serverData.js'
import { clone, isEqual } from './lib.js'
import { OgrafBridge, getStartEvent, getEndEvent } from '@ograf-server/shared'

let bridgeCmdCounter = 0
export const customGuiBridgeRegistry = {
	bridges: new Map<string, Set<OgrafBridge>>(),

	register(instanceId: string, bridge: OgrafBridge): void {
		let set = this.bridges.get(instanceId)
		if (!set) {
			set = new Set()
			this.bridges.set(instanceId, set)
		}
		set.add(bridge)
	},

	unregister(instanceId: string, bridge: OgrafBridge): void {
		const set = this.bridges.get(instanceId)
		if (set) {
			set.delete(bridge)
			if (set.size === 0) this.bridges.delete(instanceId)
		}
	},

	notifyStart(instanceId: string, actionName: string, arg: unknown): string {
		const commandId = `cmd_${Date.now()}_${++bridgeCmdCounter}`
		const set = this.bridges.get(instanceId)
		if (set) {
			for (const bridge of set) {
				const startEvent = getStartEvent(`${actionName}Start`, commandId, arg)
				bridge.emit(`${actionName}Start`, startEvent)
			}
		}
		return commandId
	},

	notifyEnd(instanceId: string, actionName: string, commandId: string, arg: unknown, result: unknown): void {
		const set = this.bridges.get(instanceId)
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

class GridControllerAPIClass {
	private ografApi = OgrafApi.getSingleton()

	public init() {
		;(window as any).GridControllerAPI = this
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
		gridStore.showError(`${actionLabel} failed: ${message}`)
		void serverDataStore.refreshLoadedStatusForAllGraphics()
	}

	public async clearRenderTarget(rendererId: string, renderTarget: unknown) {
		if (!rendererId) return
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

			for (const inst of gridStore.graphicInstances) {
				if (inst.rendererId === rendererId && isEqual(inst.renderTarget, renderTarget)) {
					gridStore.updateGraphicInstance(inst.id, { graphicInstanceId: undefined }, false)
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

			for (const inst of gridStore.graphicInstances) {
				if (!rId || inst.rendererId === rId) {
					gridStore.updateGraphicInstance(inst.id, { graphicInstanceId: undefined }, false)
				}
			}

			const renderTargets = new Set<string>()
			for (const inst of gridStore.graphicInstances) {
				if ((!rId || inst.rendererId === rId) && inst.renderTarget) {
					const key = JSON.stringify(inst.renderTarget)
					if (!renderTargets.has(key)) {
						renderTargets.add(key)
						await serverDataStore.loadGraphicsInstances(inst.rendererId, inst.renderTarget, true)
					}
				}
			}
		} catch (error) {
			console.error(`Failed to clear all graphics on renderer ${rId}`, error)
			this.notifyBadResponse('Clear all', error)
		}
	}

	public async clearAllRenderers() {
		if (serverDataStore.renderersList.length === 0) {
			await this.clearAll()
			return
		}
		for (const renderer of serverDataStore.renderersList) {
			await this.clearAll(renderer.id)
		}
	}

	public async performAction(item: GraphicInstance, actionId: string, customParams?: any): Promise<any> {
		if (!item || !actionId) return

		if (actionId === 'clear' || actionId === 'clearTarget') {
			await this.clearRenderTarget(item.rendererId, item.renderTarget)
			return
		}

		if (actionId === 'clearRenderer') {
			await this.clearAll(item.rendererId)
			return
		}

		if (actionId === 'clearAll') {
			await this.clearAllRenderers()
			return
		}

		const effectiveGraphicData = customParams?.data !== undefined ? customParams.data : clone(item.graphicData)

		let actionEventName: string
		let actionArg: any
		if (actionId === 'play' || actionId === 'loadplay') {
			actionEventName = 'playAction'
			actionArg = customParams?.params || (item.customActionData?.['play'] as any) || {}
		} else if (actionId === 'stop') {
			actionEventName = 'stopAction'
			actionArg = customParams?.params || (item.customActionData?.['stop'] as any) || {}
		} else if (actionId === 'update') {
			actionEventName = 'updateAction'
			actionArg = {
				...((item.customActionData?.['update'] as any) || {}),
				...(customParams?.params || {}),
				data: effectiveGraphicData,
			}
		} else if (actionId === 'load') {
			actionEventName = 'load'
			actionArg = { data: effectiveGraphicData }
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

		let needsLoad = false
		if (appSettingsStore.autoLoad && actionId !== 'load') {
			needsLoad = !graphicInstanceId
		}
		if (actionId === 'loadplay') {
			actionId = 'play'
			needsLoad = true
		}

		const graphicInfo = serverDataStore.graphicsInfo.get(item.graphicId)
		const itemName = item.name || graphicInfo?.graphic?.name || item.graphicId

		try {
			if (actionId === 'load' || (needsLoad && actionId !== 'stop')) {
				const loadResult = await this.ografApi.renderTargetGraphicLoad(
					{
						rendererId: item.rendererId,
					},
					{
						graphicId: item.graphicId,
						renderTarget: item.renderTarget,
						params: {
							data: effectiveGraphicData,
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
					gridStore.updateGraphicInstance(item.id, { graphicInstanceId: loadResult.content.graphicInstanceId }, false)
				}

				await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)

				if (!graphicInstanceId) {
					graphicInstanceId = serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
				}

				if (actionId === 'load') {
					customGuiBridgeRegistry.notifyEnd(item.id, actionEventName, commandId, actionArg, loadResult.content)
					return loadResult.content
				}
			}

			if (!graphicInstanceId) {
				await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)
				graphicInstanceId = serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
			}

			if (!graphicInstanceId) {
				gridStore.showNotification(`Cannot ${actionId} "${itemName}": Graphic is not loaded`, 'warning')
				const notLoadedError = { error: `Cannot ${actionId} "${itemName}": Graphic is not loaded` }
				customGuiBridgeRegistry.notifyEnd(item.id, actionEventName, commandId, actionArg, notLoadedError)
				return notLoadedError
			}

			const pathParams = { rendererId: item.rendererId }

			let res: any
			if (actionId === 'play') {
				res = await this.ografApi.renderTargetGraphicPlay(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: customParams?.params || (item.customActionData?.[actionId] as any) || {},
				})

				if (this.isBadResponse(res) && appSettingsStore.autoLoad) {
					const is404 =
						res?.status === 404 ||
						res?.content?.statusCode === 404 ||
						JSON.stringify(res?.content || '')
							.toLowerCase()
							.includes('graphicinstance not found')

					if (is404) {
						gridStore.updateGraphicInstance(item.id, { graphicInstanceId: undefined }, false)
						return await this.performAction(item, 'loadplay', customParams)
					}
				}
			} else if (actionId === 'stop') {
				res = await this.ografApi.renderTargetGraphicStop(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: customParams?.params || (item.customActionData?.[actionId] as any) || {},
				})
			} else if (actionId === 'update') {
				res = await this.ografApi.renderTargetGraphicUpdate(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: {
						...((item.customActionData?.[actionId] as any) || {}),
						...(customParams?.params || {}),
						data: effectiveGraphicData,
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

	public async performQuickPlay(item: GraphicInstance, customParams?: any) {
		try {
			await this.clearRenderTarget(item.rendererId, item.renderTarget)
			await this.performAction(item, 'loadplay', customParams)
		} catch (error) {
			console.error(`Failed to quickPlay item ${item.id}`, error)
		}
	}

	public async performBatchAction(items: GraphicInstance[], actionId: string, customParams?: any) {
		if (actionId === 'clearAll') {
			await this.clearAllRenderers()
			return
		}
		if (!items || items.length === 0) return

		if (actionId === 'clear' || actionId === 'clearTarget') {
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

		if (actionId === 'clearRenderer') {
			const seenRenderers = new Set<string>()
			for (const item of items) {
				if (!seenRenderers.has(item.rendererId)) {
					seenRenderers.add(item.rendererId)
					await this.clearAll(item.rendererId)
				}
			}
			return
		}

		for (const item of items) {
			await this.performAction(item, actionId, customParams)
			await new Promise((r) => setTimeout(r, 40))
		}
	}

	public async performBatchQuickPlay(items: GraphicInstance[], customParams?: any) {
		if (!items || items.length === 0) return

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

		await Promise.all(
			items.map(async (item) => {
				await this.performAction(item, 'loadplay', customParams)
			})
		)
	}

	/**
	 * Executes the action configured on an Action Button or Custom Action Button widget.
	 */
	public async executeWidgetAction(widget: GridWidget) {
		gridStore.triggerWidgetFlash(widget.id)

		if (widget.type === 'action-button') {
			const actionType = widget.actionType || 'quickPlay'
			if (actionType === 'clearAll') {
				await this.clearAllRenderers()
				return
			}

			const targets = gridStore.getTargetInstancesForWidget(widget)
			if (targets.length === 0) {
				if (actionType === 'clearRenderer') {
					await this.clearAll()
					return
				}
				gridStore.showNotification('No Graphic Instance linked to this button', 'warning')
				return
			}

			let customParams: any = undefined
			if (widget.usePresetData && widget.presetData !== undefined) {
				customParams = { data: clone(widget.presetData) }
				// Also update the single linked instance's live graphicData so forms reflect the preset if desired
				if (targets.length === 1) {
					gridStore.updateGraphicInstance(targets[0].id, { graphicData: clone(widget.presetData) }, false)
				}
			}

			if (actionType === 'quickPlay') {
				await this.performBatchQuickPlay(targets, customParams)
			} else {
				await this.performBatchAction(targets, actionType, customParams)
			}
		} else if (widget.type === 'custom-action-button') {
			const customActionId = widget.customActionId
			if (!customActionId) {
				gridStore.showNotification('No Custom Action selected for this button', 'warning')
				return
			}
			const targets = gridStore.getTargetInstancesForWidget(widget)
			if (targets.length === 0) {
				gridStore.showNotification('No Graphic Instance linked to this button', 'warning')
				return
			}

			const customParams =
				widget.usePresetData && widget.presetData !== undefined ? { payload: clone(widget.presetData) } : undefined

			await this.performBatchAction(targets, customActionId, customParams)
		}
	}
}

export const GridControllerAPI = new GridControllerAPIClass()
