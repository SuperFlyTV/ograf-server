import { GraphicsAPI, EmptyPayload, ActionInvokeParams, VendorExtend } from 'ograf'
import {
	GraphicInstanceOnTarget,
	RendererClearGraphicPayload,
	RendererInfo,
	RendererLoadGraphicPayload,
	RenderTargetInfo,
} from './rendererTypes.js'

/*
 * ================================================================================================
 *
 * The Renderer API is a bi-directional API over WebSocket,
 * based on JSON-RPC 2.0, https://www.jsonrpc.org/specification
 *
 * The WebSocket connection is opened by the Renderer to the Server.
 * The Renderer MUST send a "register" message after opening the connection.
 * Upon shutdown, the Renderer SHOULD send a "unregister" message before closing the connection.
 *
 * The Server MUST accept websocket connections on the path "/rendererApi/v1"
 * The Server SHOULD accept websocket connections on the port 80 / 443 (but other ports are allowed)
 *
 * ================================================================================================
 */

/**
 * Methods called by the Server (sent to the Renderer)
 * The methods are invoked using JSON-RPC 2.0 over WebSocket
 */
export interface MethodsOnRenderer {
	// getManifest: (params: EmptyPayload) => Promise<{ rendererManifest: RendererInfo & RendererManifest } & VendorExtend>
	// listGraphicInstances: (params: EmptyPayload) => Promise<{ graphicInstances: GraphicInstance[] } & VendorExtend>
	getInfo: (params: EmptyPayload) => Promise<{ rendererInfo: RendererInfo } & VendorExtend>
	getTargetStatus: (
		params: { renderTarget: unknown } & VendorExtend
	) => Promise<{ renderTargetInfo: RenderTargetInfo } & VendorExtend>
	/** Invokes an action on the Renderer. Actions are defined by the Renderer Manifest */
	invokeRendererAction: (
		params: { action: ActionInvokeParams } & VendorExtend
	) => Promise<{ value: unknown } & VendorExtend>

	/** Instantiate a Graphic on a RenderTarget. Returns when the load has finished. */
	loadGraphic: (params: { renderTarget: unknown } & RendererLoadGraphicPayload) => Promise<
		{
			graphicInstanceId: string
			result: Awaited<ReturnType<GraphicsAPI.Graphic['load']>>
		} & VendorExtend
	>
	/** Clear/unloads a GraphicInstance on a RenderTarget */
	clearGraphics: (
		params: RendererClearGraphicPayload
	) => Promise<{ graphicInstances: GraphicInstanceOnTarget[] } & VendorExtend>
	/** Invokes an updateAction on a graphicInstance. Actions are defined by the Graphic's manifest */
	invokeGraphicUpdateAction: (
		params: {
			renderTarget: unknown
			graphicInstanceId: string
			params: Parameters<GraphicsAPI.Graphic['updateAction']>[0]
		} & VendorExtend
	) => Promise<{
		graphicInstanceId: string
		result: Awaited<ReturnType<GraphicsAPI.Graphic['updateAction']>>
	}>

	/** Invokes an playAction on a graphicInstance. Actions are defined by the Graphic's manifest */
	invokeGraphicPlayAction: (
		params: {
			renderTarget: unknown
			graphicInstanceId: string
			params: Parameters<GraphicsAPI.Graphic['playAction']>[0]
		} & VendorExtend
	) => Promise<{
		graphicInstanceId: string
		result: Awaited<ReturnType<GraphicsAPI.Graphic['playAction']>>
	}>

	/** Invokes an stopAction on a graphicInstance. Actions are defined by the Graphic's manifest */
	invokeGraphicStopAction: (
		params: {
			renderTarget: unknown
			graphicInstanceId: string
			params: Parameters<GraphicsAPI.Graphic['stopAction']>[0]
		} & VendorExtend
	) => Promise<{
		graphicInstanceId: string
		result: Awaited<ReturnType<GraphicsAPI.Graphic['stopAction']>>
	}>

	/** Invokes an customAction on a graphicInstance. Actions are defined by the Graphic's manifest */
	invokeGraphicCustomAction: (
		params: {
			renderTarget: unknown
			graphicInstanceId: string
			params: Parameters<GraphicsAPI.Graphic['customAction']>[0]
		} & VendorExtend
	) => Promise<{
		graphicInstanceId: string
		result: Awaited<ReturnType<GraphicsAPI.Graphic['customAction']>>
	}>
}

/**
 * Methods called by the Renderer (sent to the Server)
 * The methods are invoked using JSON-RPC 2.0 over WebSocket
 */
export interface MethodsOnServer {
	/**
	 * MUST be emitted when the Renderer has spawned and is ready to receive commands.
	 * Payload:
	 * RendererInfo
	 * If the id is empty, the Server will pick an id
	 */
	register: (params: { info: RendererInfo } & VendorExtend) => Promise<{ rendererId: string } & VendorExtend>
	/** CAN be emitted when a Renderer is about to shut down. */
	unregister: (params: EmptyPayload) => Promise<EmptyPayload>
	/** CAN be emitted when the RenderInfo changes */
	onInfo: (params: { info: RendererInfo } & VendorExtend) => Promise<EmptyPayload>
	/** CAN be emitted with debugging info (for developers) */
	debug: (params: { message: string } & VendorExtend) => Promise<EmptyPayload>
}

/**
 * If there was an error when invoking a method, the body will be a JSON containing this structure.
 * @see https://www.jsonrpc.org/specification#error_object
 */
export interface ErrorReturnValue {
	// extends JSONRPCError
	code: number
	message: string
	stack?: string
	data: {
		errorType: 'Error' | 'GraphicInstanceError' | 'unknown'
	}
}
