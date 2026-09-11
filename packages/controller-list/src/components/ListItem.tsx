import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'

import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

import _Draggable, { DraggableData, DraggableEvent, DraggableProps } from 'react-draggable'
import { DataPreview } from './DataPreview.js'
import { graphicsListStore, PlaybackItem } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'
import { dndManager } from '../lib/dndManager.js'

const Draggable = _Draggable as unknown as React.ComponentType<
	Partial<DraggableProps> & {
		nodeRef?: React.RefObject<HTMLElement | null>
		children?: React.ReactNode
	}
>

function formatRenderTarget(target: unknown): string | null {
	if (!target) return null
	if (typeof target === 'string' || typeof target === 'number') return `${target}`
	if (typeof target === 'object') {
		const obj = target as Record<string, unknown>
		const entries = Object.entries<unknown>(obj)
		if (entries.length === 0) return null
		if (entries.length === 1) {
			const v = entries[0][1]
			return typeof v === 'object' && v !== null
				? JSON.stringify(v)
				: `${(v as string | number | boolean | undefined) ?? ''}`
		}
		const values = entries
			.map(
				([k, v]) => `${k}: ${typeof v === 'object' ? '...' : `${(v as string | number | boolean | undefined) ?? ''}`}`
			)
			.join(', ')
		return values || null
	}
	return null
}

export const ListItem = observer(function ListItem({
	item,
	index,
	groupId,
	isSelected,
	onContextMenu,
}: {
	item: PlaybackItem
	index: number
	groupId?: string
	isSelected: boolean
	onContextMenu?: (e: React.MouseEvent, item: PlaybackItem) => void
}) {
	const [isHovered, setIsHovered] = React.useState(false)
	const [isDragging, setIsDragging] = React.useState(false)
	const nodeRef = React.useRef<HTMLDivElement>(null)

	const isLoaded = Boolean(
		item.graphicInstanceId || serverDataStore.getGraphicInstanceId(item.rendererId, item.renderTarget, item.graphicId)
	)

	const targetSummary = formatRenderTarget(item.renderTarget)

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (e.ctrlKey || e.metaKey) {
			graphicsListStore.selectItem(item.id, { toggle: true })
		} else if (e.shiftKey) {
			graphicsListStore.selectItem(item.id, { range: true })
		} else {
			graphicsListStore.selectItem(item.id)
		}
	}

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault()
		if (!graphicsListStore.isIdSelected(item.id)) {
			graphicsListStore.selectItem(item.id)
		}
		if (onContextMenu) {
			onContextMenu(e, item)
		}
	}

	const handleStart = (_e: DraggableEvent, _data: DraggableData) => {
		setIsDragging(true)
		dndManager.startDrag({ id: item.id, type: 'item', groupId, index })
	}

	const handleDrag = (e: DraggableEvent, _data: DraggableData) => {
		const mouseEvent = e as MouseEvent
		dndManager.updateDrag(mouseEvent.clientX, mouseEvent.clientY)
	}

	const handleStop = (e: DraggableEvent, _data: DraggableData) => {
		setIsDragging(false)
		const mouseEvent = e as MouseEvent
		dndManager.endDrag(Boolean(mouseEvent?.altKey))
	}

	return (
		<Draggable
			nodeRef={nodeRef}
			handle=".drag-handle"
			position={{ x: 0, y: 0 }}
			onStart={handleStart}
			onDrag={handleDrag}
			onStop={handleStop}
		>
			<Box
				ref={nodeRef}
				data-dnd-entry-id={item.id}
				data-dnd-type="item"
				data-dnd-group-id={groupId || ''}
				data-dnd-index={index}
				sx={{
					position: 'relative',
					mb: 0.5,
					zIndex: isDragging ? 1000 : 1,
					opacity: isDragging ? 0.75 : 1,
					pointerEvents: 'auto',
				}}
			>
				<Paper
					elevation={isSelected ? 3 : isHovered ? 2 : 1}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
					onContextMenu={handleContextMenu}
					onClick={handleClick}
					sx={{
						px: 1.25,
						py: 0.75,
						cursor: 'pointer',
						borderRadius: 1.25,
						transition: isDragging ? 'none' : 'all 0.1s ease-in-out',
						outline: isSelected ? '2px solid' : '1px solid',
						outlineColor: isSelected ? 'primary.main' : 'divider',
						bgcolor: isSelected ? 'action.selected' : 'background.paper',
						userSelect: 'none',
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						position: 'relative',
						'&:hover': {
							bgcolor: isSelected ? 'action.selected' : 'action.hover',
						},
					}}
				>
					{/* Drag Handle */}
					<Box
						className="drag-handle"
						sx={{
							cursor: 'grab',
							display: 'flex',
							alignItems: 'center',
							color: 'text.secondary',
							opacity: 0.6,
							'&:hover': { color: 'primary.main', opacity: 1 },
							'&:active': { cursor: 'grabbing' },
						}}
						title="Drag to move, Alt+Drag to duplicate"
					>
						<DragIndicatorIcon sx={{ fontSize: 18 }} />
					</Box>

					{/* Main Info */}
					<Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
						<Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
							<Typography variant="body1" fontWeight={600} noWrap title={item.graphicId} sx={{ fontSize: '0.9rem' }}>
								{item.graphicId}
							</Typography>

							{isLoaded && (
								<Tooltip title="Loaded on render target">
									<CheckCircleIcon color="success" sx={{ fontSize: 16, display: 'inline-flex' }} />
								</Tooltip>
							)}

							{graphicsListStore.hasMultipleRenderersInList && (
								<Tooltip title={`Renderer: ${item.rendererId}`}>
									<Chip
										label={item.rendererId}
										size="small"
										color="info"
										variant="outlined"
										sx={{ height: 18, fontSize: '0.68rem', px: 0.25, maxWidth: 120 }}
									/>
								</Tooltip>
							)}

							{graphicsListStore.hasMultipleRenderTargetsInList && targetSummary && (
								<Tooltip
									title={`Render Target: ${typeof item.renderTarget === 'object' && item.renderTarget !== null ? JSON.stringify(item.renderTarget) : targetSummary}`}
								>
									<Chip
										label={targetSummary}
										size="small"
										variant="outlined"
										sx={{ height: 18, fontSize: '0.68rem', px: 0.25, maxWidth: 160 }}
									/>
								</Tooltip>
							)}
						</Stack>

						{/* Data Preview */}
						<Box>
							<DataPreview data={item.graphicData} />
						</Box>
					</Box>

					{/* Actions */}
					<Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
						<Tooltip title="Play (F2)">
							<IconButton
								size="small"
								color="primary"
								sx={{ p: 0.5 }}
								onClick={(e) => {
									e.stopPropagation()
									void GraphicsListAPI.performAction(item, 'play')
								}}
							>
								<PlayArrowIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<Tooltip title="Stop (F1)">
							<IconButton
								size="small"
								color="error"
								sx={{ p: 0.5 }}
								onClick={(e) => {
									e.stopPropagation()
									void GraphicsListAPI.performAction(item, 'stop')
								}}
							>
								<StopIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<Tooltip title="Load (F3)">
							<IconButton
								size="small"
								sx={{ p: 0.5 }}
								onClick={(e) => {
									e.stopPropagation()
									void GraphicsListAPI.performAction(item, 'load')
								}}
							>
								<RefreshIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<Tooltip title="Duplicate (Ctrl+D)">
							<IconButton
								size="small"
								sx={{ p: 0.5 }}
								onClick={(e) => {
									e.stopPropagation()
									graphicsListStore.duplicateItem(item.id, groupId)
								}}
							>
								<ControlPointDuplicateIcon fontSize="small" />
							</IconButton>
						</Tooltip>

						<Tooltip title="Delete">
							<IconButton
								size="small"
								color="error"
								sx={{ p: 0.5 }}
								onClick={(e: React.MouseEvent) => {
									e.stopPropagation()
									graphicsListStore.removeItem(item.id)
								}}
							>
								<DeleteIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Stack>
				</Paper>
			</Box>
		</Draggable>
	)
})
