import { action, autorun, makeObservable, observable, ObservableMap, runInAction } from 'mobx'
import { OgrafApi } from '../lib/ografApi.js'
import { serverDataStore } from './serverData.js'
import * as OGraf from 'ograf'
import { getDefaultDataFromSchema } from 'ograf-form'
import { clone } from '../lib/lib.js'
import { getDefaultServerUrl } from '../lib/namespace.js'
import { dbStore } from './db.js'

class AppSettings {
	public serverApiUrl = getDefaultServerUrl() + '/ograf/v1/' // 'http://localhost:8080/ograf/v1/'
	public selectedRendererId: string = ''
	public autoLoad: boolean = true

	private ografApi = OgrafApi.getSingleton()
	public queuedGraphics = new ObservableMap<string, QueuedGraphic>()

	public isInitialized = false

	constructor() {
		makeObservable(this, {
			selectedRendererId: observable,
			serverApiUrl: observable,
			autoLoad: observable,
			isInitialized: observable,
		})

		this.init().catch(e => console.error("AppSettings init failed", e))
	}

	private async init() {
		try {
			// Load any stored states
			const stateToLoad = await dbStore.getSetting<StoredState>('appSettings')

			runInAction(() => {
				if (stateToLoad?.serverApiUrl) this.serverApiUrl = stateToLoad.serverApiUrl
				if (stateToLoad?.selectedRendererId) this.selectedRendererId = stateToLoad.selectedRendererId
				if (stateToLoad?.autoLoad !== undefined) this.autoLoad = stateToLoad.autoLoad
				if (stateToLoad?.queuedGraphics) {
					stateToLoad.queuedGraphics.forEach(([key, value]) => this.queuedGraphics.set(key, value))
				}

				this.isInitialized = true
			})

			// Store any changes to IndexedDB:
			autorun(() => {
				const storedState: StoredState = {
					serverApiUrl: this.serverApiUrl,
					selectedRendererId: this.selectedRendererId,
					autoLoad: this.autoLoad,
					queuedGraphics: Array.from(this.queuedGraphics.entries()),
				}

				dbStore.setSetting('appSettings', storedState).catch(console.error)
			})

			autorun(() => {
				// Send serverApiUrl to the ografApi singleton:
				this.ografApi.baseURL = this.serverApiUrl
				console.log('Set ografApi.baseURL to', this.ografApi.baseURL)
			})
		} catch (e) {
			console.error('Error when loading state from IndexedDB', e)
		}
	}

	public getSelectedRendererId(): string | undefined {
		const renderer = serverDataStore.renderersList.find((r) => r.id === appSettingsStore.selectedRendererId)

		return renderer?.id
	}
	public getSelectedRenderer(): OGraf.ServerApi.components['schemas']['RendererInfo'] | undefined {
		const id = this.getSelectedRendererId()
		if (!id) return undefined
		return serverDataStore.renderersInfo.get(id)
	}

	public addGraphic = action((rendererId: string, graphicId: string) => {
		const key = `${Date.now()}`

		const renderer = serverDataStore.renderersInfo.get(rendererId)

		const renderTarget = renderer?.renderTargetSchema
			? getDefaultDataFromSchema(renderer.renderTargetSchema)
			: undefined

		this.queuedGraphics.set(key, {
			graphicId,
			graphicData: undefined,
			rank: Date.now(),
			rendererId,
			renderTarget: clone(renderTarget),
			customActionData: {},
		})
	})
	public removeGraphic = action((key: string) => {
		this.queuedGraphics.delete(key)
	})

	// Stub method for sending data to server
	public async sendDataToServer() {
		console.log("Stub: Send data to server", {
			serverApiUrl: this.serverApiUrl,
			selectedRendererId: this.selectedRendererId,
			autoLoad: this.autoLoad,
			queuedGraphics: Array.from(this.queuedGraphics.entries())
		})
	}

	// Stub method for loading from server
	public async loadDataFromServer() {
		console.log("Stub: Load data from server")
	}
}

interface StoredState {
	serverApiUrl: string
	selectedRendererId: string
	autoLoad?: boolean
	queuedGraphics: [string, QueuedGraphic][]
}

export interface QueuedGraphic {
	customActionData: { [actionId: string]: unknown }
	graphicId: string
	rank: number
	graphicData: unknown | undefined
	rendererId: string
	renderTarget: unknown | undefined
}

export const appSettingsStore = new AppSettings()
