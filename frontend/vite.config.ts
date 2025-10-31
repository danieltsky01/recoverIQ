import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		port: 5173,
		strictPort: true,
		// In dev, proxy /api/* to the Firebase Functions emulator.
		// Hosting in prod rewrites /api/* to the deployed function.
		proxy: (() => {
			const project = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'recoveriq-b2b09'
			const base = `/${project}/us-central1`
			return {
				'/api/score': {
					target: 'http://127.0.0.1:5001',
					changeOrigin: true,
					rewrite: () => `${base}/scoreHospital`,
				},
				'/api/health': {
					target: 'http://127.0.0.1:5001',
					changeOrigin: true,
					rewrite: () => `${base}/health`,
				},
			}
		})(),
	}
})
