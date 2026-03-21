import { z } from 'zod/v4'

// These types are based on the OGraf OpenAPI specification

export const RenderTargetIdentifier = z.unknown()
export const RendererId = z.string()
export const GraphicId = z.string()
export const GraphicInstanceId = z.string()
export const CustomActionId = z.string()

export const Author = z.object({
	name: z.string(),
	email: z.optional(z.string()),
	url: z.optional(z.string()),
})

export const Action = z.object({
	id: z.string(),
	name: z.string(),
	description: z.optional(z.string()),
	schema: z.optional(z.union([z.object(), z.null()])),
})

export const ErrorResponse = z.object({
	type: z.optional(z.string()),
	title: z.optional(z.string()),
	status: z.optional(z.number().int()),
	detail: z.optional(z.string()),
	instance: z.optional(z.string()),
})

export const GraphicListInfo = z.object({
	id: GraphicId,
	name: z.string(),
	description: z.optional(z.string()),
})

export const GraphicFilter = z.object({
	renderTarget: z.optional(RenderTargetIdentifier),
	graphicId: z.optional(GraphicId),
	graphicInstanceId: z.optional(z.string()),
})

export const ClearGraphicsResponse = z.object({
	graphicInstances: z.array(
		z.object({
			renderTarget: RenderTargetIdentifier,
			graphicInstanceId: GraphicInstanceId,
		})
	),
})
export const GraphicMetadata = z.object({
	createdAt: z.string(),
	createdBy: z.optional(Author),
	updatedAt: z.optional(z.string()),
	updatedBy: z.optional(Author),
})

export const GraphicManifest = z.object({
	$schema: z.literal('https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json'),
	id: z.string(),
	version: z.optional(z.string()),
	main: z.string(),
	name: z.string(),
	description: z.optional(z.string()),
	author: z.optional(Author),
	customActions: z.optional(z.array(Action)),
	supportsRealTime: z.boolean(),
	supportsNonRealTime: z.boolean(),
	stepCount: z.optional(z.number().min(-1).default(1)),
	schema: z.optional(z.object({})), // GDD object schema - simplified as generic object
	renderRequirements: z.optional(
		z.array(
			z.object({
				resolution: z.optional(
					z.object({
						width: z.object({}), // Constraint object - simplified
						height: z.object({}), // Constraint object - simplified
					})
				),
				frameRate: z.optional(z.object({})), // Constraint object - simplified
				accessToPublicInternet: z.optional(z.object({})), // Constraint object - simplified
			})
		)
	),
})
export const RenderTargetInfo = z.object({
	renderTarget: RenderTargetIdentifier,
	name: z.string(),
	description: z.optional(z.string()),
	graphicInstances: z.array(
		z.object({
			graphicInstanceId: GraphicInstanceId,
			graphic: GraphicListInfo,
		})
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

export const ShallowGDDObjectSchema = z
	.object({
		type: z.enum(['boolean', 'integer', 'number', 'string']),
	})
	.catchall(z.unknown())

export const RenderTargetSchema = z.union([
	ShallowGDDObjectSchema,
	z.object({
		allOf: z.optional(z.array(ShallowGDDObjectSchema)),
		anyOf: z.optional(z.array(ShallowGDDObjectSchema)),
		oneOf: z.optional(z.array(ShallowGDDObjectSchema)),
	}),
])

export const RendererInfo = z.object({
	id: RendererId,
	name: z.string(),
	description: z.optional(z.string()),
	customActions: z.optional(z.array(Action)),
	renderCharacteristics: z.optional(RenderCharacteristics),
	renderTargetSchema: z.optional(RenderTargetSchema),
	status: z.object({
		status: z.union([z.literal('OK'), z.literal('WARNING'), z.literal('ERROR')]),
		message: z.optional(z.string()),
	}),
	renderTargets: z.array(RenderTargetInfo),
})
export const UpdateActionParams = z.object({
	data: z.unknown(),
	skipAnimation: z.optional(z.boolean()),
})
export const PlayActionParams = z.object({
	delta: z.optional(z.number()),
	goto: z.optional(z.number()),
	skipAnimation: z.optional(z.boolean()),
})
export const StopActionParams = z.object({
	skipAnimation: z.optional(z.boolean()),
})

export const CustomActionParamsWithId = z.object({
	id: z.string(),
	payload: z.unknown(),
	skipAnimation: z.optional(z.boolean()),
})
export const CustomActionParams = z.object({
	payload: z.unknown(),
	skipAnimation: z.optional(z.boolean()),
})
