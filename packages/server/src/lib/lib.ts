import Router from '@koa/router'
import { ParameterizedContext, DefaultState, DefaultContext } from 'koa'
import * as ServerAPI from '../types/_serverAPI.js'

export function literal<T>(o: T): T {
	return o
}

export type CTX = ParameterizedContext<
	DefaultState,
	DefaultContext &
		Router.RouterParamContext<DefaultState, DefaultContext> & {
			request: { body: ServerAPI.AnyBody }
		},
	ServerAPI.AnyReturnValue
>
