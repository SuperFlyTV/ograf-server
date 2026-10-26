import { action, computed, makeObservable, observable, runInAction } from 'mobx'
import { getDefaultDataFromSchema } from 'ograf-form'
import { appSettingsStore, PRELIMINARY_RENDERER_ID } from './appSettings.js'
import { serverDataStore } from './serverData.js'
import { dbStore } from './db.js'
import { clone, isEqual } from '../lib/lib.js'

export const FADE_DURATION_MS = 3000
export const NEW_HIGHLIGHT_DURATION_MS = 5000
export const POST_STOP_HOLD_MS = 3500
export const AI_ACTION_HIGHLIGHT_MS = 1200
export const HUMAN_OVERRIDE_RETENTION_MS = 45000
export const SLOT_HEIGHT_PX = 128

export type StandardExposedAction = 'play' | 'update' | 'pause' | 'data-entry'

export interface ExposedCustomAction {
	id: string
	withForm?: boolean
	payload?: unknown
}

export interface HumanOverrideRecord {
	itemId: string
	graphicId: string
	graphicData: unknown
	action: 'stop' | 'clear' | 'dismiss'
	timestamp: number
}

export interface ActionCardItem {
	id: string
	graphicId: string
	rendererId: string
	renderTarget: unknown
	graphicData: unknown
	customActionData: Record<string, unknown>
	graphicInstanceId?: string
	isPlaying?: boolean
	playingSince?: number | null
	lastActionAt?: number | null
	lastActionBy?: 'ai' | 'user' | null
	lastActionType?: string | null
	aiPressedAction?: {
		actionId: string
		remainingMs: number
	} | null
	stopHoldRemainingMs?: number

	exposedActions: StandardExposedAction[]
	exposedCustomActions: ExposedCustomAction[]
	reason?: string

	// TTL & Fade-out state (used for AI suggestions)
	ttlSeconds: number
	remainingMs: number
	status: 'active' | 'fading'
	fadeRemainingMs: number
	highlightRemainingMs: number
	isHovered: boolean
	isPopoverOpen: boolean
	createdAt: number
}

export interface NotificationMessage {
	id: string
	message: string
	severity: 'error' | 'warning' | 'info' | 'success'
}

let idCounter = 0
function nextId(prefix = 'sug'): string {
	return `${prefix}_${Date.now()}_${++idCounter}`
}

class AiAudioStore {
	/**
	 * Fixed-height slots for AI suggestions.
	 * `null` indicates an empty slot placeholder so items below do not shift up when an item is removed.
	 * Trailing `null` entries are trimmed only from the very end of the array.
	 */
	public suggestionSlots: Array<ActionCardItem | null> = []

	/**
	 * Fixed-height slots for Bookmarked actions.
	 * Bookmarked items are never removed by the LLM and do not expire via TTL.
	 */
	public bookmarkSlots: Array<ActionCardItem | null> = []

	public notifications: NotificationMessage[] = []
	public selectedItemId: string | null = null
	public currentTimeMs: number = Date.now()
	public recentHumanOverrides: HumanOverrideRecord[] = []

	private tickInterval: ReturnType<typeof setInterval> | undefined
	private lastTickTime = Date.now()
	public isInitialized = false

	constructor() {
		makeObservable(this, {
			suggestionSlots: observable,
			bookmarkSlots: observable,
			notifications: observable,
			selectedItemId: observable,
			currentTimeMs: observable,
			recentHumanOverrides: observable,
			isInitialized: observable,
			allActiveItems: computed,
			activeSuggestions: computed,
			activeBookmarks: computed,
			onAirItems: computed,
			selectedItem: computed,
			targetedItem: computed,
			addOrUpdateSuggestion: action,
			renewSuggestion: action,
			triggerFadeRemoveSuggestion: action,
			dismissSuggestionImmediate: action,
			applyAiActionData: action,
			clearAllSuggestions: action,
			bookmarkSuggestion: action,
			removeBookmark: action,
			clearAllBookmarks: action,
			selectItem: action,
			selectNext: action,
			selectPrev: action,
			setItemHovered: action,
			setItemPopoverOpen: action,
			markItemPlaying: action,
			markItemStopped: action,
			recordItemAction: action,
			triggerAiButtonHighlight: action,
			recordHumanOverride: action,
			updateItemData: action,
			showNotification: action,
			showError: action,
			dismissNotification: action,
			migratePreliminaryRenderer: action,
		})

		void this.init()
		this.startTicker()
	}

	private async init() {
		try {
			const storedBookmarks = await dbStore.getSetting<Array<ActionCardItem | null>>('bookmarkSlots')
			if (Array.isArray(storedBookmarks)) {
				runInAction(() => {
					this.bookmarkSlots = storedBookmarks.map((b) =>
						b
							? {
									...b,
									isPlaying: false,
									playingSince: null,
									aiPressedAction: null,
									stopHoldRemainingMs: 0,
									highlightRemainingMs: 0,
									isHovered: false,
									isPopoverOpen: false,
									status: 'active',
								}
							: null
					)
					this.trimTrailingNulls(this.bookmarkSlots)
					this.isInitialized = true
				})
			} else {
				runInAction(() => {
					this.isInitialized = true
				})
			}
		} catch (e) {
			console.error('Failed to load bookmarks from IndexedDB', e)
			runInAction(() => {
				this.isInitialized = true
			})
		}
	}

	private persistBookmarks() {
		if (!this.isInitialized) return
		const clean = this.bookmarkSlots.map((item) => {
			if (!item) return null
			return {
				...clone(item),
				isPlaying: false,
				playingSince: null,
				aiPressedAction: null,
				stopHoldRemainingMs: 0,
				highlightRemainingMs: 0,
				isHovered: false,
				isPopoverOpen: false,
			}
		})
		dbStore.setSetting('bookmarkSlots', clean).catch(console.error)
	}

	public isItemOnAir(item: ActionCardItem): boolean {
		return Boolean(
			item.isPlaying &&
			(item.graphicInstanceId ||
				serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId))
		)
	}

	public getItemOnAirSeconds(item: ActionCardItem): number {
		if (!this.isItemOnAir(item) || !item.playingSince) return 0
		return Math.max(0, Math.floor((this.currentTimeMs - item.playingSince) / 1000))
	}

	public get onAirItems(): ActionCardItem[] {
		return this.allActiveItems.filter((item) => this.isItemOnAir(item))
	}

	public isItemProtectedFromRemoval(item: ActionCardItem): boolean {
		return this.isItemOnAir(item) || (item.stopHoldRemainingMs ?? 0) > 0
	}

	public recordHumanOverride(item: ActionCardItem, actionType: 'stop' | 'clear' | 'dismiss') {
		const now = Date.now()
		this.recentHumanOverrides = [
			...this.recentHumanOverrides.filter(
				(r) => now - r.timestamp < HUMAN_OVERRIDE_RETENTION_MS && r.itemId !== item.id
			),
			{
				itemId: item.id,
				graphicId: item.graphicId,
				graphicData: clone(item.graphicData),
				action: actionType,
				timestamp: now,
			},
		]
	}

	public recordItemAction(itemId: string, actor: 'ai' | 'user', actionType: string) {
		const target = this.findItemById(itemId)
		if (!target) return
		target.lastActionAt = Date.now()
		target.lastActionBy = actor
		target.lastActionType = actionType
	}

	public triggerAiButtonHighlight(itemId: string, actionId: string) {
		const target = this.findItemById(itemId)
		if (!target) return

		const normalized = actionId === 'pause' ? 'stop' : actionId

		// Ensure the button being pressed by the AI is exposed on the card so the operator sees it highlight
		if (normalized === 'play' && !target.exposedActions.includes('play')) {
			target.exposedActions = [...target.exposedActions, 'play']
		} else if (
			normalized === 'update' &&
			!target.exposedActions.includes('play') &&
			!target.exposedActions.includes('update')
		) {
			target.exposedActions = [...target.exposedActions, 'update']
		} else if (
			normalized === 'stop' &&
			!target.exposedActions.includes('play') &&
			!target.exposedActions.includes('pause')
		) {
			target.exposedActions = [...target.exposedActions, 'pause']
		} else if (
			normalized !== 'play' &&
			normalized !== 'update' &&
			normalized !== 'stop' &&
			normalized !== 'clear' &&
			normalized !== 'data-entry'
		) {
			if (!target.exposedCustomActions.some((ca) => ca.id === normalized)) {
				target.exposedCustomActions = [...target.exposedCustomActions, { id: normalized, withForm: false }]
			}
		}

		target.aiPressedAction = {
			actionId: normalized,
			remainingMs: AI_ACTION_HIGHLIGHT_MS,
		}
		target.lastActionAt = Date.now()
		target.lastActionBy = 'ai'
		target.lastActionType = normalized
	}

	public markItemPlaying(
		itemId: string,
		graphicInstanceId?: string,
		actor: 'ai' | 'user' = 'user',
		actionType: 'play' | 'update' = 'play'
	) {
		const target = this.findItemById(itemId)
		if (!target) return

		const now = Date.now()
		if (graphicInstanceId) {
			target.graphicInstanceId = graphicInstanceId
		}
		if (!target.isPlaying || !target.playingSince) {
			target.playingSince = now
		}
		target.isPlaying = true
		target.stopHoldRemainingMs = 0
		target.lastActionAt = now
		target.lastActionBy = actor
		target.lastActionType = actionType

		for (const other of this.allActiveItems) {
			if (other.id === itemId) continue
			if (other.rendererId === target.rendererId && isEqual(other.renderTarget, target.renderTarget)) {
				other.isPlaying = false
				other.playingSince = null
				other.stopHoldRemainingMs = 0
				if (graphicInstanceId && other.graphicInstanceId !== graphicInstanceId) {
					other.graphicInstanceId = undefined
				}
			}
		}
	}

	public markItemStopped(itemId: string, actor: 'ai' | 'user' = 'user', actionType: 'stop' | 'clear' = 'stop') {
		const target = this.findItemById(itemId)
		if (!target) return

		const now = Date.now()
		const wasPlaying = Boolean(target.isPlaying)
		target.isPlaying = false
		target.playingSince = null
		target.stopHoldRemainingMs = POST_STOP_HOLD_MS
		target.lastActionAt = now
		target.lastActionBy = actor
		target.lastActionType = actionType

		if (actor === 'user' && wasPlaying) {
			this.recordHumanOverride(target, actionType)
		}

		for (const other of this.allActiveItems) {
			if (other.id === itemId) continue
			if (
				(target.graphicInstanceId && other.graphicInstanceId === target.graphicInstanceId) ||
				(other.rendererId === target.rendererId && isEqual(other.renderTarget, target.renderTarget) && other.isPlaying)
			) {
				other.isPlaying = false
				other.playingSince = null
				other.stopHoldRemainingMs = POST_STOP_HOLD_MS
			}
		}
	}

	private startTicker() {
		if (this.tickInterval) clearInterval(this.tickInterval)
		this.lastTickTime = Date.now()
		this.tickInterval = setInterval(() => {
			const now = Date.now()
			const dt = Math.min(500, Math.max(0, now - this.lastTickTime))
			this.lastTickTime = now
			this.tick(dt)
		}, 100)
	}

	private tick = action((dt: number) => {
		const now = Date.now()
		this.currentTimeMs = now
		let removedAny = false

		if (this.recentHumanOverrides.length > 0) {
			const filtered = this.recentHumanOverrides.filter((r) => now - r.timestamp < HUMAN_OVERRIDE_RETENTION_MS)
			if (filtered.length !== this.recentHumanOverrides.length) {
				this.recentHumanOverrides = filtered
			}
		}

		for (let i = 0; i < this.bookmarkSlots.length; i++) {
			const bmk = this.bookmarkSlots[i]
			if (!bmk) continue
			if (bmk.highlightRemainingMs > 0) {
				bmk.highlightRemainingMs = Math.max(0, bmk.highlightRemainingMs - dt)
			}
			if (bmk.stopHoldRemainingMs && bmk.stopHoldRemainingMs > 0) {
				bmk.stopHoldRemainingMs = Math.max(0, bmk.stopHoldRemainingMs - dt)
			}
			if (bmk.aiPressedAction) {
				const rem = Math.max(0, bmk.aiPressedAction.remainingMs - dt)
				bmk.aiPressedAction = rem > 0 ? { actionId: bmk.aiPressedAction.actionId, remainingMs: rem } : null
			}
		}

		for (let i = 0; i < this.suggestionSlots.length; i++) {
			const item = this.suggestionSlots[i]
			if (!item) continue

			if (item.highlightRemainingMs > 0) {
				item.highlightRemainingMs = Math.max(0, item.highlightRemainingMs - dt)
			}
			if (item.stopHoldRemainingMs && item.stopHoldRemainingMs > 0) {
				item.stopHoldRemainingMs = Math.max(0, item.stopHoldRemainingMs - dt)
			}
			if (item.aiPressedAction) {
				const rem = Math.max(0, item.aiPressedAction.remainingMs - dt)
				item.aiPressedAction = rem > 0 ? { actionId: item.aiPressedAction.actionId, remainingMs: rem } : null
			}

			const isProtected = this.isItemProtectedFromRemoval(item)
			const isPaused = item.isHovered || item.isPopoverOpen || isProtected

			if (isPaused) {
				// If it was fading out when hovered/opened/on-air, snap opacity back to 100%
				if (item.status === 'fading' && item.fadeRemainingMs < FADE_DURATION_MS) {
					item.fadeRemainingMs = FADE_DURATION_MS
				}
				continue
			}

			if (item.status === 'active') {
				item.remainingMs = Math.max(0, item.remainingMs - dt)
				if (item.remainingMs <= 0) {
					item.status = 'fading'
					item.fadeRemainingMs = FADE_DURATION_MS
				}
			} else if (item.status === 'fading') {
				item.fadeRemainingMs = Math.max(0, item.fadeRemainingMs - dt)
				if (item.fadeRemainingMs <= 0) {
					if (this.selectedItemId === item.id) {
						this.selectedItemId = null
					}
					this.suggestionSlots[i] = null
					removedAny = true
				}
			}
		}

		if (removedAny) {
			this.trimTrailingNulls(this.suggestionSlots)
		}
	})

	private trimTrailingNulls(slots: Array<ActionCardItem | null>) {
		while (slots.length > 0 && slots[slots.length - 1] === null) {
			slots.pop()
		}
	}

	/**
	 * Removes the slot at `idx` and reshuffles all graphics after `idx` (leaving slots before `idx` untouched),
	 * removing any `null` gaps from `idx` onwards.
	 */
	private removeSlotAndCompactAfter(slots: Array<ActionCardItem | null>, idx: number) {
		if (idx < 0 || idx >= slots.length) return
		const before = slots.slice(0, idx)
		const afterCompacted = slots.slice(idx + 1).filter((s): s is ActionCardItem => s !== null)
		slots.splice(0, slots.length, ...before, ...afterCompacted)
		this.trimTrailingNulls(slots)
	}

	private placeInFirstEmptySlot(slots: Array<ActionCardItem | null>, item: ActionCardItem) {
		const emptyIdx = slots.findIndex((s) => s === null)
		if (emptyIdx !== -1) {
			slots[emptyIdx] = item
		} else {
			slots.push(item)
		}
	}

	public get activeSuggestions(): ActionCardItem[] {
		return this.suggestionSlots.filter((s): s is ActionCardItem => s !== null)
	}

	public get activeBookmarks(): ActionCardItem[] {
		return this.bookmarkSlots.filter((s): s is ActionCardItem => s !== null)
	}

	public get allActiveItems(): ActionCardItem[] {
		return [...this.activeSuggestions, ...this.activeBookmarks]
	}

	public get selectedItem(): ActionCardItem | undefined {
		if (!this.selectedItemId) return undefined
		return this.findItemById(this.selectedItemId)
	}

	public get targetedItem(): ActionCardItem | undefined {
		return (
			this.allActiveItems.find((i) => i.isHovered) ||
			this.allActiveItems.find((i) => i.isPopoverOpen) ||
			this.selectedItem ||
			this.allActiveItems.find((i) => this.isItemOnAir(i)) ||
			this.allActiveItems[0]
		)
	}

	public getDefaultRenderTarget(rendererId: string): unknown {
		const renderer = serverDataStore.renderersInfo.get(rendererId)
		return renderer?.renderTargetSchema ? getDefaultDataFromSchema(renderer.renderTargetSchema) : undefined
	}

	public getMergedGraphicData(graphicId: string, partialData: unknown): unknown {
		const graphicInfo = serverDataStore.graphicsInfo.get(graphicId)
		const schema = graphicInfo?.graphic?.schema
		const defaultData = schema ? getDefaultDataFromSchema(schema) : {}
		if (
			typeof defaultData === 'object' &&
			defaultData !== null &&
			!Array.isArray(defaultData) &&
			typeof partialData === 'object' &&
			partialData !== null &&
			!Array.isArray(partialData)
		) {
			return { ...clone(defaultData), ...clone(partialData) }
		}
		return partialData !== undefined ? clone(partialData) : clone(defaultData)
	}

	/**
	 * Called by the LLM `suggest_graphic` tool.
	 * If a suggestion with the exact same graphicId and graphicData is already in `suggestionSlots`,
	 * it renews and updates that slot in place rather than duplicating it.
	 */
	public addOrUpdateSuggestion(params: {
		graphicId: string
		graphicData: unknown
		ttlSeconds: number
		exposedActions: StandardExposedAction[]
		exposedCustomActions: ExposedCustomAction[]
		reason?: string
	}): ActionCardItem {
		const rendererId =
			appSettingsStore.getSelectedRendererId() || serverDataStore.renderersList[0]?.id || PRELIMINARY_RENDERER_ID
		const renderTarget = this.getDefaultRenderTarget(rendererId)
		const mergedData = this.getMergedGraphicData(params.graphicId, params.graphicData)
		const ttlSec = Math.max(5, Math.min(600, Math.round(params.ttlSeconds || 30)))

		const customActionData: Record<string, unknown> = {}
		const graphicInfo = serverDataStore.graphicsInfo.get(params.graphicId)
		const manifestCustomActions: any[] =
			(graphicInfo?.graphic as any)?.customActions || (graphicInfo?.graphic as any)?.actions || []

		for (const ca of params.exposedCustomActions) {
			const manifestCa = manifestCustomActions.find((m) => m.id === ca.id)
			const defaultCaData = manifestCa?.schema ? getDefaultDataFromSchema(manifestCa.schema) : undefined
			if (
				ca.payload !== undefined &&
				typeof defaultCaData === 'object' &&
				defaultCaData !== null &&
				typeof ca.payload === 'object' &&
				ca.payload !== null
			) {
				customActionData[ca.id] = { ...clone(defaultCaData), ...clone(ca.payload) }
			} else if (ca.payload !== undefined) {
				customActionData[ca.id] = clone(ca.payload)
			} else if (defaultCaData !== undefined) {
				customActionData[ca.id] = clone(defaultCaData)
			}
		}

		// Check if an identical graphicId + graphicData suggestion already exists in suggestionSlots
		const existing = this.suggestionSlots.find(
			(s) => s !== null && s.graphicId === params.graphicId && isEqual(s.graphicData, mergedData)
		)
		if (existing) {
			existing.ttlSeconds = ttlSec
			existing.remainingMs = ttlSec * 1000
			existing.status = 'active'
			existing.fadeRemainingMs = FADE_DURATION_MS
			existing.exposedActions = params.exposedActions.length > 0 ? params.exposedActions : existing.exposedActions
			existing.exposedCustomActions = params.exposedCustomActions
			existing.customActionData = { ...existing.customActionData, ...customActionData }
			if (params.reason) existing.reason = params.reason
			return existing
		}

		const item: ActionCardItem = {
			id: nextId('sug'),
			graphicId: params.graphicId,
			rendererId,
			renderTarget: clone(renderTarget),
			graphicData: mergedData,
			customActionData,
			exposedActions: params.exposedActions.length > 0 ? params.exposedActions : ['play'],
			exposedCustomActions: params.exposedCustomActions,
			reason: params.reason,
			ttlSeconds: ttlSec,
			remainingMs: ttlSec * 1000,
			status: 'active',
			fadeRemainingMs: FADE_DURATION_MS,
			highlightRemainingMs: NEW_HIGHLIGHT_DURATION_MS,
			isHovered: false,
			isPopoverOpen: false,
			createdAt: Date.now(),
		}

		this.placeInFirstEmptySlot(this.suggestionSlots, item)
		return item
	}

	/**
	 * Called by the LLM `renew_or_update_suggestion` tool.
	 */
	public renewSuggestion(params: {
		suggestionId: string
		ttlSeconds: number
		graphicData?: unknown
		exposedActions?: StandardExposedAction[]
		exposedCustomActions?: ExposedCustomAction[]
		reason?: string
	}): ActionCardItem | undefined {
		const item = this.suggestionSlots.find((s) => s !== null && s.id === params.suggestionId)
		if (!item) return undefined

		const ttlSec = Math.max(5, Math.min(600, Math.round(params.ttlSeconds || item.ttlSeconds || 30)))
		item.ttlSeconds = ttlSec
		item.remainingMs = ttlSec * 1000
		item.status = 'active'
		item.fadeRemainingMs = FADE_DURATION_MS

		if (params.graphicData !== undefined) {
			const combinedData =
				typeof item.graphicData === 'object' &&
				item.graphicData !== null &&
				!Array.isArray(item.graphicData) &&
				typeof params.graphicData === 'object' &&
				params.graphicData !== null &&
				!Array.isArray(params.graphicData)
					? {
							...(clone(item.graphicData) as Record<string, unknown>),
							...(clone(params.graphicData) as Record<string, unknown>),
						}
					: params.graphicData
			item.graphicData = this.getMergedGraphicData(item.graphicId, combinedData)
		}
		if (params.exposedActions && params.exposedActions.length > 0) {
			item.exposedActions = params.exposedActions
		}
		if (params.exposedCustomActions !== undefined) {
			item.exposedCustomActions = params.exposedCustomActions
			for (const ca of params.exposedCustomActions) {
				if (ca.payload !== undefined) {
					item.customActionData = {
						...item.customActionData,
						[ca.id]: clone(ca.payload),
					}
				}
			}
		}
		if (params.reason !== undefined) {
			item.reason = params.reason
		}

		return item
	}

	/**
	 * Called by the LLM `remove_suggestion` tool.
	 * Transitions the suggestion to 'fading' so it fades out over a few seconds before removal.
	 */
	public triggerFadeRemoveSuggestion(suggestionId: string): boolean {
		const item = this.suggestionSlots.find((s) => s !== null && s.id === suggestionId)
		if (!item) return false
		if (this.isItemOnAir(item)) return false

		item.remainingMs = 0
		item.status = 'fading'
		item.fadeRemainingMs = FADE_DURATION_MS
		return true
	}

	/**
	 * Immediately removes a suggestion when the user clicks the `×` dismiss button.
	 */
	public dismissSuggestionImmediate(suggestionId: string) {
		const idx = this.suggestionSlots.findIndex((s) => s !== null && s.id === suggestionId)
		if (idx !== -1) {
			const item = this.suggestionSlots[idx]
			if (item) {
				this.recordHumanOverride(item, 'dismiss')
			}
			if (this.selectedItemId === suggestionId) {
				this.selectedItemId = null
			}
			this.removeSlotAndCompactAfter(this.suggestionSlots, idx)
		}
	}

	/**
	 * Applies optional data/payload updates when the AI executes an action on a suggestion or bookmark.
	 */
	public applyAiActionData(
		itemId: string,
		params: {
			graphicData?: unknown
			customActionId?: string
			customActionPayload?: unknown
			reason?: string
		}
	): ActionCardItem | undefined {
		const item = this.findItemById(itemId)
		if (!item) return undefined

		const isBookmark = this.bookmarkSlots.some((b) => b?.id === itemId)

		if (!isBookmark) {
			item.remainingMs = item.ttlSeconds * 1000
			item.status = 'active'
			item.fadeRemainingMs = FADE_DURATION_MS
		}

		if (params.graphicData !== undefined) {
			const combinedData =
				typeof item.graphicData === 'object' &&
				item.graphicData !== null &&
				!Array.isArray(item.graphicData) &&
				typeof params.graphicData === 'object' &&
				params.graphicData !== null &&
				!Array.isArray(params.graphicData)
					? {
							...(clone(item.graphicData) as Record<string, unknown>),
							...(clone(params.graphicData) as Record<string, unknown>),
						}
					: params.graphicData
			item.graphicData = this.getMergedGraphicData(item.graphicId, combinedData)
		}

		if (params.customActionId && params.customActionPayload !== undefined) {
			item.customActionData = {
				...item.customActionData,
				[params.customActionId]: clone(params.customActionPayload),
			}
		}

		if (params.reason) {
			item.reason = params.reason
		}

		if (isBookmark) {
			this.persistBookmarks()
		}

		return item
	}

	public clearAllSuggestions() {
		if (this.selectedItemId && this.suggestionSlots.some((s) => s?.id === this.selectedItemId)) {
			this.selectedItemId = null
		}
		this.suggestionSlots = []
	}

	/**
	 * Moves a suggestion from the AI suggestions list to the Bookmarked list,
	 * leaving an empty slot in the AI suggestions list so nothing below shifts.
	 */
	public bookmarkSuggestion(suggestionId: string): ActionCardItem | undefined {
		const idx = this.suggestionSlots.findIndex((s) => s !== null && s.id === suggestionId)
		if (idx === -1) return undefined
		const item = this.suggestionSlots[idx]
		if (!item) return undefined

		this.suggestionSlots[idx] = null
		this.trimTrailingNulls(this.suggestionSlots)

		const bookmarkedItem: ActionCardItem = {
			...clone(item),
			id: nextId('bmk'),
			status: 'active',
			remainingMs: item.ttlSeconds * 1000,
			fadeRemainingMs: FADE_DURATION_MS,
			highlightRemainingMs: NEW_HIGHLIGHT_DURATION_MS,
			isHovered: false,
			isPopoverOpen: false,
		}

		this.placeInFirstEmptySlot(this.bookmarkSlots, bookmarkedItem)
		if (this.selectedItemId === suggestionId) {
			this.selectedItemId = bookmarkedItem.id
		}
		this.persistBookmarks()
		return bookmarkedItem
	}

	public removeBookmark(bookmarkId: string) {
		const idx = this.bookmarkSlots.findIndex((s) => s !== null && s.id === bookmarkId)
		if (idx !== -1) {
			if (this.selectedItemId === bookmarkId) {
				this.selectedItemId = null
			}
			this.removeSlotAndCompactAfter(this.bookmarkSlots, idx)
			this.persistBookmarks()
		}
	}

	public clearAllBookmarks() {
		if (this.selectedItemId && this.bookmarkSlots.some((s) => s?.id === this.selectedItemId)) {
			this.selectedItemId = null
		}
		this.bookmarkSlots = []
		this.persistBookmarks()
	}

	public selectItem(id: string | null) {
		this.selectedItemId = id
	}

	public selectNext() {
		const items = this.allActiveItems
		if (items.length === 0) return
		const currentIdx = items.findIndex((i) => i.id === this.selectedItemId)
		if (currentIdx === -1) {
			this.selectedItemId = items[0].id
		} else {
			this.selectedItemId = items[Math.min(items.length - 1, currentIdx + 1)].id
		}
	}

	public selectPrev() {
		const items = this.allActiveItems
		if (items.length === 0) return
		const currentIdx = items.findIndex((i) => i.id === this.selectedItemId)
		if (currentIdx === -1) {
			this.selectedItemId = items[items.length - 1].id
		} else {
			this.selectedItemId = items[Math.max(0, currentIdx - 1)].id
		}
	}

	public setItemHovered(id: string, isHovered: boolean) {
		const item = this.findItemById(id)
		if (!item) return
		item.isHovered = isHovered
		if (isHovered && item.status === 'fading') {
			// Immediately restore 100% opacity and restart the 3s fade countdown after mouse leaves
			item.fadeRemainingMs = FADE_DURATION_MS
		}
	}

	public setItemPopoverOpen(id: string, isOpen: boolean) {
		const item = this.findItemById(id)
		if (!item) return
		item.isPopoverOpen = isOpen
		if (isOpen && item.status === 'fading') {
			item.fadeRemainingMs = FADE_DURATION_MS
		}
	}

	public updateItemData(id: string, patch: Partial<ActionCardItem>) {
		const sug = this.suggestionSlots.find((s) => s !== null && s.id === id)
		if (sug) {
			Object.assign(sug, patch)
			return
		}
		const bmk = this.bookmarkSlots.find((s) => s !== null && s.id === id)
		if (bmk) {
			Object.assign(bmk, patch)
			this.persistBookmarks()
		}
	}

	public findItemById(id: string): ActionCardItem | undefined {
		return (
			this.suggestionSlots.find((s): s is ActionCardItem => s !== null && s.id === id) ||
			this.bookmarkSlots.find((s): s is ActionCardItem => s !== null && s.id === id)
		)
	}

	public migratePreliminaryRenderer(newRendererId: string) {
		const defaultTarget = this.getDefaultRenderTarget(newRendererId)
		let updatedBookmarks = false

		for (const item of this.activeSuggestions) {
			if (!item.rendererId || item.rendererId === PRELIMINARY_RENDERER_ID) {
				item.rendererId = newRendererId
				if (item.renderTarget === undefined && defaultTarget !== undefined) {
					item.renderTarget = clone(defaultTarget)
				}
			}
		}

		for (const item of this.activeBookmarks) {
			if (!item.rendererId || item.rendererId === PRELIMINARY_RENDERER_ID) {
				item.rendererId = newRendererId
				if (item.renderTarget === undefined && defaultTarget !== undefined) {
					item.renderTarget = clone(defaultTarget)
				}
				updatedBookmarks = true
			}
		}

		if (updatedBookmarks) {
			this.persistBookmarks()
		}
	}

	public showNotification(message: string, severity: NotificationMessage['severity'] = 'info') {
		const id = nextId('notif')
		this.notifications.push({ id, message, severity })
		setTimeout(() => {
			this.dismissNotification(id)
		}, 5000)
	}

	public showError(message: string) {
		this.showNotification(message, 'error')
	}

	public dismissNotification(id: string) {
		this.notifications = this.notifications.filter((n) => n.id !== id)
	}
}

export const aiAudioStore = new AiAudioStore()
