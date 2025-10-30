import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = await generateEslintConfig({
	ignores: ['vite.config.js'],
	disableNodeRules: true,
})

if (!config.parserOptions) config.parserOptions = {}
config.parserOptions.tsconfigRootDir = __dirname

export default config
