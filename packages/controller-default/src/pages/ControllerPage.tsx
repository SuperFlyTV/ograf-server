import * as React from 'react'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import { UploadGraphic } from '../components/UploadGraphic.js'
import { RendererPicker } from '../components/RendererPicker.js'
import { RendererController } from '../components/RendererController.js'
import { CommandsLog } from '../components/CommandsLog.js'

export const ControllerPage: React.FC = () => {
	return (
		<Container>
			<Container>
				<Grid container spacing={2}>
					<Grid size={{ xs: 12, md: 7 }}>
						<UploadGraphic />

						<RendererPicker />

						<RendererController />
					</Grid>
					<Grid size={{ xs: 12, md: 5 }}>
						<CommandsLog />
					</Grid>
				</Grid>
			</Container>
		</Container>
	)
}
