import path from 'path'
/*
Environment variables:
NAMESPACE_SETTINGS_NAMESPACE_PATH: Path to folder where to store info about namespace
NAMESPACE_SETTINGS_OGRAF_PATH: Path to folder where to store OGraf graphics
*/

export const SERVER_SETTINGS: {
	namespacePath: string | null
	ografPath: string | null
} = getServerSettings()

function getServerSettings() {
	let namespacePath: string | null = null
	let ografPath: string | null = null
	if (process.env['NAMESPACE_SETTINGS_NAMESPACE_PATH']) {
		namespacePath = process.env['NAMESPACE_SETTINGS_NAMESPACE_PATH'] ?? null
		ografPath = process.env['NAMESPACE_SETTINGS_OGRAF_PATH']?? null

		if (namespacePath === 'dev') {
			namespacePath = path.resolve('./dev/namespaces')
			ografPath = path.resolve('/dev/graphics')
		}

	}
	return {
		namespacePath,
		ografPath,
	}

}
