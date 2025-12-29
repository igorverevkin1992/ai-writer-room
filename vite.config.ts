import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ВАЖНО: Разрешает доступ из сети (извне контейнера)
    host: true, 
    // Жестко задаем порт
    port: 5173,
    // ВАЖНО ДЛЯ WINDOWS: Включает опрос файлов, иначе изменения кода 
    // не будут обновлять страницу в браузере (Hot Reload)
    watch: {
      usePolling: true
    }
  }
})
