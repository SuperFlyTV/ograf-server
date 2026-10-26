import path from 'path'
import { defineConfig } from 'vite'
import pluginChecker from 'vite-plugin-checker'

export default defineConfig({
	root: path.resolve(__dirname, 'src'),
	server: {
		port: 8087,
	},
	build: {
		outDir: path.resolve(__dirname, 'dist'),
		rollupOptions: {
			output: {
				assetFileNames: '[name][extname]',
				chunkFileNames: '[name].js',
				entryFileNames: '[name].js',
			},
			onwarn(warning, warn) {
				if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
					return
				}
				warn(warning)
			},
		},
		assetsDir: '',
		emptyOutDir: true,
		chunkSizeWarningLimit: 2000,
	},
	base: '',
	plugins: [pluginChecker({ typescript: true })],
})
