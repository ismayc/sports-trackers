import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the same dist/ serves under the GitHub Pages subpath
  // (/sports-trackers/) as well as a domain root. Matches the family.
  base: './',
})
