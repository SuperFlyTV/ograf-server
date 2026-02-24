import * as React from 'react'
import { observer } from 'mobx-react'
import { serverDataStore } from '../stores/serverData.js'
import Box from '@mui/material/Box'
import { appSettingsStore } from '../stores/appSettings.js'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { action } from 'mobx'

export const RendererPicker: React.FC = observer(() => {
	const handleChange = action((event: SelectChangeEvent<string>) => {
		appSettingsStore.selectedRendererId = event.target.value
	})

	if (serverDataStore.renderersList.length === 0) {
		return (
			<Box sx={{ m: 1, p: 1 }}>
				<Typography>
					There are no Renderers available.
					<br />
					{serverDataStore.severIsOurs && `(Create a Renderer by opening a new Renderer window.)`}
				</Typography>
			</Box>
		)
	}

	return (
		<Box sx={{ m: 1, p: 1 }}>
			<FormControl fullWidth>
				<InputLabel id="pick-renderer">Renderer</InputLabel>
				<Select
					labelId="pick-renderer"
					id="pick-renderer-select"
					value={appSettingsStore.selectedRendererId}
					label="Renderer"
					onChange={handleChange}
					disabled={
						serverDataStore.renderersList.length === 1 &&
						appSettingsStore.selectedRendererId === serverDataStore.renderersList[0].id
					}
				>
					{serverDataStore.renderersList.map((renderer) => (
						<MenuItem key={renderer.id} value={renderer.id}>
							{renderer.name} (id: {renderer.id})
						</MenuItem>
					))}
				</Select>
			</FormControl>
		</Box>
	)
})
