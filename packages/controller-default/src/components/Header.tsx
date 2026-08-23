import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import Typography from '@mui/material/Typography'

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
		<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
			{serverDataStore.isConnected
				? `Connected to: ${serverDataStore.serverInfo?.name}`
				: serverDataStore.connectedStatus}
		</Typography>
	)
})
