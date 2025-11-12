import { z } from 'zod/v4'

// These types are based on the OGraf OpenAPI specification

export const RenderTargetIdentifier = z.unknown()
export const RendererId = z.string()
export const GraphicId = z.string()
export const GraphicInstanceId = z.string()
export const Author = z.object({
	name: z.string(),
	email: z.optional(z.string()),
	url: z.optional(z.string()),
})

export const action = z.object({
	id: z.string(),

	name: z.string(),

	description: z.optional(z.string()),

	schema: z.optional(z.union([z.object(), z.null()])),
})

export const ClearGraphicsResponse = z.object({
	graphicInstances: z.array(
		z.object({
			renderTarget: RenderTargetIdentifier,
			graphicInstanceId: GraphicInstanceId,
			graphic: z.object({
				id: GraphicId,
			}),
		})
	),
})
export const GraphicFilter = z.object({
	renderTarget: z.optional(RenderTargetIdentifier),
	graphicId: z.optional(GraphicId),
	graphicInstanceId: z.optional(z.string()),
})
export const GraphicInfo = z.object({
	id: GraphicId,
	version: z.optional(z.string()),
	name: z.string(),
	description: z.string(),
	createdBy: z.optional(Author),
	createdAt: z.optional(z.string()),
	updatedBy: z.optional(Author),
	updatedAt: z.optional(z.number()),
})

// export const GraphicManifest = components["schemas"]["schema-2"]
export const RenderTargetInfo = z.object({
	renderTarget: RenderTargetIdentifier,
	name: z.string(),
	description: z.optional(z.string()),
	status: z.union([z.literal('OK'), z.literal('WARNING'), z.literal('ERROR')]),
	statusMessage: z.optional(z.string()),
	graphicInstances: z.optional(
		z.array(
			z.object({
				graphicInstanceId: z.optional(GraphicInstanceId),
				graphic: z.optional(GraphicInfo),
			})
		)
	),
})
export const RenderCharacteristics = z.object({
	resolution: z.optional(
		z.object({
			width: z.number(),
			height: z.number(),
		})
	),
	frameRate: z.optional(z.number()),
})

export const RendererInfo = z.object({
	id: RendererId,
	name: z.string(),
	description: z.optional(z.string()),
	customActions: z.optional(z.array(action)),
	renderCharacteristics: z.optional(RenderCharacteristics),
	renderTargetSchema: z.optional(z.object()), // ?: Record<z.string(), never>
	status: z.object({
		status: z.union([z.literal('OK'), z.literal('WARNING'), z.literal('ERROR')]),
		message: z.optional(z.string()),
		renderTargets: z.array(RenderTargetInfo),
	}),
})
export const UpdateActionParams = z.object({
	data: z.unknown(),
})
export const PlayActionParams = z.object({
	delta: z.optional(z.number()),
	goto: z.optional(z.number()),
	skipAnimation: z.optional(z.boolean()),
})
export const StopActionParams = z.object({
	skipAnimation: z.optional(z.boolean()),
})
export const CustomActionParams = z.object({
	id: z.string(),
	payload: z.unknown(),
})
//
//     export const uriReferencez.string(): z.string(),
//
//     export const uriz.string(): z.string(),
//     export const anchorz.string(): z.string(),
//
//    export const  core: ({
//         $id?: components["schemas"]["uriReferencez.string()"]
//         $schema?: components["schemas"]["uriz.string()"]
//         $ref?: components["schemas"]["uriReferencez.string()"]
//         $anchor?: components["schemas"]["anchorz.string()"]
//         $dynamicRef?: components["schemas"]["uriReferencez.string()"]
//         $dynamicAnchor?: components["schemas"]["anchorz.string()"]
//         $vocabulary?: z.object({
//             [key: z.string()]: boolean
//         }
//         $comment: z.optional(z.string()),
//         $defs: z.object({
//             anchorz.string(): z.string(),
//
//             uriz.string(): z.string(),
//
//             uriReferencez.string(): z.string(),
//         }
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//     export const schemaArray: unknown[]
//
//     applicator: ({
//         prefixItems?: schemaArray
//         items?: unknown
//         contains?: unknown
//         additionalProperties?: unknown
//
//         properties: z.object({
//             [key: z.string()]: unknown
//         }
//
//         patternProperties: z.object({
//             [key: z.string()]: unknown
//         }
//
//         dependentSchemas: z.object({
//             [key: z.string()]: unknown
//         }
//         propertyNames?: unknown
//         if?: unknown
//         then?: unknown
//         else?: unknown
//         allOf?: schemaArray
//         anyOf?: schemaArray
//         oneOf?: schemaArray
//         not?: unknown
//         $defs: z.object({
//             schemaArray: unknown[]
//         }
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//
//     unevaluated: ({
//         unevaluatedItems?: unknown
//         unevaluatedProperties?: unknown
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//
//     simpleTypes: "array" | "boolean" | "integer" | "null" | "z.number()" | "object" | "z.string()"
//     nonNegativeInteger: z.number()
//
//     z.string()Array: z.string()[]
//
//     validation: ({
//         type?: simpleTypes | simpleTypes[]
//         const?: unknown
//         enum?: unknown[]
//         multipleOf?: z.number()
//         maximum?: z.number()
//         exclusiveMaximum?: z.number()
//         minimum?: z.number()
//         exclusiveMinimum?: z.number()
//         maxLength?: nonNegativeInteger
//         minLength?: nonNegativeInteger
//
//         pattern: z.optional(z.string()),
//         maxItems?: nonNegativeInteger
//         minItems?: nonNegativeInteger
//
//         uniqueItems: boolean
//         maxContains?: nonNegativeInteger
//
//         minContains: nonNegativeInteger
//         maxProperties?: nonNegativeInteger
//         minProperties?: nonNegativeInteger
//         required?: components["schemas"]["z.string()Array"]
//         dependentRequired?: z.object({
//             [key: z.string()]: components["schemas"]["z.string()Array"]
//         }
//         $defs: z.object({
//             nonNegativeInteger: z.number()
//
//             nonNegativeIntegerDefault0: $defs["nonNegativeInteger"]
//
//             simpleTypes: "array" | "boolean" | "integer" | "null" | "z.number()" | "object" | "z.string()"
//
//             z.string()Array: z.string()[]
//         }
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//
//     "meta-data": ({
//         title: z.optional(z.string()),
//         description: z.optional(z.string()),,
//         default?: unknown
//
//         deprecated: boolean
//
//         readOnly: boolean
//
//         writeOnly: boolean
//         examples?: unknown[]
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//
//     "format-annotation": ({
//         format: z.optional(z.string()),
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//
//     content: ({
//         contentEncoding: z.optional(z.string()),,
//         contentMediaType: z.optional(z.string()),,
//         contentSchema?: unknown
//     } & {
//         [key: z.string()]: unknown
//     }) | boolean
//
//     schema: ((({
//
//
//         definitions: z.object({
//             [key: z.string()]: unknown
//         }
//
//
//         dependencies: z.object({
//             [key: z.string()]: unknown | components["schemas"]["z.string()Array"]
//         }
//
//         $recursiveAnchor?: components["schemas"]["anchorz.string()"]
//
//         $recursiveRef?: components["schemas"]["uriReferencez.string()"]
//     } & {
//         [key: z.string()]: unknown
//     }) & (core & applicator & unevaluated & validation & components["schemas"]["meta-data"] &  content)) | (boolean & (core & applicator & unevaluated & validation & components["schemas"]["meta-data"] & components["schemas"]["format-annotation"] & content))) & (core & applicator & unevaluated & validation & components["schemas"]["meta-data"] & components["schemas"]["format-annotation"] & content)
//     "gdd-types": unknown & unknown & unknown & unknown & unknown & unknown & unknown & unknown & unknown & unknown & unknown & unknown
//     "basic-types": unknown & unknown & unknown & unknown & unknown & unknown
//     object: ({
//
//         type: "boolean" | "z.string()" | "z.number()" | "integer" | "array" | "object"
//         gddType: z.optional(z.string()),
//         gddOptions?: Record<z.string(), never>
//     } & {
//         [key: z.string()]: unknown
//     }) & (schema & components["schemas"]["gdd-types"] & components["schemas"]["basic-types"])

//
//     z.number(): z.object({
//
//         max?: z.number()
//
//         min?: z.number()
//
//         exact?: z.number()
//
//         ideal?: z.number()
//     } & {
//         [key: z.string()]: unknown
//     }
//     "schema-2": z.object({
//
//
//         $schema: "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json"
//
//         id: z.string(),
//
//         version: z.optional(z.string()),
//
//         main: z.optional(z.string()),
//
//         name: z.string(),
//
//         description: z.optional(z.string()),,
//
//         author?: z.object({
//
//             name: z.string(),
//
//             email: z.optional(z.string()),,
//
//             url: z.optional(z.string()),
//         } & {
//             [key: z.string()]: unknown
//         }
//
//         customActions?: action[]
//
//         supportsRealTime: boolean
//
//         supportsNonRealTime: boolean
//
//
//         stepCount: z.number()
//
//         schema?: object
//
//         renderRequirements?: ({
//
//             resolution?: z.object({
//                 width?: z.number()
//                 height?: z.number()
//             } & {
//                 [key: z.string()]: unknown
//             }
//
//             frameRate?: z.number()
//         } & {
//             [key: z.string()]: unknown
//         })[]
//     } & {
//         [key: z.string()]: unknown
//     }
