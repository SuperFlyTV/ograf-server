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

	// Derive the public base URL from PUBLIC_URL env var, falling back to localhost.
	// PUBLIC_URL can be set by a deployment entrypoint (e.g., from a platform hostname).
	const PORT = process.env.PORT || '8080'
	const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`
	const publicWsUrl = publicUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')

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
		const relPath = ctx.path.trim().replace(/^\/controller\//, '')
		const controllerDist = path.resolve('../controller/dist')
		// Inject server URL into index.html so the controller uses the correct server URL
		if (relPath === 'index.html' || relPath === '') {
			const serverUrl = `${publicUrl}/ograf/v1/`
			const htmlPath = path.join(controllerDist, 'index.html')
			try {
				const html = await fs.readFile(htmlPath, 'utf8')
				const injected = html.replace(
					'<head>',
					`<head><script>window.__OGRAF_SERVER_URL__ = ${JSON.stringify(serverUrl)};</script>`
				)
				ctx.set('Content-Type', 'text/html')
				ctx.set('charset', 'utf-8')
				ctx.body = injected
				return
			} catch {
				// Fall through to normal serving
			}
		}
		await serveFromPath(ctx, controllerDist, relPath)
	})
	httpRouter.get(/\/renderer\/.*/, async (ctx: Koa.ParameterizedContext) => {
		const relPath = ctx.path.trim().replace(/^\/renderer\//, '')
		const rendererDist = path.resolve('../renderer-layer/dist')
		// Inject server URL and WebSocket URL into renderer index.html
		if (relPath === 'index.html' || relPath === '') {
			const htmlPath = path.join(rendererDist, 'index.html')
			try {
				const html = await fs.readFile(htmlPath, 'utf8')
				const injected = html.replace(
					'<head>',
					`<head><script>window.__OGRAF_SERVER_URL__ = ${JSON.stringify(publicUrl)};window.__OGRAF_WS_URL__ = ${JSON.stringify(publicWsUrl)};</script>`
				)
				ctx.set('Content-Type', 'text/html')
				ctx.set('charset', 'utf-8')
				ctx.body = injected
				return
			} catch {
				// Fall through to normal serving
			}
		}
		await serveFromPath(ctx, rendererDist, relPath)
	})
	// httpRouter.get("/renderer/*", async (ctx) => {

	//   // ctx.body = await fs.readFile("./public/index.html", "utf8");
	// });

	filter.http(httpRouter.routes())
	filter.ws(wsRouter.routes())

	app.use(filter.protocols())

	const port = parseInt(PORT, 10)

	app.listen(port)
	console.log(`Server running on \x1b[36m http://127.0.0.1:${port}/\x1b[0m`)
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
