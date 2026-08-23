import { getConfig } from './config.js'

import { initializeServer } from './server.js'

const config = await getConfig()

if (config.namespacePath) {
	console.log(`Starting server in namespace mode with settings:\n${JSON.stringify(config, null, 2)}`)
} else {
	console.log(`Starting server in local mode, no namespaces will be used.`)
}
initializeServer(config).catch(console.error)
