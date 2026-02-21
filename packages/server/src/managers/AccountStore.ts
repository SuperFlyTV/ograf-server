import fs from 'fs'
import path from 'path'
import { NAMESPACE_SETTINGS } from '../namespace.js'
import { createLongNameId } from 'mnemonic-id'
import { MapTTL } from '../lib/MapTTL.js'

// Note: This is a very basic implementation of the AccountStore
// that stores namespaces as folders on the file system.
// We will probably want to replace this with a more robust implementation in the future, but this should be sufficient for now.

export class AccountStore {
	private CACHE_TTL = 1000 * 3600 // 1 hour
	private accountsCache = new MapTTL<string, Account>(this.CACHE_TTL) // Cache accounts for 1 hour

	public readonly enable: boolean

	constructor() {
		this.enable = typeof NAMESPACE_SETTINGS?.namespacePath === 'string'

		if (!this.enable) return
		// Ensure the directory exists
		fs.mkdirSync(this.folderPath, { recursive: true })
	}

	private get folderPath(): string {
		if (typeof NAMESPACE_SETTINGS?.namespacePath !== 'string')
			throw new Error('Internal Error: NamespaceStore is not enabled. Check env variables.')

		return NAMESPACE_SETTINGS.namespacePath
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
		return this.fsExists(this.namespaceFolderPath(namespaceId))
	}
	public async register(email: string): Promise<string> {
		for (let i = 0; i < 100; i++) {
			const namespaceId = createLongNameId()
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

		const namespaceIds = await fs.promises.readdir(this.folderPath)
		const accounts: Account[] = []
		for (const namespaceId of namespaceIds) {
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
			account = await this.readAccount(namespaceId)
		}
		if (account.lastUsed > Date.now() - this.CACHE_TTL) return // No need to update lastUsed

		account.lastUsed = Date.now()
		await this.writeAccount(account)
		this.accountsCache.set(namespaceId, account) // Cache the updated account, so that subsequent calls to touchAccount within the next hour won't hit the file system again
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
}
