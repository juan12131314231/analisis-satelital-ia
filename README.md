# 🛰️ SATELIT IA — Aplicación Web Progresiva (PWA) de Análisis Satelital con IA

Proyecto integrador que unifica **App Shell**, **Web App Manifest**, **Pantallas Splash y Home**, **Renderizado CSR y SSR**, **Módulo de Datos Híbrido (API REST + IndexedDB Offline)**, **Service Worker Offline** y **Notificaciones Web/Push** en una sola PWA para el análisis inteligente de imágenes satelitales.

---

## 🚀 Módulos Integrados en la PWA

1. **App Shell (`templates/*.html`, `static/css/style.css`, `static/js/app.js`)**: Cabecera fija, navegación unificada, detector de conexión en tiempo real (`En línea` / `Modo Offline`) y botón nativo de instalación (`beforeinstallprompt`).
2. **Manifiesto Web (`static/manifest.json` -> `/manifest.json`)**: Configurado con `display: standalone`, colores de tema (`#1683ff` / `#071426`), accesos directos (`shortcuts`) e íconos de `192x192` y `512x512` (`any` y `maskable`).
3. **Pantallas Splash y Home (`/`)**: Splash nativa de PWA + Splash animada interactiva (`#splash-screen`), junto con la vista Home y el analizador de imágenes satelitales con IA (OpenRouter Vision).
4. **Vistas CSR (`/csr`) y SSR (`/ssr`)**:
   - `/ssr`: Renderizado del lado del servidor mediante **Flask + Jinja2**.
   - `/csr`: Renderizado del lado del cliente consumiendo dinámicamente `/api/datos` vía **Fetch API**.
5. **Módulo de Datos (`app.py`, `data/analisis.json` e `IndexedDB`)**: Operaciones CRUD en `/api/datos` sincronizadas con la base de datos local `SatelitIADB` (`registros` y `cola_offline`) para soporte **Offline-First**.
6. **Service Worker Offline (`static/js/sw.js` -> `/sw.js`)**: Estrategia híbrida *Cache-First* para recursos estáticos y *Network-First con Fallback a Caché* para navegación y datos JSON.
7. **Notificaciones (`Notification API` + `ServiceWorkerRegistration.showNotification`)**: Alertas nativas al finalizar un análisis con IA, guardar registros, cambiar a modo offline o mediante el botón de prueba.

---

## 📄 Documentación Técnica Completa para Entrega

Toda la justificación de plataformas y herramientas, tablas de parámetros de configuración, guía de publicación con HTTPS y reporte de pruebas se encuentran detallados en:

👉 **[Ver Documentación Completa (`DOCUMENTACION_PWA.md`)](./DOCUMENTACION_PWA.md)**

---

## 🛠️ Ejecución Local

```bash
pip install -r requirements.txt
python app.py
```

Abrir en el navegador: `http://127.0.0.1:5000`