import * as React from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import { Header } from './components/Header.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { ControllerPage } from './pages/ControllerPage.js'

const theme = createTheme({
	cssVariables: {
		colorSchemeSelector: 'data',
	},
	colorSchemes: {
		dark: true,
		light: true,
	},
	spacing: 8,
})

export const App: React.FC = () => {
	const [page, setPage] = React.useState<'controller' | 'settings'>('controller')

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline enableColorScheme />
			<AppBar position="sticky">
				<Toolbar>
					<Header page={page} />

					<Button
						color="inherit"
						onClick={() => {
							setPage('settings')
						}}
					>
						Settings
					</Button>
					<Button
						color="inherit"
						onClick={() => {
							setPage('controller')
						}}
					>
						Controller
					</Button>
				</Toolbar>
			</AppBar>

			{page === 'settings' ? <SettingsPage /> : <ControllerPage />}
		</ThemeProvider>
	)
}
