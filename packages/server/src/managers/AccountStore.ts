import fs from 'fs'
import path from 'path'
import { MapTTL } from '../lib/MapTTL.js'
import { getMnemonicId } from '../lib/mnemonicId.js'
import { ConfigOptions } from '../config.js'

// Note: This is a very basic implementation of the AccountStore
// that stores namespaces as folders on the file system.
// We will probably want to replace this with a more robust implementation in the future, but this should be sufficient for now.

export class AccountStore {
	private CACHE_TTL: number
	private accountsCache: MapTTL<string, Account>

	public readonly enable: boolean

	constructor(private config: ConfigOptions) {
		this.enable = typeof this.config.namespacePath === 'string'

		const minCleanupMs = Math.min(
			this.config.cleanupGraphics ? this.config.cleanupGraphics * 1000 : Infinity,
			this.config.cleanupAccount ? this.config.cleanupAccount * 1000 : Infinity
		)
		this.CACHE_TTL = Math.max(1000, Math.min(1000 * 3600, Math.floor(minCleanupMs / 2)))
		this.accountsCache = new MapTTL<string, Account>(this.CACHE_TTL)

		if (!this.enable) return
		// Ensure the directory exists
		fs.mkdirSync(this.folderPath, { recursive: true })
	}

	public get cleanupIntervalMs(): number {
		const minCleanupMs = Math.min(
			this.config.cleanupGraphics ? this.config.cleanupGraphics * 1000 : Infinity,
			this.config.cleanupAccount ? this.config.cleanupAccount * 1000 : Infinity
		)
		return Math.max(1000, Math.min(5 * 60 * 1000, Math.floor(minCleanupMs / 2)))
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

	public async exists(namespaceId: string): Promise<boolean> {
		return this.fsExists(this.accountFilePath(namespaceId))
	}
	public async registerNewNamespace(email: string): Promise<string> {
		for (let i = 0; i < 100; i++) {
			const namespaceId = getMnemonicId()
			// check if namespace exists:
			if (await this.fsExists(this.namespaceFolderPath(namespaceId))) continue // try another id

			// Create namespace folders:
			await fs.promises.mkdir(this.namespaceFolderPath(namespaceId))
			await fs.promises.mkdir(this.graphicsFolderPath(namespaceId))
			// Store account info:
			const account: Account = {
				createdAt: Date.now(),
				createdAtStr: new Date().toISOString(),
				lastUsed: Date.now(),
				email,
				namespaceId,
			}
			await this.writeAccount(account)
			this.accountsCache.set(namespaceId, account) // Cache the account we just created

			return namespaceId
		}
		throw new Error('Failed to generate unique namespace id. Please try again.')
	}
	public async list(): Promise<Account[]> {
		if (!this.enable) return []

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
	public async touchAccount(namespaceId: string): Promise<void> {
		if (!this.enable) return

		let account = this.accountsCache.get(namespaceId)

		if (!account) {
			try {
				account = await this.readAccount(namespaceId)
			} catch {
				return
			}
			this.accountsCache.set(namespaceId, account)
		}
		if (account.lastUsed > Date.now() - this.CACHE_TTL) return // No need to update lastUsed

		// Re-read from disk before updating, in case an external app modified account.json (e.g. set authorized)
		try {
			account = await this.readAccount(namespaceId)
		} catch {
			return
		}
		account.lastUsed = Date.now()
		await this.writeAccount(account)
		this.accountsCache.set(namespaceId, account) // Cache the updated account, so that subsequent calls to touchAccount within the next hour won't hit the file system again
	}
	public async cleanUpAccounts(onRemoveNamespace?: (namespaceId: string) => void): Promise<void> {
		if (!this.enable) return

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
					onRemoveNamespace?.(account.namespaceId)
					this.accountsCache.delete(account.namespaceId)
					await fs.promises.rm(this.namespaceFolderPath(account.namespaceId), {
						recursive: true,
						force: true,
					})
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
					const graphicsPath = this.graphicsFolderPath(account.namespaceId)
					if (await this.fsExists(graphicsPath)) {
						const entries = await fs.promises.readdir(graphicsPath)
						for (const entry of entries) {
							await fs.promises.rm(path.join(graphicsPath, entry), {
								recursive: true,
								force: true,
							})
						}
					}
					// Re-read fresh account before updating lastCleanupTime:
					const freshAccount = await this.readAccount(account.namespaceId)
					freshAccount.lastCleanupTime = Date.now()
					await this.writeAccount(freshAccount)
					this.accountsCache.set(account.namespaceId, freshAccount)
					console.log(`Cleaned up graphics for unused namespace "${account.namespaceId}"`)
				} catch (err) {
					console.error(`Failed to clean up graphics for namespace ${account.namespaceId}:`, err)
				}
			}
		}
	}
	private async readAccount(namespaceId: string): Promise<Account> {
		const accountData = await fs.promises.readFile(this.accountFilePath(namespaceId), 'utf-8')
		return JSON.parse(accountData) as Account
	}
	private async writeAccount(account: Account): Promise<void> {
		return fs.promises.writeFile(this.accountFilePath(account.namespaceId), JSON.stringify(account), 'utf-8')
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
