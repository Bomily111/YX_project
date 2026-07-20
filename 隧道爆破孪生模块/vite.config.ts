import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { viteExternalsPlugin } from 'vite-plugin-externals'
import cesium from 'vite-plugin-cesium'

// 与主平台一致的 Cesium 接入方式: 外部化到 window.Cesium + 开发期注入 Cesium.js
export default defineConfig({
  plugins: [
    vue(),
    cesium(),
    viteExternalsPlugin({ cesium: 'Cesium' }),
    {
      name: 'inject-cesium-script-dev',
      apply: 'serve',
      transformIndexHtml() {
        return [{ tag: 'script', attrs: { src: '/cesium/Cesium.js' }, injectTo: 'head-prepend' }]
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  optimizeDeps: { exclude: ['cesium'] },
})
