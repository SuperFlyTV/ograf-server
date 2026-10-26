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
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'

import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RefreshIcon from '@mui/icons-material/Refresh'

import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import { aiAudioStore } from '../stores/aiAudioStore.js'
import { dbStore } from '../stores/db.js'
import { realtimeService, isAnyPhoneInSelected } from '../lib/realtimeService.js'

export const SettingsPage = observer(function SettingsPage() {
	const [clearStorageDialogOpen, setClearStorageDialogOpen] = React.useState(false)
	const [showApiKey, setShowApiKey] = React.useState(false)
	const [showElksPassword, setShowElksPassword] = React.useState(false)

	const showElksSettings = isAnyPhoneInSelected() || appSettingsStore.hasAnyElksInput()

	React.useEffect(() => {
		void realtimeService.fetchAvailableOpenAiModels()
		if (appSettingsStore.elksApiUsername.trim() && appSettingsStore.elksApiPassword.trim()) {
			void realtimeService.refreshElksNumbers(false)
		}
	}, [])

	const modelOptions = React.useMemo(() => {
		const list = [...realtimeService.availableOpenAiModels]
		if (appSettingsStore.openAiModel && !list.includes(appSettingsStore.openAiModel)) {
			list.unshift(appSettingsStore.openAiModel)
		}
		return list
	}, [realtimeService.availableOpenAiModels, appSettingsStore.openAiModel])

	const elksNumberOptions = React.useMemo(() => {
		const nums = [...realtimeService.elksVoiceNumbers]
		const current = appSettingsStore.elksSelectedPhoneNumber.trim()
		if (current && !nums.some((n) => n.number === current)) {
			nums.unshift({
				id: current,
				number: current,
				name: '',
				country: '',
				voice_start: '',
			})
		}
		return nums
	}, [realtimeService.elksVoiceNumbers, appSettingsStore.elksSelectedPhoneNumber])

	const handleClearAllData = async () => {
		try {
			window.localStorage.clear()
			window.sessionStorage.clear()
			await dbStore.clearAll()
			window.location.reload()
		} catch (e) {
			console.error('Failed to clear stored data', e)
			aiAudioStore.showError('Failed to clear stored data')
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
				<Box>
					<Typography variant="subtitle1" fontWeight={600} gutterBottom>
						OpenAI Realtime
					</Typography>
					<Stack spacing={2} sx={{ mt: 1 }}>
						<TextField
							label="OpenAI API Key"
							variant="outlined"
							fullWidth
							type={showApiKey ? 'text' : 'password'}
							value={appSettingsStore.openAiApiKey}
							onChange={(e) => {
								appSettingsStore.openAiApiKey = e.target.value
							}}
							placeholder="sk-..."
							helperText="Stored locally in browser"
							slotProps={{
								input: {
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												size="small"
												onClick={() => setShowApiKey((v) => !v)}
												edge="end"
												aria-label="toggle API key visibility"
											>
												{showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
											</IconButton>
										</InputAdornment>
									),
								},
							}}
						/>

						<Stack direction="row" spacing={1} alignItems="center">
							<FormControl fullWidth size="small">
								<InputLabel id="realtime-model-select-label">Realtime Model</InputLabel>
								<Select
									labelId="realtime-model-select-label"
									label="Realtime Model"
									value={appSettingsStore.openAiModel}
									onChange={(e) => {
										appSettingsStore.openAiModel = e.target.value
									}}
								>
									{modelOptions.map((modelId) => (
										<MenuItem key={modelId} value={modelId}>
											{modelId}
										</MenuItem>
									))}
								</Select>
							</FormControl>
							<Tooltip title="Refresh available Realtime models from OpenAI">
								<span>
									<IconButton
										size="small"
										disabled={realtimeService.isLoadingOpenAiModels || !appSettingsStore.openAiApiKey.trim()}
										onClick={() => void realtimeService.fetchAvailableOpenAiModels()}
										sx={{ border: '1px solid', borderColor: 'divider' }}
									>
										<RefreshIcon fontSize="small" />
									</IconButton>
								</span>
							</Tooltip>
						</Stack>

						<Stack
							direction={{ xs: 'column', sm: 'row' }}
							spacing={2}
							alignItems={{ xs: 'flex-start', sm: 'center' }}
							justifyContent="space-between"
							sx={{ pt: 0.5 }}
						>
							<FormControlLabel
								control={
									<Switch
										checked={appSettingsStore.autoStopOnSilence}
										onChange={(e) => {
											appSettingsStore.autoStopOnSilence = e.target.checked
										}}
										color="primary"
									/>
								}
								label={
									<Box>
										<Typography variant="body2" fontWeight={500}>
											Auto-stop listening when no audio is recognized
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Stops listening automatically to save OpenAI Realtime tokens
										</Typography>
									</Box>
								}
							/>

							<TextField
								label="Time without words (min)"
								type="number"
								size="small"
								disabled={!appSettingsStore.autoStopOnSilence}
								value={appSettingsStore.autoStopSilenceMinutes}
								onChange={(e) => {
									const val = Number(e.target.value)
									if (Number.isFinite(val) && val >= 1) {
										appSettingsStore.autoStopSilenceMinutes = Math.round(val)
									}
								}}
								slotProps={{
									htmlInput: {
										min: 1,
										max: 240,
										step: 1,
									},
								}}
								sx={{ width: { xs: '100%', sm: 190 }, flexShrink: 0 }}
							/>
						</Stack>
					</Stack>
				</Box>

				{showElksSettings && (
					<>
						<Divider />

						<Box>
							<Typography variant="subtitle1" fontWeight={600} gutterBottom>
								46elks Phone-In
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
								Pulls live phone call audio when someone calls your{' '}
								<Link href="https://46elks.se" target="_blank" rel="noopener noreferrer">
									46elks.se
								</Link>{' '}
								number.
							</Typography>
							<Stack spacing={2}>
								{realtimeService.elksError && <Alert severity="error">{realtimeService.elksError}</Alert>}

								<TextField
									label="46elks API Username"
									variant="outlined"
									size="small"
									fullWidth
									value={appSettingsStore.elksApiUsername}
									onChange={(e) => {
										appSettingsStore.elksApiUsername = e.target.value
									}}
									placeholder="u..."
								/>

								<TextField
									label="46elks API Password"
									variant="outlined"
									size="small"
									fullWidth
									type={showElksPassword ? 'text' : 'password'}
									value={appSettingsStore.elksApiPassword}
									onChange={(e) => {
										appSettingsStore.elksApiPassword = e.target.value
									}}
									slotProps={{
										input: {
											endAdornment: (
												<InputAdornment position="end">
													<IconButton
														size="small"
														onClick={() => setShowElksPassword((v) => !v)}
														edge="end"
														aria-label="toggle 46elks password visibility"
													>
														{showElksPassword ? (
															<VisibilityOffIcon fontSize="small" />
														) : (
															<VisibilityIcon fontSize="small" />
														)}
													</IconButton>
												</InputAdornment>
											),
										},
									}}
								/>

								<Stack direction="row" spacing={1} alignItems="center">
									{elksNumberOptions.length > 0 ? (
										<FormControl fullWidth size="small">
											<InputLabel id="elks-phone-select-label">Phone Number</InputLabel>
											<Select
												labelId="elks-phone-select-label"
												label="Call-In Phone Number"
												value={appSettingsStore.elksSelectedPhoneNumber}
												onChange={(e) => {
													appSettingsStore.elksSelectedPhoneNumber = e.target.value
													void realtimeService.refreshElksNumbers(true)
												}}
											>
												{elksNumberOptions.map((n) => (
													<MenuItem key={n.id || n.number} value={n.number}>
														{n.name ? `${n.number} (${n.name})` : n.number}
													</MenuItem>
												))}
											</Select>
										</FormControl>
									) : (
										<TextField
											label="Phone Number (optional)"
											variant="outlined"
											size="small"
											fullWidth
											value={appSettingsStore.elksSelectedPhoneNumber}
											onChange={(e) => {
												appSettingsStore.elksSelectedPhoneNumber = e.target.value
											}}
											placeholder="+46..."
										/>
									)}
									<Tooltip title="Verify 46elks credentials and fetch numbers">
										<span>
											<IconButton
												size="small"
												disabled={
													realtimeService.isLoadingElksNumbers ||
													!appSettingsStore.elksApiUsername.trim() ||
													!appSettingsStore.elksApiPassword.trim()
												}
												onClick={() => void realtimeService.refreshElksNumbers(true)}
												sx={{ border: '1px solid', borderColor: 'divider' }}
											>
												<RefreshIcon fontSize="small" />
											</IconButton>
										</span>
									</Tooltip>
								</Stack>
							</Stack>
						</Box>
					</>
				)}

				<Divider />

				<Box>
					<Typography variant="subtitle1" fontWeight={600} gutterBottom>
						OGraf Server
					</Typography>
					<TextField
						label="Server API URL"
						variant="outlined"
						fullWidth
						sx={{ mt: 1 }}
						value={appSettingsStore.serverApiUrl}
						onChange={(e) => {
							appSettingsStore.serverApiUrl = e.target.value
						}}
						placeholder="http://localhost:8080/api/ograf/v1/"
					/>
					<Box sx={{ mt: 1 }}>
						<Chip
							label={serverDataStore.connectedStatus}
							color={serverDataStore.isConnected ? 'success' : 'error'}
							variant="outlined"
							size="small"
						/>
					</Box>
				</Box>

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
						label="Auto-load graphics before playing"
					/>
				</Box>

				<Divider />

				<FormControl component="fieldset">
					<FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
						Theme
					</FormLabel>
					<RadioGroup
						row
						name="theme-mode"
						value={appSettingsStore.themeMode}
						onChange={(e) => {
							appSettingsStore.themeMode = e.target.value as 'default' | 'light' | 'dark'
						}}
					>
						<FormControlLabel value="default" control={<Radio />} label="System" />
						<FormControlLabel value="light" control={<Radio />} label="Light" />
						<FormControlLabel value="dark" control={<Radio />} label="Dark" />
					</RadioGroup>
				</FormControl>

				<Divider />

				<Box>
					<Typography variant="subtitle1" fontWeight={600} gutterBottom color="error.main">
						Stored Data
					</Typography>
					<Button
						variant="outlined"
						color="error"
						startIcon={<DeleteSweepIcon />}
						onClick={() => setClearStorageDialogOpen(true)}
					>
						Clear All Data
					</Button>
				</Box>
			</Stack>

			<Dialog open={clearStorageDialogOpen} onClose={() => setClearStorageDialogOpen(false)} maxWidth="xs" fullWidth>
				<DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<WarningAmberIcon color="warning" />
					Clear Stored Data?
				</DialogTitle>
				<DialogContent>
					<DialogContentText>Reset all bookmarks, API keys, and local settings?</DialogContentText>
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
