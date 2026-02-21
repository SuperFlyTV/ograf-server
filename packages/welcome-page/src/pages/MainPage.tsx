import * as React from 'react'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'

export const MainPage: React.FC = () => {
	return (
		<Container maxWidth="lg" sx={{ py: 4 }}>
			<Stack spacing={3}>
				<Card>
					<CardContent>
						<Box sx={{ textAlign: 'center', mb: 3 }}>
							<img src="/public/assets/ograf_logo_colour_draft.svg" alt="OGraf" height="50" />
							<Typography variant="h3" component="h1" sx={{ mt: 2 }}>
								Simple Rendering System
							</Typography>
						</Box>

						<Typography variant="body1" paragraph>
							This is an Open Source project developed with ❤️ by{' '}
							<Link href="https://SuperFly.tv" target="_blank" rel="noopener noreferrer">
								<img
									src="/public/assets/SuperFly.tv_Logo_2020_v02.png"
									alt="SuperFly.tv"
									height="50"
									style={{ verticalAlign: 'middle' }}
								/>
							</Link>
						</Typography>
						<Typography variant="body1" paragraph>
							Feel free to contribute features, bug fixes or report issues at{' '}
							<Link href="https://github.com/SuperFlyTV/ograf-server" target="_blank" rel="noopener noreferrer">
								github.com/SuperFlyTV/ograf-server
							</Link>
							.
						</Typography>

						<Typography variant="h4" component="h2" sx={{ mt: 3, mb: 2 }}>
							What is this?
						</Typography>
						<Typography variant="body1" paragraph>
							This is a web server that provides:
						</Typography>
						<List sx={{ listStyleType: 'disc', pl: 4 }}>
							<ListItem sx={{ display: 'list-item' }}>
								<Typography variant="body1">
									An <strong>OGraf Renderer</strong> (a web page) to be loaded in a HTML renderer (such as CasparCG,
									OBS, Vmix, etc),
								</Typography>
							</ListItem>
							<ListItem sx={{ display: 'list-item' }}>
								<Typography variant="body1">
									An API where <strong>OGraf Graphics</strong> can be uploaded and managed.
								</Typography>
							</ListItem>
							<ListItem sx={{ display: 'list-item' }}>
								<Typography variant="body1">
									An API that can be used by a <strong>Controller</strong> to control the OGraf graphics.
								</Typography>
							</ListItem>
							<ListItem sx={{ display: 'list-item' }}>
								<Typography variant="body1">
									A simple <strong>Controller web page</strong> to control OGraf graphics.
								</Typography>
							</ListItem>
						</List>

						<Typography variant="h4" component="h2" sx={{ mt: 4, mb: 2 }}>
							How to use
						</Typography>
						<List sx={{ pl: 2, counterReset: 'item', listStyle: 'none' }}>
							<ListItem
								sx={{
									display: 'list-item',
									listStyleType: 'decimal',
									'&::marker': { fontWeight: 'bold' },
									mb: 2,
								}}
							>
								<Typography variant="body1">
									<strong>Upload OGraf Graphics</strong> by zipping the OGraf graphic folders.
								</Typography>
								<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
									You can find example OGraf Graphics{' '}
									<Link
										href="https://github.com/ebu/ograf/tree/main/v1/examples"
										target="_blank"
										rel="noopener noreferrer"
									>
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
							<ListItem
								sx={{
									display: 'list-item',
									listStyleType: 'decimal',
									'&::marker': { fontWeight: 'bold' },
									mb: 2,
								}}
							>
								<Typography variant="body1">
									<strong>Open an OGraf Renderer</strong> in your HTML renderer (such as CasparCG, OBS, Vmix, etc).
								</Typography>
								<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
									Use the URL:{' '}
									<Link
										href="http://localhost:8080/renderer/renderer-layer/index.html?name=Renderer-window&id=1&background=1"
										target="_blank"
										rel="noopener noreferrer"
									>
										http://localhost:8080/renderer/renderer-layer/index.html
									</Link>
								</Typography>
								<List sx={{ listStyleType: 'disc', pl: 4, mt: 1 }}>
									<ListItem sx={{ display: 'list-item' }}>
										<Typography variant="body2" component="div">
											CasparCG command:
											<Box
												component="pre"
												sx={{
													bgcolor: 'grey.100',
													p: 1,
													borderRadius: 1,
													mt: 1,
													overflow: 'auto',
													fontSize: '0.875rem',
												}}
											>
												PLAY 1-10 [html] http://localhost:8080/renderer/renderer-layer/index.html
											</Box>
										</Typography>
									</ListItem>
								</List>
							</ListItem>
							<ListItem
								sx={{
									display: 'list-item',
									listStyleType: 'decimal',
									'&::marker': { fontWeight: 'bold' },
									mb: 2,
								}}
							>
								<Typography variant="body1">
									Connect your controller (or use the included{' '}
									<strong>
										<Link href="/controller/index.html">Simple Controller</Link>
									</strong>
									)
								</Typography>
							</ListItem>
							<ListItem
								sx={{
									display: 'list-item',
									listStyleType: 'decimal',
									'&::marker': { fontWeight: 'bold' },
								}}
							>
								<Typography variant="body1">
									Explore the API using the{' '}
									<strong>
										<Link href="/public/open-api/docs/index.html">API Explorer</Link>
									</strong>
								</Typography>
							</ListItem>
						</List>
					</CardContent>
				</Card>

				<Card>
					<CardContent>
						<Typography variant="h4" component="h2" gutterBottom>
							Explore the API
						</Typography>
						<List>
							<ListItem sx={{ display: 'list-item', listStyleType: 'disc', ml: 2 }}>
								<Box>
									<Link href="/ograf/v1/graphics">List Graphics</Link>
									<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
										Lists the Graphics that are currently uploaded to the system
									</Typography>
								</Box>
							</ListItem>
							<ListItem sx={{ display: 'list-item', listStyleType: 'disc', ml: 2 }}>
								<Box>
									<Link href="/ograf/v1/renderers">List Renderers</Link>
									<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
										Lists the currently connected Renderer web pages
									</Typography>
								</Box>
							</ListItem>
							<ListItem sx={{ display: 'list-item', listStyleType: 'disc', ml: 2 }}>
								<Box>
									<Typography variant="body1" gutterBottom>
										Upload OGraf Graphic (zip file):
									</Typography>
									<Box
										component="form"
										action="/serverApi/internal/graphics/graphic"
										method="post"
										encType="multipart/form-data"
										sx={{ display: 'flex', gap: 2, alignItems: 'center' }}
									>
										<Button variant="contained" component="label">
											Choose File
											<input type="file" id="graphic" name="graphic" accept=".zip" hidden />
										</Button>
										<Button type="submit" variant="outlined">
											Upload
										</Button>
									</Box>
								</Box>
							</ListItem>
						</List>
					</CardContent>
				</Card>
			</Stack>
		</Container>
	)
}
