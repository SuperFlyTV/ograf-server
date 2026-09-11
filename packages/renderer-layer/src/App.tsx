import * as React from 'react'
// @ts-expect-error svg import
import OGrafLogo from './resources/ograf_logo_colour_draft.svg?react'
import { GraphicCache } from './lib/GraphicsCache.js'
import { RendererApiHandler } from './lib/RendererApiHandler.js'
import { LayersManager } from './lib/LayersManager.js'
import { Layers } from './components/Layers.js'
import { getDefaultServerUrl } from './lib/namespace.js'

const CHECKERBOARD_COLOR = '#ccc'

export const App: React.FC = () => {
	const urlParams = new URLSearchParams(window.location.search)
	const displayCheckerboardBackground =
		urlParams.get('background') === '1' || urlParams.get('background') === 'checkerboard'
	const displayOgrafLogo = urlParams.get('background') === '1'

	let backgroundColor = 'transparent'
	if (!displayCheckerboardBackground) {
		backgroundColor = urlParams.get('background') ?? 'transparent'

		const elRoot = document.querySelector('html')
		if (elRoot) elRoot.style.backgroundColor = backgroundColor
	}

	// constants.id = urlParams.get("id") || undefined;

	const initializedRef = React.useRef<boolean>(false)

	const [layersManager, setLayersManager] = React.useState<LayersManager | null>(null)

	React.useEffect(() => {
		if (initializedRef.current) return // ensure this runs only once
		initializedRef.current = true

		const rendererId = urlParams.get('id') || undefined
		const rendererName = urlParams.get('name') || 'Unnamed Renderer'

		document.title = `Renderer | ${rendererName}`

		/** URL to send server requests to: */
		const serverApiUrl = getDefaultServerUrl() // 'http://localhost:8080'
		console.log('Using serverApiUrl:', serverApiUrl)
		/** URL to open websocket connection to */
		const rendererApiUrl = serverApiUrl.replace(/^http/, 'ws') // 'ws://localhost:8080'

		const graphicCache = new GraphicCache(serverApiUrl)
		const layersManager = new LayersManager(graphicCache)
		const rendererApi = new RendererApiHandler(layersManager, {
			rendererId,
			rendererName,
		})
		// Connect to Server:
		rendererApi.connect(rendererApiUrl + '/rendererApi/v1')

		setLayersManager(layersManager)
	})

	if (!layersManager) return null

	return (
		<div
			id="main-container"
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: -2,
			}}
		>
			<>
				{displayOgrafLogo ? (
					<OGrafLogo
						className="ograf-logo"
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							zIndex: -1,

							width: '25vw',
							height: 'auto',
						}}
					/>
				) : null}
				{displayCheckerboardBackground ? (
					<div
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							zIndex: -2,

							// checkerboard pattern:
							backgroundImage: `linear-gradient(45deg, ${CHECKERBOARD_COLOR} 25%, transparent 25%), linear-gradient(-45deg, ${CHECKERBOARD_COLOR} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${CHECKERBOARD_COLOR} 75%), linear-gradient(-45deg, transparent 75%, ${CHECKERBOARD_COLOR} 75%)`,
							backgroundSize: `20px 20px`,
							backgroundPosition: `0 0, 0 10px, 10px -10px, -10px 0px`,
						}}
					></div>
				) : null}
			</>
			<div>
				<Layers layersManager={layersManager} />
				<div id="layers"></div>
			</div>
		</div>
	)
}
