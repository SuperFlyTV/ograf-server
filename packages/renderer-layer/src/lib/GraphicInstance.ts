import * as OGraf from 'ograf'

export class GraphicInstance {
	static graphicInstanceId = 0

	public id: string
	constructor(
		public graphicId: string,
		public element: HTMLElement & OGraf.GraphicsAPI.Graphic,
		public graphicInfo: GraphicInfo
	) {
		this.id = `${GraphicInstance.graphicInstanceId++}`
	}
}

export type GraphicInfo =
	OGraf.ServerApi.paths['/graphics/{graphicId}']['get']['responses']['200']['content']['application/json']
