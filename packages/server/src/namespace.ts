/*
Environment variables:
NAMESPACE_SETTINGS_NAMESPACE_PATH: Path to folder where to store info about namespace
NAMESPACE_SETTINGS_OGRAF_PATH: Path to folder where to store OGraf graphics
*/

export const NAMESPACE_SETTINGS: {
	namespacePath: string | undefined
	ografPath: string | undefined
} | null = process.env['NAMESPACE_SETTINGS_NAMESPACE_PATH']
	? {
			namespacePath: process.env['NAMESPACE_SETTINGS_NAMESPACE_PATH'],
			ografPath: process.env['NAMESPACE_SETTINGS_OGRAF_PATH'],
		}
	: null
