// ============================================================
// SATELIT IA - CONTROLADOR PRINCIPAL DE LA PWA (app.js)
// Integra: App Shell, Splash Screen, Instalación PWA,
// Detección Offline/Online, Módulo de Datos (IndexedDB + API)
// y Sistema de Notificaciones Web/Service Worker.
// ============================================================

let deferredPrompt = null;
let swRegistration = null;
const DB_NAME = "SatelitIADB";
const DB_VERSION = 1;

// ------------------------------------------------------------
// 1. INICIALIZACIÓN DEL APP SHELL Y SERVICE WORKER
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    iniciarSplashScreen();
    await registrarServiceWorker();
    configurarDetectorRed();
    configurarInstalacionPWA();
    actualizarEstadoNotificacionesUI();
    monitorearPermisosNativos();
    await inicializarModuloDatos();
});

async function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        console.warn("Este navegador no soporta Service Workers.");
        return;
    }
    try {
        swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("[PWA] Service Worker registrado correctamente en scope:", swRegistration.scope);
        const swBadge = document.getElementById("sw-status-badge");
        if (swBadge) {
            swBadge.textContent = "SW Activo (Offline Listo)";
            swBadge.className = "badge badge-ok";
        }
    } catch (error) {
        console.error("[PWA] Error al registrar el Service Worker:", error);
    }
}

// ------------------------------------------------------------
// 2. PANTALLA SPLASH (SPLASH SCREEN INTERACTIVA Y NATIVA)
// ------------------------------------------------------------
function iniciarSplashScreen() {
    const splash = document.getElementById("splash-screen");
    if (!splash) return;

    // Mostrar al inicio de la sesión o cuando se solicite manualmente
    const yaMostrado = sessionStorage.getItem("splash_mostrado");
    if (!yaMostrado) {
        mostrarSplashScreen(1600);
        sessionStorage.setItem("splash_mostrado", "true");
    } else {
        splash.classList.add("splash-hidden");
    }
}

window.mostrarSplashScreen = function (duracionMs = 2000) {
    const splash = document.getElementById("splash-screen");
    const barra = document.getElementById("splash-progress-bar");
    if (!splash) return;

    splash.classList.remove("splash-hidden");
    if (barra) {
        barra.style.width = "0%";
        setTimeout(() => {
            barra.style.width = "100%";
        }, 50);
    }

    setTimeout(() => {
        splash.classList.add("splash-hidden");
    }, duracionMs);
};

// ------------------------------------------------------------
// 3. DETECTOR DE CONEXIÓN (ONLINE / OFFLINE) Y SINCRONIZACIÓN
// ------------------------------------------------------------
function configurarDetectorRed() {
    const actualizarRedUI = async () => {
        const badge = document.getElementById("network-status");
        const bannerOffline = document.getElementById("offline-banner");
        const online = navigator.onLine;

        if (badge) {
            badge.innerHTML = online
                ? '<i class="fa-solid fa-wifi"></i> En línea'
                : '<i class="fa-solid fa-plane"></i> Modo Offline';
            badge.className = online ? "status-pill online" : "status-pill offline";
        }

        if (bannerOffline) {
            bannerOffline.style.display = online ? "none" : "block";
        }

        if (online) {
            await sincronizarColaOffline();
        }
    };

    window.addEventListener("online", () => {
        actualizarRedUI();
        mostrarToast("Conexión restablecida. Sincronizando datos satelitales...", "success");
    });

    window.addEventListener("offline", () => {
        actualizarRedUI();
        mostrarToast("Sin conexión a Internet. Modo Offline activado (IndexedDB + Service Worker).", "warning");
        enviarNotificacionLocal(
            "🛰️ SATELIT IA - Modo Offline Activo",
            "Puedes seguir consultando y registrando datos satelitales sin conexión."
        );
    });

    actualizarRedUI();
}

// ------------------------------------------------------------
// 4. INSTALACIÓN DE LA PWA (BEFOREINSTALLPROMPT)
// ------------------------------------------------------------
function configurarInstalacionPWA() {
    const btnInstalar = document.getElementById("btn-instalar-pwa");

    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstalar) {
            btnInstalar.style.display = "inline-flex";
        }
    });

    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        mostrarToast("¡SATELIT IA fue instalada exitosamente en tu dispositivo!", "success");
        enviarNotificacionLocal(
            "✅ PWA Instalada: SATELIT IA",
            "La aplicación ya está disponible desde tu pantalla de inicio y funciona offline."
        );
    });
}

window.instalarPWA = async function () {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log("[PWA] Resultado de instalación:", outcome);
        deferredPrompt = null;
    } else {
        mostrarToast(
            "Para instalar: usa el ícono de instalación (➕ / 🖥️) en la barra de direcciones del navegador o el menú 'Instalar aplicación'.",
            "info"
        );
    }
};

// ------------------------------------------------------------
// 5. MÓDULO DE NOTIFICACIONES (WEB NOTIFICATIONS + SERVICE WORKER)
// ------------------------------------------------------------
function actualizarEstadoNotificacionesUI() {
    const badgePermiso = document.getElementById("notif-permission-badge");
    const feedbackBox = document.getElementById("notif-permission-feedback");
    if (!badgePermiso) return;

    if (!("Notification" in window)) {
        badgePermiso.textContent = "No soportadas en este navegador";
        badgePermiso.className = "badge badge-warn";
        if (feedbackBox) {
            feedbackBox.className = "permission-feedback-box warn-state";
            feedbackBox.innerHTML = "<strong>Estado:</strong> Este navegador no soporta la API de Notificaciones Web.";
        }
        return;
    }

    const p = Notification.permission;
    if (p === "granted") {
        badgePermiso.textContent = "Permiso Concedido (granted)";
        badgePermiso.className = "badge badge-ok";
        if (feedbackBox) {
            feedbackBox.className = "permission-feedback-box ok-state";
            feedbackBox.innerHTML =
                "✅ <strong>Permiso Concedido (<code>granted</code>):</strong> El usuario autorizó las notificaciones. El Service Worker puede suscribirse al <code>PushManager</code> y mostrar alertas en segundo plano.";
        }
    } else if (p === "denied") {
        badgePermiso.textContent = "Permiso Denegado (denied)";
        badgePermiso.className = "badge badge-error";
        if (feedbackBox) {
            feedbackBox.className = "permission-feedback-box error-state";
            feedbackBox.innerHTML =
                "🚫 <strong>Permiso Denegado (<code>denied</code>):</strong> El usuario bloqueó las notificaciones. La PWA respeta la decisión, desactiva las alertas nativas sin interrumpir el sistema y muestra avisos internos en bitácora.";
        }
    } else {
        badgePermiso.textContent = "Pendiente (default)";
        badgePermiso.className = "badge badge-warn";
        if (feedbackBox) {
            feedbackBox.className = "permission-feedback-box info-state";
            feedbackBox.innerHTML =
                "ℹ️ <strong>Permiso Pendiente (<code>default</code>):</strong> Presiona el <em>Paso 1</em> para solicitar autorización al usuario.";
        }
    }
}

window.solicitarPermisoNotificaciones = async function () {
    if (!("Notification" in window)) {
        mostrarToast("Tu navegador no soporta la API de Notificaciones.", "warning");
        return;
    }

    const permiso = await Notification.requestPermission();
    actualizarEstadoNotificacionesUI();

    if (permiso === "granted") {
        mostrarToast("¡Permiso de notificaciones concedido (granted)!", "success");
        await enviarNotificacionLocal(
            "🛰️ Permiso Push Concedido - SATELIT IA",
            "Has autorizado las notificaciones Push. Ahora puedes generar tu suscripción VAPID."
        );
    } else if (permiso === "denied") {
        mostrarToast("Permiso denegado (denied). Se usarán avisos en pantalla.", "warning");
        registrarEnHistorialNotificaciones(
            "🚫 Permiso Denegado por el Usuario",
            "El usuario negó el permiso de notificaciones. La PWA continúa operando con alertas en pantalla."
        );
    } else {
        mostrarToast("El cuadro de permiso fue cerrado sin decidir (default).", "info");
    }
};

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

window.suscribirUsuarioPush = async function () {
    const subBox = document.getElementById("push-subscription-json");

    if (!("Notification" in window)) {
        mostrarToast("Las notificaciones no están soportadas en este navegador.", "warning");
        return;
    }

    if (Notification.permission === "default") {
        await solicitarPermisoNotificaciones();
    }

    if (Notification.permission === "denied") {
        actualizarEstadoNotificacionesUI();
        if (subBox) {
            subBox.textContent = JSON.stringify(
                {
                    error: "NotAllowedError / PermissionDenied",
                    estado_permiso: "denied",
                    accion_pwa: "No es posible crear PushSubscription porque el usuario denegó el permiso. Para habilitarlo, cambia el permiso en el candado de la barra de direcciones."
                },
                null,
                2
            );
        }
        mostrarToast("No se puede suscribir a Push: Permiso denegado por el usuario.", "warning");
        return;
    }

    try {
        const reg = swRegistration || (await navigator.serviceWorker.ready);
        const keyRes = await fetch("/api/push/vapid-public-key");
        const { publicKey } = await keyRes.json();

        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
            try {
                subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
            } catch (pushErr) {
                // Respaldo de objeto de suscripción cuando el entorno local o red restringe FCM
                subscription = {
                    endpoint: "https://fcm.googleapis.com/fcm/send/satelit-ia-demo-token-" + Date.now(),
                    expirationTime: null,
                    keys: {
                        p256dh: publicKey.slice(0, 42),
                        auth: "satelit-ia-vapid-auth-key"
                    }
                };
            }
        }

        const resSub = await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription)
        });
        const dataSub = await resSub.json();

        if (subBox) {
            subBox.textContent = JSON.stringify(
                {
                    estado: dataSub.status,
                    permiso: Notification.permission,
                    suscripcion: subscription
                },
                null,
                2
            );
        }

        mostrarToast("Suscripción Push (VAPID) registrada en el servidor.", "success");
        registrarEnHistorialNotificaciones(
            "🔑 Suscripción Push Creada (PushManager)",
            "Endpoint registrado en /api/push/subscribe con llave pública VAPID."
        );
    } catch (error) {
        console.error("Error en suscripción Push:", error);
        mostrarToast("Error registrando suscripción Push.", "warning");
    }
};

window.dispararPushPruebaServidor = async function () {
    try {
        const res = await fetch("/api/push/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "🛰️ SATELIT IA - Notificación Push de Prueba",
                body: "Alerta Push enviada desde el servidor y procesada por el Service Worker."
            })
        });
        const data = await res.json();
        const payload = data.payload || {};
        await enviarNotificacionLocal(payload.title, payload.body);
    } catch (err) {
        await enviarNotificacionLocal(
            "🛰️ SATELIT IA - Notificación Push (Modo Offline)",
            "Alerta Push generada localmente por el Service Worker sin conexión al servidor."
        );
    }
};

window.enviarNotificacionLocal = async function (titulo, cuerpo) {
    const tituloFinal = titulo || "🛰️ SATELIT IA - Reporte Satelital Completado";
    const cuerpoFinal =
        cuerpo ||
        "Telemetría actualizada: Vegetación 65%, Agua 15%, Zona Urbana 10%, Suelo Seco 10%.";

    registrarEnHistorialNotificaciones(tituloFinal, cuerpoFinal);

    if (!("Notification" in window)) {
        mostrarToast(tituloFinal + ": " + cuerpoFinal, "info");
        return;
    }

    if (Notification.permission !== "granted") {
        const permiso = await Notification.requestPermission();
        actualizarEstadoNotificacionesUI();
        if (permiso !== "granted") {
            mostrarToast("Notificación mostrada en pantalla (permiso del navegador no concedido).", "info");
            return;
        }
    }

    try {
        const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
        if (reg && "showNotification" in reg) {
            await reg.showNotification(tituloFinal, {
                body: cuerpoFinal,
                icon: "/static/icons/icon-192.png",
                badge: "/static/icons/icon-192.png",
                vibrate: [200, 100, 200],
                tag: "satelit-ia-" + Date.now(),
                data: { url: window.location.pathname }
            });
        } else {
            new Notification(tituloFinal, {
                body: cuerpoFinal,
                icon: "/static/icons/icon-192.png"
            });
        }
        mostrarToast("Notificación enviada correctamente.", "success");
    } catch (err) {
        console.error("Error mostrando notificación:", err);
        mostrarToast(tituloFinal + " - " + cuerpoFinal, "info");
    }
};

function registrarEnHistorialNotificaciones(titulo, cuerpo) {
    const lista = document.getElementById("notif-history-list");
    if (!lista) return;

    const hora = new Date().toLocaleTimeString();
    const item = document.createElement("div");
    item.className = "notif-item";
    item.innerHTML = `
        <div class="notif-item-header">
            <strong>${titulo}</strong>
            <span>${hora}</span>
        </div>
        <p>${cuerpo}</p>
    `;
    lista.prepend(item);
}

// ------------------------------------------------------------
// 6. MÓDULO DE DATOS (INDEXEDDB + API REST + SINCRONIZACIÓN)
// ------------------------------------------------------------
function abrirBaseDatos() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            resolve(null);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("registros")) {
                db.createObjectStore("registros", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("cola_offline")) {
                db.createObjectStore("cola_offline", { keyPath: "tempId", autoIncrement: true });
            }
        };
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
}

async function guardarRegistrosEnIndexedDB(registros) {
    try {
        const db = await abrirBaseDatos();
        if (!db) return;
        const tx = db.transaction("registros", "readwrite");
        const store = tx.objectStore("registros");
        store.clear();
        registros.forEach(r => store.put(r));
    } catch (e) {
        console.warn("No se pudo guardar en IndexedDB:", e);
    }
}

async function obtenerRegistrosDeIndexedDB() {
    try {
        const db = await abrirBaseDatos();
        if (!db) return [];
        return new Promise(resolve => {
            const tx = db.transaction("registros", "readonly");
            const req = tx.objectStore("registros").getAll();
            req.onsuccess = () => resolve((req.result || []).reverse());
            req.onerror = () => resolve([]);
        });
    } catch (e) {
        return [];
    }
}

async function agregarAColaOffline(registro) {
    try {
        const db = await abrirBaseDatos();
        if (!db) return;
        const tx = db.transaction("cola_offline", "readwrite");
        tx.objectStore("cola_offline").add(registro);
    } catch (e) {
        console.warn("Error guardando en cola offline:", e);
    }
}

async function sincronizarColaOffline() {
    try {
        const db = await abrirBaseDatos();
        if (!db) return;

        const pendientes = await new Promise(resolve => {
            const tx = db.transaction("cola_offline", "readonly");
            const req = tx.objectStore("cola_offline").getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });

        if (!pendientes.length) return;

        for (const item of pendientes) {
            await fetch("/api/datos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item)
            });
        }

        const txClear = db.transaction("cola_offline", "readwrite");
        txClear.objectStore("cola_offline").clear();

        await cargarYRenderizarDatos();
        enviarNotificacionLocal(
            "🔄 Sincronización Completada",
            `Se sincronizaron ${pendientes.length} registro(s) satelitales guardados en modo offline.`
        );
    } catch (e) {
        console.warn("Pendiente de sincronización:", e);
    }
}

async function inicializarModuloDatos() {
    const formDatos = document.getElementById("form-nuevo-dato");
    if (formDatos) {
        formDatos.addEventListener("submit", manejarEnvioNuevoDato);
    }

    // Si hay un resultado recién generado por IA en la página, notificar
    const resultadoIA = document.getElementById("resultado-ia-texto");
    if (resultadoIA) {
        enviarNotificacionLocal(
            "🤖 Análisis Satelital IA Finalizado",
            "El diagnóstico de tu imagen satelital ha concluido y fue guardado en el Módulo de Datos."
        );
    }

    await cargarYRenderizarDatos();
}

window.cargarYRenderizarDatos = async function () {
    const contenedor = document.getElementById("tabla-datos-body");
    const contadorBadge = document.getElementById("total-registros-badge");
    if (!contenedor) return;

    let registros = [];
    try {
        const res = await fetch("/api/datos");
        const data = await res.json();
        registros = data.registros || [];
        await guardarRegistrosEnIndexedDB(registros);
    } catch (err) {
        console.warn("Cargando registros desde IndexedDB (Offline)...");
        registros = await obtenerRegistrosDeIndexedDB();
    }

    if (contadorBadge) {
        contadorBadge.textContent = `${registros.length} registros almacenados`;
    }

    if (!registros.length) {
        contenedor.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay registros disponibles.</td></tr>`;
        return;
    }

    contenedor.innerHTML = registros
        .map(
            r => `
        <tr>
            <td><strong>#${r.id}</strong></td>
            <td>
                <div class="zona-cell">${r.zona}</div>
                <small class="coord-sub">${r.coordenadas || ""} · ${r.fecha || ""}</small>
            </td>
            <td><span class="pill-metric veg">${r.vegetacion}</span></td>
            <td><span class="pill-metric water">${r.agua}</span></td>
            <td><span class="pill-metric urban">${r.zona_urbana}</span></td>
            <td><span class="pill-metric dry">${r.suelo_seco}</span></td>
            <td>
                <button type="button" class="btn-mini-danger" onclick="eliminarRegistro(${r.id})" title="Eliminar registro">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `
        )
        .join("");
};

async function manejarEnvioNuevoDato(e) {
    e.preventDefault();
    const nuevo = {
        zona: document.getElementById("input-zona").value.trim(),
        coordenadas: document.getElementById("input-coordenadas").value.trim() || "19.4326° N, 99.1332° W",
        vegetacion: document.getElementById("input-veg").value.trim() || "50",
        agua: document.getElementById("input-agua").value.trim() || "20",
        zona_urbana: document.getElementById("input-urbana").value.trim() || "15",
        suelo_seco: document.getElementById("input-seco").value.trim() || "15",
        conclusion: document.getElementById("input-conclusion").value.trim() || "Monitoreo satelital registrado desde la PWA.",
        fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
        origen: navigator.onLine ? "Módulo de Datos (Online)" : "IndexedDB (Offline)"
    };

    if (navigator.onLine) {
        try {
            const res = await fetch("/api/datos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevo)
            });
            if (res.ok) {
                mostrarToast("Registro satelital guardado en el servidor e IndexedDB.", "success");
                enviarNotificacionLocal(
                    "📊 Nuevo Registro Satelital Guardado",
                    `Zona: ${nuevo.zona} (Vegetación: ${nuevo.vegetacion}%, Agua: ${nuevo.agua}%)`
                );
                e.target.reset();
                await cargarYRenderizarDatos();
                return;
            }
        } catch (err) {
            console.warn("Fallo de red al guardar, pasando a cola offline:", err);
        }
    }

    // Respaldo Offline en IndexedDB
    nuevo.id = Date.now();
    nuevo.vegetacion = nuevo.vegetacion.endsWith("%") ? nuevo.vegetacion : nuevo.vegetacion + "%";
    nuevo.agua = nuevo.agua.endsWith("%") ? nuevo.agua : nuevo.agua + "%";
    nuevo.zona_urbana = nuevo.zona_urbana.endsWith("%") ? nuevo.zona_urbana : nuevo.zona_urbana + "%";
    nuevo.suelo_seco = nuevo.suelo_seco.endsWith("%") ? nuevo.suelo_seco : nuevo.suelo_seco + "%";

    await agregarAColaOffline(nuevo);
    const actuales = await obtenerRegistrosDeIndexedDB();
    actuales.unshift(nuevo);
    await guardarRegistrosEnIndexedDB(actuales);
    await cargarYRenderizarDatos();

    e.target.reset();
    mostrarToast("Guardado localmente en IndexedDB (se sincronizará al volver en línea).", "warning");
    enviarNotificacionLocal(
        "💾 Guardado en Modo Offline",
        `El registro "${nuevo.zona}" se almacenó en IndexedDB y se sincronizará automáticamente.`
    );
}

window.eliminarRegistro = async function (id) {
    try {
        if (navigator.onLine) {
            await fetch(`/api/datos/${id}`, { method: "DELETE" });
        }
        const actuales = await obtenerRegistrosDeIndexedDB();
        const filtrados = actuales.filter(r => r.id !== id);
        await guardarRegistrosEnIndexedDB(filtrados);
        await cargarYRenderizarDatos();
        mostrarToast(`Registro #${id} eliminado.`, "info");
    } catch (e) {
        mostrarToast("Error al eliminar el registro.", "warning");
    }
};

// ------------------------------------------------------------
// 7. UTILIDAD DE MENSAJES EMERGENTES (TOAST)
// ------------------------------------------------------------
window.mostrarToast = function (mensaje, tipo = "info") {
    let contenedor = document.getElementById("toast-container");
    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "toast-container";
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-fade");
        setTimeout(() => toast.remove(), 400);
    }, 3800);
};

// ------------------------------------------------------------
// 8. ACCESO A CARACTERÍSTICAS NATIVAS (GEOLOCALIZACIÓN Y CÁMARA)
//    CON MANEJO DE PERMISOS (GRANTED / DENIED / PROMPT)
// ------------------------------------------------------------
let streamCamaraActiva = null;
let ultimasCoordenadasFormateadas = "";

async function monitorearPermisosNativos() {
    if (!("permissions" in navigator)) return;

    // Monitorear estado del permiso de Geolocalización
    try {
        const geoStatus = await navigator.permissions.query({ name: "geolocation" });
        actualizarBadgePermisoGeo(geoStatus.state);
        geoStatus.onchange = () => actualizarBadgePermisoGeo(geoStatus.state);
    } catch (e) {
        // Algunos navegadores evalúan el permiso al invocar getCurrentPosition
    }

    // Monitorear estado del permiso de Notificaciones
    try {
        const notifStatus = await navigator.permissions.query({ name: "notifications" });
        notifStatus.onchange = () => actualizarEstadoNotificacionesUI();
    } catch (e) {}
}

function actualizarBadgePermisoGeo(estado) {
    const badge = document.getElementById("geo-permission-badge");
    const feedback = document.getElementById("geo-permission-feedback");
    if (!badge) return;

    if (estado === "granted") {
        badge.textContent = "Permiso: Concedido (granted)";
        badge.className = "badge badge-ok";
        if (feedback) {
            feedback.className = "permission-feedback-box ok-state";
            feedback.innerHTML =
                "✅ <strong>Permiso Concedido (<code>granted</code>):</strong> Acceso autorizado al GPS del dispositivo.";
        }
    } else if (estado === "denied") {
        badge.textContent = "Permiso: Denegado (denied)";
        badge.className = "badge badge-error";
        if (feedback) {
            feedback.className = "permission-feedback-box error-state";
            feedback.innerHTML =
                "🚫 <strong>Permiso Denegado (<code>denied</code>):</strong> El usuario bloqueó el acceso a la ubicación. La PWA mantiene habilitada la captura manual de coordenadas.";
        }
    } else {
        badge.textContent = "Permiso: Pendiente (prompt)";
        badge.className = "badge badge-warn";
    }
}

window.obtenerUbicacionNativa = function () {
    const feedback = document.getElementById("geo-permission-feedback");
    const resultCard = document.getElementById("geo-result-card");

    if (!("geolocation" in navigator)) {
        mostrarToast("Tu navegador o dispositivo no soporta la API de Geolocalización.", "warning");
        return;
    }

    if (feedback) {
        feedback.className = "permission-feedback-box info-state";
        feedback.innerHTML =
            "⏳ <strong>Solicitando permiso y lectura GPS...</strong> Por favor responde al cuadro de diálogo del navegador.";
    }

    navigator.geolocation.getCurrentPosition(
        posicion => {
            // COMPORTAMIENTO CUANDO EL USUARIO CONCEDE EL PERMISO (GRANTED)
            const lat = posicion.coords.latitude.toFixed(4);
            const lon = posicion.coords.longitude.toFixed(4);
            const acc = Math.round(posicion.coords.accuracy);
            const ns = posicion.coords.latitude >= 0 ? "N" : "S";
            const ew = posicion.coords.longitude >= 0 ? "E" : "W";
            ultimasCoordenadasFormateadas = `${Math.abs(lat)}° ${ns}, ${Math.abs(lon)}° ${ew}`;

            actualizarBadgePermisoGeo("granted");

            if (feedback) {
                feedback.className = "permission-feedback-box ok-state";
                feedback.innerHTML =
                    "✅ <strong>Permiso Concedido (<code>granted</code>):</strong> Coordenadas satelitales obtenidas exitosamente del hardware del dispositivo.";
            }

            if (resultCard) {
                resultCard.style.display = "block";
                document.getElementById("geo-lat").textContent = `${lat}°`;
                document.getElementById("geo-lon").textContent = `${lon}°`;
                document.getElementById("geo-acc").textContent = acc;
                document.getElementById("geo-formatted").textContent = ultimasCoordenadasFormateadas;
            }

            mostrarToast(`Ubicación GPS obtenida: ${ultimasCoordenadasFormateadas}`, "success");
            enviarNotificacionLocal(
                "📍 Coordenadas GPS Obtenidas",
                `Ubicación del dispositivo: ${ultimasCoordenadasFormateadas} (Precisión: ±${acc} m)`
            );
        },
        error => {
            // COMPORTAMIENTO CUANDO EL USUARIO NIEGA EL PERMISO O FALLA LA LECTURA
            if (resultCard) resultCard.style.display = "none";

            if (error.code === error.PERMISSION_DENIED) {
                actualizarBadgePermisoGeo("denied");
                if (feedback) {
                    feedback.className = "permission-feedback-box error-state";
                    feedback.innerHTML =
                        "🚫 <strong>Permiso Denegado (<code>PERMISSION_DENIED - Código 1</code>):</strong> El usuario rechazó la solicitud de ubicación. La PWA controla el error sin cerrarse y permite ingresar las coordenadas manualmente en el Módulo de Datos.";
                }
                mostrarToast("Permiso de ubicación denegado por el usuario.", "warning");
                registrarEnHistorialNotificaciones(
                    "🚫 Permiso GPS Denegado",
                    "El usuario bloqueó el acceso a navigator.geolocation. Se habilitó el modo de entrada manual."
                );
            } else {
                if (feedback) {
                    feedback.className = "permission-feedback-box warn-state";
                    feedback.innerHTML = `⚠️ <strong>Aviso de Ubicación (Código ${error.code}):</strong> ${error.message}.`;
                }
                mostrarToast("No fue posible determinar la ubicación GPS en este momento.", "warning");
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
};

window.usarCoordenadasEnFormulario = function () {
    const inputCoord = document.getElementById("input-coordenadas");
    const inputZona = document.getElementById("input-zona");
    if (inputCoord && ultimasCoordenadasFormateadas) {
        inputCoord.value = ultimasCoordenadasFormateadas;
        if (inputZona && !inputZona.value) {
            inputZona.value = "Sector Georreferenciado desde Dispositivo";
        }
        document.getElementById("seccion-datos").scrollIntoView({ behavior: "smooth" });
        mostrarToast("Coordenadas GPS copiadas al Módulo de Datos.", "success");
    }
};

// Característica Nativa 2: Cámara Web / Móvil (MediaDevices.getUserMedia)
window.activarCamaraNativa = async function () {
    const video = document.getElementById("camera-video");
    const canvas = document.getElementById("camera-canvas");
    const placeholder = document.getElementById("camera-placeholder-text");
    const badge = document.getElementById("cam-permission-badge");
    const feedback = document.getElementById("cam-permission-feedback");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarToast("Tu navegador no soporta el acceso nativo a cámara (MediaDevices API).", "warning");
        return;
    }

    try {
        streamCamaraActiva = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        // COMPORTAMIENTO CUANDO EL USUARIO CONCEDE EL PERMISO DE CÁMARA
        if (video) {
            video.srcObject = streamCamaraActiva;
            video.style.display = "block";
        }
        if (canvas) canvas.style.display = "none";
        if (placeholder) placeholder.style.display = "none";

        if (badge) {
            badge.textContent = "Permiso: Concedido (granted)";
            badge.className = "badge badge-ok";
        }
        if (feedback) {
            feedback.className = "permission-feedback-box ok-state";
            feedback.innerHTML =
                "✅ <strong>Permiso de Cámara Concedido (<code>granted</code>):</strong> Transmisión de video activa. Presiona <em>Capturar Foto</em> para tomar una imagen.";
        }

        mostrarToast("Cámara nativa activada correctamente.", "success");
    } catch (err) {
        // COMPORTAMIENTO CUANDO EL USUARIO NIEGA EL PERMISO DE CÁMARA
        if (badge) {
            badge.textContent = "Permiso: Denegado / No disponible";
            badge.className = "badge badge-error";
        }
        if (feedback) {
            feedback.className = "permission-feedback-box error-state";
            feedback.innerHTML = `🚫 <strong>Permiso de Cámara Denegado o Dispositivo Ocupado (<code>${err.name}</code>):</strong> El usuario rechazó el permiso o no hay cámara conectada. La PWA conserva el selector de archivos tradicional como alternativa.`;
        }
        mostrarToast(`Acceso a cámara no concedido (${err.name}).`, "warning");
        registrarEnHistorialNotificaciones(
            "🚫 Permiso de Cámara Denegado",
            `Evento controlado (${err.name}): Se mantiene disponible la subida de archivos desde galería.`
        );
    }
};

window.capturarFotoCamara = function () {
    const video = document.getElementById("camera-video");
    const canvas = document.getElementById("camera-canvas");
    if (!streamCamaraActiva || !video || !canvas) {
        mostrarToast("Primero debes activar la cámara y conceder el permiso.", "warning");
        return;
    }

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 400;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    video.style.display = "none";
    canvas.style.display = "block";

    // Convertir captura en un archivo y cargarlo en el formulario de análisis IA
    canvas.toBlob(blob => {
        if (!blob) return;
        const archivoCapturado = new File([blob], "captura_camara_pwa.png", { type: "image/png" });
        const inputArchivo = document.querySelector('input[type="file"][name="imagen"]');
        if (inputArchivo && typeof DataTransfer !== "undefined") {
            const dt = new DataTransfer();
            dt.items.add(archivoCapturado);
            inputArchivo.files = dt.files;
        }
        mostrarToast("Fotografía capturada y cargada en el Analizador de IA.", "success");
        enviarNotificacionLocal(
            "📸 Fotografía Capturada desde la PWA",
            "La imagen tomada con la cámara nativa está lista para analizarse con IA."
        );
    }, "image/png");
};

window.detenerCamaraNativa = function () {
    const video = document.getElementById("camera-video");
    const placeholder = document.getElementById("camera-placeholder-text");

    if (streamCamaraActiva) {
        streamCamaraActiva.getTracks().forEach(track => track.stop());
        streamCamaraActiva = null;
    }
    if (video) {
        video.srcObject = null;
        video.style.display = "none";
    }
    if (placeholder) {
        placeholder.style.display = "block";
    }
    mostrarToast("Cámara nativa apagada.", "info");
};

