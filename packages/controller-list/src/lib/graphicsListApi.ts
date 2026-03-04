import { OgrafApi } from './ografApi.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { PlaybackItem } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'

class GraphicsListAPIClass {
    private ografApi = OgrafApi.getSingleton()

    public init() {
        // Expose to window for easy debug or external triggers if needed
        ;(window as any).GraphicsListAPI = this
    }

    public async performAction(item: PlaybackItem, actionId: string) {
        if (!item || !actionId) return

        // Check load state if auto-load is enabled
        // In a real scenario, we'd check `serverDataStore.graphicsInstanceMap` to see if it's actually loaded.
        // For simplicity or if it's missing, let's just assume we might need to load it.
        // We can do a quick check against the server data if we want.

        let needsLoad = false
        if (appSettingsStore.autoLoad && actionId !== 'load') {
            // Ideally check serverDataStore logic for "is this graphicInstance loaded on this target?"
            // For now, if we don't have absolute proof it's loaded, we fire load just in case.
            // Or we just look at the list
            const isLoaded = Array.from(serverDataStore.graphicsInstanceMap.values()).some(
                g => g.graphicId === item.graphicId && g.rendererId === item.rendererId
            )
            needsLoad = !isLoaded
        }

        try {
            if (needsLoad && actionId !== 'load' && actionId !== 'stop') {
                console.log(`Auto-loading item ${item.id} before action ${actionId}`)
                await this.ografApi.renderTargetGraphicLoad({
                    rendererId: item.rendererId
                }, {
                    graphicId: item.graphicId,
                    graphicInstanceId: item.id,
                    renderTarget: item.renderTarget,
                    params: {
                        data: item.graphicData
                    }
                })

                // artificial delay to ensure load completes before next action (optional depending on API guarantees)
                await new Promise(r => setTimeout(r, 200))
            }

            if (actionId === 'clear') {
                console.log(`Performing action clear for item ${item.id} on target ${item.renderTarget}`)
                await this.ografApi.renderTargetGraphicClear({
                    rendererId: item.rendererId
                }, {
                    filters: [{
                        renderTarget: item.renderTarget,
                        graphicInstanceId: item.id
                    }]
                })
                return
            }

            console.log(`Performing action ${actionId} for item ${item.id}`)
            const pathParams = { rendererId: item.rendererId }

            if (actionId === 'play') {
                await this.ografApi.renderTargetGraphicPlay(pathParams, {
                    renderTarget: item.renderTarget,
                    graphicInstanceId: item.id,
                    params: item.customActionData?.[actionId] as any || {}
                })
            } else if (actionId === 'stop') {
                await this.ografApi.renderTargetGraphicStop(pathParams, {
                    renderTarget: item.renderTarget,
                    graphicInstanceId: item.id,
                    params: item.customActionData?.[actionId] as any || {}
                })
            } else if (actionId === 'load') {
                await this.ografApi.renderTargetGraphicLoad(pathParams, {
                    graphicId: item.graphicId,
                    graphicInstanceId: item.id,
                    renderTarget: item.renderTarget,
                    params: {
                        data: item.graphicData
                    }
                })
            } else if (actionId === 'update') {
                await this.ografApi.renderTargetGraphicUpdate(pathParams, {
                    renderTarget: item.renderTarget,
                    graphicInstanceId: item.id,
                    params: {
                        ...(item.customActionData?.[actionId] as any || {}),
                        data: item.graphicData
                    }
                })
            } else {
                await this.ografApi.renderTargetGraphicInvokeCustomAction({
                    rendererId: item.rendererId,
                    customActionId: actionId
                }, {
                    renderTarget: item.renderTarget,
                    graphicInstanceId: item.id,
                    params: {
                        payload: item.customActionData?.[actionId] as any
                    }
                })
            }

        } catch (error) {
            console.error(`Failed to perform action ${actionId} on item ${item.id}`, error)
        }
    }
}

export const GraphicsListAPI = new GraphicsListAPIClass()
