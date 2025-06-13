"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomActionParams = exports.StopActionParams = exports.PlayActionParams = exports.UpdateActionParams = exports.RendererInfo = exports.RenderCharacteristics = exports.RenderTargetInfo = exports.GraphicInfo = exports.GraphicTarget = exports.GraphicFilter = exports.ClearGraphicsResponse = exports.GraphicNotFoundResponse = exports.NotFoundResponse = exports.action = exports.Author = exports.GraphicInstanceId = exports.GraphicId = exports.RendererId = exports.RenderTargetIdentifier = void 0;
const v4_1 = require("zod/v4");
// These types are based on the OGraf OpenAPI specification
exports.RenderTargetIdentifier = v4_1.z.unknown();
exports.RendererId = v4_1.z.string();
exports.GraphicId = v4_1.z.string();
exports.GraphicInstanceId = v4_1.z.string();
exports.Author = v4_1.z.object({
    name: v4_1.z.string(),
    email: v4_1.z.optional(v4_1.z.string()),
    url: v4_1.z.optional(v4_1.z.string()),
});
exports.action = v4_1.z.object({
    id: v4_1.z.string(),
    name: v4_1.z.string(),
    description: v4_1.z.optional(v4_1.z.string()),
    schema: v4_1.z.optional(v4_1.z.union([v4_1.z.object(), v4_1.z.null()])),
});
exports.NotFoundResponse = v4_1.z.object({
    error: v4_1.z.string(),
});
exports.GraphicNotFoundResponse = v4_1.z.object({
    error: v4_1.z.string(),
});
exports.ClearGraphicsResponse = v4_1.z.object({
    graphicInstances: v4_1.z.array(v4_1.z.object({
        renderTarget: exports.RenderTargetIdentifier,
        graphicInstanceId: exports.GraphicInstanceId,
        graphic: v4_1.z.object({
            id: exports.GraphicId,
        }),
    })),
});
exports.GraphicFilter = v4_1.z.object({
    renderTarget: v4_1.z.optional(exports.RenderTargetIdentifier),
    graphicId: v4_1.z.optional(exports.GraphicId),
    graphicInstanceId: v4_1.z.optional(v4_1.z.string()),
});
exports.GraphicTarget = v4_1.z.object({
    graphicId: v4_1.z.optional(exports.GraphicId),
    graphicInstanceId: v4_1.z.optional(exports.GraphicInstanceId),
});
exports.GraphicInfo = v4_1.z.object({
    id: exports.GraphicId,
    version: v4_1.z.optional(v4_1.z.string()),
    name: v4_1.z.string(),
    description: v4_1.z.string(),
    author: v4_1.z.optional(exports.Author),
    created: v4_1.z.optional(v4_1.z.number()),
    modified: v4_1.z.optional(v4_1.z.number()),
});
// export const GraphicManifest = components["schemas"]["schema-2"]
exports.RenderTargetInfo = v4_1.z.object({
    renderTarget: exports.RenderTargetIdentifier,
    name: v4_1.z.string(),
    description: v4_1.z.optional(v4_1.z.string()),
    status: v4_1.z.union([v4_1.z.literal("OK"), v4_1.z.literal("WARNING"), v4_1.z.literal("ERROR")]),
    statusMessage: v4_1.z.optional(v4_1.z.string()),
    graphicInstances: v4_1.z.optional(v4_1.z.array(v4_1.z.object({
        graphicInstanceId: v4_1.z.optional(exports.GraphicInstanceId),
        graphic: v4_1.z.optional(exports.GraphicInfo),
    }))),
});
exports.RenderCharacteristics = v4_1.z.object({
    resolution: v4_1.z.optional(v4_1.z.object({
        width: v4_1.z.number(),
        height: v4_1.z.number(),
    })),
    frameRate: v4_1.z.optional(v4_1.z.number()),
});
exports.RendererInfo = v4_1.z.object({
    id: exports.RendererId,
    name: v4_1.z.string(),
    description: v4_1.z.optional(v4_1.z.string()),
    customActions: v4_1.z.optional(v4_1.z.array(exports.action)),
    renderCharacteristics: v4_1.z.optional(exports.RenderCharacteristics),
    renderTargetSchema: v4_1.z.optional(v4_1.z.object()), // ?: Record<z.string(), never>
    status: v4_1.z.object({
        status: v4_1.z.union([
            v4_1.z.literal("OK"),
            v4_1.z.literal("WARNING"),
            v4_1.z.literal("ERROR"),
        ]),
        message: v4_1.z.optional(v4_1.z.string()),
        renderTargets: v4_1.z.array(exports.RenderTargetInfo),
    }),
});
exports.UpdateActionParams = v4_1.z.object({
    data: v4_1.z.unknown(),
});
exports.PlayActionParams = v4_1.z.object({
    delta: v4_1.z.optional(v4_1.z.number()),
    goto: v4_1.z.optional(v4_1.z.number()),
    skipAnimation: v4_1.z.optional(v4_1.z.boolean()),
});
exports.StopActionParams = v4_1.z.object({
    skipAnimation: v4_1.z.optional(v4_1.z.boolean()),
});
exports.CustomActionParams = v4_1.z.object({
    id: v4_1.z.string(),
    payload: v4_1.z.unknown(),
});
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
//         $schema: "https://ograf.ebu.io/v1-draft-0/specification/json-schemas/graphics/schema.json"
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
