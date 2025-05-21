import Koa from "koa";
import Router from "@koa/router";
import { GraphicsStore } from "./managers/GraphicsStore";
import { CTX, literal } from "./lib/lib";
// import * as ServerAPI from "./types/_serverAPI";
import { ServerApi } from "./types/ograf-ts-lib/main";
import multer from "@koa/multer";
import { RendererManager } from "./managers/RendererManager";
const upload = multer({
  storage: multer.diskStorage({
    // destination: './localGraphicsStorage',
  }),
});

export function setupServerApi(
  router: Router,
  graphicsStore: GraphicsStore,
  rendererManager: RendererManager
) {
  // type Manifest = ServerApi.components["schemas"]["Manifest"];

  router.get(getKoaUrl("/"), (ctx) => {
    type Method = ServerApi.paths["/"]["get"];
    try {
      // const request: Request<Method> = getRequestObject(ctx);
      return handleReturn<Method>(ctx, 200, {
        headers: {},
        content: {
          "application/json": {
            name: "Simple OGraf Server",
          },
        },
      });
    } catch (err) {
      return handleErrorReturn<Method>(ctx, err);
    }
  });
  router.get(getKoaUrl("/graphics"), async (ctx) => {
    type Method = ServerApi.paths["/graphics"]["get"];
    try {
      // const request: Request<Method> = getRequestObject(ctx);

      const list = await graphicsStore.listGraphics();

      return handleReturn<Method>(ctx, 200, {
        headers: {},
        content: {
          "application/json": {
            graphics: list,
          },
        },
      });
    } catch (err) {
      return handleErrorReturn<Method>(ctx, err);
    }
  });
  router.get(getKoaUrl("/graphics/{graphicId}"), async (ctx) => {
    type Method = ServerApi.paths["/graphics/{graphicId}"]["get"];
    try {
      const request: Request<Method> = getRequestObject(ctx);

      const list = await graphicsStore.listGraphics({
        graphicId: request.parameters.path.graphicId,
      });

      return handleReturn<Method>(ctx, 200, {
        headers: {},
        content: {
          "application/json": {
            graphics: list,
          },
        },
      });
    } catch (err) {
      return handleErrorReturn<Method>(ctx, err);
    }
  });

  router.get(
    getKoaUrl("/graphics/{graphicId}/{graphicVersion}"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/graphics/{graphicId}/{graphicVersion}"]["get"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const graphicInfo = await graphicsStore.getGraphicInfo(
          request.parameters.path.graphicId,
          request.parameters.path.graphicVersion
        );

        if (!graphicInfo) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Graphic not found",
              },
            },
          });
        }

        return handleReturn<Method>(ctx, 200, {
          headers: {},
          content: {
            "application/json": {
              graphic: graphicInfo,
            },
          },
        });
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.delete(
    getKoaUrl("/graphics/{graphicId}/{graphicVersion}"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/graphics/{graphicId}/{graphicVersion}"]["delete"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const found = await graphicsStore.deleteGraphic(
          request.parameters.path.graphicId,
          request.parameters.path.graphicVersion,
          request.parameters.query?.force
        );

        if (!found) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Graphic not found",
              },
            },
          });
        }

        return handleReturn<Method>(ctx, 200, {
          headers: {},
          content: {
            "application/json": {},
          },
        });
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.get(
    getKoaUrl("/graphics/{graphicId}/{graphicVersion}/manifest"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/graphics/{graphicId}/{graphicVersion}/manifest"]["get"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const manifest = await graphicsStore.getGraphicManifest(
          request.parameters.path.graphicId,
          request.parameters.path.graphicVersion
        );

        if (!manifest) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Graphic not found",
              },
            },
          });
        }

        return handleReturn<Method>(ctx, 200, {
          headers: {
            "Cache-Control": graphicsStore.isImmutable(manifest.version)
              ? "public, max-age=31536000, immutable"
              : "no-store",
          },
          content: {
            "application/json": {
              manifest: manifest,
            },
          },
        });
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.get(
    getKoaUrl("/graphics/{graphicId}/{graphicVersion}/{localPath*}"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/graphics/{graphicId}/{graphicVersion}/{localPath}"]["get"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        // Note: We DO serve resources even if the Graphic is marked for removal!

        const resource = await graphicsStore.getGraphicResource(
          request.parameters.path.graphicId,
          request.parameters.path.graphicVersion,
          request.parameters.path.localPath
        );

        if (!resource) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "File not found",
              },
            },
          });
        }

        ctx.status = 200;
        ctx.lastModified = resource.lastModified;
        ctx.length = resource.length;
        ctx.type = resource.mimeType;
        ctx.body = resource.readStream;
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.get(getKoaUrl("/renderers"), async (ctx) => {
    type Method = ServerApi.paths["/renderers"]["get"];
    try {
      // const request: Request<Method> = getRequestObject(ctx);

      const renderers = await rendererManager.listRenderers();

      return handleReturn<Method>(ctx, 200, {
        headers: {},
        content: {
          "application/json": {
            renderers: renderers,
          },
        },
      });
    } catch (err) {
      return handleErrorReturn<Method>(ctx, err);
    }
  });
  router.get(getKoaUrl("/renderers/{rendererId}"), async (ctx) => {
    type Method = ServerApi.paths["/renderers/{rendererId}"]["get"];
    try {
      const request: Request<Method> = getRequestObject(ctx);

      const rendererInstance = await rendererManager.getRendererInstance(
        request.parameters.path.rendererId
      );

      if (!rendererInstance?.info) {
        return handleReturn<Method>(ctx, 404, {
          headers: {},
          content: {
            "application/json": {
              error: "Renderer not found",
            },
          },
        });
      }

      return handleReturn<Method>(ctx, 200, {
        headers: {},
        content: {
          "application/json": {
            renderer: rendererInstance.info,
          },
        },
      });
    } catch (err) {
      return handleErrorReturn<Method>(ctx, err);
    }
  });
  router.post(
    getKoaUrl("/renderers/{rendererId}/customActions/{customActionId}"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/customActions/{customActionId}"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );

        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
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

        return handleReturn<Method>(ctx, 200, {
          headers: {},
          content: {
            "application/json": {
              result: result.value,
            },
          },
        });
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.post(
    getKoaUrl("/renderers/{rendererId}/graphic/clear"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/graphic/clear"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );
        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
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

        return handleReturn<Method>(ctx, 200, {
          headers: {},
          content: {
            "application/json": {
              graphicInstances: result.graphicInstance.map(
                (graphicInstance) => ({
                  renderTargetId: graphicInstance.renderTargetId,
                  graphicInstanceId: graphicInstance.graphicInstanceId,
                  graphic: {
                    id: graphicInstance.graphicId,
                    version: graphicInstance.graphicVersion,
                  },
                })
              ),
            },
          },
        });
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.post(
    getKoaUrl("/renderers/{rendererId}/targets/{renderTargetId}/load"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/targets/{renderTargetId}/load"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );
        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Renderer not found",
              },
            },
          });
        }

        console.log("request.requestBody", request.requestBody);

        const result = await rendererInstance.api.loadGraphic({
          renderTargetId: request.parameters.path.renderTargetId,
          graphic: {
            id: request.requestBody.content["application/json"].graphic.id,
            version:
              request.requestBody.content["application/json"].graphic.version,
          },
          params: request.requestBody.content["application/json"].params,
        });

        return handleReturn<Method>(ctx, 200, {
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
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.post(
    getKoaUrl("/renderers/{rendererId}/targets/{renderTargetId}/updateAction"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/targets/{renderTargetId}/updateAction"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );
        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Renderer not found",
              },
            },
          });
        }

        const result = await rendererInstance.api.invokeGraphicUpdateAction({
          renderTargetId: request.parameters.path.renderTargetId,
          target: request.requestBody.content["application/json"].target,
          params: request.requestBody.content["application/json"].params,
        });

        return handleReturn<Method>(ctx, 200, {
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
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.post(
    getKoaUrl("/renderers/{rendererId}/targets/{renderTargetId}/playAction"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/targets/{renderTargetId}/playAction"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );
        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Renderer not found",
              },
            },
          });
        }

        const result = await rendererInstance.api.invokeGraphicPlayAction({
          renderTargetId: request.parameters.path.renderTargetId,
          target: request.requestBody.content["application/json"].target,
          params: request.requestBody.content["application/json"].params,
        });

        return handleReturn<Method>(ctx, 200, {
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
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.post(
    getKoaUrl("/renderers/{rendererId}/targets/{renderTargetId}/stopAction"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/targets/{renderTargetId}/stopAction"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );
        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Renderer not found",
              },
            },
          });
        }

        const result = await rendererInstance.api.invokeGraphicStopAction({
          renderTargetId: request.parameters.path.renderTargetId,
          target: request.requestBody.content["application/json"].target,
          params: request.requestBody.content["application/json"].params,
        });

        return handleReturn<Method>(ctx, 200, {
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
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );
  router.post(
    getKoaUrl("/renderers/{rendererId}/targets/{renderTargetId}/customAction"),
    async (ctx) => {
      type Method =
        ServerApi.paths["/renderers/{rendererId}/targets/{renderTargetId}/customAction"]["post"];
      try {
        const request: Request<Method> = getRequestObject(ctx);

        const rendererInstance = await rendererManager.getRendererInstance(
          request.parameters.path.rendererId
        );
        if (!rendererInstance) {
          return handleReturn<Method>(ctx, 404, {
            headers: {},
            content: {
              "application/json": {
                error: "Renderer not found",
              },
            },
          });
        }

        const result = await rendererInstance.api.invokeGraphicCustomAction({
          renderTargetId: request.parameters.path.renderTargetId,
          target: request.requestBody.content["application/json"].target,
          params: request.requestBody.content["application/json"].params,
        });

        return handleReturn<Method>(ctx, 200, {
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
      } catch (err) {
        return handleErrorReturn<Method>(ctx, err);
      }
    }
  );

  // request.parameters.path.graphicId

  // {
  //   parameters: {
  //     query: {},
  //     path: ctx.request.path
  //     header: ctx.request.header,
  //     cookie: undefined // Not implemented
  //   },
  //   requestBody: undefined // TODO
  // }

  // request.parameters.path.graphicId

  // ctx.request.body
  // ctx.request

  // ctx.status
  // ctx.body

  // }),
  // );

  //  serverApiRouter(
  //   `/`,
  //   {
  //     get: () => {

  //     },
  //     put: undefined,
  //     post: undefined,
  //     delete: undefined,
  //     options: undefined,
  //     head: undefined,
  //     patch: undefined,
  //     trace: undefined,
  //   }

  // Make strong types for the path:
  // const serverApiRouter = {
  //   get: (
  //     path: ServerAPI.AnyPath,
  //     ...middleware: (Koa.Middleware | ((ctx: CTX) => Promise<void>))[]
  //   ) => router.get(path, ...middleware),
  //   post: (
  //     path: ServerAPI.AnyPath,
  //     ...middleware: (Koa.Middleware | ((ctx: CTX) => Promise<void>))[]
  //   ) => router.post(path, ...middleware),
  //   put: (
  //     path: ServerAPI.AnyPath,
  //     ...middleware: (Koa.Middleware | ((ctx: CTX) => Promise<void>))[]
  //   ) => router.put(path, ...middleware),
  //   delete: (
  //     path: ServerAPI.AnyPath,
  //     ...middleware: (Koa.Middleware | ((ctx: CTX) => Promise<void>))[]
  //   ) => router.delete(path, ...middleware),
  // };
  // // ----- Graphics related endpoints ------------------------------
  // serverApiRouter.get(
  //   `/serverApi/internal/graphics/list`,
  //   handleError(async (ctx) => graphicsStore.listGraphics(ctx))
  // );
  // serverApiRouter.delete(
  //   `/serverApi/internal/graphics/graphic/:graphicId/:graphicVersion`,
  //   handleError(async (ctx) => graphicsStore.deleteGraphic(ctx))
  // );
  // serverApiRouter.get(
  //   `/serverApi/internal/graphics/graphic/:graphicId/:graphicVersion/manifest`,
  //   handleError(async (ctx) => graphicsStore.getGraphicManifest(ctx))
  // );
  // // serverApiRouter.get(
  // //   `/serverApi/internal/graphics/graphic/:graphicId/:graphicVersion/graphic`,
  // //   handleError(async (ctx) => graphicsStore.getGraphicModule(ctx))
  // // );
  // serverApiRouter.get(
  //   `/serverApi/internal/graphics/graphic/:graphicId/:graphicVersion/:localPath*`,
  //   handleError(async (ctx) => graphicsStore.getGraphicResource(ctx))
  // );
  router.post(
    `/serverApi/internal/graphics/graphic`,
    upload.single("graphic"),
    handleError(async (ctx) => graphicsStore.uploadGraphic(ctx))
  );
  // serverApiRouter.post(
  //   `/serverApi/internal/graphics/graphic`,
  //   upload.single("graphic"),
  //   handleError(async (ctx) => graphicsStore.uploadGraphic(ctx))
  // );
  // // serverApiRouter.get(
  // //   `/serverApi/internal/graphics/graphic`,
  // //   handleError(async (ctx) => graphicsStore.uploadGraphic(ctx))
  // // );
  // // ----- Renderer related endpoints --------------------------------
  // serverApiRouter.get(
  //   "/serverApi/internal/renderers/list",
  //   handleError(async (ctx) => rendererManager.listRenderers(ctx))
  // );
  // serverApiRouter.get(
  //   "/serverApi/internal/renderers/renderer/:rendererId/manifest",
  //   handleError(async (ctx) => rendererManager.getRendererManifest(ctx))
  // );
  // serverApiRouter.get(
  //   "/serverApi/internal/renderers/renderer/:rendererId/status",
  //   handleError(async (ctx) => rendererManager.getRendererStatus(ctx))
  // );
  // serverApiRouter.get(
  //   "/serverApi/internal/renderers/renderer/:rendererId/target/:renderTargetId/status",
  //   handleError(async (ctx) => rendererManager.getRenderTargetStatus(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/invokeAction",
  //   handleError(async (ctx) => rendererManager.invokeRendererAction(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/target/:renderTargetId/load",
  //   handleError(async (ctx) => rendererManager.loadGraphic(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/clear",
  //   handleError(async (ctx) => rendererManager.clearGraphic(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/target/:renderTargetId/updateAction",
  //   handleError(async (ctx) => rendererManager.invokeGraphicUpdateAction(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/target/:renderTargetId/playAction",
  //   handleError(async (ctx) => rendererManager.invokeGraphicPlayAction(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/target/:renderTargetId/stopAction",
  //   handleError(async (ctx) => rendererManager.invokeGraphicStopAction(ctx))
  // );
  // serverApiRouter.post(
  //   "/serverApi/internal/renderers/renderer/:rendererId/target/:renderTargetId/customAction",
  //   handleError(async (ctx) => rendererManager.invokeGraphicCustomAction(ctx))
  // );
}

function handleError(fcn: (ctx: CTX) => Promise<void>) {
  return async (ctx: CTX) => {
    try {
      await fcn(ctx);
    } catch (err) {
      console.error(err);
      // Handle internal errors:
      ctx.status = 500;
      const body: any = {
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

type AnyMethod = {
  parameters?:
    | {
        query?: {
          [key: string]: any;
        };
        path?: {
          [key: string]: any;
        };
        header?: {
          [key: string]: any;
        };
        cookie?: {
          [key: string]: any;
        };
      }
    | never;
  requestBody?: any;
  responses: {
    [status: number]: AnyResponse;
  };
};
type AnyResponse = {
  headers: {
    [name: string]: any;
  };
  content: {
    "application/json"?: {
      [key: string]: unknown;
    };
    "application/octet-stream"?: string;
  };
};
type Request<T extends AnyMethod> = {
  parameters: T["parameters"];
  requestBody: T["requestBody"];
};
function getRequestObject<Method extends AnyMethod>(
  ctx: Koa.ParameterizedContext
): Request<Method> {
  const request: Request<AnyMethod> = {
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
  return request as any;
}
function getKoaUrl(openApiUrl: string): string {
  const str = "/ograf/v1" + openApiUrl.replace(/\{([^}]+)\}/g, ":$1");
  console.log("getKoaUrl", str);
  return str;
}
function handleReturn<Method extends AnyMethod>(
  ctx: Koa.ParameterizedContext,
  statusCode: keyof Method["responses"],
  returnData: Method["responses"][keyof Method["responses"]]
): void {
  const r = returnData as AnyResponse;

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

type AnyMethodErrorResponse = {
  responses: {
    500: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": ServerApi.components["schemas"]["ErrorResponse"];
      };
    };
  };
};
function handleErrorReturn<_Method extends AnyMethodErrorResponse>(
  ctx: Koa.ParameterizedContext,
  err: any
): void {
  console.error(err);
  return handleReturn<AnyMethodErrorResponse>(ctx, 500, {
    headers: {},
    content: {
      "application/json": {
        error: err instanceof Error ? err.message : `${err}`,
        stack: err instanceof Error ? err.stack : undefined,
      },
    },
  });
}
