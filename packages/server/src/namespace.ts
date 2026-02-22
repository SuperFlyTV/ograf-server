import path from 'path'
/*
Environment variables:
NAMESPACE_SETTINGS_NAMESPACE_PATH: Path to folder where to store info about namespace
NAMESPACE_SETTINGS_OGRAF_PATH: Path to folder where to store OGraf graphics
*/

export const NAMESPACE_SETTINGS: {
	namespacePath: string | undefined
	ografPath: string | undefined
} | null = getNamespaceSettings()

function getNamespaceSettings() {
	if (process.env['NAMESPACE_SETTINGS_NAMESPACE_PATH']) {
		let namespacePath = process.env['NAMESPACE_SETTINGS_NAMESPACE_PATH']
		let ografPath = process.env['NAMESPACE_SETTINGS_OGRAF_PATH']

		if (namespacePath === 'dev') {
			namespacePath = path.resolve('./dev/namespaces')
			ografPath = path.resolve('/dev/graphics')
		}

		return {
			namespacePath,
			ografPath,
		}
	}
	return null
}
