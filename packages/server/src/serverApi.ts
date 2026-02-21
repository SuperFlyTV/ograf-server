import Router from '@koa/router'
import multer from '@koa/multer'
import { ServerApi } from 'ograf'
import { CTX } from './lib/lib.js'
import { GraphicsStore } from './managers/GraphicsStore.js'
import { RendererManager } from './managers/RendererManager.js'
import {
	CustomActionId,
	CustomActionParams,
	GraphicFilter,
	GraphicId,
	GraphicInstanceId,
	PlayActionParams,
	RendererId,
	RenderTargetIdentifier,
	StopActionParams,
	UpdateActionParams,
} from './types/OpenApiTypes.js'
import { z, ZodError } from 'zod/v4'
import { ErrorReturnValue, GraphicInstanceError } from '@ograf-server/shared'
import { JSONRPCErrorException } from 'json-rpc-2.0'
import { NAMESPACE_SETTINGS } from './namespace.js'
import { AccountStore } from './managers/AccountStore.js'
const upload = multer({
	storage: multer.diskStorage({
		// destination: './localGraphicsStorage',
	}),
})

export function setupServerApi(
	router: Router,
	graphicsStore: GraphicsStore,
	accountStore: AccountStore,
	rendererManager: RendererManager
): void {
	// type Manifest = ServerApi.components["schemas"]["Manifest"];

	router.get(getOgrafApiUrl('/'), (ctx: CTX) => {
		type Method = ServerApi.paths['/']['get']
		try {
			// const request: Request<Method> = getRequestObject(ctx);
			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						name: 'Simple OGraf Server',
						author: {
							name: 'SuperFly.tv',
							url: 'https://github.com/SuperFlyTV/ograf-server',
						},
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})

	router.get(getOgrafApiUrl('/graphics'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/graphics']['get']
		try {
			// const request: Request<Method> = getRequestObject(ctx);

			const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
			const list = await graphicsNs.listGraphics()

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						graphics: list,
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})

	router.get(getOgrafApiUrl('/graphics/{graphicId}'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/graphics/{graphicId}']['get']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						graphicId: GraphicId,
					}),
				}),
				requestBody: z.any(),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>
			const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
			const graphicInfo = await graphicsNs.getGraphicInfo(request.parameters.path.graphicId)

			if (!graphicInfo) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Graphic not found',
						},
					},
				})
			}

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						graphic: graphicInfo.graphic,
						metadata: graphicInfo.metadata,
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})
	router.delete(getOgrafApiUrl('/graphics/{graphicId}'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/graphics/{graphicId}']['delete']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						graphicId: GraphicId,
					}),
					query: z.optional(
						z.object({
							force: z.optional(z.boolean()),
						})
					),
				}),
				requestBody: z.any(),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>
			const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
			const found = await graphicsNs.deleteGraphic(request.parameters.path.graphicId, request.parameters.query?.force)

			if (!found) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Graphic not found',
						},
					},
				})
			}

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})

	router.get(getOgrafApiUrl('/renderers'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers']['get']
		try {
			const renderers = await rendererManager.listRenderers()

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						renderers: renderers.map((r) => ({
							id: r.id,
							name: r.name,
							description: r.description,
						})),
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})
	router.get(getOgrafApiUrl('/renderers/{rendererId}'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}']['get']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
				}),
				requestBody: z.any(),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)

			if (!rendererInstance?.info) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			await rendererInstance.updateInfo()

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						renderer: rendererInstance.info,
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})
	router.get(getOgrafApiUrl('/renderers/{rendererId}/target'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/target']['get']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
					query: z.object({
						renderTarget: RenderTargetIdentifier,
					}),
				}),
				requestBody: z.any(),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)

			if (!rendererInstance?.info) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.getTargetStatus({
				renderTarget: request.parameters.query.renderTarget,
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						renderTarget: result.renderTargetInfo,
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})
	router.post(getOgrafApiUrl('/renderers/{rendererId}/customActions/{customActionId}'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/customActions/{customActionId}']['post']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
						customActionId: z.string(),
					}),
				}),
				requestBody: z.object({
					content: z.object({
						'application/json': z.object({
							payload: z.unknown(),
						}),
					}),
				}),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)

			if (!rendererInstance) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.invokeRendererAction({
				action: {
					id: request.parameters.path.customActionId,
					payload: request.requestBody.content['application/json'].payload,
				},
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						result: result.value,
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})
	router.put(getOgrafApiUrl('/renderers/{rendererId}/target/graphicInstance/clear'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/target/graphicInstance/clear']['put']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
				}),
				requestBody: z.object({
					content: z.object({
						'application/json': z.object({
							filters: z.array(GraphicFilter),
						}),
					}),
				}),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)
			if (!rendererInstance) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.clearGraphics({
				filters: request.requestBody.content['application/json'].filters,
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						graphicInstances: result.graphicInstances.map((graphicInstance) => ({
							renderTarget: graphicInstance.renderTarget,
							graphicInstanceId: graphicInstance.graphicInstanceId,
						})),
					},
				},
			})
		} catch (err) {
			return handleErrorReturn(ctx, err)
		}
	})
	router.post(getOgrafApiUrl('/renderers/{rendererId}/target/graphicInstance/load'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/target/graphicInstance/load']['post']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
				}),
				requestBody: z.object({
					content: z.object({
						'application/json': z.object({
							renderTarget: RenderTargetIdentifier,
							graphicId: GraphicId,
							params: z.object({
								data: z.unknown(),
							}),
						}),
					}),
				}),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)
			if (!rendererInstance) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.loadGraphic({
				renderTarget: request.requestBody.content['application/json'].renderTarget,
				graphicId: request.requestBody.content['application/json'].graphicId,
				params: request.requestBody.content['application/json'].params,
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						...result.result, // To pipe through any vendor specific data
						graphicInstanceId: result.graphicInstanceId,
						statusCode: result.result?.statusCode ?? 200,
						statusMessage: result.result?.statusMessage ?? 'N/A',
					},
				},
			})
		} catch (err) {
			return handleErrorReturn<Method>(ctx, err)
		}
	})
	router.post(getOgrafApiUrl('/renderers/{rendererId}/target/graphicInstance/updateAction'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/target/graphicInstance/updateAction']['post']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
				}),
				requestBody: z.object({
					content: z.object({
						'application/json': z.object({
							renderTarget: RenderTargetIdentifier,
							graphicInstanceId: GraphicInstanceId,
							params: UpdateActionParams,
						}),
					}),
				}),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)
			if (!rendererInstance) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.invokeGraphicUpdateAction({
				renderTarget: request.requestBody.content['application/json'].renderTarget,
				graphicInstanceId: request.requestBody.content['application/json'].graphicInstanceId,
				params: request.requestBody.content['application/json'].params,
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						...result.result, // To pipe through any vendor specific data
						graphicInstanceId: result.graphicInstanceId,
						statusCode: result.result?.statusCode ?? 200,
						statusMessage: result.result?.statusMessage ?? 'N/A',
					},
				},
			})
		} catch (err) {
			return handleErrorReturn<Method>(ctx, err)
		}
	})
	router.post(getOgrafApiUrl('/renderers/{rendererId}/target/graphicInstance/playAction'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/target/graphicInstance/playAction']['post']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
				}),
				requestBody: z.object({
					content: z.object({
						'application/json': z.object({
							renderTarget: RenderTargetIdentifier,
							graphicInstanceId: GraphicInstanceId,
							params: PlayActionParams,
						}),
					}),
				}),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)
			if (!rendererInstance) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.invokeGraphicPlayAction({
				renderTarget: request.requestBody.content['application/json'].renderTarget,
				graphicInstanceId: request.requestBody.content['application/json'].graphicInstanceId,
				params: request.requestBody.content['application/json'].params,
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						...result.result, // To pipe through any vendor specific data
						graphicInstanceId: result.graphicInstanceId,
						statusCode: result.result?.statusCode ?? 200,
						statusMessage: result.result?.statusMessage ?? 'N/A',
					},
				},
			})
		} catch (err) {
			return handleErrorReturn<Method>(ctx, err)
		}
	})
	router.post(getOgrafApiUrl('/renderers/{rendererId}/target/graphicInstance/stopAction'), async (ctx: CTX) => {
		type Method = ServerApi.paths['/renderers/{rendererId}/target/graphicInstance/stopAction']['post']
		try {
			const Req = z.object({
				parameters: z.object({
					path: z.object({
						rendererId: RendererId,
					}),
				}),
				requestBody: z.object({
					content: z.object({
						'application/json': z.object({
							renderTarget: RenderTargetIdentifier,
							graphicInstanceId: GraphicInstanceId,
							params: StopActionParams,
						}),
					}),
				}),
			})

			const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
				typeof Req
			>

			const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)
			if (!rendererInstance) {
				return handleReturn<Method>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'Renderer not found',
						},
					},
				})
			}

			const result = await rendererInstance.api.invokeGraphicStopAction({
				renderTarget: request.requestBody.content['application/json'].renderTarget,
				graphicInstanceId: request.requestBody.content['application/json'].graphicInstanceId,
				params: request.requestBody.content['application/json'].params,
			})

			return handleReturn<Method>(ctx, 200, {
				headers: {},
				content: {
					'application/json': {
						...result.result, // To pipe through any vendor specific data
						graphicInstanceId: result.graphicInstanceId,
						statusCode: result.result?.statusCode ?? 200,
						statusMessage: result.result?.statusMessage ?? 'N/A',
					},
				},
			})
		} catch (err) {
			return handleErrorReturn<Method>(ctx, err)
		}
	})
	router.post(
		getOgrafApiUrl('/renderers/{rendererId}/target/graphicInstance/customActions/{customActionId}'),
		async (ctx: CTX) => {
			type Method =
				ServerApi.paths['/renderers/{rendererId}/target/graphicInstance/customActions/{customActionId}']['post']
			try {
				const Req = z.object({
					parameters: z.object({
						path: z.object({
							rendererId: RendererId,
							customActionId: CustomActionId,
						}),
					}),
					requestBody: z.object({
						content: z.object({
							'application/json': z.object({
								renderTarget: RenderTargetIdentifier,
								graphicInstanceId: GraphicInstanceId,
								params: CustomActionParams,
							}),
						}),
					}),
				})

				const request: Request<Method> = Req.parse(getRequestObject(ctx)) satisfies Request<Method> satisfies z.infer<
					typeof Req
				>

				const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId)
				if (!rendererInstance) {
					return handleReturn<Method>(ctx, 404, {
						headers: {},
						content: {
							'application/json': {
								error: 'Renderer not found',
							},
						},
					})
				}

				const result = await rendererInstance.api.invokeGraphicCustomAction({
					renderTarget: request.requestBody.content['application/json'].renderTarget,
					graphicInstanceId: request.requestBody.content['application/json'].graphicInstanceId,
					params: {
						...request.requestBody.content['application/json'].params,
						id: request.parameters.path.customActionId,
					},
				})

				return handleReturn<Method>(ctx, 200, {
					headers: {},
					content: {
						'application/json': {
							...result.result, // To pipe through any vendor specific data
							graphicInstanceId: result.graphicInstanceId,
							statusCode: result.result?.statusCode ?? 200,
							statusMessage: result.result?.statusMessage ?? 'N/A',
						},
					},
				})
			} catch (err) {
				return handleErrorReturn<Method>(ctx, err)
			}
		}
	)

	// =====================================================================================
	// =======================     Non-spec endpoints:     =================================
	// -------------------------------------------------------------------------------------

	router.get(getFullUrl('/serverApi/internal/graphics/:graphicId/:localPath*'), async (ctx: CTX) => {
		try {
			// Note: We DO serve resources even if the Graphic is marked for removal!

			const Req = z.object({
				graphicId: z.string(),
				localPath: z.string(),
			})

			const params = Req.parse(ctx.params)
			const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
			const resource = await graphicsNs.getGraphicResource(params.graphicId, params.localPath)

			if (!resource) {
				return handleReturn<any>(ctx, 404, {
					headers: {},
					content: {
						'application/json': {
							error: 'File not found',
						},
					},
				})
			}
			// Serve the file:
			ctx.status = 200
			ctx.lastModified = resource.lastModified
			ctx.length = resource.length
			ctx.type = resource.mimeType
			ctx.body = resource.readStream
		} catch (err) {
			return handleErrorReturn<any>(ctx, err)
		}
	})
	router.post(
		getFullUrl(`/serverApi/internal/graphics/graphic`),
		upload.single('graphic'),
		handleError(async (ctx: CTX) => {
			const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
			return graphicsNs.uploadGraphic(ctx)
		})
	)
	router.post(
		getFullUrl(`/serverApi/internal/graphics/graphic`),
		upload.single('graphic'),
		handleError(async (ctx: CTX) => {
			const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
			return graphicsNs.uploadGraphic(ctx)
		})
	)
	if (NAMESPACE_SETTINGS) {
		router.post(
			`/serverApi/internal/registerNamespace`,
			upload.single('graphic'),
			handleError(async (ctx: CTX) => {
				const graphicsNs = await graphicsStore.getNS(ctx.params.namespaceId)
				return graphicsNs.uploadGraphic(ctx)
			})
		)
	}
}

function handleError(fcn: (ctx: CTX) => Promise<void>) {
	return async (ctx: CTX) => {
		try {
			await fcn(ctx)
		} catch (err) {
			console.error(err)
			// Handle internal errors:
			ctx.status = 500
			const body: any = {
				code: 500,
				message: `Internal Error: ${err}`,
			}
			ctx.body = body

			if (err && typeof err === 'object' && err instanceof Error && err.stack) {
				// Note: This is a security risk, as it exposes the stack trace to the client (don't do this in production)
				body.data = { stack: err.stack }
			}
		}
	}
}

type AnyMethod = {
	parameters?:
		| {
				query?: {
					[key: string]: any
				}
				path?: {
					[key: string]: any
				}
				header?: {
					[key: string]: any
				}
				cookie?: {
					[key: string]: any
				}
		  }
		| never
	requestBody?: any
	responses: {
		[status: number]: AnyResponse
	}
}
type AnyResponse = {
	headers: {
		[name: string]: any
	}
	content: {
		'application/json'?: {
			[key: string]: unknown
		}
		'application/octet-stream'?: string
	}
}
type Request<T extends AnyMethod> = {
	parameters: T['parameters']
	requestBody: T['requestBody']
}
function getRequestObject<Method extends AnyMethod>(ctx: CTX): Request<Method> {
	const request: Request<AnyMethod> = {
		parameters: {
			query: ctx.request.query,
			path: ctx.params,
			header: ctx.headers,
			cookie: undefined, // Not implemented
		},
		requestBody: {
			content: {
				'application/json': ctx.request.body,
			},
		},
	}
	// auto-convert any JSON in query:
	if (request.parameters?.query) {
		for (const key of Object.keys(request.parameters.query)) {
			const value = request.parameters.query[key]
			if (typeof value === 'string' && value.trim().startsWith('{')) {
				try {
					request.parameters.query[key] = JSON.parse(value)
				} catch (e) {
					// If parsing fails, keep the original value:
					console.warn(`Failed to parse query parameter ${key}:`, e)
				}
			}
		}
	}

	return request as any
}
function getFullUrl(url: string): string {
	if (NAMESPACE_SETTINGS) {
		return '/api/:namespaceId' + url
	}
	return url
}
function getOgrafApiUrl(openApiUrl: string): string {
	return getFullUrl('/ograf/v1' + openApiUrl.replace(/\{([^}]+)\}/g, ':$1'))
}
function handleReturn<Method extends AnyMethod>(
	ctx: CTX,
	statusCode: keyof Method['responses'],
	returnData: Method['responses'][keyof Method['responses']]
): void {
	const r = returnData as AnyResponse

	// Status code
	ctx.status = Number(statusCode)
	// Headers
	for (const header in r.headers) {
		ctx.set(header, r.headers[header])
	}
	// Body:
	// Serve the correct content type based on the request:
	const contentType = ctx.request.headers['content-type'] || 'application/json'
	for (const [key, value] of Object.entries<any>(r.content)) {
		if (key === contentType) {
			ctx.body = value
			break
		}
	}
	// If no contentType is matching, fall back to whatever is provided:
	if (!ctx.body) {
		for (const value of Object.values<any>(r.content)) {
			if (value !== undefined) {
				ctx.body = value
				break
			}
		}
	}
}

type AnyMethodErrorResponse = {
	responses: {
		500: {
			headers: {
				[name: string]: unknown
			}
			content: {
				'application/json': ServerApi.components['schemas']['ErrorResponse']
			}
		}
		550: {
			headers: {
				[name: string]: unknown
			}
			content: {
				'application/json': ServerApi.components['schemas']['ErrorResponse']
			}
		}
	}
}
function handleErrorReturn<_Method extends AnyMethodErrorResponse>(ctx: CTX, err: any): void {
	console.error(err)

	if (err instanceof ZodError) {
		return handleReturn(ctx, 400, {
			headers: {},
			content: {
				'application/json': {
					status: 400,
					title: 'Bad Request',
					detail: err.message,
					stack: err instanceof Error ? err.stack : undefined,
				} satisfies ServerApi.components['schemas']['ErrorResponse'],
			},
		})
	}
	let statusCode = 500
	if (err instanceof JSONRPCErrorException) {
		const err0 = err as ErrorReturnValue

		if (err0.code === 550 && err0.data.errorType === 'GraphicInstanceError') {
			err = new GraphicInstanceError(err0.message)
			err.stack = err0.stack
			err.statusCode = err0.code
		} else {
			err = new Error(err0.message)
			err.stack = err0.stack
			statusCode = err0.code || 500
		}
	}
	if (err instanceof GraphicInstanceError) {
		return handleReturn<AnyMethodErrorResponse>(ctx, err.statusCode, {
			headers: {},
			content: {
				'application/json': {
					status: err.statusCode,
					title: 'Error thrown in GraphicsInstance',
					detail: err.message,

					stack: err.stack,
				} satisfies ServerApi.components['schemas']['ErrorResponse'],
			},
		})
	}
	if (err instanceof Error) {
		return handleReturn<AnyMethodErrorResponse>(ctx, statusCode as any, {
			headers: {},
			content: {
				'application/json': {
					status: statusCode,
					title: 'Internal Error',
					detail: err.message,

					stack: err.stack,
				} satisfies ServerApi.components['schemas']['ErrorResponse'],
			},
		})
	}

	return handleReturn<AnyMethodErrorResponse>(ctx, statusCode as any, {
		headers: {},
		content: {
			'application/json': {
				status: statusCode,
				title: 'Internal Error',
				detail: `${err}`,

				stack: 'No stack available',
			} satisfies ServerApi.components['schemas']['ErrorResponse'],
		},
	})
}
