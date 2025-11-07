import * as OGraf from 'ograf'
import { GraphicInstance } from './GraphicInstance.js'
import { GraphicCache } from './GraphicsCache.js'
import { LayersManager, RenderTarget } from './LayersManager.js'

export class LayerHandler {
	public graphicInstance: GraphicInstance | null = null

	private ref: HTMLDivElement | null = null

	constructor(
		private manager: LayersManager,
		private graphicCache: GraphicCache,
		public renderTarget: RenderTarget,
		public name: string,
		public zIndex: number
	) {}
	setRef(ref: HTMLDivElement | null) {
		this.ref = ref
	}
	getInfo() {
		// RenderTargetInfo
		return {
			renderTarget: this.renderTarget,
			name: this.name,
			status: 'OK', // enum: OK, WARNING, ERROR
			// statusMessage: ''
			graphicInstances: this.graphicInstance
				? [
						{
							graphicInstanceId: this.graphicInstance.id,
							graphic: this.graphicInstance.graphicInfo.graphic,
						},
					]
				: [],
		}
		return {} // RenderTargetStatus, TBD
	}
	listGraphicInstances() {
		return [] // TODO
	}

	async loadGraphic(
		graphicId: string,
		params: {
			data: unknown
		}
	) {
		if (!this.ref) throw new Error(`LayerHandler ref is not set for layer ${this.name}`)

		// Clear any existing GraphicInstance:
		const existing = this.getGraphicInstance()
		if (existing) {
			this.clearGraphic()
		}

		const { elementName, graphicInfo } = await this.graphicCache.loadGraphic(graphicId)

		// Add element to DOM:
		const element = document.createElement(elementName) as HTMLElement & OGraf.GraphicsAPI.Graphic

		this.ref.appendChild(element)

		this.graphicInstance = new GraphicInstance(graphicId, element, graphicInfo)

		// Load the element:
		let result = await element.load({
			renderType: 'realtime',
			renderCharacteristics: this.manager.getRenderCharacteristics(),
			data: params.data,
		})

		if (!result) result = { statusCode: 200 }

		return {
			graphicInstanceId: this.graphicInstance.id,
			result,
		}
	}
	async clearGraphic() {
		const existing = this.getGraphicInstance()
		console.log('Clearing GraphicInstance', existing)
		if (existing) {
			try {
				await existing.element.dispose({})
			} catch (err) {
				console.error('Error disposing GraphicInstance:', err)
			} finally {
				if (this.ref) this.ref.innerHTML = ''
				this.graphicInstance = null
			}
		}
	}
	getGraphicInstance() {
		return this.graphicInstance
	}
	_findGraphicsInstance(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
	}) {
		const graphicInstance = this.getGraphicInstance()
		if (!graphicInstance) throw new Error(`No GraphicInstance on Layer ${params.renderTarget}`)

		const targetMatch = params.target.graphicId
			? params.target.graphicId === graphicInstance.graphicId
			: params.target.graphicInstanceId === graphicInstance.id
		if (!targetMatch) throw new Error(`No GraphicInstance found matching target: ${JSON.stringify(params.target)}`)
		return graphicInstance
	}
	async invokeUpdateAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['updateAction']>[0]
	}) {
		const graphicsInstance = this._findGraphicsInstance(params)
		let result = await graphicsInstance.element.updateAction(params.params)
		if (!result) result = { statusCode: 200 }
		return {
			graphicsInstanceId: graphicsInstance.id,
			result,
		}
	}
	async invokePlayAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['playAction']>[0]
	}) {
		const graphicsInstance = this._findGraphicsInstance(params)

		let result = await graphicsInstance.element.playAction(params.params)
		if (!result) result = { statusCode: 200, currentStep: 1 } // Not valid in spec, but it's easy to handle
		if (!result.statusCode) result.statusCode = 200

		return {
			graphicsInstanceId: graphicsInstance.id,
			result,
		}
	}
	async invokeStopAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['stopAction']>[0]
	}) {
		const graphicsInstance = this._findGraphicsInstance(params)

		let result = await graphicsInstance.element.stopAction(params.params)
		if (!result) result = { statusCode: 200 }
		return {
			graphicsInstanceId: graphicsInstance.id,
			result,
		}
	}
	async invokeCustomAction(params: {
		renderTarget: RenderTarget
		target: {
			graphicId?: string
			graphicInstanceId?: string
		}
		params: Parameters<OGraf.GraphicsAPI.Graphic['customAction']>[0]
	}) {
		const graphicsInstance = this._findGraphicsInstance(params)

		let result = await graphicsInstance.element.customAction(params.params)
		if (!result) result = { statusCode: 200 }
		return {
			graphicsInstanceId: graphicsInstance.id,
			result,
		}
	}
	// Not supported in a realtime renderer, so not implemented here:
	// gotoTime
	// setActionsSchedule
}
