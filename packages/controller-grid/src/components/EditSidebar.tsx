import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'

import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import FlipToFrontIcon from '@mui/icons-material/FlipToFront'
import FlipToBackIcon from '@mui/icons-material/FlipToBack'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import SmartButtonIcon from '@mui/icons-material/SmartButton'
import DynamicFormIcon from '@mui/icons-material/DynamicForm'
import TuneIcon from '@mui/icons-material/Tune'
import CropFreeIcon from '@mui/icons-material/CropFree'
import BoltIcon from '@mui/icons-material/Bolt'
import WebAssetIcon from '@mui/icons-material/WebAsset'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import LayersIcon from '@mui/icons-material/Layers'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import FlashOnIcon from '@mui/icons-material/FlashOn'

import { getDefaultDataFromSchema } from 'ograf-form'
import { gridStore, StandardActionType } from '../stores/gridStore.js'
import { serverDataStore } from '../stores/serverData.js'
import { GridControllerAPI } from '../lib/gridControllerApi.js'
import { extractSchemaProperties } from '../lib/schemaUtils.js'
import { OGrafForm } from './OGrafForm.js'
import { clone } from '../lib/lib.js'

const PRESET_COLORS = [
	'#1976d2',
	'#2e7d32',
	'#d32f2f',
	'#9c27b0',
	'#ed6c02',
	'#0288d1',
	'#455a64',
	'#00796b',
	'#c2185b',
	'#5c6bc0',
]

export interface EditSidebarProps {
	onOpenAddGraphicDialog: () => void
}

export const EditSidebar: React.FC<EditSidebarProps> = observer(({ onOpenAddGraphicDialog }) => {
	const [isRecordingHotkey, setIsRecordingHotkey] = React.useState(false)
	const singleWidget = gridStore.singleSelectedWidget
	const selectedWidgets = gridStore.selectedWidgets

	// Stop recording hotkey when selection changes
	React.useEffect(() => {
		setIsRecordingHotkey(false)
	}, [singleWidget?.id])

	// Global key listener when recording a widget hotkey
	React.useEffect(() => {
		if (!isRecordingHotkey || !singleWidget) return

		const handleKeyDown = (e: KeyboardEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
				return // Wait for non-modifier key
			}

			if (e.key === 'Escape') {
				setIsRecordingHotkey(false)
				return
			}

			const parts: string[] = []
			if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
			if (e.altKey) parts.push('Alt')
			if (e.shiftKey) parts.push('Shift')

			const keyLabel = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
			parts.push(keyLabel)

			const hotkeyStr = parts.join('+')
			gridStore.updateWidget(singleWidget.id, { hotkey: hotkeyStr }, true)
			setIsRecordingHotkey(false)
		}

		window.addEventListener('keydown', handleKeyDown, true)
		return () => window.removeEventListener('keydown', handleKeyDown, true)
	}, [isRecordingHotkey, singleWidget])

	const renderInspectorTab = () => {
		if (selectedWidgets.length === 0) {
			return (
				<Box sx={{ p: 2.5, textAlign: 'center', mt: 4 }}>
					<Typography variant="subtitle1" fontWeight={700} color="text.secondary" gutterBottom>
						No Widget Selected
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
						Click or drag-select any widget on the grid to inspect and customize it, or add new controls below.
					</Typography>
					<Stack spacing={1.25}>
						<Button variant="contained" startIcon={<AddIcon />} onClick={onOpenAddGraphicDialog}>
							Add Graphic Kit from Server
						</Button>
						<Button
							variant="outlined"
							startIcon={<SmartButtonIcon />}
							onClick={() => gridStore.setSidebarTab('palette')}
						>
							Browse Widget Palette
						</Button>
					</Stack>
				</Box>
			)
		}

		// Multi-selection Inspector
		if (selectedWidgets.length > 1 && !singleWidget) {
			return (
				<Box sx={{ p: 1.5 }}>
					<Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
						<Stack direction="row" alignItems="center" spacing={1}>
							<Typography variant="subtitle1" fontWeight={700}>
								Multi-Selection
							</Typography>
							<Chip label={`${selectedWidgets.length} widgets`} size="small" color="primary" />
						</Stack>
						<IconButton
							size="small"
							color="error"
							title="Delete Selected (Del)"
							onClick={() => gridStore.removeSelectedWidgets()}
						>
							<DeleteIcon fontSize="small" />
						</IconButton>
					</Stack>

					<Card variant="outlined" sx={{ mb: 2 }}>
						<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
							<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
								Alignment & Layering
							</Typography>
							<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mb={1}>
								<Tooltip title="Align Left">
									<IconButton size="small" onClick={() => gridStore.alignSelectedWidgets('left')}>
										<FormatAlignLeftIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<Tooltip title="Align Horizontal Center">
									<IconButton size="small" onClick={() => gridStore.alignSelectedWidgets('center-h')}>
										<FormatAlignCenterIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<Tooltip title="Align Right">
									<IconButton size="small" onClick={() => gridStore.alignSelectedWidgets('right')}>
										<FormatAlignRightIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<Tooltip title="Align Top">
									<IconButton size="small" onClick={() => gridStore.alignSelectedWidgets('top')}>
										<VerticalAlignTopIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<Tooltip title="Align Vertical Center">
									<IconButton size="small" onClick={() => gridStore.alignSelectedWidgets('center-v')}>
										<VerticalAlignCenterIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<Tooltip title="Align Bottom">
									<IconButton size="small" onClick={() => gridStore.alignSelectedWidgets('bottom')}>
										<VerticalAlignBottomIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</Stack>

							<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
								<Button
									size="small"
									variant="outlined"
									startIcon={<FlipToFrontIcon />}
									onClick={() => gridStore.bringToFront()}
									sx={{ textTransform: 'none' }}
								>
									Bring Front
								</Button>
								<Button
									size="small"
									variant="outlined"
									startIcon={<FlipToBackIcon />}
									onClick={() => gridStore.sendToBack()}
									sx={{ textTransform: 'none' }}
								>
									Send Back
								</Button>
							</Stack>
						</CardContent>
					</Card>

					<Card variant="outlined" sx={{ mb: 2 }}>
						<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
							<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
								Batch Rebind Graphic Group
							</Typography>
							<FormControl size="small" fullWidth>
								<InputLabel>Link All To Group</InputLabel>
								<Select
									value=""
									label="Link All To Group"
									onChange={(e) => {
										const instId = e.target.value
										if (instId) {
											gridStore.updateMultipleWidgets(
												selectedWidgets.map((w) => w.id),
												{ instanceId: instId }
											)
										}
									}}
								>
									{gridStore.graphicInstances.map((inst) => (
										<MenuItem key={inst.id} value={inst.id}>
											{inst.name} ({inst.graphicId})
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</CardContent>
					</Card>

					<Stack spacing={1}>
						<Button
							size="small"
							variant="outlined"
							startIcon={<ControlPointDuplicateIcon />}
							onClick={() => gridStore.duplicateSelection({ cloneInstances: false })}
							sx={{ textTransform: 'none' }}
						>
							Duplicate Selection (Same Group)
						</Button>
						<Button
							size="small"
							variant="contained"
							color="primary"
							startIcon={<LayersIcon />}
							onClick={() => gridStore.duplicateSelection({ cloneInstances: true })}
							sx={{ textTransform: 'none' }}
						>
							Duplicate as New Graphic Group
						</Button>
					</Stack>
				</Box>
			)
		}

		if (!singleWidget) return null

		const linkedInstance = gridStore.getInstance(singleWidget.instanceId)
		const graphicInfo = linkedInstance ? serverDataStore.graphicsInfo.get(linkedInstance.graphicId) : undefined
		const manifest = graphicInfo?.graphic
		const customActions: any[] = (manifest as any)?.customActions || (manifest as any)?.actions || []

		// Determine which schema applies for Form Property Hiding
		let formSchema: any = null
		if (singleWidget.type === 'data-form') {
			formSchema = manifest?.schema
		} else if (singleWidget.type === 'custom-action-form') {
			const act = customActions.find((a) => a.id === singleWidget.customActionId) || customActions[0]
			formSchema = act?.schema
		} else if (singleWidget.type === 'target-config' && linkedInstance) {
			formSchema = serverDataStore.renderersInfo.get(linkedInstance.rendererId)?.renderTargetSchema
		}

		const schemaProperties = formSchema ? extractSchemaProperties(formSchema) : []
		const hiddenSet = new Set(singleWidget.hiddenProperties || [])

		const togglePropertyHidden = (propPath: string) => {
			const next = new Set(singleWidget.hiddenProperties || [])
			if (next.has(propPath)) {
				next.delete(propPath)
			} else {
				next.add(propPath)
			}
			gridStore.updateWidget(singleWidget.id, { hiddenProperties: Array.from(next) }, true)
		}

		return (
			<Box sx={{ p: 1.5 }}>
				{/* Top Bar */}
				<Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
					<Chip
						label={singleWidget.type.replace(/-/g, ' ').toUpperCase()}
						size="small"
						color="primary"
						sx={{ fontWeight: 700, fontSize: '0.7rem' }}
					/>
					<Stack direction="row" spacing={0.5}>
						<Tooltip title="Bring to Front">
							<IconButton size="small" onClick={() => gridStore.bringToFront([singleWidget.id])}>
								<FlipToFrontIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="Send to Back">
							<IconButton size="small" onClick={() => gridStore.sendToBack([singleWidget.id])}>
								<FlipToBackIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="Duplicate Widget (Ctrl+D)">
							<IconButton size="small" onClick={() => gridStore.duplicateSelection({ cloneInstances: false })}>
								<ControlPointDuplicateIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="Delete Widget (Del)">
							<IconButton size="small" color="error" onClick={() => gridStore.removeWidgets([singleWidget.id])}>
								<DeleteIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Stack>
				</Stack>

				{/* Graphic Group Binding */}
				<Card variant="outlined" sx={{ mb: 1.5 }}>
					<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
						<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
							Graphic Group Binding
						</Typography>
						<FormControl size="small" fullWidth>
							<InputLabel>Graphic Group</InputLabel>
							<Select
								value={singleWidget.instanceId || ''}
								label="Graphic Group"
								onChange={(e) => {
									const val = e.target.value
									gridStore.updateWidget(singleWidget.id, { instanceId: val || undefined }, true)
								}}
							>
								<MenuItem value="">
									<em>(None)</em>
								</MenuItem>
								{gridStore.graphicInstances.map((inst) => (
									<MenuItem key={inst.id} value={inst.id}>
										{inst.name} ({inst.graphicId})
									</MenuItem>
								))}
							</Select>
						</FormControl>

						{linkedInstance && (
							<Box sx={{ mt: 1 }}>
								<Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
									<Typography variant="caption" color="text.secondary" noWrap>
										Graphic: <strong>{linkedInstance.graphicId}</strong>
									</Typography>
									<Button
										size="small"
										variant="text"
										onClick={() => gridStore.setActiveInspectorInstance(linkedInstance.id)}
										sx={{ textTransform: 'none', py: 0, fontSize: '0.72rem' }}
									>
										Configure Group →
									</Button>
								</Stack>
								<Typography
									variant="caption"
									color="text.secondary"
									display="block"
									sx={{ fontSize: '0.68rem', mt: 0.25 }}
								>
									Server Instance ID: <strong>{linkedInstance.graphicInstanceId || 'Auto-assigned on Load'}</strong>
								</Typography>
							</Box>
						)}
					</CardContent>
				</Card>

				{/* Action Button / Custom Action Button Configuration */}
				{(singleWidget.type === 'action-button' || singleWidget.type === 'custom-action-button') && (
					<Card variant="outlined" sx={{ mb: 1.5 }}>
						<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
							<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
								Command & Action Settings
							</Typography>

							{singleWidget.type === 'action-button' ? (
								<FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
									<InputLabel>Action Command</InputLabel>
									<Select
										value={singleWidget.actionType || 'quickPlay'}
										label="Action Command"
										onChange={(e) => {
											const nextAct = e.target.value as StandardActionType
											gridStore.updateWidget(singleWidget.id, { actionType: nextAct }, true)
										}}
									>
										<MenuItem value="quickPlay">Quick Play (Clear + Load + Play)</MenuItem>
										<MenuItem value="play">Play</MenuItem>
										<MenuItem value="stop">Stop</MenuItem>
										<MenuItem value="load">Load</MenuItem>
										<MenuItem value="update">Update</MenuItem>
										<MenuItem value="clearTarget">Clear Render Target</MenuItem>
										<MenuItem value="clearRenderer">Clear Renderer</MenuItem>
										<MenuItem value="clearAll">Clear All Renderers</MenuItem>
									</Select>
								</FormControl>
							) : (
								<FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
									<InputLabel>Custom Action</InputLabel>
									<Select
										value={singleWidget.customActionId || ''}
										label="Custom Action"
										onChange={(e) => {
											const actId = e.target.value
											const actObj = customActions.find((a) => a.id === actId)
											gridStore.updateWidget(
												singleWidget.id,
												{
													customActionId: actId,
													label: actObj?.name || actId,
												},
												true
											)
										}}
									>
										{customActions.length === 0 && (
											<MenuItem value="" disabled>
												<em>No custom actions defined on this graphic</em>
											</MenuItem>
										)}
										{customActions.map((ca) => (
											<MenuItem key={ca.id} value={ca.id}>
												{ca.name || ca.id} ({ca.id})
											</MenuItem>
										))}
									</Select>
								</FormControl>
							)}

							{/* Multi-Instance Target Selection */}
							{gridStore.graphicInstances.length > 1 && singleWidget.actionType !== 'clearAll' && (
								<Box sx={{ mb: 1.5 }}>
									<Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
										Target Multiple Groups (Batch / Macro)
									</Typography>
									<Box
										sx={{
											maxHeight: 130,
											overflowY: 'auto',
											border: '1px solid',
											borderColor: 'divider',
											borderRadius: 1,
											p: 0.5,
										}}
									>
										{gridStore.graphicInstances.map((inst) => {
											const currentTargets =
												singleWidget.targetInstanceIds && singleWidget.targetInstanceIds.length > 0
													? singleWidget.targetInstanceIds
													: singleWidget.instanceId
														? [singleWidget.instanceId]
														: []
											const isChecked = currentTargets.includes(inst.id)

											return (
												<FormControlLabel
													key={inst.id}
													sx={{ display: 'flex', m: 0, py: 0.1 }}
													control={
														<Checkbox
															size="small"
															checked={isChecked}
															onChange={(e) => {
																const next = new Set(currentTargets)
																if (e.target.checked) next.add(inst.id)
																else next.delete(inst.id)
																const arr = Array.from(next)
																gridStore.updateWidget(
																	singleWidget.id,
																	{
																		targetInstanceIds: arr,
																		instanceId: arr[0] || singleWidget.instanceId,
																	},
																	true
																)
															}}
														/>
													}
													label={
														<Typography variant="caption" noWrap>
															{inst.name}
														</Typography>
													}
												/>
											)
										})}
									</Box>
								</Box>
							)}

							{/* Keyboard Shortcut Assignment */}
							<Box sx={{ mb: 1.5 }}>
								<Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
									Keyboard Hotkey (Live Mode)
								</Typography>
								<Stack direction="row" spacing={1} alignItems="center">
									<Button
										size="small"
										variant={isRecordingHotkey ? 'contained' : 'outlined'}
										color={isRecordingHotkey ? 'warning' : 'primary'}
										startIcon={<KeyboardIcon fontSize="small" />}
										onClick={() => setIsRecordingHotkey(!isRecordingHotkey)}
										sx={{ textTransform: 'none', flexGrow: 1 }}
									>
										{isRecordingHotkey
											? 'Press any key...'
											: singleWidget.hotkey
												? `Key: ${singleWidget.hotkey}`
												: 'Assign Hotkey'}
									</Button>
									{singleWidget.hotkey && (
										<Button
											size="small"
											color="inherit"
											onClick={() => gridStore.updateWidget(singleWidget.id, { hotkey: undefined }, true)}
											sx={{ textTransform: 'none', minWidth: 0 }}
										>
											Clear
										</Button>
									)}
								</Stack>
							</Box>

							{/* Per-Button Preset Override */}
							{linkedInstance && (
								<Box>
									<FormControlLabel
										control={
											<Switch
												size="small"
												checked={Boolean(singleWidget.usePresetData)}
												onChange={(e) => {
													const enabled = e.target.checked
													let defaultPreset = singleWidget.presetData
													if (enabled && defaultPreset === undefined) {
														if (singleWidget.type === 'custom-action-button') {
															const act = customActions.find((a) => a.id === singleWidget.customActionId)
															defaultPreset = act?.schema
																? getDefaultDataFromSchema(act.schema)
																: clone(linkedInstance.customActionData?.[singleWidget.customActionId || ''])
														} else {
															defaultPreset = clone(linkedInstance.graphicData)
														}
													}
													gridStore.updateWidget(
														singleWidget.id,
														{
															usePresetData: enabled,
															presetData: defaultPreset,
														},
														true
													)
												}}
											/>
										}
										label={
											<Typography variant="caption" fontWeight={600}>
												Use Button-Specific Preset Payload
											</Typography>
										}
									/>

									{singleWidget.usePresetData && (
										<Box
											sx={{
												mt: 1,
												p: 1,
												border: '1px solid',
												borderColor: 'divider',
												borderRadius: 1,
												bgcolor: 'background.default',
											}}
										>
											{(() => {
												const presetSchema =
													singleWidget.type === 'custom-action-button'
														? customActions.find((a) => a.id === singleWidget.customActionId)?.schema
														: manifest?.schema
												if (!presetSchema) {
													return (
														<Typography variant="caption" color="text.secondary">
															No schema available for preset data.
														</Typography>
													)
												}
												return (
													<OGrafForm
														key={`preset_${singleWidget.id}`}
														schema={presetSchema}
														value={clone(singleWidget.presetData)}
														onDataChangeCallback={(newData: unknown) => {
															gridStore.updateWidget(singleWidget.id, { presetData: newData }, false)
														}}
													/>
												)
											})()}
										</Box>
									)}
								</Box>
							)}
						</CardContent>
					</Card>
				)}

				{/* Custom Action Form / Custom GUI Specific Selectors */}
				{singleWidget.type === 'custom-action-form' && (
					<Card variant="outlined" sx={{ mb: 1.5 }}>
						<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
							<FormControl size="small" fullWidth sx={{ mb: 1 }}>
								<InputLabel>Custom Action</InputLabel>
								<Select
									value={singleWidget.customActionId || ''}
									label="Custom Action"
									onChange={(e) => gridStore.updateWidget(singleWidget.id, { customActionId: e.target.value }, true)}
								>
									{customActions.map((ca) => (
										<MenuItem key={ca.id} value={ca.id}>
											{ca.name || ca.id}
										</MenuItem>
									))}
								</Select>
							</FormControl>
							<FormControlLabel
								control={
									<Switch
										size="small"
										checked={singleWidget.showTriggerButton !== false}
										onChange={(e) =>
											gridStore.updateWidget(singleWidget.id, { showTriggerButton: e.target.checked }, true)
										}
									/>
								}
								label={<Typography variant="caption">Show Trigger Button in Header</Typography>}
							/>
						</CardContent>
					</Card>
				)}

				{singleWidget.type === 'custom-gui' && linkedInstance && (
					<Card variant="outlined" sx={{ mb: 1.5 }}>
						<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
							<FormControl size="small" fullWidth sx={{ mb: 1 }}>
								<InputLabel>Display Mode</InputLabel>
								<Select
									value={singleWidget.customGuiDisplayMode || 'embedded'}
									label="Display Mode"
									onChange={(e) =>
										gridStore.updateWidget(singleWidget.id, { customGuiDisplayMode: e.target.value }, true)
									}
								>
									<MenuItem value="embedded">Embedded on Grid</MenuItem>
									<MenuItem value="button">Button (Open Floating Dialog)</MenuItem>
								</Select>
							</FormControl>
						</CardContent>
					</Card>
				)}

				{/* Form Options & Schema Property Hide/Reveal */}
				{(singleWidget.type === 'data-form' ||
					singleWidget.type === 'custom-action-form' ||
					singleWidget.type === 'target-config') && (
					<Card variant="outlined" sx={{ mb: 1.5 }}>
						<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
							<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.75}>
								Form Behavior & Layout
							</Typography>

							<Stack spacing={0.25} mb={1.5}>
								{singleWidget.type === 'data-form' && (
									<FormControlLabel
										control={
											<Switch
												size="small"
												checked={Boolean(singleWidget.autoUpdate)}
												onChange={(e) =>
													gridStore.updateWidget(singleWidget.id, { autoUpdate: e.target.checked }, true)
												}
											/>
										}
										label={
											<Typography variant="caption" fontWeight={600}>
												Live Auto-Update on Change
											</Typography>
										}
									/>
								)}
								{singleWidget.type === 'target-config' && (
									<FormControlLabel
										control={
											<Switch
												size="small"
												checked={singleWidget.showRendererSelector !== false}
												onChange={(e) =>
													gridStore.updateWidget(singleWidget.id, { showRendererSelector: e.target.checked }, true)
												}
											/>
										}
										label={<Typography variant="caption">Show Renderer Selector</Typography>}
									/>
								)}
								<FormControlLabel
									control={
										<Switch
											size="small"
											checked={Boolean(singleWidget.compact)}
											onChange={(e) => gridStore.updateWidget(singleWidget.id, { compact: e.target.checked }, true)}
										/>
									}
									label={<Typography variant="caption">Compact Spacing</Typography>}
								/>
								<FormControlLabel
									control={
										<Switch
											size="small"
											checked={Boolean(singleWidget.hideHeader)}
											onChange={(e) => gridStore.updateWidget(singleWidget.id, { hideHeader: e.target.checked }, true)}
										/>
									}
									label={<Typography variant="caption">Hide Widget Header</Typography>}
								/>
								<FormControlLabel
									control={
										<Switch
											size="small"
											checked={Boolean(singleWidget.hideFieldLabels)}
											onChange={(e) =>
												gridStore.updateWidget(singleWidget.id, { hideFieldLabels: e.target.checked }, true)
											}
										/>
									}
									label={<Typography variant="caption">Hide Input Field Labels</Typography>}
								/>
							</Stack>

							<Divider sx={{ my: 1 }} />

							<Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
								<Typography variant="caption" fontWeight={700} color="text.secondary">
									Schema Properties (Reveal / Hide)
								</Typography>
								{schemaProperties.length > 0 && (
									<Stack direction="row" spacing={0.5}>
										<Button
											size="small"
											onClick={() => gridStore.updateWidget(singleWidget.id, { hiddenProperties: [] }, true)}
											sx={{ textTransform: 'none', fontSize: '0.68rem', minWidth: 0, py: 0, px: 0.5 }}
										>
											Show All
										</Button>
										<Button
											size="small"
											onClick={() =>
												gridStore.updateWidget(
													singleWidget.id,
													{
														hiddenProperties: schemaProperties.filter((p) => !p.isObject).map((p) => p.path),
													},
													true
												)
											}
											sx={{ textTransform: 'none', fontSize: '0.68rem', minWidth: 0, py: 0, px: 0.5 }}
										>
											Hide All
										</Button>
									</Stack>
								)}
							</Stack>

							{schemaProperties.length === 0 ? (
								<Typography variant="caption" color="text.disabled">
									No schema properties found.
								</Typography>
							) : (
								<Box
									sx={{
										maxHeight: 220,
										overflowY: 'auto',
										border: '1px solid',
										borderColor: 'divider',
										borderRadius: 1,
										p: 0.5,
									}}
								>
									{schemaProperties.map((prop) => {
										const isHidden = hiddenSet.has(prop.path)
										return (
											<Box
												key={prop.path}
												onClick={() => togglePropertyHidden(prop.path)}
												sx={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													pl: prop.depth * 1.5 + 0.5,
													pr: 0.5,
													py: 0.35,
													borderRadius: 0.75,
													cursor: 'pointer',
													opacity: isHidden ? 0.55 : 1,
													'&:hover': { bgcolor: 'action.hover' },
												}}
											>
												<Box sx={{ minWidth: 0 }}>
													<Typography variant="caption" fontWeight={600} display="block" noWrap>
														{prop.title}
													</Typography>
													<Typography
														variant="caption"
														color="text.secondary"
														sx={{ fontSize: '0.65rem', fontFamily: 'monospace' }}
														noWrap
													>
														{prop.path} ({prop.type})
													</Typography>
												</Box>
												<IconButton size="small" sx={{ p: 0.25 }} color={isHidden ? 'default' : 'primary'}>
													{isHidden ? (
														<VisibilityOffIcon sx={{ fontSize: 16 }} />
													) : (
														<VisibilityIcon sx={{ fontSize: 16 }} />
													)}
												</IconButton>
											</Box>
										)
									})}
								</Box>
							)}
						</CardContent>
					</Card>
				)}

				{/* Appearance & Geometry Card */}
				<Card variant="outlined">
					<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
						<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
							Appearance & Grid Geometry (10px cells)
						</Typography>

						<TextField
							size="small"
							label="Label / Title"
							fullWidth
							value={singleWidget.label ?? ''}
							onChange={(e) => gridStore.updateWidget(singleWidget.id, { label: e.target.value }, false)}
							sx={{ mb: 1.5 }}
						/>

						{(singleWidget.type === 'action-button' ||
							singleWidget.type === 'custom-action-button' ||
							singleWidget.type === 'section-frame') && (
							<>
								<Stack direction="row" spacing={1} mb={1.5} alignItems="center">
									<FormControl size="small" sx={{ flexGrow: 1 }}>
										<InputLabel>Text Size</InputLabel>
										<Select
											value={singleWidget.textSize || 'medium'}
											label="Text Size"
											onChange={(e) => gridStore.updateWidget(singleWidget.id, { textSize: e.target.value }, true)}
										>
											<MenuItem value="small">Small</MenuItem>
											<MenuItem value="medium">Medium</MenuItem>
											<MenuItem value="large">Large</MenuItem>
										</Select>
									</FormControl>

									{singleWidget.type !== 'section-frame' && (
										<FormControl size="small" sx={{ flexGrow: 1 }}>
											<InputLabel>Icon</InputLabel>
											<Select
												value={singleWidget.icon || singleWidget.actionType || 'flash'}
												label="Icon"
												onChange={(e) => gridStore.updateWidget(singleWidget.id, { icon: e.target.value }, true)}
											>
												<MenuItem value="flash">Flash</MenuItem>
												<MenuItem value="play">Play</MenuItem>
												<MenuItem value="stop">Stop</MenuItem>
												<MenuItem value="load">Load</MenuItem>
												<MenuItem value="update">Update</MenuItem>
												<MenuItem value="clear">Clear</MenuItem>
												<MenuItem value="bolt">Bolt</MenuItem>
												<MenuItem value="none">No Icon</MenuItem>
											</Select>
										</FormControl>
									)}
								</Stack>

								<Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
									Color
								</Typography>
								<Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap mb={1.5}>
									{PRESET_COLORS.map((c) => (
										<Box
											key={c}
											onClick={() => gridStore.updateWidget(singleWidget.id, { color: c }, true)}
											sx={{
												width: 22,
												height: 22,
												borderRadius: '50%',
												bgcolor: c,
												cursor: 'pointer',
												border: singleWidget.color === c ? '2px solid #fff' : '1px solid rgba(0,0,0,0.2)',
												boxShadow: singleWidget.color === c ? '0 0 0 2px #1976d2' : 'none',
											}}
										/>
									))}
									<input
										type="color"
										value={singleWidget.color || '#1976d2'}
										onChange={(e) => gridStore.updateWidget(singleWidget.id, { color: e.target.value }, false)}
										style={{ width: 26, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
									/>
								</Stack>
							</>
						)}

						<Stack direction="row" spacing={1}>
							<TextField
								size="small"
								label="X"
								type="number"
								value={singleWidget.x}
								onChange={(e) =>
									gridStore.updateWidget(singleWidget.id, { x: parseInt(e.target.value, 10) || 0 }, true)
								}
							/>
							<TextField
								size="small"
								label="Y"
								type="number"
								value={singleWidget.y}
								onChange={(e) =>
									gridStore.updateWidget(singleWidget.id, { y: parseInt(e.target.value, 10) || 0 }, true)
								}
							/>
							<TextField
								size="small"
								label="W"
								type="number"
								value={singleWidget.w}
								onChange={(e) =>
									gridStore.updateWidget(singleWidget.id, { w: Math.max(3, parseInt(e.target.value, 10) || 3) }, true)
								}
							/>
							<TextField
								size="small"
								label="H"
								type="number"
								value={singleWidget.h}
								onChange={(e) =>
									gridStore.updateWidget(singleWidget.id, { h: Math.max(2, parseInt(e.target.value, 10) || 2) }, true)
								}
							/>
						</Stack>
					</CardContent>
				</Card>
			</Box>
		)
	}

	const renderInstancesTab = () => {
		const activeInst = gridStore.activeInspectorInstance || gridStore.graphicInstances[0] || null
		const activeGraphicInfo = activeInst ? serverDataStore.graphicsInfo.get(activeInst.graphicId) : undefined
		const activeTargetSchema = activeInst
			? serverDataStore.renderersInfo.get(activeInst.rendererId)?.renderTargetSchema
			: undefined
		const availableServerIds = activeInst
			? serverDataStore.getGraphicInstanceIds(activeInst.rendererId, activeInst.renderTarget, activeInst.graphicId)
			: []

		return (
			<Box sx={{ p: 1.5 }}>
				<Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
					<Typography variant="subtitle2" fontWeight={700}>
						Graphic Groups ({gridStore.graphicInstances.length})
					</Typography>
					<Button
						size="small"
						variant="contained"
						startIcon={<AddIcon />}
						onClick={onOpenAddGraphicDialog}
						sx={{ textTransform: 'none' }}
					>
						New Group
					</Button>
				</Stack>
				<Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
					Widgets bind to a Graphic Group. When a graphic is loaded on the server, its new server{' '}
					<code>graphicInstanceId</code> is automatically assigned to the group.
				</Typography>

				{gridStore.graphicInstances.length === 0 ? (
					<Box sx={{ textAlign: 'center', py: 4 }}>
						<Typography variant="body2" color="text.secondary" gutterBottom>
							No Graphic Groups created yet.
						</Typography>
						<Button
							size="small"
							variant="outlined"
							startIcon={<AddIcon />}
							onClick={onOpenAddGraphicDialog}
							sx={{ mt: 1, textTransform: 'none' }}
						>
							Add Graphic from Server
						</Button>
					</Box>
				) : (
					<>
						<Stack spacing={0.75} sx={{ maxHeight: 180, overflowY: 'auto', mb: 1.5 }}>
							{gridStore.graphicInstances.map((inst) => {
								const isSelected = activeInst?.id === inst.id
								const isLoaded = Boolean(inst.graphicInstanceId)

								return (
									<Box
										key={inst.id}
										onClick={() => gridStore.setActiveInspectorInstance(inst.id)}
										sx={{
											p: 1,
											borderRadius: 1.5,
											border: '1px solid',
											borderColor: isSelected ? 'primary.main' : 'divider',
											bgcolor: isSelected ? 'action.selected' : 'background.paper',
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											gap: 1,
											'&:hover': { bgcolor: 'action.hover' },
										}}
									>
										<Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
											<Box
												sx={{
													width: 10,
													height: 10,
													borderRadius: '50%',
													bgcolor: inst.color || '#1976d2',
													flexShrink: 0,
												}}
											/>
											<Box sx={{ minWidth: 0 }}>
												<Typography variant="body2" fontWeight={700} noWrap>
													{inst.name}
												</Typography>
												<Typography variant="caption" color="text.secondary" display="block" noWrap>
													{inst.graphicId} •{' '}
													{inst.graphicInstanceId ? `ID: ${inst.graphicInstanceId}` : inst.rendererId}
												</Typography>
											</Box>
										</Stack>

										<Stack direction="row" spacing={0.5} alignItems="center">
											{isLoaded && (
												<Chip
													label="ON AIR"
													size="small"
													color="success"
													sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
												/>
											)}
											<Tooltip title="Duplicate Group">
												<IconButton
													size="small"
													onClick={(e) => {
														e.stopPropagation()
														gridStore.duplicateGraphicInstance(inst.id)
													}}
												>
													<ControlPointDuplicateIcon sx={{ fontSize: 16 }} />
												</IconButton>
											</Tooltip>
											<Tooltip title="Delete Group">
												<IconButton
													size="small"
													color="error"
													onClick={(e) => {
														e.stopPropagation()
														gridStore.removeGraphicInstance(inst.id, false)
													}}
												>
													<DeleteIcon sx={{ fontSize: 16 }} />
												</IconButton>
											</Tooltip>
										</Stack>
									</Box>
								)
							})}
						</Stack>

						{activeInst && (
							<Card variant="outlined">
								<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
									<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
										Configure Group "{activeInst.name}"
									</Typography>

									<Stack direction="row" spacing={1} mb={1.5} alignItems="center">
										<TextField
											size="small"
											label="Group Name"
											fullWidth
											value={activeInst.name}
											onChange={(e) => gridStore.updateGraphicInstance(activeInst.id, { name: e.target.value }, false)}
										/>
										<input
											type="color"
											value={activeInst.color || '#1976d2'}
											onChange={(e) => gridStore.updateGraphicInstance(activeInst.id, { color: e.target.value }, false)}
											style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
										/>
									</Stack>

									{/* Bound Server Graphic Instance ID */}
									<FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
										<InputLabel>Assigned Server Instance ID</InputLabel>
										<Select
											value={activeInst.graphicInstanceId || ''}
											label="Assigned Server Instance ID"
											displayEmpty
											onChange={(e) => {
												const val = e.target.value
												gridStore.updateGraphicInstance(activeInst.id, { graphicInstanceId: val || undefined }, false)
											}}
										>
											<MenuItem value="">
												<em>Auto-assign on Load (Currently Not Loaded)</em>
											</MenuItem>
											{activeInst.graphicInstanceId && !availableServerIds.includes(activeInst.graphicInstanceId) && (
												<MenuItem value={activeInst.graphicInstanceId}>{activeInst.graphicInstanceId}</MenuItem>
											)}
											{availableServerIds.map((srvId) => (
												<MenuItem key={srvId} value={srvId}>
													{srvId} (Active on Server)
												</MenuItem>
											))}
										</Select>
									</FormControl>

									{/* Quick test actions */}
									<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mb={1.5}>
										<Button
											size="small"
											variant="contained"
											startIcon={<FlashOnIcon />}
											onClick={() => void GridControllerAPI.performQuickPlay(activeInst)}
											sx={{ textTransform: 'none', py: 0.25 }}
										>
											Quick Play
										</Button>
										<Button
											size="small"
											variant="contained"
											color="success"
											startIcon={<PlayArrowIcon />}
											onClick={() => void GridControllerAPI.performAction(activeInst, 'play')}
											sx={{ textTransform: 'none', py: 0.25 }}
										>
											Play
										</Button>
										<Button
											size="small"
											variant="outlined"
											color="error"
											startIcon={<StopIcon />}
											onClick={() => void GridControllerAPI.performAction(activeInst, 'stop')}
											sx={{ textTransform: 'none', py: 0.25 }}
										>
											Stop
										</Button>
									</Stack>

									{/* Spawn widgets for this group */}
									<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
										Add Widget for "{activeInst.name}"
									</Typography>
									<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mb={1.5}>
										<Button
											size="small"
											variant="outlined"
											startIcon={<DynamicFormIcon />}
											onClick={() =>
												gridStore.addWidget({
													type: 'data-form',
													instanceId: activeInst.id,
												})
											}
											sx={{ textTransform: 'none', fontSize: '0.72rem' }}
										>
											+ Data Form
										</Button>
										<Button
											size="small"
											variant="outlined"
											startIcon={<SmartButtonIcon />}
											onClick={() =>
												gridStore.addWidget({
													type: 'action-button',
													actionType: 'quickPlay',
													instanceId: activeInst.id,
													label: `${activeInst.name} — Quick Play`,
												})
											}
											sx={{ textTransform: 'none', fontSize: '0.72rem' }}
										>
											+ Action Button
										</Button>
									</Stack>

									<Divider sx={{ my: 1 }} />

									{/* Target Renderer */}
									<FormControl size="small" fullWidth sx={{ mt: 1, mb: 1.5 }}>
										<InputLabel>Target Renderer</InputLabel>
										<Select
											value={activeInst.rendererId || ''}
											label="Target Renderer"
											onChange={(e) => {
												const newRId = e.target.value
												const newSchema = serverDataStore.renderersInfo.get(newRId)?.renderTargetSchema
												gridStore.updateGraphicInstance(
													activeInst.id,
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

									{activeTargetSchema && (
										<Box sx={{ mb: 1.5 }}>
											<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
												Render Target
											</Typography>
											<OGrafForm
												key={`inst_target_${activeInst.id}_${activeInst.rendererId}`}
												schema={activeTargetSchema}
												value={clone(activeInst.renderTarget)}
												onDataChangeCallback={(newData: unknown) => {
													gridStore.updateGraphicInstance(activeInst.id, { renderTarget: newData }, false)
												}}
											/>
										</Box>
									)}

									{activeGraphicInfo?.graphic.schema && (
										<Box>
											<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
												Live Data Payload
											</Typography>
											<OGrafForm
												key={`inst_data_${activeInst.id}`}
												schema={activeGraphicInfo.graphic.schema}
												value={clone(activeInst.graphicData)}
												onDataChangeCallback={(newData: unknown) => {
													gridStore.updateGraphicInstance(activeInst.id, { graphicData: newData }, false)
												}}
											/>
										</Box>
									)}
								</CardContent>
							</Card>
						)}
					</>
				)}
			</Box>
		)
	}

	const renderPaletteTab = () => {
		const targetInst =
			gridStore.activeInspectorInstance ||
			(singleWidget?.instanceId ? gridStore.getInstance(singleWidget.instanceId) : undefined) ||
			gridStore.graphicInstances[0]

		const paletteItems = [
			{
				label: 'Data Form (ograf-form)',
				desc: 'Input fields for graphic schema (supports hiding specific properties)',
				icon: <DynamicFormIcon color="primary" />,
				onClick: () => gridStore.addWidget({ type: 'data-form', instanceId: targetInst?.id }),
			},
			{
				label: 'Quick Play Button',
				desc: 'Clears target, loads, and plays the graphic in one click',
				icon: <FlashOnIcon sx={{ color: '#1976d2' }} />,
				onClick: () =>
					gridStore.addWidget({
						type: 'action-button',
						actionType: 'quickPlay',
						label: 'Quick Play',
						color: '#1976d2',
						icon: 'flash',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Play Button',
				desc: 'Triggers Play on the graphic instance',
				icon: <PlayArrowIcon sx={{ color: '#2e7d32' }} />,
				onClick: () =>
					gridStore.addWidget({
						type: 'action-button',
						actionType: 'play',
						label: 'Play',
						color: '#2e7d32',
						icon: 'play',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Stop Button',
				desc: 'Triggers Stop on the graphic instance',
				icon: <StopIcon sx={{ color: '#d32f2f' }} />,
				onClick: () =>
					gridStore.addWidget({
						type: 'action-button',
						actionType: 'stop',
						label: 'Stop',
						color: '#d32f2f',
						icon: 'stop',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Update Button',
				desc: 'Sends current form data payload to the live graphic',
				icon: <SmartButtonIcon sx={{ color: '#9c27b0' }} />,
				onClick: () =>
					gridStore.addWidget({
						type: 'action-button',
						actionType: 'update',
						label: 'Update',
						color: '#9c27b0',
						icon: 'update',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Custom Action Button',
				desc: 'Triggers a custom action defined by the graphic',
				icon: <BoltIcon sx={{ color: '#0288d1' }} />,
				onClick: () =>
					gridStore.addWidget({
						type: 'custom-action-button',
						color: '#0288d1',
						icon: 'bolt',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Custom Action Form',
				desc: 'ograf-form for custom action payload + trigger button',
				icon: <DynamicFormIcon sx={{ color: '#0288d1' }} />,
				onClick: () =>
					gridStore.addWidget({
						type: 'custom-action-form',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Render Target Config',
				desc: 'Change renderer & renderTarget properties on the grid',
				icon: <TuneIcon color="secondary" />,
				onClick: () =>
					gridStore.addWidget({
						type: 'target-config',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Custom GUI Component',
				desc: 'Embed a graphic custom HTML element on the grid',
				icon: <WebAssetIcon color="primary" />,
				onClick: () =>
					gridStore.addWidget({
						type: 'custom-gui',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Live Status Indicator',
				desc: 'Displays graphic instance name, target, and ON AIR badge',
				icon: <RadioButtonCheckedIcon color="success" />,
				onClick: () =>
					gridStore.addWidget({
						type: 'status-badge',
						instanceId: targetInst?.id,
					}),
			},
			{
				label: 'Section Frame / Label',
				desc: 'Background container frame to organize controls visually',
				icon: <CropFreeIcon color="action" />,
				onClick: () =>
					gridStore.addWidget({
						type: 'section-frame',
						label: targetInst?.name || 'Section',
						instanceId: targetInst?.id,
					}),
			},
		]

		return (
			<Box sx={{ p: 1.5 }}>
				<Button
					variant="contained"
					fullWidth
					startIcon={<AddIcon />}
					onClick={onOpenAddGraphicDialog}
					sx={{ mb: 2, textTransform: 'none', fontWeight: 700 }}
				>
					Add Graphic Kit from Server...
				</Button>

				<Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
					Add Individual Control Widget
				</Typography>

				<Stack spacing={1}>
					{paletteItems.map((item) => (
						<Card
							key={item.label}
							variant="outlined"
							onClick={item.onClick}
							sx={{
								cursor: 'pointer',
								transition: 'all 0.15s',
								'&:hover': {
									borderColor: 'primary.main',
									bgcolor: 'action.hover',
								},
							}}
						>
							<CardContent
								sx={{ p: 1.25, '&:last-child': { pb: 1.25 }, display: 'flex', gap: 1.25, alignItems: 'center' }}
							>
								{item.icon}
								<Box sx={{ minWidth: 0 }}>
									<Typography variant="body2" fontWeight={700}>
										{item.label}
									</Typography>
									<Typography variant="caption" color="text.secondary" display="block">
										{item.desc}
									</Typography>
								</Box>
							</CardContent>
						</Card>
					))}
				</Stack>
			</Box>
		)
	}

	return (
		<Box
			sx={{
				width: { xs: 320, sm: 360, md: 390 },
				height: '100%',
				borderLeft: '1px solid',
				borderColor: 'divider',
				bgcolor: 'background.paper',
				display: 'flex',
				flexDirection: 'column',
				flexShrink: 0,
				zIndex: 50,
			}}
		>
			<Tabs
				value={gridStore.sidebarTab}
				onChange={(_e, val) => gridStore.setSidebarTab(val)}
				variant="fullWidth"
				sx={{
					minHeight: 40,
					borderBottom: '1px solid',
					borderColor: 'divider',
					'& .MuiTab-root': {
						minHeight: 40,
						py: 0.5,
						textTransform: 'none',
						fontWeight: 700,
						fontSize: '0.8rem',
					},
				}}
			>
				<Tab value="inspector" label="Inspector" />
				<Tab value="instances" label={`Groups (${gridStore.graphicInstances.length})`} />
				<Tab value="palette" label="+ Widgets" />
			</Tabs>

			<Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
				{gridStore.sidebarTab === 'inspector' && renderInspectorTab()}
				{gridStore.sidebarTab === 'instances' && renderInstancesTab()}
				{gridStore.sidebarTab === 'palette' && renderPaletteTab()}
			</Box>
		</Box>
	)
})
