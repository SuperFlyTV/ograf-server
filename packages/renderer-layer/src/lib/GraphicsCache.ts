import { ServerApi } from 'ograf'
import { GraphicInfo } from './GraphicInstance.js'

export class GraphicCache {
	private cachedGraphicInfo: Record<
		string,
		ServerApi.paths['/graphics/{graphicId}']['get']['responses']['200']['content']['application/json']
	> = {}
	constructor(private serverApiUrl: string) {}
	async loadGraphic(graphicId: string) {
		// Check if the Graphic is already registered:
		const cachedGraphic = customElements.get(graphicId)
		const cachedGraphicInfo = this.cachedGraphicInfo[graphicId]
		if (cachedGraphic && cachedGraphicInfo) return { elementName: graphicId, graphicInfo: cachedGraphicInfo }

		console.log(`Loading Graphic "${graphicId}"`)

		console.log(`Loading manifest...`)
		const graphicInfo = await this.fetchGraphicInfo(graphicId)

		this.cachedGraphicInfo[graphicId] = graphicInfo

		// Load the Graphic:
		console.log(`Loading Graphic...`, graphicInfo)
		const webComponent = await this.fetchModule(graphicId, graphicInfo.manifest)

		// register the web component
		customElements.define(graphicId, webComponent)

		return {
			elementName: graphicId,
			graphicInfo,
		}
	}
	private async fetchGraphicInfo(graphicId: string): Promise<GraphicInfo> {
		const manifestUrl = `${this.serverApiUrl}/ograf/v1/graphics/${graphicId}`

		const response = await fetch(manifestUrl)
		if (response.status === 200) {
			const responseData = await response.json()

			if (!responseData.graphic) throw new Error('No "graphic" property found in response')
			if (!responseData.manifest) throw new Error('No "manifest" property found in response')

			return responseData
		} else {
			throw new Error(
				`Failed to load manifest from ${manifestUrl}: [${response.status}] ${JSON.stringify(response.body)}`
			)
		}
	}
	async fetchModule(id: string, manifest: ServerApi.components['schemas']['schema-2']) {
		const modulePath = `${this.serverApiUrl}/serverApi/internal/graphics/${id}/${manifest.main ?? 'graphic.mjs'}`

		// Load the Graphic module:
		const module = await import(modulePath)

		if (!module.default) {
			const exportKeys = Object.keys(module)

			if (exportKeys.length) {
				throw new Error(
					`The Graphic is expected to export a class as a default export. ${
						exportKeys.length === 1
							? `Instead there is a export called "${exportKeys[0]}". Change this to be "export default ${exportKeys[0]}".`
							: `Instead there are named exports: ${exportKeys.join(', ')}.`
					}`
				)
			} else {
				throw new Error('Module expected to export a class as a default export (no exports found)')
			}
		}
		if (typeof module.default !== 'function') {
			throw new Error('The Graphic is expected to default export a class')
		}

		return module.default
	}
}
