import ChatApp from "../pages/ChatApp.js";
import { Home } from "../pages/Home.js";
import { Router } from "./Router.js";

function createChatAppIfLogged() {
    const storedUsername = sessionStorage.getItem("username");
    if (!storedUsername) {
        return Home();
    }

    const chatEl = ChatApp(storedUsername);

    window.currentChatApp = chatEl;

    // Si ChatApp expone loadInitialData, úsalo para reconectar/cargar datos
    if (typeof chatEl.loadInitialData === "function") {
        chatEl.loadInitialData().catch(err => {
            console.error("Error al cargar datos iniciales:", err);
            // Si falla la reconexión, limpiamos sesión y podrías opcionalmente
            // forzar un redirect a Home:
            sessionStorage.removeItem("username");
            sessionStorage.removeItem("iceConnected");
        });
    }

    return chatEl;
}

const urls = {
    "/": () => {
        // Check if user is already logged in
        return createChatAppIfLogged();
    },
    "/chat": () => {
        return createChatAppIfLogged();
    }
};

export const routes = Router(urls);