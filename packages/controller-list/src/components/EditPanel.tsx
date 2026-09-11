import * as React from 'react'
import { observer } from 'mobx-react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

import FlashOnIcon from '@mui/icons-material/FlashOn'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ControlPointDuplicateIcon from '@mui/icons-material/ControlPointDuplicate'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'

import { getDefaultDataFromSchema } from 'ograf-form'
import { OGrafForm } from './OGrafForm.js'
import { GraphicsListAPI } from '../lib/graphicsListApi.js'
import { graphicsListStore } from '../stores/graphicsList.js'
import { serverDataStore } from '../stores/serverData.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { clone, isEqual } from '../lib/lib.js'

export const EditPanel = observer(function EditPanel() {
	const selectedIds = graphicsListStore.selectedIds
	const selectedGroup = graphicsListStore.selectedGroup
	const selectedItems = graphicsListStore.selectedItems
	const singleSelectedItem = selectedIds.length === 1 && !selectedGroup ? graphicsListStore.selectedItem : null

	const [isEditingGroupName, setIsEditingGroupName] = React.useState(false)
	const [groupNameInput, setGroupNameInput] = React.useState('')

	React.useEffect(() => {
		if (selectedGroup) {
			setGroupNameInput(selectedGroup.name)
		}
	}, [selectedGroup])

	// Determine active renderer for top bar clear actions
	const currentRendererId =
		singleSelectedItem?.rendererId ||
		(selectedItems.length > 0 ? selectedItems[0].rendererId : null) ||
		appSettingsStore.getSelectedRendererId() ||
		serverDataStore.renderersList[0]?.id

	const currentRenderer = serverDataStore.renderersList.find((r) => r.id === currentRendererId)
	const currentRendererName = currentRenderer?.name || currentRendererId

	const topBar = (
		<Box
			sx={{
				p: 0.75,
				px: 1,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				borderBottom: 1,
				borderColor: 'divider',
				bgcolor: 'background.paper',
				gap: 1,
				flexWrap: 'wrap',
			}}
		>
			<Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
				Inspector & Actions
			</Typography>
			<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
				{serverDataStore.renderersList.length > 1 && currentRendererId && (
					<Tooltip title={`Clear all graphics on renderer "${currentRendererName}" (id: ${currentRendererId})`}>
						<Button
							size="small"
							variant="outlined"
							color="warning"
							startIcon={<DeleteSweepIcon />}
							onClick={() => {
								void GraphicsListAPI.clearAll(currentRendererId)
							}}
						>
							Clear "{currentRendererName}"
						</Button>
					</Tooltip>
				)}
				<Tooltip title="Clear ALL graphics on all renderers (no filters)">
					<Button
						size="small"
						variant="contained"
						color="error"
						startIcon={<DeleteSweepIcon />}
						onClick={() => {
							void GraphicsListAPI.clearAllRenderers()
						}}
					>
						CLEAR ALL
					</Button>
				</Tooltip>
			</Stack>
		</Box>
	)

	const renderContent = () => {
		// 1. Empty State
		if (selectedIds.length === 0) {
			return (
				<Box
					sx={{
						p: 1.5,
						height: '100%',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						textAlign: 'center',
					}}
				>
					<Typography variant="h6" color="text.secondary" gutterBottom>
						No Item Selected
					</Typography>
					<Typography variant="body2" color="text.disabled" sx={{ maxWidth: 360 }}>
						Select an item or group from the rundown to edit its properties or execute commands. You can also use
						Shift+Click or Ctrl+Click for multi-selection.
					</Typography>
				</Box>
			)
		}

		// 2. Group or Multi-Selection View
		if (selectedGroup || selectedIds.length > 1 || (!singleSelectedItem && selectedItems.length > 0)) {
			const distinctRenderers = Array.from(new Set(selectedItems.map((i) => i.rendererId)))
			const commonRendererId = distinctRenderers.length === 1 ? distinctRenderers[0] : null
			const renderTargetSchema = commonRendererId
				? serverDataStore.renderersInfo.get(commonRendererId)?.renderTargetSchema
				: null

			const shouldShowRendererSelector =
				distinctRenderers.length > 1 ||
				serverDataStore.renderersList.length > 1 ||
				(serverDataStore.renderersList.length === 1 &&
					distinctRenderers.some((rId) => rId !== serverDataStore.renderersList[0].id))

			const commonRenderTarget = selectedItems[0]?.renderTarget
			const allRenderTargetsEqual =
				selectedItems.length > 0 && selectedItems.every((i) => isEqual(i.renderTarget, commonRenderTarget))

			const handleBatchAction = async (actionId: string) => {
				if (selectedItems.length > 0) {
					await GraphicsListAPI.performBatchAction(selectedItems, actionId)
				}
			}

			const handleBatchQuickPlay = async () => {
				if (selectedItems.length > 0) {
					await GraphicsListAPI.performBatchQuickPlay(selectedItems)
				}
			}

			const handleSaveGroupName = () => {
				if (selectedGroup) {
					graphicsListStore.renameGroup(selectedGroup.id, groupNameInput)
					setIsEditingGroupName(false)
				}
			}

			return (
				<Box sx={{ p: 1 }}>
					{/* Header */}
					<Box sx={{ mb: 2 }}>
						{selectedGroup ? (
							<Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
								<FolderIcon color="primary" sx={{ fontSize: 28 }} />
								{isEditingGroupName ? (
									<TextField
										size="small"
										value={groupNameInput}
										autoFocus
										onChange={(e) => setGroupNameInput(e.target.value)}
										onBlur={handleSaveGroupName}
										onKeyDown={(e) => {
											if (e.key === 'Enter') handleSaveGroupName()
											if (e.key === 'Escape') setIsEditingGroupName(false)
										}}
									/>
								) : (
									<Stack direction="row" alignItems="center" spacing={1}>
										<Typography variant="h5" fontWeight={700}>
											{selectedGroup.name}
										</Typography>
										<Tooltip title="Rename group">
											<Button size="small" startIcon={<EditIcon />} onClick={() => setIsEditingGroupName(true)}>
												Rename
											</Button>
										</Tooltip>
									</Stack>
								)}
								<Chip label={`${selectedGroup.items?.length || 0} items`} size="small" variant="outlined" />
							</Stack>
						) : (
							<Stack direction="row" alignItems="center" spacing={1}>
								<Typography variant="h5" fontWeight={700}>
									Multi-Selection
								</Typography>
								<Chip label={`${selectedItems.length} items`} size="small" color="primary" />
								<Button
									size="small"
									variant="outlined"
									startIcon={<FolderIcon />}
									onClick={() => graphicsListStore.groupSelected()}
								>
									Group Selected
								</Button>
							</Stack>
						)}
					</Box>

					{/* Batch Actions Card */}
					<Card sx={{ mb: 2 }} variant="outlined">
						<CardContent>
							<Typography variant="subtitle2" gutterBottom fontWeight={600}>
								Batch Actions ({selectedItems.length} items targeted)
							</Typography>
							<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
								<Tooltip title="Clear + Load + Play all targeted items (Shift+F2)">
									<Button
										size="small"
										variant="contained"
										color="primary"
										startIcon={<FlashOnIcon />}
										onClick={() => {
											void handleBatchQuickPlay()
										}}
										disabled={selectedItems.length === 0}
									>
										Quick Play All
									</Button>
								</Tooltip>

								<Tooltip title="Play all targeted items (F2)">
									<Button
										size="small"
										variant="contained"
										color="success"
										startIcon={<PlayArrowIcon />}
										onClick={() => {
											void handleBatchAction('play')
										}}
										disabled={selectedItems.length === 0}
									>
										Play All
									</Button>
								</Tooltip>

								<Tooltip title="Load all targeted items (F3)">
									<Button
										size="small"
										variant="outlined"
										startIcon={<RefreshIcon />}
										onClick={() => {
											void handleBatchAction('load')
										}}
										disabled={selectedItems.length === 0}
									>
										Load All
									</Button>
								</Tooltip>

								<Tooltip title="Update all targeted items (F6)">
									<Button
										size="small"
										variant="outlined"
										color="secondary"
										startIcon={<SyncIcon />}
										onClick={() => {
											void handleBatchAction('update')
										}}
										disabled={selectedItems.length === 0}
									>
										Update All
									</Button>
								</Tooltip>

								<Tooltip title="Stop all targeted items (F1)">
									<Button
										size="small"
										variant="outlined"
										color="error"
										startIcon={<StopIcon />}
										onClick={() => {
											void handleBatchAction('stop')
										}}
										disabled={selectedItems.length === 0}
									>
										Stop All
									</Button>
								</Tooltip>

								<Tooltip title="Clear distinct render targets of targeted items">
									<Button
										size="small"
										variant="outlined"
										color="warning"
										onClick={() => {
											void handleBatchAction('clear')
										}}
										disabled={selectedItems.length === 0}
									>
										Clear Targets
									</Button>
								</Tooltip>
							</Stack>
						</CardContent>
					</Card>

					{/* Target & Renderer Batch Configuration */}
					{selectedItems.length > 0 && (shouldShowRendererSelector || renderTargetSchema) && (
						<Card sx={{ mb: 2 }} variant="outlined">
							<CardContent>
								<Typography variant="subtitle2" gutterBottom fontWeight={600}>
									Target Configuration ({selectedItems.length} items)
								</Typography>

								{/* Renderer Selector (only if multiple options or multiple renderers selected) */}
								{shouldShowRendererSelector && (
									<Box sx={{ mt: 1.5 }}>
										<Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
											Renderer
										</Typography>
										<FormControl size="small" sx={{ minWidth: 220, width: '100%', maxWidth: 350 }}>
											<InputLabel id="batch-select-renderer-label">Target Renderer</InputLabel>
											<Select
												labelId="batch-select-renderer-label"
												id="batch-select-renderer"
												value={distinctRenderers.length === 1 ? distinctRenderers[0] : '__MULTIPLE__'}
												label="Target Renderer"
												onChange={(e) => {
													const newRendererId = e.target.value
													if (newRendererId && newRendererId !== '__MULTIPLE__') {
														const newSchema = serverDataStore.renderersInfo.get(newRendererId)?.renderTargetSchema
														const defaultTarget = newSchema ? getDefaultDataFromSchema(newSchema) : undefined
														graphicsListStore.updateMultipleItems(
															selectedItems.map((i) => i.id),
															{
																rendererId: newRendererId,
																renderTarget: clone(defaultTarget),
															}
														)
													}
												}}
											>
												{distinctRenderers.length > 1 && (
													<MenuItem value="__MULTIPLE__" disabled>
														<em>(Multiple: {distinctRenderers.join(', ')})</em>
													</MenuItem>
												)}
												{serverDataStore.renderersList.map((renderer) => (
													<MenuItem key={renderer.id} value={renderer.id}>
														{renderer.name || renderer.id} ({renderer.id})
													</MenuItem>
												))}
											</Select>
										</FormControl>
									</Box>
								)}

								{/* Render Target Form */}
								{renderTargetSchema && (
									<Box sx={{ mt: shouldShowRendererSelector ? 2.5 : 1 }}>
										<Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
											<Typography variant="caption" color="text.secondary" fontWeight={600}>
												Render Target
											</Typography>
											{!allRenderTargetsEqual && (
												<Chip
													label="Multiple values"
													size="small"
													color="warning"
													variant="outlined"
													sx={{ height: 20, fontSize: '0.7rem' }}
												/>
											)}
										</Stack>
										{!allRenderTargetsEqual && (
											<Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.78rem' }}>
												Selected items currently have different render targets. Editing below will update all{' '}
												{selectedItems.length} items to the same target:
											</Typography>
										)}
										<OGrafForm
											key={`batch_target_${commonRendererId || 'none'}_${allRenderTargetsEqual ? JSON.stringify(commonRenderTarget) : 'multiple'}_${selectedItems.map((i) => i.id).join('_')}`}
											value={
												allRenderTargetsEqual ? clone(commonRenderTarget) : getDefaultDataFromSchema(renderTargetSchema)
											}
											schema={renderTargetSchema}
											onDataChangeCallback={(data: unknown) => {
												graphicsListStore.updateMultipleItems(
													selectedItems.map((i) => i.id),
													{ renderTarget: data }
												)
											}}
										/>
									</Box>
								)}

								{distinctRenderers.length > 1 && (
									<Box sx={{ mt: 2 }}>
										<Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
											Render Target
										</Typography>
										<Chip
											label="Multiple renderers selected"
											size="small"
											color="default"
											variant="outlined"
											sx={{ mb: 0.5 }}
										/>
										<Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
											Select a common renderer above to configure render targets for all selected items.
										</Typography>
									</Box>
								)}
							</CardContent>
						</Card>
					)}

					{/* Group Actions (if group selected) */}
					{selectedGroup && (
						<Card sx={{ mb: 2 }} variant="outlined">
							<CardContent>
								<Typography variant="subtitle2" gutterBottom fontWeight={600}>
									Group Management
								</Typography>
								<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
									<Button
										size="small"
										variant="outlined"
										startIcon={<FolderOpenIcon />}
										onClick={() => graphicsListStore.ungroup(selectedGroup.id)}
									>
										Ungroup
									</Button>
									<Button
										size="small"
										variant="outlined"
										startIcon={<ControlPointDuplicateIcon />}
										onClick={() => graphicsListStore.duplicateGroup(selectedGroup.id)}
									>
										Duplicate Group
									</Button>
									<Button
										size="small"
										variant="outlined"
										color="error"
										startIcon={<DeleteIcon />}
										onClick={() => graphicsListStore.removeItem(selectedGroup.id)}
									>
										Delete Group
									</Button>
								</Stack>
							</CardContent>
						</Card>
					)}
				</Box>
			)
		}

		// 3. Single Item Editing View
		if (!singleSelectedItem) return null

		const handleAction = async (actionId: string, e: React.MouseEvent) => {
			e.stopPropagation()
			if (singleSelectedItem) {
				await GraphicsListAPI.performAction(singleSelectedItem, actionId)
			}
		}

		const handleQuickPlay = async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (singleSelectedItem) {
				await GraphicsListAPI.performQuickPlay(singleSelectedItem)
			}
		}

		const graphicInfo = serverDataStore.graphicsInfo.get(singleSelectedItem.graphicId)

		if (!graphicInfo) {
			return (
				<Box sx={{ p: 1 }}>
					<Typography>Loading graphic schema for "{singleSelectedItem.graphicId}"...</Typography>
				</Box>
			)
		}

		return (
			<Box sx={{ p: 1 }}>
				<Box sx={{ mb: 2 }}>
					<Typography variant="h5" fontWeight={700} gutterBottom>
						{singleSelectedItem.graphicId}
					</Typography>
					{(serverDataStore.renderersList.length > 1 ||
						(serverDataStore.renderersList.length === 1 &&
							singleSelectedItem.rendererId !== serverDataStore.renderersList[0].id)) && (
						<FormControl size="small" sx={{ mt: 1, minWidth: 200 }}>
							<InputLabel id="select-renderer-label">Target Renderer</InputLabel>
							<Select
								labelId="select-renderer-label"
								id="select-renderer"
								value={singleSelectedItem.rendererId}
								label="Target Renderer"
								onChange={(e) => {
									graphicsListStore.updateItemData(singleSelectedItem.id, {
										rendererId: e.target.value,
									})
								}}
							>
								{serverDataStore.renderersList.map((renderer) => (
									<MenuItem key={renderer.id} value={renderer.id}>
										{renderer.name || renderer.id} ({renderer.id})
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
				</Box>

				{/* Actions Card */}
				<Card sx={{ mb: 2 }} variant="outlined">
					<CardContent>
						<Typography variant="subtitle2" gutterBottom fontWeight={600}>
							Actions
						</Typography>
						<Stack direction="row" spacing={1} justifyContent="flex-start" flexWrap="wrap" useFlexGap>
							<Tooltip title="Quick Play: Clear + Load + Play (Shift+F2)">
								<Button
									size="small"
									variant="contained"
									color="primary"
									startIcon={<FlashOnIcon />}
									onClick={(e) => {
										void handleQuickPlay(e)
									}}
								>
									Quick Play
								</Button>
							</Tooltip>

							<Tooltip title="F3">
								<Button
									size="small"
									variant="outlined"
									onClick={(e) => {
										void handleAction('load', e)
									}}
								>
									Load
								</Button>
							</Tooltip>

							<Tooltip title="F2">
								<Button
									size="small"
									variant="contained"
									color="success"
									onClick={(e) => {
										void handleAction('play', e)
									}}
								>
									Play
								</Button>
							</Tooltip>

							<Tooltip title="F6">
								<Button
									size="small"
									variant="outlined"
									color="secondary"
									onClick={(e) => {
										void handleAction('update', e)
									}}
								>
									Update
								</Button>
							</Tooltip>

							<Tooltip title="F1">
								<Button
									size="small"
									variant="outlined"
									color="error"
									onClick={(e) => {
										void handleAction('stop', e)
									}}
								>
									Stop
								</Button>
							</Tooltip>

							<Tooltip title="Clear all graphics on selected renderTarget">
								<Button
									size="small"
									variant="outlined"
									color="warning"
									onClick={(e) => {
										void handleAction('clear', e)
									}}
								>
									Clear Target
								</Button>
							</Tooltip>
						</Stack>
					</CardContent>
				</Card>

				{/* Custom Actions Card (only if custom actions exist) */}
				{(() => {
					const customActions = (graphicInfo.graphic as any).customActions || (graphicInfo.graphic as any).actions || []
					if (!Array.isArray(customActions) || customActions.length === 0) return null

					return (
						<Card sx={{ mb: 2 }} variant="outlined">
							<CardContent>
								<Typography variant="subtitle2" gutterBottom fontWeight={600}>
									Custom Actions
								</Typography>
								<Stack spacing={2} sx={{ mt: 1 }}>
									{customActions.map((action: any) => (
										<Box key={action.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
											<Stack
												direction="row"
												justifyContent="space-between"
												alignItems="center"
												mb={action.schema || action.description ? 1 : 0}
											>
												<Box>
													<Typography variant="body2" fontWeight={600}>
														{action.name || action.id}
													</Typography>
													{action.description && (
														<Typography variant="caption" color="text.secondary">
															{action.description}
														</Typography>
													)}
												</Box>
												<Button
													size="small"
													variant="outlined"
													color="primary"
													onClick={(e) => {
														void handleAction(action.id, e)
													}}
												>
													Trigger {action.name || action.id}
												</Button>
											</Stack>

											{action.schema && (
												<Box sx={{ mt: 1 }}>
													<OGrafForm
														key={`custom_action_${singleSelectedItem.id}_${action.id}`}
														value={clone(singleSelectedItem.customActionData?.[action.id])}
														schema={action.schema}
														onDataChangeCallback={(newData: unknown) => {
															graphicsListStore.updateItemData(singleSelectedItem.id, {
																customActionData: {
																	...singleSelectedItem.customActionData,
																	[action.id]: newData,
																},
															})
														}}
													/>
												</Box>
											)}
										</Box>
									))}
								</Stack>
							</CardContent>
						</Card>
					)
				})()}

				{/* Render Target Form */}
				{serverDataStore.renderersInfo.get(singleSelectedItem.rendererId)?.renderTargetSchema && (
					<Card sx={{ mb: 2 }} variant="outlined">
						<CardContent>
							<Typography variant="subtitle2" gutterBottom fontWeight={600}>
								Render Target
							</Typography>
							<OGrafForm
								key={`target_${singleSelectedItem.id}_${singleSelectedItem.rendererId}`}
								value={clone(singleSelectedItem.renderTarget)}
								schema={serverDataStore.renderersInfo.get(singleSelectedItem.rendererId)?.renderTargetSchema}
								onDataChangeCallback={(data: unknown) => {
									graphicsListStore.updateItemData(singleSelectedItem.id, { renderTarget: data })
								}}
							/>
						</CardContent>
					</Card>
				)}

				{/* Data Payload Form */}
				<Card variant="outlined">
					<CardContent>
						<Typography variant="subtitle2" gutterBottom fontWeight={600}>
							Data Payload
						</Typography>
						<OGrafForm
							key={`data_${singleSelectedItem.id}_${singleSelectedItem.graphicId}`}
							value={clone(singleSelectedItem.graphicData)}
							schema={graphicInfo.graphic.schema}
							onDataChangeCallback={(data: unknown) => {
								graphicsListStore.updateItemData(singleSelectedItem.id, { graphicData: data })
							}}
						/>
					</CardContent>
				</Card>
			</Box>
		)
	}

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
			{topBar}
			<Box sx={{ flexGrow: 1, overflowY: 'auto' }}>{renderContent()}</Box>
		</Box>
	)
})
