import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Popover from '@mui/material/Popover'
import LinearProgress from '@mui/material/LinearProgress'

import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import SyncIcon from '@mui/icons-material/Sync'
import EditNoteIcon from '@mui/icons-material/EditNote'
import TuneIcon from '@mui/icons-material/Tune'
import BoltIcon from '@mui/icons-material/Bolt'
import LayersClearIcon from '@mui/icons-material/LayersClear'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

import { ActionCardItem, aiAudioStore, FADE_DURATION_MS, SLOT_HEIGHT_PX } from '../stores/aiAudioStore.js'
import { serverDataStore } from '../stores/serverData.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { AiControllerAPI } from '../lib/aiControllerApi.js'
import { pickAppropriateThumbnail, getGraphicThumbnailUrl } from '../lib/thumbnailUtils.js'
import { DataPreview } from './DataPreview.js'
import { GraphicPreviewPopper } from './GraphicPreviewPopper.js'
import { OGrafForm } from './OGrafForm.js'
import { clone } from '../lib/lib.js'

function formatDurationShort(seconds: number): string {
	if (seconds < 60) return `${seconds}s`
	const mins = Math.floor(seconds / 60)
	const secs = seconds % 60
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getAiPressedButtonSx(isAiPressed: boolean) {
	if (!isAiPressed) return {}
	return {
		transform: 'scale(1.07)',
		zIndex: 2,
		outline: '2px solid',
		outlineColor: 'info.main',
		boxShadow: '0 0 0 3px rgba(41, 182, 246, 0.38), 0 0 14px rgba(41, 182, 246, 0.75)',
		transition: 'transform 0.14s ease-out, box-shadow 0.14s ease-out',
	}
}

export interface ActionCardProps {
	item: ActionCardItem
	mode: 'suggestion' | 'bookmark'
}

export const ActionCard: React.FC<ActionCardProps> = observer(({ item, mode }) => {
	const [cardEl, setCardEl] = React.useState<HTMLDivElement | null>(null)
	const [dataFormAnchor, setDataFormAnchor] = React.useState<HTMLElement | null>(null)
	const [customFormAnchor, setCustomFormAnchor] = React.useState<{
		el: HTMLElement
		actionId: string
	} | null>(null)
	const [isFormExpanded, setIsFormExpanded] = React.useState(false)

	const graphicInfo = serverDataStore.graphicsInfo.get(item.graphicId)
	const manifest = graphicInfo?.graphic as any
	const graphicName = manifest?.name || item.graphicId
	const graphicSchema = manifest?.schema

	const manifestCustomActions: Array<{
		id: string
		name?: string
		description?: string
		schema?: unknown
	}> = manifest?.customActions || manifest?.actions || []

	const isOnAir = aiAudioStore.isItemOnAir(item)
	const onAirSeconds = aiAudioStore.getItemOnAirSeconds(item)
	const aiPressedActionId = item.aiPressedAction?.actionId || null
	const isProtectedFromRemoval = aiAudioStore.isItemProtectedFromRemoval(item)
	const isSelected = aiAudioStore.selectedItemId === item.id

	const isNewlyAdded = (item.highlightRemainingMs ?? 0) > 0
	const isPaused = mode === 'suggestion' && (item.isHovered || item.isPopoverOpen || isProtectedFromRemoval)

	// Calculate visual opacity during fade-out
	let cardOpacity = 1
	if (mode === 'suggestion' && item.status === 'fading' && !isPaused) {
		cardOpacity = Math.max(0.05, item.fadeRemainingMs / FADE_DURATION_MS)
	}

	const fadePercent = Math.min(100, Math.max(0, (item.fadeRemainingMs / FADE_DURATION_MS) * 100))

	// Resolve thumbnail URL
	const bestThumb = pickAppropriateThumbnail(manifest?.thumbnails, { width: 160, height: 90 })
	const thumbUrl = bestThumb
		? getGraphicThumbnailUrl(appSettingsStore.serverApiUrl, item.graphicId, bestThumb.file)
		: ''

	const isEventFromButtonOrPortal = (e: React.MouseEvent<HTMLElement>): boolean => {
		const target = e.target as HTMLElement | null
		if (!target) return false
		if (cardEl && !cardEl.contains(target)) {
			return true
		}
		return Boolean(target.closest('button, [role="button"], a, input, textarea, select, label'))
	}

	const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
		if (isEventFromButtonOrPortal(e)) return
		aiAudioStore.selectItem(item.id)
	}

	const handleCardDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isEventFromButtonOrPortal(e)) return
		aiAudioStore.selectItem(item.id)
		void AiControllerAPI.performAction(item, 'play')
	}

	const handleCardContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement | null
		if (target && cardEl && !cardEl.contains(target)) {
			return
		}
		e.preventDefault()

		if (mode === 'suggestion') {
			aiAudioStore.dismissSuggestionImmediate(item.id)
		} else {
			aiAudioStore.removeBookmark(item.id)
		}
	}

	const handleOpenDataForm = (e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation()
		setDataFormAnchor(e.currentTarget)
		aiAudioStore.setItemPopoverOpen(item.id, true)
	}

	const handleCloseDataForm = () => {
		setDataFormAnchor(null)
		aiAudioStore.setItemPopoverOpen(item.id, Boolean(customFormAnchor))
	}

	const handleOpenCustomForm = (e: React.MouseEvent<HTMLElement>, actionId: string) => {
		e.stopPropagation()
		setCustomFormAnchor({ el: e.currentTarget, actionId })
		aiAudioStore.setItemPopoverOpen(item.id, true)
	}

	const handleCloseCustomForm = () => {
		setCustomFormAnchor(null)
		aiAudioStore.setItemPopoverOpen(item.id, Boolean(dataFormAnchor))
	}

	const activeCustomActionDef = customFormAnchor
		? manifestCustomActions.find((ca) => ca.id === customFormAnchor.actionId)
		: undefined

	const popoverPaperSx = {
		p: 2,
		minWidth: 380,
		width: isFormExpanded ? 'min(92vw, 960px)' : 'max-content',
		maxWidth: 'min(92vw, 960px)',
		maxHeight: '85vh',
		overflow: 'auto',
		resize: 'both',
	}

	const isPrimaryPlayOrUpdatePressedByAi =
		aiPressedActionId === 'play' || (aiPressedActionId === 'update' && item.exposedActions.includes('play'))
	const isStopPressedByAi = aiPressedActionId === 'stop' || aiPressedActionId === 'pause'
	const isStandaloneUpdatePressedByAi = aiPressedActionId === 'update' && !item.exposedActions.includes('play')
	const isClearPressedByAi = aiPressedActionId === 'clear'

	return (
		<Paper
			ref={setCardEl}
			elevation={item.isHovered || isNewlyAdded || isSelected || Boolean(aiPressedActionId) ? 3 : 1}
			onMouseEnter={() => aiAudioStore.setItemHovered(item.id, true)}
			onMouseLeave={() => aiAudioStore.setItemHovered(item.id, false)}
			onClick={handleCardClick}
			onDoubleClick={handleCardDoubleClick}
			onContextMenu={handleCardContextMenu}
			sx={{
				height: SLOT_HEIGHT_PX,
				boxSizing: 'border-box',
				p: 1,
				pb: mode === 'suggestion' ? 1.25 : 1,
				borderRadius: 1.5,
				position: 'relative',
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				cursor: 'pointer',
				userSelect: 'none',
				opacity: cardOpacity,
				transition: isPaused
					? 'opacity 0.08s ease-out, box-shadow 0.25s, background-color 0.3s, outline-color 0.3s'
					: 'opacity 0.12s linear, box-shadow 0.25s, background-color 0.3s, outline-color 0.3s',
				outline:
					Boolean(aiPressedActionId) || isOnAir || isNewlyAdded || isSelected
						? '2px solid'
						: item.status === 'fading' && !isPaused
							? '1px dashed'
							: '1px solid',
				outlineColor: aiPressedActionId
					? 'info.main'
					: isOnAir
						? 'success.main'
						: isNewlyAdded
							? 'info.main'
							: item.status === 'fading' && !isPaused
								? 'warning.main'
								: item.isHovered || isSelected
									? 'primary.main'
									: 'divider',
				boxShadow:
					isNewlyAdded || aiPressedActionId
						? (theme) =>
								`0 0 12px ${theme.palette.mode === 'dark' ? 'rgba(41, 182, 246, 0.45)' : 'rgba(2, 136, 209, 0.35)'}`
						: undefined,
				bgcolor:
					isNewlyAdded || aiPressedActionId
						? (theme) => (theme.palette.mode === 'dark' ? 'rgba(41, 182, 246, 0.08)' : 'rgba(2, 136, 209, 0.05)')
						: 'background.paper',
			}}
		>
			{/* Top Section: Thumbnail + Info + Bookmark/Dismiss */}
			<Box sx={{ display: 'flex', gap: 1.25, minHeight: 0, flex: 1, overflow: 'hidden' }}>
				{/* OGraf Thumbnail */}
				<Box
					sx={{
						width: 96,
						height: 54,
						flexShrink: 0,
						borderRadius: 1,
						overflow: 'hidden',
						bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
						border: '1px solid',
						borderColor: 'divider',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					{thumbUrl ? (
						<Box
							component="img"
							src={thumbUrl}
							alt={graphicName}
							sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
						/>
					) : (
						<ImageOutlinedIcon sx={{ color: 'text.disabled', fontSize: 24 }} />
					)}
				</Box>

				{/* Graphic Name, Reason & Data Preview */}
				<Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden' }}>
					<Stack direction="row" alignItems="center" spacing={0.75} sx={{ overflow: 'hidden' }}>
						<Typography variant="subtitle2" fontWeight={700} noWrap title={graphicName} sx={{ lineHeight: 1.2 }}>
							{graphicName}
						</Typography>
						{graphicName !== item.graphicId && (
							<Typography
								variant="caption"
								color="text.secondary"
								noWrap
								sx={{ fontFamily: 'monospace', fontSize: '0.68rem', flexShrink: 0 }}
							>
								({item.graphicId})
							</Typography>
						)}
						{isNewlyAdded && (
							<Chip
								label="NEW"
								color="info"
								size="small"
								sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}
							/>
						)}
						{aiPressedActionId && (
							<Chip
								icon={<AutoAwesomeIcon sx={{ fontSize: '12px !important' }} />}
								label={`AI: ${aiPressedActionId.toUpperCase()}`}
								color="info"
								size="small"
								sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}
							/>
						)}
						{isOnAir && (
							<Chip
								icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
								label={`ON AIR (${formatDurationShort(onAirSeconds)})`}
								color="success"
								size="small"
								sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}
							/>
						)}
						{item.reason && (
							<Typography
								variant="caption"
								color="text.secondary"
								noWrap
								title={item.reason}
								sx={{ fontStyle: 'italic', fontSize: '0.68rem', ml: 0.5 }}
							>
								— {item.reason}
							</Typography>
						)}
					</Stack>

					{/* Compact Data Preview */}
					<Box sx={{ overflow: 'hidden', maxHeight: 34 }}>
						<DataPreview data={item.graphicData} />
					</Box>
				</Box>

				{/* Top-Right: Bookmark & Dismiss Buttons */}
				<Stack direction="row" spacing={0.25} alignItems="flex-start" sx={{ flexShrink: 0 }}>
					{mode === 'suggestion' && (
						<Tooltip title="Bookmark">
							<IconButton
								size="small"
								color="primary"
								onClick={(e) => {
									e.stopPropagation()
									aiAudioStore.bookmarkSuggestion(item.id)
								}}
								sx={{ p: 0.4 }}
							>
								<BookmarkBorderIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					)}
					<Tooltip title={mode === 'suggestion' ? 'Dismiss' : 'Remove'}>
						<IconButton
							size="small"
							color="default"
							onClick={(e) => {
								e.stopPropagation()
								if (mode === 'suggestion') {
									aiAudioStore.dismissSuggestionImmediate(item.id)
								} else {
									aiAudioStore.removeBookmark(item.id)
								}
							}}
							sx={{ p: 0.4 }}
						>
							<CloseIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Stack>
			</Box>

			{/* Bottom Section: Exposed Actions + Clear Button */}
			<Stack
				direction="row"
				spacing={0.75}
				alignItems="center"
				justifyContent="space-between"
				sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'divider', overflowX: 'auto' }}
			>
				<Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'nowrap', py: 0.25, px: 0.25 }}>
					{item.exposedActions.includes('play') && (
						<Tooltip title={isOnAir ? 'F6' : 'F2 (Shift+F2 Quick Play)'}>
							<Button
								size="small"
								variant="contained"
								color={aiPressedActionId === 'play' ? 'success' : isOnAir ? 'secondary' : 'success'}
								startIcon={
									aiPressedActionId === 'play' ? <PlayArrowIcon /> : isOnAir ? <SyncIcon /> : <PlayArrowIcon />
								}
								onClick={() => void AiControllerAPI.performAction(item, isOnAir ? 'update' : 'play')}
								sx={{
									py: 0.2,
									px: 1,
									minHeight: 26,
									fontSize: '0.72rem',
									fontWeight: 700,
									textTransform: 'none',
									...getAiPressedButtonSx(isPrimaryPlayOrUpdatePressedByAi),
								}}
							>
								{aiPressedActionId === 'play' ? 'Play' : isOnAir ? 'Update' : 'Play'}
							</Button>
						</Tooltip>
					)}

					{(item.exposedActions.includes('play') || item.exposedActions.includes('pause')) && (
						<Tooltip title="F1">
							<Button
								size="small"
								variant={isStopPressedByAi ? 'contained' : 'outlined'}
								color="warning"
								startIcon={<StopIcon />}
								onClick={() => void AiControllerAPI.performAction(item, 'stop')}
								sx={{
									py: 0.2,
									px: 1,
									minHeight: 26,
									fontSize: '0.72rem',
									fontWeight: 600,
									textTransform: 'none',
									...getAiPressedButtonSx(isStopPressedByAi),
								}}
							>
								Stop
							</Button>
						</Tooltip>
					)}

					{item.exposedActions.includes('update') && !item.exposedActions.includes('play') && (
						<Tooltip title="F6">
							<Button
								size="small"
								variant={isStandaloneUpdatePressedByAi ? 'contained' : 'outlined'}
								color="secondary"
								startIcon={<SyncIcon />}
								onClick={() => void AiControllerAPI.performAction(item, 'update')}
								sx={{
									py: 0.2,
									px: 1,
									minHeight: 26,
									fontSize: '0.72rem',
									fontWeight: 600,
									textTransform: 'none',
									...getAiPressedButtonSx(isStandaloneUpdatePressedByAi),
								}}
							>
								Update
							</Button>
						</Tooltip>
					)}

					{(item.exposedActions.includes('data-entry') || Boolean(graphicSchema)) && (
						<Button
							size="small"
							variant={item.exposedActions.includes('data-entry') ? 'contained' : 'outlined'}
							color="info"
							startIcon={<EditNoteIcon />}
							onClick={handleOpenDataForm}
							sx={{ py: 0.2, px: 1, minHeight: 26, fontSize: '0.72rem', fontWeight: 600, textTransform: 'none' }}
						>
							Data Entry
						</Button>
					)}

					{/* Custom Actions exposed by LLM */}
					{item.exposedCustomActions.map((ca) => {
						const caDef = manifestCustomActions.find((m) => m.id === ca.id)
						const label = caDef?.name || ca.id
						const hasSchema = Boolean(caDef?.schema)
						const isCustomPressedByAi = aiPressedActionId === ca.id

						if (ca.withForm && hasSchema) {
							return (
								<Tooltip key={ca.id} title={caDef?.description || ''}>
									<Button
										size="small"
										variant={isCustomPressedByAi ? 'contained' : 'outlined'}
										color="primary"
										startIcon={<TuneIcon />}
										onClick={(e) => handleOpenCustomForm(e, ca.id)}
										sx={{
											py: 0.2,
											px: 1,
											minHeight: 26,
											fontSize: '0.72rem',
											fontWeight: 600,
											textTransform: 'none',
											...getAiPressedButtonSx(isCustomPressedByAi),
										}}
									>
										{label}…
									</Button>
								</Tooltip>
							)
						}

						return (
							<Tooltip key={ca.id} title={caDef?.description || ''}>
								<Button
									size="small"
									variant={isCustomPressedByAi ? 'contained' : 'outlined'}
									color="primary"
									startIcon={<BoltIcon />}
									onClick={() =>
										void AiControllerAPI.performAction(item, ca.id, {
											payload: item.customActionData?.[ca.id] ?? ca.payload,
										})
									}
									sx={{
										py: 0.2,
										px: 1,
										minHeight: 26,
										fontSize: '0.72rem',
										fontWeight: 600,
										textTransform: 'none',
										...getAiPressedButtonSx(isCustomPressedByAi),
									}}
								>
									{label}
								</Button>
							</Tooltip>
						)
					})}
				</Stack>

				{/* Mandatory Clear Button on every action card */}
				<Tooltip title="F10">
					<Button
						size="small"
						variant={isClearPressedByAi ? 'contained' : 'outlined'}
						color="error"
						startIcon={<LayersClearIcon />}
						onClick={() => void AiControllerAPI.performAction(item, 'clear')}
						sx={{
							py: 0.2,
							px: 1,
							minHeight: 26,
							fontSize: '0.72rem',
							fontWeight: 600,
							textTransform: 'none',
							flexShrink: 0,
							...getAiPressedButtonSx(isClearPressedByAi),
						}}
					>
						Clear
					</Button>
				</Tooltip>
			</Stack>

			{/* Bottom Progress Bar (shown only when suggestion is about to be removed) */}
			{mode === 'suggestion' && item.status === 'fading' && (
				<LinearProgress
					variant="determinate"
					value={fadePercent}
					color={isPaused ? 'info' : 'warning'}
					sx={{
						position: 'absolute',
						bottom: 0,
						left: 0,
						right: 0,
						height: 3,
					}}
				/>
			)}

			{/* Floating Popover for Data Entry (ograf-form) */}
			<Popover
				open={Boolean(dataFormAnchor)}
				anchorEl={dataFormAnchor}
				onClose={handleCloseDataForm}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				slotProps={{
					paper: {
						sx: popoverPaperSx,
					},
				}}
			>
				<Stack spacing={1.5}>
					<Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
						<Typography variant="subtitle2" fontWeight={700}>
							{graphicName}
						</Typography>
						<Stack direction="row" spacing={0.5} alignItems="center">
							<Tooltip title={isFormExpanded ? 'Compact width' : 'Expand width'}>
								<IconButton size="small" onClick={() => setIsFormExpanded((v) => !v)}>
									{isFormExpanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
								</IconButton>
							</Tooltip>
							<IconButton size="small" onClick={handleCloseDataForm}>
								<CloseIcon fontSize="small" />
							</IconButton>
						</Stack>
					</Stack>

					{graphicSchema ? (
						<OGrafForm
							key={`data_form_${item.id}`}
							schema={graphicSchema}
							value={clone(item.graphicData)}
							onDataChangeCallback={(newData: unknown) => {
								aiAudioStore.updateItemData(item.id, { graphicData: newData })
							}}
						/>
					) : (
						<Typography variant="body2" color="text.secondary">
							No data schema.
						</Typography>
					)}

					<Stack direction="row" spacing={1} justifyContent="flex-end" pt={1}>
						<Button
							size="small"
							variant="outlined"
							color="warning"
							startIcon={<StopIcon />}
							onClick={() => void AiControllerAPI.performAction(item, 'stop')}
						>
							Stop
						</Button>
						<Button
							size="small"
							variant="contained"
							color={isOnAir ? 'secondary' : 'success'}
							startIcon={isOnAir ? <SyncIcon /> : <PlayArrowIcon />}
							onClick={() => void AiControllerAPI.performAction(item, isOnAir ? 'update' : 'play')}
						>
							{isOnAir ? 'Update' : 'Play'}
						</Button>
					</Stack>
				</Stack>
			</Popover>

			{/* Floating Popover for Custom Action with ograf-form */}
			<Popover
				open={Boolean(customFormAnchor)}
				anchorEl={customFormAnchor?.el}
				onClose={handleCloseCustomForm}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				slotProps={{
					paper: {
						sx: popoverPaperSx,
					},
				}}
			>
				{customFormAnchor && (
					<Stack spacing={1.5}>
						<Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
							<Box>
								<Typography variant="subtitle2" fontWeight={700}>
									{activeCustomActionDef?.name || customFormAnchor.actionId}
								</Typography>
								{activeCustomActionDef?.description && (
									<Typography variant="caption" color="text.secondary">
										{activeCustomActionDef.description}
									</Typography>
								)}
							</Box>
							<Stack direction="row" spacing={0.5} alignItems="center">
								<Tooltip title={isFormExpanded ? 'Compact width' : 'Expand width'}>
									<IconButton size="small" onClick={() => setIsFormExpanded((v) => !v)}>
										{isFormExpanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
									</IconButton>
								</Tooltip>
								<IconButton size="small" onClick={handleCloseCustomForm}>
									<CloseIcon fontSize="small" />
								</IconButton>
							</Stack>
						</Stack>

						{Boolean(activeCustomActionDef?.schema) && (
							<OGrafForm
								key={`ca_form_${item.id}_${customFormAnchor.actionId}`}
								schema={activeCustomActionDef?.schema}
								value={clone(item.customActionData?.[customFormAnchor.actionId])}
								onDataChangeCallback={(newData: unknown) => {
									aiAudioStore.updateItemData(item.id, {
										customActionData: {
											...item.customActionData,
											[customFormAnchor.actionId]: newData,
										},
									})
								}}
							/>
						)}

						<Stack direction="row" spacing={1} justifyContent="flex-end" pt={1}>
							<Button
								size="small"
								variant="contained"
								color="primary"
								startIcon={<BoltIcon />}
								onClick={() =>
									void AiControllerAPI.performAction(item, customFormAnchor.actionId, {
										payload: item.customActionData?.[customFormAnchor.actionId],
									})
								}
							>
								{activeCustomActionDef?.name || customFormAnchor.actionId}
							</Button>
						</Stack>
					</Stack>
				)}
			</Popover>

			<GraphicPreviewPopper
				open={item.isHovered && !item.isPopoverOpen}
				anchorEl={cardEl}
				graphicId={item.graphicId}
				graphicData={item.graphicData}
			/>
		</Paper>
	)
})
