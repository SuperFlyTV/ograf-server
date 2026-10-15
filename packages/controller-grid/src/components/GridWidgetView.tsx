import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'

import FlashOnIcon from '@mui/icons-material/FlashOn'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import BoltIcon from '@mui/icons-material/Bolt'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'

import { getDefaultDataFromSchema } from 'ograf-form'
import { CELL_SIZE, gridStore, GridWidget } from '../stores/gridStore.js'
import { serverDataStore } from '../stores/serverData.js'
import { GridControllerAPI } from '../lib/gridControllerApi.js'
import { OGrafForm } from './OGrafForm.js'
import { EmbeddedCustomGui } from './CustomGuiDialog.js'
import { clone } from '../lib/lib.js'

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface GridWidgetViewProps {
	widget: GridWidget
	isSelected: boolean
	isEditMode: boolean
	onStartMove: (e: React.PointerEvent, widget: GridWidget) => void
	onStartResize: (e: React.PointerEvent, widget: GridWidget, dir: ResizeDirection) => void
	onContextMenu: (e: React.MouseEvent, widget: GridWidget) => void
}

function getActionIcon(iconName?: string, actionType?: string) {
	const key = iconName || actionType || 'flash'
	if (key === 'none') return null
	switch (key) {
		case 'flash':
		case 'quickPlay':
			return <FlashOnIcon fontSize="inherit" />
		case 'play':
			return <PlayArrowIcon fontSize="inherit" />
		case 'stop':
			return <StopIcon fontSize="inherit" />
		case 'load':
			return <RefreshIcon fontSize="inherit" />
		case 'update':
			return <SyncIcon fontSize="inherit" />
		case 'clear':
		case 'clearTarget':
		case 'clearRenderer':
		case 'clearAll':
			return <DeleteSweepIcon fontSize="inherit" />
		case 'bolt':
		default:
			return <BoltIcon fontSize="inherit" />
	}
}

function getDefaultButtonColor(actionType?: string, customColor?: string): string {
	if (customColor) return customColor
	switch (actionType) {
		case 'quickPlay':
			return '#1976d2'
		case 'play':
			return '#2e7d32'
		case 'stop':
			return '#d32f2f'
		case 'update':
			return '#9c27b0'
		case 'load':
			return '#455a64'
		case 'clearTarget':
		case 'clearRenderer':
			return '#ed6c02'
		case 'clearAll':
			return '#b71c1c'
		default:
			return '#0288d1'
	}
}

export const GridWidgetView: React.FC<GridWidgetViewProps> = observer(
	({ widget, isSelected, isEditMode, onStartMove, onStartResize, onContextMenu }) => {
		const leftPx = widget.x * CELL_SIZE
		const topPx = widget.y * CELL_SIZE
		const widthPx = Math.max(20, widget.w * CELL_SIZE)
		const heightPx = Math.max(20, widget.h * CELL_SIZE)

		const instance = gridStore.getInstance(widget.instanceId)
		const targetInstances = gridStore.getTargetInstancesForWidget(widget)
		const isAnyTargetLoaded = targetInstances.some((inst) => Boolean(inst.graphicInstanceId))
		const isFlashing = gridStore.flashingWidgetIds.has(widget.id)

		const handlePointerDown = (e: React.PointerEvent) => {
			if (e.button === 2) return // Right click handled by context menu
			if (isEditMode) {
				e.stopPropagation()
				onStartMove(e, widget)
			}
		}

		const renderWidgetInner = () => {
			// 1. ACTION BUTTON & CUSTOM ACTION BUTTON
			if (widget.type === 'action-button' || widget.type === 'custom-action-button') {
				const btnColor = getDefaultButtonColor(
					widget.type === 'custom-action-button' ? 'custom' : widget.actionType,
					widget.color
				)
				const iconNode = getActionIcon(widget.icon, widget.type === 'custom-action-button' ? 'bolt' : widget.actionType)
				const fontSize = widget.textSize === 'large' ? '1.05rem' : widget.textSize === 'small' ? '0.75rem' : '0.88rem'

				return (
					<Button
						variant="contained"
						fullWidth
						disableElevation={false}
						onClick={(e) => {
							if (isEditMode) {
								e.preventDefault()
								return
							}
							e.stopPropagation()
							void GridControllerAPI.executeWidgetAction(widget)
						}}
						sx={{
							width: '100%',
							height: '100%',
							minWidth: 0,
							minHeight: 0,
							p: 0.75,
							borderRadius: 1.5,
							bgcolor: btnColor,
							color: '#fff',
							textTransform: 'none',
							fontWeight: 700,
							fontSize,
							lineHeight: 1.15,
							display: 'flex',
							flexDirection: heightPx >= 65 ? 'column' : 'row',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 0.5,
							position: 'relative',
							overflow: 'hidden',
							boxShadow: isFlashing
								? '0 0 0 3px #fff, 0 0 18px rgba(255,255,255,0.9)'
								: isAnyTargetLoaded
									? 'inset 0 0 0 2px rgba(105, 240, 174, 0.9), 0 2px 6px rgba(0,0,0,0.3)'
									: 2,
							transform: isFlashing ? 'scale(0.97)' : 'none',
							transition: 'transform 0.08s ease, box-shadow 0.15s ease, filter 0.15s ease',
							'&:hover': {
								bgcolor: btnColor,
								filter: 'brightness(1.12)',
							},
						}}
					>
						{iconNode && <Box sx={{ display: 'flex', fontSize: heightPx >= 65 ? '1.35em' : '1.15em' }}>{iconNode}</Box>}
						<Box
							component="span"
							sx={{
								textAlign: 'center',
								wordBreak: 'break-word',
								overflow: 'hidden',
								display: '-webkit-box',
								WebkitLineClamp: heightPx >= 60 ? 3 : 2,
								WebkitBoxOrient: 'vertical',
							}}
						>
							{widget.label || widget.actionType || widget.customActionId || 'Action'}
						</Box>

						{/* Live On-Air Dot */}
						{isAnyTargetLoaded && (
							<Box
								title="Graphic Instance is currently loaded on renderer"
								sx={{
									position: 'absolute',
									top: 5,
									left: 5,
									width: 8,
									height: 8,
									borderRadius: '50%',
									bgcolor: '#69f0ae',
									boxShadow: '0 0 6px #69f0ae',
								}}
							/>
						)}

						{/* Hotkey Badge */}
						{widget.hotkey && (
							<Box
								sx={{
									position: 'absolute',
									top: 3,
									right: 4,
									px: 0.5,
									py: 0.1,
									borderRadius: 0.75,
									bgcolor: 'rgba(0,0,0,0.45)',
									color: '#fff',
									fontSize: '0.62rem',
									fontFamily: 'monospace',
									fontWeight: 700,
									lineHeight: 1.2,
								}}
							>
								{widget.hotkey}
							</Box>
						)}

						{/* Preset badge */}
						{widget.usePresetData && (
							<Box
								sx={{
									position: 'absolute',
									bottom: 3,
									right: 4,
									px: 0.4,
									borderRadius: 0.5,
									bgcolor: 'rgba(0,0,0,0.35)',
									color: 'rgba(255,255,255,0.85)',
									fontSize: '0.58rem',
									fontWeight: 600,
								}}
							>
								PRESET
							</Box>
						)}
					</Button>
				)
			}

			// 2. GRAPHIC DATA FORM WIDGET
			if (widget.type === 'data-form') {
				const graphicInfo = instance ? serverDataStore.graphicsInfo.get(instance.graphicId) : undefined
				const schema = graphicInfo?.graphic.schema

				return (
					<Box
						sx={{
							width: '100%',
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							bgcolor: widget.hideHeader && widget.compact ? 'transparent' : 'background.paper',
							border: widget.hideHeader && widget.compact ? 'none' : '1px solid',
							borderColor: 'divider',
							borderRadius: 1.5,
							overflow: 'hidden',
						}}
					>
						{!widget.hideHeader && (
							<Box
								sx={{
									px: 1,
									py: 0.4,
									bgcolor: 'action.hover',
									borderBottom: '1px solid',
									borderColor: 'divider',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									gap: 0.5,
									flexShrink: 0,
								}}
							>
								<Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
									{instance?.color && (
										<Box
											sx={{
												width: 8,
												height: 8,
												borderRadius: '50%',
												bgcolor: instance.color,
												flexShrink: 0,
											}}
										/>
									)}
									<Typography variant="caption" fontWeight={700} noWrap>
										{widget.label || instance?.name || 'Data Form'}
									</Typography>
								</Stack>
								{widget.autoUpdate && (
									<Chip
										label="Auto-Update"
										size="small"
										color="secondary"
										variant="outlined"
										sx={{ height: 16, fontSize: '0.62rem', '& .MuiChip-label': { px: 0.5 } }}
									/>
								)}
							</Box>
						)}

						<Box
							sx={{
								p: widget.compact ? 0.5 : 1,
								flexGrow: 1,
								overflow: 'auto',
								pointerEvents: isEditMode ? 'none' : 'auto',
							}}
						>
							{!instance ? (
								<Typography variant="caption" color="text.secondary">
									No Graphic Instance linked. Select one in the Inspector.
								</Typography>
							) : !schema ? (
								<Typography variant="caption" color="text.secondary">
									Graphic "{instance.graphicId}" has no data schema.
								</Typography>
							) : (
								<OGrafForm
									key={`form_${widget.id}_${instance.id}_${(widget.hiddenProperties || []).join(',')}`}
									schema={schema}
									hiddenProperties={widget.hiddenProperties}
									hideFieldLabels={widget.hideFieldLabels}
									compact={widget.compact}
									value={clone(instance.graphicData)}
									onDataChangeCallback={(newData: unknown) => {
										gridStore.updateGraphicInstance(instance.id, { graphicData: newData }, false)
										if (widget.autoUpdate) {
											void GridControllerAPI.performAction(instance, 'update', { data: newData })
										}
									}}
								/>
							)}
						</Box>
					</Box>
				)
			}

			// 3. CUSTOM ACTION FORM WIDGET
			if (widget.type === 'custom-action-form') {
				const graphicInfo = instance ? serverDataStore.graphicsInfo.get(instance.graphicId) : undefined
				const customActions: any[] =
					(graphicInfo?.graphic as any)?.customActions || (graphicInfo?.graphic as any)?.actions || []
				const actionDef = customActions.find((a) => a.id === widget.customActionId) || customActions[0]
				const actionId = actionDef?.id || widget.customActionId

				return (
					<Box
						sx={{
							width: '100%',
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							bgcolor: 'background.paper',
							border: '1px solid',
							borderColor: 'divider',
							borderRadius: 1.5,
							overflow: 'hidden',
						}}
					>
						{!widget.hideHeader && (
							<Box
								sx={{
									px: 1,
									py: 0.4,
									bgcolor: 'action.hover',
									borderBottom: '1px solid',
									borderColor: 'divider',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									gap: 0.5,
								}}
							>
								<Typography variant="caption" fontWeight={700} noWrap>
									{widget.label || actionDef?.name || actionId || 'Custom Action'}
								</Typography>
								{widget.showTriggerButton !== false && instance && actionId && (
									<Button
										size="small"
										variant="contained"
										color="primary"
										disabled={isEditMode}
										onClick={(e) => {
											e.stopPropagation()
											void GridControllerAPI.performAction(instance, actionId)
										}}
										sx={{ py: 0.1, px: 0.75, minWidth: 0, fontSize: '0.68rem', textTransform: 'none' }}
									>
										Trigger
									</Button>
								)}
							</Box>
						)}
						<Box
							sx={{
								p: widget.compact ? 0.5 : 1,
								flexGrow: 1,
								overflow: 'auto',
								pointerEvents: isEditMode ? 'none' : 'auto',
							}}
						>
							{!instance ? (
								<Typography variant="caption" color="text.secondary">
									No Graphic Instance linked.
								</Typography>
							) : !actionDef?.schema ? (
								<Typography variant="caption" color="text.secondary">
									{actionDef
										? `Action "${actionDef.name || actionDef.id}" has no schema.`
										: 'Select a custom action in Inspector.'}
								</Typography>
							) : (
								<OGrafForm
									key={`ca_form_${widget.id}_${instance.id}_${actionId}_${(widget.hiddenProperties || []).join(',')}`}
									schema={actionDef.schema}
									hiddenProperties={widget.hiddenProperties}
									hideFieldLabels={widget.hideFieldLabels}
									compact={widget.compact}
									value={clone(instance.customActionData?.[actionId])}
									onDataChangeCallback={(newData: unknown) => {
										gridStore.updateGraphicInstance(
											instance.id,
											{
												customActionData: {
													...instance.customActionData,
													[actionId]: newData,
												},
											},
											false
										)
									}}
								/>
							)}
						</Box>
					</Box>
				)
			}

			// 4. RENDER TARGET & RENDERER CONFIG WIDGET
			if (widget.type === 'target-config') {
				const rendererInfo = instance ? serverDataStore.renderersInfo.get(instance.rendererId) : undefined
				const targetSchema = rendererInfo?.renderTargetSchema

				return (
					<Box
						sx={{
							width: '100%',
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							bgcolor: 'background.paper',
							border: '1px solid',
							borderColor: 'divider',
							borderRadius: 1.5,
							overflow: 'hidden',
						}}
					>
						{!widget.hideHeader && (
							<Box
								sx={{
									px: 1,
									py: 0.4,
									bgcolor: 'action.hover',
									borderBottom: '1px solid',
									borderColor: 'divider',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
								}}
							>
								<Typography variant="caption" fontWeight={700} noWrap>
									{widget.label || (instance ? `${instance.name} — Target` : 'Render Target')}
								</Typography>
							</Box>
						)}
						<Box
							sx={{
								p: widget.compact ? 0.5 : 1,
								flexGrow: 1,
								overflow: 'auto',
								pointerEvents: isEditMode ? 'none' : 'auto',
							}}
							onPointerDown={(e) => e.stopPropagation()}
						>
							{!instance ? (
								<Typography variant="caption" color="text.secondary">
									No Graphic Instance linked.
								</Typography>
							) : (
								<Stack spacing={1}>
									{widget.showRendererSelector !== false && (
										<FormControl size="small" fullWidth>
											<InputLabel>Renderer</InputLabel>
											<Select
												value={instance.rendererId || ''}
												label="Renderer"
												onChange={(e) => {
													const newRId = e.target.value
													const newSchema = serverDataStore.renderersInfo.get(newRId)?.renderTargetSchema
													gridStore.updateGraphicInstance(
														instance.id,
														{
															rendererId: newRId,
															renderTarget: newSchema ? getDefaultDataFromSchema(newSchema) : undefined,
														},
														true
													)
												}}
											>
												{serverDataStore.renderersList.map((r) => (
													<MenuItem key={r.id} value={r.id}>
														{r.name || r.id} ({r.id})
													</MenuItem>
												))}
											</Select>
										</FormControl>
									)}
									{targetSchema ? (
										<OGrafForm
											key={`target_form_${widget.id}_${instance.id}_${instance.rendererId}_${(widget.hiddenProperties || []).join(',')}`}
											schema={targetSchema}
											hiddenProperties={widget.hiddenProperties}
											hideFieldLabels={widget.hideFieldLabels}
											compact={widget.compact}
											value={clone(instance.renderTarget)}
											onDataChangeCallback={(newData: unknown) => {
												gridStore.updateGraphicInstance(instance.id, { renderTarget: newData }, false)
											}}
										/>
									) : (
										<Typography variant="caption" color="text.secondary">
											No render target schema for renderer "{instance.rendererId}".
										</Typography>
									)}
								</Stack>
							)}
						</Box>
					</Box>
				)
			}

			// 5. CUSTOM GUI WEB COMPONENT WIDGET
			if (widget.type === 'custom-gui') {
				const customGuis = instance ? serverDataStore.customGuisMap.get(instance.graphicId) : undefined
				if (instance && !customGuis && !serverDataStore.customGuisMap.has(instance.graphicId)) {
					void serverDataStore.loadCustomGuisForGraphic(instance.graphicId)
				}
				const selectedGui = customGuis?.find((g) => g.id === widget.customGuiId) || (customGuis && customGuis[0])

				if (widget.customGuiDisplayMode === 'button') {
					return (
						<Button
							variant="outlined"
							fullWidth
							startIcon={<OpenInNewIcon />}
							onClick={(e) => {
								if (isEditMode) return
								e.stopPropagation()
								if (instance && selectedGui) {
									gridStore.openCustomGui(instance.id, selectedGui)
								}
							}}
							sx={{
								width: '100%',
								height: '100%',
								textTransform: 'none',
								fontWeight: 700,
								borderRadius: 1.5,
								bgcolor: 'background.paper',
							}}
						>
							{widget.label || (selectedGui ? `Open ${selectedGui.name}` : 'Open Custom GUI')}
						</Button>
					)
				}

				return (
					<Box
						sx={{
							width: '100%',
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							bgcolor: 'background.paper',
							border: '1px solid',
							borderColor: 'divider',
							borderRadius: 1.5,
							overflow: 'hidden',
						}}
					>
						{!widget.hideHeader && (
							<Box
								sx={{
									px: 1,
									py: 0.4,
									bgcolor: 'action.hover',
									borderBottom: '1px solid',
									borderColor: 'divider',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
								}}
							>
								<Typography variant="caption" fontWeight={700} noWrap>
									{widget.label || selectedGui?.name || 'Custom GUI'}
								</Typography>
							</Box>
						)}
						<Box
							sx={{
								p: 0.75,
								flexGrow: 1,
								display: 'flex',
								flexDirection: 'column',
								minHeight: 0,
								pointerEvents: isEditMode ? 'none' : 'auto',
							}}
						>
							{instance && selectedGui ? (
								<EmbeddedCustomGui
									instanceId={instance.id}
									graphicId={instance.graphicId}
									componentId={selectedGui.id}
									componentClass={selectedGui.componentClass}
								/>
							) : (
								<Typography variant="caption" color="text.secondary">
									{instance
										? `No Custom GUI web component found on graphic "${instance.graphicId}".`
										: 'No Graphic Instance linked.'}
								</Typography>
							)}
						</Box>
					</Box>
				)
			}

			// 6. STATUS BADGE WIDGET
			if (widget.type === 'status-badge') {
				const isLoaded = Boolean(instance?.graphicInstanceId)
				return (
					<Box
						sx={{
							width: '100%',
							height: '100%',
							px: 1.25,
							py: 0.5,
							bgcolor: 'background.paper',
							border: '2px solid',
							borderColor: isLoaded ? 'success.main' : 'divider',
							borderRadius: 1.5,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 1,
							overflow: 'hidden',
						}}
					>
						<Box sx={{ minWidth: 0 }}>
							<Typography variant="body2" fontWeight={700} noWrap>
								{widget.label || instance?.name || 'Unlinked Status'}
							</Typography>
							{instance && (
								<Typography variant="caption" color="text.secondary" display="block" noWrap>
									{instance.graphicId} • {instance.rendererId}
								</Typography>
							)}
						</Box>
						<Chip
							icon={<RadioButtonCheckedIcon sx={{ fontSize: '14px !important' }} />}
							label={isLoaded ? 'ON AIR' : 'IDLE'}
							size="small"
							color={isLoaded ? 'success' : 'default'}
							variant={isLoaded ? 'filled' : 'outlined'}
							sx={{ fontWeight: 700, fontSize: '0.68rem', height: 22, flexShrink: 0 }}
						/>
					</Box>
				)
			}

			// 7. SECTION FRAME / LABEL WIDGET
			if (widget.type === 'section-frame') {
				const frameColor = widget.color || instance?.color || '#1976d2'
				return (
					<Box
						sx={{
							width: '100%',
							height: '100%',
							borderRadius: 2,
							border: '2px solid',
							borderColor: `${frameColor}66`,
							bgcolor: `${frameColor}12`,
							display: 'flex',
							flexDirection: 'column',
							pointerEvents: isEditMode ? 'auto' : 'none',
						}}
					>
						<Box
							sx={{
								px: 1.25,
								py: 0.4,
								bgcolor: `${frameColor}28`,
								borderBottom: '1px solid',
								borderColor: `${frameColor}44`,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<Typography
								variant="subtitle2"
								fontWeight={800}
								noWrap
								sx={{
									fontSize: widget.textSize === 'large' ? '1rem' : widget.textSize === 'small' ? '0.75rem' : '0.85rem',
								}}
							>
								{widget.label || 'Section'}
							</Typography>
							{instance && (
								<Typography variant="caption" sx={{ opacity: 0.75, fontFamily: 'monospace' }} noWrap>
									{instance.graphicId}
								</Typography>
							)}
						</Box>
					</Box>
				)
			}

			return null
		}

		const resizeHandles: { dir: ResizeDirection; sx: Record<string, any> }[] = [
			{ dir: 'nw', sx: { top: -5, left: -5, cursor: 'nwse-resize' } },
			{ dir: 'ne', sx: { top: -5, right: -5, cursor: 'nesw-resize' } },
			{ dir: 'sw', sx: { bottom: -5, left: -5, cursor: 'nesw-resize' } },
			{ dir: 'se', sx: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
			{ dir: 'n', sx: { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
			{ dir: 's', sx: { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
			{ dir: 'w', sx: { left: -5, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
			{ dir: 'e', sx: { right: -5, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
		]

		return (
			<Box
				data-widget-id={widget.id}
				onPointerDown={handlePointerDown}
				onContextMenu={(e) => {
					e.preventDefault()
					e.stopPropagation()
					onContextMenu(e, widget)
				}}
				sx={{
					position: 'absolute',
					left: leftPx,
					top: topPx,
					width: widthPx,
					height: heightPx,
					zIndex: widget.zIndex,
					userSelect: 'none',
					touchAction: isEditMode ? 'none' : 'manipulation',
					cursor: isEditMode ? 'grab' : 'default',
					outline: isEditMode ? (isSelected ? '2px solid #1976d2' : '1px dashed rgba(128,128,128,0.4)') : 'none',
					outlineOffset: isSelected ? 1 : 0,
					borderRadius: 1.5,
					boxShadow: isEditMode && isSelected ? '0 0 0 3px rgba(25, 118, 210, 0.28)' : 'none',
					pointerEvents: widget.type === 'section-frame' && !isEditMode ? 'none' : 'auto',
					'&:active': {
						cursor: isEditMode ? 'grabbing' : 'default',
					},
				}}
			>
				{renderWidgetInner()}

				{/* Edit Mode Instance Tag & Coordinates Pill when selected */}
				{isEditMode && isSelected && (
					<Box
						sx={{
							position: 'absolute',
							top: -20,
							left: 0,
							bgcolor: '#1976d2',
							color: '#fff',
							px: 0.6,
							py: 0.1,
							borderRadius: 0.75,
							fontSize: '0.62rem',
							fontWeight: 700,
							whiteSpace: 'nowrap',
							pointerEvents: 'none',
							zIndex: 20,
							boxShadow: 1,
						}}
					>
						{widget.w}×{widget.h} ({widget.x},{widget.y}){instance ? ` • ${instance.name}` : ''}
					</Box>
				)}

				{/* 8-Way Resize Handles in Edit Mode */}
				{isEditMode &&
					isSelected &&
					resizeHandles.map((h) => (
						<Box
							key={h.dir}
							onPointerDown={(e) => {
								e.stopPropagation()
								onStartResize(e, widget, h.dir)
							}}
							sx={{
								position: 'absolute',
								width: 12,
								height: 12,
								bgcolor: '#fff',
								border: '2px solid #1976d2',
								borderRadius: '50%',
								zIndex: 30,
								touchAction: 'none',
								...h.sx,
								'&:hover': {
									bgcolor: '#1976d2',
									transform: h.sx.transform ? `${h.sx.transform} scale(1.2)` : 'scale(1.2)',
								},
							}}
						/>
					))}
			</Box>
		)
	}
)
