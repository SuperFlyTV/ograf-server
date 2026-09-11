import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'

import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import DeleteIcon from '@mui/icons-material/Delete'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

import { graphicsListStore, isPlaybackGroup, RundownTab } from '../stores/graphicsList.js'

function countTabItems(tab: RundownTab): number {
	let count = 0
	for (const entry of tab.entries || []) {
		if (isPlaybackGroup(entry)) {
			count += (entry.items || []).length
		} else {
			count += 1
		}
	}
	return count
}

export const RundownTabs: React.FC = observer(() => {
	const [editingTabId, setEditingTabId] = React.useState<string | null>(null)
	const [editNameValue, setEditNameValue] = React.useState('')
	const [confirmDeleteTab, setConfirmDeleteTab] = React.useState<RundownTab | null>(null)
	const [contextMenu, setContextMenu] = React.useState<{
		mouseX: number
		mouseY: number
		tab: RundownTab
	} | null>(null)

	const handleStartRename = (tab: RundownTab) => {
		setEditingTabId(tab.id)
		setEditNameValue(tab.name)
		setContextMenu(null)
	}

	const handleSaveRename = () => {
		if (editingTabId && editNameValue.trim()) {
			graphicsListStore.renameTab(editingTabId, editNameValue.trim())
		}
		setEditingTabId(null)
	}

	const handleRequestDelete = (tab: RundownTab) => {
		const itemsCount = countTabItems(tab)
		if (itemsCount > 0) {
			setConfirmDeleteTab(tab)
		} else {
			graphicsListStore.removeTab(tab.id)
		}
	}

	const handleConfirmDelete = () => {
		if (confirmDeleteTab) {
			graphicsListStore.removeTab(confirmDeleteTab.id)
			setConfirmDeleteTab(null)
		}
	}

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, mr: 2, maxWidth: '100%' }}>
			<Tabs
				value={graphicsListStore.activeTabId}
				onChange={(_e, val) => {
					if (editingTabId) return
					graphicsListStore.setActiveTab(val)
				}}
				variant="scrollable"
				scrollButtons="auto"
				allowScrollButtonsMobile
				sx={{
					minHeight: 44,
					flexGrow: 0,
					flexShrink: 1,
					maxWidth: 'calc(100% - 48px)',
					'& .MuiTabScrollButton-root': {
						'&.Mui-disabled': {
							width: 0,
							minWidth: 0,
							p: 0,
							m: 0,
							opacity: 0,
							pointerEvents: 'none',
							display: 'none',
						},
					},
					'& .MuiTab-root': {
						minHeight: 44,
						py: 0.5,
						px: 1.5,
						textTransform: 'none',
						fontWeight: 600,
						color: 'inherit',
						opacity: 0.75,
						'&.Mui-selected': {
							color: 'inherit',
							opacity: 1,
							bgcolor: 'action.selected',
						},
					},
					'& .MuiTabs-indicator': {
						bgcolor: 'secondary.main',
						height: 3,
					},
				}}
			>
				{graphicsListStore.tabs.map((tab) => {
					const isEditing = editingTabId === tab.id
					const isSelected = graphicsListStore.activeTabId === tab.id
					const itemCount = countTabItems(tab)

					return (
						<Tab
							key={tab.id}
							value={tab.id}
							onDoubleClick={(e) => {
								e.stopPropagation()
								handleStartRename(tab)
							}}
							onContextMenu={(e) => {
								e.preventDefault()
								e.stopPropagation()
								setContextMenu({
									mouseX: e.clientX,
									mouseY: e.clientY,
									tab,
								})
							}}
							label={
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									{isEditing ? (
										<TextField
											size="small"
											variant="standard"
											value={editNameValue}
											autoFocus
											onChange={(e) => setEditNameValue(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													handleSaveRename()
												} else if (e.key === 'Escape') {
													setEditingTabId(null)
												}
											}}
											onBlur={handleSaveRename}
											onClick={(e) => e.stopPropagation()}
											sx={{
												input: {
													color: 'inherit',
													fontWeight: 600,
													fontSize: '0.875rem',
													py: 0,
												},
											}}
										/>
									) : (
										<>
											<Typography variant="body2" fontWeight={isSelected ? 700 : 500} noWrap>
												{tab.name}
											</Typography>
											{itemCount > 0 && (
												<Chip
													label={itemCount}
													size="small"
													sx={{
														height: 18,
														fontSize: '0.7rem',
														px: 0.25,
														bgcolor: isSelected ? 'action.selected' : 'action.hover',
														color: 'inherit',
													}}
												/>
											)}
										</>
									)}

									{/* Close tab button */}
									{graphicsListStore.tabs.length > 1 && !isEditing && (
										<IconButton
											size="small"
											aria-label="close-tab"
											onClick={(e) => {
												e.stopPropagation()
												handleRequestDelete(tab)
											}}
											sx={{
												p: 0.25,
												ml: 0.25,
												color: 'inherit',
												opacity: 0.6,
												'&:hover': {
													opacity: 1,
													bgcolor: 'action.hover',
													color: 'error.main',
												},
											}}
										>
											<CloseIcon sx={{ fontSize: 14 }} />
										</IconButton>
									)}
								</Box>
							}
						/>
					)
				})}
			</Tabs>

			{/* Add New Tab Button */}
			<Tooltip title="Add new rundown page">
				<IconButton
					color="inherit"
					size="small"
					onClick={() => graphicsListStore.addTab()}
					sx={{
						ml: 1,
						p: 0.75,
						bgcolor: 'action.hover',
						'&:hover': {
							bgcolor: 'action.selected',
						},
					}}
				>
					<AddIcon fontSize="small" />
				</IconButton>
			</Tooltip>

			{/* Tab Context Menu */}
			<Menu
				open={Boolean(contextMenu)}
				onClose={() => setContextMenu(null)}
				anchorReference="anchorPosition"
				anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
			>
				{contextMenu && (
					<>
						<MenuItem onClick={() => handleStartRename(contextMenu.tab)}>
							<ListItemIcon>
								<EditIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Rename Page</ListItemText>
						</MenuItem>
						<MenuItem
							onClick={() => {
								const t = contextMenu.tab
								setContextMenu(null)
								graphicsListStore.duplicateTab(t.id)
							}}
						>
							<ListItemIcon>
								<ControlPointDuplicateIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Duplicate Page</ListItemText>
						</MenuItem>
						{graphicsListStore.tabs.length > 1 && (
							<MenuItem
								onClick={() => {
									const t = contextMenu.tab
									setContextMenu(null)
									handleRequestDelete(t)
								}}
							>
								<ListItemIcon>
									<DeleteIcon fontSize="small" color="error" />
								</ListItemIcon>
								<ListItemText sx={{ color: 'error.main' }}>Delete Page</ListItemText>
							</MenuItem>
						)}
					</>
				)}
			</Menu>

			{/* Delete Tab Confirmation Dialog */}
			<Dialog open={Boolean(confirmDeleteTab)} onClose={() => setConfirmDeleteTab(null)} maxWidth="xs" fullWidth>
				<DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<WarningAmberIcon color="warning" />
					Delete Rundown Page?
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						<strong>"{confirmDeleteTab?.name}"</strong> contains{' '}
						<strong>{confirmDeleteTab ? countTabItems(confirmDeleteTab) : 0}</strong> graphic item(s).
						<br />
						<br />
						Are you sure you want to remove this page and all its contents? This action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={() => setConfirmDeleteTab(null)} color="inherit">
						Cancel
					</Button>
					<Button onClick={handleConfirmDelete} variant="contained" color="error" autoFocus>
						Delete Page
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
})
