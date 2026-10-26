/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Відносні шляхи: зібраний сайт працює і в корені домену, і в підпапці.
  base: './',
  build: { target: 'es2022' },
  test: { environment: 'node' },
});
