import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import NearMeIcon from '@mui/icons-material/NearMe'
import PanToolIcon from '@mui/icons-material/PanTool'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import GridOnIcon from '@mui/icons-material/GridOn'

import { CELL_SIZE, gridStore, GridWidget } from '../stores/gridStore.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import { GridControllerAPI } from '../lib/gridControllerApi.js'
import { uploadGraphicZip } from '../lib/uploadGraphic.js'
import { GridWidgetView, ResizeDirection } from './GridWidgetView.js'
import { ContextMenu, GridContextMenuState } from './ContextMenu.js'

export interface GridCanvasProps {
	onOpenAddGraphicDialog: (targetCell?: { x: number; y: number }) => void
	onOpenUploadDialog: () => void
}

interface MarqueeRect {
	startX: number // in world px
	startY: number
	currentX: number
	currentY: number
}

function formatKeyEventForHotkeyMatch(e: KeyboardEvent): string {
	const parts: string[] = []
	if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
	if (e.altKey) parts.push('Alt')
	if (e.shiftKey) parts.push('Shift')
	const keyLabel = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
	parts.push(keyLabel)
	return parts.join('+')
}

export const GridCanvas: React.FC<GridCanvasProps> = observer(({ onOpenAddGraphicDialog, onOpenUploadDialog }) => {
	const containerRef = React.useRef<HTMLDivElement>(null)
	const [marquee, setMarquee] = React.useState<MarqueeRect | null>(null)
	const [isSpacePressed, setIsSpacePressed] = React.useState(false)
	const [isPanning, setIsPanning] = React.useState(false)
	const [contextMenuState, setContextMenuState] = React.useState<GridContextMenuState | null>(null)
	const [isFileDragging, setIsFileDragging] = React.useState(false)
	const dragCounterRef = React.useRef(0)

	// Active pointers for multi-touch pinch-zoom & pan
	const activeTouchesRef = React.useRef<Map<number, { x: number; y: number }>>(new Map())
	const pinchStateRef = React.useRef<{
		dist: number
		midX: number
		midY: number
		panX: number
		panY: number
		zoom: number
	} | null>(null)

	const isEditMode = gridStore.effectiveEditMode
	const panX = gridStore.panX
	const panY = gridStore.panY
	const zoom = gridStore.zoom

	// Convert screen client coordinates to world pixel coordinates
	const clientToWorldPx = React.useCallback((clientX: number, clientY: number) => {
		const rect = containerRef.current?.getBoundingClientRect()
		if (!rect) return { x: 0, y: 0 }
		const x = (clientX - rect.left - gridStore.panX) / gridStore.zoom
		const y = (clientY - rect.top - gridStore.panY) / gridStore.zoom
		return { x, y }
	}, [])

	// Convert screen client coordinates to snapped 10px grid cell coordinates
	const clientToGridCell = React.useCallback(
		(clientX: number, clientY: number) => {
			const world = clientToWorldPx(clientX, clientY)
			return {
				x: Math.floor(world.x / CELL_SIZE),
				y: Math.floor(world.y / CELL_SIZE),
			}
		},
		[clientToWorldPx]
	)

	// Non-passive wheel listener for smooth zoom & pan
	React.useEffect(() => {
		const el = containerRef.current
		if (!el) return

		const handleWheel = (e: WheelEvent) => {
			// If scrolling inside an overflow scrollable form in Live Mode, allow native scroll unless Ctrl is held
			if (!e.ctrlKey && !e.metaKey && !gridStore.effectiveEditMode) {
				const target = e.target as HTMLElement | null
				if (target && target.closest('superflytv-ograf-form')) {
					return
				}
			}

			e.preventDefault()

			if (e.ctrlKey || e.metaKey) {
				// Zoom centered on cursor
				const rect = el.getBoundingClientRect()
				const cursorX = e.clientX - rect.left
				const cursorY = e.clientY - rect.top

				const zoomFactor = Math.exp(-e.deltaY * 0.002)
				const nextZoom = Math.max(0.25, Math.min(3, Math.round(gridStore.zoom * zoomFactor * 100) / 100))

				const worldX = (cursorX - gridStore.panX) / gridStore.zoom
				const worldY = (cursorY - gridStore.panY) / gridStore.zoom

				const nextPanX = cursorX - worldX * nextZoom
				const nextPanY = cursorY - worldY * nextZoom

				gridStore.setViewport(nextPanX, nextPanY, nextZoom)
			} else {
				// Pan
				const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX
				const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY
				gridStore.setViewport(gridStore.panX - dx, gridStore.panY - dy)
			}
		}

		el.addEventListener('wheel', handleWheel, { passive: false })
		return () => el.removeEventListener('wheel', handleWheel)
	}, [])

	// Global keyboard shortcuts (Mode toggle/hold, Undo/Redo, Copy/Paste, Nudging, Live Button Hotkeys)
	React.useEffect(() => {
		const isTypingInInput = (target: EventTarget | null): boolean => {
			if (!target || !(target instanceof HTMLElement)) return false
			const tag = target.tagName.toLowerCase()
			if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) return true
			if (target.closest('superflytv-ograf-form')) return true
			return false
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			if (isTypingInInput(e.target)) {
				if (e.key === 'Escape' && e.target instanceof HTMLElement) {
					e.target.blur()
				}
				return
			}

			if (e.key === ' ') {
				setIsSpacePressed(true)
			}

			const toggleKey = (appSettingsStore.editModeToggleKey || 'e').toLowerCase()
			const holdKey = (appSettingsStore.editModeHoldKey || 'Tab').toLowerCase()
			const isCtrlOrCmd = e.ctrlKey || e.metaKey

			// Hold key for temporary Edit Mode
			if (!isCtrlOrCmd && !e.altKey && e.key.toLowerCase() === holdKey) {
				e.preventDefault()
				if (!gridStore.isTempEditMode) {
					gridStore.setTempEditMode(true)
				}
				return
			}

			// Toggle key for Edit Mode vs Live Mode
			if (!isCtrlOrCmd && !e.altKey && !e.shiftKey && e.key.toLowerCase() === toggleKey && !e.repeat) {
				// In Live mode, only toggle if no button uses this exact key as a hotkey, or always toggle if it's the configured mode key
				e.preventDefault()
				gridStore.toggleEditMode()
				return
			}

			if (gridStore.effectiveEditMode) {
				// EDIT MODE SHORTCUTS
				if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
					e.preventDefault()
					if (e.shiftKey) gridStore.redo()
					else gridStore.undo()
					return
				}
				if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
					e.preventDefault()
					gridStore.redo()
					return
				}
				if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
					e.preventDefault()
					gridStore.copySelection()
					return
				}
				if (isCtrlOrCmd && (e.key === 'x' || e.key === 'X')) {
					e.preventDefault()
					gridStore.cutSelection()
					return
				}
				if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
					e.preventDefault()
					gridStore.paste({ cloneInstances: e.shiftKey })
					return
				}
				if (isCtrlOrCmd && (e.key === 'd' || e.key === 'D')) {
					e.preventDefault()
					gridStore.duplicateSelection({ cloneInstances: e.shiftKey })
					return
				}
				if (isCtrlOrCmd && (e.key === 'a' || e.key === 'A')) {
					e.preventDefault()
					gridStore.selectAllWidgets()
					return
				}
				if (e.key === 'Escape') {
					e.preventDefault()
					gridStore.clearSelection()
					setContextMenuState(null)
					return
				}
				if (e.key === 'Delete' || e.key === 'Backspace') {
					e.preventDefault()
					gridStore.removeSelectedWidgets()
					return
				}

				// Arrow key nudging in Edit Mode
				if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
					if (gridStore.selectedWidgetIds.length > 0) {
						e.preventDefault()
						const step = e.shiftKey ? 5 : 1
						const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
						const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
						gridStore.moveWidgetsByDelta(gridStore.selectedWidgetIds, dx, dy, !e.repeat)
					}
					return
				}
			} else {
				// LIVE MODE BUTTON HOTKEYS
				if (e.repeat) return
				const pressedCombo = formatKeyEventForHotkeyMatch(e).toLowerCase()
				const matchingWidgets = gridStore.widgets.filter(
					(w) =>
						(w.type === 'action-button' || w.type === 'custom-action-button') &&
						w.hotkey &&
						w.hotkey.toLowerCase() === pressedCombo
				)
				if (matchingWidgets.length > 0) {
					e.preventDefault()
					for (const w of matchingWidgets) {
						void GridControllerAPI.executeWidgetAction(w)
					}
				}
			}
		}

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === ' ') {
				setIsSpacePressed(false)
			}
			const holdKey = (appSettingsStore.editModeHoldKey || 'Tab').toLowerCase()
			if (e.key.toLowerCase() === holdKey && gridStore.isTempEditMode) {
				gridStore.setTempEditMode(false)
			}
		}

		const handleWindowBlur = () => {
			setIsSpacePressed(false)
			if (gridStore.isTempEditMode) {
				gridStore.setTempEditMode(false)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', handleKeyUp)
		window.addEventListener('blur', handleWindowBlur)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('keyup', handleKeyUp)
			window.removeEventListener('blur', handleWindowBlur)
		}
	}, [])

	// Handle moving widget(s) in Edit Mode
	const handleStartMove = (e: React.PointerEvent, widget: GridWidget) => {
		const isModifier = e.shiftKey || e.ctrlKey || e.metaKey
		let movingIds = gridStore.selectedWidgetIds.slice()

		if (isModifier) {
			gridStore.selectWidget(widget.id, true)
			movingIds = gridStore.selectedWidgetIds.slice()
		} else if (!gridStore.isWidgetSelected(widget.id)) {
			gridStore.selectWidget(widget.id, false)
			movingIds = [widget.id]
		}

		const startClientX = e.clientX
		const startClientY = e.clientY
		let hasMoved = false
		let duplicatedOnAlt = false

		let initialPositions = new Map<string, { x: number; y: number }>()
		for (const w of gridStore.widgets) {
			if (movingIds.includes(w.id)) {
				initialPositions.set(w.id, { x: w.x, y: w.y })
			}
		}

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (activeTouchesRef.current.size >= 2) return // Multi-touch pinch takes over

			const dxPx = moveEvent.clientX - startClientX
			const dyPx = moveEvent.clientY - startClientY

			if (!hasMoved && Math.hypot(dxPx, dyPx) < 4) return

			if (!hasMoved) {
				hasMoved = true
				if (moveEvent.altKey && !duplicatedOnAlt) {
					duplicatedOnAlt = true
					const clones = gridStore.duplicateSelection({
						cloneInstances: moveEvent.shiftKey,
						offset: { x: 0, y: 0 },
					})
					movingIds = clones.map((c) => c.id)
					initialPositions = new Map()
					for (const c of clones) {
						initialPositions.set(c.id, { x: c.x, y: c.y })
					}
				} else {
					gridStore.pushHistory()
				}
			}

			const dxCells = Math.round(dxPx / (CELL_SIZE * gridStore.zoom))
			const dyCells = Math.round(dyPx / (CELL_SIZE * gridStore.zoom))

			for (const id of movingIds) {
				const init = initialPositions.get(id)
				if (init) {
					gridStore.updateWidget(id, {
						x: init.x + dxCells,
						y: init.y + dyCells,
					})
				}
			}
		}

		const handlePointerUp = () => {
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
		}

		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
	}

	// Handle resizing a widget in Edit Mode
	const handleStartResize = (e: React.PointerEvent, widget: GridWidget, dir: ResizeDirection) => {
		e.preventDefault()
		gridStore.pushHistory()

		const startClientX = e.clientX
		const startClientY = e.clientY
		const initX = widget.x
		const initY = widget.y
		const initW = widget.w
		const initH = widget.h
		const minW = 3
		const minH = 2

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const dxCells = Math.round((moveEvent.clientX - startClientX) / (CELL_SIZE * gridStore.zoom))
			const dyCells = Math.round((moveEvent.clientY - startClientY) / (CELL_SIZE * gridStore.zoom))

			let nextX = initX
			let nextY = initY
			let nextW = initW
			let nextH = initH

			if (dir.includes('e')) {
				nextW = Math.max(minW, initW + dxCells)
			}
			if (dir.includes('s')) {
				nextH = Math.max(minH, initH + dyCells)
			}
			if (dir.includes('w')) {
				const maxDeltaX = initW - minW
				const clampedDx = Math.min(dxCells, maxDeltaX)
				nextX = initX + clampedDx
				nextW = initW - clampedDx
			}
			if (dir.includes('n')) {
				const maxDeltaY = initH - minH
				const clampedDy = Math.min(dyCells, maxDeltaY)
				nextY = initY + clampedDy
				nextH = initH - clampedDy
			}

			gridStore.updateWidget(widget.id, {
				x: nextX,
				y: nextY,
				w: nextW,
				h: nextH,
			})
		}

		const handlePointerUp = () => {
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
		}

		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
	}

	// Canvas background pointer down (Panning, 2-finger pinch-zoom, or Marquee Selection)
	const handleCanvasPointerDown = (e: React.PointerEvent) => {
		if (e.button === 2) return // Right click handled by onContextMenu

		// Track touch pointers for 2-finger pinch & pan
		if (e.pointerType === 'touch') {
			activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
			if (activeTouchesRef.current.size === 2) {
				const pts = Array.from(activeTouchesRef.current.values())
				const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
				const midX = (pts[0].x + pts[1].x) / 2
				const midY = (pts[0].y + pts[1].y) / 2
				pinchStateRef.current = {
					dist: Math.max(10, dist),
					midX,
					midY,
					panX: gridStore.panX,
					panY: gridStore.panY,
					zoom: gridStore.zoom,
				}
				setMarquee(null)
				return
			}
		}

		const shouldPan =
			e.button === 1 ||
			isSpacePressed ||
			!gridStore.effectiveEditMode ||
			(e.pointerType === 'touch' && gridStore.touchEditTool === 'pan')

		if (shouldPan) {
			setIsPanning(true)
			const startX = e.clientX
			const startY = e.clientY
			const initPanX = gridStore.panX
			const initPanY = gridStore.panY

			const handlePointerMove = (moveEvent: PointerEvent) => {
				if (activeTouchesRef.current.has(moveEvent.pointerId)) {
					activeTouchesRef.current.set(moveEvent.pointerId, {
						x: moveEvent.clientX,
						y: moveEvent.clientY,
					})
				}

				if (activeTouchesRef.current.size === 2 && pinchStateRef.current) {
					const pts = Array.from(activeTouchesRef.current.values())
					const newDist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y))
					const newMidX = (pts[0].x + pts[1].x) / 2
					const newMidY = (pts[0].y + pts[1].y) / 2

					const p = pinchStateRef.current
					const scale = newDist / p.dist
					const nextZoom = Math.max(0.25, Math.min(3, Math.round(p.zoom * scale * 100) / 100))

					const rect = containerRef.current?.getBoundingClientRect()
					const originLeft = rect ? rect.left : 0
					const originTop = rect ? rect.top : 0

					const worldX = (p.midX - originLeft - p.panX) / p.zoom
					const worldY = (p.midY - originTop - p.panY) / p.zoom

					const nextPanX = newMidX - originLeft - worldX * nextZoom
					const nextPanY = newMidY - originTop - worldY * nextZoom

					gridStore.setViewport(nextPanX, nextPanY, nextZoom)
					return
				}

				gridStore.setViewport(initPanX + (moveEvent.clientX - startX), initPanY + (moveEvent.clientY - startY))
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				activeTouchesRef.current.delete(upEvent.pointerId)
				if (activeTouchesRef.current.size < 2) {
					pinchStateRef.current = null
				}
				if (activeTouchesRef.current.size === 0) {
					setIsPanning(false)
					window.removeEventListener('pointermove', handlePointerMove)
					window.removeEventListener('pointerup', handlePointerUp)
					window.removeEventListener('pointercancel', handlePointerUp)
				}
			}

			window.addEventListener('pointermove', handlePointerMove)
			window.addEventListener('pointerup', handlePointerUp)
			window.addEventListener('pointercancel', handlePointerUp)
			return
		}

		// Otherwise in Edit Mode: Marquee Drag-to-Select!
		const additive = e.shiftKey || e.ctrlKey || e.metaKey
		const initialSelectedIds = additive ? gridStore.selectedWidgetIds.slice() : []
		if (!additive) {
			gridStore.clearSelection()
		}

		const startWorld = clientToWorldPx(e.clientX, e.clientY)
		setMarquee({
			startX: startWorld.x,
			startY: startWorld.y,
			currentX: startWorld.x,
			currentY: startWorld.y,
		})

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (activeTouchesRef.current.has(moveEvent.pointerId)) {
				activeTouchesRef.current.set(moveEvent.pointerId, {
					x: moveEvent.clientX,
					y: moveEvent.clientY,
				})
			}
			if (activeTouchesRef.current.size >= 2) {
				setMarquee(null)
				return
			}

			const curWorld = clientToWorldPx(moveEvent.clientX, moveEvent.clientY)
			setMarquee({
				startX: startWorld.x,
				startY: startWorld.y,
				currentX: curWorld.x,
				currentY: curWorld.y,
			})

			const minX = Math.min(startWorld.x, curWorld.x)
			const maxX = Math.max(startWorld.x, curWorld.x)
			const minY = Math.min(startWorld.y, curWorld.y)
			const maxY = Math.max(startWorld.y, curWorld.y)

			const hitIds: string[] = []
			for (const w of gridStore.widgets) {
				const wx1 = w.x * CELL_SIZE
				const wy1 = w.y * CELL_SIZE
				const wx2 = (w.x + w.w) * CELL_SIZE
				const wy2 = (w.y + w.h) * CELL_SIZE

				const intersects = wx1 <= maxX && wx2 >= minX && wy1 <= maxY && wy2 >= minY
				if (intersects) {
					hitIds.push(w.id)
				}
			}

			const combined = new Set([...initialSelectedIds, ...hitIds])
			gridStore.setSelectedWidgets(Array.from(combined), false)
		}

		const handlePointerUp = (upEvent: PointerEvent) => {
			activeTouchesRef.current.delete(upEvent.pointerId)
			setMarquee(null)
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
		}

		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
	}

	// File Drag & Drop (.zip graphic packages)
	const handleFileDragEnter = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			dragCounterRef.current++
			setIsFileDragging(true)
		}
	}

	const handleFileDragOver = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			e.dataTransfer.dropEffect = 'copy'
		}
	}

	const handleFileDragLeave = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			dragCounterRef.current--
			if (dragCounterRef.current <= 0) {
				dragCounterRef.current = 0
				setIsFileDragging(false)
			}
		}
	}

	const handleFileDrop = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			dragCounterRef.current = 0
			setIsFileDragging(false)

			const files = Array.from(e.dataTransfer.files || [])
			const zipFiles = files.filter((f) => f.name.toLowerCase().endsWith('.zip'))
			if (zipFiles.length === 0) {
				gridStore.showError('Please drop a valid .zip graphic package.')
				return
			}

			for (const file of zipFiles) {
				gridStore.showNotification(`Uploading ${file.name}...`, 'info')
				uploadGraphicZip(file, true)
					.then((uploadedIds) => {
						const msg =
							uploadedIds.length > 0
								? `Uploaded and added to grid: ${uploadedIds.join(', ')}`
								: `Uploaded ${file.name} successfully.`
						gridStore.showNotification(msg, 'success')
					})
					.catch((err: unknown) => {
						const errMsg = err instanceof Error ? err.message : 'Upload error occurred'
						gridStore.showError(`Failed to upload ${file.name}: ${errMsg}`)
					})
			}
		}
	}

	const handleFitToContent = () => {
		const rect = containerRef.current?.getBoundingClientRect()
		gridStore.fitViewportToContent(rect?.width || 1000, rect?.height || 700)
	}

	const minorGridSize = CELL_SIZE * zoom
	const majorGridSize = CELL_SIZE * 10 * zoom

	return (
		<Box
			ref={containerRef}
			onPointerDown={handleCanvasPointerDown}
			onDragEnter={handleFileDragEnter}
			onDragOver={handleFileDragOver}
			onDragLeave={handleFileDragLeave}
			onDrop={handleFileDrop}
			onContextMenu={(e) => {
				e.preventDefault()
				setContextMenuState({
					mouseX: e.clientX,
					mouseY: e.clientY,
					gridCell: clientToGridCell(e.clientX, e.clientY),
					targetType: 'background',
				})
			}}
			sx={{
				flexGrow: 1,
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
				touchAction: 'none',
				userSelect: 'none',
				cursor: isPanning || isSpacePressed ? 'grabbing' : !isEditMode ? 'grab' : 'default',
				bgcolor: 'background.default',
				backgroundImage: (theme) => {
					const isDark = theme.palette.mode === 'dark'
					const majorColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
					const minorColor = isEditMode ? (isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.038)') : 'transparent'

					if (minorGridSize < 5) {
						return `
							linear-gradient(to right, ${majorColor} 1px, transparent 1px),
							linear-gradient(to bottom, ${majorColor} 1px, transparent 1px)
						`
					}
					return `
						linear-gradient(to right, ${majorColor} 1px, transparent 1px),
						linear-gradient(to bottom, ${majorColor} 1px, transparent 1px),
						linear-gradient(to right, ${minorColor} 1px, transparent 1px),
						linear-gradient(to bottom, ${minorColor} 1px, transparent 1px)
					`
				},
				backgroundSize:
					minorGridSize < 5
						? `${majorGridSize}px ${majorGridSize}px`
						: `${majorGridSize}px ${majorGridSize}px, ${majorGridSize}px ${majorGridSize}px, ${minorGridSize}px ${minorGridSize}px, ${minorGridSize}px ${minorGridSize}px`,
				backgroundPosition:
					minorGridSize < 5
						? `${panX}px ${panY}px`
						: `${panX}px ${panY}px, ${panX}px ${panY}px, ${panX}px ${panY}px, ${panX}px ${panY}px`,
			}}
		>
			{/* Drop .zip Overlay */}
			{isFileDragging && (
				<Box
					sx={{
						position: 'absolute',
						inset: 12,
						zIndex: 2000,
						bgcolor: (theme) =>
							theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.25)' : 'rgba(25, 118, 210, 0.12)',
						backdropFilter: 'blur(3px)',
						border: '3px dashed',
						borderColor: 'primary.main',
						borderRadius: 2,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						pointerEvents: 'none',
					}}
				>
					<CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 1.5 }} />
					<Typography variant="h5" fontWeight={700} color="primary.main">
						Drop .zip graphic package here
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						Graphic will be uploaded to the server and added to the grid
					</Typography>
				</Box>
			)}

			{/* Transformed Infinite World Layer */}
			<Box
				sx={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: 0,
					height: 0,
					transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
					transformOrigin: '0 0',
				}}
			>
				{/* Origin (0,0) Marker in Edit Mode */}
				{isEditMode && (
					<Box
						sx={{
							position: 'absolute',
							left: -8,
							top: -8,
							width: 16,
							height: 16,
							pointerEvents: 'none',
							opacity: 0.45,
						}}
					>
						<Box
							sx={{
								position: 'absolute',
								left: 7,
								top: 0,
								width: 2,
								height: 16,
								bgcolor: 'primary.main',
							}}
						/>
						<Box
							sx={{
								position: 'absolute',
								top: 7,
								left: 0,
								width: 16,
								height: 2,
								bgcolor: 'primary.main',
							}}
						/>
					</Box>
				)}

				{/* Render all Grid Widgets */}
				{gridStore.widgets.map((widget) => (
					<GridWidgetView
						key={widget.id}
						widget={widget}
						isSelected={gridStore.isWidgetSelected(widget.id)}
						isEditMode={isEditMode}
						onStartMove={handleStartMove}
						onStartResize={handleStartResize}
						onContextMenu={(e, w) => {
							if (!gridStore.isWidgetSelected(w.id)) {
								gridStore.selectWidget(w.id, false)
							}
							setContextMenuState({
								mouseX: e.clientX,
								mouseY: e.clientY,
								gridCell: clientToGridCell(e.clientX, e.clientY),
								targetType: 'widget',
								widgetId: w.id,
							})
						}}
					/>
				))}

				{/* Marquee Selection Rectangle */}
				{marquee && (
					<Box
						sx={{
							position: 'absolute',
							left: Math.min(marquee.startX, marquee.currentX),
							top: Math.min(marquee.startY, marquee.currentY),
							width: Math.abs(marquee.currentX - marquee.startX),
							height: Math.abs(marquee.currentY - marquee.startY),
							border: '1.5px solid #1976d2',
							bgcolor: 'rgba(25, 118, 210, 0.16)',
							borderRadius: 0.5,
							pointerEvents: 'none',
							zIndex: 99999,
						}}
					/>
				)}
			</Box>

			{/* Empty Surface Welcome Overlay */}
			{gridStore.widgets.length === 0 && (
				<Box
					onPointerDown={(e) => e.stopPropagation()}
					sx={{
						position: 'absolute',
						top: '50%',
						left: '50%',
						transform: 'translate(-50%, -50%)',
						zIndex: 40,
					}}
				>
					<Paper
						elevation={4}
						sx={{
							p: 3.5,
							maxWidth: 440,
							textAlign: 'center',
							borderRadius: 3,
							border: '1px solid',
							borderColor: 'divider',
						}}
					>
						<GridOnIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
						<Typography variant="h6" fontWeight={700} gutterBottom>
							Build Your Control Surface
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
							Add graphics from the server to generate form inputs, action buttons, and custom controls on an infinite
							10×10px grid.
						</Typography>
						<Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								onClick={() => onOpenAddGraphicDialog({ x: 4, y: 4 })}
								sx={{ textTransform: 'none', fontWeight: 700 }}
							>
								Add Graphic Controls
							</Button>
							{serverDataStore.severIsOurs && (
								<Button
									variant="outlined"
									startIcon={<CloudUploadIcon />}
									onClick={onOpenUploadDialog}
									sx={{ textTransform: 'none' }}
								>
									Upload (.zip)
								</Button>
							)}
						</Stack>
					</Paper>
				</Box>
			)}

			{/* Floating HUD Toolbar (Bottom-Left) */}
			<Paper
				elevation={4}
				onPointerDown={(e) => e.stopPropagation()}
				sx={{
					position: 'absolute',
					bottom: 14,
					left: 14,
					zIndex: 60,
					px: 1,
					py: 0.5,
					borderRadius: 2,
					display: 'flex',
					alignItems: 'center',
					gap: 0.5,
					border: '1px solid',
					borderColor: 'divider',
					bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)'),
					backdropFilter: 'blur(6px)',
				}}
			>
				{isEditMode && (
					<>
						<Tooltip title="Select / Marquee Tool (1-finger drag selects)">
							<IconButton
								size="small"
								color={gridStore.touchEditTool === 'select' ? 'primary' : 'default'}
								onClick={() => gridStore.setTouchEditTool('select')}
							>
								<NearMeIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="Pan Hand Tool (1-finger drag pans canvas)">
							<IconButton
								size="small"
								color={gridStore.touchEditTool === 'pan' ? 'primary' : 'default'}
								onClick={() => gridStore.setTouchEditTool('pan')}
							>
								<PanToolIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

						<Tooltip title="Undo (Ctrl+Z)">
							<span>
								<IconButton size="small" disabled={!gridStore.canUndo} onClick={() => gridStore.undo()}>
									<UndoIcon fontSize="small" />
								</IconButton>
							</span>
						</Tooltip>
						<Tooltip title="Redo (Ctrl+Y)">
							<span>
								<IconButton size="small" disabled={!gridStore.canRedo} onClick={() => gridStore.redo()}>
									<RedoIcon fontSize="small" />
								</IconButton>
							</span>
						</Tooltip>

						<Tooltip title="Add Graphic Controls">
							<IconButton size="small" color="primary" onClick={() => onOpenAddGraphicDialog()}>
								<AddIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						{gridStore.selectedWidgetIds.length > 0 && (
							<Tooltip title={`Delete Selected (${gridStore.selectedWidgetIds.length})`}>
								<IconButton size="small" color="error" onClick={() => gridStore.removeSelectedWidgets()}>
									<DeleteIcon fontSize="small" />
								</IconButton>
							</Tooltip>
						)}

						<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
					</>
				)}

				<Tooltip title="Zoom Out">
					<IconButton size="small" onClick={() => gridStore.setViewport(panX, panY, Math.max(0.25, zoom - 0.15))}>
						<ZoomOutIcon fontSize="small" />
					</IconButton>
				</Tooltip>

				<Tooltip title="Reset Zoom to 100%">
					<Button
						size="small"
						color="inherit"
						onClick={() => gridStore.setViewport(panX, panY, 1)}
						sx={{ minWidth: 48, px: 0.5, fontSize: '0.75rem', fontWeight: 700 }}
					>
						{Math.round(zoom * 100)}%
					</Button>
				</Tooltip>

				<Tooltip title="Zoom In">
					<IconButton size="small" onClick={() => gridStore.setViewport(panX, panY, Math.min(3, zoom + 0.15))}>
						<ZoomInIcon fontSize="small" />
					</IconButton>
				</Tooltip>

				<Tooltip title="Fit View to All Widgets">
					<IconButton size="small" onClick={handleFitToContent}>
						<FitScreenIcon fontSize="small" />
					</IconButton>
				</Tooltip>

				<Tooltip title="Reset Origin (0,0)">
					<IconButton size="small" onClick={() => gridStore.resetViewport()}>
						<CenterFocusStrongIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Paper>

			{/* Context Menu */}
			<ContextMenu
				state={contextMenuState}
				onClose={() => setContextMenuState(null)}
				onAddGraphicAtCell={(cell) => onOpenAddGraphicDialog(cell)}
				onUploadGraphic={onOpenUploadDialog}
				onFitToContent={handleFitToContent}
			/>

			{/* Feedback Notification Snackbar */}
			<Snackbar
				open={Boolean(gridStore.snackbarMessage)}
				autoHideDuration={gridStore.snackbarSeverity === 'error' ? 3500 : 2200}
				onClose={() => gridStore.setSnackbarMessage(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert
					onClose={() => gridStore.setSnackbarMessage(null)}
					severity={gridStore.snackbarSeverity || 'info'}
					variant="filled"
					sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}
				>
					{gridStore.snackbarMessage}
				</Alert>
			</Snackbar>
		</Box>
	)
})
