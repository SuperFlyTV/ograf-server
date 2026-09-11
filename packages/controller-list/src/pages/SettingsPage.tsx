import * as React from 'react'
import { observer } from 'mobx-react'
import Container from '@mui/material/Container'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import { graphicsListStore } from '../stores/graphicsList.js'
import { dbStore } from '../stores/db.js'
import { UploadGraphicDialog } from '../components/UploadGraphicDialog.js'

export const SettingsPage = observer(function SettingsPage() {
	const [uploadOpen, setUploadOpen] = React.useState(false)
	const [clearStorageDialogOpen, setClearStorageDialogOpen] = React.useState(false)

	const handleClearAllData = async () => {
		try {
			window.localStorage.clear()
			window.sessionStorage.clear()
			await dbStore.clearAll()
			window.location.reload()
		} catch (e) {
			console.error('Failed to clear stored data', e)
			graphicsListStore.showError('Failed to clear stored data')
		} finally {
			setClearStorageDialogOpen(false)
		}
	}

	return (
		<Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
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
				<Box>
					<Chip
						label={serverDataStore.connectedStatus}
						color={serverDataStore.isConnected ? 'success' : 'error'}
						variant="outlined"
						size="small"
					/>
				</Box>

				{serverDataStore.severIsOurs && (
					<>
						<Divider />
						<Box>
							<Typography variant="subtitle1" fontWeight={600} gutterBottom>
								Upload Graphics
							</Typography>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
								Upload a new OGraf graphic package (.zip archive) directly to this server.
							</Typography>
							<Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => setUploadOpen(true)}>
								Upload Graphic (.zip)
							</Button>
						</Box>
					</>
				)}

				<Divider />

				<Box>
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
					<Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
						When enabled, the controller will automatically send a Load command before any Action (Play, Update, etc.)
						if the graphic isn't currently loaded.
					</Typography>
				</Box>

				<Divider />

				<FormControl component="fieldset">
					<FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
						Theme Appearance
					</FormLabel>
					<RadioGroup
						row
						name="theme-mode"
						value={appSettingsStore.themeMode}
						onChange={(e) => {
							appSettingsStore.themeMode = e.target.value as 'default' | 'light' | 'dark'
						}}
					>
						<FormControlLabel value="default" control={<Radio />} label="Default (follow browser)" />
						<FormControlLabel value="light" control={<Radio />} label="Light" />
						<FormControlLabel value="dark" control={<Radio />} label="Dark" />
					</RadioGroup>
					<Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
						Choose whether the interface should follow your operating system/browser theme or remain fixed in light or
						dark mode.
					</Typography>
				</FormControl>

				<Divider />

				<Box>
					<Typography variant="subtitle1" fontWeight={600} gutterBottom color="error.main">
						Stored Data
					</Typography>
					<Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
						Clear all stored rundown items, pages/tabs, selection states, and cached local storage data.
					</Typography>
					<Button
						variant="outlined"
						color="error"
						startIcon={<DeleteSweepIcon />}
						onClick={() => setClearStorageDialogOpen(true)}
					>
						Clear All
					</Button>
				</Box>
			</Stack>

			<UploadGraphicDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />

			{/* Clear All Data Confirmation Dialog */}
			<Dialog open={clearStorageDialogOpen} onClose={() => setClearStorageDialogOpen(false)} maxWidth="xs" fullWidth>
				<DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<WarningAmberIcon color="warning" />
					Clear All Stored Data?
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Are you sure you want to clear ALL stored data? This will reset all rundown pages, items, selection states,
						and local preferences.
					</DialogContentText>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={() => setClearStorageDialogOpen(false)} color="inherit">
						Cancel
					</Button>
					<Button
						onClick={() => {
							void handleClearAllData()
						}}
						variant="contained"
						color="error"
						autoFocus
					>
						Clear All
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	)
})
