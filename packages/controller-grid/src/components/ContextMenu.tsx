import * as React from 'react'
import { observer } from 'mobx-react'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipToFrontIcon from '@mui/icons-material/FlipToFront'
import FlipToBackIcon from '@mui/icons-material/FlipToBack'
import AddIcon from '@mui/icons-material/Add'
import SmartButtonIcon from '@mui/icons-material/SmartButton'
import DynamicFormIcon from '@mui/icons-material/DynamicForm'
import CropFreeIcon from '@mui/icons-material/CropFree'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import LayersIcon from '@mui/icons-material/Layers'

import { gridStore } from '../stores/gridStore.js'
import { serverDataStore } from '../stores/serverData.js'

export interface GridContextMenuState {
	mouseX: number
	mouseY: number
	gridCell: { x: number; y: number }
	targetType: 'widget' | 'background'
	widgetId?: string
}

export interface ContextMenuProps {
	state: GridContextMenuState | null
	onClose: () => void
	onAddGraphicAtCell: (cell: { x: number; y: number }) => void
	onUploadGraphic: () => void
	onFitToContent: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = observer(
	({ state, onClose, onAddGraphicAtCell, onUploadGraphic, onFitToContent }) => {
		if (!state) return null

		const hasSelection = gridStore.selectedWidgetIds.length > 0
		const hasClipboard = Boolean(gridStore.clipboard && gridStore.clipboard.length > 0)
		const cell = state.gridCell

		return (
			<Menu
				open={Boolean(state)}
				onClose={onClose}
				anchorReference="anchorPosition"
				anchorPosition={{ top: state.mouseY, left: state.mouseX }}
				slotProps={{
					paper: {
						sx: { minWidth: 250 },
					},
				}}
			>
				{state.targetType === 'widget' && hasSelection && (
					<>
						<MenuItem
							onClick={() => {
								gridStore.copySelection()
								onClose()
							}}
						>
							<ListItemIcon>
								<ContentCopyIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Copy</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+C
							</Typography>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.cutSelection()
								onClose()
							}}
						>
							<ListItemIcon>
								<ContentCutIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Cut</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+X
							</Typography>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.duplicateSelection({ cloneInstances: false })
								onClose()
							}}
						>
							<ListItemIcon>
								<ControlPointDuplicateIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Duplicate (Same Group)</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+D
							</Typography>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.duplicateSelection({ cloneInstances: true })
								onClose()
							}}
						>
							<ListItemIcon>
								<LayersIcon fontSize="small" color="primary" />
							</ListItemIcon>
							<ListItemText>Duplicate as New Graphic Group</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+Shift+D
							</Typography>
						</MenuItem>

						<Divider />

						<MenuItem
							onClick={() => {
								gridStore.bringToFront()
								onClose()
							}}
						>
							<ListItemIcon>
								<FlipToFrontIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Bring to Front</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.sendToBack()
								onClose()
							}}
						>
							<ListItemIcon>
								<FlipToBackIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Send to Back</ListItemText>
						</MenuItem>

						<Divider />

						<MenuItem
							onClick={() => {
								gridStore.removeSelectedWidgets()
								onClose()
							}}
						>
							<ListItemIcon>
								<DeleteIcon fontSize="small" color="error" />
							</ListItemIcon>
							<ListItemText sx={{ color: 'error.main' }}>Delete ({gridStore.selectedWidgetIds.length})</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Del
							</Typography>
						</MenuItem>
					</>
				)}

				{state.targetType === 'background' && (
					<>
						<MenuItem
							onClick={() => {
								onAddGraphicAtCell(cell)
								onClose()
							}}
						>
							<ListItemIcon>
								<AddIcon fontSize="small" color="primary" />
							</ListItemIcon>
							<ListItemText primaryTypographyProps={{ fontWeight: 600 }}>Add Graphic Kit Here...</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.addWidget({
									type: 'action-button',
									actionType: 'quickPlay',
									x: cell.x,
									y: cell.y,
								})
								onClose()
							}}
						>
							<ListItemIcon>
								<SmartButtonIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Add Action Button Here</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.addWidget({
									type: 'data-form',
									x: cell.x,
									y: cell.y,
								})
								onClose()
							}}
						>
							<ListItemIcon>
								<DynamicFormIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Add Data Form Here</ListItemText>
						</MenuItem>

						<MenuItem
							onClick={() => {
								gridStore.addWidget({
									type: 'section-frame',
									x: cell.x,
									y: cell.y,
								})
								onClose()
							}}
						>
							<ListItemIcon>
								<CropFreeIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Add Section Frame Here</ListItemText>
						</MenuItem>

						<Divider />

						<MenuItem
							disabled={!hasClipboard}
							onClick={() => {
								gridStore.paste({ cloneInstances: false, targetCell: cell })
								onClose()
							}}
						>
							<ListItemIcon>
								<ContentPasteIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Paste Here (Same Group)</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+V
							</Typography>
						</MenuItem>

						<MenuItem
							disabled={!hasClipboard}
							onClick={() => {
								gridStore.paste({ cloneInstances: true, targetCell: cell })
								onClose()
							}}
						>
							<ListItemIcon>
								<LayersIcon fontSize="small" color="primary" />
							</ListItemIcon>
							<ListItemText>Paste as New Graphic Group</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+Shift+V
							</Typography>
						</MenuItem>

						<Divider />

						<MenuItem
							onClick={() => {
								gridStore.selectAllWidgets()
								onClose()
							}}
						>
							<ListItemIcon>
								<SelectAllIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Select All Widgets</ListItemText>
							<Typography variant="caption" color="text.secondary">
								Ctrl+A
							</Typography>
						</MenuItem>

						<MenuItem
							onClick={() => {
								onFitToContent()
								onClose()
							}}
						>
							<ListItemIcon>
								<FitScreenIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText>Fit View to Content</ListItemText>
						</MenuItem>

						{serverDataStore.severIsOurs && (
							<>
								<Divider />
								<MenuItem
									onClick={() => {
										onUploadGraphic()
										onClose()
									}}
								>
									<ListItemIcon>
										<CloudUploadIcon fontSize="small" />
									</ListItemIcon>
									<ListItemText>Upload Graphic (.zip)...</ListItemText>
								</MenuItem>
							</>
						)}
					</>
				)}
			</Menu>
		)
	}
)
