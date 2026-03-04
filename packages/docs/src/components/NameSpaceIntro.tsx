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
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import { getServerUrl } from '../lib/lib.js'
import { RegisterForm } from './RegisterForm.js'


export const NameSpaceIntro: React.FC = () => {
	const [namespaceId, setNamespaceId] = React.useState<string | null>(null)

	React.useEffect(() => {
		const storedNamespaceId = localStorage.getItem('namespaceId')
		if (storedNamespaceId) setNamespaceId(storedNamespaceId)
	}, [])

	return (
		<>
			<Box sx={{ textAlign: 'center', mb: 3 }}>
				{namespaceId ? (
					<Introduction
						namespaceId={namespaceId}
						onReset={() => {
							setNamespaceId(null)
							localStorage.removeItem('namespaceId')
						}}
					/>
				) : (
					<RegisterForm
						setNamespaceId={(namespaceId) => {
							setNamespaceId(namespaceId)
							localStorage.setItem('namespaceId', namespaceId)
						}}
					/>
				)}
			</Box>
		</>
	)
}

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
			<Box sx={{ mb: 4 }}>
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
			</Box>

			<Typography variant="h4" component="h2" sx={{ mb: 2 }}>
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
						<Link href={controllerUrl} target="_blank" rel="noopener noreferrer">Simple Controller</Link>)
					</Typography>
				</ListItem>
				<ListItem sx={{ display: 'list-item', listStyleType: 'decimal', '&::marker': { fontWeight: 'bold' } }}>
					<Typography variant="body1">
						<strong>Explore the API</strong> using the{' '}
						<Link href="/public/open-api/docs/index.html" target="_blank" rel="noopener noreferrer">API Explorer</Link>
					</Typography>
				</ListItem>
			</List>

			<Box sx={{ mb: 4, textAlign: 'center' }}>
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
