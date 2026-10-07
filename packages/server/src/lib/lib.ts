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

export function getRootUrl(config: ConfigOptions): string {
	let url = process.env.ROOT_URL ?? `http://127.0.0.1:${getPort(config)}`
	if (url?.endsWith('/')) url = url.slice(0, -1)
	return url
}
export function getPort(config: ConfigOptions): number {
	return config.port ?? 8080
}
