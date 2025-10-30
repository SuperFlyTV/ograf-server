import path from 'path'
import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

export default defineConfig({
	root: path.resolve(__dirname, 'src'),
	// resolve: {
	//     alias: {
	//       '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
	//     }
	//   },
	server: {
		port: 8082,
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
	},
	base: '',
})
