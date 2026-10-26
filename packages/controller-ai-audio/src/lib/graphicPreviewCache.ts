import * as OGraf from 'ograf'
import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'

export type PreviewGraphicElement = HTMLElement & OGraf.GraphicsAPI.Graphic

class GraphicPreviewCache {
	private inFlightLoads = new Map<string, Promise<string>>()

	public getCustomElementName(graphicId: string): string {
		return `ograf-preview-${graphicId.toLocaleLowerCase().replaceAll(/[^a-z0-9]/g, '_')}`
	}

	public async ensureGraphicDefined(graphicId: string): Promise<string> {
		const elementName = this.getCustomElementName(graphicId)
		if (customElements.get(elementName)) {
			return elementName
		}

		const existingPromise = this.inFlightLoads.get(graphicId)
		if (existingPromise) {
			return existingPromise
		}

		const loadPromise = this.loadAndDefine(graphicId, elementName).finally(() => {
			this.inFlightLoads.delete(graphicId)
		})
		this.inFlightLoads.set(graphicId, loadPromise)
		return loadPromise
	}

	private async loadAndDefine(graphicId: string, elementName: string): Promise<string> {
		let graphicInfo = serverDataStore.graphicsInfo.get(graphicId)
		if (!graphicInfo) {
			graphicInfo = await serverDataStore.loadGraphic(graphicId, true)
			if (!graphicInfo) {
				throw new Error(`Failed to load manifest for graphic "${graphicId}"`)
			}
		}

		if (customElements.get(elementName)) {
			return elementName
		}

		const manifest = graphicInfo.graphic as any
		const contentUrl: string = (graphicInfo.metadata as any)?.content?.url || ''
		const versionMatch = contentUrl.match(/\/serverApi\/internal\/graphics\/[^/]+\/(\d+)\//)
		const version = versionMatch ? versionMatch[1] : '0'
		const mainFile = manifest?.main ?? 'graphic.mjs'

		let baseUrl = appSettingsStore.serverApiUrl.replace(/\/ograf\/v1\/?$/, '/')
		if (!baseUrl.endsWith('/')) baseUrl += '/'

		const moduleUrl = `${baseUrl}serverApi/internal/graphics/${encodeURIComponent(graphicId)}/${version}/${mainFile}`
		const mod = await import(/* @vite-ignore */ moduleUrl)

		if (!mod.default || typeof mod.default !== 'function') {
			throw new Error(`Graphic "${graphicId}" does not default-export a CustomElement class`)
		}

		if (!customElements.get(elementName)) {
			customElements.define(elementName, mod.default as CustomElementConstructor)
		}

		return elementName
	}
}

export const graphicPreviewCache = new GraphicPreviewCache()
