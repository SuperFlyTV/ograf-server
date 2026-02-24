import * as React from 'react'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import { appSettingsStore } from '../stores/appSettings.js'

import { ListPanel } from '../components/ListPanel.js'
import { EditPanel } from '../components/EditPanel.js'
import Typography from '@mui/material/Typography'

import { GraphicsListAPI } from '../lib/graphicsListApi.js'

export const ControllerPage: React.FC = () => {
	const rendererSelected = appSettingsStore.getSelectedRendererId()

	// Expose the API globally, or instantiate it once securely:
	React.useEffect(() => {
	   GraphicsListAPI.init()
	}, [])

	if (!rendererSelected) {
		return (
			<Container sx={{ mt: 4 }}>
				<Typography>No renderer selected. Go to settings or ensure a renderer is available.</Typography>
			</Container>
		)
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
}
