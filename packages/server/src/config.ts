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
	cleanupGraphics: {
		type: 'number',
		default: process.env.NAMESPACE_SETTINGS_CLEANUP_GRAPHICS || undefined,
		describe: 'How long to wait before cleaning up graphics for an unused namespace (in seconds).',
	},
	cleanupAccount: {
		type: 'number',
		default: process.env.NAMESPACE_SETTINGS_CLEANUP_ACCOUNT || undefined,
		describe: 'How long to wait before cleaning up an unused namespace account (in seconds).',
	},
	infoText: {
		type: 'string',
		default: process.env.NAMESPACE_SETTINGS_INFO_TEXT || undefined,
		describe: 'Additional HTML info text to display on the namespace introduction page.',
	},
	port: {
		type: 'number',
		default: process.env.PORT || undefined,
		describe: 'Port of the web server',
		alias: 'p',
	},
	mongodbUri: {
		type: 'string',
		default: process.env.MONGODB_URI || undefined,
		describe: 'MongoDB connection URI for storing namespace accounts. If set, enables namespaces using MongoDB.',
	},
	mongodbDbName: {
		type: 'string',
		default: process.env.MONGODB_DB_NAME || undefined,
		describe: 'MongoDB database name for storing namespace accounts (defaults to database in URI or "ograf-server").',
	},
	mongodbCollection: {
		type: 'string',
		default: process.env.MONGODB_COLLECTION || undefined,
		describe: 'MongoDB collection name for storing namespace accounts (defaults to "accounts").',
	},
	s3Bucket: {
		type: 'string',
		default: process.env.S3_BUCKET || undefined,
		describe: 'S3 bucket name for storing graphics files. If set, graphics are stored in S3 instead of on disk.',
	},
	s3Endpoint: {
		type: 'string',
		default: process.env.S3_ENDPOINT || undefined,
		describe: 'S3-compatible endpoint URL (e.g. for MinIO, Cloudflare R2, DigitalOcean Spaces).',
	},
	s3Region: {
		type: 'string',
		default: process.env.S3_REGION || undefined,
		describe: 'S3 region (defaults to "us-east-1").',
	},
	s3AccessKeyId: {
		type: 'string',
		default: process.env.S3_ACCESS_KEY_ID || undefined,
		describe: 'S3 access key ID.',
	},
	s3SecretAccessKey: {
		type: 'string',
		default: process.env.S3_SECRET_ACCESS_KEY || undefined,
		describe: 'S3 secret access key.',
	},
	s3ForcePathStyle: {
		type: 'boolean',
		default: parseOptionalBoolean(process.env.S3_FORCE_PATH_STYLE),
		describe: 'Whether to force path-style URLs for S3 objects (useful for S3-compatible stores like MinIO).',
	},
	s3Prefix: {
		type: 'string',
		default: process.env.S3_PREFIX || undefined,
		describe: 'Optional key prefix for objects stored in the S3 bucket.',
	},
	// ografPath: {
	// 	type: 'string',
	// 	default: process.env.NAMESPACE_SETTINGS_OGRAF_PATH || undefined,
	// 	describe: 'Path to folder where to store OGraf graphics.',
	// },
})

export interface ConfigOptions {
	namespacePath: string | undefined
	cleanupGraphics: number | undefined
	cleanupAccount: number | undefined
	infoText: string | undefined
	port: number | undefined
	mongodbUri?: string | undefined
	mongodbDbName?: string | undefined
	mongodbCollection?: string | undefined
	s3Bucket?: string | undefined
	s3Endpoint?: string | undefined
	s3Region?: string | undefined
	s3AccessKeyId?: string | undefined
	s3SecretAccessKey?: string | undefined
	s3ForcePathStyle?: boolean | undefined
	s3Prefix?: string | undefined
	// ografPath: string | undefined
}

export function isNamespaceEnabled(config: ConfigOptions): boolean {
	return typeof config.namespacePath === 'string' || typeof config.mongodbUri === 'string'
}

export function sanitizeConfigForLogging(config: ConfigOptions): ConfigOptions {
	return {
		...config,
		mongodbUri: config.mongodbUri ? config.mongodbUri.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2') : undefined,
		s3SecretAccessKey: config.s3SecretAccessKey ? '***' : undefined,
	}
}

export async function getConfig(): Promise<ConfigOptions> {
	const argv = await Promise.resolve(yargs(getProcessArgv()).options(options).argv)

	const port = parseOptionalInt(argv.port)
	const cleanupGraphics = parseOptionalInt(argv.cleanupGraphics)
	const cleanupAccount = parseOptionalInt(argv.cleanupAccount)
	const s3ForcePathStyle = parseOptionalBoolean(argv.s3ForcePathStyle)

	const config: ConfigOptions = {
		namespacePath: argv.namespacePath,
		cleanupGraphics,
		cleanupAccount,
		infoText: argv.infoText,
		port: port,
		mongodbUri: argv.mongodbUri,
		mongodbDbName: argv.mongodbDbName,
		mongodbCollection: argv.mongodbCollection,
		s3Bucket: argv.s3Bucket,
		s3Endpoint: argv.s3Endpoint,
		s3Region: argv.s3Region,
		s3AccessKeyId: argv.s3AccessKeyId,
		s3SecretAccessKey: argv.s3SecretAccessKey,
		s3ForcePathStyle,
		s3Prefix: argv.s3Prefix,
		// ografPath: argv.ografPath,
	}

	if (config.namespacePath === 'dev') {
		config.namespacePath = path.resolve('./dev/namespaces')
		// config.ografPath = path.resolve('/dev/graphics')
	}

	return config
}

function parseOptionalInt(value: number | string | undefined): number | undefined {
	const parsed = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : undefined
	if (parsed === undefined || Number.isNaN(parsed)) return undefined
	return parsed
}

function parseOptionalBoolean(value: boolean | string | undefined): boolean | undefined {
	if (typeof value === 'boolean') return value
	if (typeof value === 'string') {
		const lower = value.trim().toLowerCase()
		if (lower === 'true' || lower === '1') return true
		if (lower === 'false' || lower === '0') return false
	}
	return undefined
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
