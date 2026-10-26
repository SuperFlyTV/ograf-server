import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import PhoneIcon from '@mui/icons-material/Phone'
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import ReplayIcon from '@mui/icons-material/Replay'
import ChecklistIcon from '@mui/icons-material/Checklist'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import SaveIcon from '@mui/icons-material/Save'
import HearingIcon from '@mui/icons-material/Hearing'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

import { appSettingsStore, AVAILABLE_LANGUAGES, EagernessLevel, EAGERNESS_LABELS } from '../stores/appSettings.js'
import { serverDataStore } from '../stores/serverData.js'
import {
	realtimeService,
	NONE_AUDIO_SOURCE_ID,
	SYSTEM_AUDIO_SOURCE_ID,
	PHONE_IN_SOURCE_ID,
	isPhoneInSource,
	isAnyPhoneInSelected,
	isDualAudioSource,
} from '../lib/realtimeService.js'
import { AiControllerAPI } from '../lib/aiControllerApi.js'

const AUTO_LANG_VALUE = '__auto__'
const HOLD_THRESHOLD_MS = 250

function isMicrophoneSourceId(sourceId: string): boolean {
	return sourceId !== NONE_AUDIO_SOURCE_ID && sourceId !== SYSTEM_AUDIO_SOURCE_ID && sourceId !== PHONE_IN_SOURCE_ID
}

function getSourceMeta(sourceId: string, compact: boolean) {
	const iconProps = compact ? { sx: { fontSize: 13 } } : { fontSize: 'small' as const }
	if (sourceId === PHONE_IN_SOURCE_ID) {
		return {
			shortLabel: 'Phone',
			title: 'Phone-In Audio',
			unmutedIcon: <PhoneIcon {...iconProps} />,
			mutedIcon: <PhoneDisabledIcon {...iconProps} />,
		}
	}
	if (sourceId === SYSTEM_AUDIO_SOURCE_ID) {
		return {
			shortLabel: 'Sys',
			title: 'System Audio',
			unmutedIcon: <VolumeUpIcon {...iconProps} />,
			mutedIcon: <VolumeOffIcon {...iconProps} />,
		}
	}
	return {
		shortLabel: 'Mic',
		title: 'Microphone Audio',
		unmutedIcon: <MicIcon {...iconProps} />,
		mutedIcon: <MicOffIcon {...iconProps} />,
	}
}

const EAGERNESS_MARKS = [
	{ value: 1, label: '1' },
	{ value: 2, label: '2' },
	{ value: 3, label: '3' },
	{ value: 4, label: '4' },
	{ value: 5, label: '5' },
]

interface MuteChannelButtonProps {
	label?: string
	title: string
	isMuted: boolean
	isAutoMuted?: boolean
	onSetMuted: (muted: boolean) => void
	unmutedIcon: React.ReactNode
	mutedIcon: React.ReactNode
	compact?: boolean
}

const MuteChannelButton: React.FC<MuteChannelButtonProps> = ({
	label,
	title,
	isMuted,
	isAutoMuted,
	onSetMuted,
	unmutedIcon,
	mutedIcon,
	compact,
}) => {
	const pressStateRef = React.useRef<{ startTime: number; initialMuted: boolean } | null>(null)
	const [isHolding, setIsHolding] = React.useState(false)

	const handlePressStart = () => {
		const initialMuted = isMuted
		pressStateRef.current = { startTime: Date.now(), initialMuted }
		setIsHolding(true)
		onSetMuted(!initialMuted)
	}

	const handlePressEnd = React.useCallback(() => {
		const info = pressStateRef.current
		if (!info) return
		pressStateRef.current = null
		setIsHolding(false)
		const duration = Date.now() - info.startTime
		if (duration >= HOLD_THRESHOLD_MS) {
			onSetMuted(info.initialMuted)
		}
	}, [onSetMuted])

	React.useEffect(() => {
		if (!isHolding) return
		const onGlobalRelease = () => {
			handlePressEnd()
		}
		window.addEventListener('mouseup', onGlobalRelease)
		window.addEventListener('touchend', onGlobalRelease)
		window.addEventListener('blur', onGlobalRelease)
		return () => {
			window.removeEventListener('mouseup', onGlobalRelease)
			window.removeEventListener('touchend', onGlobalRelease)
			window.removeEventListener('blur', onGlobalRelease)
		}
	}, [isHolding, handlePressEnd])

	const effectivelyMuted = isMuted || Boolean(isAutoMuted)
	const statusText = isMuted ? 'Muted' : isAutoMuted ? 'Auto-muted by Source 2' : 'Active'

	return (
		<Tooltip title={`${title} (${statusText} — click to toggle, or hold)`}>
			<Button
				size="small"
				variant={effectivelyMuted ? 'contained' : 'outlined'}
				color={effectivelyMuted ? 'warning' : 'inherit'}
				onMouseDown={(e) => {
					if (e.button !== 0) return
					e.preventDefault()
					handlePressStart()
				}}
				onMouseUp={() => handlePressEnd()}
				onTouchStart={(e) => {
					e.preventDefault()
					handlePressStart()
				}}
				onTouchEnd={() => handlePressEnd()}
				onKeyDown={(e) => {
					if (e.key === ' ' || e.key === 'Enter') {
						e.preventDefault()
						onSetMuted(!isMuted)
					}
				}}
				sx={{
					minWidth: compact ? 52 : 34,
					height: compact ? 20 : 30,
					px: compact ? 0.6 : 0.9,
					py: 0,
					fontSize: compact ? '0.65rem' : '0.72rem',
					fontWeight: 700,
					textTransform: 'none',
					userSelect: 'none',
					gap: 0.4,
					borderColor: 'divider',
					lineHeight: 1,
				}}
			>
				{effectivelyMuted ? mutedIcon : unmutedIcon}
				{label && <span>{label}</span>}
			</Button>
		</Tooltip>
	)
}

export const AudioControlBar: React.FC<{ onOpenSettings: () => void }> = observer(({ onOpenSettings }) => {
	const isConnected = realtimeService.status === 'connected'
	const isBusy = realtimeService.status === 'connecting' || realtimeService.status === 'scanning'
	const isCapturingTranscript = realtimeService.isCapturingTranscript

	const [draftInstructions, setDraftInstructions] = React.useState(appSettingsStore.customInstructions)
	const [isEditingInstructions, setIsEditingInstructions] = React.useState(false)
	const prevSavedInstructionsRef = React.useRef(appSettingsStore.customInstructions)
	const listenBaseTextRef = React.useRef('')

	React.useEffect(() => {
		if (appSettingsStore.customInstructions !== prevSavedInstructionsRef.current) {
			prevSavedInstructionsRef.current = appSettingsStore.customInstructions
			setDraftInstructions(appSettingsStore.customInstructions)
		}
	}, [appSettingsStore.customInstructions])

	const isInstructionsDirty = draftInstructions !== appSettingsStore.customInstructions

	const handleSaveInstructions = () => {
		prevSavedInstructionsRef.current = draftInstructions
		void realtimeService.saveAndApplyCustomInstructions(draftInstructions)
		setIsEditingInstructions(false)
	}

	const handleStartCaptureTranscript = () => {
		listenBaseTextRef.current = draftInstructions
		setIsEditingInstructions(true)
		realtimeService.startCapturingTranscript((capturedText) => {
			const base = listenBaseTextRef.current
			const separator = base && !base.endsWith(' ') && !base.endsWith('\n') ? ' ' : ''
			setDraftInstructions(capturedText ? `${base}${separator}${capturedText}` : base)
		})
	}

	const handleStopCaptureTranscript = React.useCallback(() => {
		if (realtimeService.isCapturingTranscript) {
			realtimeService.stopCapturingTranscript()
		}
	}, [])

	React.useEffect(() => {
		if (!isCapturingTranscript) return
		const onGlobalRelease = () => {
			handleStopCaptureTranscript()
		}
		window.addEventListener('mouseup', onGlobalRelease)
		window.addEventListener('touchend', onGlobalRelease)
		window.addEventListener('blur', onGlobalRelease)
		return () => {
			window.removeEventListener('mouseup', onGlobalRelease)
			window.removeEventListener('touchend', onGlobalRelease)
			window.removeEventListener('blur', onGlobalRelease)
		}
	}, [isCapturingTranscript, handleStopCaptureTranscript])

	const totalGraphicsCount =
		realtimeService.scannedGraphics.length > 0
			? realtimeService.scannedGraphics.length
			: serverDataStore.graphicsList.length
	const enabledGraphicsCount =
		realtimeService.scannedGraphics.length > 0
			? realtimeService.scannedGraphics.filter((g) => appSettingsStore.isGraphicEnabled(g.id)).length
			: serverDataStore.graphicsList.filter((g) => appSettingsStore.isGraphicEnabled(g.id)).length

	const handleToggleListen = () => {
		if (!appSettingsStore.openAiApiKey.trim()) {
			onOpenSettings()
			return
		}
		if (isConnected || isBusy) {
			realtimeService.stopSession()
		} else {
			realtimeService.requestStartSession()
		}
	}

	const handleReload = () => {
		if (!appSettingsStore.openAiApiKey.trim()) {
			onOpenSettings()
			return
		}
		void realtimeService.reloadSession()
	}

	const source1Id = appSettingsStore.selectedMicDeviceId
	const source2Id = appSettingsStore.selectedSecondaryMicDeviceId
	const dual = isDualAudioSource()
	const src1Meta = getSourceMeta(source1Id, dual)
	const src2Meta = getSourceMeta(source2Id, true)
	const sameShortLabel = dual && src1Meta.shortLabel === src2Meta.shortLabel
	const src1ButtonLabel = sameShortLabel ? `${src1Meta.shortLabel} 1` : src1Meta.shortLabel
	const src2ButtonLabel = sameShortLabel ? `${src2Meta.shortLabel} 2` : src2Meta.shortLabel

	return (
		<Paper
			variant="outlined"
			sx={{
				p: 1.25,
				mb: 1,
				borderRadius: 1.5,
				bgcolor: 'background.paper',
			}}
		>
			<Stack
				direction={{ xs: 'column', md: 'row' }}
				spacing={2}
				alignItems={{ xs: 'stretch', md: 'center' }}
				justifyContent="space-between"
			>
				{/* Left: Mic & Session Controls */}
				<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
					<Button
						variant="contained"
						color={isConnected ? 'error' : 'primary'}
						size="small"
						disabled={isBusy}
						startIcon={isConnected ? <StopCircleIcon /> : <MicIcon />}
						onClick={handleToggleListen}
						sx={{ fontWeight: 700, minWidth: 140 }}
					>
						{isBusy
							? realtimeService.status === 'scanning'
								? 'Scanning...'
								: 'Connecting...'
							: isConnected
								? 'Stop Listening'
								: 'Start Listening'}
					</Button>

					<Tooltip title="Re-scan graphics and restart session">
						<span>
							<Button
								variant="outlined"
								size="small"
								disabled={isBusy}
								startIcon={<ReplayIcon />}
								onClick={handleReload}
								sx={{ fontWeight: 600 }}
							>
								Reload
							</Button>
						</span>
					</Tooltip>

					<Tooltip title="Select active graphics">
						<Button
							variant="outlined"
							size="small"
							startIcon={<ChecklistIcon />}
							onClick={() => realtimeService.openGraphicsModal()}
							sx={{ fontWeight: 600 }}
						>
							Graphics ({enabledGraphicsCount}/{totalGraphicsCount})
						</Button>
					</Tooltip>

					{/* Audio Input Source 1 Selector */}
					<FormControl size="small" sx={{ minWidth: 160, maxWidth: 215 }}>
						<InputLabel id="audio-source-1-select-label" shrink>
							Audio Source 1
						</InputLabel>
						<Select
							labelId="audio-source-1-select-label"
							label="Audio Source 1"
							displayEmpty
							value={appSettingsStore.selectedMicDeviceId}
							onChange={(e) => {
								const nextSource = e.target.value
								appSettingsStore.selectedMicDeviceId = nextSource
								if (isPhoneInSource(nextSource) && !appSettingsStore.hasElksCredentials()) {
									realtimeService.openElksCredentialsDialog()
									return
								}
								if (isConnected) {
									void realtimeService.reloadSession()
								}
							}}
						>
							<MenuItem value="">
								<em>Default Mic</em>
							</MenuItem>
							<MenuItem value={SYSTEM_AUDIO_SOURCE_ID}>System Audio</MenuItem>
							<MenuItem value={PHONE_IN_SOURCE_ID}>Phone-in</MenuItem>
							{realtimeService.availableMicDevices.map((dev, idx) => (
								<MenuItem key={dev.deviceId || idx} value={dev.deviceId}>
									{dev.label || `Mic ${idx + 1}`}
								</MenuItem>
							))}
						</Select>
					</FormControl>

					{/* Audio Input Source 2 Selector */}
					<FormControl size="small" sx={{ minWidth: 160, maxWidth: 215 }}>
						<InputLabel id="audio-source-2-select-label" shrink>
							Audio Source 2
						</InputLabel>
						<Select
							labelId="audio-source-2-select-label"
							label="Audio Source 2"
							displayEmpty
							value={appSettingsStore.selectedSecondaryMicDeviceId}
							onChange={(e) => {
								const prevSource = appSettingsStore.selectedSecondaryMicDeviceId
								const nextSource = e.target.value
								if (isPhoneInSource(nextSource) && !appSettingsStore.hasElksCredentials()) {
									appSettingsStore.selectedSecondaryMicDeviceId = nextSource
									realtimeService.openElksCredentialsDialog()
									return
								}
								if (isConnected && isMicrophoneSourceId(prevSource) && isMicrophoneSourceId(nextSource)) {
									void realtimeService.switchSecondaryMicLive(nextSource)
								} else {
									appSettingsStore.selectedSecondaryMicDeviceId = nextSource
									if (isConnected) {
										void realtimeService.reloadSession()
									}
								}
							}}
						>
							<MenuItem value={NONE_AUDIO_SOURCE_ID}>
								<em>None</em>
							</MenuItem>
							<MenuItem value="">
								<em>Default Mic</em>
							</MenuItem>
							<MenuItem value={SYSTEM_AUDIO_SOURCE_ID}>System Audio</MenuItem>
							<MenuItem value={PHONE_IN_SOURCE_ID}>Phone-in</MenuItem>
							{realtimeService.availableMicDevices.map((dev, idx) => (
								<MenuItem key={dev.deviceId || idx} value={dev.deviceId}>
									{dev.label || `Mic ${idx + 1}`}
								</MenuItem>
							))}
						</Select>
					</FormControl>

					{/* Phone-in call status chip */}
					{isAnyPhoneInSelected() && (
						<Chip
							size="small"
							icon={<PhoneIcon sx={{ fontSize: 14 }} />}
							color={
								realtimeService.elksCallStatus === 'in_call'
									? 'success'
									: realtimeService.elksCallStatus === 'waiting'
										? 'info'
										: realtimeService.elksCallStatus === 'error'
											? 'error'
											: 'default'
							}
							variant={realtimeService.elksCallStatus === 'in_call' ? 'filled' : 'outlined'}
							onClick={() => {
								if (!appSettingsStore.hasElksCredentials()) {
									realtimeService.openElksCredentialsDialog()
								}
							}}
							label={
								realtimeService.elksCallStatus === 'in_call'
									? `On Call${realtimeService.elksActiveCaller ? `: ${realtimeService.elksActiveCaller}` : ''}`
									: realtimeService.elksCallStatus === 'waiting'
										? `Call ${appSettingsStore.elksSelectedPhoneNumber || 'ready'}`
										: realtimeService.elksCallStatus === 'registering'
											? 'Connecting 46elks...'
											: appSettingsStore.elksSelectedPhoneNumber || '46elks Phone-In'
							}
							sx={{ fontWeight: 600, fontSize: '0.7rem' }}
						/>
					)}

					{/* Spoken Languages Multi-Select */}
					<FormControl size="small" sx={{ minWidth: 155, maxWidth: 220 }}>
						<InputLabel id="lang-select-label" shrink>
							Languages
						</InputLabel>
						<Select
							labelId="lang-select-label"
							label="Languages"
							multiple
							displayEmpty
							value={appSettingsStore.selectedLanguages}
							onChange={(e) => {
								const raw = e.target.value
								const values = typeof raw === 'string' ? raw.split(',') : raw
								if (values.includes(AUTO_LANG_VALUE)) {
									appSettingsStore.setSelectedLanguages([])
								} else {
									appSettingsStore.setSelectedLanguages(values)
								}
							}}
							renderValue={(selected) => {
								if (!selected || selected.length === 0) {
									return <em>Auto (Any)</em>
								}
								if (selected.length <= 2) {
									return selected
										.map((code) => AVAILABLE_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase())
										.join(', ')
								}
								return `${selected
									.slice(0, 2)
									.map((c) => c.toUpperCase())
									.join(', ')} +${selected.length - 2}`
							}}
							MenuProps={{
								PaperProps: {
									sx: { maxHeight: 360 },
								},
							}}
						>
							<MenuItem value={AUTO_LANG_VALUE} dense>
								<Checkbox
									size="small"
									checked={appSettingsStore.selectedLanguages.length === 0}
									sx={{ p: 0.5, mr: 1 }}
								/>
								<ListItemText primary={<em>Auto (Any language)</em>} slotProps={{ primary: { variant: 'body2' } }} />
							</MenuItem>
							<Divider />
							{AVAILABLE_LANGUAGES.map((lang) => {
								const checked = appSettingsStore.selectedLanguages.includes(lang.code)
								return (
									<MenuItem key={lang.code} value={lang.code} dense>
										<Checkbox size="small" checked={checked} sx={{ p: 0.5, mr: 1 }} />
										<ListItemText
											primary={lang.nativeName !== lang.name ? `${lang.name} (${lang.nativeName})` : lang.name}
											secondary={lang.code.toUpperCase()}
											slotProps={{
												primary: { variant: 'body2' },
												secondary: { variant: 'caption', sx: { fontSize: '0.65rem' } },
											}}
										/>
									</MenuItem>
								)
							})}
						</Select>
					</FormControl>

					{/* Mute Controls & Audio Level Meter(s) */}
					{dual ? (
						<Stack direction="row" spacing={0.8} alignItems="center">
							<Stack spacing={0.4} sx={{ minWidth: 125 }}>
								<Stack direction="row" spacing={0.6} alignItems="center">
									<MuteChannelButton
										compact
										label={src1ButtonLabel}
										title={`Audio Source 1 (${src1Meta.title})`}
										isMuted={realtimeService.isSystemMuted}
										isAutoMuted={realtimeService.isSystemAutoMuted}
										onSetMuted={(m) => realtimeService.setSystemMuted(m)}
										unmutedIcon={src1Meta.unmutedIcon}
										mutedIcon={src1Meta.mutedIcon}
									/>
									<Tooltip title={`${src1ButtonLabel} level: ${realtimeService.systemAudioLevel}%`}>
										<LinearProgress
											variant="determinate"
											value={
												isConnected && !realtimeService.isSystemMuted && !realtimeService.isSystemAutoMuted
													? realtimeService.systemAudioLevel
													: 0
											}
											color="success"
											sx={{
												flexGrow: 1,
												width: 64,
												height: 6,
												borderRadius: 3,
												'& .MuiLinearProgress-bar': {
													transition: 'transform 35ms linear',
												},
											}}
										/>
									</Tooltip>
								</Stack>

								<Stack direction="row" spacing={0.6} alignItems="center">
									<MuteChannelButton
										compact
										label={src2ButtonLabel}
										title={`Audio Source 2 (${src2Meta.title})`}
										isMuted={realtimeService.isMicMuted}
										onSetMuted={(m) => realtimeService.setMicMuted(m)}
										unmutedIcon={src2Meta.unmutedIcon}
										mutedIcon={src2Meta.mutedIcon}
									/>
									<Tooltip title={`${src2ButtonLabel} level: ${realtimeService.micAudioLevel}%`}>
										<LinearProgress
											variant="determinate"
											value={isConnected && !realtimeService.isMicMuted ? realtimeService.micAudioLevel : 0}
											color="success"
											sx={{
												flexGrow: 1,
												width: 64,
												height: 6,
												borderRadius: 3,
												'& .MuiLinearProgress-bar': {
													transition: 'transform 35ms linear',
												},
											}}
										/>
									</Tooltip>
								</Stack>
							</Stack>

							<Tooltip
								title={`Automatically mute Audio Source 1 (${src1Meta.title}) when Audio Source 2 (${src2Meta.title}) audio is detected`}
							>
								<Button
									size="small"
									variant={appSettingsStore.autoMuteSystemOnMic ? 'contained' : 'outlined'}
									color={
										appSettingsStore.autoMuteSystemOnMic
											? realtimeService.isSystemAutoMuted
												? 'warning'
												: 'primary'
											: 'inherit'
									}
									onClick={() => {
										appSettingsStore.autoMuteSystemOnMic = !appSettingsStore.autoMuteSystemOnMic
									}}
									sx={{
										height: 28,
										px: 0.9,
										py: 0,
										fontSize: '0.68rem',
										fontWeight: 700,
										textTransform: 'none',
										borderColor: 'divider',
										whiteSpace: 'nowrap',
									}}
								>
									Auto-mute {src1ButtonLabel}
								</Button>
							</Tooltip>
						</Stack>
					) : (
						<Stack direction="row" spacing={0.75} alignItems="center">
							<MuteChannelButton
								label={src1Meta.shortLabel}
								title={`Audio Source 1 (${src1Meta.title})`}
								isMuted={realtimeService.isSystemMuted}
								onSetMuted={(m) => realtimeService.setSystemMuted(m)}
								unmutedIcon={src1Meta.unmutedIcon}
								mutedIcon={src1Meta.mutedIcon}
							/>
							<Tooltip title={`${src1Meta.shortLabel} level: ${realtimeService.systemAudioLevel}%`}>
								<LinearProgress
									variant="determinate"
									value={isConnected && !realtimeService.isSystemMuted ? realtimeService.systemAudioLevel : 0}
									color="success"
									sx={{
										width: 64,
										height: 8,
										borderRadius: 4,
										'& .MuiLinearProgress-bar': {
											transition: 'transform 35ms linear',
										},
									}}
								/>
							</Tooltip>
						</Stack>
					)}
				</Stack>

				<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

				{/* Center: Auto Mode Toggle & Eagerness Slider */}
				<Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
					<Tooltip
						title={
							appSettingsStore.autoMode
								? 'Auto Mode ON: AI can both suggest graphics and automatically play, update, stop, and trigger custom actions alongside you (click to switch to Suggest Only)'
								: 'Auto Mode OFF (Suggest Only): AI only suggests graphics; click to enable Auto Mode where AI also puts graphics on/off air automatically'
						}
					>
						<Button
							size="small"
							variant={appSettingsStore.autoMode ? 'contained' : 'outlined'}
							color={appSettingsStore.autoMode ? 'secondary' : 'inherit'}
							startIcon={<AutoAwesomeIcon fontSize="small" />}
							onClick={() => {
								appSettingsStore.autoMode = !appSettingsStore.autoMode
							}}
							sx={{
								fontWeight: 700,
								textTransform: 'none',
								minWidth: 118,
								borderColor: appSettingsStore.autoMode ? undefined : 'divider',
								boxShadow: appSettingsStore.autoMode ? '0 0 10px rgba(156, 39, 176, 0.45)' : undefined,
							}}
						>
							{appSettingsStore.autoMode ? 'Auto Mode: ON' : 'Auto Mode: OFF'}
						</Button>
					</Tooltip>

					<Box sx={{ minWidth: 195, maxWidth: 260, px: 1 }}>
						<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: -0.5 }}>
							<Typography variant="caption" fontWeight={700} color="text.secondary">
								Eagerness
							</Typography>
							<Typography variant="caption" fontWeight={700} color="primary.main">
								{EAGERNESS_LABELS[appSettingsStore.eagerness]}
							</Typography>
						</Stack>
						<Slider
							size="small"
							value={appSettingsStore.eagerness}
							min={1}
							max={5}
							step={1}
							marks={EAGERNESS_MARKS}
							valueLabelDisplay="auto"
							valueLabelFormat={(v) => EAGERNESS_LABELS[v as EagernessLevel] || `${v}`}
							onChange={(_e, val) => {
								if (typeof val === 'number' && val >= 1 && val <= 5) {
									appSettingsStore.eagerness = val as EagernessLevel
								}
							}}
						/>
					</Box>
				</Stack>

				<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

				{/* Right: Renderer Selector & Global Clear */}
				<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
					{serverDataStore.renderersList.length > 0 && (
						<FormControl size="small" sx={{ minWidth: 150, maxWidth: 210 }}>
							<InputLabel id="renderer-select-label">Renderer</InputLabel>
							<Select
								labelId="renderer-select-label"
								label="Renderer"
								value={
									serverDataStore.renderersList.some((r) => r.id === appSettingsStore.selectedRendererId)
										? appSettingsStore.selectedRendererId
										: serverDataStore.renderersList[0]?.id || ''
								}
								onChange={(e) => {
									appSettingsStore.selectedRendererId = e.target.value
								}}
							>
								{serverDataStore.renderersList.map((r) => (
									<MenuItem key={r.id} value={r.id}>
										{r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}

					<Tooltip title="Clear all graphics on renderers">
						<Button
							size="small"
							variant="outlined"
							color="error"
							startIcon={<DeleteSweepIcon />}
							onClick={() => {
								void AiControllerAPI.clearAllRenderers()
							}}
						>
							Clear All
						</Button>
					</Tooltip>
				</Stack>
			</Stack>

			{/* Custom LLM Instructions Bar */}
			<Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
				<TextField
					size="small"
					fullWidth
					multiline
					minRows={1}
					maxRows={4}
					label="Instructions"
					placeholder="Add custom instructions for the LLM..."
					value={draftInstructions}
					onFocus={() => setIsEditingInstructions(true)}
					onBlur={() => {
						if (!isInstructionsDirty && !isCapturingTranscript) {
							setIsEditingInstructions(false)
						}
					}}
					onChange={(e) => setDraftInstructions(e.target.value)}
					onKeyDown={(e) => {
						if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
							e.preventDefault()
							handleSaveInstructions()
						}
					}}
				/>

				{(isEditingInstructions || isInstructionsDirty) && (
					<Tooltip title="Save instructions and apply to LLM (Ctrl+Enter)">
						<Button
							size="small"
							variant="contained"
							color="primary"
							startIcon={<SaveIcon />}
							onMouseDown={(e) => e.preventDefault()}
							onClick={handleSaveInstructions}
							sx={{ height: 40, px: 1.75, fontWeight: 700, flexShrink: 0, textTransform: 'none' }}
						>
							Save
						</Button>
					</Tooltip>
				)}

				<Tooltip title="Hold to append live transcript to instructions (release to stop)">
					<Button
						size="small"
						variant={isCapturingTranscript ? 'contained' : 'outlined'}
						color={isCapturingTranscript ? 'error' : 'secondary'}
						startIcon={<HearingIcon />}
						onMouseDown={(e) => {
							e.preventDefault()
							if (e.button === 0) {
								handleStartCaptureTranscript()
							}
						}}
						onMouseUp={() => handleStopCaptureTranscript()}
						onTouchStart={(e) => {
							e.preventDefault()
							handleStartCaptureTranscript()
						}}
						onTouchEnd={() => handleStopCaptureTranscript()}
						sx={{
							height: 40,
							px: 1.75,
							fontWeight: 700,
							flexShrink: 0,
							textTransform: 'none',
							userSelect: 'none',
						}}
					>
						{isCapturingTranscript ? 'Listening...' : 'Listen'}
					</Button>
				</Tooltip>
			</Stack>

			{/* Live Transcript & Tool Status Strip */}
			{(realtimeService.liveTranscript || realtimeService.lastToolActivity || realtimeService.errorMessage) && (
				<Box
					sx={{
						mt: 1,
						pt: 0.75,
						borderTop: '1px solid',
						borderColor: 'divider',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 2,
						flexWrap: 'wrap',
					}}
				>
					<Typography
						variant="caption"
						color="text.secondary"
						noWrap
						sx={{ flexGrow: 1, fontStyle: realtimeService.liveTranscript ? 'normal' : 'italic' }}
					>
						{realtimeService.errorMessage ? (
							<Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>
								{realtimeService.errorMessage}
							</Box>
						) : realtimeService.liveTranscript ? (
							<>
								<strong>Heard:</strong> &ldquo;{realtimeService.liveTranscript}&rdquo;
							</>
						) : (
							'Waiting for speech...'
						)}
					</Typography>

					{realtimeService.lastToolActivity && (
						<Typography variant="caption" color="primary.main" fontWeight={600} sx={{ flexShrink: 0 }}>
							{realtimeService.lastToolActivity}
						</Typography>
					)}
				</Box>
			)}
		</Paper>
	)
})
