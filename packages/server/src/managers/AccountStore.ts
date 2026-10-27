import fs from 'fs'
import path from 'path'
import { Collection, MongoClient } from 'mongodb'
import { MapTTL } from '../lib/MapTTL.js'
import { getMnemonicId } from '../lib/mnemonicId.js'
import { ConfigOptions } from '../config.js'

export interface Account {
	namespaceId: string
	email: string
	lastUsed: number
	createdAt: number
	createdAtStr: string
	/** If set, prevents any cleanup (set by an external app) */
	authorized?: boolean
	/** Unix timestamp for when account graphics was last cleaned up */
	lastCleanupTime?: number
}

export interface AccountCleanupCallbacks {
	onRemoveNamespace?: (namespaceId: string) => Promise<void> | void
	onCleanupGraphics?: (namespaceId: string) => Promise<void> | void
}

export interface IAccountStore {
	readonly enable: boolean
	readonly cleanupIntervalMs: number
	init(): Promise<void>
	destroy(): Promise<void>
	exists(namespaceId: string): Promise<boolean>
	registerNewNamespace(email: string): Promise<string>
	list(): Promise<Account[]>
	/**
	 * Updates lastUsed timestamp for the account (throttled by CACHE_TTL).
	 * Returns true if the account exists (or if store is disabled), false if the account no longer exists.
	 */
	touchAccount(namespaceId: string): Promise<boolean>
	cleanUpAccounts(callbacks?: ((namespaceId: string) => Promise<void> | void) | AccountCleanupCallbacks): Promise<void>
}

export abstract class BaseAccountStore implements IAccountStore {
	protected CACHE_TTL: number
	protected accountsCache: MapTTL<string, Account>

	public abstract readonly enable: boolean

	constructor(protected config: ConfigOptions) {
		const minCleanupMs = Math.min(
			this.config.cleanupGraphics ? this.config.cleanupGraphics * 1000 : Infinity,
			this.config.cleanupAccount ? this.config.cleanupAccount * 1000 : Infinity
		)
		this.CACHE_TTL = Math.max(1000, Math.min(1000 * 3600, Math.floor(minCleanupMs / 2)))
		this.accountsCache = new MapTTL<string, Account>(this.CACHE_TTL)
	}

	public get cleanupIntervalMs(): number {
		const minCleanupMs = Math.min(
			this.config.cleanupGraphics ? this.config.cleanupGraphics * 1000 : Infinity,
			this.config.cleanupAccount ? this.config.cleanupAccount * 1000 : Infinity
		)
		return Math.max(1000, Math.min(5 * 60 * 1000, Math.floor(minCleanupMs / 2)))
	}

	public async init(): Promise<void> {
		// Default no-op, overridden by stores that require async initialization
	}

	public async destroy(): Promise<void> {
		// Default no-op, overridden by stores that hold connections
	}

	public async exists(namespaceId: string): Promise<boolean> {
		if (!this.enable) return false
		return this.checkAccountExists(namespaceId)
	}

	public async registerNewNamespace(email: string): Promise<string> {
		for (let i = 0; i < 100; i++) {
			const namespaceId = getMnemonicId()
			// check if namespace exists:
			if (!(await this.canUseNamespaceId(namespaceId))) continue // try another id

			const account: Account = {
				createdAt: Date.now(),
				createdAtStr: new Date().toISOString(),
				lastUsed: Date.now(),
				email,
				namespaceId,
			}
			try {
				await this.createAccount(account)
			} catch (err: any) {
				// Handle duplicate key race condition in concurrent multi-process registrations:
				if (err?.code === 11000 || err?.code === 'EEXIST') continue
				throw err
			}
			this.accountsCache.set(namespaceId, account) // Cache the account we just created

			return namespaceId
		}
		throw new Error('Failed to generate unique namespace id. Please try again.')
	}

	public async list(): Promise<Account[]> {
		if (!this.enable) return []
		return this.listAccounts()
	}

	public async touchAccount(namespaceId: string): Promise<boolean> {
		if (!this.enable) return true

		const cached = this.accountsCache.get(namespaceId)
		if (cached && cached.lastUsed > Date.now() - this.CACHE_TTL) {
			return true // No need to update lastUsed yet
		}

		try {
			const updated = await this.updateAccountLastUsed(namespaceId, Date.now())
			if (!updated) {
				this.accountsCache.delete(namespaceId)
				return false
			}
			this.accountsCache.set(namespaceId, updated) // Cache the updated account
			return true
		} catch {
			this.accountsCache.delete(namespaceId)
			return false
		}
	}

	public async cleanUpAccounts(
		callbacks?: ((namespaceId: string) => Promise<void> | void) | AccountCleanupCallbacks
	): Promise<void> {
		if (!this.enable) return

		const onRemoveNamespace = typeof callbacks === 'function' ? callbacks : callbacks?.onRemoveNamespace
		const onCleanupGraphics = typeof callbacks === 'function' ? undefined : callbacks?.onCleanupGraphics

		const cleanupGraphicsMs =
			this.config.cleanupGraphics !== undefined && this.config.cleanupGraphics > 0
				? this.config.cleanupGraphics * 1000
				: undefined
		const cleanupAccountMs =
			this.config.cleanupAccount !== undefined && this.config.cleanupAccount > 0
				? this.config.cleanupAccount * 1000
				: undefined

		if (cleanupGraphicsMs === undefined && cleanupAccountMs === undefined) return

		const accounts = await this.list()
		const now = Date.now()

		for (const account of accounts) {
			if (account.authorized) continue

			// Check if the entire account should be cleaned up:
			if (cleanupAccountMs !== undefined && now - account.lastUsed > cleanupAccountMs) {
				try {
					// Atomically claim and remove the account only if it is still expired and unauthorized
					// (prevents race conditions when multiple server processes run cleanup concurrently):
					const claimed = await this.tryClaimAccountForRemoval(account.namespaceId, now - cleanupAccountMs)
					if (!claimed) continue

					this.accountsCache.delete(account.namespaceId)
					await onRemoveNamespace?.(account.namespaceId)
					console.log(`Cleaned up unused account namespace "${account.namespaceId}"`)
				} catch (err) {
					console.error(`Failed to clean up account for namespace ${account.namespaceId}:`, err)
				}
				continue
			}

			// Check if graphics for the account should be cleaned up:
			if (
				cleanupGraphicsMs !== undefined &&
				now - account.lastUsed > cleanupGraphicsMs &&
				(!account.lastCleanupTime || account.lastCleanupTime < account.lastUsed)
			) {
				try {
					// Atomically claim the graphics cleanup by updating lastCleanupTime only if still eligible:
					const claimedAccount = await this.tryClaimAccountForGraphicsCleanup(
						account.namespaceId,
						now - cleanupGraphicsMs,
						Date.now()
					)
					if (!claimedAccount) continue

					if (onCleanupGraphics) {
						await onCleanupGraphics(account.namespaceId)
					} else {
						await this.cleanupNamespaceGraphicsFallback(account.namespaceId)
					}
					this.accountsCache.set(account.namespaceId, claimedAccount)
					console.log(`Cleaned up graphics for unused namespace "${account.namespaceId}"`)
				} catch (err) {
					console.error(`Failed to clean up graphics for namespace ${account.namespaceId}:`, err)
				}
			}
		}
	}

	protected async canUseNamespaceId(namespaceId: string): Promise<boolean> {
		return !(await this.checkAccountExists(namespaceId))
	}

	protected abstract checkAccountExists(namespaceId: string): Promise<boolean>
	protected abstract createAccount(account: Account): Promise<void>
	protected abstract readAccount(namespaceId: string): Promise<Account>
	protected abstract writeAccount(account: Account): Promise<void>
	protected abstract updateAccountLastUsed(namespaceId: string, lastUsed: number): Promise<Account | undefined>
	protected abstract updateAccountLastCleanupTime(
		namespaceId: string,
		lastCleanupTime: number
	): Promise<Account | undefined>
	protected abstract tryClaimAccountForRemoval(namespaceId: string, maxLastUsed: number): Promise<boolean>
	protected abstract tryClaimAccountForGraphicsCleanup(
		namespaceId: string,
		maxLastUsed: number,
		cleanupTime: number
	): Promise<Account | undefined>
	protected abstract listAccounts(): Promise<Account[]>
	protected abstract deleteAccount(namespaceId: string): Promise<void>
	protected abstract cleanupNamespaceGraphicsFallback(namespaceId: string): Promise<void>
}

export class FileAccountStore extends BaseAccountStore {
	public readonly enable: boolean

	constructor(config: ConfigOptions) {
		super(config)
		this.enable = typeof this.config.namespacePath === 'string'

		if (!this.enable) return
		// Ensure the directory exists
		fs.mkdirSync(this.folderPath, { recursive: true })
	}

	private get folderPath(): string {
		if (typeof this.config.namespacePath !== 'string')
			throw new Error('Internal Error: NamespaceStore is not enabled. Check env variables.')

		return this.config.namespacePath
	}
	private namespaceFolderPath(namespaceId: string): string {
		return path.resolve(this.folderPath, namespaceId)
	}
	public graphicsFolderPath(namespaceId: string): string {
		return path.join(this.namespaceFolderPath(namespaceId), 'graphics')
	}
	private accountFilePath(namespaceId: string): string {
		return path.join(this.namespaceFolderPath(namespaceId), 'account.json')
	}

	protected override async canUseNamespaceId(namespaceId: string): Promise<boolean> {
		return !(await this.fsExists(this.namespaceFolderPath(namespaceId)))
	}

	protected async checkAccountExists(namespaceId: string): Promise<boolean> {
		return this.fsExists(this.accountFilePath(namespaceId))
	}

	protected async createAccount(account: Account): Promise<void> {
		await fs.promises.mkdir(this.namespaceFolderPath(account.namespaceId))
		await fs.promises.mkdir(this.graphicsFolderPath(account.namespaceId))
		await this.writeAccount(account)
	}

	protected async listAccounts(): Promise<Account[]> {
		const entries = await fs.promises.readdir(this.folderPath, { withFileTypes: true })
		const accounts: Account[] = []
		for (const entry of entries) {
			if (!entry.isDirectory()) continue
			const namespaceId = entry.name
			if (!(await this.exists(namespaceId))) continue
			try {
				const account = await this.readAccount(namespaceId)
				accounts.push(account)
			} catch (err) {
				console.error(`Failed to read account data for namespace ${namespaceId}:`, err)
			}
		}
		return accounts
	}

	protected async readAccount(namespaceId: string): Promise<Account> {
		const accountData = await fs.promises.readFile(this.accountFilePath(namespaceId), 'utf-8')
		return JSON.parse(accountData) as Account
	}

	protected async writeAccount(account: Account): Promise<void> {
		return fs.promises.writeFile(this.accountFilePath(account.namespaceId), JSON.stringify(account), 'utf-8')
	}

	protected async updateAccountLastUsed(namespaceId: string, lastUsed: number): Promise<Account | undefined> {
		// Re-read from disk before updating, in case an external app modified account.json (e.g. set authorized)
		const account = await this.readAccount(namespaceId)
		account.lastUsed = Math.max(account.lastUsed, lastUsed)
		await this.writeAccount(account)
		return account
	}

	protected async updateAccountLastCleanupTime(
		namespaceId: string,
		lastCleanupTime: number
	): Promise<Account | undefined> {
		// Re-read fresh account before updating lastCleanupTime:
		const freshAccount = await this.readAccount(namespaceId)
		freshAccount.lastCleanupTime = lastCleanupTime
		await this.writeAccount(freshAccount)
		return freshAccount
	}

	protected async tryClaimAccountForRemoval(namespaceId: string, maxLastUsed: number): Promise<boolean> {
		let freshAccount: Account
		try {
			freshAccount = await this.readAccount(namespaceId)
		} catch {
			return false
		}
		if (freshAccount.authorized || freshAccount.lastUsed >= maxLastUsed) {
			return false
		}
		await this.deleteAccount(namespaceId)
		return true
	}

	protected async tryClaimAccountForGraphicsCleanup(
		namespaceId: string,
		maxLastUsed: number,
		cleanupTime: number
	): Promise<Account | undefined> {
		let freshAccount: Account
		try {
			freshAccount = await this.readAccount(namespaceId)
		} catch {
			return undefined
		}
		if (
			freshAccount.authorized ||
			freshAccount.lastUsed >= maxLastUsed ||
			(freshAccount.lastCleanupTime && freshAccount.lastCleanupTime >= freshAccount.lastUsed)
		) {
			return undefined
		}
		freshAccount.lastCleanupTime = cleanupTime
		await this.writeAccount(freshAccount)
		return freshAccount
	}

	protected async deleteAccount(namespaceId: string): Promise<void> {
		await fs.promises.rm(this.namespaceFolderPath(namespaceId), {
			recursive: true,
			force: true,
		})
	}

	protected async cleanupNamespaceGraphicsFallback(namespaceId: string): Promise<void> {
		const graphicsPath = this.graphicsFolderPath(namespaceId)
		if (await this.fsExists(graphicsPath)) {
			const entries = await fs.promises.readdir(graphicsPath)
			for (const entry of entries) {
				await fs.promises.rm(path.join(graphicsPath, entry), {
					recursive: true,
					force: true,
				})
			}
		}
	}

	private async fsExists(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.R_OK)
			return true
		} catch {
			return false
		}
	}
}

export class MongoAccountStore extends BaseAccountStore {
	public readonly enable: boolean
	private client: MongoClient | undefined
	private collection: Collection<Account> | undefined
	private connectPromise: Promise<Collection<Account>> | undefined

	constructor(config: ConfigOptions) {
		super(config)
		this.enable = typeof this.config.mongodbUri === 'string'
	}

	private get mongodbUri(): string {
		if (typeof this.config.mongodbUri !== 'string') {
			throw new Error('Internal Error: MongoAccountStore is not enabled. Check MONGODB_URI env variable.')
		}
		return this.config.mongodbUri
	}

	public override async init(): Promise<void> {
		if (!this.enable) return
		await this.getCollection()
	}

	public override async destroy(): Promise<void> {
		if (this.client) {
			await this.client.close()
			this.client = undefined
			this.collection = undefined
			this.connectPromise = undefined
		}
	}

	private async getCollection(): Promise<Collection<Account>> {
		if (this.collection) return this.collection
		if (this.connectPromise) return this.connectPromise

		this.connectPromise = (async () => {
			const client = new MongoClient(this.mongodbUri)
			await client.connect()

			const dbName = this.resolveDbName(client)
			const db = client.db(dbName)
			const collectionName = this.config.mongodbCollection || 'accounts'
			const collection = db.collection<Account>(collectionName)

			await collection.createIndex({ namespaceId: 1 }, { unique: true })

			this.client = client
			this.collection = collection
			return collection
		})()

		try {
			return await this.connectPromise
		} catch (err) {
			this.connectPromise = undefined
			throw err
		}
	}

	private resolveDbName(client: MongoClient): string {
		if (this.config.mongodbDbName) return this.config.mongodbDbName
		const uriDbName = client.options?.dbName
		if (uriDbName && uriDbName !== 'test') return uriDbName
		// Check if URI explicitly specified "/test":
		try {
			const parsed = new URL(this.mongodbUri)
			const pathName = parsed.pathname.replace(/^\/+/, '')
			if (pathName) return pathName
		} catch {
			// Ignore URL parse error for mongodb+srv or complex connection strings
		}
		return 'ograf-server'
	}

	protected async checkAccountExists(namespaceId: string): Promise<boolean> {
		const col = await this.getCollection()
		const count = await col.countDocuments({ namespaceId }, { limit: 1 })
		return count > 0
	}

	protected async createAccount(account: Account): Promise<void> {
		const col = await this.getCollection()
		await col.insertOne({ ...account })
	}

	protected async readAccount(namespaceId: string): Promise<Account> {
		const col = await this.getCollection()
		const account = await col.findOne({ namespaceId }, { projection: { _id: 0 } })
		if (!account) {
			throw new Error(`Account not found for namespace "${namespaceId}"`)
		}
		return account
	}

	protected async writeAccount(account: Account): Promise<void> {
		const col = await this.getCollection()
		await col.replaceOne({ namespaceId: account.namespaceId }, { ...account }, { upsert: true })
	}

	protected async updateAccountLastUsed(namespaceId: string, lastUsed: number): Promise<Account | undefined> {
		const col = await this.getCollection()
		// Use $max so concurrent multi-process updates never move lastUsed backwards:
		const updated = await col.findOneAndUpdate(
			{ namespaceId },
			{ $max: { lastUsed } },
			{ returnDocument: 'after', projection: { _id: 0 } }
		)
		return updated ?? undefined
	}

	protected async updateAccountLastCleanupTime(
		namespaceId: string,
		lastCleanupTime: number
	): Promise<Account | undefined> {
		const col = await this.getCollection()
		const updated = await col.findOneAndUpdate(
			{ namespaceId },
			{ $set: { lastCleanupTime } },
			{ returnDocument: 'after', projection: { _id: 0 } }
		)
		return updated ?? undefined
	}

	protected async tryClaimAccountForRemoval(namespaceId: string, maxLastUsed: number): Promise<boolean> {
		const col = await this.getCollection()
		const deleted = await col.findOneAndDelete({
			namespaceId,
			authorized: { $ne: true },
			lastUsed: { $lt: maxLastUsed },
		})
		return deleted !== null
	}

	protected async tryClaimAccountForGraphicsCleanup(
		namespaceId: string,
		maxLastUsed: number,
		cleanupTime: number
	): Promise<Account | undefined> {
		const col = await this.getCollection()
		const updated = await col.findOneAndUpdate(
			{
				namespaceId,
				authorized: { $ne: true },
				lastUsed: { $lt: maxLastUsed },
				$expr: {
					$or: [{ $eq: [{ $ifNull: ['$lastCleanupTime', null] }, null] }, { $lt: ['$lastCleanupTime', '$lastUsed'] }],
				},
			},
			{ $set: { lastCleanupTime: cleanupTime } },
			{ returnDocument: 'after', projection: { _id: 0 } }
		)
		return updated ?? undefined
	}

	protected async listAccounts(): Promise<Account[]> {
		const col = await this.getCollection()
		return col.find({}, { projection: { _id: 0 } }).toArray()
	}

	protected async deleteAccount(namespaceId: string): Promise<void> {
		const col = await this.getCollection()
		await col.deleteOne({ namespaceId })
	}

	protected async cleanupNamespaceGraphicsFallback(_namespaceId: string): Promise<void> {
		// Handled by Namespaces via onCleanupGraphics callback
	}
}

/** Backwards-compatible alias for FileAccountStore */
export class AccountStore extends FileAccountStore {}

export function createAccountStore(config: ConfigOptions): BaseAccountStore {
	if (typeof config.mongodbUri === 'string') {
		return new MongoAccountStore(config)
	}
	return new FileAccountStore(config)
}
