import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '');
  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      port: Number(process.env.WEB_PORT ?? env.WEB_PORT ?? 5173),
      strictPort: true,
      proxy: {
        '/api': 'http://127.0.0.1:' + (process.env.API_PORT ?? env.API_PORT ?? '3000'),
      },
    },
  };
});
