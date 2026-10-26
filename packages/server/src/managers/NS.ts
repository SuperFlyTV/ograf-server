import { AccountStore } from './AccountStore.js'
import { GraphicsStoreNS } from './GraphicsStore.js'
import { RendererManagerNS } from './RendererManager.js'
import path from 'path'

export class Namespaces {
	private cache = new Map<string, NS>()

	static isValidNamespaceId(namespaceId: string): boolean {
		// Only allow certain characters in namespaceId to prevent path traversal attacks:
		return /^[ a-zA-Z0-9_-]+$/.test(namespaceId)
	}

	constructor(private accountStore: AccountStore) {
		// this.cache.onRemove((_namespaceId, ns) => {
		// 	ns.destroy()
		// })

		setInterval(() => {
			this.cleanUp().catch(console.error)
		}, this.accountStore.cleanupIntervalMs)
		this.cleanUp().catch(console.error)
	}

	async getNS(namespaceId: string): Promise<NS | undefined> {
		if (!this.accountStore.enable) {
			if (namespaceId)
				throw new Error(`AccountStore is not enabled, namespaceId should be empty (got "${namespaceId}")`)
			namespaceId = 'default'
		} else {
			if (!namespaceId) throw new Error('NamespaceId is required when AccountStore is enabled')
		}

		if (!Namespaces.isValidNamespaceId(namespaceId)) return undefined

		const cached = this.cache.get(namespaceId)
		if (cached) {
			await this.accountStore.touchAccount(namespaceId)
			return cached
		}

		if (this.accountStore.enable) {
			if (!(await this.accountStore.exists(namespaceId))) return undefined
		}

		const ns = new NS(this.accountStore, namespaceId)
		await ns.init()
		this.cache.set(namespaceId, ns)
		await this.accountStore.touchAccount(namespaceId)
		return ns
	}

	private async cleanUp() {
		await this.accountStore.cleanUpAccounts((namespaceId) => {
			const ns = this.cache.get(namespaceId)
			if (ns) {
				ns.destroy()
				this.cache.delete(namespaceId)
			}
		})
	}
}
export class NS {
	public graphicStore: GraphicsStoreNS
	public rendererManager: RendererManagerNS

	constructor(
		private accountStore: AccountStore,
		private namespaceId: string
	) {
		const folderPath = this.accountStore.enable
			? this.accountStore.graphicsFolderPath(namespaceId)
			: path.resolve('./localGraphicsStorage')

		this.graphicStore = new GraphicsStoreNS(namespaceId, folderPath)
		this.rendererManager = new RendererManagerNS(namespaceId, () => {
			this.accountStore.touchAccount(namespaceId).catch(console.error)
		})
	}
	public async touch(): Promise<void> {
		await this.accountStore.touchAccount(this.namespaceId)
	}
	public async init(): Promise<void> {
		await this.graphicStore.init()
		// await this.renderManager.init()
	}
	public destroy(): void {
		this.graphicStore.destroy()
		// this.renderManager.destroy()
	}
}
