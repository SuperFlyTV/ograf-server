import * as path from 'path'
import * as fs from 'fs/promises'
import Koa from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'
import { KoaWsFilter } from '@zimtsui/koa-ws-filter'
import { GraphicsStore } from './managers/GraphicsStore.js'
import { RendererManager } from './managers/RendererManager.js'
import { setupServerApi } from './serverApi.js'
import { setupRendererApi } from './rendererApi.js'

export async function initializeServer(): Promise<void> {
	const app = new Koa()

	app.on('error', (err: unknown) => {
		console.error(err)
	})
	app.use(bodyParser())

	app.use(cors())
	// app.use(())

	const httpRouter = new Router()
	const wsRouter = new Router()
	const filter = new KoaWsFilter()

	// Initialize internal business logic
	const graphicsStore = new GraphicsStore()
	const rendererManager = new RendererManager()

	// Setup APIs:
	setupServerApi(httpRouter, graphicsStore, rendererManager) // HTTP API (ServerAPI)
	setupRendererApi(wsRouter, rendererManager) // WebSocket API (RendererAPI)

	// Set up static file serving:
	httpRouter.get('/', async (ctx: Koa.ParameterizedContext) => {
		await serveFile(ctx, path.resolve('./public/index.html'))
	})
	httpRouter.get(/\/public\/.*/, async (ctx: Koa.ParameterizedContext) => {
		await serveFromPath(ctx, path.resolve('./public'), ctx.path.trim().replace(/^\/public\//, ''))
	})
	httpRouter.get(/\/renderer\/renderer-layer\/.*/, async (ctx: Koa.ParameterizedContext) => {
		const basePath = path.resolve('../renderer-layer/dist')
		console.log('Serving renderer-layer file:', basePath)
		await serveFromPath(ctx, basePath, ctx.path.trim().replace(/^\/renderer\/renderer-layer\//, ''))
	})
	// httpRouter.get("/controller", async (ctx) => {
	//   await serveFile(ctx, path.resolve("../controller/dist/index.html"));
	// });
	httpRouter.get(/\/controller\/.*/, async (ctx: Koa.ParameterizedContext) => {
		await serveFromPath(ctx, path.resolve('../controller/dist'), ctx.path.trim().replace(/^\/controller\//, ''))
	})
	// httpRouter.get("/renderer/*", async (ctx) => {

	//   // ctx.body = await fs.readFile("./public/index.html", "utf8");
	// });

	filter.http(httpRouter.routes())
	filter.ws(wsRouter.routes())

	app.use(filter.protocols())

	const PORT = 8080

	app.listen(PORT)
	console.log(`Server running on \x1b[36m http://127.0.0.1:${PORT}/\x1b[0m`)
}

async function serveFromPath(ctx: Koa.ParameterizedContext, folderPath: string, url: string) {
	const filePath = path.resolve(folderPath, url)

	// ensure that the resulting path is in public:
	if (!filePath.startsWith(folderPath)) throw new Error('Invalid path')

	await serveFile(ctx, filePath)
}
async function serveFile(
	// ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext<DefaultState, DefaultContext>, unknown>
	ctx: Koa.ParameterizedContext,
	filePath: string
) {
	// set header to the correct mime type
	const ext = path.extname(filePath)

	let contentType = 'application/octet-stream' // unknown

	if (ext === '.js') contentType = 'text/javascript'
	else if (ext === '.css') contentType = 'text/css'
	else if (ext === '.html') contentType = 'text/html'
	else if (ext === '.png') contentType = 'image/png'
	else if (ext === '.svg') contentType = 'image/svg+xml'
	else if (ext === '.map') contentType = 'application/json'
	else {
		console.error(`Unknown file type: ${ext} (${filePath})`)
	}

	try {
		ctx.set('Content-Type', contentType)

		if (contentType.startsWith('text/')) {
			ctx.set('charset', 'utf-8')
			ctx.body = await fs.readFile(filePath, 'utf8')
		} else {
			ctx.body = await fs.readFile(filePath)
		}
	} catch (e) {
		if ((e as any).code === 'ENOENT') {
			ctx.status = 404
			ctx.body = 'File not found'
			console.log('File not found:', filePath)
		} else {
			ctx.status = 500
			ctx.body = 'Internal server error'
			throw e
		}
	}
}
