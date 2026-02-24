import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

// Import our custom CSS
import './scss/styles.scss'

import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { App } from './App.js'

const domNode = document.getElementById('root')
if (!domNode) throw new Error('Failed to find the root element')
ReactDOM.createRoot(domNode).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
