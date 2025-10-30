import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const filename0 = fileURLToPath(import.meta.url)
const dirname0 = dirname(filename0)

const config = await generateEslintConfig({
	ignores: ['localGraphicsStorage/**', 'public/**'],
})

if (!config.parserOptions) config.parserOptions = {}
config.parserOptions.tsconfigRootDir = dirname0

export default config
