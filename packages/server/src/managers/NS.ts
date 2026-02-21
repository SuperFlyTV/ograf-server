import { MapTTL } from '../lib/MapTTL.js'
import { AccountStore } from './AccountStore.js'
import { GraphicsStoreNS } from './GraphicsStore.js'
import { RendererManagerNS } from './RendererManager.js'

export class Namespaces {
	private cache = new MapTTL<string, NS>(1000 * 3600 * 12)

	constructor(private accountStore: AccountStore) {
		this.cache.onRemove((_namespaceId, ns) => {
			ns.destroy()
		})
	}

	async getNS(namespaceId: string): Promise<NS> {
		if (!this.accountStore.enable) namespaceId = 'default'

		const cached = this.cache.get(namespaceId)
		if (cached) return cached

		const ns = new GraphicsStoreNS(namespaceId)
		await ns.init()
		this.cache.set(namespaceId, ns)
		return ns
	}
}
export class NS {
	public graphicStore: GraphicsStoreNS
	public renderManager: RendererManagerNS

	constructor() {
		const folderPath = this.accountStore.enable
			? this.accountStore.graphicsFolderPath(namespaceId)
			: path.resolve('./localGraphicsStorage')
	}
}
