import { action, autorun, makeObservable, observable, ObservableMap, runInAction, computed } from 'mobx'
import { dbStore } from './db.js'
import { serverDataStore } from './serverData.js'
import { appSettingsStore } from './appSettings.js'
import { getDefaultDataFromSchema } from 'ograf-form'
import { clone } from '../lib/lib.js'

export interface PlaybackItem {
	id: string // unique instance ID
	graphicId: string // The template graphic ID from the server
	rendererId: string
	graphicData: unknown | undefined
	customActionData: { [actionId: string]: unknown }
	renderTarget: unknown | undefined
}

class GraphicsList {
	public itemsByRenderer = new ObservableMap<string, PlaybackItem[]>()
	public selectedItemIds = new ObservableMap<string, string | null>()
	public isInitialized = false

	constructor() {
		makeObservable(this, {
			itemsByRenderer: observable,
			selectedItemIds: observable,
			isInitialized: observable,
			items: computed,
			selectedItemId: computed,
			addItem: action,
			removeItem: action,
			moveItem: action,
			selectItem: action,
			updateItemData: action,
			clearItems: action,
			selectNext: action,
			selectPrev: action,
		})

		this.init().catch(e => console.error("GraphicsList init failed", e))
	}

	private async init() {
		try {
			const storedItems = await dbStore.getAllQueuedGraphics<PlaybackItem>()

			runInAction(() => {
				const grouped = new Map<string, PlaybackItem[]>()
				for (const item of (storedItems || [])) {
				    const rId = item.rendererId || 'default'
				    if (!grouped.has(rId)) {
				        grouped.set(rId, [])
				    }
				    grouped.get(rId)!.push(item)
				}

				for (const [rId, list] of grouped.entries()) {
				    this.itemsByRenderer.set(rId, list)
				}

				this.isInitialized = true
			})

			autorun(() => {
				if (!this.isInitialized) return
				// We update the DB on structural mutations in a real high-perf app...
			})
		} catch (e) {
			console.error('Error when loading graphics list from IndexedDB', e)
		}
	}

	public get items(): PlaybackItem[] {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    return this.itemsByRenderer.get(rId) || []
	}

	public get selectedItemId(): string | null {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    return this.selectedItemIds.get(rId) || null
	}

	public set selectedItemId(id: string | null) {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    this.selectedItemIds.set(rId, id)
	}

    public async saveListOrder() {
        try {
            const currentObj = await dbStore.getAllQueuedGraphics<PlaybackItem>()
            for (const c of currentObj) {
                await dbStore.removeQueuedGraphic(c.id)
            }

            for (const list of this.itemsByRenderer.values()) {
                for (const item of list) {
                    await dbStore.putQueuedGraphic(item)
                }
            }
        } catch (e) {
            console.error("Failed to save list data", e)
        }
    }

	public getSelectedItem(): PlaybackItem | undefined {
		if (!this.selectedItemId) return undefined
		return this.items.find((i) => i.id === this.selectedItemId)
	}

	public addItem(rendererId: string, graphicId: string) {
		const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
		const renderer = serverDataStore.renderersInfo.get(rendererId)

		const renderTarget = renderer?.renderTargetSchema
			? getDefaultDataFromSchema(renderer.renderTargetSchema)
			: undefined

		const graphicInfo = serverDataStore.graphicsInfo.get(graphicId)
		const graphicData = graphicInfo?.graphic.schema
			? getDefaultDataFromSchema(graphicInfo.graphic.schema)
			: undefined

		const newItem: PlaybackItem = {
			id,
			graphicId,
			rendererId,
			graphicData,
			customActionData: {},
			renderTarget: clone(renderTarget)
		}

        const rId = rendererId || 'default'
        if (!this.itemsByRenderer.has(rId)) {
            this.itemsByRenderer.set(rId, [])
        }
		this.itemsByRenderer.get(rId)!.push(newItem)
		dbStore.putQueuedGraphic(newItem).catch(console.error)

		if (!this.selectedItemIds.get(rId)) {
		    this.selectedItemIds.set(rId, id)
		}
	}

	public removeItem(id: string) {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    const list = this.itemsByRenderer.get(rId)
	    if (list) {
	        const newList = list.filter((i) => i.id !== id)
	        this.itemsByRenderer.set(rId, newList)
	    }

		dbStore.removeQueuedGraphic(id).catch(console.error)

		if (this.selectedItemIds.get(rId) === id) {
		    this.selectedItemIds.set(rId, null)
		}
	}

	public clearItems() {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    const list = this.itemsByRenderer.get(rId) || []

		this.itemsByRenderer.set(rId, [])
		this.selectedItemIds.set(rId, null)

		for(const item of list) {
		    dbStore.removeQueuedGraphic(item.id).catch(console.error)
		}
	}

	public moveItem(fromIndex: number, toIndex: number) {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    const list = this.itemsByRenderer.get(rId)
	    if (!list) return
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return

		const item = list.splice(fromIndex, 1)[0]
		list.splice(toIndex, 0, item)

		this.saveListOrder()
	}

	public selectItem(id: string | null) {
        const rId = appSettingsStore.getSelectedRendererId() || 'default'
		this.selectedItemIds.set(rId, id)
	}

	public updateItemData(id: string, partialData: Partial<PlaybackItem>) {
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    const list = this.itemsByRenderer.get(rId)
	    if (!list) return
		const itemIndex = list.findIndex(i => i.id === id)
		if (itemIndex > -1) {
			list[itemIndex] = { ...list[itemIndex], ...partialData }
			dbStore.putQueuedGraphic(list[itemIndex]).catch(console.error)
		}
	}

	public selectNext() {
	    const list = this.items
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    if (list.length === 0) return;
	    const currentSelected = this.selectedItemIds.get(rId)

	    if (!currentSelected) {
	        this.selectedItemIds.set(rId, list[0].id)
	        return
	    }
	    const ix = list.findIndex(i => i.id === currentSelected)
	    if (ix > -1 && ix < list.length - 1) {
	        this.selectedItemIds.set(rId, list[ix + 1].id)
	    }
	}

	public selectPrev() {
	    const list = this.items
	    const rId = appSettingsStore.getSelectedRendererId() || 'default'
	    if (list.length === 0) return;
	    const currentSelected = this.selectedItemIds.get(rId)

	    if (!currentSelected) {
	        this.selectedItemIds.set(rId, list[list.length - 1].id)
	        return
	    }
	    const ix = list.findIndex(i => i.id === currentSelected)
	    if (ix > 0) {
	        this.selectedItemIds.set(rId, list[ix - 1].id)
	    }
	}
}

export const graphicsListStore = new GraphicsList()
