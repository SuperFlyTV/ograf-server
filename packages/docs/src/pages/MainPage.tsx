import * as React from 'react'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'

import Stack from '@mui/material/Stack'

import OGrafLogoUrl from '../assets/ograf_logo_colour_draft.svg'
import SuperFlyLogoUrl from '../assets/SuperFly.tv_Logo_2020_v02.png'
import { getServerSettings, usePromise } from '../lib/lib.js'
import Alert from '@mui/material/Alert'
import { NameSpaceIntro } from '../components/NameSpaceIntro.js'
import { NoNameSpaceIntro } from '../components/NoNameSpaceIntro.js'

export const MainPage: React.FC = () => {
	const serverSettings = usePromise(getServerSettings)



	return (
		<Container maxWidth="lg" sx={{ py: 4 }}>
			<Stack spacing={3}>
				<Card>
					<CardContent>
						<Box sx={{ textAlign: 'center', mb: 3 }}>
							<img src={OGrafLogoUrl} alt="OGraf" height="50" />
							<Typography variant="h3" component="h1" sx={{ mt: 2 }}>
								OGraf Renderer
							</Typography>
						</Box>
						<Box sx={{ textAlign: 'center', mb: 3 }}>
							<Typography variant="body1">
								This is an Open Source project developed with ❤️ by{' '}
								<Link href="https://SuperFly.tv" target="_blank" rel="noopener noreferrer">
									<img src={SuperFlyLogoUrl} alt="SuperFly.tv" height="50" style={{ verticalAlign: 'middle' }} />
								</Link>
								<br />
								Feel free to contribute features, bug fixes or report issues at{' '}
								<Link href="https://github.com/SuperFlyTV/ograf-server" target="_blank" rel="noopener noreferrer">
									GitHub
								</Link>
								.
							</Typography>
						</Box>
						{serverSettings.data?.namespaceEnabled ? <NameSpaceIntro /> : <NoNameSpaceIntro />}
						{serverSettings.error && (
							<>
								<Alert severity="error">Error loading server settings: {serverSettings.error.message}</Alert>
							</>
						)}
					</CardContent>
				</Card>
			</Stack>
		</Container>
	)
}
