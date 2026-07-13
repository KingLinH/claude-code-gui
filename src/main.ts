import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vSelectAllOnFocus } from './directives/selectAllOnFocus'
import 'highlight.js/styles/github-dark.css'
import './styles/theme-tokens.css'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('select-all', vSelectAllOnFocus)
app.mount('#app')
