import { getNameSpaceId } from '../lib/namespace.js'

export class DB {
	private dbName = 'ograf-controller-ai-audio-db-' + getNameSpaceId()
	private dbVersion = 1

	private db: IDBDatabase | null = null

	async init(): Promise<void> {
		if (this.db) return

		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open(this.dbName, this.dbVersion)

			request.onerror = (event) => {
				console.error('Database error:', event)
				reject(new Error('Error opening database'))
			}

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result
				resolve()
			}

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result

				if (!db.objectStoreNames.contains('settings')) {
					db.createObjectStore('settings')
				}
			}
		})
	}

	async getSetting<T>(key: string): Promise<T | undefined> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject(new Error('DB not initialized'))
			const transaction = this.db.transaction(['settings'], 'readonly')
			const store = transaction.objectStore('settings')
			const request = store.get(key)
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve(request.result as T | undefined)
		})
	}

	async setSetting<T>(key: string, value: T): Promise<void> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject(new Error('DB not initialized'))
			const transaction = this.db.transaction(['settings'], 'readwrite')
			const store = transaction.objectStore('settings')
			const request = store.put(value, key)
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve()
		})
	}

	async clearAll(): Promise<void> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject(new Error('DB not initialized'))
			const storeNames = Array.from(this.db.objectStoreNames)
			if (storeNames.length === 0) {
				return resolve()
			}
			const transaction = this.db.transaction(storeNames, 'readwrite')
			for (const storeName of storeNames) {
				transaction.objectStore(storeName).clear()
			}
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
			transaction.onerror = () => reject(transaction.error)
			transaction.oncomplete = () => resolve()
		})
	}
}

export const dbStore = new DB()
