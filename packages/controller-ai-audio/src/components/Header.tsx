import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import { realtimeService } from '../lib/realtimeService.js'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

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
	const aiStatusColor =
		realtimeService.status === 'connected'
			? 'success'
			: realtimeService.status === 'connecting' || realtimeService.status === 'scanning'
				? 'warning'
				: realtimeService.status === 'error'
					? 'error'
					: 'default'

	const aiStatusLabel =
		realtimeService.status === 'connected'
			? realtimeService.isMuted
				? 'Muted'
				: 'Listening'
			: realtimeService.status === 'scanning'
				? 'Scanning...'
				: realtimeService.status === 'connecting'
					? 'Connecting...'
					: realtimeService.status === 'error'
						? 'Error'
						: 'Idle'

	return (
		<Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', minWidth: 0, overflow: 'hidden', gap: 1.5 }}>
			<Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
				<AutoAwesomeIcon fontSize="small" />
				<Typography variant="subtitle1" fontWeight={700} noWrap>
					OGraf AI Audio
				</Typography>
			</Stack>

			<Tooltip
				title={
					serverDataStore.isConnected
						? `Connected to ${serverDataStore.serverInfo?.name || 'OGraf Server'} (${serverDataStore.graphicsList.length} graphics)`
						: `Server status: ${serverDataStore.connectedStatus}`
				}
			>
				<Chip
					size="small"
					label={serverDataStore.isConnected ? serverDataStore.serverInfo?.name || 'OGraf' : 'Server Offline'}
					color={serverDataStore.isConnected ? 'success' : 'default'}
					variant="filled"
					sx={{ fontWeight: 600, flexShrink: 0, maxWidth: 180 }}
				/>
			</Tooltip>

			<Chip
				size="small"
				label={aiStatusLabel}
				color={aiStatusColor}
				variant="filled"
				sx={{ fontWeight: 600, flexShrink: 0 }}
			/>
		</Box>
	)
})
