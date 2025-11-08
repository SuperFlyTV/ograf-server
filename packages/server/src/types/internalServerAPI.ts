import * as fs from 'fs'
/*
 * ================================================================================================
 *
 * This is an internal, "vendor-specific" API, used for things not covered by the OGraf Control API.
 *
 * The Server API is a HTTP REST API, exposed by the Server.
 *
 * All endpoints MUST serve the API on the path "/serverApi/internal"
 *
 * ================================================================================================
 */

export interface Endpoints {
	/**
	 * Returns any of the resources from the /resources folder of a Graphic
	 */
	getGraphicResource: {
		method: 'GET'
		path: '/serverApi/internal/graphics/graphic/:graphicId/:graphicVersion/:localPath*'
		params: { graphicId: string; graphicVersion: string; localPath: string }
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		body: {}
		returnValue:
			| fs.ReadStream // The contents of the requested resource file
			| ErrorReturnValue
	}
	/**
	 * Upload a Graphic.
	 * The Graphic is uploaded as a zip file in multi-part mode.
	 */
	uploadGraphic: {
		method: 'POST'
		path: '/serverApi/internal/graphics/graphic'
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		params: {}
		body: NodeJS.ReadStream
		returnValue:
			| {
					graphics: { id: string; version?: string }[]
			  }
			| ErrorReturnValue
	}
}

// Helper types:

export type AnyBody = Endpoints[keyof Endpoints]['body']
export type AnyReturnValue = Endpoints[keyof Endpoints]['returnValue']

/**
 * If there was an error when invoking a method, the body will be a JSON containing this structure.
 * @see https://www.jsonrpc.org/specification#error_object
 */
export interface ErrorReturnValue {
	code: number
	message: string
	data?: any
}
