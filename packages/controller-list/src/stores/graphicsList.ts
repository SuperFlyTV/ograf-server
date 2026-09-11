import { action, makeObservable, observable, runInAction, computed, toJS, reaction } from 'mobx'
import { dbStore } from './db.js'
import { serverDataStore } from './serverData.js'
import { appSettingsStore } from './appSettings.js'
import { getDefaultDataFromSchema } from 'ograf-form'
import { clone, isEqual } from '../lib/lib.js'
import { getNameSpaceId } from '../lib/namespace.js'

export interface PlaybackItem {
	id: string // unique instance ID
	graphicId: string // The template graphic ID from the server
	rendererId: string
	graphicData: unknown | undefined
	customActionData: { [actionId: string]: unknown }
	renderTarget: unknown | undefined
	graphicInstanceId?: string
	groupId?: string
	order?: number
	updatedAt?: number
}

export interface PlaybackGroup {
	id: string
	isGroup: true
	name: string
	rendererId?: string
	collapsed?: boolean
	color?: string
	items: PlaybackItem[]
	order?: number
}

export type PlaybackListEntry = PlaybackItem | PlaybackGroup

export function isPlaybackGroup(entry: PlaybackListEntry): entry is PlaybackGroup {
	return (entry as PlaybackGroup)?.isGroup === true
}

function generateId(prefix: string = 'item'): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function deepCloneWithNewIds(entry: PlaybackListEntry): PlaybackListEntry {
	const cloned = clone(entry)
	if (isPlaybackGroup(cloned)) {
		cloned.id = generateId('group')
		cloned.items = (cloned.items || []).map((item) => {
			const newItem = clone(item)
			newItem.id = generateId('item')
			newItem.groupId = cloned.id
			newItem.graphicInstanceId = undefined
			return newItem
		})
		return cloned
	} else {
		cloned.id = generateId('item')
		cloned.graphicInstanceId = undefined
		return cloned
	}
}

export interface RundownTab {
	id: string
	name: string
	entries: PlaybackListEntry[]
}

export type SnackbarSeverity = 'info' | 'error' | 'warning' | 'success'

class GraphicsList {
	public tabs: RundownTab[] = []
	public activeTabId: string = 'tab_default'
	public entries: PlaybackListEntry[] = []
	public selectedIds: string[] = []
	public primarySelectedId: string | null = null
	public searchQuery: string = ''
	public clipboard: PlaybackListEntry[] | null = null
	public clipboardIsCut: boolean = false
	public snackbarMessage: string | null = null
	public snackbarSeverity: SnackbarSeverity = 'info'
	public isInitialized = false

	private undoStack: string[] = []
	private redoStack: string[] = []
	private isApplyingHistory = false

	constructor() {
		makeObservable(this, {
			tabs: observable,
			activeTabId: observable,
			entries: observable,
			selectedIds: observable,
			primarySelectedId: observable,
			searchQuery: observable,
			clipboard: observable,
			clipboardIsCut: observable,
			snackbarMessage: observable,
			snackbarSeverity: observable,
			isInitialized: observable,

			activeTab: computed,
			items: computed,
			selectedItemId: computed,
			selectedItem: computed,
			selectedGroup: computed,
			selectedItems: computed,
			hasMultipleRenderersInList: computed,
			hasMultipleRenderTargetsInList: computed,
			canUndo: computed,
			canRedo: computed,

			setActiveTab: action,
			addTab: action,
			renameTab: action,
			removeTab: action,
			duplicateTab: action,

			addItem: action,
			removeItem: action,
			clearItems: action,
			updateItemData: action,
			updateMultipleItems: action,

			addGroup: action,
			ungroup: action,
			renameGroup: action,
			toggleGroupCollapse: action,
			setGroupCollapse: action,
			setAllGroupsCollapse: action,
			groupSelected: action,

			selectItem: action,
			selectGroup: action,
			selectAll: action,
			clearSelection: action,
			selectNext: action,
			selectPrev: action,

			copySelection: action,
			cutSelection: action,
			paste: action,
			duplicateSelection: action,
			duplicateItem: action,
			duplicateGroup: action,

			moveOrCopyEntry: action,
			moveSelectedUp: action,
			moveSelectedDown: action,
			setSearchQuery: action,
			setSnackbarMessage: action,
			showNotification: action,
			showError: action,

			undo: action,
			redo: action,
		})

		reaction(
			() => ({
				selectedIds: this.selectedIds.slice(),
				primarySelectedId: this.primarySelectedId,
				activeTabId: this.activeTabId,
			}),
			() => {
				if (this.isInitialized) {
					this.saveSelectionToLocalStorage()
				}
			}
		)

		this.init().catch((e) => console.error('GraphicsList init failed', e))
	}

	private async init() {
		try {
			let storedTabs = await dbStore.getRundownTabs<RundownTab[]>()
			const defaultRenderer =
				appSettingsStore.getSelectedRendererId() || serverDataStore.renderersList[0]?.id || 'default'

			if (!storedTabs || storedTabs.length === 0) {
				const storedItems = await dbStore.getAllQueuedGraphics<any>()
				const list: PlaybackListEntry[] = []

				for (const item of storedItems || []) {
					const rId = item.rendererId || defaultRenderer
					if (item.isGroup) {
						const group: PlaybackGroup = {
							id: item.id || generateId('group'),
							isGroup: true,
							name: item.name || 'Untitled Group',
							rendererId: rId,
							collapsed: item.collapsed || false,
							color: item.color,
							order: item.order ?? list.length,
							items: (item.items || []).map((subItem: any) => ({
								...subItem,
								groupId: item.id,
								rendererId: subItem.rendererId || rId,
							})),
						}
						list.push(group)
					} else {
						list.push({
							...item,
							rendererId: rId,
							order: item.order ?? list.length,
						})
					}
				}

				list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
				storedTabs = [
					{
						id: 'tab_default',
						name: 'Main Rundown',
						entries: list,
					},
				]

				await dbStore.setRundownTabs(storedTabs)
			}

			runInAction(() => {
				this.tabs = storedTabs || []
				if (this.tabs.length === 0) {
					this.tabs = [
						{
							id: 'tab_default',
							name: 'Main Rundown',
							entries: [],
						},
					]
				}

				const savedActiveTabId = window.localStorage.getItem(getNameSpaceId() + 'controllerList_activeTabId')
				if (savedActiveTabId && this.tabs.some((t) => t.id === savedActiveTabId)) {
					this.activeTabId = savedActiveTabId
				} else {
					this.activeTabId = this.tabs[0].id
				}

				const active = this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0]
				this.entries = active.entries || []
				this.isInitialized = true
				this.restoreSelectionFromLocalStorage()
			})
		} catch (e) {
			console.error('Error when loading graphics list from IndexedDB', e)
		}
	}

	private saveSelectionToLocalStorage() {
		try {
			const key = getNameSpaceId() + 'controllerList_selection_' + this.activeTabId
			const data = {
				selectedIds: toJS(this.selectedIds),
				primarySelectedId: this.primarySelectedId,
			}
			window.localStorage.setItem(key, JSON.stringify(data))
		} catch (e) {
			console.error('Error saving selection to localStorage', e)
		}
	}

	private restoreSelectionFromLocalStorage() {
		try {
			const key = getNameSpaceId() + 'controllerList_selection_' + this.activeTabId
			const storedStr = window.localStorage.getItem(key)
			if (!storedStr) {
				this.selectedIds = []
				this.primarySelectedId = null
				return
			}
			const parsed = JSON.parse(storedStr)
			if (parsed && Array.isArray(parsed.selectedIds)) {
				const allIds = new Set<string>()
				for (const entry of this.entries) {
					allIds.add(entry.id)
					if (isPlaybackGroup(entry)) {
						for (const item of entry.items || []) {
							allIds.add(item.id)
						}
					}
				}

				const validSelectedIds = parsed.selectedIds.filter((id: string) => allIds.has(id))
				if (validSelectedIds.length > 0) {
					this.selectedIds = validSelectedIds
					this.primarySelectedId =
						parsed.primarySelectedId && allIds.has(parsed.primarySelectedId)
							? parsed.primarySelectedId
							: validSelectedIds[0]
				} else {
					this.selectedIds = []
					this.primarySelectedId = null
				}
			}
		} catch (e) {
			console.error('Error restoring selection from localStorage', e)
		}
	}

	public get activeTab(): RundownTab | undefined {
		return this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0]
	}

	public setActiveTab(tabId: string) {
		if (this.activeTabId === tabId) return
		const targetTab = this.tabs.find((t) => t.id === tabId)
		if (!targetTab) return

		const currentTab = this.tabs.find((t) => t.id === this.activeTabId)
		if (currentTab) {
			currentTab.entries = toJS(this.entries)
		}

		this.activeTabId = tabId
		this.entries = targetTab.entries || []
		this.selectedIds = []
		this.primarySelectedId = null
		this.undoStack = []
		this.redoStack = []

		try {
			window.localStorage.setItem(getNameSpaceId() + 'controllerList_activeTabId', tabId)
		} catch (e) {
			console.error('Failed to save activeTabId to localStorage', e)
		}

		this.restoreSelectionFromLocalStorage()
	}

	public addTab(name?: string): string {
		const newId = generateId('tab')
		const tabCount = this.tabs.length + 1
		const tabName = name?.trim() || `Rundown ${tabCount}`

		const currentTab = this.tabs.find((t) => t.id === this.activeTabId)
		if (currentTab) {
			currentTab.entries = toJS(this.entries)
		}

		const newTab: RundownTab = {
			id: newId,
			name: tabName,
			entries: [],
		}

		this.tabs.push(newTab)
		this.setActiveTab(newId)
		void this.saveListOrder()
		this.showNotification(`Created page "${tabName}"`)
		return newId
	}

	public renameTab(tabId: string, name: string) {
		const tab = this.tabs.find((t) => t.id === tabId)
		if (!tab) return
		const trimmed = name.trim()
		if (!trimmed) return
		tab.name = trimmed
		void this.saveListOrder()
		this.showNotification(`Renamed page to "${trimmed}"`)
	}

	public removeTab(tabId: string) {
		const tabIndex = this.tabs.findIndex((t) => t.id === tabId)
		if (tabIndex === -1) return
		const removedTab = this.tabs[tabIndex]

		this.tabs.splice(tabIndex, 1)

		if (this.tabs.length === 0) {
			const defaultTab: RundownTab = {
				id: generateId('tab'),
				name: 'Main Rundown',
				entries: [],
			}
			this.tabs.push(defaultTab)
			this.activeTabId = defaultTab.id
			this.entries = []
			this.selectedIds = []
			this.primarySelectedId = null
		} else if (this.activeTabId === tabId) {
			const nextIndex = Math.min(tabIndex, this.tabs.length - 1)
			const nextTab = this.tabs[nextIndex]
			this.activeTabId = nextTab.id
			this.entries = nextTab.entries || []
			this.selectedIds = []
			this.primarySelectedId = null
			try {
				window.localStorage.setItem(getNameSpaceId() + 'controllerList_activeTabId', nextTab.id)
			} catch (e) {
				console.error(e)
			}
		}

		void this.saveListOrder()
		this.showNotification(`Removed page "${removedTab.name}"`)
	}

	public duplicateTab(tabId: string) {
		const tab = this.tabs.find((t) => t.id === tabId)
		if (!tab) return

		if (this.activeTabId === tabId) {
			tab.entries = toJS(this.entries)
		}

		const newId = generateId('tab')
		const clonedEntries = (tab.entries || []).map((entry) => deepCloneWithNewIds(entry))

		const newTab: RundownTab = {
			id: newId,
			name: `${tab.name} (Copy)`,
			entries: clonedEntries,
		}

		const index = this.tabs.findIndex((t) => t.id === tabId)
		if (index !== -1) {
			this.tabs.splice(index + 1, 0, newTab)
		} else {
			this.tabs.push(newTab)
		}

		this.setActiveTab(newId)
		void this.saveListOrder()
		this.showNotification(`Duplicated page "${tab.name}"`)
	}

	public get defaultRendererId(): string {
		return appSettingsStore.getSelectedRendererId() || serverDataStore.renderersList[0]?.id || 'default'
	}

	/**
	 * Returns flattened list of all PlaybackItems (top-level + inside groups)
	 * For backwards compatibility with serverDataStore & graphicsListApi.
	 */
	public get items(): PlaybackItem[] {
		const result: PlaybackItem[] = []
		for (const entry of this.entries) {
			if (isPlaybackGroup(entry)) {
				result.push(...(entry.items || []))
			} else {
				result.push(entry)
			}
		}
		return result
	}

	public get selectedItemId(): string | null {
		if (this.primarySelectedId && this.selectedIds.includes(this.primarySelectedId)) {
			return this.primarySelectedId
		}
		return this.selectedIds.length > 0 ? this.selectedIds[0] : null
	}

	public set selectedItemId(id: string | null) {
		if (id) {
			this.selectItem(id)
		} else {
			this.clearSelection()
		}
	}

	public get selectedItem(): PlaybackItem | undefined {
		const id = this.selectedItemId
		if (!id) return undefined
		return this.items.find((i) => i.id === id)
	}

	public get selectedGroup(): PlaybackGroup | undefined {
		const id = this.selectedItemId
		if (!id) return undefined
		return this.entries.find((e) => isPlaybackGroup(e) && e.id === id) as PlaybackGroup | undefined
	}

	/**
	 * Returns all PlaybackItems corresponding to current selection
	 * (including items belonging to selected groups).
	 */
	public get selectedItems(): PlaybackItem[] {
		const selectedSet = new Set(this.selectedIds)
		const result: PlaybackItem[] = []
		const seenIds = new Set<string>()

		for (const entry of this.entries) {
			if (isPlaybackGroup(entry)) {
				if (selectedSet.has(entry.id)) {
					for (const item of entry.items || []) {
						if (!seenIds.has(item.id)) {
							seenIds.add(item.id)
							result.push(item)
						}
					}
				} else {
					for (const item of entry.items || []) {
						if (selectedSet.has(item.id) && !seenIds.has(item.id)) {
							seenIds.add(item.id)
							result.push(item)
						}
					}
				}
			} else {
				if (selectedSet.has(entry.id) && !seenIds.has(entry.id)) {
					seenIds.add(entry.id)
					result.push(entry)
				}
			}
		}
		return result
	}

	/**
	 * Returns true if items in the rundown use 2 or more distinct rendererIds.
	 * If all items use the same renderer, returns false so redundant pills are hidden.
	 */
	public get hasMultipleRenderersInList(): boolean {
		const items = this.items
		if (items.length <= 1) return false
		const first = items[0].rendererId
		return items.some((item) => item.rendererId !== first)
	}

	/**
	 * Returns true if items in the rundown use 2 or more distinct renderTargets.
	 * If all items use the same renderTarget, returns false so redundant pills are hidden.
	 */
	public get hasMultipleRenderTargetsInList(): boolean {
		const items = this.items
		if (items.length <= 1) return false
		const first = items[0].renderTarget
		return items.some((item) => !isEqual(item.renderTarget, first))
	}

	public get canUndo(): boolean {
		return this.undoStack.length > 0
	}

	public get canRedo(): boolean {
		return this.redoStack.length > 0
	}

	public isIdSelected(id: string): boolean {
		return this.selectedIds.includes(id)
	}

	public isGroupSelected(groupId: string): boolean {
		return this.selectedIds.includes(groupId)
	}

	public getSelectedItem(): PlaybackItem | undefined {
		return this.selectedItem
	}

	public async saveListOrder() {
		try {
			const active = this.tabs.find((t) => t.id === this.activeTabId)
			if (active) {
				active.entries = toJS(this.entries)
			}

			await dbStore.setRundownTabs(toJS(this.tabs))

			const currentObj = await dbStore.getAllQueuedGraphics<any>()
			for (const c of currentObj) {
				await dbStore.removeQueuedGraphic(c.id)
			}

			const list = this.entries
			for (let i = 0; i < list.length; i++) {
				const entry = list[i]
				await dbStore.putQueuedGraphic({
					...toJS(entry),
					order: i,
				})
			}
		} catch (e) {
			console.error('Failed to save list data', e)
		}
	}

	private pushHistory() {
		if (this.isApplyingHistory) return
		const currentSnapshot = JSON.stringify(toJS(this.entries))
		this.undoStack.push(currentSnapshot)
		if (this.undoStack.length > 50) this.undoStack.shift()
		this.redoStack = []
	}

	public undo() {
		if (this.undoStack.length === 0) return

		this.redoStack.push(JSON.stringify(toJS(this.entries)))
		const prevSnapshot = this.undoStack.pop()

		if (prevSnapshot) {
			this.isApplyingHistory = true
			try {
				const parsed = JSON.parse(prevSnapshot)
				this.entries = parsed
				this.saveListOrder().catch(console.error)
				this.showNotification('Undo')
			} finally {
				this.isApplyingHistory = false
			}
		}
	}

	public redo() {
		if (this.redoStack.length === 0) return

		this.undoStack.push(JSON.stringify(toJS(this.entries)))
		const nextSnapshot = this.redoStack.pop()

		if (nextSnapshot) {
			this.isApplyingHistory = true
			try {
				const parsed = JSON.parse(nextSnapshot)
				this.entries = parsed
				this.saveListOrder().catch(console.error)
				this.showNotification('Redo')
			} finally {
				this.isApplyingHistory = false
			}
		}
	}

	public showNotification(msg: string, severity: SnackbarSeverity = 'info') {
		this.snackbarMessage = msg
		this.snackbarSeverity = severity
	}

	public showError(msg: string) {
		this.showNotification(msg, 'error')
	}

	public setSnackbarMessage(msg: string | null, severity: SnackbarSeverity = 'info') {
		this.snackbarMessage = msg
		this.snackbarSeverity = severity
	}

	public setSearchQuery(query: string) {
		this.searchQuery = query
	}

	// --------------------------------------------------------------------------
	// ITEM CRUD
	// --------------------------------------------------------------------------

	public async addItem(rendererId: string | undefined, graphicId: string, targetGroupId?: string) {
		this.pushHistory()
		const selectedItem = this.selectedItem
		const selectedGroup = this.selectedGroup

		// 1. Search pre-existing items for the same graphicId to reuse their Renderer and RenderTarget
		const allExistingItems = this.items.filter((item) => item.graphicId === graphicId)
		let existingRendererId: string | undefined
		let existingRenderTarget: unknown | undefined

		if (allExistingItems.length > 0) {
			let latestItem = allExistingItems[0]
			let latestTime =
				(latestItem.updatedAt ?? (latestItem.id.startsWith('item_') ? parseInt(latestItem.id.split('_')[1], 10) : 0)) ||
				0

			for (let i = 1; i < allExistingItems.length; i++) {
				const item = allExistingItems[i]
				const itemTime =
					(item.updatedAt ?? (item.id.startsWith('item_') ? parseInt(item.id.split('_')[1], 10) : 0)) || 0
				if (itemTime >= latestTime) {
					latestItem = item
					latestTime = itemTime
				}
			}

			existingRendererId = latestItem.rendererId
			existingRenderTarget = clone(latestItem.renderTarget)
		}

		const rId =
			existingRendererId ||
			rendererId ||
			selectedItem?.rendererId ||
			selectedGroup?.rendererId ||
			appSettingsStore.getSelectedRendererId() ||
			this.defaultRendererId

		const id = generateId('item')
		let renderer = serverDataStore.renderersInfo.get(rId)
		if (!renderer) {
			renderer = await serverDataStore.loadRenderer(rId)
		}

		let renderTarget: unknown | undefined
		if (existingRenderTarget !== undefined) {
			renderTarget = existingRenderTarget
		} else {
			renderTarget = renderer?.renderTargetSchema ? getDefaultDataFromSchema(renderer.renderTargetSchema) : undefined
		}

		let graphicInfo = serverDataStore.graphicsInfo.get(graphicId)
		if (!graphicInfo) {
			graphicInfo = await serverDataStore.loadGraphic(graphicId)
		}
		const graphicData = graphicInfo?.graphic.schema ? getDefaultDataFromSchema(graphicInfo.graphic.schema) : undefined

		runInAction(() => {
			const newItem: PlaybackItem = {
				id,
				graphicId,
				rendererId: rId,
				graphicData: clone(graphicData),
				customActionData: {},
				renderTarget: clone(renderTarget),
				groupId: undefined,
				updatedAt: Date.now(),
			}

			// 1. Explicit targetGroupId passed
			if (targetGroupId) {
				const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === targetGroupId) as
					| PlaybackGroup
					| undefined
				if (group) {
					newItem.groupId = group.id
					group.items.push(newItem)
				} else {
					this.entries.push(newItem)
				}
			} else if (selectedGroup) {
				// 2. A group is selected: insert at the end of the group
				newItem.groupId = selectedGroup.id
				selectedGroup.items.push(newItem)
			} else if (selectedItem) {
				// 3. A graphic item is selected: insert after it
				if (selectedItem.groupId) {
					const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === selectedItem.groupId) as
						| PlaybackGroup
						| undefined
					if (group) {
						newItem.groupId = group.id
						const idx = group.items.findIndex((i) => i.id === selectedItem.id)
						if (idx > -1) {
							group.items.splice(idx + 1, 0, newItem)
						} else {
							group.items.push(newItem)
						}
					} else {
						this.entries.push(newItem)
					}
				} else {
					const idx = this.entries.findIndex((e) => e.id === selectedItem.id)
					if (idx > -1) {
						this.entries.splice(idx + 1, 0, newItem)
					} else {
						this.entries.push(newItem)
					}
				}
			} else {
				// 4. Nothing selected: append to root entries
				this.entries.push(newItem)
			}

			void this.saveListOrder()
			this.selectItem(id)
		})
	}

	public removeItem(id: string) {
		const visibleIds = this.flattenedSelectableIds
		const idx = visibleIds.indexOf(id)
		let nextSelectId: string | null = null

		if (idx > 0) {
			nextSelectId = visibleIds[idx - 1]
		} else if (idx === 0) {
			const remaining = visibleIds.filter((vid) => vid !== id)
			nextSelectId = remaining[0] || null
		}

		this.pushHistory()
		let removed = false
		const newList: PlaybackListEntry[] = []

		for (const entry of this.entries) {
			if (entry.id === id) {
				removed = true
				continue
			}
			if (isPlaybackGroup(entry)) {
				const groupItems = entry.items.filter((item) => item.id !== id)
				if (groupItems.length !== entry.items.length) {
					removed = true
				}
				newList.push({
					...entry,
					items: groupItems,
				})
			} else {
				newList.push(entry)
			}
		}

		if (removed) {
			this.entries = newList
			dbStore.removeQueuedGraphic(id).catch(console.error)
			this.saveListOrder().catch(console.error)
			if (nextSelectId) {
				this.selectItem(nextSelectId)
			} else {
				this.clearSelection()
			}
		}
	}

	public removeSelected() {
		const idsToRemove = new Set(this.selectedIds)
		if (idsToRemove.size === 0) return

		const visibleIds = this.flattenedSelectableIds
		const firstSelectedIdx = visibleIds.findIndex((id) => idsToRemove.has(id))
		let nextSelectId: string | null = null

		if (firstSelectedIdx > 0) {
			nextSelectId = visibleIds[firstSelectedIdx - 1]
		} else if (firstSelectedIdx === 0) {
			const remaining = visibleIds.filter((id) => !idsToRemove.has(id))
			nextSelectId = remaining[0] || null
		}

		this.pushHistory()

		const newList: PlaybackListEntry[] = []

		for (const entry of this.entries) {
			if (idsToRemove.has(entry.id)) {
				continue
			}
			if (isPlaybackGroup(entry)) {
				const groupItems = entry.items.filter((item) => !idsToRemove.has(item.id))
				newList.push({
					...entry,
					items: groupItems,
				})
			} else {
				newList.push(entry)
			}
		}

		this.entries = newList
		for (const id of idsToRemove) {
			dbStore.removeQueuedGraphic(id).catch(console.error)
		}
		if (nextSelectId) {
			this.selectItem(nextSelectId)
		} else {
			this.clearSelection()
		}
		this.saveListOrder().catch(console.error)
		this.showNotification(`Removed ${idsToRemove.size} item(s)`)
	}

	public clearItems() {
		this.pushHistory()
		const list = [...this.entries]
		this.entries = []
		this.clearSelection()

		for (const entry of list) {
			dbStore.removeQueuedGraphic(entry.id).catch(console.error)
		}
		this.saveListOrder().catch(console.error)
	}

	public updateItemData(id: string, partialData: Partial<PlaybackItem>) {
		const now = Date.now()
		for (let i = 0; i < this.entries.length; i++) {
			const entry = this.entries[i]
			if (entry.id === id && !isPlaybackGroup(entry)) {
				this.entries[i] = { ...entry, ...partialData, updatedAt: now }
				this.saveListOrder().catch(console.error)
				return
			}
			if (isPlaybackGroup(entry)) {
				const itemIdx = entry.items.findIndex((item) => item.id === id)
				if (itemIdx > -1) {
					entry.items[itemIdx] = { ...entry.items[itemIdx], ...partialData, updatedAt: now }
					this.saveListOrder().catch(console.error)
					return
				}
			}
		}
	}

	public updateMultipleItems(ids: string[], partialData: Partial<PlaybackItem>) {
		const now = Date.now()
		const idSet = new Set(ids)
		let changed = false

		for (let i = 0; i < this.entries.length; i++) {
			const entry = this.entries[i]
			if (!isPlaybackGroup(entry) && idSet.has(entry.id)) {
				this.entries[i] = { ...entry, ...partialData, updatedAt: now }
				changed = true
			} else if (isPlaybackGroup(entry)) {
				for (let j = 0; j < entry.items.length; j++) {
					if (idSet.has(entry.items[j].id)) {
						entry.items[j] = { ...entry.items[j], ...partialData, updatedAt: now }
						changed = true
					}
				}
			}
		}

		if (changed) {
			this.saveListOrder().catch(console.error)
		}
	}

	// --------------------------------------------------------------------------
	// GROUP OPERATIONS
	// --------------------------------------------------------------------------

	public addGroup(name: string = 'New Group', initialItems: PlaybackItem[] = []): PlaybackGroup {
		this.pushHistory()
		const groupId = generateId('group')
		const newGroup: PlaybackGroup = {
			id: groupId,
			isGroup: true,
			name,
			collapsed: false,
			items: initialItems.map((item) => ({ ...item, groupId })),
		}

		const selectedItem = this.selectedItem
		const selectedGroup = this.selectedGroup

		if (selectedGroup) {
			const idx = this.entries.findIndex((e) => e.id === selectedGroup.id)
			if (idx > -1) {
				this.entries.splice(idx + 1, 0, newGroup)
			} else {
				this.entries.push(newGroup)
			}
		} else if (selectedItem) {
			const targetId = selectedItem.groupId || selectedItem.id
			const idx = this.entries.findIndex((e) => e.id === targetId)
			if (idx > -1) {
				this.entries.splice(idx + 1, 0, newGroup)
			} else {
				this.entries.push(newGroup)
			}
		} else {
			this.entries.push(newGroup)
		}

		this.saveListOrder().catch(console.error)
		this.selectGroup(groupId)
		this.showNotification(`Created group "${name}"`)
		return newGroup
	}

	public groupSelected(name?: string) {
		const selected = this.selectedItems
		if (selected.length === 0) return
		this.pushHistory()

		const groupName = name || `Group (${selected.length} items)`
		const selectedIdSet = new Set(selected.map((s) => s.id))

		let insertIndex = -1
		for (let i = 0; i < this.entries.length; i++) {
			const entry = this.entries[i]
			if (selectedIdSet.has(entry.id)) {
				insertIndex = i
				break
			}
			if (isPlaybackGroup(entry) && entry.items.some((item) => selectedIdSet.has(item.id))) {
				insertIndex = i
				break
			}
		}
		if (insertIndex === -1) insertIndex = this.entries.length

		const groupId = generateId('group')
		const groupItems: PlaybackItem[] = selected.map((item) => ({
			...clone(item),
			groupId,
		}))

		const newGroup: PlaybackGroup = {
			id: groupId,
			isGroup: true,
			name: groupName,
			collapsed: false,
			items: groupItems,
		}

		const newList: PlaybackListEntry[] = []
		for (const entry of this.entries) {
			if (selectedIdSet.has(entry.id)) {
				continue
			}
			if (isPlaybackGroup(entry)) {
				const remainingItems = entry.items.filter((item) => !selectedIdSet.has(item.id))
				if (remainingItems.length > 0 || !this.selectedIds.includes(entry.id)) {
					newList.push({
						...entry,
						items: remainingItems,
					})
				}
			} else {
				newList.push(entry)
			}
		}

		const clampedIndex = Math.min(insertIndex, newList.length)
		newList.splice(clampedIndex, 0, newGroup)

		this.entries = newList
		this.saveListOrder().catch(console.error)
		this.selectGroup(groupId)
		this.showNotification(`Grouped ${selected.length} items into "${groupName}"`)
	}

	public ungroup(groupId: string) {
		this.pushHistory()
		const groupIdx = this.entries.findIndex((e) => isPlaybackGroup(e) && e.id === groupId)
		if (groupIdx === -1) return

		const group = this.entries[groupIdx] as PlaybackGroup
		const unpackedItems: PlaybackItem[] = (group.items || []).map((item) => ({
			...item,
			groupId: undefined,
		}))

		const newList = [...this.entries]
		newList.splice(groupIdx, 1, ...unpackedItems)

		this.entries = newList
		this.saveListOrder().catch(console.error)
		this.selectedIds = unpackedItems.map((i) => i.id)
		this.showNotification(`Ungrouped "${group.name}"`)
	}

	public renameGroup(groupId: string, newName: string) {
		const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === groupId) as PlaybackGroup | undefined
		if (group) {
			this.pushHistory()
			group.name = newName.trim() || 'Untitled Group'
			this.saveListOrder().catch(console.error)
		}
	}

	public toggleGroupCollapse(groupId: string) {
		const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === groupId) as PlaybackGroup | undefined
		if (group) {
			group.collapsed = !group.collapsed
			this.saveListOrder().catch(console.error)
		}
	}

	public setGroupCollapse(groupId: string, collapsed: boolean) {
		const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === groupId) as PlaybackGroup | undefined
		if (group) {
			group.collapsed = collapsed
			this.saveListOrder().catch(console.error)
		}
	}

	public setAllGroupsCollapse(collapsed: boolean) {
		for (const entry of this.entries) {
			if (isPlaybackGroup(entry)) {
				entry.collapsed = collapsed
			}
		}
		this.saveListOrder().catch(console.error)
	}

	// --------------------------------------------------------------------------
	// SELECTION
	// --------------------------------------------------------------------------

	private get flattenedSelectableIds(): string[] {
		const result: string[] = []
		for (const entry of this.entries) {
			result.push(entry.id)
			if (isPlaybackGroup(entry) && !entry.collapsed) {
				for (const item of entry.items || []) {
					result.push(item.id)
				}
			}
		}
		return result
	}

	public selectItem(id: string | null, options?: { toggle?: boolean; range?: boolean }) {
		if (!id) {
			this.clearSelection()
			return
		}

		const visibleIds = this.flattenedSelectableIds

		if (options?.range) {
			const lastPrimary = this.primarySelectedId || visibleIds[0]
			const startIndex = visibleIds.indexOf(lastPrimary)
			const endIndex = visibleIds.indexOf(id)

			if (startIndex !== -1 && endIndex !== -1) {
				const low = Math.min(startIndex, endIndex)
				const high = Math.max(startIndex, endIndex)
				const rangeIds = visibleIds.slice(low, high + 1)

				const currentSet = new Set(options.toggle ? this.selectedIds : [])
				rangeIds.forEach((rid) => currentSet.add(rid))
				this.selectedIds = Array.from(currentSet)
				this.primarySelectedId = id
				return
			}
		}

		if (options?.toggle) {
			const current = this.selectedIds
			if (current.includes(id)) {
				this.selectedIds = current.filter((i) => i !== id)
				if (this.primarySelectedId === id) {
					this.primarySelectedId = this.selectedIds[0] || null
				}
			} else {
				this.selectedIds = [...current, id]
				this.primarySelectedId = id
			}
			return
		}

		this.selectedIds = [id]
		this.primarySelectedId = id
	}

	public selectGroup(groupId: string, options?: { toggle?: boolean; range?: boolean }) {
		this.selectItem(groupId, options)
	}

	public selectAll() {
		this.selectedIds = this.flattenedSelectableIds
	}

	public clearSelection() {
		this.selectedIds = []
		this.primarySelectedId = null
	}

	public selectNext(extendRange: boolean = false) {
		const visibleIds = this.flattenedSelectableIds
		if (visibleIds.length === 0) return
		const currentPrimary = this.primarySelectedId

		if (!currentPrimary) {
			this.selectItem(visibleIds[0])
			return
		}

		const ix = visibleIds.indexOf(currentPrimary)
		if (ix > -1 && ix < visibleIds.length - 1) {
			const nextId = visibleIds[ix + 1]
			this.selectItem(nextId, { range: extendRange })
		}
	}

	public selectPrev(extendRange: boolean = false) {
		const visibleIds = this.flattenedSelectableIds
		if (visibleIds.length === 0) return
		const currentPrimary = this.primarySelectedId

		if (!currentPrimary) {
			this.selectItem(visibleIds[visibleIds.length - 1])
			return
		}

		const ix = visibleIds.indexOf(currentPrimary)
		if (ix > 0) {
			const prevId = visibleIds[ix - 1]
			this.selectItem(prevId, { range: extendRange })
		}
	}

	// --------------------------------------------------------------------------
	// CLIPBOARD & DUPLICATION
	// --------------------------------------------------------------------------

	public copySelection() {
		const selectedSet = new Set(this.selectedIds)
		if (selectedSet.size === 0) return

		const copiedEntries: PlaybackListEntry[] = []

		for (const entry of this.entries) {
			if (selectedSet.has(entry.id)) {
				copiedEntries.push(clone(entry))
			} else if (isPlaybackGroup(entry)) {
				const selectedChildren = entry.items.filter((item) => selectedSet.has(item.id))
				if (selectedChildren.length > 0) {
					copiedEntries.push(...selectedChildren.map((item) => clone(item)))
				}
			}
		}

		if (copiedEntries.length > 0) {
			this.clipboard = copiedEntries
			this.clipboardIsCut = false
			this.showNotification(`Copied ${copiedEntries.length} item(s)`)

			try {
				void navigator.clipboard?.writeText(JSON.stringify(copiedEntries, null, 2))
			} catch {
				// Ignore clipboard permissions error
			}
		}
	}

	public cutSelection() {
		this.copySelection()
		if (this.clipboard && this.clipboard.length > 0) {
			this.clipboardIsCut = true
			this.removeSelected()
			this.showNotification(`Cut ${this.clipboard.length} item(s)`)
		}
	}

	public paste(targetGroupId?: string, targetIndex?: number) {
		if (!this.clipboard || this.clipboard.length === 0) return
		this.pushHistory()

		const newEntries = this.clipboard.map((entry) => deepCloneWithNewIds(entry))
		const newlyCreatedIds: string[] = []

		for (const entry of newEntries) {
			newlyCreatedIds.push(entry.id)
			if (isPlaybackGroup(entry)) {
				entry.items.forEach((it) => {
					newlyCreatedIds.push(it.id)
				})
			}
		}

		if (targetGroupId !== undefined || targetIndex !== undefined) {
			if (targetGroupId) {
				const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === targetGroupId) as
					| PlaybackGroup
					| undefined
				if (group) {
					const itemsToInsert: PlaybackItem[] = []
					for (const entry of newEntries) {
						if (isPlaybackGroup(entry)) {
							itemsToInsert.push(...entry.items)
						} else {
							entry.groupId = targetGroupId
							itemsToInsert.push(entry)
						}
					}
					const insertAt = targetIndex !== undefined ? targetIndex : group.items.length
					group.items.splice(insertAt, 0, ...itemsToInsert)
				}
			} else {
				const insertAt = targetIndex !== undefined ? targetIndex : this.entries.length
				this.entries.splice(insertAt, 0, ...newEntries)
			}
		} else {
			// Selection-aware paste: insert after currently selected item
			const selectedItem = this.selectedItem
			const selectedGroup = this.selectedGroup

			if (selectedItem) {
				if (selectedItem.groupId) {
					const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === selectedItem.groupId) as
						| PlaybackGroup
						| undefined
					if (group) {
						const itemsToInsert: PlaybackItem[] = []
						for (const entry of newEntries) {
							if (isPlaybackGroup(entry)) {
								itemsToInsert.push(...entry.items)
							} else {
								entry.groupId = group.id
								itemsToInsert.push(entry)
							}
						}
						const itemIdx = group.items.findIndex((i) => i.id === selectedItem.id)
						const insertAt = itemIdx > -1 ? itemIdx + 1 : group.items.length
						group.items.splice(insertAt, 0, ...itemsToInsert)
					} else {
						this.entries.push(...newEntries)
					}
				} else {
					const itemIdx = this.entries.findIndex((e) => e.id === selectedItem.id)
					const insertAt = itemIdx > -1 ? itemIdx + 1 : this.entries.length
					this.entries.splice(insertAt, 0, ...newEntries)
				}
			} else if (selectedGroup) {
				const containsGroup = newEntries.some((e) => isPlaybackGroup(e))
				if (containsGroup) {
					const groupIdx = this.entries.findIndex((e) => e.id === selectedGroup.id)
					const insertAt = groupIdx > -1 ? groupIdx + 1 : this.entries.length
					this.entries.splice(insertAt, 0, ...newEntries)
				} else {
					for (const entry of newEntries) {
						if (!isPlaybackGroup(entry)) {
							entry.groupId = selectedGroup.id
							selectedGroup.items.push(entry)
						}
					}
				}
			} else {
				this.entries.push(...newEntries)
			}
		}

		this.saveListOrder().catch(console.error)
		this.selectedIds = newlyCreatedIds
		this.showNotification(`Pasted ${newEntries.length} item(s)`)
	}

	public duplicateSelection() {
		const selectedSet = new Set(this.selectedIds)
		if (selectedSet.size === 0) return
		this.pushHistory()

		const newSelectedIds: string[] = []
		const newList: PlaybackListEntry[] = []

		for (const entry of this.entries) {
			newList.push(entry)

			if (selectedSet.has(entry.id)) {
				const dupe = deepCloneWithNewIds(entry)
				newList.push(dupe)
				newSelectedIds.push(dupe.id)
			} else if (isPlaybackGroup(entry)) {
				const newGroupItems: PlaybackItem[] = []
				for (const item of entry.items) {
					newGroupItems.push(item)
					if (selectedSet.has(item.id)) {
						const dupeItem = clone(item)
						dupeItem.id = generateId('item')
						dupeItem.groupId = entry.id
						dupeItem.graphicInstanceId = undefined
						newGroupItems.push(dupeItem)
						newSelectedIds.push(dupeItem.id)
					}
				}
				entry.items = newGroupItems
			}
		}

		this.entries = newList
		this.saveListOrder().catch(console.error)
		if (newSelectedIds.length > 0) {
			this.selectedIds = newSelectedIds
			this.showNotification(`Duplicated ${newSelectedIds.length} item(s)`)
		}
	}

	public duplicateItem(itemId: string, targetGroupId?: string, targetIndex?: number) {
		const item = this.items.find((i) => i.id === itemId)
		if (!item) return
		this.pushHistory()

		const dupe = clone(item)
		dupe.id = generateId('item')
		dupe.graphicInstanceId = undefined
		dupe.groupId = targetGroupId

		if (targetGroupId) {
			const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === targetGroupId) as PlaybackGroup | undefined
			if (group) {
				const idx = targetIndex !== undefined ? targetIndex : group.items.length
				group.items.splice(idx, 0, dupe)
			}
		} else {
			const idx = targetIndex !== undefined ? targetIndex : this.entries.length
			this.entries.splice(idx, 0, dupe)
		}

		this.saveListOrder().catch(console.error)
		this.selectItem(dupe.id)
		this.showNotification('Duplicated item')
	}

	public duplicateGroup(groupId: string, targetIndex?: number) {
		const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === groupId) as PlaybackGroup | undefined
		if (!group) return
		this.pushHistory()

		const dupe = deepCloneWithNewIds(group) as PlaybackGroup
		dupe.name = `${group.name} (Copy)`

		const currentIdx = this.entries.indexOf(group)
		const idx = targetIndex !== undefined ? targetIndex : currentIdx + 1
		this.entries.splice(idx, 0, dupe)

		this.saveListOrder().catch(console.error)
		this.selectGroup(dupe.id)
		this.showNotification(`Duplicated group "${dupe.name}"`)
	}

	// --------------------------------------------------------------------------
	// DRAG AND DROP (WITH REORDER & ALT-DRAG COPY)
	// --------------------------------------------------------------------------

	public moveOrCopyEntry(
		source: { id: string; groupId?: string },
		target: { index: number; groupId?: string },
		copy: boolean = false
	) {
		this.pushHistory()

		let sourceEntry: PlaybackListEntry | undefined
		let sourceList: PlaybackListEntry[] | PlaybackItem[] | undefined
		let sourceIndex = -1

		if (source.groupId) {
			const group = this.entries.find((e) => isPlaybackGroup(e) && e.id === source.groupId) as PlaybackGroup | undefined
			if (group) {
				sourceList = group.items
				sourceIndex = group.items.findIndex((i) => i.id === source.id)
				if (sourceIndex > -1) {
					sourceEntry = group.items[sourceIndex]
				}
			}
		} else {
			sourceList = this.entries
			sourceIndex = this.entries.findIndex((e) => e.id === source.id)
			if (sourceIndex > -1) {
				sourceEntry = this.entries[sourceIndex]
			}
		}

		if (!sourceEntry || sourceIndex === -1) return

		if (!copy && source.groupId === target.groupId && sourceIndex === target.index) {
			return
		}

		let itemToInsert: PlaybackListEntry
		if (copy) {
			itemToInsert = deepCloneWithNewIds(sourceEntry)
		} else {
			if (sourceList) {
				sourceList.splice(sourceIndex, 1)
			}
			itemToInsert = sourceEntry
		}

		if (target.groupId && !isPlaybackGroup(itemToInsert)) {
			const targetGroup = this.entries.find((e) => isPlaybackGroup(e) && e.id === target.groupId) as
				| PlaybackGroup
				| undefined
			if (targetGroup) {
				itemToInsert.groupId = target.groupId
				let insertIdx = target.index
				if (!copy && source.groupId === target.groupId && sourceIndex < target.index) {
					insertIdx = Math.max(0, insertIdx - 1)
				}
				insertIdx = Math.min(insertIdx, targetGroup.items.length)
				targetGroup.items.splice(insertIdx, 0, itemToInsert)
			}
		} else {
			if (!isPlaybackGroup(itemToInsert)) {
				itemToInsert.groupId = undefined
			}
			let insertIdx = target.index
			if (target.groupId && isPlaybackGroup(itemToInsert)) {
				const parentGroupIdx = this.entries.findIndex((e) => e.id === target.groupId)
				insertIdx = parentGroupIdx > -1 ? parentGroupIdx + 1 : this.entries.length
			}
			if (!copy && !source.groupId && sourceIndex < target.index) {
				insertIdx = Math.max(0, insertIdx - 1)
			}
			insertIdx = Math.min(insertIdx, this.entries.length)
			this.entries.splice(insertIdx, 0, itemToInsert)
		}

		this.saveListOrder().catch(console.error)
		this.selectItem(itemToInsert.id)
		if (copy) {
			this.showNotification('Copied entry via Alt+Drag')
		}
	}

	public moveItem(fromIndex: number, toIndex: number) {
		this.moveOrCopyEntry({ id: this.entries[fromIndex]?.id }, { index: toIndex }, false)
	}

	public moveSelectedUp() {
		const selectedSet = new Set(this.selectedIds)
		if (selectedSet.size === 0) return

		let hasMoved = false

		// 1. Process intra-group movements for groups that are NOT themselves selected
		for (let gIdx = 0; gIdx < this.entries.length; gIdx++) {
			const entry = this.entries[gIdx]
			if (!isPlaybackGroup(entry)) continue
			if (selectedSet.has(entry.id)) {
				// Group itself is selected, it will move as a whole at root level
				continue
			}

			const items = entry.items || []
			if (items.length === 0) continue

			// Check if items at the very top of the group are selected (move out of group before group)
			let topSelectedCount = 0
			while (topSelectedCount < items.length && selectedSet.has(items[topSelectedCount].id)) {
				topSelectedCount++
			}

			if (topSelectedCount > 0) {
				if (!hasMoved) {
					this.pushHistory()
					hasMoved = true
				}
				const itemsToExtract = items.splice(0, topSelectedCount)
				for (const it of itemsToExtract) {
					it.groupId = undefined
				}
				this.entries.splice(gIdx, 0, ...itemsToExtract)
				gIdx += topSelectedCount // skip newly inserted root entries
			}

			// For remaining items inside this group (if any), shift them up if possible
			for (let i = 1; i < entry.items.length; i++) {
				if (selectedSet.has(entry.items[i].id) && !selectedSet.has(entry.items[i - 1].id)) {
					if (!hasMoved) {
						this.pushHistory()
						hasMoved = true
					}
					const temp = entry.items[i]
					entry.items[i] = entry.items[i - 1]
					entry.items[i - 1] = temp
				}
			}
		}

		// 2. Process root-level movements (this.entries)
		for (let i = 1; i < this.entries.length; i++) {
			const entry = this.entries[i]
			const prevEntry = this.entries[i - 1]

			if (selectedSet.has(entry.id) && !selectedSet.has(prevEntry.id)) {
				if (!hasMoved) {
					this.pushHistory()
					hasMoved = true
				}
				// If prevEntry is an expanded group and entry is a PlaybackItem (not group)
				if (isPlaybackGroup(prevEntry) && !prevEntry.collapsed && !isPlaybackGroup(entry)) {
					this.entries.splice(i, 1)
					entry.groupId = prevEntry.id
					prevEntry.items.push(entry)
					i-- // Adjust index since element removed
				} else {
					this.entries[i] = prevEntry
					this.entries[i - 1] = entry
				}
			}
		}

		if (hasMoved) {
			this.saveListOrder().catch(console.error)
		}
	}

	public moveSelectedDown() {
		const selectedSet = new Set(this.selectedIds)
		if (selectedSet.size === 0) return

		let hasMoved = false

		// 1. Process intra-group movements for groups that are NOT themselves selected
		// Iterate in reverse so modifications don't shift unprocessed groups
		for (let gIdx = this.entries.length - 1; gIdx >= 0; gIdx--) {
			const entry = this.entries[gIdx]
			if (!isPlaybackGroup(entry)) continue
			if (selectedSet.has(entry.id)) {
				// Group itself is selected, it will move as a whole at root level
				continue
			}

			const items = entry.items || []
			if (items.length === 0) continue

			// Check if items at the very bottom of group are selected (move out of group after group)
			let bottomSelectedCount = 0
			while (bottomSelectedCount < items.length && selectedSet.has(items[items.length - 1 - bottomSelectedCount].id)) {
				bottomSelectedCount++
			}

			if (bottomSelectedCount > 0) {
				if (!hasMoved) {
					this.pushHistory()
					hasMoved = true
				}
				const startIndex = items.length - bottomSelectedCount
				const itemsToExtract = items.splice(startIndex, bottomSelectedCount)
				for (const it of itemsToExtract) {
					it.groupId = undefined
				}
				this.entries.splice(gIdx + 1, 0, ...itemsToExtract)
			}

			// For remaining items inside this group (if any), shift them down if possible
			for (let i = entry.items.length - 2; i >= 0; i--) {
				if (selectedSet.has(entry.items[i].id) && !selectedSet.has(entry.items[i + 1].id)) {
					if (!hasMoved) {
						this.pushHistory()
						hasMoved = true
					}
					const temp = entry.items[i]
					entry.items[i] = entry.items[i + 1]
					entry.items[i + 1] = temp
				}
			}
		}

		// 2. Process root-level movements (this.entries)
		for (let i = this.entries.length - 2; i >= 0; i--) {
			const entry = this.entries[i]
			const nextEntry = this.entries[i + 1]

			if (selectedSet.has(entry.id) && !selectedSet.has(nextEntry.id)) {
				if (!hasMoved) {
					this.pushHistory()
					hasMoved = true
				}
				// If nextEntry is an expanded group and entry is a PlaybackItem (not group)
				if (isPlaybackGroup(nextEntry) && !nextEntry.collapsed && !isPlaybackGroup(entry)) {
					this.entries.splice(i, 1)
					entry.groupId = nextEntry.id
					nextEntry.items.unshift(entry)
				} else {
					this.entries[i] = nextEntry
					this.entries[i + 1] = entry
				}
			}
		}

		if (hasMoved) {
			this.saveListOrder().catch(console.error)
		}
	}
}

export const graphicsListStore = new GraphicsList()
