import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { RundownTabs } from './RundownTabs.js'

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
	return (
		<Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
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
					sx={{ mr: 2, fontWeight: 600, flexShrink: 0, maxWidth: 180 }}
				/>
			</Tooltip>

			<RundownTabs />
		</Box>
	)
})
