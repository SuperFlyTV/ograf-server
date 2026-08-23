/** Like Map(), but values are removed after a while */
export class MapTTL<K, T> {
	private map = new Map<K, { value: T; expireTime: number }>()
	private onRemoveCallback: (key: K, value: T) => void = () => {}

	constructor(private defaultTTL: number) {}
	public onRemove(cb: (key: K, value: T) => void): void {
		this.onRemoveCallback = cb
	}
	public set(key: K, value: T, ttl?: number): this {
		const expireTime = Date.now() + (ttl ?? this.defaultTTL)
		this.map.set(key, { value, expireTime })
		return this
	}
	public get(key: K): T | undefined {
		const entry = this.map.get(key)
		if (!entry) return undefined
		if (Date.now() > entry.expireTime) {
			this.onRemoveCallback(key, entry.value)
			this.map.delete(key)
			return undefined
		}
		return entry.value
	}
	public has(key: K): boolean {
		const entry = this.map.get(key)
		if (!entry) return false
		if (Date.now() > entry.expireTime) {
			this.onRemoveCallback(key, entry.value)
			this.map.delete(key)
			return false
		}
		return true
	}
	public delete(key: K): boolean {
		const entry = this.map.get(key)
		if (entry) this.onRemoveCallback(key, entry.value)
		return this.map.delete(key)
	}
	public clear(): void {
		this.map.clear()
	}
	public size(): number {
		// Clean up expired entries before returning size
		this.cleanup()
		return this.map.size
	}
	public keys(): Array<K> {
		return this.entries().map((entry) => entry[0])
	}
	public values(): Array<T> {
		return this.entries().map((entry) => entry[1])
	}
	public entries(): Array<[K, T]> {
		const now = Date.now()
		const entries: Array<[K, T]> = []
		for (const [key, entry] of this.map.entries()) {
			if (now > entry.expireTime) {
				this.onRemoveCallback(key, entry.value)
				this.map.delete(key)
			} else entries.push([key, entry.value])
		}
		return entries
	}
	private cleanup(): void {
		const now = Date.now()
		for (const [key, entry] of this.map.entries()) {
			if (now > entry.expireTime) {
				this.onRemoveCallback(key, entry.value)
				this.map.delete(key)
			}
		}
	}
}
