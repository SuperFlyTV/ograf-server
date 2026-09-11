import * as React from 'react'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import DeleteIcon from '@mui/icons-material/Delete'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import EditIcon from '@mui/icons-material/Edit'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

import { graphicsListStore } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'

export interface ContextMenuState {
	mouseX: number
	mouseY: number
	targetType: 'item' | 'group' | 'background'
	itemId?: string
	groupId?: string
}

export const ContextMenu: React.FC<{
	state: ContextMenuState | null
	onClose: () => void
	onOpenAddGraphicMenu?: (e: React.MouseEvent<HTMLElement>) => void
	onRenameGroup?: (groupId: string) => void
	onUploadGraphic?: () => void
}> = ({ state, onClose, onRenameGroup, onUploadGraphic }) => {
	if (!state) return null

	const selectedCount = graphicsListStore.selectedIds.length
	const selectedItems = graphicsListStore.selectedItems
	const hasClipboard = Boolean(graphicsListStore.clipboard && graphicsListStore.clipboard.length > 0)

	const isItemContext = state.targetType === 'item'
	const isGroupContext = state.targetType === 'group'
	const isBackgroundContext = state.targetType === 'background'

	const handleAction = async (actionId: string) => {
		onClose()
		if (selectedItems.length > 0) {
			await GraphicsListAPI.performBatchAction(selectedItems, actionId)
		}
	}

	const handleQuickPlay = async () => {
		onClose()
		if (selectedItems.length > 0) {
			await GraphicsListAPI.performBatchQuickPlay(selectedItems)
		}
	}

	return (
		<Menu
			open={state !== null}
			onClose={onClose}
			anchorReference="anchorPosition"
			anchorPosition={{ top: state.mouseY, left: state.mouseX }}
			slotProps={{
				paper: {
					sx: { minWidth: 200 },
				},
			}}
		>
			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						void handleQuickPlay()
					}}
				>
					<ListItemIcon>
						<FlashOnIcon fontSize="small" color="primary" />
					</ListItemIcon>
					<ListItemText>Quick Play (Clear+Load+Play)</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Shift+F2
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						void handleAction('play')
					}}
				>
					<ListItemIcon>
						<PlayArrowIcon fontSize="small" color="success" />
					</ListItemIcon>
					<ListItemText>Play</ListItemText>
					<Typography variant="body2" color="text.secondary">
						F2
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						void handleAction('load')
					}}
				>
					<ListItemIcon>
						<RefreshIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Load</ListItemText>
					<Typography variant="body2" color="text.secondary">
						F3
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						void handleAction('update')
					}}
				>
					<ListItemIcon>
						<SyncIcon fontSize="small" color="secondary" />
					</ListItemIcon>
					<ListItemText>Update</ListItemText>
					<Typography variant="body2" color="text.secondary">
						F6
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						void handleAction('stop')
					}}
				>
					<ListItemIcon>
						<StopIcon fontSize="small" color="error" />
					</ListItemIcon>
					<ListItemText>Stop</ListItemText>
					<Typography variant="body2" color="text.secondary">
						F1
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && <Divider />}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.cutSelection()
					}}
				>
					<ListItemIcon>
						<ContentCutIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Cut</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Ctrl+X
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.copySelection()
					}}
				>
					<ListItemIcon>
						<ContentCopyIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Copy</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Ctrl+C
					</Typography>
				</MenuItem>
			)}

			<MenuItem
				disabled={!hasClipboard}
				onClick={() => {
					onClose()
					graphicsListStore.paste(isGroupContext ? state.groupId : undefined)
				}}
			>
				<ListItemIcon>
					<ContentPasteIcon fontSize="small" />
				</ListItemIcon>
				<ListItemText>Paste</ListItemText>
				<Typography variant="body2" color="text.secondary">
					Ctrl+V
				</Typography>
			</MenuItem>

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.duplicateSelection()
					}}
				>
					<ListItemIcon>
						<ControlPointDuplicateIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Duplicate</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Ctrl+D
					</Typography>
				</MenuItem>
			)}

			<Divider />

			{isItemContext && selectedCount > 0 && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.groupSelected()
					}}
				>
					<ListItemIcon>
						<CreateNewFolderIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Group Selected</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Ctrl+G
					</Typography>
				</MenuItem>
			)}

			{isGroupContext && state.groupId && onRenameGroup && (
				<MenuItem
					onClick={() => {
						const gId = state.groupId
						onClose()
						if (gId) {
							onRenameGroup(gId)
						}
					}}
				>
					<ListItemIcon>
						<EditIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Rename Group</ListItemText>
				</MenuItem>
			)}

			{isGroupContext && state.groupId && (
				<MenuItem
					onClick={() => {
						const gId = state.groupId
						onClose()
						if (gId) {
							graphicsListStore.ungroup(gId)
						}
					}}
				>
					<ListItemIcon>
						<FolderOpenIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Ungroup</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Ctrl+Shift+G
					</Typography>
				</MenuItem>
			)}

			{isBackgroundContext && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.addGroup('New Group')
					}}
				>
					<ListItemIcon>
						<CreateNewFolderIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>New Group</ListItemText>
				</MenuItem>
			)}

			{isBackgroundContext && serverDataStore.severIsOurs && (
				<MenuItem
					onClick={() => {
						onClose()
						if (onUploadGraphic) {
							onUploadGraphic()
						}
					}}
				>
					<ListItemIcon>
						<CloudUploadIcon fontSize="small" color="primary" />
					</ListItemIcon>
					<ListItemText sx={{ color: 'primary.main', fontWeight: 500 }}>Upload Graphic (.zip)...</ListItemText>
				</MenuItem>
			)}

			{isBackgroundContext && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.selectAll()
					}}
				>
					<ListItemText>Select All</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Ctrl+A
					</Typography>
				</MenuItem>
			)}

			{(isItemContext || isGroupContext) && <Divider />}

			{(isItemContext || isGroupContext) && (
				<MenuItem
					onClick={() => {
						onClose()
						graphicsListStore.removeSelected()
					}}
				>
					<ListItemIcon>
						<DeleteIcon fontSize="small" color="error" />
					</ListItemIcon>
					<ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
					<Typography variant="body2" color="text.secondary">
						Del
					</Typography>
				</MenuItem>
			)}
		</Menu>
	)
}
