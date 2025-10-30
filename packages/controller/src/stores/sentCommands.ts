import { action, makeObservable, observable } from 'mobx'

class SentCommands {
	public sentCommands: SentCommand[] = []
	private uniqueI = 0
	constructor() {
		makeObservable(this, {
			sentCommands: observable,
		})
	}
	addCommand = action((cmd: Omit<SentCommand, 'key'>) => {
		const c = {
			...cmd,
			key: `${this.uniqueI++}`,
		}
		this.sentCommands.push(c)

		if (this.sentCommands.length > 200) {
			this.sentCommands.splice(0, this.sentCommands.length - 200)
		}

		return {
			updateResponse: action((status: number, body: string) => {
				const index = this.sentCommands.findIndex((sc) => sc.key === c.key)
				if (index === -1) return

				this.sentCommands.splice(index, 1, {
					...c,
					responseStatus: status,
					responseBody: body,
				})
			}),
		}
	})
}
export interface SentCommand {
	key: string
	url: string
	method: string
	body: string
	recurring: boolean
	responseStatus?: number
	responseBody?: string
}

export const sentCommandsStore = new SentCommands()
