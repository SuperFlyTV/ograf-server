import path from 'path'
import type { Options } from 'yargs'
import yargs from 'yargs/yargs'

/*
 * This file contains various CLI argument definitions, used by the various processes that together constitutes the Package Manager
 */

/** Generic CLI-argument-definitions for any process */
export const options = defineArguments({
	namespacePath: {
		type: 'string',
		default: process.env.NAMESPACE_SETTINGS_NAMESPACE_PATH || undefined,
		describe: 'Path to folder where to store info about namespaces. If not set, namespaces are disabled.',
	},
	// ografPath: {
	// 	type: 'string',
	// 	default: process.env.NAMESPACE_SETTINGS_OGRAF_PATH || undefined,
	// 	describe: 'Path to folder where to store OGraf graphics.',
	// },
})

export interface ConfigOptions {
	namespacePath: string | undefined
	// ografPath: string | undefined
}

export async function getConfig(): Promise<ConfigOptions> {
	const argv = await Promise.resolve(yargs(getProcessArgv()).options(options).argv)

	const config: ConfigOptions = {
		namespacePath: argv.namespacePath,
		// ografPath: argv.ografPath,
	}

	if (config.namespacePath === 'dev') {
		config.namespacePath = path.resolve('./dev/namespaces')
		// config.ografPath = path.resolve('/dev/graphics')
	}

	return config
}

// ---------------------------------------------------------------------------------

/** Helper function, to get strict typings for the yargs-Options. */
function defineArguments<O extends { [key: string]: Options }>(opts: O): O {
	return opts
}

function getProcessArgv(): string[] {
	// Note: process.argv typically looks like this:
	// [
	// 	'C:\\Program Files\\nodejs\\node.exe',
	// 	'C:\\path\\to\\my\\app\\dist\\index.js',
	// 	'--',
	// 	'--arg1=true',
	// 	'--arg2=true'
	// ]

	// Remove the first two arguments
	let args = process.argv.slice(2)

	// If the first argument is just '--', remove it:
	if (args[0] === '--') args = args.slice(1)

	// Fix an issue when arguments are escaped and contains spaces:

	// for example: --myArg="this is hard" becomes ['--myArg="this', 'is', 'hard"']
	for (let i = 0; i < args.length; i++) {
		const m = args[i].match(/=*(["'])/)
		if (m) {
			const quote = m[1] // " or '

			// check if the arg contains only one quote
			if (countOccurrences(args[i], quote) !== 1) continue

			// check future args
			let argCombined = args[i]

			for (let j = i + 1; j < args.length; j++) {
				argCombined += ' ' + args[j]
				if (args[j].includes(quote)) {
					// Found the end
					//
					// Combine the args in between and remove used args:
					args[i] = argCombined
					args.splice(i + 1, j - i)
					break
				}
			}
		}
	}

	return args
}

function countOccurrences(haystack: string, needle: string): number {
	let count = 0
	let pos = haystack.indexOf(needle)
	while (pos !== -1) {
		count++
		pos = haystack.indexOf(needle, pos + needle.length)
	}
	return count
}
