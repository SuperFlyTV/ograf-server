import * as React from 'react'
import { observer } from 'mobx-react'
import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export const AppSettings: React.FC = observer(() => {
	return (
		<>
			<Box component="form" sx={{ '& > :not(style)': { my: 2, width: '100%' } }} noValidate autoComplete="off">
				<TextField
					id="asdf"
					label="Server URL"
					value={appSettingsStore.serverApiUrl}
					fullWidth
					onChange={(event) => {
						appSettingsStore.serverApiUrl = event.target.value
					}}
				/>
			</Box>
			<Typography>Status: {serverDataStore.connectedStatus}</Typography>
			<Typography>{serverDataStore.currentOperation}</Typography>
		</>
	)
})
