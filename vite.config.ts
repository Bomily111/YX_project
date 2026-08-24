import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { viteExternalsPlugin } from 'vite-plugin-externals'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [
    vue(),
    // Serves /cesium/* → node_modules/cesium/Build/CesiumUnminified/ in dev
    // Copies assets and externalizes cesium in build
    cesium(),
    // Maps `import cesium` → window.Cesium in all modes (avoids esbuild conflict)
    viteExternalsPlugin({ cesium: 'Cesium' }),
    // In dev mode, inject the CesiumUnminified.js script tag that cesium plugin omits
    {
      name: 'inject-cesium-script-dev',
      apply: 'serve',
      transformIndexHtml() {
        return [{
          tag: 'script',
          attrs: { src: '/cesium/Cesium.js' },
          injectTo: 'head-prepend',
        }]
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    exclude: ['cesium'],
    // 只扫描 index.html，避免扫描 public/ 下的 gpr_viewer.html 等静态 HTML 导致依赖扫描失败
    entries: ['index.html'],
  },
  server: {
    proxy: {
      // 将 /api 请求代理到我们的后端服务器
      '/api': {
        target: 'http://localhost:3000', // 您的后端服务器地址
        changeOrigin: true, // 需要虚拟主机站点
      },
    }
  }
})
