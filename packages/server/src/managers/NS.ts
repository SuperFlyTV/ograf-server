import type { S3Client } from '@aws-sdk/client-s3'
import { ConfigOptions } from '../config.js'
import { IAccountStore } from './AccountStore.js'
import { createGraphicsStoreNS, createS3Client, IGraphicsStoreNS } from './GraphicsStore.js'
import { RendererManagerNS } from './RendererManager.js'

export class Namespaces {
	private cache = new Map<string, NS>()
	private s3Client: S3Client | undefined

	static isValidNamespaceId(namespaceId: string): boolean {
		// Only allow certain characters in namespaceId to prevent path traversal attacks:
		return /^[ a-zA-Z0-9_-]+$/.test(namespaceId)
	}

	constructor(
		private accountStore: IAccountStore,
		private config: ConfigOptions = {
			namespacePath: undefined,
			cleanupGraphics: undefined,
			cleanupAccount: undefined,
			infoText: undefined,
			port: undefined,
		}
	) {
		if (typeof this.config.s3Bucket === 'string' && this.config.s3Bucket) {
			this.s3Client = createS3Client(this.config)
		}

		// Add up to 10% random jitter so multiple server replicas don't run cleanup in lockstep:
		const baseInterval = this.accountStore.cleanupIntervalMs
		const jitteredInterval = baseInterval + Math.floor(Math.random() * Math.max(100, baseInterval * 0.1))

		setInterval(() => {
			this.cleanUp().catch(console.error)
		}, jitteredInterval)
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
			const alive = await this.accountStore.touchAccount(namespaceId)
			if (!alive) {
				// Account was removed externally or by another server instance
				cached.destroy()
				this.cache.delete(namespaceId)
				return undefined
			}
			return cached
		}

		if (this.accountStore.enable) {
			if (!(await this.accountStore.exists(namespaceId))) return undefined
		}

		const ns = new NS(this.accountStore, namespaceId, this.config, this.s3Client)
		await ns.init()
		this.cache.set(namespaceId, ns)
		await this.accountStore.touchAccount(namespaceId)
		return ns
	}

	private async cleanUp() {
		await this.accountStore.cleanUpAccounts({
			onRemoveNamespace: async (namespaceId) => {
				const ns = this.cache.get(namespaceId)
				if (ns) {
					await ns.graphicStore.deleteAllGraphics()
					ns.destroy()
					this.cache.delete(namespaceId)
				} else {
					const tempStore = createGraphicsStoreNS(this.config, this.accountStore, namespaceId, this.s3Client)
					await tempStore.deleteAllGraphics()
				}
			},
			onCleanupGraphics: async (namespaceId) => {
				const ns = this.cache.get(namespaceId)
				if (ns) {
					await ns.graphicStore.deleteAllGraphics()
				} else {
					const tempStore = createGraphicsStoreNS(this.config, this.accountStore, namespaceId, this.s3Client)
					await tempStore.deleteAllGraphics()
				}
			},
		})

		// Evict any locally cached namespaces that were deleted by another server process:
		if (this.accountStore.enable) {
			for (const [namespaceId, ns] of this.cache.entries()) {
				try {
					if (!(await this.accountStore.exists(namespaceId))) {
						ns.destroy()
						this.cache.delete(namespaceId)
					}
				} catch (err) {
					console.error(`Failed to check existence of cached namespace ${namespaceId}:`, err)
				}
			}
		}
	}
}
export class NS {
	public graphicStore: IGraphicsStoreNS
	public rendererManager: RendererManagerNS

	constructor(
		private accountStore: IAccountStore,
		private namespaceId: string,
		config: ConfigOptions = {
			namespacePath: undefined,
			cleanupGraphics: undefined,
			cleanupAccount: undefined,
			infoText: undefined,
			port: undefined,
		},
		s3Client?: S3Client
	) {
		this.graphicStore = createGraphicsStoreNS(config, this.accountStore, namespaceId, s3Client)
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
