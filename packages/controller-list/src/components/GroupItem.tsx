import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Collapse from '@mui/material/Collapse'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import DeleteIcon from '@mui/icons-material/Delete'

import _Draggable, { DraggableData, DraggableEvent, DraggableProps } from 'react-draggable'
import { graphicsListStore, PlaybackGroup, PlaybackItem } from '../stores/graphicsList.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'
import { ListItem } from './ListItem.js'
import { dndManager } from '../lib/dndManager.js'

const Draggable = _Draggable as unknown as React.ComponentType<
	Partial<DraggableProps> & {
		nodeRef?: React.RefObject<HTMLElement | null>
		children?: React.ReactNode
	}
>

export const GroupItem = observer(function GroupItem({
	group,
	index,
	isSelected,
	onContextMenu,
}: {
	group: PlaybackGroup
	index: number
	isSelected: boolean
	onContextMenu?: (
		e: React.MouseEvent,
		target: { type: 'group' | 'item'; id: string; group?: PlaybackGroup; item?: PlaybackItem }
	) => void
}) {
	const [isEditingName, setIsEditingName] = React.useState(false)
	const [editNameValue, setEditNameValue] = React.useState(group.name)
	const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null)
	const [isDragging, setIsDragging] = React.useState(false)
	const nodeRef = React.useRef<HTMLDivElement>(null)

	const isCollapsed = Boolean(group.collapsed)
	const itemsCount = group.items?.length || 0

	const handleHeaderClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (e.ctrlKey || e.metaKey) {
			graphicsListStore.selectGroup(group.id, { toggle: true })
		} else if (e.shiftKey) {
			graphicsListStore.selectGroup(group.id, { range: true })
		} else {
			graphicsListStore.selectGroup(group.id)
		}
	}

	const handleSaveName = () => {
		graphicsListStore.renameGroup(group.id, editNameValue)
		setIsEditingName(false)
	}

	const handleKeyDownName = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSaveName()
		} else if (e.key === 'Escape') {
			setEditNameValue(group.name)
			setIsEditingName(false)
		}
	}

	const handleStart = (_e: DraggableEvent, _data: DraggableData) => {
		setIsDragging(true)
		dndManager.startDrag({ id: group.id, type: 'group', index })
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
			handle=".group-drag-handle"
			position={{ x: 0, y: 0 }}
			onStart={handleStart}
			onDrag={handleDrag}
			onStop={handleStop}
		>
			<Box
				ref={nodeRef}
				data-dnd-entry-id={group.id}
				data-dnd-type="group"
				data-dnd-index={index}
				sx={{
					position: 'relative',
					mb: 0.75,
					zIndex: isDragging ? 1000 : 1,
					opacity: isDragging ? 0.75 : 1,
				}}
			>
				<Paper
					elevation={isSelected ? 3 : 1}
					sx={{
						borderRadius: 1.5,
						overflow: 'hidden',
						outline: isSelected ? '2px solid' : '1px solid',
						outlineColor: isSelected ? 'primary.main' : 'divider',
						bgcolor: (theme) =>
							isSelected
								? 'action.selected'
								: theme.palette.mode === 'dark'
									? 'rgba(255, 255, 255, 0.03)'
									: 'rgba(0, 0, 0, 0.02)',
						transition: 'outline-color 0.1s ease-in-out',
					}}
				>
					{/* Group Header */}
					<Box
						onClick={handleHeaderClick}
						onContextMenu={(e: React.MouseEvent) => {
							e.preventDefault()
							if (!graphicsListStore.isIdSelected(group.id)) {
								graphicsListStore.selectGroup(group.id)
							}
							if (onContextMenu) {
								onContextMenu(e, { type: 'group', id: group.id, group })
							}
						}}
						sx={{
							px: 1.25,
							py: 0.75,
							display: 'flex',
							alignItems: 'center',
							gap: 0.75,
							cursor: 'pointer',
							userSelect: 'none',
							bgcolor: (theme) =>
								isSelected
									? 'action.selected'
									: theme.palette.mode === 'dark'
										? 'rgba(255, 255, 255, 0.05)'
										: 'rgba(0, 0, 0, 0.04)',
							borderBottom: isCollapsed ? 'none' : '1px solid',
							borderColor: 'divider',
							'&:hover': {
								bgcolor: isSelected ? 'action.selected' : 'action.hover',
							},
						}}
					>
						{/* Group Drag Handle */}
						<Box
							className="group-drag-handle"
							sx={{
								cursor: 'grab',
								display: 'flex',
								alignItems: 'center',
								color: 'text.secondary',
								'&:hover': { color: 'primary.main' },
								'&:active': { cursor: 'grabbing' },
							}}
							title="Drag to reorder group, Alt+Drag to duplicate"
							onClick={(e) => e.stopPropagation()}
						>
							<DragIndicatorIcon fontSize="small" />
						</Box>

						{/* Collapse / Expand Toggle */}
						<IconButton
							size="small"
							onClick={(e) => {
								e.stopPropagation()
								graphicsListStore.toggleGroupCollapse(group.id)
							}}
							title={isCollapsed ? 'Expand group' : 'Collapse group'}
						>
							{isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
						</IconButton>

						{/* Group Folder Icon */}
						{isCollapsed ? (
							<FolderIcon fontSize="small" color="primary" />
						) : (
							<FolderOpenIcon fontSize="small" color="primary" />
						)}

						{/* Group Name (Inline editable) */}
						<Box sx={{ flexGrow: 1, minWidth: 0 }}>
							{isEditingName ? (
								<TextField
									size="small"
									value={editNameValue}
									autoFocus
									onChange={(e) => setEditNameValue(e.target.value)}
									onBlur={handleSaveName}
									onKeyDown={handleKeyDownName}
									onClick={(e) => e.stopPropagation()}
									sx={{ width: 250 }}
								/>
							) : (
								<Stack direction="row" alignItems="center" spacing={1}>
									<Typography
										variant="subtitle1"
										fontWeight={700}
										noWrap
										onDoubleClick={(e) => {
											e.stopPropagation()
											setEditNameValue(group.name)
											setIsEditingName(true)
										}}
										title="Double-click to rename"
									>
										{group.name}
									</Typography>
									<Chip label={`${itemsCount} item${itemsCount === 1 ? '' : 's'}`} size="small" variant="outlined" />
								</Stack>
							)}
						</Box>

						{/* Group Actions */}
						<Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
							<Tooltip title="Quick Play All (Shift+F2)">
								<IconButton
									size="small"
									color="primary"
									disabled={itemsCount === 0}
									onClick={() => {
										void GraphicsListAPI.performBatchQuickPlay(group.items || [])
									}}
								>
									<FlashOnIcon fontSize="small" />
								</IconButton>
							</Tooltip>

							<Tooltip title="Play All (F2)">
								<IconButton
									size="small"
									color="success"
									disabled={itemsCount === 0}
									onClick={() => {
										void GraphicsListAPI.performBatchAction(group.items || [], 'play')
									}}
								>
									<PlayArrowIcon fontSize="small" />
								</IconButton>
							</Tooltip>

							<Tooltip title="Stop All (F1)">
								<IconButton
									size="small"
									color="error"
									disabled={itemsCount === 0}
									onClick={() => {
										void GraphicsListAPI.performBatchAction(group.items || [], 'stop')
									}}
								>
									<StopIcon fontSize="small" />
								</IconButton>
							</Tooltip>

							<Tooltip title="Load All (F3)">
								<IconButton
									size="small"
									disabled={itemsCount === 0}
									onClick={() => {
										void GraphicsListAPI.performBatchAction(group.items || [], 'load')
									}}
								>
									<RefreshIcon fontSize="small" />
								</IconButton>
							</Tooltip>

							<IconButton
								size="small"
								onClick={(e) => {
									e.stopPropagation()
									setMenuAnchorEl(e.currentTarget)
								}}
							>
								<MoreVertIcon fontSize="small" />
							</IconButton>
						</Stack>
					</Box>

					{/* Group Menu */}
					<Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
						<MenuItem
							onClick={() => {
								setMenuAnchorEl(null)
								setEditNameValue(group.name)
								setIsEditingName(true)
							}}
						>
							<ListItemIcon>
								<EditIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Rename Group</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								setMenuAnchorEl(null)
								graphicsListStore.duplicateGroup(group.id)
							}}
						>
							<ListItemIcon>
								<ControlPointDuplicateIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Duplicate Group</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								setMenuAnchorEl(null)
								graphicsListStore.ungroup(group.id)
							}}
						>
							<ListItemIcon>
								<FolderOpenIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Ungroup (Ctrl+Shift+G)</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								setMenuAnchorEl(null)
								graphicsListStore.removeItem(group.id)
							}}
						>
							<ListItemIcon>
								<DeleteIcon fontSize="small" color="error" />
							</ListItemIcon>
							<ListItemText sx={{ color: 'error.main' }}>Delete Group</ListItemText>
						</MenuItem>
					</Menu>

					{/* Nested Group Items Container */}
					<Collapse in={!isCollapsed}>
						<Box
							data-dnd-group-body={group.id}
							sx={{
								p: 1.5,
								pl: 2.5,
								minHeight: itemsCount === 0 ? 50 : undefined,
								bgcolor: 'transparent',
								transition: 'background-color 0.15s ease-in-out',
							}}
						>
							{group.items && group.items.length > 0 ? (
								group.items.map((item, itemIndex) => (
									<ListItem
										key={item.id}
										item={item}
										index={itemIndex}
										groupId={group.id}
										isSelected={graphicsListStore.isIdSelected(item.id)}
										onContextMenu={(e, item) => {
											if (onContextMenu) {
												onContextMenu(e, { type: 'item', id: item.id, item, group })
											}
										}}
									/>
								))
							) : (
								<Box
									sx={{
										p: 2,
										textAlign: 'center',
										border: '1px dashed',
										borderColor: 'divider',
										borderRadius: 1,
									}}
								>
									<Typography variant="body2" color="text.secondary">
										Empty group. Drag items here to organize.
									</Typography>
								</Box>
							)}
						</Box>
					</Collapse>
				</Paper>
			</Box>
		</Draggable>
	)
})
