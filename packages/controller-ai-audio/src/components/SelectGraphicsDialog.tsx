import * as React from 'react'
import { observer } from 'mobx-react'
import { runInAction } from 'mobx'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Divider from '@mui/material/Divider'

import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeselectIcon from '@mui/icons-material/Deselect'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import Collapse from '@mui/material/Collapse'

import { appSettingsStore } from '../stores/appSettings.js'
import { serverDataStore, ScannedGraphicInfo } from '../stores/serverData.js'
import { realtimeService, estimateGraphicTokens, MAX_INSTRUCTION_TOKENS } from '../lib/realtimeService.js'
import { pickAppropriateThumbnail, getGraphicThumbnailUrl } from '../lib/thumbnailUtils.js'
import { GraphicPreviewPopper } from './GraphicPreviewPopper.js'
import { UploadGraphicDropzone } from './UploadGraphicDialog.js'

const SAFE_TOKEN_BUDGET = 14000

export const SelectGraphicsDialog: React.FC = observer(() => {
	const [searchQuery, setSearchQuery] = React.useState('')
	const [isRefreshing, setIsRefreshing] = React.useState(false)
	const [showUploadBox, setShowUploadBox] = React.useState(false)
	const [failedThumbs, setFailedThumbs] = React.useState<Record<string, boolean>>({})
	const [hoveredGraphic, setHoveredGraphic] = React.useState<{
		id: string
		anchorEl: HTMLElement
	} | null>(null)

	const open = realtimeService.isGraphicsModalOpen
	const modalError = realtimeService.graphicsModalError

	// Combine scannedGraphics with any graphics in serverDataStore so list is always populated
	const allGraphics: ScannedGraphicInfo[] = React.useMemo(() => {
		if (realtimeService.scannedGraphics.length > 0) {
			return realtimeService.scannedGraphics
		}
		return serverDataStore.graphicsList.map((g) => {
			const cached = serverDataStore.graphicsInfo.get(g.id)
			return {
				id: g.id,
				graphic: (cached?.graphic || {
					id: g.id,
					name: g.name,
					description: g.description,
				}) as any,
				metadata: cached?.metadata,
			}
		})
	}, [realtimeService.scannedGraphics, serverDataStore.graphicsList, serverDataStore.graphicsInfo.size])

	const graphicTokenMap = React.useMemo(() => {
		const map = new Map<string, number>()
		for (const g of allGraphics) {
			map.set(g.id, estimateGraphicTokens(g))
		}
		return map
	}, [allGraphics])

	const enabledGraphics = allGraphics.filter((g) => appSettingsStore.isGraphicEnabled(g.id))
	const estimatedTotalTokens = realtimeService.estimateCurrentInstructionsTokens(
		enabledGraphics,
		appSettingsStore.eagerness
	)
	const isOverLimit = estimatedTotalTokens > MAX_INSTRUCTION_TOKENS
	const tokenPercentage = Math.min(100, Math.round((estimatedTotalTokens / MAX_INSTRUCTION_TOKENS) * 100))

	const filteredGraphics = React.useMemo(() => {
		const q = searchQuery.trim().toLowerCase()
		if (!q) return allGraphics
		return allGraphics.filter((g) => {
			const manifest = g.graphic as any
			const name = String(manifest?.name || '').toLowerCase()
			const desc = String(manifest?.description || '').toLowerCase()
			const id = g.id.toLowerCase()
			return name.includes(q) || id.includes(q) || desc.includes(q)
		})
	}, [allGraphics, searchQuery])

	const handleRefreshList = async () => {
		setIsRefreshing(true)
		try {
			const graphics = await serverDataStore.scanAllGraphicsForLLM()
			runInAction(() => {
				realtimeService.scannedGraphics = graphics
			})
		} catch (e) {
			console.error('Failed to refresh graphics list:', e)
		} finally {
			setIsRefreshing(false)
		}
	}

	const handleSelectFiltered = () => {
		const filteredIds = new Set(filteredGraphics.map((g) => g.id))
		const nextDisabled = appSettingsStore.disabledGraphicIds.filter((id) => !filteredIds.has(id))
		appSettingsStore.setDisabledGraphicIds(nextDisabled)
	}

	const handleDeselectFiltered = () => {
		const filteredIds = filteredGraphics.map((g) => g.id)
		const nextDisabled = Array.from(new Set([...appSettingsStore.disabledGraphicIds, ...filteredIds]))
		appSettingsStore.setDisabledGraphicIds(nextDisabled)
	}

	const handleAutoFitBudget = () => {
		// Keep currently enabled graphics (or all graphics if none enabled) in order until SAFE_TOKEN_BUDGET is reached
		const baseOverhead = realtimeService.estimateCurrentInstructionsTokens([], appSettingsStore.eagerness)
		let runningTokens = baseOverhead
		const candidates = enabledGraphics.length > 0 ? enabledGraphics : allGraphics
		const keepIds = new Set<string>()

		for (const g of candidates) {
			const cost = graphicTokenMap.get(g.id) ?? estimateGraphicTokens(g)
			if (runningTokens + cost <= SAFE_TOKEN_BUDGET) {
				keepIds.add(g.id)
				runningTokens += cost
			}
		}

		const nextDisabled = allGraphics.filter((g) => !keepIds.has(g.id)).map((g) => g.id)
		appSettingsStore.setDisabledGraphicIds(nextDisabled)
	}

	const handleClose = () => {
		realtimeService.closeGraphicsModal()
		if (realtimeService.status === 'connected') {
			void realtimeService.updateEagernessLive()
		}
	}

	const handleApplyAndStart = () => {
		realtimeService.closeGraphicsModal()
		if (realtimeService.status === 'connected') {
			void realtimeService.updateEagernessLive()
		} else {
			realtimeService.requestStartSession()
		}
	}

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
			<DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
				<Typography variant="h6" fontWeight={700}>
					Select Graphics
				</Typography>
				<IconButton size="small" onClick={handleClose}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
				{modalError && (
					<Alert
						severity="error"
						onClose={() => {
							runInAction(() => {
								realtimeService.graphicsModalError = null
							})
						}}
					>
						<AlertTitle sx={{ fontWeight: 700 }}>Instruction Token Limit Exceeded</AlertTitle>
						<Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
							{modalError}
						</Typography>
						<Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
							Deselect unused graphics or click <strong>Auto-Fit</strong> to stay under{' '}
							{MAX_INSTRUCTION_TOKENS.toLocaleString()} tokens.
						</Typography>
					</Alert>
				)}

				{!modalError && isOverLimit && (
					<Alert severity="warning">
						Selected graphics (~{estimatedTotalTokens.toLocaleString()} tokens) exceed the{' '}
						{MAX_INSTRUCTION_TOKENS.toLocaleString()}-token limit.
					</Alert>
				)}

				{/* Token Budget Bar */}
				<Box
					sx={{
						p: 1.25,
						borderRadius: 1,
						bgcolor: 'action.hover',
						border: '1px solid',
						borderColor: isOverLimit ? 'error.main' : 'divider',
					}}
				>
					<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
						<Typography variant="body2" fontWeight={700}>
							Selected: {enabledGraphics.length} / {allGraphics.length}
						</Typography>
						<Typography
							variant="body2"
							fontWeight={700}
							color={isOverLimit ? 'error.main' : estimatedTotalTokens > 12500 ? 'warning.main' : 'success.main'}
						>
							~{estimatedTotalTokens.toLocaleString()} / {MAX_INSTRUCTION_TOKENS.toLocaleString()} tokens
						</Typography>
					</Stack>
					<LinearProgress
						variant="determinate"
						value={tokenPercentage}
						color={isOverLimit ? 'error' : estimatedTotalTokens > 12500 ? 'warning' : 'success'}
						sx={{ height: 8, borderRadius: 4 }}
					/>
				</Box>

				{/* Search and Bulk Controls */}
				<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
					<TextField
						size="small"
						placeholder="Filter graphics..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						sx={{ flexGrow: 1 }}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon fontSize="small" />
									</InputAdornment>
								),
								endAdornment: searchQuery ? (
									<InputAdornment position="end">
										<IconButton size="small" onClick={() => setSearchQuery('')}>
											<CloseIcon fontSize="small" />
										</IconButton>
									</InputAdornment>
								) : undefined,
							},
						}}
					/>

					<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
						{serverDataStore.severIsOurs && (
							<Button
								size="small"
								variant={showUploadBox ? 'contained' : 'outlined'}
								color="primary"
								startIcon={<CloudUploadIcon />}
								onClick={() => setShowUploadBox((v) => !v)}
							>
								Upload (.zip)
							</Button>
						)}
						<Button size="small" variant="outlined" startIcon={<SelectAllIcon />} onClick={handleSelectFiltered}>
							{searchQuery.trim() ? 'Select Filtered' : 'Select All'}
						</Button>
						<Button size="small" variant="outlined" startIcon={<DeselectIcon />} onClick={handleDeselectFiltered}>
							{searchQuery.trim() ? 'Deselect Filtered' : 'Deselect All'}
						</Button>
						<Button
							size="small"
							variant="outlined"
							color="secondary"
							startIcon={<AutoFixHighIcon />}
							onClick={handleAutoFitBudget}
						>
							Auto-Fit
						</Button>
						<IconButton
							size="small"
							title="Refresh"
							disabled={isRefreshing}
							onClick={() => void handleRefreshList()}
							sx={{ border: '1px solid', borderColor: 'divider' }}
						>
							<RefreshIcon fontSize="small" />
						</IconButton>
					</Stack>
				</Stack>

				{serverDataStore.severIsOurs && (
					<Collapse in={showUploadBox || allGraphics.length === 0}>
						<Box
							sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}
						>
							<UploadGraphicDropzone
								compact
								onUploaded={() => {
									void handleRefreshList()
								}}
							/>
						</Box>
					</Collapse>
				)}

				<Divider />

				{/* Graphics Checklist */}
				<Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
					{filteredGraphics.length === 0 ? (
						<Box sx={{ py: 4, textAlign: 'center' }}>
							<Typography variant="body2" color="text.secondary">
								{allGraphics.length === 0 ? 'No graphics found.' : 'No matching graphics.'}
							</Typography>
						</Box>
					) : (
						<Stack spacing={0.75}>
							{filteredGraphics.map((g) => {
								const manifest = g.graphic as any
								const name = manifest?.name || g.id
								const description = manifest?.description || ''
								const isEnabled = appSettingsStore.isGraphicEnabled(g.id)
								const tokenCost = graphicTokenMap.get(g.id) ?? 0
								const bestThumb = pickAppropriateThumbnail(manifest?.thumbnails, { width: 112, height: 68 })
								const thumbUrl = bestThumb
									? getGraphicThumbnailUrl(appSettingsStore.serverApiUrl, g.id, bestThumb.file)
									: ''
								const hasThumbError = failedThumbs[g.id]

								return (
									<Box
										key={g.id}
										onClick={() => appSettingsStore.setGraphicEnabled(g.id, !isEnabled)}
										onMouseEnter={(e) => setHoveredGraphic({ id: g.id, anchorEl: e.currentTarget })}
										onMouseLeave={() => setHoveredGraphic((prev) => (prev?.id === g.id ? null : prev))}
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1.25,
											p: 0.75,
											borderRadius: 1,
											border: '1px solid',
											borderColor: isEnabled ? 'primary.main' : 'divider',
											bgcolor: isEnabled ? 'action.selected' : 'background.paper',
											cursor: 'pointer',
											'&:hover': {
												bgcolor: 'action.hover',
											},
										}}
									>
										<Checkbox
											size="small"
											checked={isEnabled}
											onChange={(e) => {
												e.stopPropagation()
												appSettingsStore.setGraphicEnabled(g.id, e.target.checked)
											}}
											onClick={(e) => e.stopPropagation()}
										/>

										<Box
											sx={{
												width: 56,
												height: 34,
												borderRadius: 0.75,
												bgcolor: 'rgba(0,0,0,0.2)',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												overflow: 'hidden',
												flexShrink: 0,
											}}
										>
											{thumbUrl && !hasThumbError ? (
												<Box
													component="img"
													src={thumbUrl}
													alt={name}
													onError={() => setFailedThumbs((prev) => ({ ...prev, [g.id]: true }))}
													sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
												/>
											) : (
												<ImageOutlinedIcon fontSize="small" color="disabled" />
											)}
										</Box>

										<Box sx={{ flexGrow: 1, minWidth: 0 }}>
											<Stack direction="row" spacing={1} alignItems="center">
												<Typography variant="body2" fontWeight={700} noWrap>
													{name}
												</Typography>
												{name !== g.id && (
													<Typography variant="caption" color="text.secondary" noWrap>
														({g.id})
													</Typography>
												)}
											</Stack>
											{description && (
												<Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
													{description}
												</Typography>
											)}
										</Box>

										<Chip
											size="small"
											variant="outlined"
											color={tokenCost > 2000 ? 'warning' : 'default'}
											label={`~${tokenCost.toLocaleString()} tok`}
											sx={{ height: 22, fontSize: '0.7rem', flexShrink: 0 }}
										/>
									</Box>
								)
							})}
						</Stack>
					)}
				</Box>
			</DialogContent>

			<DialogActions sx={{ px: 2.5, py: 1.5 }}>
				<Button variant="outlined" onClick={handleClose}>
					Close
				</Button>
				<Button
					variant="contained"
					color="primary"
					disabled={enabledGraphics.length === 0}
					startIcon={<PlayArrowIcon />}
					onClick={handleApplyAndStart}
				>
					{realtimeService.status === 'connected' ? 'Apply' : 'Start Listening'}
				</Button>
			</DialogActions>

			<GraphicPreviewPopper
				open={open && Boolean(hoveredGraphic)}
				anchorEl={hoveredGraphic?.anchorEl ?? null}
				graphicId={hoveredGraphic?.id ?? ''}
				placement="right-start"
			/>
		</Dialog>
	)
})
