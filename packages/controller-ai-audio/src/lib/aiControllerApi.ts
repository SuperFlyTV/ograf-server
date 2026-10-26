import { OgrafApi } from './ografApi.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { aiAudioStore, ActionCardItem } from '../stores/aiAudioStore.js'
import { serverDataStore } from '../stores/serverData.js'
import { isEqual } from './lib.js'

export interface OperatorActionEvent {
	action: string
	item?: ActionCardItem
	rendererId?: string
}

class AiControllerAPIClass {
	private ografApi = OgrafApi.getSingleton()
	private operatorActionListeners: Array<(ev: OperatorActionEvent) => void> = []

	public init() {
		;(window as any).AiControllerAPI = this
		void serverDataStore.refreshLoadedStatusForAllGraphics()
	}

	public onOperatorAction(listener: (ev: OperatorActionEvent) => void): () => void {
		this.operatorActionListeners.push(listener)
		return () => {
			this.operatorActionListeners = this.operatorActionListeners.filter((l) => l !== listener)
		}
	}

	private emitOperatorAction(ev: OperatorActionEvent) {
		for (const listener of this.operatorActionListeners) {
			try {
				listener(ev)
			} catch (e) {
				console.debug('OperatorAction listener error:', e)
			}
		}
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
		aiAudioStore.showError(`${actionLabel} failed: ${message}`)
		void serverDataStore.refreshLoadedStatusForAllGraphics()
	}

	public async clearRenderTarget(
		rendererId: string,
		renderTarget: unknown,
		options?: { actor?: 'ai' | 'user'; sourceItem?: ActionCardItem; suppressOperatorEvent?: boolean }
	) {
		if (!rendererId) return
		const actor = options?.actor || 'user'
		if (actor === 'ai' && options?.sourceItem) {
			aiAudioStore.triggerAiButtonHighlight(options.sourceItem.id, 'clear')
		}
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

			for (const item of aiAudioStore.allActiveItems) {
				if (item.rendererId === rendererId && isEqual(item.renderTarget, renderTarget)) {
					if (actor === 'user' && item.isPlaying) {
						aiAudioStore.recordHumanOverride(item, 'clear')
					}
					aiAudioStore.updateItemData(item.id, {
						graphicInstanceId: undefined,
						isPlaying: false,
						playingSince: null,
						stopHoldRemainingMs: 0,
						lastActionAt: Date.now(),
						lastActionBy: actor,
						lastActionType: 'clear',
					})
				}
			}

			if (actor === 'user' && !options?.suppressOperatorEvent) {
				this.emitOperatorAction({
					action: 'clear',
					item: options?.sourceItem,
					rendererId,
				})
			}

			await serverDataStore.loadGraphicsInstances(rendererId, renderTarget, true)
		} catch (error) {
			console.error(`Failed to clear renderTarget ${JSON.stringify(renderTarget)} on renderer ${rendererId}`, error)
			this.notifyBadResponse('Clear target', error)
		}
	}

	public async clearAll(rendererId?: string, actor: 'ai' | 'user' = 'user') {
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

			for (const item of aiAudioStore.allActiveItems) {
				if (!rId || item.rendererId === rId) {
					if (actor === 'user' && item.isPlaying) {
						aiAudioStore.recordHumanOverride(item, 'clear')
					}
					aiAudioStore.updateItemData(item.id, {
						graphicInstanceId: undefined,
						isPlaying: false,
						playingSince: null,
						stopHoldRemainingMs: 0,
						lastActionAt: Date.now(),
						lastActionBy: actor,
						lastActionType: 'clearAll',
					})
				}
			}

			if (actor === 'user') {
				this.emitOperatorAction({
					action: 'clearAll',
					rendererId: rId,
				})
			}

			const renderTargets = new Set<string>()
			for (const item of aiAudioStore.allActiveItems) {
				if ((!rId || item.rendererId === rId) && item.renderTarget !== undefined) {
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
		if (serverDataStore.renderersList.length === 0) {
			await this.clearAll()
			return
		}
		for (const renderer of serverDataStore.renderersList) {
			await this.clearAll(renderer.id)
		}
	}

	public async performQuickPlay(item: ActionCardItem, actor: 'ai' | 'user' = 'user'): Promise<any> {
		if (!item) return
		await this.clearRenderTarget(item.rendererId, item.renderTarget, {
			actor,
			sourceItem: item,
			suppressOperatorEvent: true,
		})
		return await this.performAction(item, 'loadplay', { actor })
	}

	public async performAction(item: ActionCardItem, actionId: string, customParams?: any): Promise<any> {
		if (!item || !actionId) return

		const actor: 'ai' | 'user' = customParams?.actor === 'ai' ? 'ai' : 'user'
		const restParams =
			customParams && typeof customParams === 'object'
				? (() => {
						const copy = { ...customParams }
						delete copy.actor
						return Object.keys(copy).length > 0 ? copy : undefined
					})()
				: customParams

		// Normalize 'pause' -> 'stop'
		if (actionId === 'pause') {
			actionId = 'stop'
		}

		const highlightActionId = actionId === 'loadplay' ? 'play' : actionId === 'clearTarget' ? 'clear' : actionId
		if (actor === 'ai' && highlightActionId !== 'load') {
			aiAudioStore.triggerAiButtonHighlight(item.id, highlightActionId)
		}

		if (actionId === 'clear' || actionId === 'clearTarget') {
			await this.clearRenderTarget(item.rendererId, item.renderTarget, {
				actor,
				sourceItem: item,
			})
			return
		}

		if (actionId === 'clearAll') {
			await this.clearAll(item.rendererId, actor)
			return
		}

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
		const itemName = graphicInfo?.graphic?.name || item.graphicId

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
							data: item.graphicData,
						},
					}
				)

				if (this.isBadResponse(loadResult)) {
					this.notifyBadResponse(`Load "${itemName}"`, loadResult)
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
					aiAudioStore.updateItemData(item.id, { graphicInstanceId: loadResult.content.graphicInstanceId })
				}

				await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)

				if (!graphicInstanceId) {
					graphicInstanceId = serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
				}

				if (actionId === 'load') {
					return loadResult.content
				}
			}

			if (!graphicInstanceId) {
				await serverDataStore.loadGraphicsInstances(item.rendererId, item.renderTarget, true)
				graphicInstanceId = serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
			}

			if (!graphicInstanceId) {
				aiAudioStore.showNotification(`Cannot ${actionId} "${itemName}": Graphic is not loaded`, 'warning')
				return { error: `Cannot ${actionId} "${itemName}": Graphic is not loaded` }
			}

			const pathParams = { rendererId: item.rendererId }

			let res: any
			if (actionId === 'play') {
				const updateBeforePlayRes = await this.ografApi
					.renderTargetGraphicUpdate(pathParams, {
						renderTarget: item.renderTarget,
						graphicInstanceId: graphicInstanceId,
						params: {
							...((item.customActionData?.update as any) || {}),
							data: restParams?.data !== undefined ? restParams.data : item.graphicData,
						},
					})
					.catch((err) => err)

				if (this.isBadResponse(updateBeforePlayRes) && appSettingsStore.autoLoad && !needsLoad) {
					const isUpdate404 =
						updateBeforePlayRes?.status === 404 ||
						updateBeforePlayRes?.content?.statusCode === 404 ||
						JSON.stringify(updateBeforePlayRes?.content || '')
							.toLowerCase()
							.includes('graphicinstance not found')

					if (isUpdate404) {
						aiAudioStore.updateItemData(item.id, {
							graphicInstanceId: undefined,
							isPlaying: false,
							playingSince: null,
						})
						return await this.performAction(item, 'loadplay', customParams)
					}
				}

				res = await this.ografApi.renderTargetGraphicPlay(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: restParams || (item.customActionData?.[actionId] as any) || {},
				})

				if (this.isBadResponse(res) && appSettingsStore.autoLoad) {
					const is404 =
						res?.status === 404 ||
						res?.content?.statusCode === 404 ||
						JSON.stringify(res?.content || '')
							.toLowerCase()
							.includes('graphicinstance not found')

					if (is404) {
						aiAudioStore.updateItemData(item.id, {
							graphicInstanceId: undefined,
							isPlaying: false,
							playingSince: null,
						})
						return await this.performAction(item, 'loadplay', customParams)
					}
				}

				if (!this.isBadResponse(res)) {
					aiAudioStore.markItemPlaying(item.id, graphicInstanceId, actor, 'play')
					if (actor === 'user') {
						this.emitOperatorAction({ action: 'play', item, rendererId: item.rendererId })
					}
				}
			} else if (actionId === 'stop') {
				res = await this.ografApi.renderTargetGraphicStop(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: restParams || (item.customActionData?.[actionId] as any) || {},
				})
				if (!this.isBadResponse(res)) {
					aiAudioStore.markItemStopped(item.id, actor, 'stop')
					if (actor === 'user') {
						this.emitOperatorAction({ action: 'stop', item, rendererId: item.rendererId })
					}
				}
			} else if (actionId === 'update') {
				res = await this.ografApi.renderTargetGraphicUpdate(pathParams, {
					renderTarget: item.renderTarget,
					graphicInstanceId: graphicInstanceId,
					params: {
						...((item.customActionData?.[actionId] as any) || {}),
						...(restParams || {}),
						data: restParams?.data !== undefined ? restParams.data : item.graphicData,
					},
				})
				if (!this.isBadResponse(res)) {
					aiAudioStore.markItemPlaying(item.id, graphicInstanceId, actor, 'update')
					if (actor === 'user') {
						this.emitOperatorAction({ action: 'update', item, rendererId: item.rendererId })
					}
				}
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
								restParams?.payload !== undefined ? restParams.payload : (item.customActionData?.[actionId] as any),
						},
					}
				)
				if (!this.isBadResponse(res)) {
					aiAudioStore.recordItemAction(item.id, actor, actionId)
					if (actor === 'user') {
						this.emitOperatorAction({ action: `custom:${actionId}`, item, rendererId: item.rendererId })
					}
				}
			}

			if (this.isBadResponse(res)) {
				this.notifyBadResponse(`${actionId.charAt(0).toUpperCase() + actionId.slice(1)} "${itemName}"`, res)
			}

			return res?.content
		} catch (error) {
			console.error(`Failed to perform action ${actionId} on item ${item.id}`, error)
			this.notifyBadResponse(`${actionId.charAt(0).toUpperCase() + actionId.slice(1)} "${itemName}"`, error)
			throw error
		}
	}
}

export const AiControllerAPI = new AiControllerAPIClass()
