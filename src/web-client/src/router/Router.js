export const Router = (paths) => {

    let route = window.location.pathname;
    
    if (route.startsWith("/chat")) {
        route = route.substring("/chat".length) || "/";
    }

    // Normalizar barra final
    if (route.length > 1 && route.endsWith("/")) {
        route = route.slice(0, -1);
    }

    const routeComponent = paths[route] || (() => {
        const notFound = document.createElement("p");
        notFound.innerText = "404 - Not Found";
        return notFound;
    });

    return routeComponent();

};
