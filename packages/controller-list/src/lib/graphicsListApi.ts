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
                await this.ografApi.commandAction({
                    rendererId: item.rendererId
                }, {
                    actionId: 'load',
                    graphicId: item.graphicId,
                    graphicInstanceId: item.id,
                    renderTarget: item.renderTarget,
                    actionData: {}, // default load action data usually empty or standard
                    graphicData: item.graphicData
                })

                // artificial delay to ensure load completes before next action (optional depending on API guarantees)
                await new Promise(r => setTimeout(r, 200))
            }

            console.log(`Performing action ${actionId} for item ${item.id}`)
            await this.ografApi.commandAction({
                rendererId: item.rendererId
            }, {
                actionId,
                graphicId: item.graphicId,
                graphicInstanceId: item.id,
                renderTarget: item.renderTarget,
                actionData: item.customActionData,
                graphicData: item.graphicData
            })

        } catch (error) {
            console.error(`Failed to perform action ${actionId} on item ${item.id}`, error)
        }
    }
}

export const GraphicsListAPI = new GraphicsListAPIClass()
