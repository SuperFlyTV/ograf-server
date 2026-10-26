import * as React from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import useMediaQuery from '@mui/material/useMediaQuery'
import { Header } from './components/Header.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { ControllerPage } from './pages/ControllerPage.js'
import { appSettingsStore } from './stores/appSettings.js'

export const App: React.FC = observer(() => {
	const [page, setPage] = React.useState<'controller' | 'settings'>('controller')
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')

	const effectiveMode = React.useMemo<'light' | 'dark'>(() => {
		if (appSettingsStore.themeMode === 'light') return 'light'
		if (appSettingsStore.themeMode === 'dark') return 'dark'
		return prefersDarkMode ? 'dark' : 'light'
	}, [appSettingsStore.themeMode, prefersDarkMode])

	React.useEffect(() => {
		document.documentElement.setAttribute('data-mui-color-scheme', effectiveMode)
		document.documentElement.style.colorScheme = effectiveMode
	}, [effectiveMode])

	const theme = React.useMemo(
		() =>
			createTheme({
				palette: {
					mode: effectiveMode,
				},
				spacing: 8,
			}),
		[effectiveMode]
	)

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline enableColorScheme />
			<AppBar position="sticky" elevation={1}>
				<Toolbar sx={{ minHeight: 48, px: { xs: 1, sm: 2 } }}>
					<Header page={page} />

					<Button
						color="inherit"
						variant={page === 'controller' ? 'outlined' : 'text'}
						size="small"
						onClick={() => {
							setPage('controller')
						}}
						sx={{ ml: 1, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
					>
						Controller
					</Button>
					<Button
						color="inherit"
						variant={page === 'settings' ? 'outlined' : 'text'}
						size="small"
						onClick={() => {
							setPage('settings')
						}}
						sx={{ ml: 1, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
					>
						Settings
					</Button>
				</Toolbar>
			</AppBar>

			{page === 'settings' ? <SettingsPage /> : <ControllerPage onOpenSettings={() => setPage('settings')} />}
		</ThemeProvider>
	)
})
