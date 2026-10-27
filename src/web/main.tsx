import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App.js";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "./styles.css";

// офлайн-кэш нужен только сайту и телефону; в приложении для компьютера (file://) сервис-воркеров нет
if (location.protocol.startsWith("http")) registerSW({ immediate: true });
createRoot(document.getElementById("root")!).render(<App />);
