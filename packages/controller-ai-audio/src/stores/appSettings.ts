import { autorun, makeObservable, observable, runInAction } from 'mobx'
import { OgrafApi } from '../lib/ografApi.js'
import { serverDataStore } from './serverData.js'
import * as OGraf from 'ograf'
import { getDefaultServerUrl } from '../lib/namespace.js'
import { dbStore } from './db.js'

export const PRELIMINARY_RENDERER_ID = 'preliminary'

export type ThemeMode = 'default' | 'light' | 'dark'
export type EagernessLevel = 1 | 2 | 3 | 4 | 5

export const EAGERNESS_LABELS: Record<EagernessLevel, string> = {
	1: 'Very Low',
	2: 'Low',
	3: 'Medium',
	4: 'High',
	5: 'Very High',
}

export interface LanguageOption {
	code: string
	name: string
	nativeName: string
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
	{ code: 'en', name: 'English', nativeName: 'English' },
	{ code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
	{ code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
	{ code: 'da', name: 'Danish', nativeName: 'Dansk' },
	{ code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
	{ code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
	{ code: 'de', name: 'German', nativeName: 'Deutsch' },
	{ code: 'fr', name: 'French', nativeName: 'Français' },
	{ code: 'es', name: 'Spanish', nativeName: 'Español' },
	{ code: 'it', name: 'Italian', nativeName: 'Italiano' },
	{ code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
	{ code: 'pt', name: 'Portuguese', nativeName: 'Português' },
	{ code: 'pl', name: 'Polish', nativeName: 'Polski' },
	{ code: 'cs', name: 'Czech', nativeName: 'Čeština' },
	{ code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
	{ code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
	{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
	{ code: 'ar', name: 'Arabic', nativeName: 'العربية' },
	{ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
	{ code: 'ja', name: 'Japanese', nativeName: '日本語' },
	{ code: 'ko', name: 'Korean', nativeName: '한국어' },
	{ code: 'zh', name: 'Chinese', nativeName: '中文' },
]

class AppSettings {
	public serverApiUrl = getDefaultServerUrl() + '/ograf/v1/'
	public selectedRendererId: string = ''
	public autoLoad: boolean = true
	public themeMode: ThemeMode = 'default'

	// AI / Audio specific settings:
	public openAiApiKey: string = ''
	public openAiModel: string = 'gpt-realtime'
	public eagerness: EagernessLevel = 3
	public autoMode: boolean = false
	public autoStopOnSilence: boolean = true
	public autoStopSilenceMinutes: number = 5
	public selectedMicDeviceId: string = ''
	public selectedSecondaryMicDeviceId: string = '__none__'
	public autoMuteSystemOnMic: boolean = false
	public selectedLanguages: string[] = []
	public disabledGraphicIds: string[] = []
	public customInstructions: string = ''

	// 46elks Phone-In settings:
	public elksApiUsername: string = ''
	public elksApiPassword: string = ''
	public elksSelectedPhoneNumber: string = ''
	public elksWebrtcNumber: string = ''
	public elksWebrtcSecret: string = ''

	private ografApi = OgrafApi.getSingleton()

	public isInitialized = false

	constructor() {
		makeObservable(this, {
			selectedRendererId: observable,
			serverApiUrl: observable,
			autoLoad: observable,
			themeMode: observable,
			openAiApiKey: observable,
			openAiModel: observable,
			eagerness: observable,
			autoMode: observable,
			autoStopOnSilence: observable,
			autoStopSilenceMinutes: observable,
			selectedMicDeviceId: observable,
			selectedSecondaryMicDeviceId: observable,
			autoMuteSystemOnMic: observable,
			selectedLanguages: observable,
			disabledGraphicIds: observable,
			customInstructions: observable,
			elksApiUsername: observable,
			elksApiPassword: observable,
			elksSelectedPhoneNumber: observable,
			elksWebrtcNumber: observable,
			elksWebrtcSecret: observable,
			isInitialized: observable,
		})

		this.init().catch((e) => console.error('AppSettings init failed', e))
	}

	private async init() {
		try {
			const stateToLoad = await dbStore.getSetting<StoredState>('appSettings')

			runInAction(() => {
				if (stateToLoad?.serverApiUrl) {
					if (stateToLoad.serverApiUrl.includes('http://ograf-server/')) {
						this.serverApiUrl = getDefaultServerUrl() + '/ograf/v1/'
					} else {
						this.serverApiUrl = stateToLoad.serverApiUrl
					}
				} else {
					this.serverApiUrl = getDefaultServerUrl() + '/ograf/v1/'
				}
				if (stateToLoad?.selectedRendererId) this.selectedRendererId = stateToLoad.selectedRendererId
				if (stateToLoad?.autoLoad !== undefined) this.autoLoad = stateToLoad.autoLoad
				if (stateToLoad?.themeMode) this.themeMode = stateToLoad.themeMode
				if (stateToLoad?.openAiApiKey !== undefined) this.openAiApiKey = stateToLoad.openAiApiKey
				if (stateToLoad?.openAiModel) this.openAiModel = stateToLoad.openAiModel
				if (stateToLoad?.eagerness && stateToLoad.eagerness >= 1 && stateToLoad.eagerness <= 5) {
					this.eagerness = stateToLoad.eagerness as EagernessLevel
				}
				if (stateToLoad?.autoMode !== undefined) {
					this.autoMode = Boolean(stateToLoad.autoMode)
				}
				if (stateToLoad?.autoStopOnSilence !== undefined) {
					this.autoStopOnSilence = Boolean(stateToLoad.autoStopOnSilence)
				}
				if (
					typeof stateToLoad?.autoStopSilenceMinutes === 'number' &&
					Number.isFinite(stateToLoad.autoStopSilenceMinutes) &&
					stateToLoad.autoStopSilenceMinutes > 0
				) {
					this.autoStopSilenceMinutes = stateToLoad.autoStopSilenceMinutes
				}
				if (stateToLoad?.selectedMicDeviceId === '__system_and_mic__') {
					this.selectedMicDeviceId = '__system_audio__'
					this.selectedSecondaryMicDeviceId =
						stateToLoad?.selectedAudioSource2 ?? stateToLoad?.selectedSecondaryMicDeviceId ?? ''
				} else if (stateToLoad?.selectedMicDeviceId === '__phone_in_and_mic__') {
					this.selectedMicDeviceId = '__phone_in__'
					this.selectedSecondaryMicDeviceId =
						stateToLoad?.selectedAudioSource2 ?? stateToLoad?.selectedSecondaryMicDeviceId ?? ''
				} else {
					if (stateToLoad?.selectedMicDeviceId !== undefined) {
						this.selectedMicDeviceId = stateToLoad.selectedMicDeviceId
					}
					if (stateToLoad?.selectedAudioSource2 !== undefined) {
						this.selectedSecondaryMicDeviceId = stateToLoad.selectedAudioSource2
					} else {
						this.selectedSecondaryMicDeviceId = '__none__'
					}
				}
				if (stateToLoad?.autoMuteSystemOnMic !== undefined) {
					this.autoMuteSystemOnMic = stateToLoad.autoMuteSystemOnMic
				}
				if (Array.isArray(stateToLoad?.selectedLanguages)) {
					this.selectedLanguages = stateToLoad.selectedLanguages
				}
				if (Array.isArray(stateToLoad?.disabledGraphicIds)) {
					this.disabledGraphicIds = stateToLoad.disabledGraphicIds
				}
				if (typeof stateToLoad?.customInstructions === 'string') {
					this.customInstructions = stateToLoad.customInstructions
				}
				if (typeof stateToLoad?.elksApiUsername === 'string') {
					this.elksApiUsername = stateToLoad.elksApiUsername
				}
				if (typeof stateToLoad?.elksApiPassword === 'string') {
					this.elksApiPassword = stateToLoad.elksApiPassword
				}
				if (typeof stateToLoad?.elksSelectedPhoneNumber === 'string') {
					this.elksSelectedPhoneNumber = stateToLoad.elksSelectedPhoneNumber
				}
				if (typeof stateToLoad?.elksWebrtcNumber === 'string') {
					this.elksWebrtcNumber = stateToLoad.elksWebrtcNumber
				}
				if (typeof stateToLoad?.elksWebrtcSecret === 'string') {
					this.elksWebrtcSecret = stateToLoad.elksWebrtcSecret
				}

				this.isInitialized = true
			})

			autorun(() => {
				const storedState: StoredState = {
					serverApiUrl: this.serverApiUrl,
					selectedRendererId: this.selectedRendererId,
					autoLoad: this.autoLoad,
					themeMode: this.themeMode,
					openAiApiKey: this.openAiApiKey,
					openAiModel: this.openAiModel,
					eagerness: this.eagerness,
					autoMode: this.autoMode,
					autoStopOnSilence: this.autoStopOnSilence,
					autoStopSilenceMinutes: this.autoStopSilenceMinutes,
					selectedMicDeviceId: this.selectedMicDeviceId,
					selectedSecondaryMicDeviceId: this.selectedSecondaryMicDeviceId,
					selectedAudioSource2: this.selectedSecondaryMicDeviceId,
					autoMuteSystemOnMic: this.autoMuteSystemOnMic,
					selectedLanguages: [...this.selectedLanguages],
					disabledGraphicIds: [...this.disabledGraphicIds],
					customInstructions: this.customInstructions,
					elksApiUsername: this.elksApiUsername,
					elksApiPassword: this.elksApiPassword,
					elksSelectedPhoneNumber: this.elksSelectedPhoneNumber,
					elksWebrtcNumber: this.elksWebrtcNumber,
					elksWebrtcSecret: this.elksWebrtcSecret,
				}

				dbStore.setSetting('appSettings', storedState).catch(console.error)
			})

			autorun(() => {
				this.ografApi.baseURL = this.serverApiUrl
			})
		} catch (e) {
			console.error('Error when loading state from IndexedDB', e)
		}
	}

	public hasElksCredentials(): boolean {
		return Boolean(
			(this.elksApiUsername.trim() && this.elksApiPassword.trim()) ||
			(this.elksWebrtcNumber.trim() && this.elksWebrtcSecret.trim())
		)
	}

	public hasAnyElksInput(): boolean {
		return Boolean(
			this.elksApiUsername.trim() ||
			this.elksApiPassword.trim() ||
			this.elksWebrtcNumber.trim() ||
			this.elksWebrtcSecret.trim() ||
			this.elksSelectedPhoneNumber.trim()
		)
	}

	public setCustomInstructions(instructions: string) {
		runInAction(() => {
			this.customInstructions = instructions
		})
	}

	public setSelectedLanguages(codes: string[]) {
		runInAction(() => {
			this.selectedLanguages = Array.from(new Set(codes.filter(Boolean)))
		})
	}

	public isGraphicEnabled(graphicId: string): boolean {
		return !this.disabledGraphicIds.includes(graphicId)
	}

	public setGraphicEnabled(graphicId: string, enabled: boolean) {
		runInAction(() => {
			if (enabled) {
				this.disabledGraphicIds = this.disabledGraphicIds.filter((id) => id !== graphicId)
			} else if (!this.disabledGraphicIds.includes(graphicId)) {
				this.disabledGraphicIds = [...this.disabledGraphicIds, graphicId]
			}
		})
	}

	public setDisabledGraphicIds(disabledIds: string[]) {
		runInAction(() => {
			this.disabledGraphicIds = Array.from(new Set(disabledIds))
		})
	}

	public getSelectedRendererId(): string | undefined {
		return this.selectedRendererId || PRELIMINARY_RENDERER_ID
	}

	public getSelectedRenderer(): OGraf.ServerApi.components['schemas']['RendererInfo'] | undefined {
		const id = this.getSelectedRendererId()
		if (!id) return undefined
		return serverDataStore.renderersInfo.get(id)
	}
}

interface StoredState {
	serverApiUrl: string
	selectedRendererId: string
	autoLoad?: boolean
	themeMode?: ThemeMode
	openAiApiKey?: string
	openAiModel?: string
	eagerness?: number
	autoMode?: boolean
	autoStopOnSilence?: boolean
	autoStopSilenceMinutes?: number
	selectedMicDeviceId?: string
	selectedSecondaryMicDeviceId?: string
	selectedAudioSource2?: string
	autoMuteSystemOnMic?: boolean
	selectedLanguages?: string[]
	disabledGraphicIds?: string[]
	customInstructions?: string
	elksApiUsername?: string
	elksApiPassword?: string
	elksSelectedPhoneNumber?: string
	elksWebrtcNumber?: string
	elksWebrtcSecret?: string
}

export const appSettingsStore = new AppSettings()
