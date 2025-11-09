import ChatApp from "../pages/ChatApp.js";
import { Home } from "../pages/Home.js";
import { Router } from "./Router.js";

const urls = {
    "/": () => {
        // Check if user is already logged in
        const storedUsername = sessionStorage.getItem('username');
        if (storedUsername) {
            return ChatApp(storedUsername);
        }
        return Home();
    },
    "/chat": () => {
        const storedUsername = sessionStorage.getItem('username');
        if (storedUsername) {
            return ChatApp(storedUsername);
        }
        // Redirect to home if not logged in
        return Home();
    }
};

export const routes = Router(urls);