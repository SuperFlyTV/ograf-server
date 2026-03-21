export class GraphicInstanceError extends Error {
	public statusCode: 500 | 550 = 550
	constructor(originalError: unknown) {
		if (originalError instanceof Error) {
			super(originalError.message)
			this.stack = originalError.stack
		} else if (originalError instanceof GraphicInstanceError) {
			super(originalError.message)
			this.stack = originalError.stack
			this.statusCode = originalError.statusCode
		} else {
			super(`${originalError}`)
		}
		this.name = 'GraphicInstanceError'
	}
}
