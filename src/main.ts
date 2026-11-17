import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import { installPluginTheme } from './theme';

installPluginTheme();

createApp(App).mount('#app');
