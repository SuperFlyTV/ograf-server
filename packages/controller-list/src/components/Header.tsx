import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import { appSettingsStore } from '../stores/appSettings.js'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'

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
	const renderers = serverDataStore.renderersList

	return (
		<Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
			<Typography variant="h6" component="div" sx={{ flexGrow: 1, mr: 2 }}>
				{serverDataStore.isConnected
					? `Connected to: ${serverDataStore.serverInfo?.name}`
					: serverDataStore.connectedStatus}
			</Typography>
			{renderers.length > 1 && (
				<Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 0.5 }}>
					<Tabs
						value={appSettingsStore.selectedRendererId || false}
						onChange={(_, newValue) => appSettingsStore.selectedRendererId = newValue}
						textColor="primary"
						indicatorColor="primary"
						sx={{ minHeight: '36px' }}
					>
						{renderers.map((r: any, index: number) => (
							<Tab
								key={`${r.id}-${index}`}
								label={r.name || r.id}
								value={r.id}
								sx={{ minHeight: '36px', py: 0 }}
							/>
						))}
					</Tabs>
				</Box>
			)}
		</Box>
	)
})
