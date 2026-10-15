import { action, computed, makeObservable, observable, reaction, runInAction, toJS } from 'mobx'
import { dbStore } from './db.js'
import { serverDataStore } from './serverData.js'
import { appSettingsStore, PRELIMINARY_RENDERER_ID } from './appSettings.js'
import { getDefaultDataFromSchema } from 'ograf-form'
import { clone } from '../lib/lib.js'
import { getNameSpaceId } from '../lib/namespace.js'
import { UserInterfaceComponentInfo, registerCustomGuiComponent } from '@ograf-server/shared'

export const CELL_SIZE = 10

export interface OpenCustomGuiDialog {
	id: string
	instanceId: string
	componentId: string
	graphicId: string
	name: string
	description?: string
	componentClass: CustomElementConstructor
}

export interface GraphicInstance {
	id: string
	name: string
	graphicId: string
	rendererId: string
	graphicData: unknown | undefined
	customActionData: { [actionId: string]: unknown }
	renderTarget: unknown | undefined
	graphicInstanceId?: string
	color?: string
	updatedAt?: number
}

export type GridWidgetType =
	| 'action-button'
	| 'custom-action-button'
	| 'data-form'
	| 'custom-action-form'
	| 'target-config'
	| 'custom-gui'
	| 'status-badge'
	| 'section-frame'

export type StandardActionType =
	| 'quickPlay'
	| 'load'
	| 'play'
	| 'update'
	| 'stop'
	| 'clearTarget'
	| 'clearRenderer'
	| 'clearAll'

export interface GridWidget {
	id: string
	type: GridWidgetType
	x: number // in 10px grid cells
	y: number // in 10px grid cells
	w: number // width in 10px grid cells
	h: number // height in 10px grid cells
	zIndex: number

	// Visual styling
	label?: string
	color?: string
	textSize?: 'small' | 'medium' | 'large'
	icon?: string
	hotkey?: string

	// Graphic Instance bindings
	instanceId?: string
	targetInstanceIds?: string[] // When an action button targets multiple instances

	// Action & Custom Action config
	actionType?: StandardActionType
	customActionId?: string
	usePresetData?: boolean
	presetData?: unknown

	// Form config (ograf-form)
	hiddenProperties?: string[]
	autoUpdate?: boolean
	compact?: boolean
	hideHeader?: boolean
	hideFieldLabels?: boolean
	showTriggerButton?: boolean
	showRendererSelector?: boolean

	// Custom GUI config
	customGuiId?: string
	customGuiDisplayMode?: 'embedded' | 'button'
}

export interface GridViewport {
	panX: number
	panY: number
	zoom: number
}

export interface GridTab {
	id: string
	name: string
	widgets: GridWidget[]
	viewport?: GridViewport
}

export interface StoredGridState {
	tabs: GridTab[]
	graphicInstances: GraphicInstance[]
}

export type GraphicKitPreset = 'full-kit' | 'compact-kit' | 'buttons-only' | 'instance-only'

export type SnackbarSeverity = 'info' | 'error' | 'warning' | 'success'

const INSTANCE_COLORS = ['#1976d2', '#2e7d32', '#9c27b0', '#ed6c02', '#0288d1', '#d32f2f', '#00796b', '#5c6bc0']

export function generateId(prefix: string = 'w'): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

interface HistorySnapshot {
	widgets: GridWidget[]
	graphicInstances: GraphicInstance[]
}

class GridStore {
	public tabs: GridTab[] = []
	public activeTabId: string = 'tab_default'
	public widgets: GridWidget[] = []
	public graphicInstances: GraphicInstance[] = []

	// Viewport state for active tab
	public panX: number = 40
	public panY: number = 40
	public zoom: number = 1

	// Mode & tool states
	public isEditMode: boolean = false
	public isTempEditMode: boolean = false
	public touchEditTool: 'select' | 'pan' = 'select'
	public sidebarTab: 'inspector' | 'instances' | 'palette' = 'inspector'

	// Selection state
	public selectedWidgetIds: string[] = []
	public primarySelectedWidgetId: string | null = null
	public activeInspectorInstanceId: string | null = null

	// Clipboard
	public clipboard: GridWidget[] | null = null
	public clipboardIsCut: boolean = false

	// Visual feedback
	public snackbarMessage: string | null = null
	public snackbarSeverity: SnackbarSeverity = 'info'
	public flashingWidgetIds = observable.map<string, number>()
	public openCustomGuis = observable.map<string, OpenCustomGuiDialog>(undefined, { deep: false })

	public isInitialized = false

	private undoStack: string[] = []
	private redoStack: string[] = []
	private isApplyingHistory = false
	private saveTimeout: number | undefined

	constructor() {
		makeObservable(this, {
			tabs: observable,
			activeTabId: observable,
			widgets: observable,
			graphicInstances: observable,
			panX: observable,
			panY: observable,
			zoom: observable,
			isEditMode: observable,
			isTempEditMode: observable,
			touchEditTool: observable,
			sidebarTab: observable,
			selectedWidgetIds: observable,
			primarySelectedWidgetId: observable,
			activeInspectorInstanceId: observable,
			clipboard: observable,
			clipboardIsCut: observable,
			snackbarMessage: observable,
			snackbarSeverity: observable,
			flashingWidgetIds: observable,
			openCustomGuis: observable.shallow,
			isInitialized: observable,

			effectiveEditMode: computed,
			activeTab: computed,
			selectedWidgets: computed,
			singleSelectedWidget: computed,
			activeInspectorInstance: computed,
			canUndo: computed,
			canRedo: computed,

			setEditMode: action,
			toggleEditMode: action,
			setTempEditMode: action,
			setTouchEditTool: action,
			setSidebarTab: action,
			setViewport: action,
			resetViewport: action,
			fitViewportToContent: action,

			setActiveTab: action,
			addTab: action,
			renameTab: action,
			removeTab: action,
			duplicateTab: action,

			addGraphicInstance: action,
			updateGraphicInstance: action,
			removeGraphicInstance: action,
			duplicateGraphicInstance: action,
			setActiveInspectorInstance: action,

			addWidget: action,
			updateWidget: action,
			updateMultipleWidgets: action,
			removeWidgets: action,
			removeSelectedWidgets: action,
			moveWidgetsByDelta: action,
			bringToFront: action,
			sendToBack: action,
			alignSelectedWidgets: action,

			selectWidget: action,
			setSelectedWidgets: action,
			selectAllWidgets: action,
			clearSelection: action,

			copySelection: action,
			cutSelection: action,
			paste: action,
			duplicateSelection: action,

			triggerWidgetFlash: action,
			showNotification: action,
			showError: action,
			setSnackbarMessage: action,
			openCustomGui: action,
			closeCustomGui: action,

			undo: action,
			redo: action,
			migratePreliminaryRenderer: action,
		})

		reaction(
			() => ({
				selectedWidgetIds: this.selectedWidgetIds.slice(),
				primarySelectedWidgetId: this.primarySelectedWidgetId,
				activeTabId: this.activeTabId,
			}),
			() => {
				if (this.isInitialized) {
					this.saveSelectionToLocalStorage()
				}
			}
		)

		queueMicrotask(() => {
			reaction(
				() => ({
					isInitialized: this.isInitialized,
					renderersCount: serverDataStore.renderersList.length,
					renderersInfoSize: serverDataStore.renderersInfo.size,
					selectedRendererId: appSettingsStore.getSelectedRendererId(),
				}),
				({ isInitialized, renderersCount, selectedRendererId }) => {
					if (
						isInitialized &&
						renderersCount > 0 &&
						selectedRendererId &&
						selectedRendererId !== PRELIMINARY_RENDERER_ID
					) {
						void this.migratePreliminaryRenderer(selectedRendererId)
					}
				}
			)
		})

		this.init().catch((e) => console.error('GridStore init failed', e))
	}

	private async init() {
		try {
			const storedState = await dbStore.getGridState<StoredGridState>()

			runInAction(() => {
				if (storedState && Array.isArray(storedState.tabs) && storedState.tabs.length > 0) {
					this.tabs = storedState.tabs
					this.graphicInstances = storedState.graphicInstances || []
				} else {
					this.tabs = [
						{
							id: 'tab_default',
							name: 'Surface 1',
							widgets: [],
							viewport: { panX: 40, panY: 40, zoom: 1 },
						},
					]
					this.graphicInstances = []
					this.isEditMode = true // Start in edit mode when empty so user can build right away
				}

				const savedActiveTabId = window.localStorage.getItem(getNameSpaceId() + 'controllerGrid_activeTabId')
				if (savedActiveTabId && this.tabs.some((t) => t.id === savedActiveTabId)) {
					this.activeTabId = savedActiveTabId
				} else {
					this.activeTabId = this.tabs[0].id
				}

				const active = this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0]
				this.widgets = active.widgets || []
				this.panX = active.viewport?.panX ?? 40
				this.panY = active.viewport?.panY ?? 40
				this.zoom = active.viewport?.zoom ?? 1

				if (this.widgets.length === 0 && this.graphicInstances.length === 0) {
					this.isEditMode = true
				}

				this.isInitialized = true
				this.restoreSelectionFromLocalStorage()
				void serverDataStore.refreshLoadedStatusForAllGraphics()
			})
		} catch (e) {
			console.error('Error loading grid state from IndexedDB', e)
		}
	}

	public get effectiveEditMode(): boolean {
		return this.isEditMode || this.isTempEditMode
	}

	public get activeTab(): GridTab | undefined {
		return this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0]
	}

	public get selectedWidgets(): GridWidget[] {
		const set = new Set(this.selectedWidgetIds)
		return this.widgets.filter((w) => set.has(w.id))
	}

	public get singleSelectedWidget(): GridWidget | null {
		if (this.selectedWidgetIds.length !== 1) return null
		return this.widgets.find((w) => w.id === this.selectedWidgetIds[0]) || null
	}

	public get activeInspectorInstance(): GraphicInstance | null {
		if (this.activeInspectorInstanceId) {
			const inst = this.graphicInstances.find((i) => i.id === this.activeInspectorInstanceId)
			if (inst) return inst
		}
		const single = this.singleSelectedWidget
		if (single?.instanceId) {
			return this.graphicInstances.find((i) => i.id === single.instanceId) || null
		}
		return null
	}

	public get canUndo(): boolean {
		return this.undoStack.length > 0
	}

	public get canRedo(): boolean {
		return this.redoStack.length > 0
	}

	public get defaultRendererId(): string {
		return appSettingsStore.getSelectedRendererId() || serverDataStore.renderersList[0]?.id || PRELIMINARY_RENDERER_ID
	}

	public getInstance(instanceId?: string): GraphicInstance | undefined {
		if (!instanceId) return undefined
		return this.graphicInstances.find((i) => i.id === instanceId)
	}

	public getTargetInstancesForWidget(widget: GridWidget): GraphicInstance[] {
		const ids: string[] = []
		if (widget.targetInstanceIds && widget.targetInstanceIds.length > 0) {
			ids.push(...widget.targetInstanceIds)
		} else if (widget.instanceId) {
			ids.push(widget.instanceId)
		}
		const uniqueIds = Array.from(new Set(ids))
		return uniqueIds.map((id) => this.getInstance(id)).filter(Boolean) as GraphicInstance[]
	}

	public isWidgetSelected(id: string): boolean {
		return this.selectedWidgetIds.includes(id)
	}

	public setEditMode(edit: boolean) {
		this.isEditMode = edit
	}

	public toggleEditMode() {
		this.isEditMode = !this.isEditMode
		this.showNotification(this.isEditMode ? 'Edit Mode enabled' : 'Live Mode enabled', 'info')
	}

	public setTempEditMode(active: boolean) {
		this.isTempEditMode = active
	}

	public setTouchEditTool(tool: 'select' | 'pan') {
		this.touchEditTool = tool
	}

	public setSidebarTab(tab: 'inspector' | 'instances' | 'palette') {
		this.sidebarTab = tab
	}

	public setActiveInspectorInstance(instanceId: string | null) {
		this.activeInspectorInstanceId = instanceId
		if (instanceId) {
			this.sidebarTab = 'instances'
		}
	}

	public setViewport(panX: number, panY: number, zoom?: number) {
		this.panX = Math.round(panX)
		this.panY = Math.round(panY)
		if (zoom !== undefined) {
			this.zoom = Math.max(0.25, Math.min(3, Math.round(zoom * 100) / 100))
		}
		const tab = this.activeTab
		if (tab) {
			tab.viewport = { panX: this.panX, panY: this.panY, zoom: this.zoom }
		}
		this.scheduleSave()
	}

	public resetViewport() {
		this.setViewport(40, 40, 1)
	}

	public fitViewportToContent(canvasWidth: number, canvasHeight: number) {
		if (this.widgets.length === 0) {
			this.resetViewport()
			return
		}
		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		for (const w of this.widgets) {
			minX = Math.min(minX, w.x * CELL_SIZE)
			minY = Math.min(minY, w.y * CELL_SIZE)
			maxX = Math.max(maxX, (w.x + w.w) * CELL_SIZE)
			maxY = Math.max(maxY, (w.y + w.h) * CELL_SIZE)
		}

		const contentW = Math.max(200, maxX - minX)
		const contentH = Math.max(200, maxY - minY)
		const padding = 60

		const scaleX = (canvasWidth - padding * 2) / contentW
		const scaleY = (canvasHeight - padding * 2) / contentH
		const newZoom = Math.max(0.25, Math.min(1.5, Math.min(scaleX, scaleY)))

		const newPanX = (canvasWidth - contentW * newZoom) / 2 - minX * newZoom
		const newPanY = (canvasHeight - contentH * newZoom) / 2 - minY * newZoom

		this.setViewport(newPanX, newPanY, newZoom)
	}

	// --------------------------------------------------------------------------
	// PERSISTENCE & HISTORY
	// --------------------------------------------------------------------------

	public scheduleSave() {
		if (this.saveTimeout !== undefined) {
			clearTimeout(this.saveTimeout)
		}
		this.saveTimeout = window.setTimeout(() => {
			void this.saveState()
		}, 150)
	}

	public async saveState() {
		try {
			const active = this.tabs.find((t) => t.id === this.activeTabId)
			if (active) {
				active.widgets = toJS(this.widgets)
				active.viewport = { panX: this.panX, panY: this.panY, zoom: this.zoom }
			}
			const state: StoredGridState = {
				tabs: toJS(this.tabs),
				graphicInstances: toJS(this.graphicInstances),
			}
			await dbStore.setGridState(state)
		} catch (e) {
			console.error('Failed to save grid state to IndexedDB', e)
		}
	}

	public pushHistory() {
		if (this.isApplyingHistory) return
		const snapshot: HistorySnapshot = {
			widgets: toJS(this.widgets),
			graphicInstances: toJS(this.graphicInstances),
		}
		this.undoStack.push(JSON.stringify(snapshot))
		if (this.undoStack.length > 50) this.undoStack.shift()
		this.redoStack = []
	}

	public undo() {
		if (this.undoStack.length === 0) return

		const current: HistorySnapshot = {
			widgets: toJS(this.widgets),
			graphicInstances: toJS(this.graphicInstances),
		}
		this.redoStack.push(JSON.stringify(current))

		const prevStr = this.undoStack.pop()
		if (prevStr) {
			this.isApplyingHistory = true
			try {
				const parsed = JSON.parse(prevStr) as HistorySnapshot
				this.widgets = parsed.widgets || []
				this.graphicInstances = parsed.graphicInstances || []
				void this.saveState()
				void serverDataStore.refreshLoadedStatusForAllGraphics()
				this.showNotification('Undo')
			} finally {
				this.isApplyingHistory = false
			}
		}
	}

	public redo() {
		if (this.redoStack.length === 0) return

		const current: HistorySnapshot = {
			widgets: toJS(this.widgets),
			graphicInstances: toJS(this.graphicInstances),
		}
		this.undoStack.push(JSON.stringify(current))

		const nextStr = this.redoStack.pop()
		if (nextStr) {
			this.isApplyingHistory = true
			try {
				const parsed = JSON.parse(nextStr) as HistorySnapshot
				this.widgets = parsed.widgets || []
				this.graphicInstances = parsed.graphicInstances || []
				void this.saveState()
				void serverDataStore.refreshLoadedStatusForAllGraphics()
				this.showNotification('Redo')
			} finally {
				this.isApplyingHistory = false
			}
		}
	}

	private saveSelectionToLocalStorage() {
		try {
			const key = getNameSpaceId() + 'controllerGrid_selection_' + this.activeTabId
			const data = {
				selectedWidgetIds: toJS(this.selectedWidgetIds),
				primarySelectedWidgetId: this.primarySelectedWidgetId,
			}
			window.localStorage.setItem(key, JSON.stringify(data))
		} catch (e) {
			console.error('Error saving selection to localStorage', e)
		}
	}

	private restoreSelectionFromLocalStorage() {
		try {
			const key = getNameSpaceId() + 'controllerGrid_selection_' + this.activeTabId
			const storedStr = window.localStorage.getItem(key)
			if (!storedStr) {
				this.selectedWidgetIds = []
				this.primarySelectedWidgetId = null
				return
			}
			const parsed = JSON.parse(storedStr)
			if (parsed && Array.isArray(parsed.selectedWidgetIds)) {
				const allIds = new Set(this.widgets.map((w) => w.id))
				const valid = parsed.selectedWidgetIds.filter((id: string) => allIds.has(id))
				this.selectedWidgetIds = valid
				this.primarySelectedWidgetId =
					parsed.primarySelectedWidgetId && allIds.has(parsed.primarySelectedWidgetId)
						? parsed.primarySelectedWidgetId
						: valid[0] || null
			}
		} catch (e) {
			console.error('Error restoring selection from localStorage', e)
		}
	}

	// --------------------------------------------------------------------------
	// TABS MANAGEMENT
	// --------------------------------------------------------------------------

	public setActiveTab(tabId: string) {
		if (this.activeTabId === tabId) return
		const targetTab = this.tabs.find((t) => t.id === tabId)
		if (!targetTab) return

		const currentTab = this.tabs.find((t) => t.id === this.activeTabId)
		if (currentTab) {
			currentTab.widgets = toJS(this.widgets)
			currentTab.viewport = { panX: this.panX, panY: this.panY, zoom: this.zoom }
		}

		this.activeTabId = tabId
		this.widgets = targetTab.widgets || []
		this.panX = targetTab.viewport?.panX ?? 40
		this.panY = targetTab.viewport?.panY ?? 40
		this.zoom = targetTab.viewport?.zoom ?? 1
		this.selectedWidgetIds = []
		this.primarySelectedWidgetId = null
		this.undoStack = []
		this.redoStack = []

		try {
			window.localStorage.setItem(getNameSpaceId() + 'controllerGrid_activeTabId', tabId)
		} catch (e) {
			console.error(e)
		}

		this.restoreSelectionFromLocalStorage()
	}

	public addTab(name?: string): string {
		const newId = generateId('tab')
		const tabCount = this.tabs.length + 1
		const tabName = name?.trim() || `Surface ${tabCount}`

		const currentTab = this.tabs.find((t) => t.id === this.activeTabId)
		if (currentTab) {
			currentTab.widgets = toJS(this.widgets)
			currentTab.viewport = { panX: this.panX, panY: this.panY, zoom: this.zoom }
		}

		const newTab: GridTab = {
			id: newId,
			name: tabName,
			widgets: [],
			viewport: { panX: 40, panY: 40, zoom: 1 },
		}

		this.tabs.push(newTab)
		this.setActiveTab(newId)
		void this.saveState()
		this.showNotification(`Created surface "${tabName}"`)
		return newId
	}

	public renameTab(tabId: string, name: string) {
		const tab = this.tabs.find((t) => t.id === tabId)
		if (!tab) return
		const trimmed = name.trim()
		if (!trimmed) return
		tab.name = trimmed
		void this.saveState()
		this.showNotification(`Renamed surface to "${trimmed}"`)
	}

	public removeTab(tabId: string) {
		const tabIndex = this.tabs.findIndex((t) => t.id === tabId)
		if (tabIndex === -1) return
		const removedTab = this.tabs[tabIndex]

		this.tabs.splice(tabIndex, 1)

		if (this.tabs.length === 0) {
			const defaultTab: GridTab = {
				id: generateId('tab'),
				name: 'Surface 1',
				widgets: [],
				viewport: { panX: 40, panY: 40, zoom: 1 },
			}
			this.tabs.push(defaultTab)
			this.activeTabId = defaultTab.id
			this.widgets = []
			this.panX = 40
			this.panY = 40
			this.zoom = 1
		} else if (this.activeTabId === tabId) {
			const nextIndex = Math.min(tabIndex, this.tabs.length - 1)
			const nextTab = this.tabs[nextIndex]
			this.activeTabId = nextTab.id
			this.widgets = nextTab.widgets || []
			this.panX = nextTab.viewport?.panX ?? 40
			this.panY = nextTab.viewport?.panY ?? 40
			this.zoom = nextTab.viewport?.zoom ?? 1
		}

		this.selectedWidgetIds = []
		this.primarySelectedWidgetId = null
		void this.saveState()
		this.showNotification(`Removed surface "${removedTab.name}"`)
	}

	public duplicateTab(tabId: string) {
		const tab = this.tabs.find((t) => t.id === tabId)
		if (!tab) return

		if (this.activeTabId === tabId) {
			tab.widgets = toJS(this.widgets)
			tab.viewport = { panX: this.panX, panY: this.panY, zoom: this.zoom }
		}

		const newId = generateId('tab')
		const clonedWidgets = (tab.widgets || []).map((w) => ({
			...clone(w),
			id: generateId('w'),
		}))

		const newTab: GridTab = {
			id: newId,
			name: `${tab.name} (Copy)`,
			widgets: clonedWidgets,
			viewport: clone(tab.viewport) || { panX: 40, panY: 40, zoom: 1 },
		}

		const index = this.tabs.findIndex((t) => t.id === tabId)
		if (index !== -1) {
			this.tabs.splice(index + 1, 0, newTab)
		} else {
			this.tabs.push(newTab)
		}

		this.setActiveTab(newId)
		void this.saveState()
		this.showNotification(`Duplicated surface "${tab.name}"`)
	}

	// --------------------------------------------------------------------------
	// GRAPHIC INSTANCES CRUD
	// --------------------------------------------------------------------------

	public async createGraphicInstance(graphicId: string, customName?: string): Promise<GraphicInstance> {
		this.pushHistory()

		const existingSameGraphic = this.graphicInstances.filter((i) => i.graphicId === graphicId)
		let existingRendererId: string | undefined
		let existingRenderTarget: unknown | undefined

		if (existingSameGraphic.length > 0) {
			const latest = existingSameGraphic[existingSameGraphic.length - 1]
			existingRendererId = latest.rendererId
			existingRenderTarget = clone(latest.renderTarget)
		}

		const rId = existingRendererId || appSettingsStore.getSelectedRendererId() || this.defaultRendererId

		let renderer = rId !== PRELIMINARY_RENDERER_ID ? serverDataStore.renderersInfo.get(rId) : undefined
		if (!renderer && rId !== PRELIMINARY_RENDERER_ID) {
			renderer = await serverDataStore.loadRenderer(rId)
		}

		const renderTarget =
			existingRenderTarget !== undefined
				? existingRenderTarget
				: renderer?.renderTargetSchema
					? getDefaultDataFromSchema(renderer.renderTargetSchema)
					: undefined

		let graphicInfo = serverDataStore.graphicsInfo.get(graphicId)
		if (!graphicInfo) {
			graphicInfo = await serverDataStore.loadGraphic(graphicId)
		}
		const graphicData = graphicInfo?.graphic.schema ? getDefaultDataFromSchema(graphicInfo.graphic.schema) : undefined
		const baseName = graphicInfo?.graphic.name || graphicId
		const instanceNumber = existingSameGraphic.length + 1
		const name = customName || (instanceNumber > 1 ? `${baseName} #${instanceNumber}` : baseName)
		const color = INSTANCE_COLORS[this.graphicInstances.length % INSTANCE_COLORS.length]

		const customActionData: { [actionId: string]: unknown } = {}
		const customActions = (graphicInfo?.graphic as any)?.customActions || (graphicInfo?.graphic as any)?.actions || []
		if (Array.isArray(customActions)) {
			for (const ca of customActions) {
				if (ca.id && ca.schema) {
					customActionData[ca.id] = getDefaultDataFromSchema(ca.schema)
				}
			}
		}

		const newInstance: GraphicInstance = {
			id: generateId('inst'),
			name,
			graphicId,
			rendererId: rId,
			graphicData: clone(graphicData),
			customActionData,
			renderTarget: clone(renderTarget),
			color,
			updatedAt: Date.now(),
		}

		runInAction(() => {
			this.addGraphicInstance(newInstance)
		})

		return newInstance
	}

	public addGraphicInstance(instance: GraphicInstance) {
		this.graphicInstances.push(instance)
		this.activeInspectorInstanceId = instance.id
		void this.saveState()
	}

	public updateGraphicInstance(
		instanceId: string,
		partial: Partial<Omit<GraphicInstance, 'id'>>,
		recordHistory: boolean = false
	) {
		const inst = this.graphicInstances.find((i) => i.id === instanceId)
		if (!inst) return
		if (recordHistory) this.pushHistory()

		if (partial.name !== undefined) inst.name = partial.name
		if (partial.graphicId !== undefined) inst.graphicId = partial.graphicId
		if (partial.rendererId !== undefined) inst.rendererId = partial.rendererId
		if ('graphicData' in partial) inst.graphicData = clone(partial.graphicData)
		if ('customActionData' in partial && partial.customActionData) {
			inst.customActionData = clone(partial.customActionData)
		}
		if ('renderTarget' in partial) inst.renderTarget = clone(partial.renderTarget)
		if ('graphicInstanceId' in partial) inst.graphicInstanceId = partial.graphicInstanceId
		if (partial.color !== undefined) inst.color = partial.color
		inst.updatedAt = Date.now()

		this.scheduleSave()
	}

	public duplicateGraphicInstance(instanceId: string): GraphicInstance | undefined {
		const inst = this.graphicInstances.find((i) => i.id === instanceId)
		if (!inst) return undefined
		this.pushHistory()

		const cloned: GraphicInstance = {
			...clone(inst),
			id: generateId('inst'),
			name: `${inst.name} (Copy)`,
			graphicInstanceId: undefined,
			updatedAt: Date.now(),
		}
		this.graphicInstances.push(cloned)
		this.activeInspectorInstanceId = cloned.id
		void this.saveState()
		this.showNotification(`Duplicated instance "${inst.name}"`)
		return cloned
	}

	public removeGraphicInstance(instanceId: string, removeLinkedWidgets: boolean = false) {
		const idx = this.graphicInstances.findIndex((i) => i.id === instanceId)
		if (idx === -1) return
		this.pushHistory()

		const removed = this.graphicInstances[idx]
		this.graphicInstances.splice(idx, 1)

		if (removeLinkedWidgets) {
			this.widgets = this.widgets.filter((w) => w.instanceId !== instanceId)
			for (const tab of this.tabs) {
				tab.widgets = (tab.widgets || []).filter((w) => w.instanceId !== instanceId)
			}
		}

		if (this.activeInspectorInstanceId === instanceId) {
			this.activeInspectorInstanceId = this.graphicInstances[0]?.id || null
		}

		void this.saveState()
		this.showNotification(`Removed instance "${removed.name}"`)
	}

	public async migratePreliminaryRenderer(newRendererId: string) {
		if (!newRendererId || newRendererId === PRELIMINARY_RENDERER_ID) return
		const itemsToMigrate = this.graphicInstances.filter((i) => i.rendererId === PRELIMINARY_RENDERER_ID)
		if (itemsToMigrate.length === 0) return

		let renderer = serverDataStore.renderersInfo.get(newRendererId)
		if (!renderer) {
			renderer = await serverDataStore.loadRenderer(newRendererId)
		}
		const defaultTarget = renderer?.renderTargetSchema
			? getDefaultDataFromSchema(renderer.renderTargetSchema)
			: undefined

		runInAction(() => {
			for (const inst of this.graphicInstances) {
				if (inst.rendererId === PRELIMINARY_RENDERER_ID) {
					inst.rendererId = newRendererId
					if (inst.renderTarget === undefined && defaultTarget !== undefined) {
						inst.renderTarget = clone(defaultTarget)
					}
				}
			}
		})
		void this.saveState()
	}

	// --------------------------------------------------------------------------
	// ADD GRAPHIC BUNDLE / STARTER KIT ONTO THE GRID
	// --------------------------------------------------------------------------

	public findNextFreeOrigin(): { x: number; y: number } {
		if (this.widgets.length === 0) {
			return { x: 2, y: 2 }
		}
		let maxY = 2
		let minX = Infinity
		for (const w of this.widgets) {
			maxY = Math.max(maxY, w.y + w.h + 2)
			minX = Math.min(minX, w.x)
		}
		return { x: Number.isFinite(minX) ? Math.max(2, minX) : 2, y: maxY }
	}

	public async addGraphicWithKit(
		graphicId: string,
		kitPreset: GraphicKitPreset = 'full-kit',
		customPosition?: { x: number; y: number }
	): Promise<GraphicInstance> {
		const instance = await this.createGraphicInstance(graphicId)
		if (kitPreset === 'instance-only') {
			return instance
		}

		const graphicInfo = serverDataStore.graphicsInfo.get(graphicId)
		const manifest = graphicInfo?.graphic
		const hasSchema = Boolean(manifest?.schema && Object.keys((manifest.schema as any).properties || {}).length > 0)
		const customActions: any[] = (manifest as any)?.customActions || (manifest as any)?.actions || []

		const pos = customPosition || this.findNextFreeOrigin()
		const startX = pos.x
		const startY = pos.y

		const createdWidgets: GridWidget[] = []
		const baseZ = this.getMaxZIndex() + 1

		if (kitPreset === 'full-kit') {
			const formW = hasSchema ? 30 : 0
			const buttonsX = startX + (hasSchema ? formW + 2 : 2)
			const buttonW = 11
			const buttonH = 5

			// Action buttons column/grid
			const quickPlayBtn: GridWidget = {
				id: generateId('w'),
				type: 'action-button',
				actionType: 'quickPlay',
				instanceId: instance.id,
				label: 'Quick Play',
				color: '#1976d2',
				icon: 'flash',
				x: buttonsX,
				y: startY + 4,
				w: buttonW * 2 + 1,
				h: buttonH,
				zIndex: baseZ + 2,
			}
			const playBtn: GridWidget = {
				id: generateId('w'),
				type: 'action-button',
				actionType: 'play',
				instanceId: instance.id,
				label: 'Play',
				color: '#2e7d32',
				icon: 'play',
				x: buttonsX,
				y: startY + 10,
				w: buttonW,
				h: buttonH,
				zIndex: baseZ + 3,
			}
			const stopBtn: GridWidget = {
				id: generateId('w'),
				type: 'action-button',
				actionType: 'stop',
				instanceId: instance.id,
				label: 'Stop',
				color: '#d32f2f',
				icon: 'stop',
				x: buttonsX + buttonW + 1,
				y: startY + 10,
				w: buttonW,
				h: buttonH,
				zIndex: baseZ + 4,
			}
			const loadBtn: GridWidget = {
				id: generateId('w'),
				type: 'action-button',
				actionType: 'load',
				instanceId: instance.id,
				label: 'Load',
				color: '#455a64',
				icon: 'load',
				x: buttonsX,
				y: startY + 16,
				w: buttonW,
				h: buttonH,
				zIndex: baseZ + 5,
			}
			const updateBtn: GridWidget = {
				id: generateId('w'),
				type: 'action-button',
				actionType: 'update',
				instanceId: instance.id,
				label: 'Update',
				color: '#9c27b0',
				icon: 'update',
				x: buttonsX + buttonW + 1,
				y: startY + 16,
				w: buttonW,
				h: buttonH,
				zIndex: baseZ + 6,
			}

			createdWidgets.push(quickPlayBtn, playBtn, stopBtn, loadBtn, updateBtn)

			let currentBtnY = startY + 22
			for (const ca of customActions) {
				if (!ca?.id) continue
				createdWidgets.push({
					id: generateId('w'),
					type: 'custom-action-button',
					customActionId: ca.id,
					instanceId: instance.id,
					label: ca.name || ca.id,
					color: '#0288d1',
					icon: 'bolt',
					x: buttonsX,
					y: currentBtnY,
					w: buttonW * 2 + 1,
					h: 4,
					zIndex: baseZ + 7 + createdWidgets.length,
				})
				currentBtnY += 5
			}

			const innerHeight = Math.max(20, currentBtnY - startY)

			if (hasSchema) {
				const formWidget: GridWidget = {
					id: generateId('w'),
					type: 'data-form',
					instanceId: instance.id,
					label: `${instance.name} — Data`,
					hiddenProperties: [],
					autoUpdate: false,
					compact: false,
					hideHeader: false,
					hideFieldLabels: false,
					x: startX + 1,
					y: startY + 4,
					w: formW,
					h: Math.max(17, innerHeight - 4),
					zIndex: baseZ + 1,
				}
				createdWidgets.push(formWidget)
			}

			const totalW = (hasSchema ? formW + 2 : 2) + buttonW * 2 + 3
			const totalH = Math.max(22, innerHeight + 1)

			// Add Section Frame behind all widgets in the kit
			const sectionFrame: GridWidget = {
				id: generateId('w'),
				type: 'section-frame',
				instanceId: instance.id,
				label: instance.name,
				color: instance.color || '#1976d2',
				x: startX,
				y: startY,
				w: totalW,
				h: totalH,
				zIndex: this.getMinZIndex() - 1,
			}
			createdWidgets.unshift(sectionFrame)
		} else if (kitPreset === 'compact-kit') {
			const formW = hasSchema ? 26 : 0
			if (hasSchema) {
				createdWidgets.push({
					id: generateId('w'),
					type: 'data-form',
					instanceId: instance.id,
					label: instance.name,
					hiddenProperties: [],
					compact: true,
					hideHeader: false,
					x: startX,
					y: startY,
					w: formW,
					h: 12,
					zIndex: baseZ + 1,
				})
			}
			const btnX = startX + (hasSchema ? formW + 1 : 0)
			createdWidgets.push(
				{
					id: generateId('w'),
					type: 'action-button',
					actionType: 'quickPlay',
					instanceId: instance.id,
					label: `Play ${instance.name}`,
					color: '#2e7d32',
					icon: 'play',
					x: btnX,
					y: startY,
					w: 14,
					h: 6,
					zIndex: baseZ + 2,
				},
				{
					id: generateId('w'),
					type: 'action-button',
					actionType: 'stop',
					instanceId: instance.id,
					label: `Stop ${instance.name}`,
					color: '#d32f2f',
					icon: 'stop',
					x: btnX,
					y: startY + 6,
					w: 14,
					h: 6,
					zIndex: baseZ + 3,
				}
			)
		} else if (kitPreset === 'buttons-only') {
			createdWidgets.push(
				{
					id: generateId('w'),
					type: 'action-button',
					actionType: 'quickPlay',
					instanceId: instance.id,
					label: `${instance.name} — Quick Play`,
					color: '#1976d2',
					icon: 'flash',
					x: startX,
					y: startY,
					w: 16,
					h: 6,
					zIndex: baseZ + 1,
				},
				{
					id: generateId('w'),
					type: 'action-button',
					actionType: 'play',
					instanceId: instance.id,
					label: `${instance.name} — Play`,
					color: '#2e7d32',
					icon: 'play',
					x: startX + 17,
					y: startY,
					w: 12,
					h: 6,
					zIndex: baseZ + 2,
				},
				{
					id: generateId('w'),
					type: 'action-button',
					actionType: 'stop',
					instanceId: instance.id,
					label: `${instance.name} — Stop`,
					color: '#d32f2f',
					icon: 'stop',
					x: startX + 30,
					y: startY,
					w: 12,
					h: 6,
					zIndex: baseZ + 3,
				}
			)
		}

		runInAction(() => {
			this.widgets.push(...createdWidgets)
			this.selectedWidgetIds = createdWidgets.map((w) => w.id)
			this.primarySelectedWidgetId = createdWidgets[0]?.id || null
			void this.saveState()
		})

		return instance
	}

	// --------------------------------------------------------------------------
	// WIDGET CRUD & MANIPULATION
	// --------------------------------------------------------------------------

	public getMaxZIndex(): number {
		if (this.widgets.length === 0) return 1
		return Math.max(1, ...this.widgets.map((w) => w.zIndex || 1))
	}

	public getMinZIndex(): number {
		if (this.widgets.length === 0) return 0
		return Math.min(0, ...this.widgets.map((w) => w.zIndex || 0))
	}

	public addWidget(partial: Partial<GridWidget> & { type: GridWidgetType }): GridWidget {
		this.pushHistory()

		const defaultSizes: Record<GridWidgetType, { w: number; h: number }> = {
			'action-button': { w: 12, h: 5 },
			'custom-action-button': { w: 14, h: 5 },
			'data-form': { w: 28, h: 16 },
			'custom-action-form': { w: 26, h: 14 },
			'target-config': { w: 26, h: 12 },
			'custom-gui': { w: 36, h: 24 },
			'status-badge': { w: 20, h: 5 },
			'section-frame': { w: 34, h: 20 },
		}

		const size = defaultSizes[partial.type] || { w: 12, h: 6 }
		const pos =
			partial.x !== undefined && partial.y !== undefined ? { x: partial.x, y: partial.y } : this.findNextFreeOrigin()

		const isFrame = partial.type === 'section-frame'
		const zIndex = partial.zIndex ?? (isFrame ? this.getMinZIndex() - 1 : this.getMaxZIndex() + 1)

		const defaultInstanceId =
			partial.instanceId ??
			this.activeInspectorInstance?.id ??
			this.singleSelectedWidget?.instanceId ??
			this.graphicInstances[0]?.id

		const inst = this.getInstance(defaultInstanceId)

		let defaultLabel = partial.label
		if (!defaultLabel) {
			if (partial.type === 'action-button') {
				const act = partial.actionType || 'quickPlay'
				const labels: Record<StandardActionType, string> = {
					quickPlay: 'Quick Play',
					load: 'Load',
					play: 'Play',
					update: 'Update',
					stop: 'Stop',
					clearTarget: 'Clear Target',
					clearRenderer: 'Clear Renderer',
					clearAll: 'CLEAR ALL',
				}
				defaultLabel = labels[act]
			} else if (partial.type === 'custom-action-button') {
				defaultLabel = partial.customActionId || 'Custom Action'
			} else if (partial.type === 'data-form') {
				defaultLabel = inst ? `${inst.name} — Data` : 'Graphic Data Form'
			} else if (partial.type === 'custom-action-form') {
				defaultLabel = inst ? `${inst.name} — Custom Action` : 'Custom Action Form'
			} else if (partial.type === 'target-config') {
				defaultLabel = inst ? `${inst.name} — Target` : 'Render Target'
			} else if (partial.type === 'custom-gui') {
				defaultLabel = inst ? `${inst.name} — Custom GUI` : 'Custom GUI'
			} else if (partial.type === 'status-badge') {
				defaultLabel = inst ? inst.name : 'Graphic Status'
			} else if (partial.type === 'section-frame') {
				defaultLabel = inst ? inst.name : 'Section'
			}
		}

		const widget: GridWidget = {
			id: generateId('w'),
			type: partial.type,
			x: Math.round(pos.x),
			y: Math.round(pos.y),
			w: Math.max(3, Math.round(partial.w ?? size.w)),
			h: Math.max(2, Math.round(partial.h ?? size.h)),
			zIndex,
			label: defaultLabel,
			color: partial.color,
			textSize: partial.textSize || 'medium',
			icon: partial.icon,
			hotkey: partial.hotkey,
			instanceId: partial.type === 'section-frame' ? partial.instanceId : defaultInstanceId,
			targetInstanceIds: partial.targetInstanceIds,
			actionType: partial.actionType || (partial.type === 'action-button' ? 'quickPlay' : undefined),
			customActionId: partial.customActionId,
			usePresetData: partial.usePresetData ?? false,
			presetData: partial.presetData,
			hiddenProperties: partial.hiddenProperties || [],
			autoUpdate: partial.autoUpdate ?? false,
			compact: partial.compact ?? false,
			hideHeader: partial.hideHeader ?? false,
			hideFieldLabels: partial.hideFieldLabels ?? false,
			showTriggerButton: partial.showTriggerButton ?? true,
			showRendererSelector: partial.showRendererSelector ?? true,
			customGuiId: partial.customGuiId,
			customGuiDisplayMode: partial.customGuiDisplayMode || 'embedded',
		}

		this.widgets.push(widget)
		this.selectWidget(widget.id, false)
		this.sidebarTab = 'inspector'
		void this.saveState()
		return widget
	}

	public updateWidget(widgetId: string, partial: Partial<Omit<GridWidget, 'id'>>, recordHistory: boolean = false) {
		const widget = this.widgets.find((w) => w.id === widgetId)
		if (!widget) return
		if (recordHistory) this.pushHistory()

		Object.assign(widget, partial)
		this.scheduleSave()
	}

	public updateMultipleWidgets(
		widgetIds: string[],
		partial: Partial<Omit<GridWidget, 'id'>>,
		recordHistory: boolean = true
	) {
		if (widgetIds.length === 0) return
		if (recordHistory) this.pushHistory()

		const set = new Set(widgetIds)
		for (const w of this.widgets) {
			if (set.has(w.id)) {
				Object.assign(w, clone(partial))
			}
		}
		this.scheduleSave()
	}

	public moveWidgetsByDelta(widgetIds: string[], dxCells: number, dyCells: number, recordHistory: boolean = false) {
		if (dxCells === 0 && dyCells === 0) return
		if (recordHistory) this.pushHistory()

		const set = new Set(widgetIds)
		for (const w of this.widgets) {
			if (set.has(w.id)) {
				w.x = Math.round(w.x + dxCells)
				w.y = Math.round(w.y + dyCells)
			}
		}
		this.scheduleSave()
	}

	public removeWidgets(widgetIds: string[]) {
		if (widgetIds.length === 0) return
		this.pushHistory()

		const set = new Set(widgetIds)
		this.widgets = this.widgets.filter((w) => !set.has(w.id))
		this.selectedWidgetIds = this.selectedWidgetIds.filter((id) => !set.has(id))
		if (this.primarySelectedWidgetId && set.has(this.primarySelectedWidgetId)) {
			this.primarySelectedWidgetId = this.selectedWidgetIds[0] || null
		}
		void this.saveState()
	}

	public removeSelectedWidgets() {
		if (this.selectedWidgetIds.length === 0) return
		const count = this.selectedWidgetIds.length
		this.removeWidgets(this.selectedWidgetIds)
		this.showNotification(`Deleted ${count} widget${count > 1 ? 's' : ''}`)
	}

	public bringToFront(widgetIds: string[] = this.selectedWidgetIds) {
		if (widgetIds.length === 0) return
		this.pushHistory()
		let maxZ = this.getMaxZIndex()
		const set = new Set(widgetIds)
		for (const w of this.widgets) {
			if (set.has(w.id)) {
				w.zIndex = ++maxZ
			}
		}
		void this.saveState()
	}

	public sendToBack(widgetIds: string[] = this.selectedWidgetIds) {
		if (widgetIds.length === 0) return
		this.pushHistory()
		let minZ = this.getMinZIndex()
		const set = new Set(widgetIds)
		for (const w of this.widgets) {
			if (set.has(w.id)) {
				w.zIndex = --minZ
			}
		}
		void this.saveState()
	}

	public alignSelectedWidgets(mode: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') {
		const selected = this.selectedWidgets
		if (selected.length < 2) return
		this.pushHistory()

		const minX = Math.min(...selected.map((w) => w.x))
		const maxX = Math.max(...selected.map((w) => w.x + w.w))
		const minY = Math.min(...selected.map((w) => w.y))
		const maxY = Math.max(...selected.map((w) => w.y + w.h))

		for (const w of selected) {
			if (mode === 'left') w.x = minX
			else if (mode === 'right') w.x = maxX - w.w
			else if (mode === 'top') w.y = minY
			else if (mode === 'bottom') w.y = maxY - w.h
			else if (mode === 'center-h') w.x = Math.round((minX + maxX - w.w) / 2)
			else if (mode === 'center-v') w.y = Math.round((minY + maxY - w.h) / 2)
		}
		void this.saveState()
	}

	// --------------------------------------------------------------------------
	// SELECTION
	// --------------------------------------------------------------------------

	public selectWidget(widgetId: string, additive: boolean = false) {
		if (additive) {
			const idx = this.selectedWidgetIds.indexOf(widgetId)
			if (idx >= 0) {
				this.selectedWidgetIds.splice(idx, 1)
				if (this.primarySelectedWidgetId === widgetId) {
					this.primarySelectedWidgetId = this.selectedWidgetIds[0] || null
				}
			} else {
				this.selectedWidgetIds.push(widgetId)
				this.primarySelectedWidgetId = widgetId
			}
		} else {
			this.selectedWidgetIds = [widgetId]
			this.primarySelectedWidgetId = widgetId
		}
		this.activeInspectorInstanceId = null
	}

	public setSelectedWidgets(widgetIds: string[], additive: boolean = false) {
		if (additive) {
			const combined = new Set([...this.selectedWidgetIds, ...widgetIds])
			this.selectedWidgetIds = Array.from(combined)
		} else {
			this.selectedWidgetIds = Array.from(new Set(widgetIds))
		}
		this.primarySelectedWidgetId = this.selectedWidgetIds[this.selectedWidgetIds.length - 1] || null
		this.activeInspectorInstanceId = null
	}

	public selectAllWidgets() {
		this.selectedWidgetIds = this.widgets.map((w) => w.id)
		this.primarySelectedWidgetId = this.selectedWidgetIds[0] || null
	}

	public clearSelection() {
		this.selectedWidgetIds = []
		this.primarySelectedWidgetId = null
	}

	// --------------------------------------------------------------------------
	// COPY / CUT / PASTE / DUPLICATE (WITH NEW INSTANCE OPTION)
	// --------------------------------------------------------------------------

	public copySelection() {
		if (this.selectedWidgets.length === 0) return
		this.clipboard = clone(this.selectedWidgets)
		this.clipboardIsCut = false
		this.showNotification(`Copied ${this.clipboard.length} widget${this.clipboard.length > 1 ? 's' : ''}`)
	}

	public cutSelection() {
		if (this.selectedWidgets.length === 0) return
		this.clipboard = clone(this.selectedWidgets)
		this.clipboardIsCut = true
		this.removeWidgets(this.selectedWidgetIds)
		this.showNotification(`Cut ${this.clipboard.length} widget${this.clipboard.length > 1 ? 's' : ''}`)
	}

	public paste(options?: { cloneInstances?: boolean; targetCell?: { x: number; y: number } }) {
		if (!this.clipboard || this.clipboard.length === 0) return
		this.pushHistory()

		const cloneInstances = options?.cloneInstances ?? false
		const instanceMap = new Map<string, string>()

		if (cloneInstances) {
			for (const w of this.clipboard) {
				const idsToClone = [w.instanceId, ...(w.targetInstanceIds || [])].filter(Boolean) as string[]
				for (const oldInstId of idsToClone) {
					if (!instanceMap.has(oldInstId)) {
						const origInst = this.getInstance(oldInstId)
						if (origInst) {
							const sameGraphicCount = this.graphicInstances.filter((i) => i.graphicId === origInst.graphicId).length
							const baseName = origInst.name.replace(/\s+#\d+$/, '')
							const newInst: GraphicInstance = {
								...clone(origInst),
								id: generateId('inst'),
								name: `${baseName} #${sameGraphicCount + 1}`,
								graphicInstanceId: undefined,
								color: INSTANCE_COLORS[this.graphicInstances.length % INSTANCE_COLORS.length],
								updatedAt: Date.now(),
							}
							this.graphicInstances.push(newInst)
							instanceMap.set(oldInstId, newInst.id)
						}
					}
				}
			}
		}

		const minX = Math.min(...this.clipboard.map((w) => w.x))
		const minY = Math.min(...this.clipboard.map((w) => w.y))

		const offsetX = options?.targetCell ? options.targetCell.x - minX : this.clipboardIsCut ? 0 : 2
		const offsetY = options?.targetCell ? options.targetCell.y - minY : this.clipboardIsCut ? 0 : 2

		let maxZ = this.getMaxZIndex()
		const newWidgets: GridWidget[] = []

		for (const item of this.clipboard) {
			const cloned = clone(item)
			cloned.id = generateId('w')
			cloned.x = Math.round(item.x + offsetX)
			cloned.y = Math.round(item.y + offsetY)
			if (cloned.type !== 'section-frame') {
				cloned.zIndex = ++maxZ
			}
			if (cloneInstances) {
				if (cloned.instanceId) {
					const newInstId = instanceMap.get(cloned.instanceId)
					if (newInstId) {
						const oldInst = this.getInstance(cloned.instanceId)
						const newInst = this.getInstance(newInstId)
						cloned.instanceId = newInstId
						if (cloned.label && oldInst && newInst && cloned.label.includes(oldInst.name)) {
							cloned.label = cloned.label.replace(oldInst.name, newInst.name)
						}
					}
				}
				if (cloned.targetInstanceIds) {
					cloned.targetInstanceIds = cloned.targetInstanceIds.map((id) => instanceMap.get(id) || id)
				}
			}
			newWidgets.push(cloned)
		}

		this.widgets.push(...newWidgets)
		this.selectedWidgetIds = newWidgets.map((w) => w.id)
		this.primarySelectedWidgetId = newWidgets[0]?.id || null

		// Update clipboard offset so repeated Ctrl+V cascades neatly
		if (!options?.targetCell) {
			this.clipboard = clone(newWidgets)
			this.clipboardIsCut = false
		}

		void this.saveState()
		this.showNotification(
			cloneInstances
				? `Pasted ${newWidgets.length} widget(s) with new Graphic Instance`
				: `Pasted ${newWidgets.length} widget(s)`
		)
	}

	public duplicateSelection(options?: { cloneInstances?: boolean; offset?: { x: number; y: number } }): GridWidget[] {
		if (this.selectedWidgets.length === 0) return []
		const savedClipboard = this.clipboard
		const savedIsCut = this.clipboardIsCut

		this.clipboard = clone(this.selectedWidgets)
		this.clipboardIsCut = false

		const minX = Math.min(...this.clipboard.map((w) => w.x))
		const minY = Math.min(...this.clipboard.map((w) => w.y))
		const dx = options?.offset?.x ?? 2
		const dy = options?.offset?.y ?? 2

		this.paste({
			cloneInstances: options?.cloneInstances ?? false,
			targetCell: { x: minX + dx, y: minY + dy },
		})

		this.clipboard = savedClipboard
		this.clipboardIsCut = savedIsCut
		return this.selectedWidgets
	}

	// --------------------------------------------------------------------------
	// FEEDBACK & CUSTOM GUI DIALOGS
	// --------------------------------------------------------------------------

	public triggerWidgetFlash(widgetId: string) {
		this.flashingWidgetIds.set(widgetId, Date.now())
		setTimeout(() => {
			runInAction(() => {
				this.flashingWidgetIds.delete(widgetId)
			})
		}, 350)
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

	public openCustomGui(instanceId: string, gui: UserInterfaceComponentInfo) {
		const inst = this.getInstance(instanceId)
		if (!inst) return

		registerCustomGuiComponent(inst.graphicId, gui.id, gui.componentClass)

		const dialogId = `${instanceId}::${gui.id}`
		this.openCustomGuis.set(dialogId, {
			id: dialogId,
			instanceId,
			componentId: gui.id,
			graphicId: inst.graphicId,
			name: gui.name || gui.id,
			description: gui.description,
			componentClass: gui.componentClass,
		})
	}

	public closeCustomGui(dialogId: string) {
		this.openCustomGuis.delete(dialogId)
	}
}

export const gridStore = new GridStore()
