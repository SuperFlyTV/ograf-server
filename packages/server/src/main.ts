import { getConfig, isNamespaceEnabled, sanitizeConfigForLogging } from './config.js'

import { initializeServer } from './server.js'

const config = await getConfig()

if (isNamespaceEnabled(config)) {
	console.log(
		`Starting server in namespace mode with settings:\n${JSON.stringify(sanitizeConfigForLogging(config), null, 2)}`
	)
} else {
	console.log(`Starting server in local mode, no namespaces will be used.`)
}
initializeServer(config).catch(console.error)
