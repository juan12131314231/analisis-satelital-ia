const CACHE_STATIC_NAME = "satelit-ia-shell-v3";
const CACHE_DYNAMIC_NAME = "satelit-ia-dynamic-v3";

const ARCHIVOS_APP_SHELL = [
    "/",
    "/csr",
    "/ssr",
    "/manifest.json",
    "/static/css/style.css",
    "/static/js/app.js",
    "/static/js/csr.js",
    "/static/icons/icon-192.png",
    "/static/icons/icon-512.png"
];

// 1. INSTALACIÓN: Pre-almacenamiento del App Shell
self.addEventListener("install", event => {
    console.log("[Service Worker] Instalando y cacheando App Shell...");
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME).then(cache => {
            return cache.addAll(ARCHIVOS_APP_SHELL);
        })
    );
    self.skipWaiting();
});

// 2. ACTIVACIÓN: Limpieza de cachés antiguas
self.addEventListener("activate", event => {
    console.log("[Service Worker] Activado y limpiando versiones previas...");
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 3. INTERCEPTACIÓN DE PETICIONES (FETCH): Estrategia Híbrida Offline-First
self.addEventListener("fetch", event => {
    const req = event.request;
    const url = new URL(req.url);

    // Ignorar peticiones que no sean GET (los POST se manejan con cola Offline en IndexedDB)
    if (req.method !== "GET") {
        return;
    }

    // Estrategia A: Network-First con respaldo en Caché para la API de Datos (/api/datos)
    if (url.pathname.startsWith("/api/datos")) {
        event.respondWith(
            fetch(req)
                .then(networkRes => {
                    const clone = networkRes.clone();
                    caches.open(CACHE_DYNAMIC_NAME).then(cache => cache.put(req, clone));
                    return networkRes;
                })
                .catch(() => {
                    return caches.match(req).then(cachedRes => {
                        if (cachedRes) return cachedRes;
                        return new Response(
                            JSON.stringify({
                                status: "offline",
                                titulo: "Análisis Satelital con IA (Modo Offline)",
                                descripcion: "Datos servidos desde el Service Worker y caché local sin conexión a Internet.",
                                resumen: {
                                    vegetacion: "65%",
                                    agua: "15%",
                                    zona_urbana: "10%",
                                    suelo_seco: "10%"
                                },
                                registros: [
                                    {
                                        id: 1,
                                        zona: "Reserva de la Biosfera Calakmul, MX (Caché Offline)",
                                        coordenadas: "18.1054° N, 89.8108° W",
                                        fecha: "Modo Sin Conexión",
                                        vegetacion: "78%",
                                        agua: "8%",
                                        zona_urbana: "4%",
                                        suelo_seco: "10%",
                                        conclusion: "Datos recuperados del almacenamiento offline del Service Worker.",
                                        origen: "Service Worker Cache"
                                    }
                                ]
                            }),
                            { headers: { "Content-Type": "application/json" } }
                        );
                    });
                })
        );
        return;
    }

    // Estrategia B: Network-First con respaldo al App Shell para navegación HTML (/, /csr, /ssr)
    if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
        event.respondWith(
            fetch(req)
                .then(networkRes => {
                    const clone = networkRes.clone();
                    caches.open(CACHE_STATIC_NAME).then(cache => cache.put(req, clone));
                    return networkRes;
                })
                .catch(() => {
                    return caches.match(req).then(cachedRes => {
                        return cachedRes || caches.match("/");
                    });
                })
        );
        return;
    }

    // Estrategia C: Cache-First con actualización en caché para recursos estáticos (CSS, JS, Iconos)
    event.respondWith(
        caches.match(req).then(cachedRes => {
            if (cachedRes) {
                return cachedRes;
            }
            return fetch(req)
                .then(networkRes => {
                    if (networkRes && networkRes.status === 200 && url.origin === self.location.origin) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_DYNAMIC_NAME).then(cache => cache.put(req, clone));
                    }
                    return networkRes;
                })
                .catch(() => {
                    return new Response("", { status: 408, statusText: "Offline" });
                });
        })
    );
});

// 4. EVENTO PUSH: Recepción de notificaciones Push en segundo plano
self.addEventListener("push", event => {
    let payload = {
        title: "🛰️ SATELIT IA - Alerta Satelital",
        body: "Nuevo reporte de telemetría y análisis satelital disponible.",
        icon: "/static/icons/icon-192.png",
        badge: "/static/icons/icon-192.png",
        url: "/"
    };

    if (event.data) {
        try {
            const data = event.data.json();
            payload = { ...payload, ...data };
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon,
            badge: payload.badge,
            vibrate: [200, 100, 200],
            tag: "satelit-ia-notification",
            data: { url: payload.url || "/" }
        })
    );
});

// 5. EVENTO NOTIFICATIONCLICK: Acción al tocar la notificación
self.addEventListener("notificationclick", event => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && "focus" in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});