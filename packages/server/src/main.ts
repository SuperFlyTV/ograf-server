import { SERVER_SETTINGS } from './namespace.js'
import { initializeServer } from './server.js'

if (SERVER_SETTINGS.namespacePath) {
	console.log(`Starting server in namespace mode with settings:\n${JSON.stringify(SERVER_SETTINGS, null, 2)}`)
} else {
	console.log(`Starting server in local mode, no namespaces will be used.`)
}
initializeServer().catch(console.error)
