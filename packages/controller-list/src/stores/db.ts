export class DB {
	private dbName = 'ograf-controller-list-db'
	private dbVersion = 1

	private db: IDBDatabase | null = null

	async init(): Promise<void> {
		if (this.db) return

		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open(this.dbName, this.dbVersion)

			request.onerror = (event) => {
				console.error('Database error:', event)
				reject('Error opening database')
			}

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result
				resolve()
			}

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result

				if (!db.objectStoreNames.contains('settings')) {
					db.createObjectStore('settings') // Key-value store
				}

				if (!db.objectStoreNames.contains('queuedGraphics')) {
					db.createObjectStore('queuedGraphics', { keyPath: 'id' }) // Store with objects that have an 'id'
				}
			}
		})
	}

	async getSetting<T>(key: string): Promise<T | undefined> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject('DB not initialized')
			const transaction = this.db.transaction(['settings'], 'readonly')
			const store = transaction.objectStore('settings')
			const request = store.get(key)
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve(request.result as T | undefined)
		})
	}

	async setSetting<T>(key: string, value: T): Promise<void> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject('DB not initialized')
			const transaction = this.db.transaction(['settings'], 'readwrite')
			const store = transaction.objectStore('settings')
			const request = store.put(value, key)
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve()
		})
	}

	async getAllQueuedGraphics<T>(): Promise<T[]> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject('DB not initialized')
			const transaction = this.db.transaction(['queuedGraphics'], 'readonly')
			const store = transaction.objectStore('queuedGraphics')
			const request = store.getAll()
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve(request.result as T[])
		})
	}

	async putQueuedGraphic<T>(item: T): Promise<void> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject('DB not initialized')
			const transaction = this.db.transaction(['queuedGraphics'], 'readwrite')
			const store = transaction.objectStore('queuedGraphics')
			const request = store.put(item)
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve()
		})
	}

	async removeQueuedGraphic(id: string): Promise<void> {
		await this.init()
		return new Promise((resolve, reject) => {
			if (!this.db) return reject('DB not initialized')
			const transaction = this.db.transaction(['queuedGraphics'], 'readwrite')
			const store = transaction.objectStore('queuedGraphics')
			const request = store.delete(id)
			request.onerror = () => reject(request.error)
			request.onsuccess = () => resolve()
		})
	}
}

export const dbStore = new DB()
