import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/base.css' // 引入全局样式
import router from './router'
import AppConfig from '@/config/AppConfig'

async function bootstrap() {
  const appConfig = new AppConfig();
  await appConfig.loadConfig('/config/Application.json');

  const app = createApp(App)
  app.use(ElementPlus)
  app.use(router)
  app.mount('#app')
}

bootstrap();