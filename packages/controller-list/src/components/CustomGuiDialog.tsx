import * as React from 'react'
import { observer } from 'mobx-react'
import _Draggable, { DraggableProps } from 'react-draggable'

const Draggable = _Draggable as unknown as React.ComponentType<
	Partial<DraggableProps> & {
		children?: React.ReactNode
	}
>
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Portal from '@mui/material/Portal'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

import { graphicsListStore, OpenCustomGuiDialog as OpenCustomGuiDialogType } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { GraphicsListAPI, customGuiBridgeRegistry } from '../lib/graphicsListApi.js'
import { isEqual } from '../lib/lib.js'
import { OgrafBridge, registerCustomGuiComponent } from '@ograf-server/shared'

interface CustomGuiDialogProps {
	dialog: OpenCustomGuiDialogType
	index: number
}

const CustomGuiDialogInner = observer(function CustomGuiDialogInner({ dialog, index }: CustomGuiDialogProps) {
	const nodeRef = React.useRef<HTMLDivElement>(null)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const elementRef = React.useRef<HTMLElement | null>(null)

	const item = graphicsListStore.getItem(dialog.itemId)
	const graphicInfo = serverDataStore.graphicsInfo.get(dialog.graphicId)
	const graphicName = graphicInfo?.graphic?.name || dialog.graphicId

	const graphicData = item?.graphicData

	// Initialize and mount web component
	React.useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const tagName = registerCustomGuiComponent(dialog.graphicId, dialog.componentId, dialog.componentClass)

		const el = document.createElement(tagName) as HTMLElement & {
			value?: any
			load?: (params: { ograf: any; data?: any; renderType: string }) => Promise<void>
			dispose?: () => Promise<void>
		}
		elementRef.current = el

		// Initial data
		const currentData = item?.graphicData ?? {}
		el.value = currentData
		try {
			el.setAttribute('value', typeof currentData === 'string' ? currentData : JSON.stringify(currentData))
		} catch (e) {
			console.warn('Failed to set initial value attribute:', e)
		}

		// Listen to 'change' events emitted by the custom GUI
		const handleChange = (e: Event) => {
			const customEvent = e as CustomEvent
			const newValue =
				customEvent.detail?.value !== undefined
					? customEvent.detail.value
					: customEvent.detail !== undefined
						? customEvent.detail
						: el.value

			if (item && !isEqual(item.graphicData, newValue)) {
				graphicsListStore.updateItemData(dialog.itemId, { graphicData: newValue })
			}
		}
		el.addEventListener('change', handleChange)

		// Create OgrafBridge
		const bridge = new OgrafBridge({
			executeAction: async (action, arg) => {
				const currentItem = graphicsListStore.getItem(dialog.itemId)
				if (!currentItem) throw new Error('Item no longer exists')

				const a = (arg || {}) as any

				if (action === 'playAction') {
					return await GraphicsListAPI.performAction(currentItem, 'play', a)
				} else if (action === 'stopAction') {
					return await GraphicsListAPI.performAction(currentItem, 'stop', a)
				} else if (action === 'updateAction') {
					return await GraphicsListAPI.performAction(currentItem, 'update', a)
				} else if (action === 'customAction') {
					return await GraphicsListAPI.performAction(currentItem, a.id, a)
				}
				throw new Error(`Unsupported action: ${action}`)
			},
			onDataChanged: (newData) => {
				graphicsListStore.updateItemData(dialog.itemId, { graphicData: newData })
			},
		})

		customGuiBridgeRegistry.register(dialog.itemId, bridge)
		container.appendChild(el)

		// Call load() once mounted
		if (typeof el.load === 'function') {
			el.load({ ograf: bridge, data: currentData, renderType: 'realtime' }).catch((err) => {
				console.error(`Error in custom GUI load() for ${tagName}:`, err)
			})
		}

		return () => {
			customGuiBridgeRegistry.unregister(dialog.itemId, bridge)
			el.removeEventListener('change', handleChange)
			if (typeof el.dispose === 'function') {
				el.dispose().catch((err) => console.error('Error disposing custom GUI:', err))
			}
			el.remove()
			elementRef.current = null
		}
	}, [dialog.itemId, dialog.componentId, dialog.graphicId, dialog.componentClass])

	// Sync external data changes to the web component's value
	React.useEffect(() => {
		const el = elementRef.current as any
		if (!el) return

		if (!isEqual(el.value, graphicData)) {
			el.value = graphicData
			try {
				el.setAttribute('value', typeof graphicData === 'string' ? graphicData : JSON.stringify(graphicData ?? {}))
			} catch (e) {
				console.warn('Failed to update value attribute:', e)
			}
		}
	}, [graphicData])

	const [size, setSize] = React.useState<{ width: number; height: number }>({
		width: 620,
		height: 480,
	})

	const handleResizeMouseDown = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		const startX = e.clientX
		const startY = e.clientY
		const startW = size.width
		const startH = size.height

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const newW = Math.max(360, Math.min(window.innerWidth * 0.95, startW + (moveEvent.clientX - startX)))
			const newH = Math.max(220, Math.min(window.innerHeight * 0.92, startH + (moveEvent.clientY - startY)))
			setSize({ width: newW, height: newH })
		}

		const handleMouseUp = () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}

		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
	}

	const handleClose = () => {
		graphicsListStore.closeCustomGui(dialog.id)
	}

	const initialX = Math.max(40, 120 + (index % 10) * 30)
	const initialY = Math.max(40, 100 + (index % 10) * 30)

	return (
		<Draggable
			nodeRef={nodeRef as React.RefObject<HTMLElement>}
			handle=".custom-gui-drag-handle"
			defaultPosition={{ x: initialX, y: initialY }}
		>
			<Paper
				ref={nodeRef}
				elevation={12}
				sx={{
					position: 'fixed',
					top: 0,
					left: 0,
					zIndex: 1400 + index,
					width: size.width,
					height: size.height,
					minWidth: 360,
					minHeight: 220,
					maxWidth: '96vw',
					maxHeight: '92vh',
					display: 'flex',
					flexDirection: 'column',
					borderRadius: 2,
					overflow: 'hidden',
					border: 1,
					borderColor: 'divider',
					boxShadow: 8,
					bgcolor: 'background.paper',
				}}
			>
				{/* Title bar / Drag Handle */}
				<Box
					className="custom-gui-drag-handle"
					sx={{
						px: 1.5,
						py: 0.75,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						bgcolor: 'primary.main',
						color: 'primary.contrastText',
						cursor: 'grab',
						userSelect: 'none',
						'&:active': {
							cursor: 'grabbing',
						},
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
						<DragIndicatorIcon fontSize="small" sx={{ opacity: 0.7 }} />
						<Typography variant="subtitle2" fontWeight={700} noWrap>
							{dialog.name}
						</Typography>
						<Typography variant="caption" sx={{ opacity: 0.8 }} noWrap>
							({graphicName})
						</Typography>
					</Box>
					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						<Tooltip title="Close">
							<IconButton size="small" onClick={handleClose} sx={{ color: 'inherit', p: 0.5 }}>
								<CloseIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Box>
				</Box>

				{/* Component Container */}
				<Box
					ref={containerRef}
					sx={{
						p: 1.5,
						flexGrow: 1,
						overflow: 'auto',
						display: 'flex',
						flexDirection: 'column',
						minHeight: 0,
						width: '100%',
						'& > *': {
							width: '100%',
						},
					}}
				/>

				{/* Corner Resize Grip */}
				<Box
					onMouseDown={handleResizeMouseDown}
					sx={{
						position: 'absolute',
						bottom: 0,
						right: 0,
						width: 18,
						height: 18,
						cursor: 'nwse-resize',
						zIndex: 10,
						display: 'flex',
						alignItems: 'flex-end',
						justifyContent: 'flex-end',
						p: 0.5,
						color: 'text.secondary',
						opacity: 0.6,
						transition: 'opacity 0.15s',
						userSelect: 'none',
						'&:hover': {
							opacity: 1,
							color: 'primary.main',
						},
					}}
				>
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
						<path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</Box>
			</Paper>
		</Draggable>
	)
})

export const CustomGuiDialog = observer(function CustomGuiDialog({ dialog, index }: CustomGuiDialogProps) {
	return (
		<Portal>
			<CustomGuiDialogInner dialog={dialog} index={index} />
		</Portal>
	)
})

export const CustomGuiDialogsContainer = observer(function CustomGuiDialogsContainer() {
	const dialogs = Array.from(graphicsListStore.openCustomGuis.values())
	if (dialogs.length === 0) return null

	return (
		<>
			{dialogs.map((dialog, index) => (
				<CustomGuiDialog key={dialog.id} dialog={dialog} index={index} />
			))}
		</>
	)
})
