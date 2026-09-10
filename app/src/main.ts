import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth";
import "./assets/main.css";

function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  // Start session restore immediately so it overlaps first paint.
  void useAuthStore().init();
  app.use(router);
  app.mount("#app");
}

bootstrap();
