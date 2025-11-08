import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'

const config = await generateEslintConfig({
	ignores: ['vite.config.ts', '*.mjs'],
	disableNodeRules: true,
	tsconfigName: './tsconfig.json',
})

config.push({
	languageOptions: {
		parserOptions: {
			tsconfigRootDir: import.meta.dirname,
		},
	},
})
export default config
