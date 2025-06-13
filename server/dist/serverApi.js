"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupServerApi = setupServerApi;
const multer_1 = __importDefault(require("@koa/multer"));
const OpenApiTypes_1 = require("./types/OpenApiTypes");
const v4_1 = require("zod/v4");
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
    // destination: './localGraphicsStorage',
    }),
});
const startupTime = Date.now();
function setupServerApi(router, graphicsStore, rendererManager) {
    // type Manifest = ServerApi.components["schemas"]["Manifest"];
    router.get(getKoaUrl("/"), (ctx) => {
        try {
            // const request: Request<Method> = getRequestObject(ctx);
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        name: "Simple OGraf Server",
                        // description: "A simple OGraf Server",
                        uptime: Date.now() - startupTime,
                        author: {
                            name: "SuperFly.tv",
                            url: "https://github.com/SuperFlyTV/ograf-server",
                        },
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.get(getKoaUrl("/graphics"), async (ctx) => {
        try {
            // const request: Request<Method> = getRequestObject(ctx);
            const list = await graphicsStore.listGraphics();
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        graphics: list,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.get(getKoaUrl("/graphics/{graphicId}"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        graphicId: OpenApiTypes_1.GraphicId,
                    }),
                }),
                requestBody: v4_1.z.any(),
            });
            const request = Req.parse(getRequestObject(ctx));
            const graphicInfo = await graphicsStore.getGraphicInfo(request.parameters.path.graphicId);
            if (!graphicInfo) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Graphic not found",
                        },
                    },
                });
            }
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        graphic: graphicInfo.info,
                        manifest: graphicInfo.manifest,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.delete(getKoaUrl("/graphics/{graphicId}"), async (ctx) => {
        var _a;
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        graphicId: OpenApiTypes_1.GraphicId,
                    }),
                    query: v4_1.z.optional(v4_1.z.object({
                        force: v4_1.z.optional(v4_1.z.boolean()),
                    })),
                }),
                requestBody: v4_1.z.any(),
            });
            const request = Req.parse(getRequestObject(ctx));
            const found = await graphicsStore.deleteGraphic(request.parameters.path.graphicId, (_a = request.parameters.query) === null || _a === void 0 ? void 0 : _a.force);
            if (!found) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Graphic not found",
                        },
                    },
                });
            }
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {},
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.get(getKoaUrl("/renderers"), async (ctx) => {
        try {
            const renderers = await rendererManager.listRenderers();
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        renderers: renderers.map((r) => ({
                            id: r.id,
                            name: r.name,
                            description: r.description,
                        })),
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.get(getKoaUrl("/renderers/{rendererId}"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                }),
                requestBody: v4_1.z.any(),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!(rendererInstance === null || rendererInstance === void 0 ? void 0 : rendererInstance.info)) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            await rendererInstance.updateInfo();
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        renderer: rendererInstance.info,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.get(getKoaUrl("/renderers/{rendererId}/target"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                    query: v4_1.z.object({
                        renderTarget: OpenApiTypes_1.RenderTargetIdentifier,
                    }),
                }),
                requestBody: v4_1.z.any(),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!(rendererInstance === null || rendererInstance === void 0 ? void 0 : rendererInstance.info)) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.getTargetStatus({
                renderTarget: request.parameters.query.renderTarget,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        renderTarget: result.renderTargetInfo,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.post(getKoaUrl("/renderers/{rendererId}/customActions/{customActionId}"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                        customActionId: v4_1.z.string(),
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            payload: v4_1.z.unknown(),
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.invokeRendererAction({
                action: {
                    id: request.parameters.path.customActionId,
                    payload: request.requestBody.content["application/json"].payload,
                },
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        result: result.value,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.put(getKoaUrl("/renderers/{rendererId}/target/graphic/clear"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            filters: OpenApiTypes_1.GraphicFilter,
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.clearGraphic({
                filters: request.requestBody.content["application/json"].filters,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        graphicInstances: result.graphicInstance.map((graphicInstance) => ({
                            renderTarget: graphicInstance.renderTarget,
                            graphicInstanceId: graphicInstance.graphicInstanceId,
                            graphic: {
                                id: graphicInstance.graphicId,
                                version: graphicInstance.graphicVersion,
                            },
                        })),
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.put(getKoaUrl("/renderers/{rendererId}/target/graphic/load"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                    query: v4_1.z.object({
                        renderTarget: OpenApiTypes_1.RenderTargetIdentifier,
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            graphicId: OpenApiTypes_1.GraphicId,
                            params: v4_1.z.object({
                                data: v4_1.z.unknown(),
                            }),
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.loadGraphic({
                renderTarget: request.parameters.query.renderTarget,
                graphicId: request.requestBody.content["application/json"].graphicId,
                params: request.requestBody.content["application/json"].params,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        ...result.result, // To pipe through any vendor specific data
                        graphicInstanceId: result.graphicInstanceId,
                        statusCode: result.result.statusCode,
                        statusMessage: result.result.statusMessage,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.post(getKoaUrl("/renderers/{rendererId}/target/graphic/updateAction"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                    query: v4_1.z.object({
                        renderTarget: OpenApiTypes_1.RenderTargetIdentifier,
                        graphicTarget: OpenApiTypes_1.GraphicTarget,
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            params: OpenApiTypes_1.UpdateActionParams,
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.invokeGraphicUpdateAction({
                renderTarget: request.parameters.query.renderTarget,
                target: request.parameters.query.graphicTarget,
                params: request.requestBody.content["application/json"].params,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        ...result.result, // To pipe through any vendor specific data
                        graphicInstanceId: result.graphicsInstanceId,
                        statusCode: result.result.statusCode,
                        statusMessage: result.result.statusMessage,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.post(getKoaUrl("/renderers/{rendererId}/target/graphic/playAction"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                    query: v4_1.z.object({
                        renderTarget: OpenApiTypes_1.RenderTargetIdentifier,
                        graphicTarget: OpenApiTypes_1.GraphicTarget,
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            params: OpenApiTypes_1.PlayActionParams,
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.invokeGraphicPlayAction({
                renderTarget: request.parameters.query.renderTarget,
                target: request.parameters.query.graphicTarget,
                params: request.requestBody.content["application/json"].params,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        ...result.result, // To pipe through any vendor specific data
                        graphicInstanceId: result.graphicsInstanceId,
                        statusCode: result.result.statusCode,
                        statusMessage: result.result.statusMessage,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.post(getKoaUrl("/renderers/{rendererId}/target/graphic/stopAction"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                    query: v4_1.z.object({
                        renderTarget: OpenApiTypes_1.RenderTargetIdentifier,
                        graphicTarget: OpenApiTypes_1.GraphicTarget,
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            params: OpenApiTypes_1.StopActionParams,
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.invokeGraphicStopAction({
                renderTarget: request.parameters.query.renderTarget,
                target: request.parameters.query.graphicTarget,
                params: request.requestBody.content["application/json"].params,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        ...result.result, // To pipe through any vendor specific data
                        graphicInstanceId: result.graphicsInstanceId,
                        statusCode: result.result.statusCode,
                        statusMessage: result.result.statusMessage,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.post(getKoaUrl("/renderers/{rendererId}/target/graphic/customAction"), async (ctx) => {
        try {
            const Req = v4_1.z.object({
                parameters: v4_1.z.object({
                    path: v4_1.z.object({
                        rendererId: OpenApiTypes_1.RendererId,
                    }),
                    query: v4_1.z.object({
                        renderTarget: OpenApiTypes_1.RenderTargetIdentifier,
                        graphicTarget: OpenApiTypes_1.GraphicTarget,
                    }),
                }),
                requestBody: v4_1.z.object({
                    content: v4_1.z.object({
                        "application/json": v4_1.z.object({
                            params: OpenApiTypes_1.CustomActionParams,
                        }),
                    }),
                }),
            });
            const request = Req.parse(getRequestObject(ctx));
            const rendererInstance = await rendererManager.getRendererInstance(request.parameters.path.rendererId);
            if (!rendererInstance) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "Renderer not found",
                        },
                    },
                });
            }
            const result = await rendererInstance.api.invokeGraphicCustomAction({
                renderTarget: request.parameters.query.renderTarget,
                target: request.parameters.query.graphicTarget,
                params: request.requestBody.content["application/json"].params,
            });
            return handleReturn(ctx, 200, {
                headers: {},
                content: {
                    "application/json": {
                        ...result.result, // To pipe through any vendor specific data
                        graphicInstanceId: result.graphicsInstanceId,
                        statusCode: result.result.statusCode,
                        statusMessage: result.result.statusMessage,
                    },
                },
            });
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    // =====================================================================================
    // =======================     Non-spec endpoints:     =================================
    // -------------------------------------------------------------------------------------
    router.get("/serverApi/internal/graphics/:graphicId/:localPath*", async (ctx) => {
        try {
            // Note: We DO serve resources even if the Graphic is marked for removal!
            const Req = v4_1.z.object({
                graphicId: v4_1.z.string(),
                localPath: v4_1.z.string(),
            });
            const params = Req.parse(ctx.params);
            const resource = await graphicsStore.getGraphicResource(params.graphicId, params.localPath);
            if (!resource) {
                return handleReturn(ctx, 404, {
                    headers: {},
                    content: {
                        "application/json": {
                            error: "File not found",
                        },
                    },
                });
            }
            // Serve the file:
            ctx.status = 200;
            ctx.lastModified = resource.lastModified;
            ctx.length = resource.length;
            ctx.type = resource.mimeType;
            ctx.body = resource.readStream;
        }
        catch (err) {
            return handleErrorReturn(ctx, err);
        }
    });
    router.post(`/serverApi/internal/graphics/graphic`, upload.single("graphic"), handleError(async (ctx) => graphicsStore.uploadGraphic(ctx)));
}
function handleError(fcn) {
    return async (ctx) => {
        try {
            await fcn(ctx);
        }
        catch (err) {
            console.error(err);
            // Handle internal errors:
            ctx.status = 500;
            const body = {
                code: 500,
                message: `Internal Error: ${err}`,
            };
            ctx.body = body;
            if (err && typeof err === "object" && err instanceof Error && err.stack) {
                // Note: This is a security risk, as it exposes the stack trace to the client (don't do this in production)
                body.data = { stack: err.stack };
            }
        }
    };
}
function getRequestObject(ctx) {
    var _a;
    const request = {
        parameters: {
            query: ctx.request.query,
            path: ctx.params,
            header: ctx.headers,
            cookie: undefined, // Not implemented
        },
        requestBody: {
            content: {
                "application/json": ctx.request.body,
            },
        },
    };
    // auto-convert any JSON in query:
    if ((_a = request.parameters) === null || _a === void 0 ? void 0 : _a.query) {
        for (const key of Object.keys(request.parameters.query)) {
            const value = request.parameters.query[key];
            if (typeof value === "string" && value.trim().startsWith("{")) {
                try {
                    request.parameters.query[key] = JSON.parse(value);
                }
                catch (e) {
                    // If parsing fails, keep the original value:
                    console.warn(`Failed to parse query parameter ${key}:`, e);
                }
            }
        }
    }
    return request;
}
function getKoaUrl(openApiUrl) {
    const str = "/ograf/v1" + openApiUrl.replace(/\{([^}]+)\}/g, ":$1");
    return str;
}
function handleReturn(ctx, statusCode, returnData) {
    const r = returnData;
    // Status code
    ctx.status = Number(statusCode);
    // Headers
    for (const header in r.headers) {
        ctx.set(header, r.headers[header]);
    }
    // Body:
    // Serve the correct content type based on the request:
    const contentType = ctx.request.headers["content-type"] || "application/json";
    for (const [key, value] of Object.entries(r.content)) {
        if (key === contentType) {
            ctx.body = value;
            break;
        }
    }
    // If no contentType is matching, fall back to whatever is provided:
    if (!ctx.body) {
        for (const value of Object.values(r.content)) {
            if (value !== undefined) {
                ctx.body = value;
                break;
            }
        }
    }
}
function handleErrorReturn(ctx, err) {
    console.error(err);
    if (err instanceof v4_1.ZodError) {
        return handleReturn(ctx, 400, {
            headers: {},
            content: {
                "application/json": {
                    error: "Bad Request: " + err.message,
                    stack: err instanceof Error ? err.stack : undefined,
                },
            },
        });
    }
    return handleReturn(ctx, err.statusCode || 500, {
        headers: {},
        content: {
            "application/json": {
                error: err instanceof Error ? err.message : `${err}`,
                stack: err instanceof Error ? err.stack : undefined,
            },
        },
    });
}
