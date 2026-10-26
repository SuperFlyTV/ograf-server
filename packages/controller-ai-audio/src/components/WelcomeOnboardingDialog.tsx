import * as React from 'react'
import { observer } from 'mobx-react'
import { runInAction } from 'mobx'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Link from '@mui/material/Link'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'

import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import { realtimeService } from '../lib/realtimeService.js'
import { UploadGraphicDropzone } from './UploadGraphicDialog.js'

const TOTAL_STEPS = 4

export const WelcomeOnboardingDialog: React.FC = observer(() => {
	const [open, setOpen] = React.useState(false)
	const [activeStep, setActiveStep] = React.useState(0)
	const [showApiKey, setShowApiKey] = React.useState(false)
	const hasCheckedInitRef = React.useRef(false)

	React.useEffect(() => {
		if (!appSettingsStore.isInitialized || hasCheckedInitRef.current) return
		hasCheckedInitRef.current = true
		if (!appSettingsStore.openAiApiKey.trim()) {
			setActiveStep(0)
			setOpen(true)
		}
	}, [appSettingsStore.isInitialized, appSettingsStore.openAiApiKey])

	const graphicsCount =
		realtimeService.scannedGraphics.length > 0
			? realtimeService.scannedGraphics.length
			: serverDataStore.graphicsList.length

	const handleClose = () => {
		setOpen(false)
	}

	const handleNext = () => {
		if (activeStep < TOTAL_STEPS - 1) {
			setActiveStep((s) => s + 1)
		} else {
			setOpen(false)
		}
	}

	const handleBack = () => {
		if (activeStep > 0) {
			setActiveStep((s) => s - 1)
		}
	}

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
				<Stack direction="row" spacing={1} alignItems="center">
					<AutoAwesomeIcon color="primary" />
					<Typography variant="h6" fontWeight={700}>
						AI Audio Controller
					</Typography>
				</Stack>
				<IconButton size="small" onClick={handleClose} aria-label="close welcome dialog">
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent dividers sx={{ pt: 2.5, pb: 3 }}>
				{activeStep === 0 && (
					<Stack spacing={2}>
						<Typography variant="subtitle1" fontWeight={700}>
							How it works
						</Typography>
						<Typography variant="body1" color="text.secondary">
							This tool listens to your <strong>system audio</strong> or <strong>microphone</strong> in real time and
							automatically displays suggestions for graphics based on what is being spoken.
						</Typography>
						<Typography variant="body2" color="text.secondary">
							As names, locations, topics, or cues are mentioned, the AI prepares ready-to-play OGraf-graphics.
						</Typography>
					</Stack>
				)}

				{activeStep === 1 && (
					<Stack spacing={2}>
						<Stack direction="row" justifyContent="space-between" alignItems="center">
							<Typography variant="subtitle1" fontWeight={700}>
								OGraf Graphics on the Server
							</Typography>
							<Chip
								size="small"
								color={graphicsCount > 0 ? 'success' : 'default'}
								variant="outlined"
								label={`${graphicsCount} graphic${graphicsCount === 1 ? '' : 's'} on server`}
							/>
						</Stack>
						<Typography variant="body2" color="text.secondary">
							The AI uses the OGraf graphics installed on the server and inspects their schemas to know which graphics
							and data fields can be suggested. You can upload OGraf graphic <code>.zip</code> packages below (or at any
							time from the <strong>Select Graphics</strong> dialog):
						</Typography>
						<UploadGraphicDropzone
							onUploaded={() => {
								void serverDataStore
									.scanAllGraphicsForLLM()
									.then((graphics) => {
										runInAction(() => {
											realtimeService.scannedGraphics = graphics
										})
									})
									.catch(() => {})
							}}
						/>
					</Stack>
				)}

				{activeStep === 2 && (
					<Stack spacing={2}>
						<Typography variant="subtitle1" fontWeight={700}>
							OpenAI API Key
						</Typography>
						<Typography variant="body2" color="text.secondary">
							This tool uses OpenAI for real-time audio processing. Please register an OpenAI account and paste your API
							key below.
						</Typography>
						<Typography variant="body2" color="text.secondary">
							API keys can be created and found at:{' '}
							<Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
								https://platform.openai.com/api-keys
							</Link>
						</Typography>
						<TextField
							label="OpenAI API Key"
							variant="outlined"
							fullWidth
							autoFocus
							type={showApiKey ? 'text' : 'password'}
							value={appSettingsStore.openAiApiKey}
							onChange={(e) => {
								appSettingsStore.openAiApiKey = e.target.value
							}}
							placeholder="sk-..."
							helperText="Stored locally in your browser"
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
					</Stack>
				)}

				{activeStep === 3 && (
					<Stack spacing={2}>
						<Typography variant="subtitle1" fontWeight={700}>
							You&apos;re all set!
						</Typography>
						<Typography variant="body2" color="text.secondary">
							You can adjust how the AI listens at any time from the top control bar:
						</Typography>
						<Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
							<Typography component="li" variant="body2" color="text.secondary">
								<strong>Audio Source:</strong> Choose between your <em>Microphone</em>, <em>System Audio</em>, or{' '}
								<em>System + Mic</em> (with individual mute controls and auto-mute).
							</Typography>
							<Typography component="li" variant="body2" color="text.secondary">
								<strong>Languages:</strong> Pick specific spoken languages or leave on <em>Auto (Any)</em>.
							</Typography>
							<Typography component="li" variant="body2" color="text.secondary">
								<strong>Eagerness:</strong> Use the slider (1–5) to control how conservatively or proactively the AI
								suggests graphics.
							</Typography>
							<Typography component="li" variant="body2" color="text.secondary">
								<strong>Graphics &amp; Instructions:</strong> Click <em>Graphics</em> to choose or upload graphics, and
								use the <em>Instructions</em> box to give custom guidance to the AI.
							</Typography>
						</Box>
					</Stack>
				)}
			</DialogContent>

			<DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between' }}>
				<Button
					color="inherit"
					disabled={activeStep === 0}
					startIcon={<ArrowBackIcon />}
					onClick={handleBack}
					sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
				>
					Back
				</Button>

				<Stack direction="row" spacing={1}>
					{activeStep < TOTAL_STEPS - 1 && (
						<Button color="inherit" onClick={handleClose}>
							Skip
						</Button>
					)}
					<Button
						variant="contained"
						color="primary"
						endIcon={activeStep === TOTAL_STEPS - 1 ? <CheckIcon /> : <ArrowForwardIcon />}
						onClick={handleNext}
					>
						{activeStep === TOTAL_STEPS - 1 ? 'Done' : 'Next'}
					</Button>
				</Stack>
			</DialogActions>
		</Dialog>
	)
})

export const SystemAudioInfoDialog: React.FC = observer(() => {
	const open = realtimeService.isSystemAudioInfoDialogOpen

	return (
		<Dialog open={open} onClose={() => realtimeService.closeSystemAudioInfoDialog()} maxWidth="xs" fullWidth>
			<DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<VolumeUpIcon color="primary" />
				<Typography variant="h6" fontWeight={700}>
					Share Screen With Audio
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={1.5}>
					<Alert severity="info" sx={{ fontWeight: 500 }}>
						In the next browser dialog, make sure to enable <strong>&ldquo;Also share system audio&rdquo;</strong>!
					</Alert>
					<Typography variant="body2" color="text.secondary">
						Browsers require opening the screen/tab sharing prompt to capture system audio.
					</Typography>
					<Typography variant="body2" color="text.secondary">
						<strong>Only the audio will be used</strong> — the shared screen/video itself is ignored and never sent.
					</Typography>
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 2.5, py: 1.5 }}>
				<Button color="inherit" onClick={() => realtimeService.closeSystemAudioInfoDialog()}>
					Cancel
				</Button>
				<Button
					variant="contained"
					color="primary"
					onClick={() => realtimeService.confirmSystemAudioInfoAndStart()}
					autoFocus
				>
					Continue
				</Button>
			</DialogActions>
		</Dialog>
	)
})

export const ElksCredentialsInfoDialog: React.FC = observer(() => {
	const open = realtimeService.isElksCredentialsDialogOpen
	const [showPassword, setShowPassword] = React.useState(false)

	const handleVerifyAndSave = async () => {
		if (appSettingsStore.elksApiUsername.trim() && appSettingsStore.elksApiPassword.trim()) {
			const ok = await realtimeService.refreshElksNumbers(true)
			if (ok) {
				realtimeService.closeElksCredentialsDialog()
			}
		} else {
			realtimeService.closeElksCredentialsDialog()
		}
	}

	return (
		<Dialog open={open} onClose={() => realtimeService.closeElksCredentialsDialog()} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
				<Stack direction="row" spacing={1} alignItems="center">
					<PhoneInTalkIcon color="primary" />
					<Typography variant="h6" fontWeight={700}>
						Phone-In Audio via 46elks.se
					</Typography>
				</Stack>
				<IconButton
					size="small"
					onClick={() => realtimeService.closeElksCredentialsDialog()}
					aria-label="close 46elks info dialog"
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2}>
					<Typography variant="body2" color="text.secondary">
						<strong>Phone-In</strong> uses{' '}
						<Link href="https://46elks.se" target="_blank" rel="noopener noreferrer">
							46elks.se
						</Link>{' '}
						to pull a live audio stream whenever someone calls your 46elks virtual phone number.
					</Typography>
					<Box component="ol" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
						<Typography component="li" variant="body2" color="text.secondary">
							Register or sign in to your account at{' '}
							<Link href="https://46elks.se" target="_blank" rel="noopener noreferrer">
								https://46elks.se
							</Link>{' '}
							and allocate a voice-enabled phone number.
						</Typography>
						<Typography component="li" variant="body2" color="text.secondary">
							Copy your <strong>API Username</strong> and <strong>API Password</strong> from your 46elks dashboard and
							paste them below (or in <strong>Settings</strong>).
						</Typography>
						<Typography component="li" variant="body2" color="text.secondary">
							When you start listening, incoming calls to your 46elks number are automatically routed and streamed into
							the AI Audio Controller.
						</Typography>
					</Box>

					{realtimeService.elksError && <Alert severity="error">{realtimeService.elksError}</Alert>}

					<TextField
						label="46elks API Username"
						variant="outlined"
						size="small"
						fullWidth
						autoFocus
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
						type={showPassword ? 'text' : 'password'}
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
											onClick={() => setShowPassword((v) => !v)}
											edge="end"
											aria-label="toggle 46elks password visibility"
										>
											{showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
										</IconButton>
									</InputAdornment>
								),
							},
						}}
					/>
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 2.5, py: 1.5 }}>
				<Button color="inherit" onClick={() => realtimeService.closeElksCredentialsDialog()}>
					Close
				</Button>
				<Button
					variant="contained"
					color="primary"
					disabled={realtimeService.isLoadingElksNumbers || !appSettingsStore.hasElksCredentials()}
					onClick={() => {
						void handleVerifyAndSave()
					}}
				>
					{realtimeService.isLoadingElksNumbers ? 'Verifying...' : 'Save & Verify'}
				</Button>
			</DialogActions>
		</Dialog>
	)
})
