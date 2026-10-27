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
    registrarServiceWorker();
    configurarDetectorRed();
    configurarInstalacionPWA();
    actualizarEstadoNotificacionesUI();
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
    if (!badgePermiso) return;

    if (!("Notification" in window)) {
        badgePermiso.textContent = "No soportadas en este navegador";
        badgePermiso.className = "badge badge-warn";
        return;
    }

    const p = Notification.permission;
    if (p === "granted") {
        badgePermiso.textContent = "Permiso Concedido (Activas)";
        badgePermiso.className = "badge badge-ok";
    } else if (p === "denied") {
        badgePermiso.textContent = "Permiso Bloqueado";
        badgePermiso.className = "badge badge-error";
    } else {
        badgePermiso.textContent = "Pendiente de Autorización";
        badgePermiso.className = "badge badge-warn";
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
        mostrarToast("¡Permiso de notificaciones concedido!", "success");
        await enviarNotificacionLocal(
            "🛰️ Notificaciones Activadas - SATELIT IA",
            "Recibirás alertas cuando concluya un análisis satelital o cambie la telemetría."
        );
    } else {
        mostrarToast("No se otorgó permiso para notificaciones.", "warning");
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
