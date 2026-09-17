import Router from '@koa/router'
import { ParameterizedContext, DefaultState, DefaultContext } from 'koa'
import * as InternalServerAPI from '../types/internalServerAPI.js'
import { ConfigOptions } from '../config.js'

export function literal<T>(o: T): T {
	return o
}

export type CTX = ParameterizedContext<
	DefaultState,
	DefaultContext &
		Router.RouterParamContext<DefaultState, DefaultContext> & {
			request: { body: InternalServerAPI.AnyBody }
		},
	InternalServerAPI.AnyReturnValue
>

export function getFullUrl(config: ConfigOptions, url: string, baseName = 'api'): string {
	if (config.namespacePath) {
		return `/${baseName}/:namespaceId${url}`
	}
	return `/${baseName}${url}`
}

export function getRootUrl(): string {
	let url = process.env.ROOT_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`
	if (url?.endsWith('/')) url = url.slice(0, -1)
	return url
}
export const DEFAULT_PORT = 8080
