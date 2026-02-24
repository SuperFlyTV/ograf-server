import * as React from 'react'
import { observer } from 'mobx-react'
import Container from '@mui/material/Container'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'

import { appSettingsStore } from '../stores/appSettings.js'

export const SettingsPage = observer(function SettingsPage() {
	return (
		<Container maxWidth="sm" sx={{ mt: 4 }}>
			<Typography variant="h4" gutterBottom>
				Settings
			</Typography>
			<Stack spacing={3}>
				<TextField
					label="Server API URL"
					variant="outlined"
					fullWidth
					value={appSettingsStore.serverApiUrl}
					onChange={(e) => {
						appSettingsStore.serverApiUrl = e.target.value
					}}
					helperText="The URL to the OGraf Server API (e.g. http://localhost:8080/ograf/v1/)"
				/>

                <FormControlLabel
                    control={
                        <Switch
                            checked={appSettingsStore.autoLoad}
                            onChange={(e) => {
                                appSettingsStore.autoLoad = e.target.checked
                            }}
                            name="autoLoad"
                            color="primary"
                        />
                    }
                    label="Auto-load graphics"
                />
                <Typography variant="body2" color="textSecondary">
                    When enabled, the controller will automatically send a Load command before any Action (Play, Update, etc.) if the graphic isn't currently loaded.
                </Typography>
			</Stack>
		</Container>
	)
})
