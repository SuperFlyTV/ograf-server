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
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import { getServerUrl } from '../lib/lib.js'

export const NoNameSpaceIntro: React.FC = () => {
	const [rendererName, setRendererName] = useState('Renderer-window')
	const [rendererId, setRendererId] = useState('1')
	const [background, setBackground] = useState('transparent')
	const [webcam, setWebcam] = useState('')

	const serverUrl = getServerUrl()
	const ografApiUrl = `${serverUrl}/api/ograf/v1/`
	const rendererUrl = `${serverUrl}/renderer/default/?name=${encodeURIComponent(rendererName)}&id=${encodeURIComponent(rendererId)}&background=${encodeURIComponent(background)}${background === 'webcam' && webcam ? `&webcam=${encodeURIComponent(webcam)}` : ''}`
	const controllerUrl = `${serverUrl}/controller/default/`
	const controllerListUrl = `${serverUrl}/controller/list/`
	const controllerGridUrl = `${serverUrl}/controller/grid/`
	const controllerAiAudioUrl = `${serverUrl}/controller/ai-audio/`

	return (
		<Box sx={{ py: 3 }}>
			{/* <Box sx={{ mb: 4 }}>
				<Typography variant="h4" component="h2" sx={{ mb: 2 }}>
					Welcome to OGraf Server
				</Typography>
				<Typography variant="body1" sx={{ mb: 2 }}>
					This is a web server that provides:
				</Typography>
				<List sx={{ listStyleType: 'disc', pl: 4, mb: 2 }}>
					<ListItem sx={{ display: 'list-item' }}>
						<Typography variant="body1">
							An <strong>OGraf Renderer</strong> (a web page) to be loaded in a HTML renderer (such as CasparCG, OBS, vMix, etc).
						</Typography>
					</ListItem>
					<ListItem sx={{ display: 'list-item' }}>
						<Typography variant="body1">
							An API where <strong>OGraf Graphics</strong> can be uploaded, managed, and controlled.
						</Typography>
					</ListItem>
					<ListItem sx={{ display: 'list-item' }}>
						<Typography variant="body1">
							A simple <strong>Controller web page</strong> to control OGraf graphics.
						</Typography>
					</ListItem>
				</List>
				<Typography variant="body1">
					For more information, please visit the{' '}
					<Link href="https://ograf.ebu.io" target="_blank" rel="noopener noreferrer">
						official OGraf documentation
					</Link>.
				</Typography>
			</Box> */}

			{/* <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
				How to use
			</Typography>
			<List sx={{ pl: 2, counterReset: 'item', listStyle: 'none', mb: 4 }}>
				<ListItem sx={{ display: 'list-item', listStyleType: 'decimal', '&::marker': { fontWeight: 'bold' }, mb: 2 }}>
					<Typography variant="body1">
						<strong>Upload OGraf Graphics</strong> by zipping the OGraf graphic folders and uploading via the API Explorer or Controller.
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
						You can find example OGraf Graphics{' '}
						<Link href="https://github.com/ebu/ograf/tree/main/v1/examples" target="_blank" rel="noopener noreferrer">
							here
						</Link>{' '}
						(
						<Link
							href="https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2Febu%2Fograf%2Ftree%2Fmain%2Fv1%2Fexamples"
							target="_blank"
							rel="noopener noreferrer"
						>
							download zip file
						</Link>
						)
					</Typography>
				</ListItem>
				<ListItem sx={{ display: 'list-item', listStyleType: 'decimal', '&::marker': { fontWeight: 'bold' }, mb: 2 }}>
					<Typography variant="body1">
						<strong>Open an OGraf Renderer</strong> in your HTML renderer (such as CasparCG, OBS, vMix, etc).
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
						Use the configured URL from the Renderer Configuration below.
					</Typography>
					<List sx={{ listStyleType: 'disc', pl: 4, mt: 1 }}>
						<ListItem sx={{ display: 'list-item' }}>
							<Typography variant="body2" component="div">
								CasparCG command:
								<Box component="pre" sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, mt: 1, overflow: 'auto', fontSize: '0.875rem' }}>
									PLAY 1-10 [html] {rendererUrl}
								</Box>
							</Typography>
						</ListItem>
					</List>
				</ListItem>
				<ListItem sx={{ display: 'list-item', listStyleType: 'decimal', '&::marker': { fontWeight: 'bold' }, mb: 2 }}>
					<Typography variant="body1">
						<strong>Connect your controller</strong> (or use the included{' '}
						<Link href={controllerUrl} target="_blank" rel="noopener noreferrer">Simple Controller</Link>
						{' or '}
						<Link href={controllerListUrl} target="_blank" rel="noopener noreferrer">List Controller</Link>)
					</Typography>
				</ListItem>
				<ListItem sx={{ display: 'list-item', listStyleType: 'decimal', '&::marker': { fontWeight: 'bold' } }}>
					<Typography variant="body1">
						<strong>Explore the API</strong> using the{' '}
						<Link href="/public/open-api/docs/index.html" target="_blank" rel="noopener noreferrer">API Explorer</Link>
					</Typography>
				</ListItem>
			</List> */}

			<Grid container spacing={2}>
				<Grid size={6}>
					<Card>
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

						<CardContent>
							<Typography variant="h5" component="h3" sx={{ mb: 1.5 }}>
								Controllers
							</Typography>
							<Grid container spacing={1}>
								<Grid size={{ xs: 12, sm: 6 }}>
									<ControllerCard
										name="Simple Controller"
										description="Basic control, graphic upload, and API command log."
										url={controllerUrl}
									/>
								</Grid>
								<Grid size={{ xs: 12, sm: 6 }}>
									<ControllerCard
										name="List Controller"
										description="Organize and play graphics in rundown lists."
										url={controllerListUrl}
									/>
								</Grid>
								<Grid size={{ xs: 12, sm: 6 }}>
									<ControllerCard
										name="Grid Controller"
										description="Customizable button grid for quick triggering."
										url={controllerGridUrl}
									/>
								</Grid>
								<Grid size={{ xs: 12, sm: 6 }}>
									<ControllerCard
										name="AI Audio Controller"
										description="Live audio listening with real-time AI graphic suggestions."
										url={controllerAiAudioUrl}
									/>
								</Grid>
							</Grid>
						</CardContent>
					</Card>
				</Grid>
				<Grid size={6}>
					<Card>
						<CardContent>
							<Typography variant="h5" component="h3" sx={{ mb: 2 }}>
								Renderer Configuration
							</Typography>
							<Typography variant="body1" sx={{ mb: 2 }}>
								Configure your renderer url:
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
										<MenuItem value="webcam">Webcam</MenuItem>
										<MenuItem value="black">Black</MenuItem>
										<MenuItem value="white">White</MenuItem>
										<MenuItem value="red">Red</MenuItem>
										<MenuItem value="green">Green</MenuItem>
										<MenuItem value="blue">Blue</MenuItem>
									</Select>
								</FormControl>
								{background === 'webcam' ? (
									<TextField
										label="Webcam (index, name, id, or -1 to list)"
										value={webcam}
										onChange={(e) => setWebcam(e.target.value)}
										fullWidth
									/>
								) : null}

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

const ControllerCard: React.FC<{ name: string; description: string; url: string }> = ({ name, description, url }) => {
	return (
		<Card
			variant="outlined"
			sx={{
				height: '100%',
				'&:hover': {
					bgcolor: 'action.hover',
					borderColor: 'primary.main',
				},
			}}
		>
			<CardActionArea
				component="a"
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				sx={{
					height: '100%',
					p: 1.25,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					justifyContent: 'flex-start',
					textAlign: 'left',
				}}
			>
				<Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold', mb: 0.25 }}>
					{name}
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
					{description}
				</Typography>
			</CardActionArea>
		</Card>
	)
}
