import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import { appSettingsStore } from '../stores/appSettings.js'
import { gridStore } from '../stores/gridStore.js'
import { GridControllerAPI } from '../lib/gridControllerApi.js'
import { GridCanvas } from '../components/GridCanvas.js'
import { EditSidebar } from '../components/EditSidebar.js'
import { AddGraphicDialog } from '../components/AddGraphicDialog.js'
import { UploadGraphicDialog } from '../components/UploadGraphicDialog.js'

export const ControllerPage: React.FC = observer(() => {
	const rendererSelected = appSettingsStore.getSelectedRendererId()
	const [addDialogOpen, setAddDialogOpen] = React.useState(false)
	const [addDialogTargetCell, setAddDialogTargetCell] = React.useState<{ x: number; y: number } | undefined>(undefined)
	const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)

	React.useEffect(() => {
		GridControllerAPI.init()
	}, [])

	if (!rendererSelected) {
		return null
	}

	const isEditMode = gridStore.effectiveEditMode

	return (
		<Box
			sx={{
				height: 'calc(100vh - 48px)',
				width: '100%',
				display: 'flex',
				flexDirection: 'row',
				overflow: 'hidden',
			}}
		>
			<GridCanvas
				onOpenAddGraphicDialog={(cell) => {
					setAddDialogTargetCell(cell)
					setAddDialogOpen(true)
				}}
				onOpenUploadDialog={() => setUploadDialogOpen(true)}
			/>

			{isEditMode && (
				<EditSidebar
					onOpenAddGraphicDialog={() => {
						setAddDialogTargetCell(undefined)
						setAddDialogOpen(true)
					}}
				/>
			)}

			<AddGraphicDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} targetCell={addDialogTargetCell} />

			<UploadGraphicDialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} />
		</Box>
	)
})
