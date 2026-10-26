/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths: the built site works both at the domain root and in a subfolder.
  base: './',
  build: { target: 'es2022' },
  test: { environment: 'node' },
});
