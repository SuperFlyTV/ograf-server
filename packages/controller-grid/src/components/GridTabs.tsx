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

import { gridStore, GridTab } from '../stores/gridStore.js'

function countTabWidgets(tab: GridTab): number {
	if (gridStore.activeTabId === tab.id) {
		return gridStore.widgets.length
	}
	return (tab.widgets || []).length
}

export const GridTabs: React.FC = observer(() => {
	const [editingTabId, setEditingTabId] = React.useState<string | null>(null)
	const [editNameValue, setEditNameValue] = React.useState('')
	const [confirmDeleteTab, setConfirmDeleteTab] = React.useState<GridTab | null>(null)
	const [contextMenu, setContextMenu] = React.useState<{
		mouseX: number
		mouseY: number
		tab: GridTab
	} | null>(null)

	const handleStartRename = (tab: GridTab) => {
		setEditingTabId(tab.id)
		setEditNameValue(tab.name)
		setContextMenu(null)
	}

	const handleSaveRename = () => {
		if (editingTabId && editNameValue.trim()) {
			gridStore.renameTab(editingTabId, editNameValue.trim())
		}
		setEditingTabId(null)
	}

	const handleRequestDelete = (tab: GridTab) => {
		const count = countTabWidgets(tab)
		if (count > 0) {
			setConfirmDeleteTab(tab)
		} else {
			gridStore.removeTab(tab.id)
		}
	}

	const handleConfirmDelete = () => {
		if (confirmDeleteTab) {
			gridStore.removeTab(confirmDeleteTab.id)
			setConfirmDeleteTab(null)
		}
	}

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, mr: 1, maxWidth: '100%' }}>
			<Tabs
				value={gridStore.activeTabId}
				onChange={(_e, val) => {
					if (editingTabId) return
					gridStore.setActiveTab(val)
				}}
				variant="scrollable"
				scrollButtons={gridStore.tabs.length > 4 ? 'auto' : false}
				allowScrollButtonsMobile={gridStore.tabs.length > 4}
				sx={{
					minHeight: 44,
					flexGrow: 0,
					flexShrink: 1,
					maxWidth: 'calc(100% - 48px)',
					'& .MuiTabScrollButton-root': {
						...(gridStore.tabs.length <= 4 && {
							display: 'none !important',
							width: 0,
							minWidth: 0,
							p: 0,
							m: 0,
						}),
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
				{gridStore.tabs.map((tab) => {
					const isEditing = editingTabId === tab.id
					const isSelected = gridStore.activeTabId === tab.id
					const widgetCount = countTabWidgets(tab)

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
											{widgetCount > 0 && (
												<Chip
													label={widgetCount}
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

									{gridStore.tabs.length > 1 && !isEditing && (
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

			<Tooltip title="Add new control surface page">
				<IconButton
					color="inherit"
					size="small"
					onClick={() => gridStore.addTab()}
					sx={{
						ml: 0.5,
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
							<ListItemText>Rename Surface</ListItemText>
						</MenuItem>
						<MenuItem
							onClick={() => {
								const t = contextMenu.tab
								setContextMenu(null)
								gridStore.duplicateTab(t.id)
							}}
						>
							<ListItemIcon>
								<ControlPointDuplicateIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Duplicate Surface</ListItemText>
						</MenuItem>
						{gridStore.tabs.length > 1 && (
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
								<ListItemText sx={{ color: 'error.main' }}>Delete Surface</ListItemText>
							</MenuItem>
						)}
					</>
				)}
			</Menu>

			<Dialog open={Boolean(confirmDeleteTab)} onClose={() => setConfirmDeleteTab(null)} maxWidth="xs" fullWidth>
				<DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<WarningAmberIcon color="warning" />
					Delete Control Surface?
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						<strong>"{confirmDeleteTab?.name}"</strong> contains{' '}
						<strong>{confirmDeleteTab ? countTabWidgets(confirmDeleteTab) : 0}</strong> widget(s).
						<br />
						<br />
						Are you sure you want to remove this surface and all its widgets?
					</DialogContentText>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={() => setConfirmDeleteTab(null)} color="inherit">
						Cancel
					</Button>
					<Button onClick={handleConfirmDelete} variant="contained" color="error" autoFocus>
						Delete Surface
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	)
})
