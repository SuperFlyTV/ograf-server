import * as React from 'react'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import { getServerUrl } from '../lib/lib.js'

export const Introduction: React.FC<{
	namespaceId: string
	onReset: () => void
}> = ({ namespaceId, onReset }) => {
	const [rendererName, setRendererName] = useState('Renderer-window')
	const [rendererId, setRendererId] = useState('1')
	const [background, setBackground] = useState('transparent')

	const serverUrl = getServerUrl()
	const ografApiUrl = `${serverUrl}/api/${namespaceId}/ograf/v1/`
	const rendererUrl = `${serverUrl}/renderer/${namespaceId}/default/?name=${encodeURIComponent(rendererName)}&id=${encodeURIComponent(rendererId)}&background=${encodeURIComponent(background)}`
	const controllerUrl = `${serverUrl}/controller/${namespaceId}/default/`

	return (
		<Box sx={{ py: 3 }}>
			<Box>
				<Typography
					variant="h3"
					sx={{
						fontSize: '2.5rem',
						fontWeight: 'bold',
						color: '#1976d2',
						mb: 2,
						wordBreak: 'break-all',
					}}
				>
					{namespaceId}
				</Typography>
				<Typography variant="h6" sx={{ mt: 2, color: 'warning.main' }}>
					This is your namespace, don't lose it!
				</Typography>
				<Box sx={{ mt: 2 }}>
					<Button variant="outlined" color="secondary" onClick={onReset}>
						Register Another Namespace
					</Button>
				</Box>
			</Box>

			<Grid container spacing={2}>
				<Grid size={6}>
					<Card>
						{/* OGraf API */}
						<CardContent>
							<Typography variant="h5" component="h3" sx={{ mb: 2 }}>
								OGraf API
							</Typography>
							<Typography variant="body1" sx={{ mb: 1 }}>
								Your ograf API is accessible at:
							</Typography>
							<UrlLink url={ografApiUrl} />

							<Typography variant="body2" sx={{ mt: 2 }}>
								Link to&nbsp;
								<Link href="https://ograf.ebu.io/v1/specification/docs/Specification_Server_API.html" target="_blank">
									OGraf Server API specification
								</Link>
							</Typography>
						</CardContent>

						{/* Controller Link */}
						<CardContent>
							<Typography variant="h5" component="h3" sx={{ mb: 2 }}>
								Controller
							</Typography>
							<Typography variant="body1" sx={{ mb: 2 }}>
								Link to Controller:
							</Typography>
							<UrlLink url={controllerUrl} />
						</CardContent>
					</Card>
				</Grid>
				<Grid size={6}>
					{/* Renderer Configuration */}
					<Card>
						<CardContent>
							<Typography variant="h5" component="h3" sx={{ mb: 2 }}>
								Renderer
							</Typography>
							<Typography variant="body1" sx={{ mb: 2 }}>
								Renderer configuration:
							</Typography>

							<Stack spacing={2}>
								<TextField
									label="Name"
									value={rendererName}
									onChange={(e) => setRendererName(e.target.value)}
									fullWidth
								/>
								<TextField label="Id" value={rendererId} onChange={(e) => setRendererId(e.target.value)} fullWidth />
								<FormControl>
									<InputLabel id="background-label">Background</InputLabel>
									<Select
										labelId="background-label"
										value={background}
										label="Background"
										onChange={(e) => setBackground(e.target.value)}
									>
										<MenuItem value="transparent">Transparent</MenuItem>
										<MenuItem value="checkerboard">Checkerboard</MenuItem>
										<MenuItem value="black">Black</MenuItem>
										<MenuItem value="white">White</MenuItem>
										<MenuItem value="red">Red</MenuItem>
										<MenuItem value="green">Green</MenuItem>
										<MenuItem value="blue">Blue</MenuItem>
									</Select>
								</FormControl>

								<Box>
									<Typography variant="body2" sx={{ mb: 1 }}>
										Renderer URL:
									</Typography>
									<UrlLink url={rendererUrl} />
								</Box>
							</Stack>
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Box>
	)
}
const UrlLink: React.FC<{ url: string }> = ({ url }) => {
	return (
		<Typography variant="body1" sx={{ mb: 1 }}>
			<Link
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				sx={{
					display: 'block',
					p: 2,
					border: '1px solid',
					borderColor: 'divider',
					borderRadius: 1,
					bgcolor: 'background.paper',
					fontFamily: 'monospace',
					wordBreak: 'break-all',
					textDecoration: 'none',
					color: 'primary.main',
					'&:hover': {
						bgcolor: 'action.hover',
						borderColor: 'primary.main',
					},
				}}
			>
				{url}
			</Link>
			<Typography variant="caption" color="text.secondary">
				(Click to open)
			</Typography>
		</Typography>
	)
}
