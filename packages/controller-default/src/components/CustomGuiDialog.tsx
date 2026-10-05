import * as React from 'react'
import { observer } from 'mobx-react'
import _Draggable, { DraggableProps } from 'react-draggable'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Portal from '@mui/material/Portal'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

import { appSettingsStore, OpenCustomGuiDialog as OpenCustomGuiDialogType } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import { OgrafApi } from '../lib/ografApi.js'
import { isEqual } from '../lib/lib.js'
import { OgrafBridge, getStartEvent, getEndEvent, registerCustomGuiComponent } from '@ograf-server/shared'
import { runInAction, toJS } from 'mobx'

const Draggable = _Draggable as unknown as React.ComponentType<
	Partial<DraggableProps> & {
		children?: React.ReactNode
	}
>

let defaultBridgeCmdCounter = 0
export const defaultCustomGuiBridgeRegistry = {
	bridges: new Map<string, Set<OgrafBridge>>(),

	register(graphicKey: string, bridge: OgrafBridge): void {
		let set = this.bridges.get(graphicKey)
		if (!set) {
			set = new Set()
			this.bridges.set(graphicKey, set)
		}
		set.add(bridge)
	},

	unregister(graphicKey: string, bridge: OgrafBridge): void {
		const set = this.bridges.get(graphicKey)
		if (set) {
			set.delete(bridge)
			if (set.size === 0) this.bridges.delete(graphicKey)
		}
	},

	notifyStart(graphicKey: string, actionName: string, arg: unknown): string {
		const commandId = `cmd_${Date.now()}_${++defaultBridgeCmdCounter}`
		const set = this.bridges.get(graphicKey)
		if (set) {
			for (const bridge of set) {
				const startEvent = getStartEvent(`${actionName}Start`, commandId, arg)
				bridge.emit(`${actionName}Start`, startEvent)
			}
		}
		return commandId
	},

	notifyEnd(graphicKey: string, actionName: string, commandId: string, arg: unknown, result: unknown): void {
		const set = this.bridges.get(graphicKey)
		if (set) {
			for (const bridge of set) {
				const endEvent = getEndEvent(`${actionName}End`, commandId, arg, result)
				bridge.emit(`${actionName}End`, endEvent)
				const aliasEvent = getEndEvent(actionName, commandId, arg, result)
				bridge.emit(actionName, aliasEvent)
			}
		}
	},
}

interface CustomGuiDialogProps {
	dialog: OpenCustomGuiDialogType
	index: number
}

const CustomGuiDialogInner = observer(function CustomGuiDialogInner({ dialog, index }: CustomGuiDialogProps) {
	const nodeRef = React.useRef<HTMLDivElement>(null)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const elementRef = React.useRef<HTMLElement | null>(null)

	const queuedGraphic = appSettingsStore.queuedGraphics.get(dialog.graphicKey)
	const graphicInfo = serverDataStore.graphicsInfo.get(dialog.graphicId)
	const graphicName = graphicInfo?.graphic?.name || dialog.graphicId

	const graphicData = queuedGraphic?.graphicData

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

		const currentData = queuedGraphic?.graphicData ?? {}
		el.value = currentData
		try {
			el.setAttribute('value', typeof currentData === 'string' ? currentData : JSON.stringify(currentData))
		} catch (e) {
			console.warn('Failed to set initial value attribute:', e)
		}

		const handleChange = (e: Event) => {
			const customEvent = e as CustomEvent
			const newValue =
				customEvent.detail?.value !== undefined
					? customEvent.detail.value
					: customEvent.detail !== undefined
						? customEvent.detail
						: el.value

			runInAction(() => {
				const q = appSettingsStore.queuedGraphics.get(dialog.graphicKey)
				if (q && !isEqual(q.graphicData, newValue)) {
					appSettingsStore.queuedGraphics.set(dialog.graphicKey, {
						...q,
						graphicData: newValue,
					})
				}
			})
		}
		el.addEventListener('change', handleChange)

		const ografApi = OgrafApi.getSingleton()

		const ensureInstance = async (q: typeof queuedGraphic, rId: string): Promise<string> => {
			const existing = Array.from(serverDataStore.graphicsInstanceMap.values()).find(
				(gi) =>
					gi.graphicId === q?.graphicId &&
					gi.rendererId === rId &&
					isEqual(gi.renderTarget, q?.renderTarget) &&
					gi.graphicInstanceId !== 'N/A'
			)
			if (existing) return existing.graphicInstanceId

			// Auto load
			const loadRes = await ografApi.renderTargetGraphicLoad(
				{ rendererId: rId },
				{
					renderTarget: q?.renderTarget,
					graphicId: q?.graphicId || '',
					params: { data: toJS(q?.graphicData) },
				}
			)

			if (loadRes.status === 200) {
				serverDataStore.addToGraphicsInstanceMap({
					rendererId: rId,
					renderTarget: q?.renderTarget,
					graphicId: q?.graphicId || '',
					graphicInstanceId: loadRes.content.graphicInstanceId,
				})
				serverDataStore.triggerReloadData(`renderTarget::${JSON.stringify(q?.renderTarget)}`)
				return loadRes.content.graphicInstanceId
			}
			throw new Error(`Failed to load graphic: ${JSON.stringify(loadRes.content)}`)
		}

		const bridge = new OgrafBridge({
			executeAction: async (action, arg) => {
				const q = appSettingsStore.queuedGraphics.get(dialog.graphicKey)
				const currentRenderer = appSettingsStore.getSelectedRenderer()
				if (!q || !currentRenderer) throw new Error('Graphic or renderer not available')
				if (!q.renderTarget) throw new Error('No renderTarget configured')

				const rendererId = currentRenderer.id
				const instanceId = await ensureInstance(q, rendererId)
				const a = (arg || {}) as any

				if (action === 'playAction') {
					const res = await ografApi.renderTargetGraphicPlay(
						{ rendererId },
						{
							renderTarget: q.renderTarget,
							graphicInstanceId: instanceId,
							params: a,
						}
					)
					return res.content
				} else if (action === 'stopAction') {
					const res = await ografApi.renderTargetGraphicStop(
						{ rendererId },
						{
							renderTarget: q.renderTarget,
							graphicInstanceId: instanceId,
							params: a,
						}
					)
					return res.content
				} else if (action === 'updateAction') {
					const res = await ografApi.renderTargetGraphicUpdate(
						{ rendererId },
						{
							renderTarget: q.renderTarget,
							graphicInstanceId: instanceId,
							params: {
								...a,
								data: a.data !== undefined ? a.data : q.graphicData,
							},
						}
					)
					return res.content
				} else if (action === 'customAction') {
					const res = await ografApi.renderTargetGraphicInvokeCustomAction(
						{
							rendererId,
							customActionId: a.id,
						},
						{
							renderTarget: q.renderTarget,
							graphicInstanceId: instanceId,
							params: {
								payload: a.payload,
							},
						}
					)
					return res.content
				}
				throw new Error(`Unsupported action: ${action}`)
			},
			onDataChanged: (newData) => {
				runInAction(() => {
					const q = appSettingsStore.queuedGraphics.get(dialog.graphicKey)
					if (q) {
						appSettingsStore.queuedGraphics.set(dialog.graphicKey, {
							...q,
							graphicData: newData,
						})
					}
				})
			},
		})

		defaultCustomGuiBridgeRegistry.register(dialog.graphicKey, bridge)
		container.appendChild(el)

		if (typeof el.load === 'function') {
			el.load({ ograf: bridge, data: currentData, renderType: 'realtime' }).catch((err) => {
				console.error(`Error in custom GUI load() for ${tagName}:`, err)
			})
		}

		return () => {
			defaultCustomGuiBridgeRegistry.unregister(dialog.graphicKey, bridge)
			el.removeEventListener('change', handleChange)
			if (typeof el.dispose === 'function') {
				el.dispose().catch((err) => console.error('Error disposing custom GUI:', err))
			}
			el.remove()
			elementRef.current = null
		}
	}, [dialog.graphicKey, dialog.componentId, dialog.graphicId, dialog.componentClass])

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
		appSettingsStore.closeCustomGui(dialog.id)
	}

	const initialX = Math.max(40, 140 + (index % 10) * 30)
	const initialY = Math.max(40, 120 + (index % 10) * 30)

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
	const dialogs = Array.from(appSettingsStore.openCustomGuis.values())
	if (dialogs.length === 0) return null

	return (
		<>
			{dialogs.map((dialog, index) => (
				<CustomGuiDialog key={dialog.id} dialog={dialog} index={index} />
			))}
		</>
	)
})
