import { autorun, makeObservable, observable, runInAction } from 'mobx'
import { OgrafApi } from '../lib/ografApi.js'
import { serverDataStore } from './serverData.js'
import * as OGraf from 'ograf'
import { getDefaultServerUrl } from '../lib/namespace.js'
import { dbStore } from './db.js'

export const PRELIMINARY_RENDERER_ID = 'preliminary'

export type ThemeMode = 'default' | 'light' | 'dark'

class AppSettings {
	public serverApiUrl = getDefaultServerUrl() + '/ograf/v1/'
	public selectedRendererId: string = ''
	public autoLoad: boolean = true
	public themeMode: ThemeMode = 'default'
	public editModeToggleKey: string = 'e'
	public editModeHoldKey: string = 'Tab'

	private ografApi = OgrafApi.getSingleton()
	public isInitialized = false

	constructor() {
		makeObservable(this, {
			selectedRendererId: observable,
			serverApiUrl: observable,
			autoLoad: observable,
			themeMode: observable,
			editModeToggleKey: observable,
			editModeHoldKey: observable,
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
				if (stateToLoad?.editModeToggleKey !== undefined) this.editModeToggleKey = stateToLoad.editModeToggleKey
				if (stateToLoad?.editModeHoldKey !== undefined) this.editModeHoldKey = stateToLoad.editModeHoldKey

				this.isInitialized = true
			})

			autorun(() => {
				const storedState: StoredState = {
					serverApiUrl: this.serverApiUrl,
					selectedRendererId: this.selectedRendererId,
					autoLoad: this.autoLoad,
					themeMode: this.themeMode,
					editModeToggleKey: this.editModeToggleKey,
					editModeHoldKey: this.editModeHoldKey,
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
	editModeToggleKey?: string
	editModeHoldKey?: string
}

export const appSettingsStore = new AppSettings()
