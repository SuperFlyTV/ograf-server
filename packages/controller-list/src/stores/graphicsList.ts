import { action, autorun, makeObservable, observable, runInAction } from 'mobx'
import { dbStore } from './db.js'
import { serverDataStore } from './serverData.js'
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
	public items: PlaybackItem[] = []
	public selectedItemId: string | null = null
	public isInitialized = false

	constructor() {
		makeObservable(this, {
			items: observable,
			selectedItemId: observable,
			isInitialized: observable,
			addItem: action,
			removeItem: action,
			moveItem: action,
			selectItem: action,
			updateItemData: action,
			clearItems: action,
		})

		this.init().catch(e => console.error("GraphicsList init failed", e))
	}

	private async init() {
		try {
			const storedItems = await dbStore.getAllQueuedGraphics<PlaybackItem>()

			runInAction(() => {
				// Keep order based on IndexedDB order (assuming insert order or sorted separately,
				// since getAll gets them by key we might want to ensure ordering if needed.
				// For now we'll assume basic array representation or relying on an array of IDs in settings
				// if order becomes an issue. Let's just load them.

				this.items = storedItems || []
				this.isInitialized = true
			})

			// Save on changes
			autorun(() => {
				if (!this.isInitialized) return
				// We update the DB when items array mutates structurally or items change.
                // In a real high-perf app, you'd track individual additions/removals, but for simplicity:
                // const currentItems = clone(this.items)

                // For a robust ordering fix, we might want to store the total ordered list of IDs
                // in appSettings, but we can also just clear and set them on drag operations if fast enough.
			})
		} catch (e) {
			console.error('Error when loading graphics list from IndexedDB', e)
		}
	}

    public async saveListOrder() {
        // Simple wipe and store: (a transaction would be better here, but this works for basic size)
        try {
            const currentObj = await dbStore.getAllQueuedGraphics<PlaybackItem>()
            for (const c of currentObj) {
                await dbStore.removeQueuedGraphic(c.id)
            }

            for (const item of this.items) {
                await dbStore.putQueuedGraphic(item)
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

		this.items.push(newItem)
		dbStore.putQueuedGraphic(newItem).catch(console.error)

		if (!this.selectedItemId) {
		    this.selectedItemId = id
		}
	}

	public removeItem(id: string) {
		this.items = this.items.filter((i) => i.id !== id)
		dbStore.removeQueuedGraphic(id).catch(console.error)

		if (this.selectedItemId === id) {
		    this.selectedItemId = null
		}
	}

	public clearItems() {
		const oldItems = [...this.items]
		this.items = []
		this.selectedItemId = null

		for(const item of oldItems) {
		    dbStore.removeQueuedGraphic(item.id).catch(console.error)
		}
	}

	public moveItem(fromIndex: number, toIndex: number) {
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.items.length || toIndex >= this.items.length) return

		const item = this.items.splice(fromIndex, 1)[0]
		this.items.splice(toIndex, 0, item)

		this.saveListOrder()
	}

	public selectItem(id: string | null) {
		this.selectedItemId = id
	}

	public updateItemData(id: string, partialData: Partial<PlaybackItem>) {
		const itemIndex = this.items.findIndex(i => i.id === id)
		if (itemIndex > -1) {
			this.items[itemIndex] = { ...this.items[itemIndex], ...partialData }
			dbStore.putQueuedGraphic(this.items[itemIndex]).catch(console.error)
		}
	}

	public selectNext() {
	    if (this.items.length === 0) return;
	    if (!this.selectedItemId) {
	        this.selectedItemId = this.items[0].id
	        return
	    }
	    const ix = this.items.findIndex(i => i.id === this.selectedItemId)
	    if (ix > -1 && ix < this.items.length - 1) {
	        this.selectedItemId = this.items[ix + 1].id
	    }
	}

	public selectPrev() {
	    if (this.items.length === 0) return;
	    if (!this.selectedItemId) {
	        this.selectedItemId = this.items[this.items.length - 1].id
	        return
	    }
	    const ix = this.items.findIndex(i => i.id === this.selectedItemId)
	    if (ix > 0) {
	        this.selectedItemId = this.items[ix - 1].id
	    }
	}
}

export const graphicsListStore = new GraphicsList()
