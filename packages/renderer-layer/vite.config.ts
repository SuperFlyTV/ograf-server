import path from 'path'
import { defineConfig } from 'vite'
import pluginChecker from 'vite-plugin-checker'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
	root: path.resolve(__dirname, 'src'),
	// resolve: {
	//     alias: {
	//       '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
	//     }
	//   },
	server: {
		port: 8084,
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
				// Suppress "Module level directives cause errors when bundled" warnings
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
	plugins: [svgr(), pluginChecker({ typescript: true })],
})
