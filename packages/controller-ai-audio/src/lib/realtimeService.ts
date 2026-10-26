import { action, makeObservable, observable, reaction, runInAction } from 'mobx'
import { z } from 'zod'
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC, tool, backgroundResult } from '@openai/agents/realtime'
import { appSettingsStore, AVAILABLE_LANGUAGES, EagernessLevel, EAGERNESS_LABELS } from '../stores/appSettings.js'
import { serverDataStore, ScannedGraphicInfo } from '../stores/serverData.js'
import { aiAudioStore, ExposedCustomAction, StandardExposedAction } from '../stores/aiAudioStore.js'
import { AiControllerAPI, OperatorActionEvent } from './aiControllerApi.js'
import {
	ElksCallStatus,
	ElksVoiceNumberInfo,
	ElksWebrtcPhoneSession,
	fetchAndSetupElksNumbers,
} from './elksPhoneService.js'

export type RealtimeConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error'

export const NONE_AUDIO_SOURCE_ID = '__none__'
export const SYSTEM_AUDIO_SOURCE_ID = '__system_audio__'
export const SYSTEM_AND_MIC_SOURCE_ID = '__system_and_mic__'
export const PHONE_IN_SOURCE_ID = '__phone_in__'
export const PHONE_IN_AND_MIC_SOURCE_ID = '__phone_in_and_mic__'

export function isSystemAudioSource(sourceId: string): boolean {
	return sourceId === SYSTEM_AUDIO_SOURCE_ID || sourceId === SYSTEM_AND_MIC_SOURCE_ID
}

export function isPhoneInSource(sourceId: string): boolean {
	return sourceId === PHONE_IN_SOURCE_ID || sourceId === PHONE_IN_AND_MIC_SOURCE_ID
}

export function isAnySystemAudioSelected(): boolean {
	return (
		isSystemAudioSource(appSettingsStore.selectedMicDeviceId) ||
		isSystemAudioSource(appSettingsStore.selectedSecondaryMicDeviceId)
	)
}

export function isAnyPhoneInSelected(): boolean {
	return (
		isPhoneInSource(appSettingsStore.selectedMicDeviceId) ||
		isPhoneInSource(appSettingsStore.selectedSecondaryMicDeviceId)
	)
}

export function isDualAudioSource(
	_source1Id: string = appSettingsStore.selectedMicDeviceId,
	source2Id: string = appSettingsStore.selectedSecondaryMicDeviceId
): boolean {
	return Boolean(source2Id !== undefined && source2Id !== NONE_AUDIO_SOURCE_ID)
}

/**
 * Maximum duration (ms) of nonstop speech (where server VAD has not detected a pause)
 * before we proactively commit the audio buffer and request a model response.
 */
const CONTINUOUS_AUDIO_COMMIT_INTERVAL_MS = 4000

/**
 * Interval (ms) between periodic on-air status heartbeats sent to the LLM in Auto Mode
 * when at least one graphic is on air and no recent turn/tool activity has occurred.
 */
const ON_AIR_HEARTBEAT_INTERVAL_MS = 8000

/**
 * Grace period (ms) after a human operator manually plays or updates a graphic
 * during which the AI will not automatically stop that graphic.
 */
const HUMAN_PLAY_GRACE_PERIOD_MS = 8000

/**
 * Maximum number of recent conversation items kept in the OpenAI Realtime session
 * so accumulated audio tokens and empty assistant turns do not saturate the context window
 * or degrade latency/responsiveness over long listening sessions.
 */
const MAX_CONVERSATION_HISTORY_ITEMS = 12

/**
 * Safety timeout (ms) after which an in-progress response flag is considered stale if response.done was missed.
 */
const RESPONSE_STUCK_TIMEOUT_MS = 15000

const EAGERNESS_INSTRUCTIONS: Record<EagernessLevel, string> = {
	1: `EAGERNESS LEVEL: 1 / 5
	(Very Low — Conservative). Suggest graphics when the speaker states clear,
	complete facts that unmistakably call for a graphic (such as a full person name + title,
	or an explicit location report like "reporting from Kabul"). Do not guess missing fields.
	Keep suggestions rare and high-confidence.`,

	2: `EAGERNESS LEVEL: 2 / 5
	(Low — Cautious). Suggest graphics when there is strong, clear evidence in the spoken audio.
	Avoid speculative suggestions unless the context clearly supports them.`,

	3: `EAGERNESS LEVEL: 3 / 5
	(Medium — Balanced). Proactively suggest relevant graphics whenever people, locations,
	topics, or events are mentioned in the audio stream. Balance helpfulness with precision.`,

	4: `EAGERNESS LEVEL: 4 / 5
	(High — Proactive). Eagerly suggest graphics as soon as potential cues, names, places, numbers,
	or topics come up in speech. Or supporting / context content.

	`,

	5: `EAGERNESS LEVEL: 5 / 5

	(Very High — Maximum). Be maximally proactive and creative! Generate frequent suggestions for
	any mention of places, people, themes, camera moves, custom actions or follow-up updates.
	Or supporting / context content.
	Also come up with creative suggestions based on the context and extrapolate potential future talking points.
	`,
}

function safeParseJson(jsonStr: string | null | undefined, fallback: unknown = {}): unknown {
	if (!jsonStr || !jsonStr.trim()) return fallback
	try {
		return JSON.parse(jsonStr)
	} catch {
		return fallback
	}
}

function getActiveSuggestionsSummary() {
	return aiAudioStore.activeSuggestions.map((s) => ({
		itemId: s.id,
		suggestionId: s.id,
		graphicId: s.graphicId,
		data: s.graphicData,
		exposedActions: s.exposedActions,
		exposedCustomActions: s.exposedCustomActions,
		remainingSeconds: Math.round(s.remainingMs / 1000),
		status: s.status,
		onAir: aiAudioStore.isItemOnAir(s),
		onAirDurationSeconds: aiAudioStore.getItemOnAirSeconds(s),
		lastActionBy: s.lastActionBy || null,
		lastActionType: s.lastActionType || null,
	}))
}

function getBookmarksSummary() {
	return aiAudioStore.activeBookmarks.map((b) => ({
		itemId: b.id,
		bookmarkId: b.id,
		graphicId: b.graphicId,
		data: b.graphicData,
		exposedActions: b.exposedActions,
		exposedCustomActions: b.exposedCustomActions,
		onAir: aiAudioStore.isItemOnAir(b),
		onAirDurationSeconds: aiAudioStore.getItemOnAirSeconds(b),
		lastActionBy: b.lastActionBy || null,
		lastActionType: b.lastActionType || null,
	}))
}

function getOnAirGraphicsSummary() {
	const now = Date.now()
	return aiAudioStore.onAirItems.map((item) => {
		const isBookmark = aiAudioStore.activeBookmarks.some((b) => b.id === item.id)
		return {
			itemId: item.id,
			source: isBookmark ? 'bookmark' : 'suggestion',
			graphicId: item.graphicId,
			data: item.graphicData,
			onAirDurationSeconds: aiAudioStore.getItemOnAirSeconds(item),
			lastActionBy: item.lastActionBy || 'unknown',
			lastActionType: item.lastActionType || 'play',
			secondsSinceLastAction: item.lastActionAt ? Math.max(0, Math.round((now - item.lastActionAt) / 1000)) : null,
		}
	})
}

function getGraphicsStateSummary() {
	const now = Date.now()
	return {
		autoMode: appSettingsStore.autoMode,
		onAirGraphics: getOnAirGraphicsSummary(),
		activeSuggestions: getActiveSuggestionsSummary(),
		bookmarks: getBookmarksSummary(),
		recentOperatorOverrides: aiAudioStore.recentHumanOverrides.map((r) => ({
			itemId: r.itemId,
			graphicId: r.graphicId,
			data: r.graphicData,
			operatorAction: r.action,
			secondsAgo: Math.max(0, Math.round((now - r.timestamp) / 1000)),
		})),
	}
}

export const MAX_INSTRUCTION_TOKENS = 16384

/**
 * Strips UI-only GDD metadata from a JSON schema so instructions stay compact while keeping
 * all property names, types, descriptions, enums, defaults, and structure intact for the LLM.
 */
function compactSchemaForLLM(schema: unknown): unknown {
	if (!schema || typeof schema !== 'object') return schema
	if (Array.isArray(schema)) return schema.map(compactSchemaForLLM)

	const obj = schema as Record<string, unknown>
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries<unknown>(obj)) {
		if (k === '$schema' || k === 'gdd' || k === 'gddType' || k === 'gddOptions') continue
		if (k === 'default' && typeof v === 'string' && v.length > 120) continue
		out[k] = compactSchemaForLLM(v)
	}
	return out
}

export function formatGraphicForInstructions(g: ScannedGraphicInfo): string {
	const manifest = g.graphic as any
	const customActions = manifest.customActions || manifest.actions || []
	return JSON.stringify({
		id: g.id,
		name: manifest.name || g.id,
		description: manifest.description || undefined,
		schema: compactSchemaForLLM(manifest.schema) || null,
		customActions:
			Array.isArray(customActions) && customActions.length > 0
				? customActions.map((ca: any) => ({
						id: ca.id,
						name: ca.name || ca.id,
						description: ca.description || undefined,
						schema: compactSchemaForLLM(ca.schema) || null,
					}))
				: undefined,
	})
}

export function estimateTokensFromString(text: string): number {
	if (!text) return 0
	return Math.ceil(text.length / 3.5)
}

export function estimateGraphicTokens(g: ScannedGraphicInfo): number {
	return estimateTokensFromString(formatGraphicForInstructions(g))
}

export const SYSTEM_AUDIO_INFO_STORAGE_KEY = 'ograf_ai_audio_system_audio_info_shown'

export const DEFAULT_REALTIME_MODELS = [
	'gpt-realtime',
	'gpt-realtime-mini',
	'gpt-4o-realtime-preview',
	'gpt-4o-mini-realtime-preview',
]

class RealtimeService {
	public status: RealtimeConnectionStatus = 'disconnected'
	public isMuted: boolean = false
	public isSystemMuted: boolean = false
	public isSystemAutoMuted: boolean = false
	public isMicMuted: boolean = false
	public audioLevel: number = 0
	public systemAudioLevel: number = 0
	public micAudioLevel: number = 0
	public availableMicDevices: MediaDeviceInfo[] = []
	public availableOpenAiModels: string[] = [...DEFAULT_REALTIME_MODELS]
	public isLoadingOpenAiModels: boolean = false
	public liveTranscript: string = ''
	public lastToolActivity: string = ''
	public errorMessage: string | null = null
	public scannedGraphics: ScannedGraphicInfo[] = []

	// Select Graphics, System Audio, & 46elks Phone-In modal state
	public isGraphicsModalOpen: boolean = false
	public graphicsModalError: string | null = null
	public isSystemAudioInfoDialogOpen: boolean = false
	public isElksCredentialsDialogOpen: boolean = false
	public elksCallStatus: ElksCallStatus = 'idle'
	public elksActiveCaller: string | null = null
	public elksVoiceNumbers: ElksVoiceNumberInfo[] = []
	public isLoadingElksNumbers: boolean = false
	public elksError: string | null = null
	public isCapturingTranscript: boolean = false

	private session: RealtimeSession | null = null
	private mediaStream: MediaStream | null = null
	private rawCaptureStreams: MediaStream[] = []
	private cachedSystemDisplayStreams: Map<1 | 2, MediaStream> = new Map()
	private sysRawStream: MediaStream | null = null
	private micRawStream: MediaStream | null = null
	private mixerAudioContext: AudioContext | null = null
	private sysGainNode: GainNode | null = null
	private micGainNode: GainNode | null = null
	private sysAnalyser: AnalyserNode | null = null
	private micAnalyser: AnalyserNode | null = null
	private micSourceNode: MediaStreamAudioSourceNode | null = null
	private keepAliveOscillator: ConstantSourceNode | null = null
	private elksPhoneSession: ElksWebrtcPhoneSession | null = null
	private audioContext: AudioContext | null = null
	private levelInterval: ReturnType<typeof setInterval> | null = null
	private dummyAudioElement: HTMLAudioElement | null = null
	private autoMuteHoldRemainingMs: number = 0

	// Continuous audio tracking state
	private isServerSpeechActive: boolean = false
	private uncommittedSpeechMs: number = 0
	private isResponseInProgress: boolean = false
	private responseStartedAtMs: number = 0
	private lastAiOrOperatorActivityAtMs: number = 0
	private lastRecognizedWordsAtMs: number = 0
	private onAirHeartbeatInterval: ReturnType<typeof setInterval> | null = null
	private serverConversationItemIds: string[] = []
	private isReconnectingTransport: boolean = false
	private committedTranscriptHistory: string = ''
	private currentTranscriptDelta: string = ''

	// Press-and-hold "Listen" transcript capture state
	private isAwaitingFinalCapturedChunk: boolean = false
	private capturedCommittedSegments: string[] = []
	private capturedCurrentDelta: string = ''
	private onCapturedTranscriptUpdate: ((text: string) => void) | null = null
	private captureFinalizeTimeout: ReturnType<typeof setTimeout> | null = null
	private browserRecognition: any = null

	constructor() {
		makeObservable(this, {
			status: observable,
			isMuted: observable,
			isSystemMuted: observable,
			isSystemAutoMuted: observable,
			isMicMuted: observable,
			audioLevel: observable,
			systemAudioLevel: observable,
			micAudioLevel: observable,
			availableMicDevices: observable,
			availableOpenAiModels: observable,
			isLoadingOpenAiModels: observable,
			liveTranscript: observable,
			lastToolActivity: observable,
			errorMessage: observable,
			scannedGraphics: observable,
			isGraphicsModalOpen: observable,
			graphicsModalError: observable,
			isSystemAudioInfoDialogOpen: observable,
			isElksCredentialsDialogOpen: observable,
			elksCallStatus: observable,
			elksActiveCaller: observable,
			elksVoiceNumbers: observable,
			isLoadingElksNumbers: observable,
			elksError: observable,
			isCapturingTranscript: observable,
			setMuted: action,
			setSystemMuted: action,
			setMicMuted: action,
			openGraphicsModal: action,
			closeGraphicsModal: action,
			closeSystemAudioInfoDialog: action,
			openElksCredentialsDialog: action,
			closeElksCredentialsDialog: action,
			startCapturingTranscript: action,
			stopCapturingTranscript: action,
		})

		void this.refreshMicDevices()
		if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
			navigator.mediaDevices.addEventListener?.('devicechange', () => {
				void this.refreshMicDevices()
			})
		}

		// Live update system prompt instructions when the Eagerness slider, Auto Mode, or Languages change
		reaction(
			() => appSettingsStore.eagerness,
			(newEagerness) => {
				void this.updateEagernessLive(newEagerness)
			}
		)
		reaction(
			() => appSettingsStore.autoMode,
			(autoMode) => {
				void this.handleAutoModeChanged(autoMode)
			}
		)
		reaction(
			() => appSettingsStore.selectedLanguages.join(','),
			() => {
				void this.updateEagernessLive()
			}
		)
		reaction(
			() => appSettingsStore.autoMuteSystemOnMic,
			() => {
				this.applyMuteStates()
			}
		)
		reaction(
			() => appSettingsStore.autoStopOnSilence,
			(enabled) => {
				if (enabled && this.status === 'connected') {
					this.lastRecognizedWordsAtMs = Date.now()
				}
			}
		)
		reaction(
			() => appSettingsStore.openAiApiKey,
			(key) => {
				if (key && key.trim()) {
					void this.fetchAvailableOpenAiModels()
				}
			}
		)

		AiControllerAPI.onOperatorAction((ev) => {
			this.handleOperatorActionEvent(ev)
		})
	}

	private async handleAutoModeChanged(autoMode: boolean): Promise<void> {
		if (!this.session || this.status !== 'connected') return
		await this.updateEagernessLive()
		try {
			this.sendRawRealtimeEvent({
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'user',
					content: [
						{
							type: 'input_text',
							text: autoMode
								? `[SYSTEM MODE UPDATE: Operator enabled AUTO MODE. You may now both suggest graphics AND automatically execute actions ("play", "update", "stop", "clear", or custom actions) on Suggestions and Bookmarks. Current State: ${JSON.stringify(getGraphicsStateSummary())}]`
								: `[SYSTEM MODE UPDATE: Operator switched to SUGGEST-ONLY MODE. Do not auto-execute play/stop/custom actions; only manage suggestions in the GUI. Current State: ${JSON.stringify(getGraphicsStateSummary())}]`,
						},
					],
				},
			})
		} catch (e) {
			console.debug('Could not send Auto Mode update item:', e)
		}
	}

	private handleOperatorActionEvent(ev: OperatorActionEvent): void {
		this.lastAiOrOperatorActivityAtMs = Date.now()
		if (!this.session || this.status !== 'connected') return

		const targetDesc = ev.item ? ` on item "${ev.item.id}" (graphic "${ev.item.graphicId}")` : ''
		try {
			this.sendRawRealtimeEvent({
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'user',
					content: [
						{
							type: 'input_text',
							text: `[Operator Action: The human operator manually triggered "${ev.action}"${targetDesc}. Respect operator overrides (do not immediately undo their action). Updated Graphics State: ${JSON.stringify(getGraphicsStateSummary())}]`,
						},
					],
				},
			})
		} catch (e) {
			console.debug('Could not send operator action event to LLM:', e)
		}
	}

	private startOnAirHeartbeat(): void {
		this.stopOnAirHeartbeat()
		this.lastAiOrOperatorActivityAtMs = Date.now()
		if (this.lastRecognizedWordsAtMs === 0) {
			this.lastRecognizedWordsAtMs = Date.now()
		}
		this.onAirHeartbeatInterval = setInterval(() => {
			this.checkOnAirHeartbeat()
		}, 2000)
	}

	private stopOnAirHeartbeat(): void {
		if (this.onAirHeartbeatInterval) {
			clearInterval(this.onAirHeartbeatInterval)
			this.onAirHeartbeatInterval = null
		}
	}

	private checkOnAirHeartbeat(): void {
		if (!this.session || this.status !== 'connected') return

		const now = Date.now()

		if (appSettingsStore.autoStopOnSilence && this.lastRecognizedWordsAtMs > 0) {
			const silenceMinutes = Math.max(1, Number(appSettingsStore.autoStopSilenceMinutes) || 5)
			const silenceLimitMs = silenceMinutes * 60 * 1000
			if (now - this.lastRecognizedWordsAtMs >= silenceLimitMs) {
				this.stopSession()
				runInAction(() => {
					this.lastToolActivity = `Auto-stopped listening after ${silenceMinutes} min without recognized words`
				})
				return
			}
		}

		if (!appSettingsStore.autoMode) return
		if (this.isServerSpeechActive) return

		const onAirItems = aiAudioStore.onAirItems
		if (onAirItems.length === 0) return

		if (this.isResponseInProgress) {
			if (now - this.responseStartedAtMs > RESPONSE_STUCK_TIMEOUT_MS) {
				this.isResponseInProgress = false
			} else {
				return
			}
		}

		if (now - this.lastAiOrOperatorActivityAtMs < ON_AIR_HEARTBEAT_INTERVAL_MS) {
			return
		}

		// Only fire heartbeat if at least one on-air graphic has been on air >= 8s
		// and is past any human-play grace period
		const hasEligibleItem = onAirItems.some((item) => {
			const onAirSec = aiAudioStore.getItemOnAirSeconds(item)
			if (onAirSec < 8) return false
			if (item.lastActionBy === 'user' && item.lastActionAt && now - item.lastActionAt < HUMAN_PLAY_GRACE_PERIOD_MS) {
				return false
			}
			return true
		})

		if (!hasEligibleItem) return

		this.lastAiOrOperatorActivityAtMs = now
		try {
			this.sendRawRealtimeEvent({
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'user',
					content: [
						{
							type: 'input_text',
							text: `[Auto-Mode On-Air Heartbeat: Check currently ON AIR graphics and their onAirDurationSeconds. If a transient graphic (such as a lower-third, name super, or locator) has been on air long enough (typically 8–15s) or the spoken topic has moved on, call execute_graphic_action with action="stop". If it should remain on air, take no action and finish your turn with empty text. Current State: ${JSON.stringify(getGraphicsStateSummary())}]`,
						},
					],
				},
			})
			this.sendRawRealtimeEvent({
				type: 'response.create',
			})
		} catch (e) {
			console.debug('On-air heartbeat skipped:', e)
		}
	}

	public async fetchAvailableOpenAiModels(): Promise<void> {
		const rawKey = appSettingsStore.openAiApiKey.trim()
		if (!rawKey) {
			runInAction(() => {
				this.availableOpenAiModels = Array.from(
					new Set([...DEFAULT_REALTIME_MODELS, appSettingsStore.openAiModel].filter(Boolean))
				)
			})
			return
		}

		runInAction(() => {
			this.isLoadingOpenAiModels = true
		})

		try {
			const response = await fetch('https://api.openai.com/v1/models', {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${rawKey}`,
				},
			})
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}
			const json = (await response.json()) as { data?: Array<{ id?: string }> }
			const fetchedIds = (json.data || [])
				.map((m) => m.id || '')
				.filter((id) => {
					const lower = id.toLowerCase()
					return lower.includes('realtime') && !lower.includes('transcribe') && !lower.includes('whisper')
				})
				.sort()

			const merged = Array.from(
				new Set([...DEFAULT_REALTIME_MODELS, ...fetchedIds, appSettingsStore.openAiModel].filter(Boolean))
			)
			runInAction(() => {
				this.availableOpenAiModels = merged
			})
		} catch (e) {
			console.debug('Could not fetch OpenAI models list:', e)
			runInAction(() => {
				this.availableOpenAiModels = Array.from(
					new Set([...DEFAULT_REALTIME_MODELS, appSettingsStore.openAiModel].filter(Boolean))
				)
			})
		} finally {
			runInAction(() => {
				this.isLoadingOpenAiModels = false
			})
		}
	}

	public async refreshElksNumbers(configureRouting = true): Promise<boolean> {
		if (!appSettingsStore.elksApiUsername.trim() || !appSettingsStore.elksApiPassword.trim()) {
			return false
		}
		runInAction(() => {
			this.isLoadingElksNumbers = true
			this.elksError = null
		})
		try {
			const result = await fetchAndSetupElksNumbers({ configureRouting })
			runInAction(() => {
				this.elksVoiceNumbers = result.voiceNumbers
				this.elksError = null
			})
			return true
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			runInAction(() => {
				this.elksError = msg
			})
			return false
		} finally {
			runInAction(() => {
				this.isLoadingElksNumbers = false
			})
		}
	}

	public openElksCredentialsDialog(): void {
		this.isElksCredentialsDialogOpen = true
	}

	public closeElksCredentialsDialog(): void {
		this.isElksCredentialsDialogOpen = false
	}

	public requestStartSession(): void {
		if (isAnyPhoneInSelected() && !appSettingsStore.hasElksCredentials()) {
			runInAction(() => {
				this.isElksCredentialsDialogOpen = true
			})
			return
		}

		if (isAnySystemAudioSelected()) {
			let alreadyShown = false
			try {
				alreadyShown = window.localStorage.getItem(SYSTEM_AUDIO_INFO_STORAGE_KEY) === '1'
			} catch {
				// ignore storage errors
			}
			if (!alreadyShown) {
				runInAction(() => {
					this.isSystemAudioInfoDialogOpen = true
				})
				return
			}
		}

		void this.startSession()
	}

	public confirmSystemAudioInfoAndStart(): void {
		try {
			window.localStorage.setItem(SYSTEM_AUDIO_INFO_STORAGE_KEY, '1')
		} catch {
			// ignore storage errors
		}
		runInAction(() => {
			this.isSystemAudioInfoDialogOpen = false
		})
		void this.startSession()
	}

	public closeSystemAudioInfoDialog(): void {
		this.isSystemAudioInfoDialogOpen = false
	}

	public openGraphicsModal(errorMsg: string | null = null) {
		this.graphicsModalError = errorMsg
		this.isGraphicsModalOpen = true
		if (this.scannedGraphics.length === 0) {
			void serverDataStore
				.scanAllGraphicsForLLM()
				.then((graphics) => {
					runInAction(() => {
						this.scannedGraphics = graphics
					})
				})
				.catch((e) => console.warn('Could not scan graphics for modal:', e))
		}
	}

	public closeGraphicsModal() {
		this.isGraphicsModalOpen = false
	}

	public getEnabledGraphics(allGraphics: ScannedGraphicInfo[] = this.scannedGraphics): ScannedGraphicInfo[] {
		return allGraphics.filter((g) => appSettingsStore.isGraphicEnabled(g.id))
	}

	public estimateCurrentInstructionsTokens(
		enabledGraphics: ScannedGraphicInfo[],
		eagerness: EagernessLevel = appSettingsStore.eagerness
	): number {
		const instructions = this.buildSystemInstructions(enabledGraphics, eagerness)
		return estimateTokensFromString(instructions)
	}

	public async refreshMicDevices() {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
		try {
			const devices = await navigator.mediaDevices.enumerateDevices()
			const mics = devices.filter((d) => d.kind === 'audioinput')
			runInAction(() => {
				this.availableMicDevices = mics
			})
		} catch (e) {
			console.warn('Could not enumerate microphone devices:', e)
		}
	}

	private buildTools() {
		const suggestGraphicTool = tool({
			name: 'suggest_graphic',
			description:
				'Add a new OGraf graphic suggestion to the operator GUI. Call this immediately whenever spoken audio warrants suggesting an available OGraf graphic. In Auto Mode, you can optionally pass `autoExecuteAction` (e.g. "play") to both add the suggestion card and immediately trigger that action on air, or pass null to only suggest it.',
			parameters: z.object({
				graphicId: z.string().describe('The exact graphic ID from the available OGraf graphics catalog.'),
				dataJson: z
					.string()
					.describe(
						'JSON-encoded object matching the graphic schema properties, e.g. \'{"name":"Jane Doe","title":"Reporter"}\' or \'{"text":"Kabul","live":true}\'.'
					),
				ttlSeconds: z
					.number()
					.min(5)
					.max(600)
					.describe(
						'Estimated time-to-live in seconds for how long this suggestion remains relevant unless renewed (e.g. 30).'
					),
				exposedActions: z
					.array(z.enum(['play', 'update', 'pause', 'data-entry']))
					.describe(
						'Which standard actions to expose on the suggestion card. "play" plays/loads the graphic, "update" updates data on air, "pause" stops/takes out the graphic, and "data-entry" exposes an ograf-form button so the user can edit the graphic data.'
					),
				exposedCustomActions: z
					.array(
						z.object({
							id: z.string().describe('The custom action ID from the graphic manifest customActions list.'),
							withForm: z
								.boolean()
								.describe(
									'True if the user should be able to edit the custom action payload using an ograf-form before/when triggering it.'
								),
							payloadJson: z
								.string()
								.nullable()
								.describe('Optional JSON-encoded payload object matching the custom action schema, or null.'),
						})
					)
					.describe('Custom actions from the graphic manifest to expose on this suggestion card (use [] if none).'),
				reason: z
					.string()
					.nullable()
					.describe('Brief human-readable note explaining why this suggestion was triggered from the audio.'),
				autoExecuteAction: z
					.string()
					.nullable()
					.describe(
						'In Auto Mode ONLY: Optional action to immediately press on this card right after adding it ("play", "update", "stop", or a customActionId). Pass null if you only want to suggest the graphic without triggering it on air yet.'
					),
				autoExecutePayloadJson: z
					.string()
					.nullable()
					.describe('Optional JSON-encoded payload object if autoExecuteAction is a customActionId, or null.'),
			}),
			execute: async (input) => {
				this.lastAiOrOperatorActivityAtMs = Date.now()
				const parsedData = safeParseJson(input.dataJson, {})
				const customActions: ExposedCustomAction[] = (input.exposedCustomActions || []).map((ca) => ({
					id: ca.id,
					withForm: ca.withForm,
					payload: ca.payloadJson ? safeParseJson(ca.payloadJson, undefined) : undefined,
				}))

				console.log('[LLM Tool] suggest_graphic', {
					graphicId: input.graphicId,
					data: parsedData,
					ttlSeconds: input.ttlSeconds,
					exposedActions: input.exposedActions,
					exposedCustomActions: customActions,
					reason: input.reason,
					autoExecuteAction: input.autoExecuteAction,
				})

				const item = aiAudioStore.addOrUpdateSuggestion({
					graphicId: input.graphicId,
					graphicData: parsedData,
					ttlSeconds: input.ttlSeconds,
					exposedActions: input.exposedActions as StandardExposedAction[],
					exposedCustomActions: customActions,
					reason: input.reason ?? undefined,
				})

				let executedAction: string | null = null
				if (appSettingsStore.autoMode && input.autoExecuteAction && input.autoExecuteAction.trim()) {
					const act = input.autoExecuteAction.trim()
					const actPayload = input.autoExecutePayloadJson
						? safeParseJson(input.autoExecutePayloadJson, undefined)
						: undefined
					if (actPayload !== undefined) {
						aiAudioStore.applyAiActionData(item.id, {
							customActionId: act,
							customActionPayload: actPayload,
						})
					}
					await AiControllerAPI.performAction(item, act, {
						actor: 'ai',
						payload: actPayload,
					})
					executedAction = act
				}

				runInAction(() => {
					this.lastToolActivity = executedAction
						? `Suggested & auto-triggered "${executedAction}" on "${item.graphicId}"`
						: `Suggested "${item.graphicId}" (TTL ${item.ttlSeconds}s)`
				})

				return backgroundResult(
					JSON.stringify({
						status: 'ok',
						suggestionId: item.id,
						itemId: item.id,
						autoExecutedAction: executedAction,
						activeSuggestions: getActiveSuggestionsSummary(),
						state: getGraphicsStateSummary(),
					})
				)
			},
		})

		const renewOrUpdateSuggestionTool = tool({
			name: 'renew_or_update_suggestion',
			description:
				'Update or renew an existing suggestion ONLY if it represents the EXACT SAME graphic instance/subject (specifically to fix a spelling error or append newly spoken details/fields to that exact same subject). NEVER use this to overwrite a suggestion with a different person, location, or subject — call `suggest_graphic` to add a new graphic to the list instead.',
			parameters: z.object({
				suggestionId: z.string().describe('The suggestionId of the existing suggestion to renew or update.'),
				ttlSeconds: z.number().min(5).max(600).describe('New TTL in seconds from now (e.g. 30).'),
				dataJson: z
					.string()
					.nullable()
					.describe(
						'Optional updated JSON-encoded graphic data object (only for correcting spelling or adding fields to the same subject), or null to keep existing data.'
					),
				exposedActions: z
					.array(z.enum(['play', 'update', 'pause', 'data-entry']))
					.nullable()
					.describe('Optional updated list of exposed standard actions, or null to keep existing.'),
				reason: z.string().nullable().describe('Optional updated reason note, or null to keep existing.'),
				autoExecuteAction: z
					.string()
					.nullable()
					.describe(
						'In Auto Mode ONLY: Optional action to immediately trigger on this suggestion after updating it ("play", "update", "stop", or a customActionId), or null.'
					),
				autoExecutePayloadJson: z
					.string()
					.nullable()
					.describe('Optional JSON-encoded payload if autoExecuteAction is a customActionId, or null.'),
			}),
			execute: async (input) => {
				this.lastAiOrOperatorActivityAtMs = Date.now()
				const parsedData = input.dataJson ? safeParseJson(input.dataJson, undefined) : undefined

				console.log('[LLM Tool] renew_or_update_suggestion', {
					suggestionId: input.suggestionId,
					ttlSeconds: input.ttlSeconds,
					data: parsedData,
					exposedActions: input.exposedActions,
					reason: input.reason,
					autoExecuteAction: input.autoExecuteAction,
				})

				const updated = aiAudioStore.renewSuggestion({
					suggestionId: input.suggestionId,
					ttlSeconds: input.ttlSeconds,
					graphicData: parsedData,
					exposedActions: (input.exposedActions as StandardExposedAction[] | null) ?? undefined,
					reason: input.reason ?? undefined,
				})

				if (!updated) {
					return backgroundResult(
						JSON.stringify({
							status: 'not_found',
							message: `Suggestion ${input.suggestionId} is no longer in the AI suggestions list.`,
							activeSuggestions: getActiveSuggestionsSummary(),
							state: getGraphicsStateSummary(),
						})
					)
				}

				let executedAction: string | null = null
				if (appSettingsStore.autoMode && input.autoExecuteAction && input.autoExecuteAction.trim()) {
					const act = input.autoExecuteAction.trim()
					const actPayload = input.autoExecutePayloadJson
						? safeParseJson(input.autoExecutePayloadJson, undefined)
						: undefined
					if (actPayload !== undefined) {
						aiAudioStore.applyAiActionData(updated.id, {
							customActionId: act,
							customActionPayload: actPayload,
						})
					}
					await AiControllerAPI.performAction(updated, act, {
						actor: 'ai',
						payload: actPayload,
					})
					executedAction = act
				}

				runInAction(() => {
					this.lastToolActivity = executedAction
						? `Updated & auto-triggered "${executedAction}" on "${updated.graphicId}"`
						: `Renewed "${updated.graphicId}" (TTL ${updated.ttlSeconds}s)`
				})

				return backgroundResult(
					JSON.stringify({
						status: 'ok',
						suggestionId: updated.id,
						itemId: updated.id,
						autoExecutedAction: executedAction,
						activeSuggestions: getActiveSuggestionsSummary(),
						state: getGraphicsStateSummary(),
					})
				)
			},
		})

		const executeGraphicActionTool = tool({
			name: 'execute_graphic_action',
			description:
				'In Auto Mode: Trigger an action button ("play", "update", "stop", "clear", or any manifest customActionId) on an existing graphic card in either the AI Suggestions list (sug_...) or the Bookmarks list (bmk_...). The button you press will highlight in the operator GUI.',
			parameters: z.object({
				itemId: z
					.string()
					.describe('The itemId (suggestionId "sug_..." or bookmarkId "bmk_...") of the card to trigger.'),
				action: z
					.string()
					.describe(
						'The action to trigger: "play", "update", "stop", "clear", or a customActionId from the graphic manifest.'
					),
				dataJson: z
					.string()
					.nullable()
					.describe(
						'Optional updated JSON-encoded graphic data object to apply to the card before executing "play" or "update", or null to use the card\'s current data.'
					),
				customActionPayloadJson: z
					.string()
					.nullable()
					.describe('Optional JSON-encoded payload object when invoking a customActionId, or null.'),
				reason: z
					.string()
					.nullable()
					.describe('Brief human-readable note explaining why this action is being triggered.'),
			}),
			execute: async (input) => {
				this.lastAiOrOperatorActivityAtMs = Date.now()
				if (!appSettingsStore.autoMode) {
					return backgroundResult(
						JSON.stringify({
							status: 'auto_mode_disabled',
							message: 'Auto Mode is currently off. Only suggest/renew/remove suggestions without executing actions.',
							state: getGraphicsStateSummary(),
						})
					)
				}

				const item = aiAudioStore.findItemById(input.itemId)
				if (!item) {
					return backgroundResult(
						JSON.stringify({
							status: 'not_found',
							message: `Item ${input.itemId} was not found in active Suggestions or Bookmarks.`,
							state: getGraphicsStateSummary(),
						})
					)
				}

				const normalizedAction = input.action.trim() === 'pause' ? 'stop' : input.action.trim()

				// Respect human operator grace period: if the operator manually played/updated this graphic < 8s ago, do not auto-stop it yet
				if (
					(normalizedAction === 'stop' || normalizedAction === 'clear') &&
					item.lastActionBy === 'user' &&
					(item.lastActionType === 'play' || item.lastActionType === 'update') &&
					item.lastActionAt &&
					Date.now() - item.lastActionAt < HUMAN_PLAY_GRACE_PERIOD_MS
				) {
					return backgroundResult(
						JSON.stringify({
							status: 'skipped_human_grace_period',
							message: `The human operator manually triggered ${item.lastActionType} on ${item.id} less than 8 seconds ago. Respecting operator grace period.`,
							state: getGraphicsStateSummary(),
						})
					)
				}

				const parsedData = input.dataJson ? safeParseJson(input.dataJson, undefined) : undefined
				const parsedPayload = input.customActionPayloadJson
					? safeParseJson(input.customActionPayloadJson, undefined)
					: undefined

				console.log('[LLM Tool] execute_graphic_action', {
					itemId: item.id,
					graphicId: item.graphicId,
					action: normalizedAction,
					data: parsedData,
					customActionPayload: parsedPayload,
					reason: input.reason,
				})

				aiAudioStore.applyAiActionData(item.id, {
					graphicData: parsedData,
					customActionId: normalizedAction,
					customActionPayload: parsedPayload,
					reason: input.reason ?? undefined,
				})

				await AiControllerAPI.performAction(item, normalizedAction, {
					actor: 'ai',
					payload: parsedPayload,
				})

				runInAction(() => {
					this.lastToolActivity = `AI pressed "${normalizedAction}" on "${item.graphicId}"`
				})

				return backgroundResult(
					JSON.stringify({
						status: 'ok',
						itemId: item.id,
						graphicId: item.graphicId,
						executedAction: normalizedAction,
						activeSuggestions: getActiveSuggestionsSummary(),
						state: getGraphicsStateSummary(),
					})
				)
			},
		})

		const removeSuggestionTool = tool({
			name: 'remove_suggestion',
			description:
				'Remove an existing suggestion from the AI suggestions list when the topic has changed or the suggestion is no longer relevant. The card will smoothly fade out in the GUI. Note: If a graphic is currently ON AIR, stop it first with execute_graphic_action(action="stop") before removing it.',
			parameters: z.object({
				suggestionId: z.string().describe('The suggestionId of the suggestion to remove.'),
				reason: z.string().nullable().describe('Optional reason why it is being removed.'),
			}),
			execute: async (input) => {
				this.lastAiOrOperatorActivityAtMs = Date.now()
				console.log('[LLM Tool] remove_suggestion', {
					suggestionId: input.suggestionId,
					reason: input.reason,
				})

				const target = aiAudioStore.findItemById(input.suggestionId)
				if (target && aiAudioStore.isItemOnAir(target)) {
					return backgroundResult(
						JSON.stringify({
							status: 'protected_on_air',
							message: `Suggestion ${input.suggestionId} is currently ON AIR and cannot be removed while playing. In Auto Mode, call execute_graphic_action with action="stop" first if it should be taken off air.`,
							activeSuggestions: getActiveSuggestionsSummary(),
							state: getGraphicsStateSummary(),
						})
					)
				}

				const removed = aiAudioStore.triggerFadeRemoveSuggestion(input.suggestionId)
				if (removed) {
					runInAction(() => {
						this.lastToolActivity = `Removing suggestion ${input.suggestionId}`
					})
				}
				return backgroundResult(
					JSON.stringify({
						status: removed ? 'fading_out' : 'not_found',
						activeSuggestions: getActiveSuggestionsSummary(),
						state: getGraphicsStateSummary(),
					})
				)
			},
		})

		const listActiveSuggestionsTool = tool({
			name: 'list_active_suggestions',
			description:
				'List all currently active AI suggestions, bookmarked graphics, and on-air graphics with their onAirDurationSeconds.',
			parameters: z.object({}),
			execute: async () => {
				const state = getGraphicsStateSummary()
				console.log('[LLM Tool] list_active_suggestions', state)
				return JSON.stringify(state)
			},
		})

		return [
			suggestGraphicTool,
			renewOrUpdateSuggestionTool,
			executeGraphicActionTool,
			removeSuggestionTool,
			listActiveSuggestionsTool,
		]
	}

	public buildLanguageInstruction(languageCodes: string[] = appSettingsStore.selectedLanguages): string {
		if (!languageCodes || languageCodes.length === 0) {
			return 'LANGUAGE CONFIGURATION: Auto-detect the spoken language. Populate graphic text fields (dataJson) and suggestion reasons in the same language currently being spoken, unless a graphic schema property explicitly requires otherwise.'
		}

		const resolved = languageCodes.map((code) => {
			const found = AVAILABLE_LANGUAGES.find((l) => l.code === code)
			return found ? `${found.name} (${found.code})` : code
		})

		if (languageCodes.length === 1) {
			const langObj = AVAILABLE_LANGUAGES.find((l) => l.code === languageCodes[0])
			const langName = langObj ? langObj.name : languageCodes[0]
			return `LANGUAGE CONFIGURATION: Relevant spoken language is ${resolved[0]}. Interpret incoming speech in ${resolved[0]} and always populate graphic text fields (dataJson) and suggestion reasons in ${langName}, unless a graphic schema property explicitly requires otherwise.`
		}

		return `LANGUAGE CONFIGURATION: Relevant spoken languages are ${resolved.join(', ')}. Expect speech in these languages (ignore unrelated background languages or noise). Populate graphic text fields (dataJson) and suggestion reasons in whichever of these languages is currently being spoken, unless a graphic schema property explicitly requires otherwise.`
	}

	public buildTranscriptionConfig(languageCodes: string[] = appSettingsStore.selectedLanguages): {
		model: 'gpt-4o-mini-transcribe'
		language?: string
		prompt?: string
	} {
		const config: {
			model: 'gpt-4o-mini-transcribe'
			language?: string
			prompt?: string
		} = {
			model: 'gpt-4o-mini-transcribe',
		}

		if (languageCodes.length === 1) {
			config.language = languageCodes[0]
		}

		if (languageCodes.length > 0) {
			const names = languageCodes.map((code) => {
				const found = AVAILABLE_LANGUAGES.find((l) => l.code === code)
				return found ? `${found.name} (${found.nativeName})` : code
			})
			config.prompt = `Expected spoken language(s): ${names.join(', ')}.`
		}

		return config
	}

	public buildSystemInstructions(
		graphics: ScannedGraphicInfo[],
		eagerness: EagernessLevel,
		languageCodes: string[] = appSettingsStore.selectedLanguages,
		customInstructions: string = appSettingsStore.customInstructions,
		autoMode: boolean = appSettingsStore.autoMode
	): string {
		const eagernessText = (EAGERNESS_INSTRUCTIONS[eagerness] || EAGERNESS_INSTRUCTIONS[3]).replaceAll(
			/[\r\n\t ]+/g,
			' '
		)
		const languageText = this.buildLanguageInstruction(languageCodes)
		const trimmedCustomInstructions = customInstructions.trim()

		const graphicsCatalog =
			graphics.length === 0
				? 'No OGraf graphics are currently enabled for this session.'
				: graphics.map((g) => formatGraphicForInstructions(g)).join('\n')

		const autoModeInstructions = autoMode
			? [
					'OPERATING MODE: AUTO MODE (COLLABORATIVE WITH HUMAN OPERATOR)',
					'- You are operating in AUTO MODE alongside the human operator. Both you and the human operator can trigger graphics at any time.',
					'- In Full Auto Mode, you can choose to EITHER:',
					'  1) Just suggest a graphic (`suggest_graphic` with `autoExecuteAction: null`) when you want to stage an option for the operator or when a mention is secondary/speculative.',
					'  2) Both suggest AND immediately trigger an action on air (`suggest_graphic` with `autoExecuteAction: "play"`, or calling `execute_graphic_action`) when the spoken audio clearly calls for putting a graphic on air, updating it, firing a custom action, or stopping it.',
					'- Collaborating across Suggestions (`sug_...`) and Bookmarks (`bmk_...`):',
					'  - You can call `execute_graphic_action` on any card in `activeSuggestions` OR `bookmarks` (never delete bookmarks). If a bookmarked graphic matches what is being said, you can play, update, stop, or trigger custom actions on that bookmark directly.',
					'- On-Air Awareness & Duration Management (`onAirGraphics` & `onAirDurationSeconds`):',
					'  - Always check `state.onAirGraphics` (and `onAirDurationSeconds`) before acting so you know what is currently on screen and for how long.',
					'  - Transient identifying graphics (such as lower-thirds, name supers, or location straps) should normally remain on air for about 8 to 15 seconds and then be taken off air using `execute_graphic_action(itemId, action: "stop")`.',
					'  - Topic/contextual graphics or graphics with custom actions can stay on air while actively discussed; use `execute_graphic_action` with `action: "update"` or `<customActionId>` as new details are spoken, and `"stop"` when the topic concludes.',
					'- Respecting the Human Operator:',
					'  - If the human operator manually stops, clears, or dismisses a graphic (reported in `[Operator Action]` events or `recentOperatorOverrides`), treat that as an operator override and do NOT immediately re-play that same graphic unless the conversation explicitly returns to it later.',
					'  - If the human operator manually plays a graphic, wait at least 8 seconds before considering stopping it.',
				]
			: [
					'OPERATING MODE: SUGGEST-ONLY MODE (MANUAL OPERATOR TRIGGERING)',
					'- Auto Mode is currently OFF. Only add, renew/update, or remove graphic suggestions in the GUI (`autoExecuteAction` must be `null`). The human operator will click Play/Update/Stop manually.',
				]

		const initialBookmarks = getBookmarksSummary()
		const initialOnAir = getOnAirGraphicsSummary()

		return [
			'You are an AI live-production graphics assistant listening to a continuous live broadcast/production audio stream.',
			'The audio stream is fed continuously in short real-time chunks (even mid-sentence while the speaker is still talking).',
			'Your job is to listen silently and call your function tools IMMEDIATELY as soon as a graphic opportunity is heard — NEVER wait for the speaker to finish a sentence or pause.',
			'IMPORTANT: Do NOT converse with the speaker or generate conversational text responses. If a short audio chunk or heartbeat does not warrant any graphic action yet, simply finish your turn with empty text.',
			'',
			eagernessText,
			languageText,
			'',
			...autoModeInstructions,
			...(trimmedCustomInstructions
				? ['', 'USER CUSTOM INSTRUCTIONS (HIGHEST PRIORITY):', trimmedCustomInstructions]
				: []),
			'',
			'GUIDELINES FOR SUGGESTIONS & ACTIONS:',
			'1. Act IMMEDIATELY on partial/continuous speech: As soon as you hear a location, person, topic, race/map position, or event that matches an available OGraf graphic, call `suggest_graphic` (or `execute_graphic_action` if an existing suggestion/bookmark already matches) right away.',
			'   Example: As soon as you hear "reporting today from Kabul...", immediately suggest the locator/lower-third graphic (e.g. {"text": "Kabul", "live": true}) — and in Full Auto Mode, set `autoExecuteAction: "play"` if it should go straight on air.',
			'2. Always provide a sensible `ttlSeconds` (e.g., 15 to 90 seconds) indicating how long you estimate the suggestion will remain relevant (better to lean towards a shorter TTL if unsure).',
			'3. ONLY update/renew when it is the EXACT SAME graphic instance: Do NOT routine-renew suggestions on every audio chunk, and NEVER overwrite an existing suggestion with a different person, location, or subject. Only call `renew_or_update_suggestion` when correcting a spelling/transcription mistake or adding newly spoken detail to the exact same graphic subject (e.g., adding a title/subline to the same person just suggested, optionally with `autoExecuteAction: "update"` if that card is on air in Auto Mode). For any new person, place, topic, or distinct variation — even if it uses the same `graphicId` — ALWAYS call `suggest_graphic` to add another graphic to the list.',
			'4. If the speaker moves on to a completely different topic or explicitly contradicts an earlier suggestion, call `remove_suggestion` on outdated suggestions (if a graphic is currently ON AIR in Auto Mode, stop it first with `execute_graphic_action(action="stop")`).',
			'5. Choose which actions to expose on each suggestion card via `exposedActions` and `exposedCustomActions`:',
			'   - Include `"play"` for graphics that should be played/taken on air.',
			'   - Include `"update"` if the graphic is meant to update data on an already-playing graphic.',
			'   - Include `"pause"` (which stops/takes out the graphic) when relevant.',
			'   - Include `"data-entry"` when the user might want to tweak or complete the graphic data using an ograf-form.',
			'   - If the graphic manifest defines `customActions`, you can expose relevant ones in `exposedCustomActions` (with `withForm: true` if it has a schema the user might adjust, or `withForm: false` for a direct one-click trigger, along with a suggested `payloadJson`).',
			...(initialBookmarks.length > 0
				? ['', 'CURRENT BOOKMARKED GRAPHICS IN GUI:', JSON.stringify(initialBookmarks)]
				: []),
			...(initialOnAir.length > 0 ? ['', 'CURRENTLY ON-AIR GRAPHICS:', JSON.stringify(initialOnAir)] : []),
			'',
			'AVAILABLE OGRAF GRAPHICS ON SERVER:',
			graphicsCatalog,
		].join('\n')
	}

	private createAgent(graphics: ScannedGraphicInfo[], eagerness: EagernessLevel): RealtimeAgent {
		const enabledGraphics = this.getEnabledGraphics(graphics)
		const instructions = this.buildSystemInstructions(
			enabledGraphics,
			eagerness,
			appSettingsStore.selectedLanguages,
			appSettingsStore.customInstructions,
			appSettingsStore.autoMode
		)
		console.debug('setup agent', instructions)
		return new RealtimeAgent({
			name: 'OGrafLiveAssistant',
			instructions,
			tools: this.buildTools(),
		})
	}

	public startCapturingTranscript(onUpdate: (capturedText: string) => void) {
		if (this.captureFinalizeTimeout) {
			clearTimeout(this.captureFinalizeTimeout)
			this.captureFinalizeTimeout = null
		}
		if (this.browserRecognition) {
			try {
				this.browserRecognition.stop()
			} catch {
				// ignore
			}
			this.browserRecognition = null
		}

		this.isCapturingTranscript = true
		this.isAwaitingFinalCapturedChunk = false
		this.capturedCommittedSegments = []
		this.capturedCurrentDelta = ''
		this.onCapturedTranscriptUpdate = onUpdate

		if (this.status === 'connected' && this.session) {
			return
		}

		const SpeechRecognitionCtor =
			typeof window !== 'undefined'
				? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
				: undefined

		if (SpeechRecognitionCtor) {
			try {
				const recognition = new SpeechRecognitionCtor()
				recognition.continuous = true
				recognition.interimResults = true
				if (appSettingsStore.selectedLanguages.length > 0) {
					recognition.lang = appSettingsStore.selectedLanguages[0]
				}
				recognition.onresult = (event: any) => {
					const finals: string[] = []
					let interim = ''
					for (let i = 0; i < event.results.length; i++) {
						const res = event.results[i]
						const text = res[0]?.transcript || ''
						if (res.isFinal) {
							finals.push(text.trim())
						} else {
							interim += text
						}
					}
					this.capturedCommittedSegments = finals.filter(Boolean)
					this.capturedCurrentDelta = interim
					this.emitCapturedTranscript()
				}
				recognition.onerror = (err: any) => {
					console.debug('SpeechRecognition error:', err)
				}
				recognition.start()
				this.browserRecognition = recognition
			} catch (e) {
				console.warn('Could not start browser SpeechRecognition:', e)
			}
		} else {
			aiAudioStore.showNotification('Start Listening first to capture live transcript', 'info')
		}
	}

	public stopCapturingTranscript() {
		if (!this.isCapturingTranscript) return
		this.isCapturingTranscript = false

		if (this.browserRecognition) {
			try {
				this.browserRecognition.stop()
			} catch {
				// ignore
			}
			this.browserRecognition = null
		}

		if (this.status === 'connected' && this.session && !this.isMuted) {
			this.isAwaitingFinalCapturedChunk = true
			try {
				this.session.transport.sendEvent({
					type: 'input_audio_buffer.commit',
				})
			} catch (e) {
				console.debug('Commit on stopCapturingTranscript skipped:', e)
			}

			if (this.captureFinalizeTimeout) {
				clearTimeout(this.captureFinalizeTimeout)
			}
			this.captureFinalizeTimeout = setTimeout(() => {
				this.finishCapturingTranscript()
			}, 1800)
		} else {
			this.finishCapturingTranscript()
		}
	}

	private emitCapturedTranscript() {
		if (!this.onCapturedTranscriptUpdate) return
		const combined = [...this.capturedCommittedSegments, this.capturedCurrentDelta.trim()].filter(Boolean).join(' ')
		this.onCapturedTranscriptUpdate(combined)
	}

	private finishCapturingTranscript() {
		if (this.captureFinalizeTimeout) {
			clearTimeout(this.captureFinalizeTimeout)
			this.captureFinalizeTimeout = null
		}
		this.isAwaitingFinalCapturedChunk = false
	}

	public async updateEagernessLive(newEagerness: EagernessLevel = appSettingsStore.eagerness) {
		if (!this.session || this.status !== 'connected') return
		try {
			const enabledGraphics = this.getEnabledGraphics(this.scannedGraphics)
			const instructions = this.buildSystemInstructions(
				enabledGraphics,
				newEagerness,
				appSettingsStore.selectedLanguages,
				appSettingsStore.customInstructions,
				appSettingsStore.autoMode
			)
			const updatedAgent = this.createAgent(this.scannedGraphics, newEagerness)
			await this.session.updateAgent(updatedAgent)

			try {
				console.debug('Sending live session.update with new instructions', instructions)
				this.session.transport.sendEvent({
					type: 'session.update',
					session: {
						type: 'realtime',
						instructions,
						audio: {
							input: {
								transcription: this.buildTranscriptionConfig(),
							},
						},
					},
				})
			} catch (txErr) {
				console.debug('Could not send live session.update:', txErr)
			}

			console.log('[LLM Session] Updated instructions', {
				eagerness: newEagerness,
				autoMode: appSettingsStore.autoMode,
				languages: appSettingsStore.selectedLanguages,
				customInstructions: appSettingsStore.customInstructions,
				enabledGraphicsCount: enabledGraphics.length,
			})

			const enabledCount = enabledGraphics.length
			const langLabel =
				appSettingsStore.selectedLanguages.length > 0
					? appSettingsStore.selectedLanguages.map((c) => c.toUpperCase()).join('/')
					: 'Auto'
			const modeLabel = appSettingsStore.autoMode ? 'Auto Mode' : 'Suggest Only'
			runInAction(() => {
				this.lastToolActivity = `Updated LLM instructions (${enabledCount}/${this.scannedGraphics.length} graphics, ${modeLabel}, ${EAGERNESS_LABELS[newEagerness]}, ${langLabel})`
			})
		} catch (e) {
			console.error('Failed to live-update agent on RealtimeSession:', e)
		}
	}

	public async saveAndApplyCustomInstructions(instructionsText: string) {
		appSettingsStore.setCustomInstructions(instructionsText)
		if (!this.session || this.status !== 'connected') return

		await this.updateEagernessLive()

		const trimmed = instructionsText.trim()
		try {
			this.session.transport.sendEvent({
				type: 'conversation.item.create',
				item: {
					type: 'message',
					role: 'user',
					content: [
						{
							type: 'input_text',
							text: trimmed
								? `[SYSTEM INSTRUCTION UPDATE FROM OPERATOR — FOLLOW THESE CUSTOM INSTRUCTIONS NOW AND FOR ALL UPCOMING AUDIO]:\n${trimmed}`
								: '[SYSTEM INSTRUCTION UPDATE FROM OPERATOR]: Custom operator instructions have been cleared. Follow the standard system instructions.',
						},
					],
				},
			})
			if (this.session.transport.requestResponse) {
				this.session.transport.requestResponse()
			} else {
				this.session.transport.sendEvent({
					type: 'response.create',
				})
			}
		} catch (e) {
			console.debug('Could not send instruction update message to session:', e)
		}
	}

	private async mintEphemeralKeyOrFallback(
		rawApiKey: string,
		model: string
	): Promise<{ apiKey: string; useInsecureApiKey: boolean }> {
		const trimmed = rawApiKey.trim()
		if (trimmed.startsWith('ek_')) {
			return { apiKey: trimmed, useInsecureApiKey: false }
		}

		try {
			const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${trimmed}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					session: {
						type: 'realtime',
						model,
					},
				}),
			})

			if (response.ok) {
				const data = (await response.json()) as {
					value?: string
					client_secret?: { value?: string }
				}
				const ephemeral = data?.value || data?.client_secret?.value
				if (ephemeral) {
					return { apiKey: ephemeral, useInsecureApiKey: false }
				}
			}
		} catch (e) {
			console.warn('Could not mint ephemeral key via /v1/realtime/client_secrets, falling back to direct key:', e)
		}

		return { apiKey: trimmed, useInsecureApiKey: true }
	}

	/**
	 * Sends a raw client event over the WebRTC dataChannel directly when available,
	 * bypassing ResponseCreateSequencer so manual/periodic response.create calls cannot
	 * deadlock the SDK sequencer if they race with server_vad.
	 */
	private sendRawRealtimeEvent(event: Record<string, unknown>) {
		if (!this.session) return
		const transport = this.session.transport as any
		const dc: RTCDataChannel | undefined = transport?.connectionState?.dataChannel
		if (dc && dc.readyState === 'open') {
			dc.send(JSON.stringify(event))
			return
		}
		this.session.transport.sendEvent(event as any)
	}

	/**
	 * Prunes older conversation items from both the OpenAI Realtime server session and the local SDK history
	 * so accumulated audio tokens and empty assistant turns don't exhaust the context window or slow down responses.
	 */
	private pruneConversationHistory(maxItems: number = MAX_CONVERSATION_HISTORY_ITEMS) {
		if (!this.session || this.status !== 'connected') return
		try {
			while (this.serverConversationItemIds.length > maxItems) {
				const oldestId = this.serverConversationItemIds.shift()
				if (oldestId) {
					this.sendRawRealtimeEvent({
						type: 'conversation.item.delete',
						item_id: oldestId,
					})
				}
			}
			if (this.session.history.length > maxItems) {
				this.session.updateHistory((hist) => (hist.length > maxItems ? hist.slice(-maxItems) : hist))
			}
		} catch (e) {
			console.debug('Could not prune conversation history:', e)
		}
	}

	/**
	 * Forces the OpenAI Realtime server to commit the currently buffered input audio slice
	 * and trigger a model response immediately during long nonstop speech without pauses.
	 */
	private flushContinuousAudioChunk() {
		if (!this.session || this.status !== 'connected' || this.isMuted) return
		if (this.isResponseInProgress) {
			if (Date.now() - this.responseStartedAtMs > RESPONSE_STUCK_TIMEOUT_MS) {
				this.isResponseInProgress = false
			} else {
				return
			}
		}
		try {
			this.sendRawRealtimeEvent({
				type: 'input_audio_buffer.commit',
			})
			this.sendRawRealtimeEvent({
				type: 'response.create',
			})
		} catch (e) {
			console.debug('Continuous audio chunk commit skipped:', e)
		}
	}

	private readAnalyserLevel(analyser: AnalyserNode, dataArray: Uint8Array<ArrayBuffer>): number {
		analyser.getByteFrequencyData(dataArray)
		let sum = 0
		for (let i = 0; i < dataArray.length; i++) {
			sum += dataArray[i]
		}
		const avg = sum / dataArray.length
		return Math.min(100, Math.round((avg / 128) * 100))
	}

	private setupAudioLevelMeter(_stream: MediaStream) {
		this.stopAudioLevelMeter()
		try {
			const sysDataArray = this.sysAnalyser ? new Uint8Array(this.sysAnalyser.frequencyBinCount) : null
			const micDataArray = this.micAnalyser ? new Uint8Array(this.micAnalyser.frequencyBinCount) : null

			const pollIntervalMs = 33
			this.levelInterval = setInterval(() => {
				let normalized = 0

				if (isDualAudioSource()) {
					const micLevel =
						this.isMicMuted || !this.micAnalyser || !micDataArray
							? 0
							: this.readAnalyserLevel(this.micAnalyser, micDataArray)

					if (appSettingsStore.autoMuteSystemOnMic && !this.isMicMuted) {
						if (micLevel >= 6) {
							this.autoMuteHoldRemainingMs = 800
						} else if (this.autoMuteHoldRemainingMs > 0) {
							this.autoMuteHoldRemainingMs = Math.max(0, this.autoMuteHoldRemainingMs - pollIntervalMs)
						}
					} else {
						this.autoMuteHoldRemainingMs = 0
					}

					const autoMuted = appSettingsStore.autoMuteSystemOnMic && !this.isMicMuted && this.autoMuteHoldRemainingMs > 0
					const effectiveSysMuted = this.isSystemMuted || autoMuted

					if (this.sysGainNode) {
						const targetSysGain = effectiveSysMuted ? 0 : 1
						if (this.sysGainNode.gain.value !== targetSysGain) {
							this.sysGainNode.gain.value = targetSysGain
						}
					}

					const sysLevel =
						effectiveSysMuted || !this.sysAnalyser || !sysDataArray
							? 0
							: this.readAnalyserLevel(this.sysAnalyser, sysDataArray)
					normalized = Math.max(sysLevel, micLevel)
					runInAction(() => {
						this.isSystemAutoMuted = autoMuted
						this.systemAudioLevel = sysLevel
						this.micAudioLevel = micLevel
						this.audioLevel = normalized
					})
				} else {
					this.autoMuteHoldRemainingMs = 0
					if (this.sysGainNode) {
						const targetSysGain = this.isSystemMuted ? 0 : 1
						if (this.sysGainNode.gain.value !== targetSysGain) {
							this.sysGainNode.gain.value = targetSysGain
						}
					}
					const sysLevel =
						this.isSystemMuted || !this.sysAnalyser || !sysDataArray
							? 0
							: this.readAnalyserLevel(this.sysAnalyser, sysDataArray)
					normalized = sysLevel
					runInAction(() => {
						this.isSystemAutoMuted = false
						this.systemAudioLevel = sysLevel
						this.micAudioLevel = 0
						this.audioLevel = sysLevel
					})
				}

				if (this.isMuted) {
					this.uncommittedSpeechMs = 0
					return
				}

				if (this.status === 'connected' && this.session) {
					// Only count nonstop speech when server_vad has actively detected speech
					// (normal pauses >= 250ms are already committed & responded to automatically by server_vad).
					if (this.isServerSpeechActive && normalized >= 4) {
						this.uncommittedSpeechMs += pollIntervalMs
						if (this.uncommittedSpeechMs >= CONTINUOUS_AUDIO_COMMIT_INTERVAL_MS) {
							this.uncommittedSpeechMs = 0
							this.isServerSpeechActive = false
							this.flushContinuousAudioChunk()
						}
					} else if (!this.isServerSpeechActive) {
						this.uncommittedSpeechMs = 0
					}
				}
			}, pollIntervalMs)
		} catch (e) {
			console.warn('Failed to initialize audio level meter:', e)
		}
	}

	private stopAudioLevelMeter() {
		if (this.levelInterval) {
			clearInterval(this.levelInterval)
			this.levelInterval = null
		}
		if (this.audioContext) {
			void this.audioContext.close().catch(() => {})
			this.audioContext = null
		}
		this.isServerSpeechActive = false
		this.uncommittedSpeechMs = 0
		this.autoMuteHoldRemainingMs = 0
		runInAction(() => {
			this.isSystemAutoMuted = false
			this.audioLevel = 0
			this.systemAudioLevel = 0
			this.micAudioLevel = 0
		})
	}

	private getLiveSystemAudioTracks(displayStream: MediaStream | undefined): MediaStreamTrack[] {
		if (!displayStream) return []
		return displayStream.getAudioTracks().filter((t) => t.readyState === 'live')
	}

	private async acquireMediaStreamForSource(sourceId: string, channelIndex: 1 | 2): Promise<MediaStream | null> {
		if (sourceId === PHONE_IN_SOURCE_ID || sourceId === NONE_AUDIO_SOURCE_ID) {
			return null
		}

		if (sourceId === SYSTEM_AUDIO_SOURCE_ID) {
			// Check if we already have a live system audio stream cached for this channel
			let cachedStream = this.cachedSystemDisplayStreams.get(channelIndex)
			let liveTracks = this.getLiveSystemAudioTracks(cachedStream)

			// If not on this channel, check if the other channel has an unused live system audio stream
			if (liveTracks.length === 0) {
				const otherChannel: 1 | 2 = channelIndex === 1 ? 2 : 1
				const otherSourceId =
					otherChannel === 1 ? appSettingsStore.selectedMicDeviceId : appSettingsStore.selectedSecondaryMicDeviceId
				if (otherSourceId !== SYSTEM_AUDIO_SOURCE_ID) {
					const otherStream = this.cachedSystemDisplayStreams.get(otherChannel)
					const otherLiveTracks = this.getLiveSystemAudioTracks(otherStream)
					if (otherStream && otherLiveTracks.length > 0) {
						this.cachedSystemDisplayStreams.delete(otherChannel)
						this.cachedSystemDisplayStreams.set(channelIndex, otherStream)
						cachedStream = otherStream
						liveTracks = otherLiveTracks
					}
				}
			}

			if (cachedStream && liveTracks.length > 0) {
				for (const track of liveTracks) {
					track.enabled = true
				}
				return new MediaStream(liveTracks)
			}

			if (!navigator.mediaDevices?.getDisplayMedia) {
				throw new Error('System audio capture (getDisplayMedia) is not supported in this browser.')
			}

			const displayStream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: {
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false,
				} as MediaTrackConstraints,
			})

			const sysAudioTracks = displayStream.getAudioTracks()
			if (sysAudioTracks.length === 0) {
				for (const t of displayStream.getTracks()) {
					t.stop()
				}
				throw new Error(
					'No system audio track was shared. Please make sure "Also share system audio" is enabled in the browser prompt.'
				)
			}

			this.cachedSystemDisplayStreams.set(channelIndex, displayStream)

			// Clean up cache and stop session automatically if user clicks "Stop sharing" in browser UI
			sysAudioTracks[0].addEventListener('ended', () => {
				for (const [ch, stream] of this.cachedSystemDisplayStreams.entries()) {
					if (stream === displayStream) {
						this.cachedSystemDisplayStreams.delete(ch)
					}
				}
				for (const t of displayStream.getTracks()) {
					try {
						t.stop()
					} catch {
						// ignore
					}
				}
				if ((this.status === 'connected' || this.status === 'connecting') && isAnySystemAudioSelected()) {
					this.stopSession()
				}
			})

			return new MediaStream(sysAudioTracks)
		}

		// Standard microphone input (default '' or specific deviceId)
		const audioConstraints: MediaTrackConstraints | boolean = sourceId ? { deviceId: { exact: sourceId } } : true
		const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
		this.rawCaptureStreams.push(stream)
		void this.refreshMicDevices()
		return stream
	}

	private async acquireInputAudioStream(): Promise<MediaStream> {
		const source1 = appSettingsStore.selectedMicDeviceId
		const source2 = appSettingsStore.selectedSecondaryMicDeviceId
		const hasSource2 = source2 !== NONE_AUDIO_SOURCE_ID

		// Acquire browser media streams (getDisplayMedia / getUserMedia) first while user gesture is active
		const stream1 = await this.acquireMediaStreamForSource(source1, 1)
		const stream2 = hasSource2 ? await this.acquireMediaStreamForSource(source2, 2) : null

		const AudioCtx =
			window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
		const mixCtx = new AudioCtx()
		this.mixerAudioContext = mixCtx
		const destination = mixCtx.createMediaStreamDestination()

		// Keep destination.stream continuously emitting frames even between phone calls or when muted
		const keepAlive = mixCtx.createConstantSource()
		keepAlive.offset.value = 0
		keepAlive.connect(destination)
		keepAlive.start()
		this.keepAliveOscillator = keepAlive

		// Channel 1 (Audio Source 1)
		const sysGain = mixCtx.createGain()
		sysGain.gain.value = this.isSystemMuted ? 0 : 1
		const sysAnalyser = mixCtx.createAnalyser()
		sysAnalyser.fftSize = 256
		sysAnalyser.smoothingTimeConstant = 0.25
		sysGain.connect(sysAnalyser)
		sysAnalyser.connect(destination)
		this.sysGainNode = sysGain
		this.sysAnalyser = sysAnalyser

		if (stream1) {
			this.sysRawStream = stream1
			if (stream1.getAudioTracks().length > 0) {
				const src1Node = mixCtx.createMediaStreamSource(stream1)
				src1Node.connect(sysGain)
			}
		}

		// Channel 2 (Audio Source 2, if active)
		let micGain: GainNode | null = null
		if (hasSource2) {
			micGain = mixCtx.createGain()
			micGain.gain.value = this.isMicMuted ? 0 : 1
			const micAnalyser = mixCtx.createAnalyser()
			micAnalyser.fftSize = 256
			micAnalyser.smoothingTimeConstant = 0.25
			micGain.connect(micAnalyser)
			micAnalyser.connect(destination)
			this.micGainNode = micGain
			this.micAnalyser = micAnalyser

			if (stream2) {
				this.micRawStream = stream2
				if (stream2.getAudioTracks().length > 0) {
					const src2Node = mixCtx.createMediaStreamSource(stream2)
					src2Node.connect(micGain)
					this.micSourceNode = src2Node
				}
			}
		}

		// Connect 46elks Phone-In if selected on Source 1 and/or Source 2
		if (source1 === PHONE_IN_SOURCE_ID || (hasSource2 && source2 === PHONE_IN_SOURCE_ID)) {
			const setupResult = await fetchAndSetupElksNumbers({ configureRouting: true })
			runInAction(() => {
				this.elksVoiceNumbers = setupResult.voiceNumbers
				this.elksError = null
			})

			const webrtcNumber = setupResult.webrtcNumber?.number || appSettingsStore.elksWebrtcNumber.trim()
			const webrtcSecret = setupResult.webrtcNumber?.secret || appSettingsStore.elksWebrtcSecret.trim()
			if (!webrtcNumber) {
				throw new Error(
					'No 46elks WebRTC number found on your account. Please add a WebRTC number to your 46elks account.'
				)
			}
			if (!webrtcSecret) {
				throw new Error(
					'No 46elks WebRTC secret found on your account. Please check your 46elks API credentials or enter your WebRTC number and secret in Settings.'
				)
			}

			const phoneTargetGain = mixCtx.createGain()
			phoneTargetGain.gain.value = 1
			if (source1 === PHONE_IN_SOURCE_ID) {
				phoneTargetGain.connect(sysGain)
			}
			if (hasSource2 && source2 === PHONE_IN_SOURCE_ID && micGain) {
				phoneTargetGain.connect(micGain)
			}

			const elksSession = new ElksWebrtcPhoneSession(mixCtx, phoneTargetGain, webrtcNumber, webrtcSecret, {
				onStatusChange: (callStatus, detail) => {
					runInAction(() => {
						this.elksCallStatus = callStatus
						if (detail && callStatus === 'error') {
							this.elksError = detail
							this.lastToolActivity = detail
						} else if (callStatus === 'waiting') {
							const dialNum = appSettingsStore.elksSelectedPhoneNumber || webrtcNumber
							this.lastToolActivity = `Waiting for call on ${dialNum}...`
						} else if (callStatus === 'in_call') {
							this.lastToolActivity = `Phone-in call active (${this.elksActiveCaller || 'caller'})`
						}
					})
				},
				onCallerChange: (caller) => {
					runInAction(() => {
						this.elksActiveCaller = caller
					})
				},
			})
			this.elksPhoneSession = elksSession
			elksSession.start()
		}

		this.applyMuteStates()
		return destination.stream
	}

	private async connectRealtimeSessionWithStream(
		stream: MediaStream,
		graphics: ScannedGraphicInfo[],
		rawApiKey: string
	): Promise<void> {
		let abortedByFatalError = false

		this.isResponseInProgress = false
		this.responseStartedAtMs = 0
		this.serverConversationItemIds = []

		const model = appSettingsStore.openAiModel.trim() || 'gpt-realtime'
		const { apiKey, useInsecureApiKey } = await this.mintEphemeralKeyOrFallback(rawApiKey, model)

		if (!this.dummyAudioElement) {
			this.dummyAudioElement = document.createElement('audio')
			this.dummyAudioElement.muted = true
		}

		const transport = new OpenAIRealtimeWebRTC({
			mediaStream: stream,
			audioElement: this.dummyAudioElement,
			useInsecureApiKey,
		})

		const agent = this.createAgent(graphics, appSettingsStore.eagerness)

		const session = new RealtimeSession(agent, {
			transport,
			model,
			config: {
				outputModalities: ['text'],
				audio: {
					input: {
						noiseReduction: {
							type: 'near_field',
						},
						transcription: this.buildTranscriptionConfig(),
						turnDetection: {
							type: 'server_vad',
							threshold: 0.5,
							prefixPaddingMs: 200,
							silenceDurationMs: 250,
							createResponse: true,
							interruptResponse: false,
						},
					},
				},
			},
		})

		this.session = session
		;(transport as any).on?.('connection_change', (connStatus: string) => {
			if (
				connStatus === 'disconnected' &&
				this.session === session &&
				this.status === 'connected' &&
				!abortedByFatalError
			) {
				void this.reconnectRealtimeTransport('WebRTC connection closed')
			}
		})

		session.on('error', (errEvent) => {
			const errObj = (errEvent as any)?.error || errEvent
			const innerErr = errObj?.error || errObj
			const code = innerErr?.code || errObj?.code || ''
			const errType = innerErr?.type || errObj?.type || ''
			const msg =
				innerErr instanceof Error
					? innerErr.message
					: typeof innerErr?.message === 'string'
						? innerErr.message
						: typeof errObj?.message === 'string'
							? errObj.message
							: JSON.stringify(errObj)

			// Ignore benign race notices if a periodic commit coincides with a server VAD commit
			if (
				code === 'input_audio_buffer_commit_empty' ||
				code === 'conversation_already_has_active_response' ||
				code === 'item_delete_invalid_item_id' ||
				msg.includes('input_audio_buffer_commit_empty') ||
				msg.includes('buffer too small') ||
				msg.includes('does not exist')
			) {
				return
			}

			const lowerMsg = msg.toLowerCase()
			if (
				code === 'session_expired' ||
				lowerMsg.includes('session_expired') ||
				lowerMsg.includes('maximum duration') ||
				lowerMsg.includes('session has expired')
			) {
				console.warn('[LLM Session] Realtime session expired, reconnecting automatically...', msg)
				void this.reconnectRealtimeTransport('Session expired')
				return
			}

			console.error('RealtimeSession error:', errEvent)

			const isInstructionsLimitError =
				lowerMsg.includes('instructions cannot be longer') ||
				(lowerMsg.includes('instructions') && lowerMsg.includes('tokens')) ||
				(errType === 'invalid_request_error' && lowerMsg.includes('tokens'))

			if (isInstructionsLimitError) {
				abortedByFatalError = true
				this.stopSession({ preserveError: true })
				runInAction(() => {
					this.status = 'error'
					this.errorMessage = msg
					this.lastToolActivity = `Error: ${msg}`
				})
				aiAudioStore.showError(msg)
				this.openGraphicsModal(msg)
				return
			}

			runInAction(() => {
				this.lastToolActivity = `Notice: ${msg}`
			})
		})

		session.on('transport_event', (ev: any) => {
			if (ev?.type === 'input_audio_buffer.speech_started') {
				this.isServerSpeechActive = true
			} else if (ev?.type === 'input_audio_buffer.speech_stopped') {
				this.isServerSpeechActive = false
				this.uncommittedSpeechMs = 0
			} else if (ev?.type === 'input_audio_buffer.committed') {
				this.uncommittedSpeechMs = 0
			} else if (
				(ev?.type === 'conversation.item.added' ||
					ev?.type === 'conversation.item.created' ||
					ev?.type === 'response.output_item.done') &&
				typeof ev.item?.id === 'string'
			) {
				if (!this.serverConversationItemIds.includes(ev.item.id)) {
					this.serverConversationItemIds.push(ev.item.id)
				}
			} else if (ev?.type === 'conversation.item.deleted' && typeof ev.item_id === 'string') {
				this.serverConversationItemIds = this.serverConversationItemIds.filter((id) => id !== ev.item_id)
			} else if (ev?.type === 'response.created') {
				this.isResponseInProgress = true
				this.responseStartedAtMs = Date.now()
			} else if (ev?.type === 'response.done') {
				this.isResponseInProgress = false
				this.lastAiOrOperatorActivityAtMs = Date.now()
				if (ev.response?.status === 'failed') {
					const errDetail = ev.response?.status_details?.error
					const failCode = String(errDetail?.code || '')
					const failMsg = String(errDetail?.message || 'Response failed')
					console.warn('[LLM Session] response.done status=failed:', errDetail || ev.response?.status_details)

					const lowerFail = failMsg.toLowerCase()
					if (
						failCode === 'session_expired' ||
						lowerFail.includes('session_expired') ||
						lowerFail.includes('maximum duration')
					) {
						void this.reconnectRealtimeTransport('Session expired')
						return
					}
					if (
						failCode.includes('context_length') ||
						failCode.includes('token') ||
						lowerFail.includes('context') ||
						lowerFail.includes('token')
					) {
						this.pruneConversationHistory(4)
						return
					}
				}
				this.pruneConversationHistory()
			} else if (ev?.type === 'conversation.item.input_audio_transcription.delta' && typeof ev.delta === 'string') {
				if (ev.delta.trim()) {
					this.lastRecognizedWordsAtMs = Date.now()
				}
				this.currentTranscriptDelta += ev.delta
				const combined = `${this.committedTranscriptHistory} ${this.currentTranscriptDelta}`.trim().slice(-240)
				runInAction(() => {
					this.liveTranscript = combined
				})
				if (this.isCapturingTranscript || this.isAwaitingFinalCapturedChunk) {
					this.capturedCurrentDelta += ev.delta
					this.emitCapturedTranscript()
				}
			} else if (
				ev?.type === 'conversation.item.input_audio_transcription.completed' &&
				typeof ev.transcript === 'string' &&
				ev.transcript.trim()
			) {
				const trimmedTranscript = ev.transcript.trim()
				this.lastRecognizedWordsAtMs = Date.now()
				this.currentTranscriptDelta = ''
				this.committedTranscriptHistory = `${this.committedTranscriptHistory} ${trimmedTranscript}`.trim().slice(-240)
				runInAction(() => {
					this.liveTranscript = this.committedTranscriptHistory
				})
				if (this.isCapturingTranscript || this.isAwaitingFinalCapturedChunk) {
					this.capturedCommittedSegments.push(trimmedTranscript)
					this.capturedCurrentDelta = ''
					this.emitCapturedTranscript()
					if (this.isAwaitingFinalCapturedChunk) {
						this.finishCapturingTranscript()
					}
				}
			}
		})

		await session.connect({ apiKey, model })

		if (abortedByFatalError || this.session !== session) {
			return
		}

		this.applyMuteStates()
		this.startOnAirHeartbeat()

		const enabledCount = this.getEnabledGraphics(graphics).length
		runInAction(() => {
			this.status = 'connected'
			this.lastToolActivity = `Listening (${enabledCount}/${graphics.length} graphics)`
		})
	}

	private async reconnectRealtimeTransport(reason: string): Promise<void> {
		if (this.isReconnectingTransport) return
		const stream = this.mediaStream
		const hasLiveTrack = stream?.getAudioTracks().some((t) => t.readyState === 'live')
		const rawApiKey = appSettingsStore.openAiApiKey.trim()
		if (!stream || !hasLiveTrack || !rawApiKey) {
			return
		}

		this.isReconnectingTransport = true
		try {
			console.log(`[LLM Session] Reconnecting Realtime session (${reason})...`)
			runInAction(() => {
				this.lastToolActivity = `Reconnecting session (${reason})...`
			})
			if (this.session) {
				const oldSession = this.session
				this.session = null
				try {
					oldSession.close()
				} catch {
					// ignore
				}
			}
			await this.connectRealtimeSessionWithStream(stream, this.scannedGraphics, rawApiKey)
			console.log('[LLM Session] Reconnected Realtime session successfully.')
		} catch (e) {
			console.error('Failed to auto-reconnect Realtime session:', e)
		} finally {
			this.isReconnectingTransport = false
		}
	}

	public async startSession(): Promise<void> {
		if (this.status === 'connecting' || this.status === 'scanning') return

		const rawApiKey = appSettingsStore.openAiApiKey.trim()
		if (!rawApiKey) {
			const msg = 'OpenAI API key is not configured. Please enter your OpenAI API key in Settings.'
			runInAction(() => {
				this.status = 'error'
				this.errorMessage = msg
			})
			aiAudioStore.showError(msg)
			return
		}

		this.stopSession()

		try {
			this.committedTranscriptHistory = ''
			this.currentTranscriptDelta = ''
			runInAction(() => {
				this.status = 'scanning'
				this.errorMessage = null
				this.graphicsModalError = null
				this.liveTranscript = ''
			})

			// 1. Acquire audio stream FIRST so browser user-gesture activation is preserved for getDisplayMedia
			const stream = await this.acquireInputAudioStream()
			this.mediaStream = stream
			this.setupAudioLevelMeter(stream)

			// 2. Scan all OGraf graphics & manifests from the server
			const graphics = await serverDataStore.scanAllGraphicsForLLM()
			runInAction(() => {
				this.scannedGraphics = graphics
				this.status = 'connecting'
			})

			// 3. Connect RealtimeSession over WebRTC
			await this.connectRealtimeSessionWithStream(stream, graphics, rawApiKey)
		} catch (e) {
			if (this.status === 'error' && this.errorMessage) return
			console.error('Failed to start RealtimeSession:', e)
			const msg = e instanceof Error ? e.message : String(e)
			this.stopSession({ preserveError: true })
			runInAction(() => {
				this.status = 'error'
				this.errorMessage = msg
			})
			aiAudioStore.showError(`Failed to start AI session: ${msg}`)

			const lowerMsg = msg.toLowerCase()
			if (
				lowerMsg.includes('instructions cannot be longer') ||
				(lowerMsg.includes('instructions') && lowerMsg.includes('tokens'))
			) {
				this.openGraphicsModal(msg)
			}
		}
	}

	public stopSession(options?: { preserveError?: boolean }) {
		this.stopOnAirHeartbeat()
		this.lastRecognizedWordsAtMs = 0
		this.isReconnectingTransport = false
		this.isResponseInProgress = false
		this.responseStartedAtMs = 0
		this.serverConversationItemIds = []
		if (this.elksPhoneSession) {
			this.elksPhoneSession.stop()
			this.elksPhoneSession = null
		}
		if (this.keepAliveOscillator) {
			try {
				this.keepAliveOscillator.stop()
				this.keepAliveOscillator.disconnect()
			} catch {
				// ignore
			}
			this.keepAliveOscillator = null
		}
		runInAction(() => {
			this.elksCallStatus = 'idle'
			this.elksActiveCaller = null
		})
		if (this.session) {
			const oldSession = this.session
			this.session = null
			try {
				oldSession.close()
			} catch (e) {
				console.warn('Error closing RealtimeSession:', e)
			}
		}
		this.stopAudioLevelMeter()
		this.sysGainNode = null
		this.micGainNode = null
		this.sysAnalyser = null
		this.micAnalyser = null
		this.micSourceNode = null
		this.sysRawStream = null
		this.micRawStream = null
		if (this.mixerAudioContext) {
			void this.mixerAudioContext.close().catch(() => {})
			this.mixerAudioContext = null
		}
		if (this.mediaStream) {
			for (const track of this.mediaStream.getTracks()) {
				track.stop()
			}
			this.mediaStream = null
		}
		for (const rawStream of this.rawCaptureStreams) {
			for (const track of rawStream.getTracks()) {
				track.stop()
			}
		}
		this.rawCaptureStreams = []
		// Keep live system audio streams cached so the user does not get a new browser permission prompt
		// when stopping and restarting listening; pause their audio tracks while not listening.
		for (const [ch, displayStream] of this.cachedSystemDisplayStreams.entries()) {
			const liveAudioTracks = this.getLiveSystemAudioTracks(displayStream)
			if (liveAudioTracks.length === 0) {
				this.cachedSystemDisplayStreams.delete(ch)
				for (const track of displayStream.getTracks()) {
					try {
						track.stop()
					} catch {
						// ignore
					}
				}
			} else {
				for (const track of liveAudioTracks) {
					track.enabled = false
				}
			}
		}
		if (!options?.preserveError) {
			runInAction(() => {
				this.status = 'disconnected'
			})
		}
	}

	/**
	 * Reload button action:
	 * Clears the ephemeral AI suggestions list (keeping Bookmarks intact),
	 * re-scans all OGraf manifests from the server, and restarts the LLM session.
	 */
	public async reloadSession(): Promise<void> {
		this.stopSession()
		aiAudioStore.clearAllSuggestions()
		await this.startSession()
	}

	public async switchSecondaryMicLive(deviceId: string) {
		appSettingsStore.selectedSecondaryMicDeviceId = deviceId
		if (
			this.status !== 'connected' ||
			!isDualAudioSource(appSettingsStore.selectedMicDeviceId) ||
			!this.mixerAudioContext ||
			!this.micGainNode
		) {
			return
		}

		try {
			const micConstraints: MediaTrackConstraints | boolean = deviceId ? { deviceId: { exact: deviceId } } : true
			const newMicStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints })
			this.rawCaptureStreams.push(newMicStream)

			if (this.micSourceNode) {
				try {
					this.micSourceNode.disconnect()
				} catch {
					// ignore
				}
				this.micSourceNode = null
			}
			if (this.micRawStream) {
				for (const track of this.micRawStream.getTracks()) {
					track.stop()
				}
			}

			this.micRawStream = newMicStream
			if (newMicStream.getAudioTracks().length > 0 && this.mixerAudioContext && this.micGainNode) {
				const newMicSource = this.mixerAudioContext.createMediaStreamSource(newMicStream)
				newMicSource.connect(this.micGainNode)
				this.micSourceNode = newMicSource
			}
			this.applyMuteStates()
			void this.refreshMicDevices()
		} catch (e) {
			console.error('Failed to switch secondary microphone live:', e)
			aiAudioStore.showError(`Failed to switch microphone: ${e instanceof Error ? e.message : String(e)}`)
		}
	}

	public setSystemMuted(muted: boolean) {
		this.isSystemMuted = muted
		this.applyMuteStates()
	}

	public setMicMuted(muted: boolean) {
		this.isMicMuted = muted
		this.applyMuteStates()
	}

	public setMuted(muted: boolean) {
		if (isDualAudioSource()) {
			this.isSystemMuted = muted
			this.isMicMuted = muted
		} else {
			this.isSystemMuted = muted
		}
		this.applyMuteStates()
	}

	private applyMuteStates() {
		const dual = isDualAudioSource()

		if (!appSettingsStore.autoMuteSystemOnMic || this.isMicMuted || !dual) {
			this.autoMuteHoldRemainingMs = 0
		}
		const autoMuted =
			dual && appSettingsStore.autoMuteSystemOnMic && !this.isMicMuted && this.autoMuteHoldRemainingMs > 0
		const effectiveSysMuted = this.isSystemMuted || autoMuted

		if (this.sysGainNode) {
			this.sysGainNode.gain.value = effectiveSysMuted ? 0 : 1
		}
		if (this.micGainNode) {
			this.micGainNode.gain.value = this.isMicMuted ? 0 : 1
		}
		if (this.sysRawStream) {
			for (const track of this.sysRawStream.getAudioTracks()) {
				track.enabled = !this.isSystemMuted
			}
		}
		if (this.micRawStream) {
			for (const track of this.micRawStream.getAudioTracks()) {
				track.enabled = !this.isMicMuted
			}
		}

		const effectiveAllMuted = dual ? this.isSystemMuted && this.isMicMuted : this.isSystemMuted

		runInAction(() => {
			this.isSystemAutoMuted = autoMuted
			this.isMuted = effectiveAllMuted
			if (effectiveSysMuted) {
				this.systemAudioLevel = 0
			}
			if (this.isMicMuted) {
				this.micAudioLevel = 0
			}
			if (effectiveAllMuted) {
				this.audioLevel = 0
			}
		})

		if (this.session) {
			try {
				this.session.mute(effectiveAllMuted)
			} catch (e) {
				console.warn('Failed to toggle mute on session:', e)
			}
		}
		if (this.mediaStream) {
			for (const track of this.mediaStream.getAudioTracks()) {
				track.enabled = !effectiveAllMuted
			}
		}
	}
}

export const realtimeService = new RealtimeService()
