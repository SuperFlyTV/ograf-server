import * as React from 'react'
import { observer } from 'mobx-react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { graphicsListStore } from '../stores/graphicsList.js'
import { uploadGraphicZip } from '../lib/uploadGraphic.js'

export interface UploadGraphicDialogProps {
	open: boolean
	onClose: () => void
}

export const UploadGraphicDialog: React.FC<UploadGraphicDialogProps> = observer(({ open, onClose }) => {
	const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
	const [isUploading, setIsUploading] = React.useState(false)
	const [uploadResult, setUploadResult] = React.useState<{ success: boolean; message: string } | null>(null)
	const [isDragging, setIsDragging] = React.useState(false)

	const fileInputRef = React.useRef<HTMLInputElement>(null)

	React.useEffect(() => {
		if (open) {
			setSelectedFile(null)
			setIsUploading(false)
			setUploadResult(null)
			setIsDragging(false)
		}
	}, [open])

	const handleFileSelect = (file: File | null) => {
		if (!file) return
		if (!file.name.toLowerCase().endsWith('.zip')) {
			setUploadResult({ success: false, message: 'Please select a valid .zip archive.' })
			return
		}
		setSelectedFile(file)
		setUploadResult(null)
	}

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(true)
	}

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(false)
	}

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(false)
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			handleFileSelect(e.dataTransfer.files[0])
		}
	}

	const handleUpload = async () => {
		if (!selectedFile) return
		setIsUploading(true)
		setUploadResult(null)

		try {
			const uploadedIds = await uploadGraphicZip(selectedFile, false)
			const msg =
				uploadedIds.length > 0
					? `Successfully uploaded: ${uploadedIds.join(', ')}`
					: 'Graphic package uploaded successfully.'
			setUploadResult({ success: true, message: msg })
			graphicsListStore.showNotification(msg, 'success')
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Network error occurred during upload'
			setUploadResult({ success: false, message: `Upload error: ${errMsg}` })
			graphicsListStore.showError(`Upload error: ${errMsg}`)
		} finally {
			setIsUploading(false)
		}
	}

	return (
		<Dialog open={open} onClose={isUploading ? undefined : onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<CloudUploadIcon color="primary" />
					<Typography variant="h6" component="span" fontWeight={600}>
						Upload Graphic (.zip)
					</Typography>
				</Box>
				<IconButton aria-label="close" onClick={onClose} disabled={isUploading} size="small">
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers sx={{ p: 3 }}>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					To upload an OGraf graphic template to the server, create a <strong>.zip</strong> archive of the graphic
					package folder and select or drop it below:
				</Typography>

				<input
					ref={fileInputRef}
					type="file"
					accept=".zip"
					style={{ display: 'none' }}
					onChange={(e) => {
						if (e.target.files && e.target.files.length > 0) {
							handleFileSelect(e.target.files[0])
						}
					}}
				/>

				<Box
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					onClick={() => fileInputRef.current?.click()}
					sx={{
						border: '2px dashed',
						borderColor: isDragging ? 'primary.main' : selectedFile ? 'success.main' : 'divider',
						borderRadius: 2,
						p: 3,
						textAlign: 'center',
						cursor: 'pointer',
						bgcolor: isDragging ? 'action.hover' : 'background.paper',
						transition: 'all 0.2s ease-in-out',
						'&:hover': {
							borderColor: 'primary.main',
							bgcolor: 'action.hover',
						},
					}}
				>
					<CloudUploadIcon sx={{ fontSize: 44, color: selectedFile ? 'success.main' : 'primary.main', mb: 1 }} />
					{selectedFile ? (
						<Box>
							<Typography variant="subtitle1" fontWeight={600} color="text.primary">
								{selectedFile.name}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{(selectedFile.size / 1024).toFixed(1)} KB — Click or drop another .zip to replace
							</Typography>
						</Box>
					) : (
						<Box>
							<Typography variant="subtitle1" fontWeight={500}>
								Drag & drop a .zip file here, or click to browse
							</Typography>
							<Typography variant="caption" color="text.secondary">
								Accepts .zip graphic bundles
							</Typography>
						</Box>
					)}
				</Box>

				{uploadResult && (
					<Alert
						severity={uploadResult.success ? 'success' : 'error'}
						sx={{ mt: 2 }}
						icon={uploadResult.success ? <CheckCircleOutlineIcon fontSize="inherit" /> : undefined}
					>
						{uploadResult.message}
					</Alert>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} disabled={isUploading} color="inherit">
					{uploadResult?.success ? 'Close' : 'Cancel'}
				</Button>
				<Button
					variant="contained"
					onClick={() => void handleUpload()}
					disabled={!selectedFile || isUploading}
					startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
				>
					{isUploading ? 'Uploading...' : 'Upload'}
				</Button>
			</DialogActions>
		</Dialog>
	)
})
