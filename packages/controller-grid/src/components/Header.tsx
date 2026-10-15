import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import { gridStore } from '../stores/gridStore.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { GridControllerAPI } from '../lib/gridControllerApi.js'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import EditIcon from '@mui/icons-material/Edit'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { GridTabs } from './GridTabs.js'

export const Header: React.FC<{ page: 'settings' | 'controller' }> = observer(({ page }) => {
	return page === 'settings' ? <HeaderSettings /> : <HeaderController />
})

export const HeaderSettings = observer(() => {
	return (
		<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
			Settings
		</Typography>
	)
})

export const HeaderController = observer(() => {
	const isEdit = gridStore.effectiveEditMode
	const toggleKey = appSettingsStore.editModeToggleKey || 'E'
	const holdKey = appSettingsStore.editModeHoldKey || 'Tab'

	return (
		<Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', minWidth: 0, overflow: 'hidden', gap: 1 }}>
			<Tooltip
				title={
					serverDataStore.isConnected
						? `Connected to ${serverDataStore.serverInfo?.name || 'OGraf Server'}`
						: `Server status: ${serverDataStore.connectedStatus}`
				}
			>
				<Chip
					size="small"
					label={serverDataStore.isConnected ? serverDataStore.serverInfo?.name || 'OGraf' : 'Offline'}
					color={serverDataStore.isConnected ? 'success' : 'default'}
					variant="filled"
					sx={{ fontWeight: 600, flexShrink: 0, maxWidth: 160 }}
				/>
			</Tooltip>

			<GridTabs />

			<Box sx={{ flexGrow: 1 }} />

			<Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
				<Tooltip
					title={`Switch between Live/Operate Mode and Edit/Design Mode (Press "${toggleKey.toUpperCase()}" to toggle, or hold "${holdKey}" to quick-edit)`}
				>
					<Button
						size="small"
						variant={isEdit ? 'contained' : 'outlined'}
						color={isEdit ? 'warning' : 'inherit'}
						startIcon={isEdit ? <EditIcon fontSize="small" /> : <TouchAppIcon fontSize="small" />}
						onClick={() => gridStore.toggleEditMode()}
						sx={{
							textTransform: 'none',
							fontWeight: 700,
							borderRadius: 1.5,
							px: 1.5,
						}}
					>
						{isEdit ? (gridStore.isTempEditMode ? 'Edit (Hold)' : 'Edit Mode') : 'Live Mode'}
					</Button>
				</Tooltip>

				<Tooltip title="Clear ALL graphics on all renderers">
					<Button
						size="small"
						variant="contained"
						color="error"
						startIcon={<DeleteSweepIcon fontSize="small" />}
						onClick={() => {
							void GridControllerAPI.clearAllRenderers()
						}}
						sx={{ textTransform: 'none', fontWeight: 700, display: { xs: 'none', sm: 'inline-flex' } }}
					>
						Clear All
					</Button>
				</Tooltip>
			</Stack>
		</Box>
	)
})
