import { action, autorun, makeObservable, observable, ObservableMap } from 'mobx'
import { OgrafApi } from '../lib/ografApi.js'
import { serverDataStore } from './serverData.js'
import * as OGraf from 'ograf'
import { getDefaultDataFromSchema } from 'ograf-form'
import { clone } from '../lib/lib.js'
import { getDefaultServerUrl, getNameSpaceId } from '../lib/namespace.js'
import { UserInterfaceComponentInfo, registerCustomGuiComponent } from '@ograf-server/shared'

export interface OpenCustomGuiDialog {
	id: string
	graphicKey: string
	componentId: string
	graphicId: string
	name: string
	description?: string
	componentClass: CustomElementConstructor
}

class AppSettings {
	private LOCALSTORAGE_ID = 'appSettings' + getNameSpaceId()

	public serverApiUrl = getDefaultServerUrl() + '/ograf/v1/' // 'http://localhost:8080/ograf/v1/'
	public serverAuthorization: string | null = null
	public selectedRendererId: string = ''

	private ografApi = OgrafApi.getSingleton()
	public queuedGraphics = new ObservableMap<string, QueuedGraphic>()
	public openCustomGuis = observable.map<string, OpenCustomGuiDialog>(undefined, { deep: false })
	constructor() {
		// Load any stored states
		const stateToLoadStr: string | null = window.localStorage.getItem(this.LOCALSTORAGE_ID)
		try {
			const stateToLoad: StoredState | undefined = stateToLoadStr ? JSON.parse(stateToLoadStr) : undefined

			if (stateToLoad?.serverApiUrl) this.serverApiUrl = stateToLoad.serverApiUrl
			if (stateToLoad?.selectedRendererId) this.selectedRendererId = stateToLoad.selectedRendererId
			if (stateToLoad?.serverAuthorization) this.serverAuthorization = stateToLoad.serverAuthorization || null
			if (stateToLoad?.queuedGraphics) {
				stateToLoad.queuedGraphics.forEach(([key, value]) => this.queuedGraphics.set(key, value))
			}
		} catch (e) {
			console.error('Error when loading state from localStorage', e)
		}

		makeObservable(this, {
			selectedRendererId: observable,
			serverApiUrl: observable,
			serverAuthorization: observable,
			openCustomGuis: observable.shallow,
		})

		// Store any changes to localhost:
		autorun(() => {
			const storedState: StoredState = {
				serverApiUrl: this.serverApiUrl,
				serverAuthorization: this.serverAuthorization,
				selectedRendererId: this.selectedRendererId,
				queuedGraphics: Array.from(this.queuedGraphics.entries()),
			}

			window.localStorage.setItem(this.LOCALSTORAGE_ID, JSON.stringify(storedState))
		})

		autorun(() => {
			// Send serverApiUrl to the ografApi singleton:
			this.ografApi.baseURL = this.serverApiUrl
			this.ografApi.authorization = this.serverAuthorization ?? undefined
		})
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
	public openCustomGui = action((graphicKey: string, component: UserInterfaceComponentInfo) => {
		const dialogId = `${graphicKey}__${component.id}`
		const q = this.queuedGraphics.get(graphicKey)
		if (!q) return
		registerCustomGuiComponent(q.graphicId, component.id, component.componentClass)
		this.openCustomGuis.set(dialogId, {
			id: dialogId,
			graphicKey,
			componentId: component.id,
			graphicId: q.graphicId,
			name: component.name,
			description: component.description,
			componentClass: component.componentClass,
		})
	})
	public closeCustomGui = action((dialogId: string) => {
		this.openCustomGuis.delete(dialogId)
	})
	public removeGraphic = action((key: string) => {
		this.queuedGraphics.delete(key)
		for (const [dialogId, dialog] of this.openCustomGuis.entries()) {
			if (dialog.graphicKey === key) {
				this.openCustomGuis.delete(dialogId)
			}
		}
	})
	public clearStored() {
		window.localStorage.removeItem(this.LOCALSTORAGE_ID)
		window.location.reload()
	}
}
interface StoredState {
	serverApiUrl: string
	serverAuthorization: string | null
	selectedRendererId: string
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
