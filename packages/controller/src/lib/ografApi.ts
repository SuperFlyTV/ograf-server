import { sentCommandsStore } from '../stores/sentCommands.js'
import { assertNever } from './lib.js'
import { ServerApi } from 'ograf'

// --------- This class is written based on the types in ./ograf/server-api.d.ts, --------
// ---------    If the types are updated, ensure to update this class as well.    --------

export class OgrafApi {
	static instance: OgrafApi | undefined
	static getSingleton(): OgrafApi {
		if (!OgrafApi.instance) {
			OgrafApi.instance = new OgrafApi()
		}
		return OgrafApi.instance
	}

	private BASE_URL_TEMPLATE = 'http://ograf-server/'

	public baseURL = ''

	async fetch<
		Method extends {
			responses: {
				[url: number]: any
			}
		},
	>(
		url: URL,
		recurring: boolean,
		options?: RequestInit
	): Promise<{
		status: keyof Method['responses']
		content: any
	}> {
		try {
			let baseUrl = this.baseURL
			if (!baseUrl.endsWith('/')) baseUrl += '/'
			const url0 = url.toString().replace(this.BASE_URL_TEMPLATE, '')
			const fullUrl = baseUrl + url0

			options = options ?? {}
			options.signal = AbortSignal.timeout(3000)

			const headers: any = options.headers ?? {}
			headers['Content-Type'] = 'application/json'
			options.headers = headers

			// let recurring = false;
			const method = (options.method ?? 'GET').toUpperCase()

			// if (
			//   method === "GET" &&
			//   (url0 === "" || url0 === "graphics" || url0 === "renderers")
			// ) {
			//   recurring = true;
			// }
			const cmd = sentCommandsStore.addCommand({
				recurring,
				method,
				body: JSON.stringify(options.body),
				url: '/' + url0,
			})

			try {
				const response = await fetch(fullUrl, options)

				const json = await response.json()
				cmd.updateResponse(response.status, JSON.stringify(json, null, 2))

				return {
					status: response.status as keyof Method['responses'],
					content: json,
				}
			} catch (e) {
				cmd.updateResponse(0, `Error: ${e}`)
				throw e
			}
		} catch (e) {
			console.error('Error when fetching URL:', url.toString())
			console.error(e)
			throw e
		}
	}

	async getServerInfo(): Promise<
		| {
				status: 200
				content: ServerApi.paths['/']['get']['responses'][200]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/']['get']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url, this.BASE_URL_TEMPLATE)

		const response = await this.fetch<Method>(url0, true)

		if (response.status === 200) {
			return {
				status: response.status,
				content: response.content as Method['responses'][typeof response.status]['content']['application/json'],
			}
		} else if (response.status === 500) {
			return {
				status: response.status,
				content: response.content as Method['responses'][typeof response.status]['content']['application/json'],
			}
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async listGraphics(): Promise<
		| {
				status: 200
				content: ServerApi.paths['/graphics']['get']['responses'][200]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/graphics']['get']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/graphics'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url, this.BASE_URL_TEMPLATE)
		const response = await this.fetch<Method>(url0, true)

		if (response.status === 200) {
			return {
				status: response.status,
				content: response.content as Method['responses'][typeof response.status]['content']['application/json'],
			}
		} else if (response.status === 500) {
			return {
				status: response.status,
				content: response.content as Method['responses'][typeof response.status]['content']['application/json'],
			}
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async getGraphic(params: ServerApi.paths['/graphics/{graphicId}']['get']['parameters']['path']): Promise<
		| {
				status: 200
				content: ServerApi.paths['/graphics/{graphicId}']['get']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/graphics/{graphicId}']['get']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/graphics/{graphicId}']['get']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/graphics/{graphicId}'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url.replace('{graphicId}', params.graphicId), this.BASE_URL_TEMPLATE)

		const response = await this.fetch<Method>(url0, true)

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return {
				status: response.status,
				content: response.content,
			}
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async deleteGraphic(params: ServerApi.paths['/graphics/{graphicId}']['delete']['parameters']['path']): Promise<
		| {
				status: 200
				content: ServerApi.paths['/graphics/{graphicId}']['delete']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/graphics/{graphicId}']['delete']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/graphics/{graphicId}']['delete']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/graphics/{graphicId}'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url.replace('{graphicId}', params.graphicId), this.BASE_URL_TEMPLATE)

		const response = await this.fetch<Method>(url0, false, {
			method: 'DELETE',
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return {
				status: response.status,
				content: response.content,
			}
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async listRenderers(): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers']['get']['responses'][200]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers']['get']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url, this.BASE_URL_TEMPLATE)

		const response = await this.fetch<Method>(url0, true)

		if (response.status === 200 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async getRenderer(params: ServerApi.paths['/renderers/{rendererId}']['get']['parameters']['path']): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}']['get']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}']['get']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}']['get']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)

		const response = await this.fetch<Method>(url0, true)

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async getRenderTarget(
		params: ServerApi.paths['/renderers/{rendererId}/target']['get']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target']['get']['parameters']['query']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target']['get']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target']['get']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target']['get']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target'
		type Method = ServerApi.paths[typeof url]['get']

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))

		const response = await this.fetch<Method>(url0, true, {})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async rendererInvokeCustomAction(
		params: ServerApi.paths['/renderers/{rendererId}/customActions/{customActionId}']['post']['parameters']['path'],
		body: ServerApi.paths['/renderers/{rendererId}/customActions/{customActionId}']['post']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/customActions/{customActionId}']['post']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/customActions/{customActionId}']['post']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/customActions/{customActionId}']['post']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/customActions/{customActionId}'
		type Method = ServerApi.paths[typeof url]['post']

		const url0 = new URL(
			url.replace('{rendererId}', params.rendererId).replace('{customActionId}', params.customActionId),
			this.BASE_URL_TEMPLATE
		)

		const response = await this.fetch<Method>(url0, false, {
			method: 'POST',
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicClear(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/clear']['put']['parameters']['path'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/clear']['put']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/clear']['put']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/clear']['put']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/clear']['put']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/clear'
		type Method = ServerApi.paths[typeof url]['put']

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)

		const response = await this.fetch<Method>(url0, false, {
			method: 'put',
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicLoad(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/load']['put']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/load']['put']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/load']['put']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/load']['put']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/load']['put']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/load']['put']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/load'
		type Method = ServerApi.paths[typeof url]['put']

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))

		const response = await this.fetch<Method>(url0, false, {
			method: 'put',
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicUpdate(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/updateAction']['post']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/updateAction']['post']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/updateAction']['post']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/updateAction']['post']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/updateAction']['post']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/updateAction']['post']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/updateAction'
		const method = 'post'
		type Method = ServerApi.paths[typeof url][typeof method]

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))
		url0.searchParams.set('graphicTarget', JSON.stringify(query.graphicTarget))

		const response = await this.fetch<Method>(url0, false, {
			method,
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicPlay(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/playAction']['post']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/playAction']['post']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/playAction']['post']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/playAction']['post']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/playAction']['post']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/playAction']['post']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/playAction'
		const method = 'post'
		type Method = ServerApi.paths[typeof url][typeof method]

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))
		url0.searchParams.set('graphicTarget', JSON.stringify(query.graphicTarget))

		const response = await this.fetch<Method>(url0, false, {
			method,
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicStop(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/stopAction']['post']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/stopAction']['post']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/stopAction']['post']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/stopAction']['post']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/stopAction']['post']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/stopAction']['post']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/stopAction'
		const method = 'post'
		type Method = ServerApi.paths[typeof url][typeof method]

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))
		url0.searchParams.set('graphicTarget', JSON.stringify(query.graphicTarget))

		const response = await this.fetch<Method>(url0, false, {
			method,
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicInvokeCustomAction(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/customAction']['post']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/customAction']['post']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/customAction']['post']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/customAction']['post']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/customAction']['post']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/customAction']['post']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/customAction'
		const method = 'post'
		type Method = ServerApi.paths[typeof url][typeof method]

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))
		url0.searchParams.set('graphicTarget', JSON.stringify(query.graphicTarget))

		const response = await this.fetch<Method>(url0, false, {
			method,
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicGoToTime(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/goToTime']['put']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/goToTime']['put']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/goToTime']['put']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/goToTime']['put']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/goToTime']['put']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/goToTime']['put']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/goToTime'
		const method = 'put'
		type Method = ServerApi.paths[typeof url][typeof method]

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))
		url0.searchParams.set('graphicTarget', JSON.stringify(query.graphicTarget))

		const response = await this.fetch<Method>(url0, false, {
			method,
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
	async renderTargetGraphicSetActionsSchedule(
		params: ServerApi.paths['/renderers/{rendererId}/target/graphic/setActionsSchedule']['put']['parameters']['path'],
		query: ServerApi.paths['/renderers/{rendererId}/target/graphic/setActionsSchedule']['put']['parameters']['query'],
		body: ServerApi.paths['/renderers/{rendererId}/target/graphic/setActionsSchedule']['put']['requestBody']['content']['application/json']
	): Promise<
		| {
				status: 200
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/setActionsSchedule']['put']['responses'][200]['content']['application/json']
		  }
		| {
				status: 404
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/setActionsSchedule']['put']['responses'][404]['content']['application/json']
		  }
		| {
				status: 500
				content: ServerApi.paths['/renderers/{rendererId}/target/graphic/setActionsSchedule']['put']['responses'][500]['content']['application/json']
		  }
	> {
		const url = '/renderers/{rendererId}/target/graphic/setActionsSchedule'
		const method = 'put'
		type Method = ServerApi.paths[typeof url][typeof method]

		const url0 = new URL(url.replace('{rendererId}', params.rendererId), this.BASE_URL_TEMPLATE)
		url0.searchParams.set('renderTarget', JSON.stringify(query.renderTarget))
		url0.searchParams.set('graphicTarget', JSON.stringify(query.graphicTarget))

		const response = await this.fetch<Method>(url0, false, {
			method,
			body: JSON.stringify(body),
		})

		if (response.status === 200 || response.status === 404 || response.status === 500) {
			return response
		} else {
			assertNever(response.status)
			throw new Error(`Unexpected response: ${response.status}: ${JSON.stringify(response.content)}`)
		}
	}
}
