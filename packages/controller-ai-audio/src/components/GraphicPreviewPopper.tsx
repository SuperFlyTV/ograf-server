import * as React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Popper, { PopperPlacementType } from '@mui/material/Popper'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { getDefaultDataFromSchema } from 'ograf-form'
import { graphicPreviewCache, PreviewGraphicElement } from '../lib/graphicPreviewCache.js'
import { serverDataStore } from '../stores/serverData.js'
import { clone } from '../lib/lib.js'

const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080
const CHECKERBOARD_COLOR = '#ccc'

export interface GraphicPreviewPopperProps {
	open: boolean
	anchorEl: HTMLElement | null
	graphicId: string
	graphicData?: unknown
	placement?: PopperPlacementType
}

function resolveGraphicData(graphicId: string, graphicData: unknown): unknown {
	let defaultData: unknown = {}
	try {
		const manifest = serverDataStore.graphicsInfo.get(graphicId)?.graphic as any
		if (manifest?.schema) {
			defaultData = getDefaultDataFromSchema(manifest.schema)
		}
	} catch {
		// Ignore schema default extraction errors
	}

	if (graphicData !== undefined && graphicData !== null) {
		const cloned = clone(graphicData)
		if (
			defaultData &&
			typeof defaultData === 'object' &&
			!Array.isArray(defaultData) &&
			typeof cloned === 'object' &&
			!Array.isArray(cloned)
		) {
			return { ...(defaultData as Record<string, unknown>), ...(cloned as Record<string, unknown>) }
		}
		return cloned
	}

	return defaultData ?? {}
}

export const GraphicPreviewPopper: React.FC<GraphicPreviewPopperProps> = ({
	open,
	anchorEl,
	graphicId,
	graphicData,
	placement = 'bottom-start',
}) => {
	const [containerEl, setContainerEl] = React.useState<HTMLDivElement | null>(null)
	const stageRef = React.useRef<HTMLDivElement | null>(null)
	const elementRef = React.useRef<PreviewGraphicElement | null>(null)
	const isLoadedRef = React.useRef(false)
	const latestDataRef = React.useRef<unknown>(graphicData)
	latestDataRef.current = graphicData

	const [scale, setScale] = React.useState<number>(() =>
		typeof window !== 'undefined' ? (window.innerWidth * 0.25) / STAGE_WIDTH : 0.25
	)
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)

	// Keep the 1920x1080 stage scaled to match the 25vw container width
	React.useLayoutEffect(() => {
		if (!containerEl) return

		const updateScale = () => {
			const width = containerEl.clientWidth
			if (width > 0) {
				setScale(width / STAGE_WIDTH)
			}
		}

		updateScale()

		const observer = new ResizeObserver(updateScale)
		observer.observe(containerEl)
		return () => {
			observer.disconnect()
		}
	}, [containerEl])

	// Mount, load, and play (with skipAnimation: true) when opened
	React.useEffect(() => {
		if (!open || !anchorEl || !graphicId) {
			return
		}

		let cancelled = false
		isLoadedRef.current = false
		setLoading(true)
		setError(null)

		const initPreview = async () => {
			try {
				const elementName = await graphicPreviewCache.ensureGraphicDefined(graphicId)
				if (cancelled || !stageRef.current) return

				stageRef.current.innerHTML = ''
				const element = document.createElement(elementName) as PreviewGraphicElement
				element.style.display = 'block'
				element.style.width = '100%'
				element.style.height = '100%'
				element.style.position = 'relative'
				stageRef.current.appendChild(element)
				elementRef.current = element

				const initialData = resolveGraphicData(graphicId, latestDataRef.current)

				await element.load({
					renderType: 'realtime',
					renderCharacteristics: {
						resolution: {
							width: STAGE_WIDTH,
							height: STAGE_HEIGHT,
						},
						frameRate: 60,
						accessToPublicInternet: navigator.onLine,
					},
					data: initialData,
				})

				if (cancelled) return

				if (typeof element.playAction === 'function') {
					await element.playAction({
						skipAnimation: true,
					})
				}

				if (cancelled) return

				isLoadedRef.current = true
				setLoading(false)
			} catch (err) {
				if (cancelled) return
				console.error(`Failed to render preview for graphic "${graphicId}":`, err)
				setError(err instanceof Error ? err.message : 'Preview failed')
				setLoading(false)
			}
		}

		void initPreview()

		return () => {
			cancelled = true
			isLoadedRef.current = false
			const el = elementRef.current
			elementRef.current = null
			if (el) {
				void Promise.resolve(el.dispose?.({})).catch(() => {})
				el.remove()
			}
		}
	}, [open, anchorEl, graphicId])

	// Live-update data if graphicData changes while preview is open
	const serializedData = React.useMemo(() => {
		try {
			return JSON.stringify(graphicData)
		} catch {
			return ''
		}
	}, [graphicData])

	React.useEffect(() => {
		if (!open || !isLoadedRef.current || !elementRef.current) return
		const el = elementRef.current
		if (typeof el.updateAction === 'function') {
			const updatedData = resolveGraphicData(graphicId, latestDataRef.current)
			void Promise.resolve(
				el.updateAction({
					data: updatedData,
					skipAnimation: true,
				})
			).catch((err) => {
				console.warn(`Preview updateAction failed for "${graphicId}":`, err)
			})
		}
	}, [open, graphicId, serializedData])

	return (
		<Popper
			open={open && Boolean(anchorEl)}
			anchorEl={anchorEl}
			placement={placement}
			style={{ pointerEvents: 'none', zIndex: 1500 }}
			modifiers={[
				{
					name: 'offset',
					options: {
						offset: [0, 8],
					},
				},
				{
					name: 'preventOverflow',
					options: {
						padding: 12,
					},
				},
				{
					name: 'flip',
					options: {
						fallbackPlacements: ['top-start', 'right-start', 'left-start', 'bottom', 'top'],
					},
				},
			]}
		>
			<Paper
				ref={setContainerEl}
				elevation={8}
				sx={{
					width: '25vw',
					minWidth: 240,
					aspectRatio: '16 / 9',
					position: 'relative',
					overflow: 'hidden',
					borderRadius: 1.5,
					border: '1px solid',
					borderColor: 'divider',
					backgroundColor: '#eee',
					backgroundImage: `linear-gradient(45deg, ${CHECKERBOARD_COLOR} 25%, transparent 25%), linear-gradient(-45deg, ${CHECKERBOARD_COLOR} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${CHECKERBOARD_COLOR} 75%), linear-gradient(-45deg, transparent 75%, ${CHECKERBOARD_COLOR} 75%)`,
					backgroundSize: '20px 20px',
					backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
				}}
			>
				<Box
					ref={stageRef}
					sx={{
						width: STAGE_WIDTH,
						height: STAGE_HEIGHT,
						position: 'absolute',
						top: 0,
						left: 0,
						transform: `scale(${scale})`,
						transformOrigin: 'top left',
						overflow: 'hidden',
						pointerEvents: 'none',
					}}
				/>

				{loading && (
					<Box
						sx={{
							position: 'absolute',
							inset: 0,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							bgcolor: 'rgba(0, 0, 0, 0.15)',
						}}
					>
						<CircularProgress size={24} />
					</Box>
				)}

				{error && (
					<Box
						sx={{
							position: 'absolute',
							inset: 0,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							p: 1.5,
							bgcolor: 'rgba(0, 0, 0, 0.65)',
						}}
					>
						<Typography variant="caption" color="error.light" align="center">
							{error}
						</Typography>
					</Box>
				)}
			</Paper>
		</Popper>
	)
}
