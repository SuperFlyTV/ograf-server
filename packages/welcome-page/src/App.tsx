import * as React from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { MainPage } from './pages/MainPage.js'

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
	return (
		<ThemeProvider theme={theme}>
			<CssBaseline enableColorScheme />
			<MainPage />
		</ThemeProvider>
	)
}
