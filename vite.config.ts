import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// develop_system.md §6 — PWA 구성
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 개발 시 동일 출처로 백엔드 호출(CORS 불필요). api 클라이언트 기본 베이스는 '/api'.
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: '폼앗이',
        short_name: '폼앗이',
        description: '대학생 설문 품앗이 — 응답은 응답으로 갚습니다.',
        lang: 'ko',
        theme_color: '#34a866',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // /api/* 는 서비스 워커가 절대 인터셉트하지 않는다.
        // Authorization 헤더 유실 및 캐시된 4xx 서빙을 방지.
        // API 응답 캐싱은 React Query가 담당.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // 폰트 캐시 (CDN 폰트)
            urlPattern: /cdn\.jsdelivr\.net\/.*\.(woff2?|css)/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
