import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './style.css'
import { installGlobalRendererErrorHandlers, logViewError } from './utils/viewInitialization.mjs'

const app = createApp(App)
installGlobalRendererErrorHandlers()

app.config.errorHandler = (error, _instance, info) => {
  logViewError(`vue error${info ? ` (${info})` : ''}`, error)
  window.$toast?.('页面运行异常，请重试当前页面', 'error')
}

router.onError((error) => {
  logViewError('router navigation', error)
  window.$toast?.('页面跳转失败，请重试', 'error')
})

app.use(createPinia())
app.use(router)
app.mount('#app')
