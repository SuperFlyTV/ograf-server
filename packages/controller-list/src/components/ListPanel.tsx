import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import AddIcon from '@mui/icons-material/Add'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import FolderIcon from '@mui/icons-material/Folder'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeselectIcon from '@mui/icons-material/Deselect'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

import { graphicsListStore, isPlaybackGroup, PlaybackItem, PlaybackListEntry } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { ListItem } from './ListItem.js'
import { GroupItem } from './GroupItem.js'
import { ContextMenu, ContextMenuState } from './ContextMenu.js'
import { UploadGraphicDialog } from './UploadGraphicDialog.js'
import { AddGraphicDialog } from './AddGraphicDialog.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'
import { uploadGraphicZip } from '../lib/uploadGraphic.js'

export const ListPanel = observer(function ListPanel() {
	const [addGraphicDialogOpen, setAddGraphicDialogOpen] = React.useState(false)
	const [contextMenuState, setContextMenuState] = React.useState<ContextMenuState | null>(null)
	const [allCollapsed, setAllCollapsed] = React.useState(false)
	const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)
	const [isFileDragging, setIsFileDragging] = React.useState(false)
	const dragCounterRef = React.useRef(0)

	const handleFileDragEnter = (e: React.DragEvent) => {
		if (addGraphicDialogOpen || uploadDialogOpen) return
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			dragCounterRef.current++
			setIsFileDragging(true)
		}
	}

	const handleFileDragOver = (e: React.DragEvent) => {
		if (addGraphicDialogOpen || uploadDialogOpen) return
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			e.dataTransfer.dropEffect = 'copy'
		}
	}

	const handleFileDragLeave = (e: React.DragEvent) => {
		if (addGraphicDialogOpen || uploadDialogOpen) return
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
		if (addGraphicDialogOpen || uploadDialogOpen) return
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			dragCounterRef.current = 0
			setIsFileDragging(false)

			const files = Array.from(e.dataTransfer.files || [])
			const zipFiles = files.filter((f) => f.name.toLowerCase().endsWith('.zip'))

			if (zipFiles.length === 0) {
				graphicsListStore.showError('Please drop a valid .zip graphic package.')
				return
			}

			for (const file of zipFiles) {
				graphicsListStore.showNotification(`Uploading ${file.name}...`, 'info')
				uploadGraphicZip(file, true)
					.then((uploadedIds) => {
						const msg =
							uploadedIds.length > 0
								? `Successfully uploaded and added: ${uploadedIds.join(', ')}`
								: `Uploaded ${file.name} successfully.`
						graphicsListStore.showNotification(msg, 'success')
					})
					.catch((err: unknown) => {
						const errMsg = err instanceof Error ? err.message : 'Upload error occurred'
						graphicsListStore.showError(`Failed to upload ${file.name}: ${errMsg}`)
					})
			}
		}
	}

	// Global keyboard shortcuts
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return // Ignore typing in text fields
			}

			const isCtrlOrCmd = e.ctrlKey || e.metaKey

			// Undo / Redo
			if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
				e.preventDefault()
				if (e.shiftKey) {
					graphicsListStore.redo()
				} else {
					graphicsListStore.undo()
				}
				return
			}
			if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
				e.preventDefault()
				graphicsListStore.redo()
				return
			}

			// Copy / Cut / Paste / Duplicate
			if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
				e.preventDefault()
				graphicsListStore.copySelection()
				return
			}
			if (isCtrlOrCmd && (e.key === 'x' || e.key === 'X')) {
				e.preventDefault()
				graphicsListStore.cutSelection()
				return
			}
			if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
				e.preventDefault()
				graphicsListStore.paste()
				return
			}
			if (isCtrlOrCmd && (e.key === 'd' || e.key === 'D')) {
				e.preventDefault()
				graphicsListStore.duplicateSelection()
				return
			}

			// Group / Ungroup
			if (isCtrlOrCmd && (e.key === 'g' || e.key === 'G')) {
				e.preventDefault()
				if (e.shiftKey) {
					const selectedGroup = graphicsListStore.selectedGroup
					if (selectedGroup) {
						graphicsListStore.ungroup(selectedGroup.id)
					}
				} else {
					graphicsListStore.groupSelected()
				}
				return
			}

			// Select All / Deselect
			if (isCtrlOrCmd && (e.key === 'a' || e.key === 'A')) {
				e.preventDefault()
				graphicsListStore.selectAll()
				return
			}
			if (e.key === 'Escape') {
				e.preventDefault()
				graphicsListStore.clearSelection()
				setContextMenuState(null)
				return
			}

			// Delete
			if (e.key === 'Delete' || e.key === 'Backspace') {
				e.preventDefault()
				graphicsListStore.removeSelected()
				return
			}

			// Move item up / down with Alt+Up / Alt+Down
			if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				e.preventDefault()
				if (e.key === 'ArrowUp') {
					graphicsListStore.moveSelectedUp()
				} else {
					graphicsListStore.moveSelectedDown()
				}
				return
			}

			// Navigation
			if (e.key === 'ArrowUp') {
				e.preventDefault()
				graphicsListStore.selectPrev(e.shiftKey)
				return
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				graphicsListStore.selectNext(e.shiftKey)
				return
			}

			// Action execution on selection
			const selectedItems = graphicsListStore.selectedItems
			if (selectedItems.length === 0) return

			const actions: Record<string, string> = {
				F1: 'stop',
				F2: 'play',
				F3: 'load',
				F4: 'stepBack',
				F5: 'stepForward',
				F6: 'update',
			}

			if (actions[e.key]) {
				e.preventDefault()

				if (e.key === 'F2' && e.shiftKey) {
					GraphicsListAPI.performBatchQuickPlay(selectedItems).catch(console.error)
					return
				}

				GraphicsListAPI.performBatchAction(selectedItems, actions[e.key]).catch(console.error)
			} else if (e.key === 'F10') {
				e.preventDefault()
				graphicsListStore.clearItems()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Filter entries based on search query
	const searchQuery = graphicsListStore.searchQuery.toLowerCase().trim()
	const filteredEntries = React.useMemo(() => {
		if (!searchQuery) return graphicsListStore.entries

		const matchesItem = (it: PlaybackItem) => {
			if (it.graphicId.toLowerCase().includes(searchQuery)) return true
			if (it.rendererId.toLowerCase().includes(searchQuery)) return true
			if (it.graphicData && JSON.stringify(it.graphicData).toLowerCase().includes(searchQuery)) return true
			return false
		}

		return graphicsListStore.entries
			.map((entry) => {
				if (isPlaybackGroup(entry)) {
					const groupMatches = entry.name.toLowerCase().includes(searchQuery)
					const matchingItems = (entry.items || []).filter(matchesItem)
					if (groupMatches) return entry
					if (matchingItems.length > 0) {
						return { ...entry, items: matchingItems }
					}
					return null
				} else {
					return matchesItem(entry) ? entry : null
				}
			})
			.filter(Boolean) as PlaybackListEntry[]
	}, [graphicsListStore.entries, searchQuery])

	const selectedCount = graphicsListStore.selectedIds.length

	return (
		<Box
			sx={{ p: 0.75, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
			onDragEnter={handleFileDragEnter}
			onDragOver={handleFileDragOver}
			onDragLeave={handleFileDragLeave}
			onDrop={handleFileDrop}
			onContextMenu={(e) => {
				e.preventDefault()
				setContextMenuState({
					mouseX: e.clientX,
					mouseY: e.clientY,
					targetType: 'background',
				})
			}}
		>
			{/* Drop .zip Overlay */}
			{isFileDragging && (
				<Box
					sx={{
						position: 'absolute',
						inset: 6,
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
						Archive will be uploaded to server and added to the rundown
					</Typography>
				</Box>
			)}

			{/* Top Header & Rundown Stats */}
			<Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
				<Stack direction="row" alignItems="center" spacing={1}>
					<Typography variant="h5" fontWeight={700}>
						Graphics Rundown
					</Typography>
					{selectedCount > 0 && (
						<Chip
							label={`${selectedCount} selected`}
							size="small"
							color="primary"
							onDelete={() => graphicsListStore.clearSelection()}
						/>
					)}
				</Stack>

				<Stack direction="row" spacing={0.5} alignItems="center">
					<Tooltip title="Undo (Ctrl+Z)">
						<span>
							<IconButton size="small" disabled={!graphicsListStore.canUndo} onClick={() => graphicsListStore.undo()}>
								<UndoIcon fontSize="small" />
							</IconButton>
						</span>
					</Tooltip>

					<Tooltip title="Redo (Ctrl+Y)">
						<span>
							<IconButton size="small" disabled={!graphicsListStore.canRedo} onClick={() => graphicsListStore.redo()}>
								<RedoIcon fontSize="small" />
							</IconButton>
						</span>
					</Tooltip>

					<Tooltip title={allCollapsed ? 'Expand all groups' : 'Collapse all groups'}>
						<IconButton
							size="small"
							onClick={() => {
								const next = !allCollapsed
								setAllCollapsed(next)
								graphicsListStore.setAllGroupsCollapse(next)
							}}
						>
							{allCollapsed ? <UnfoldMoreIcon fontSize="small" /> : <UnfoldLessIcon fontSize="small" />}
						</IconButton>
					</Tooltip>

					<Tooltip title="Select All (Ctrl+A)">
						<IconButton size="small" onClick={() => graphicsListStore.selectAll()}>
							<SelectAllIcon fontSize="small" />
						</IconButton>
					</Tooltip>

					{selectedCount > 0 && (
						<Tooltip title="Deselect All (Esc)">
							<IconButton size="small" onClick={() => graphicsListStore.clearSelection()}>
								<DeselectIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					)}
				</Stack>
			</Stack>

			{/* Search & Action Bar */}
			<Stack direction="row" spacing={1} mb={2} alignItems="center">
				<TextField
					size="small"
					placeholder="Search graphics or groups..."
					value={graphicsListStore.searchQuery}
					onChange={(e) => graphicsListStore.setSearchQuery(e.target.value)}
					sx={{ flexGrow: 1 }}
					slotProps={{
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon fontSize="small" color="action" />
								</InputAdornment>
							),
							endAdornment: graphicsListStore.searchQuery ? (
								<InputAdornment position="end">
									<IconButton size="small" onClick={() => graphicsListStore.setSearchQuery('')}>
										<ClearIcon fontSize="small" />
									</IconButton>
								</InputAdornment>
							) : null,
						},
					}}
				/>

				<Button
					variant="contained"
					startIcon={<AddIcon />}
					onClick={() => setAddGraphicDialogOpen(true)}
					sx={{ whiteSpace: 'nowrap' }}
				>
					Add Graphic
				</Button>

				<Button
					variant="outlined"
					startIcon={<CreateNewFolderIcon />}
					onClick={() => graphicsListStore.addGroup('New Group')}
					sx={{ whiteSpace: 'nowrap' }}
				>
					New Group
				</Button>

				{selectedCount > 1 && (
					<Tooltip title="Group selected items (Ctrl+G)">
						<Button
							variant="outlined"
							color="secondary"
							startIcon={<FolderIcon />}
							onClick={() => graphicsListStore.groupSelected()}
							sx={{ whiteSpace: 'nowrap' }}
						>
							Group Selected
						</Button>
					</Tooltip>
				)}
			</Stack>

			{/* Rundown List Container */}
			<Box
				sx={{
					flexGrow: 1,
					overflowY: 'auto',
					mb: 1,
					pr: 0.5,
					pb: 8,
				}}
				onClick={(e) => {
					if (e.target === e.currentTarget) {
						graphicsListStore.clearSelection()
					}
				}}
			>
				{filteredEntries.map((entry, index) =>
					isPlaybackGroup(entry) ? (
						<GroupItem
							key={entry.id}
							group={entry}
							index={index}
							isSelected={graphicsListStore.isIdSelected(entry.id)}
							onContextMenu={(e, target) => {
								if (target.type === 'group') {
									setContextMenuState({
										mouseX: e.clientX,
										mouseY: e.clientY,
										targetType: 'group',
										groupId: target.id,
									})
								} else {
									setContextMenuState({
										mouseX: e.clientX,
										mouseY: e.clientY,
										targetType: 'item',
										itemId: target.id,
										groupId: target.group?.id,
									})
								}
							}}
						/>
					) : (
						<ListItem
							key={entry.id}
							item={entry}
							index={index}
							isSelected={graphicsListStore.isIdSelected(entry.id)}
							onContextMenu={(e, item) => {
								setContextMenuState({
									mouseX: e.clientX,
									mouseY: e.clientY,
									targetType: 'item',
									itemId: item.id,
								})
							}}
						/>
					)
				)}

				{filteredEntries.length === 0 && (
					<Box sx={{ textAlign: 'center', mt: 8, px: 4 }}>
						{graphicsListStore.entries.length === 0 ? (
							<>
								<Typography variant="h6" color="text.secondary" gutterBottom>
									Welcome! Let's build your graphics rundown.
								</Typography>
								<Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
									Click <strong>Add Graphic</strong> or <strong>New Group</strong> to begin.
								</Typography>
								<Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mb: 2 }}>
									<Button
										variant="contained"
										size="small"
										startIcon={<AddIcon />}
										onClick={() => setAddGraphicDialogOpen(true)}
									>
										Add Graphic
									</Button>
									{serverDataStore.severIsOurs && (
										<Button
											variant="outlined"
											size="small"
											startIcon={<CloudUploadIcon />}
											onClick={() => setUploadDialogOpen(true)}
										>
											Upload Graphic (.zip)
										</Button>
									)}
								</Stack>
								<Typography variant="body2" color="text.disabled">
									Tip: You can reorder, group, multi-select with Shift/Ctrl, and Alt+Drag to duplicate items.
								</Typography>
							</>
						) : (
							<Typography variant="body1" color="text.secondary">
								No graphics or groups match "{graphicsListStore.searchQuery}".
							</Typography>
						)}
					</Box>
				)}
			</Box>

			{/* Add Graphic Modal Dialog */}
			<AddGraphicDialog open={addGraphicDialogOpen} onClose={() => setAddGraphicDialogOpen(false)} />

			{/* Context Menu */}
			<ContextMenu
				state={contextMenuState}
				onClose={() => setContextMenuState(null)}
				onUploadGraphic={() => setUploadDialogOpen(true)}
			/>

			{/* Upload Graphic Dialog */}
			<UploadGraphicDialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} />

			{/* Feedback Notification Snackbar */}
			<Snackbar
				open={Boolean(graphicsListStore.snackbarMessage)}
				autoHideDuration={graphicsListStore.snackbarSeverity === 'error' ? 3500 : 2500}
				onClose={() => graphicsListStore.setSnackbarMessage(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert
					onClose={() => graphicsListStore.setSnackbarMessage(null)}
					severity={graphicsListStore.snackbarSeverity || 'info'}
					variant="filled"
					sx={{ width: '100%', maxWidth: 450, boxShadow: 3 }}
				>
					{graphicsListStore.snackbarMessage}
				</Alert>
			</Snackbar>
		</Box>
	)
})
