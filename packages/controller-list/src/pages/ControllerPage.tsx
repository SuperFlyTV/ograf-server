import * as React from 'react'
import { observer } from 'mobx-react'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'

import { ListPanel } from '../components/ListPanel.js'
import { EditPanel } from '../components/EditPanel.js'
import Typography from '@mui/material/Typography'

import { GraphicsListAPI } from '../lib/graphicsListApi.js'

export const ControllerPage: React.FC = observer(() => {
	const rendererSelected = appSettingsStore.getSelectedRendererId()

	// Expose the API globally, or instantiate it once securely:
	React.useEffect(() => {
	   GraphicsListAPI.init()
	}, [])

	if (serverDataStore.renderersList.length === 0) {
		return (
			<Container sx={{ mt: 4 }}>
				<Typography>No renderers available on the server. Please check your connection or server configuration.</Typography>
			</Container>
		)
	}

	if (!rendererSelected) {
		return null // Wait for auto-select
	}

	return (
		<Container disableGutters maxWidth={false} sx={{ height: 'calc(100vh - 64px)', p: 2 }}>
			<Grid container spacing={2} sx={{ height: '100%' }}>
				<Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%' }}>
					<ListPanel />
				</Grid>
				<Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%' }}>
					<EditPanel />
				</Grid>
			</Grid>
		</Container>
	)
})
