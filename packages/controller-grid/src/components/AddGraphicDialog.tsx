import * as React from 'react'
import { observer } from 'mobx-react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import AddIcon from '@mui/icons-material/Add'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import LayersIcon from '@mui/icons-material/Layers'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic'

import { serverDataStore } from '../stores/serverData.js'
import { appSettingsStore } from '../stores/appSettings.js'
import { gridStore, GraphicKitPreset } from '../stores/gridStore.js'
import { pickAppropriateThumbnail, getGraphicThumbnailUrl, DEFAULT_TARGET_RESOLUTION } from '../lib/thumbnailUtils.js'
import { UploadGraphicDialog } from './UploadGraphicDialog.js'
import { uploadGraphicZip } from '../lib/uploadGraphic.js'

export interface AddGraphicDialogProps {
	open: boolean
	onClose: () => void
	targetCell?: { x: number; y: number }
}

export const AddGraphicDialog: React.FC<AddGraphicDialogProps> = observer(({ open, onClose, targetCell }) => {
	const [searchQuery, setSearchQuery] = React.useState('')
	const [kitPreset, setKitPreset] = React.useState<GraphicKitPreset>('full-kit')
	const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)
	const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({})
	const [isFileDragging, setIsFileDragging] = React.useState(false)
	const [isUploading, setIsUploading] = React.useState(false)
	const dragCounterRef = React.useRef(0)

	React.useEffect(() => {
		if (open) {
			setImageErrors({})
			setSearchQuery('')
			setIsFileDragging(false)
			setIsUploading(false)
			dragCounterRef.current = 0
			void serverDataStore.triggerReloadData(true)
			for (const g of serverDataStore.graphicsList) {
				if (!serverDataStore.graphicsInfo.has(g.id)) {
					void serverDataStore.loadGraphic(g.id, true)
				}
			}
		}
	}, [open])

	const handleFileDragEnter = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			e.stopPropagation()
			dragCounterRef.current++
			setIsFileDragging(true)
		}
	}

	const handleFileDragOver = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			e.stopPropagation()
			e.dataTransfer.dropEffect = 'copy'
		}
	}

	const handleFileDragLeave = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			e.stopPropagation()
			dragCounterRef.current--
			if (dragCounterRef.current <= 0) {
				dragCounterRef.current = 0
				setIsFileDragging(false)
			}
		}
	}

	const handleFileDrop = (e: React.DragEvent) => {
		if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
			e.preventDefault()
			e.stopPropagation()
			dragCounterRef.current = 0
			setIsFileDragging(false)

			const files = Array.from(e.dataTransfer.files || [])
			const zipFiles = files.filter((f) => f.name.toLowerCase().endsWith('.zip'))

			if (zipFiles.length === 0) {
				gridStore.showError('Please drop a valid .zip graphic package.')
				return
			}

			if (!serverDataStore.severIsOurs) {
				gridStore.showError('Connected server does not support graphic uploads.')
				return
			}

			setIsUploading(true)
			for (const file of zipFiles) {
				gridStore.showNotification(`Uploading ${file.name}...`, 'info')
				uploadGraphicZip(file, false)
					.then((uploadedIds) => {
						const msg =
							uploadedIds.length > 0
								? `Successfully uploaded: ${uploadedIds.join(', ')}`
								: `Uploaded ${file.name} successfully.`
						gridStore.showNotification(msg, 'success')
						void serverDataStore.triggerReloadData(true)
						for (const id of uploadedIds) {
							void serverDataStore.loadGraphic(id, true)
						}
					})
					.catch((err: unknown) => {
						const errMsg = err instanceof Error ? err.message : 'Upload error occurred'
						gridStore.showError(`Failed to upload ${file.name}: ${errMsg}`)
					})
					.finally(() => {
						setIsUploading(false)
					})
			}
		}
	}

	const handleAdd = async (graphicId: string, graphicName?: string) => {
		try {
			await gridStore.addGraphicWithKit(graphicId, kitPreset, targetCell)
			gridStore.showNotification(`Added "${graphicName || graphicId}" (${kitPreset}) to grid`, 'success')
			onClose()
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Error adding graphic'
			gridStore.showError(`Failed to add graphic: ${errMsg}`)
		}
	}

	const serverUrl = appSettingsStore.serverApiUrl

	const filteredGraphics = React.useMemo(() => {
		const q = searchQuery.trim().toLowerCase()
		if (!q) return serverDataStore.graphicsList

		return serverDataStore.graphicsList.filter((g) => {
			const manifest = serverDataStore.graphicsInfo.get(g.id)?.graphic
			const name = (manifest?.name || g.name || '').toLowerCase()
			const id = g.id.toLowerCase()
			const description = (manifest?.description || g.description || '').toLowerCase()
			const author = (manifest?.author?.name || '').toLowerCase()

			return name.includes(q) || id.includes(q) || description.includes(q) || author.includes(q)
		})
	}, [searchQuery, serverDataStore.graphicsList, serverDataStore.graphicsInfo])

	return (
		<>
			<Dialog
				open={open}
				onClose={isUploading ? undefined : onClose}
				maxWidth="md"
				fullWidth
				slotProps={{
					paper: {
						onDragEnter: handleFileDragEnter,
						onDragOver: handleFileDragOver,
						onDragLeave: handleFileDragLeave,
						onDrop: handleFileDrop,
						sx: {
							minHeight: '70vh',
							maxHeight: '90vh',
							display: 'flex',
							flexDirection: 'column',
							position: 'relative',
						},
					},
				}}
			>
				{isFileDragging && (
					<Box
						sx={{
							position: 'absolute',
							inset: 0,
							zIndex: 2000,
							bgcolor: (theme) =>
								theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.35)' : 'rgba(25, 118, 210, 0.2)',
							backdropFilter: 'blur(4px)',
							border: '3px dashed',
							borderColor: 'primary.main',
							borderRadius: 1,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							pointerEvents: 'none',
						}}
					>
						<CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 1.5 }} />
						<Typography variant="h5" fontWeight={700} color="primary.main">
							Drop .zip graphic package to upload
						</Typography>
					</Box>
				)}

				{isUploading && (
					<Box
						sx={{
							position: 'absolute',
							inset: 0,
							zIndex: 2001,
							bgcolor: 'rgba(0, 0, 0, 0.5)',
							backdropFilter: 'blur(2px)',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 2,
						}}
					>
						<CircularProgress color="primary" size={48} />
						<Typography variant="subtitle1" fontWeight={600} color="#fff">
							Uploading graphic package...
						</Typography>
					</Box>
				)}

				<DialogTitle
					sx={{
						m: 0,
						p: 2,
						pb: 1.5,
						display: 'flex',
						flexDirection: 'column',
						gap: 1.5,
						borderBottom: '1px solid',
						borderColor: 'divider',
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
							<LayersIcon color="primary" />
							<Typography variant="h6" component="span" fontWeight={600}>
								Add Graphic Controls to Grid
							</Typography>
							<Chip
								label={`${serverDataStore.graphicsList.length} available`}
								size="small"
								variant="outlined"
								color="default"
								sx={{ fontWeight: 500, fontSize: '0.75rem' }}
							/>
						</Box>

						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
							{serverDataStore.severIsOurs && (
								<Button
									variant="outlined"
									size="small"
									startIcon={<CloudUploadIcon />}
									onClick={() => setUploadDialogOpen(true)}
								>
									Upload (.zip)
								</Button>
							)}
							<IconButton aria-label="close" onClick={onClose} size="small">
								<CloseIcon />
							</IconButton>
						</Box>
					</Box>

					<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
						<TextField
							size="small"
							placeholder="Search graphics by name, id, author..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							sx={{ flexGrow: 1 }}
							autoFocus
							slotProps={{
								input: {
									startAdornment: (
										<InputAdornment position="start">
											<SearchIcon fontSize="small" color="action" />
										</InputAdornment>
									),
									endAdornment: searchQuery ? (
										<InputAdornment position="end">
											<IconButton size="small" onClick={() => setSearchQuery('')}>
												<ClearIcon fontSize="small" />
											</IconButton>
										</InputAdornment>
									) : null,
								},
							}}
						/>

						<ToggleButtonGroup
							size="small"
							exclusive
							value={kitPreset}
							onChange={(_e, val) => {
								if (val) setKitPreset(val)
							}}
							sx={{ flexShrink: 0 }}
						>
							<ToggleButton value="full-kit" sx={{ textTransform: 'none', px: 1.25 }}>
								Full Kit (Form + Buttons)
							</ToggleButton>
							<ToggleButton value="compact-kit" sx={{ textTransform: 'none', px: 1.25 }}>
								Compact Kit
							</ToggleButton>
							<ToggleButton value="buttons-only" sx={{ textTransform: 'none', px: 1.25 }}>
								Buttons Only
							</ToggleButton>
							<ToggleButton value="instance-only" sx={{ textTransform: 'none', px: 1.25 }}>
								Group Only
							</ToggleButton>
						</ToggleButtonGroup>
					</Stack>
				</DialogTitle>

				<DialogContent sx={{ p: 3, flexGrow: 1, bgcolor: 'background.default' }}>
					{filteredGraphics.length > 0 ? (
						<Box
							sx={{
								display: 'grid',
								gridTemplateColumns: {
									xs: '1fr',
									sm: 'repeat(2, 1fr)',
									md: 'repeat(3, 1fr)',
								},
								gap: 2,
							}}
						>
							{filteredGraphics.map((g) => {
								const info = serverDataStore.graphicsInfo.get(g.id)
								const manifest = info?.graphic
								const displayName = manifest?.name || g.name || g.id
								const description = manifest?.description || g.description || ''
								const authorName = manifest?.author?.name

								const bestThumbnail = pickAppropriateThumbnail(manifest?.thumbnails, DEFAULT_TARGET_RESOLUTION)
								const hasThumbnail = Boolean(bestThumbnail?.file) && !imageErrors[g.id]
								const thumbnailUrl =
									hasThumbnail && bestThumbnail ? getGraphicThumbnailUrl(serverUrl, g.id, bestThumbnail.file) : null

								const resWidth = bestThumbnail?.resolution?.width
								const resHeight = bestThumbnail?.resolution?.height

								return (
									<Card
										key={g.id}
										elevation={1}
										sx={{
											display: 'flex',
											flexDirection: 'column',
											borderRadius: 2,
											overflow: 'hidden',
											transition: 'all 0.2s ease-in-out',
											border: '1px solid',
											borderColor: 'divider',
											'&:hover': {
												elevation: 4,
												transform: 'translateY(-2px)',
												borderColor: 'primary.main',
												boxShadow: 4,
											},
										}}
									>
										<CardActionArea
											onClick={() => void handleAdd(g.id, displayName)}
											sx={{
												display: 'flex',
												flexDirection: 'column',
												alignItems: 'stretch',
												flexGrow: 1,
												justifyContent: 'flex-start',
												p: 0,
											}}
										>
											<Box
												sx={{
													width: '100%',
													aspectRatio: '16/9',
													position: 'relative',
													bgcolor: 'action.hover',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													overflow: 'hidden',
													borderBottom: '1px solid',
													borderColor: 'divider',
												}}
											>
												{thumbnailUrl ? (
													<Box
														component="img"
														src={thumbnailUrl}
														alt={displayName}
														onError={() => {
															setImageErrors((prev) => ({ ...prev, [g.id]: true }))
														}}
														sx={{
															width: '100%',
															height: '100%',
															objectFit: 'contain',
															bgcolor: 'background.paper',
														}}
													/>
												) : (
													<Box
														sx={{
															display: 'flex',
															flexDirection: 'column',
															alignItems: 'center',
															justifyContent: 'center',
															gap: 1,
															p: 2,
															color: 'text.secondary',
															width: '100%',
															height: '100%',
															background:
																'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(156, 39, 176, 0.08) 100%)',
														}}
													>
														<AutoAwesomeMosaicIcon sx={{ fontSize: 40, opacity: 0.5, color: 'primary.main' }} />
														<Typography variant="caption" color="text.disabled" fontWeight={500}>
															No thumbnail preview
														</Typography>
													</Box>
												)}

												{hasThumbnail && resWidth && resHeight && (
													<Box
														sx={{
															position: 'absolute',
															bottom: 6,
															right: 6,
															bgcolor: 'rgba(0, 0, 0, 0.65)',
															color: '#fff',
															px: 0.75,
															py: 0.2,
															borderRadius: 1,
															fontSize: '0.65rem',
															fontWeight: 600,
														}}
													>
														{resWidth}×{resHeight}
													</Box>
												)}
											</Box>

											<CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
												<Typography variant="subtitle1" fontWeight={600} lineHeight={1.25} gutterBottom noWrap>
													{displayName}
												</Typography>

												<Typography
													variant="caption"
													color="text.disabled"
													sx={{ fontFamily: 'monospace', display: 'block', mb: 0.75 }}
													noWrap
												>
													{g.id}
												</Typography>

												{description && (
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{
															fontSize: '0.8rem',
															display: '-webkit-box',
															WebkitLineClamp: 2,
															WebkitBoxOrient: 'vertical',
															overflow: 'hidden',
															mb: 1,
															minHeight: '2.4em',
														}}
													>
														{description}
													</Typography>
												)}

												<Box
													sx={{
														mt: 'auto',
														pt: 1,
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'space-between',
													}}
												>
													{authorName ? (
														<Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
															<PersonOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
															<Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem' }}>
																{authorName}
															</Typography>
														</Stack>
													) : (
														<Box />
													)}

													<Button
														size="small"
														variant="contained"
														color="primary"
														startIcon={<AddIcon sx={{ fontSize: 16 }} />}
														onClick={(e) => {
															e.stopPropagation()
															void handleAdd(g.id, displayName)
														}}
														sx={{
															textTransform: 'none',
															fontSize: '0.75rem',
															py: 0.3,
															px: 1.25,
															minWidth: 'auto',
															borderRadius: 1.5,
														}}
													>
														Add
													</Button>
												</Box>
											</CardContent>
										</CardActionArea>
									</Card>
								)
							})}
						</Box>
					) : (
						<Box
							sx={{
								textAlign: 'center',
								py: 8,
								px: 2,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<LayersIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
							{serverDataStore.graphicsList.length === 0 ? (
								<>
									<Typography variant="h6" color="text.secondary" gutterBottom>
										No graphics available on the server
									</Typography>
									<Typography variant="body2" color="text.disabled" sx={{ mb: 2, maxWidth: 400 }}>
										Make sure the OGraf server is running and templates are installed.
									</Typography>
									{serverDataStore.severIsOurs && (
										<Button
											variant="contained"
											startIcon={<CloudUploadIcon />}
											onClick={() => setUploadDialogOpen(true)}
										>
											Upload Graphic (.zip)
										</Button>
									)}
								</>
							) : (
								<>
									<Typography variant="h6" color="text.secondary" gutterBottom>
										No matching graphics
									</Typography>
									<Button variant="outlined" size="small" onClick={() => setSearchQuery('')}>
										Clear Search
									</Button>
								</>
							)}
						</Box>
					)}
				</DialogContent>

				<DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
					<Button onClick={onClose} color="inherit">
						Close
					</Button>
				</DialogActions>
			</Dialog>

			<UploadGraphicDialog
				open={uploadDialogOpen}
				onClose={() => {
					setUploadDialogOpen(false)
					void serverDataStore.triggerReloadData(true)
				}}
			/>
		</>
	)
})
