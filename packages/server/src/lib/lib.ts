import Router from '@koa/router'
import { ParameterizedContext, DefaultState, DefaultContext } from 'koa'
import * as InternalServerAPI from '../types/internalServerAPI.js'

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
