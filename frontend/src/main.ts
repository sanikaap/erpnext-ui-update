import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './index.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
// Mount after the first route resolves so App.vue picks the right layout (login vs. shell) on first paint.
void router.isReady().then(() => app.mount('#app'));