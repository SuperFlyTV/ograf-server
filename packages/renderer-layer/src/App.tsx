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
	const backgroundParam = urlParams.get('background')
	const webcamParam = urlParams.get('webcam')
	const displayCheckerboardBackground = backgroundParam === '1' || backgroundParam === 'checkerboard'
	const displayWebcamBackground = backgroundParam === 'webcam' || Boolean(webcamParam)
	const displayOgrafLogo = backgroundParam === '1'

	let backgroundColor = 'transparent'
	if (!displayCheckerboardBackground && !displayWebcamBackground) {
		backgroundColor = backgroundParam ?? 'transparent'

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
				{displayWebcamBackground ? <WebcamBackground webcam={webcamParam} /> : null}
			</>
			<div>
				<Layers layersManager={layersManager} />
				<div id="layers"></div>
			</div>
		</div>
	)
}

async function getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
	let devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
	if (devices.length === 0 || devices.some((d) => !d.label || !d.deviceId)) {
		try {
			const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
			tempStream.getTracks().forEach((track) => track.stop())
		} catch (err) {
			console.warn('Could not get temporary stream to read webcam labels:', err)
		}
		devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
	}
	return devices
}

function findMatchingWebcam(devices: MediaDeviceInfo[], webcamParam: string): MediaDeviceInfo | undefined {
	const trimmed = webcamParam.trim()
	const normalized = trimmed.toLowerCase()
	const index = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN

	return (
		devices.find((d) => d.deviceId === trimmed) ??
		devices.find((d) => d.label === trimmed) ??
		devices.find((d) => d.label.toLowerCase() === normalized) ??
		(!Number.isNaN(index) ? devices[index] : undefined) ??
		devices.find((d) => d.label.toLowerCase().includes(normalized))
	)
}

const WebcamBackground: React.FC<{ webcam: string | null }> = ({ webcam }) => {
	const videoRef = React.useRef<HTMLVideoElement>(null)
	const [availableDevices, setAvailableDevices] = React.useState<MediaDeviceInfo[] | null>(null)
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

	const listWebcams = webcam === '-1'

	React.useEffect(() => {
		if (!navigator.mediaDevices?.getUserMedia) {
			const msg = 'navigator.mediaDevices.getUserMedia is not available (requires HTTPS or localhost)'
			console.error(msg)
			setErrorMessage(msg)
			return
		}

		let active = true
		let mediaStream: MediaStream | null = null

		const initWebcam = async () => {
			if (listWebcams) {
				const devices = await getVideoInputDevices()
				if (!active) return
				setAvailableDevices(devices)
				return
			}

			let videoConstraints: MediaTrackConstraints = {
				width: { ideal: 1920 },
				height: { ideal: 1080 },
			}

			if (webcam) {
				const devices = await getVideoInputDevices()
				if (!active) return

				const matched = findMatchingWebcam(devices, webcam)
				if (!matched) {
					const msg = `Webcam "${webcam}" not found.`
					console.error(msg, 'Available webcams:', devices)
					setErrorMessage(msg)
					setAvailableDevices(devices)
					return
				}

				videoConstraints = {
					...videoConstraints,
					deviceId: { exact: matched.deviceId },
				}
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
				audio: false,
			})
			console.log('Webcam stream obtained:', stream)
			if (!active) {
				stream.getTracks().forEach((track) => track.stop())
				return
			}
			mediaStream = stream
			if (videoRef.current) {
				videoRef.current.srcObject = stream
			}
		}

		initWebcam().catch((err) => {
			console.error('Failed to access webcam:', err)
			if (active) {
				setErrorMessage(err instanceof Error ? err.message : String(err))
			}
		})

		return () => {
			active = false
			if (mediaStream) {
				mediaStream.getTracks().forEach((track) => track.stop())
			}
		}
	}, [webcam, listWebcams])

	const getWebcamUrl = (value: string) => {
		const params = new URLSearchParams(window.location.search)
		params.set('webcam', value)
		return `${window.location.pathname}?${params.toString()}`
	}

	if (listWebcams || availableDevices !== null || errorMessage !== null) {
		return (
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
					fontFamily: 'Roboto, sans-serif',
				}}
			>
				<div
					style={{
						backgroundColor: 'rgba(0, 0, 0, 0.85)',
						color: '#fff',
						padding: '24px 32px',
						borderRadius: '8px',
						maxWidth: '90vw',
						boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
					}}
				>
					{errorMessage ? (
						<div style={{ color: '#ff6b6b', marginBottom: availableDevices ? '16px' : 0, fontWeight: 500 }}>
							{errorMessage}
						</div>
					) : null}
					{listWebcams || availableDevices !== null ? (
						<>
							<h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 500 }}>Available Webcams</h2>
							{availableDevices === null ? (
								<div>Loading webcams...</div>
							) : availableDevices.length === 0 ? (
								<div>No webcams found.</div>
							) : (
								<table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '14px' }}>
									<thead>
										<tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.2)', textAlign: 'left' }}>
											<th style={{ padding: '8px 12px' }}>Index</th>
											<th style={{ padding: '8px 12px' }}>Name</th>
											<th style={{ padding: '8px 12px' }}>ID</th>
										</tr>
									</thead>
									<tbody>
										{availableDevices.map((device, index) => (
											<tr key={device.deviceId || index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
												<td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
													<a href={getWebcamUrl(String(index))} style={{ color: '#64b5f6', textDecoration: 'none' }}>
														{index}
													</a>
												</td>
												<td style={{ padding: '8px 12px' }}>
													<a
														href={getWebcamUrl(device.label || String(index))}
														style={{ color: '#64b5f6', textDecoration: 'none' }}
													>
														{device.label || `Webcam ${index}`}
													</a>
												</td>
												<td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#ccc' }}>
													{device.deviceId ? (
														<a href={getWebcamUrl(device.deviceId)} style={{ color: '#ccc', textDecoration: 'none' }}>
															{device.deviceId}
														</a>
													) : (
														'-'
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</>
					) : null}
				</div>
			</div>
		)
	}

	return (
		<video
			ref={videoRef}
			autoPlay
			playsInline
			muted
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				objectFit: 'cover',
				zIndex: -2,
			}}
		/>
	)
}
