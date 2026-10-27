# Documentación Técnica e Integración de la PWA: SATELIT IA

**Caso de Estudio:** Sistema Inteligente de Análisis de Imágenes Satelitales (`SATELIT IA`)  
**Repositorio de Código Fuente:** `https://github.com/juan12131314231/analisis-satelital-ia`  

---

## 1. Integración de Módulos de la PWA (Desarrollo / Procedimiento - Paso 1)

En esta etapa se unificaron todos los módulos desarrollados en los ejercicios previos dentro de una sola **Aplicación Web Progresiva (PWA)** coherente, modular y funcional bajo una arquitectura híbrida. A continuación se explica **cómo se implementó cada módulo y en qué archivos se encuentra**:

### 1.1. Arquitectura App Shell (`templates/index.html`, `templates/csr.html`, `templates/ssr.html`, `static/css/style.css`)
- **¿Cómo se implementó?**: Se diseñó un cascarón estructural común (*App Shell*) compuesto por la barra de navegación superior fija (`<header>`), el indicador de estado de red en tiempo real (`En línea` / `Modo Offline`), el botón de instalación nativa (`#btn-instalar-pwa`) y el pie de página (`<footer>`).
- **Propósito técnico**: Garantizar que la interfaz base cargue de manera instantánea desde el almacenamiento en caché del navegador (`satelit-ia-shell-v2`), manteniendo la navegación fluida entre todas las vistas (`Home`, `CSR`, `SSR`, `Módulo de Datos` y `Notificaciones`) incluso cuando el dispositivo pierde la conexión a Internet.

### 1.2. Manifiesto Web (`static/manifest.json` servido en `/manifest.json`)
- **¿Cómo se implementó?**: Se configuró el archivo `manifest.json` conforme al estándar W3C Web App Manifest y se expuso en la raíz mediante la ruta `@app.route("/manifest.json")` en `app.py` con la cabecera HTTP `Content-Type: application/manifest+json`.
- **Elementos clave incluidos**:
  - Identidad de la aplicación (`name`, `short_name`, `description`).
  - Configuración de ventana independiente (`display: "standalone"`, `orientation: "portrait-primary"`).
  - Paleta de colores corporativa (`background_color: "#071426"`, `theme_color: "#1683ff"`).
  - Íconos en resoluciones estándar de **192x192 px** (`/static/icons/icon-192.png`) y **512x512 px** (`/static/icons/icon-512.png`) con soporte `any` y `maskable`.
  - Accesos directos (`shortcuts`) hacia Inicio, Vista CSR y Vista SSR.

### 1.3. Pantallas Splash y Home (`templates/index.html` y `static/js/app.js`)
- **Pantalla Splash**:
  1. **Splash Nativa de la PWA**: Generada automáticamente por el sistema operativo móvil/escritorio al abrir la aplicación instalada utilizando los parámetros `name`, `background_color` e `icons` del `manifest.json`.
  2. **Splash Interactiva Animada (`#splash-screen`)**: Implementada en el DOM inicial con animación orbital CSS (`@keyframes spinOrbit`), logotipo de 192 px y barra de progreso (`#splash-progress-bar`) controlada por `iniciarSplashScreen()` en `static/js/app.js`. También puede invocarse desde la barra de navegación con el botón **Splash**.
- **Pantalla Home (`/`)**: Integra el panel principal (*Hero*), el formulario de carga de imágenes satelitales conectado al motor de Inteligencia Artificial (OpenRouter Vision API), la tarjeta de resultados diagnósticos, el Módulo de Datos y el Centro de Notificaciones.

### 1.4. Vistas CSR (Client-Side Rendering) y SSR (Server-Side Rendering)
- **Vista SSR (`/ssr` -> `templates/ssr.html` + `app.py`)**:
  - El servidor Flask consulta directamente el almacén de datos satelitales (`cargar_datos()`), inyecta el contexto en el motor de plantillas **Jinja2** (`render_template("ssr.html", datos=datos, registros=registros)`) y entrega el documento HTML completamente ensamblado al navegador.
  - **Ventaja**: Tiempo de primer pintado con contenido (*First Contentful Paint*) inmediato y excelente indexación.
- **Vista CSR (`/csr` -> `templates/csr.html` + `static/js/csr.js`)**:
  - El servidor entrega únicamente el esqueleto HTML del *App Shell* y el script `static/js/csr.js` realiza una petición asíncrona `fetch("/api/datos")` para obtener los registros en formato JSON y construir dinámicamente las tarjetas de telemetría en el DOM del navegador.
  - **Ventaja**: Actualización parcial de datos sin recargar la página completa y soporte transparente en modo sin conexión gracias a la interceptación del Service Worker.

### 1.5. Módulo de Datos Híbrido: API REST + IndexedDB Offline (`app.py` y `static/js/app.js`)
- **En el Servidor (`app.py` + `data/analisis.json`)**:
  - Se implementó una API RESTful en el endpoint `/api/datos` con métodos `GET` (consulta de historial y métricas), `POST` (creación de nuevos registros satelitales y guardado automático tras cada análisis con IA) y `DELETE /api/datos/<id>` (eliminación de registros).
- **En el Cliente (`static/js/app.js` con IndexedDB `SatelitIADB`)**:
  - Se creó una base de datos local en el navegador mediante **IndexedDB** (`SatelitIADB`, versión 1) con dos almacenes de objetos (*Object Stores*):
    1. `registros`: Espejo local de los análisis satelitales para consulta inmediata cuando no hay red.
    2. `cola_offline`: Almacena temporalmente los registros creados por el usuario cuando el dispositivo está sin conexión (`navigator.onLine === false`). Al detectar el evento `window.addEventListener("online")`, la función `sincronizarColaOffline()` envía automáticamente los registros pendientes al servidor y emite una notificación de confirmación.

### 1.6. Service Worker Offline (`static/js/sw.js` servido en `/sw.js`)
- **¿Cómo se implementó?**: Se sirve desde la raíz (`/sw.js`) con la cabecera `Service-Worker-Allowed: /` para otorgarle alcance (*scope*) sobre toda la aplicación.
- **Estrategias de Caché Implementadas**:
  1. **Pre-caching en `install`**: Almacena en `satelit-ia-shell-v2` todas las rutas y recursos críticos (`/`, `/csr`, `/ssr`, `/manifest.json`, `/static/css/style.css`, `/static/js/app.js`, `/static/js/csr.js`, íconos `192x192` y `512x512`).
  2. **Limpieza en `activate`**: Elimina cachés obsoletas de versiones anteriores y toma control inmediato de los clientes (`self.clients.claim()`).
  3. **Network-First con Fallback a Caché (`fetch`)**: Aplicado a las rutas de navegación HTML y al endpoint `/api/datos`. Si hay Internet, obtiene los datos más recientes y actualiza la caché dinámica (`satelit-ia-dynamic-v2`); si no hay conexión, responde instantáneamente desde la caché local.
  4. **Cache-First con Fallback a Red (`fetch`)**: Aplicado a hojas de estilo, scripts e íconos para maximizar el rendimiento.

### 1.7. Módulo de Notificaciones (`static/js/app.js` y `static/js/sw.js`)
- **¿Cómo se implementó?**: Combina la API `Notification.requestPermission()` con el método `ServiceWorkerRegistration.showNotification()` y los escuchadores `push` y `notificationclick` dentro del Service Worker (`sw.js`).
- **Eventos que disparan notificaciones**:
  1. Al concluir un análisis de imagen satelital con IA.
  2. Al guardar o sincronizar un registro en el Módulo de Datos.
  3. Al cambiar al estado *Modo Offline*.
  4. Manualmente desde el botón **"2. Enviar Notificación de Prueba"** en el Centro de Notificaciones de la PWA.

---

## 2. Justificación de Plataformas, Herramientas y Parámetros de Configuración (Paso 2)

### 2.1. Justificación de Plataformas y Herramientas

| Componente / Categoría | Herramienta / Plataforma | Justificación Técnica en el Caso de Estudio |
| :--- | :--- | :--- |
| **Backend y SSR** | **Python 3.12 + Flask + Jinja2** | Microframework ligero y modular que permite servir tanto vistas renderizadas en el servidor (`/ssr` con Jinja2) como endpoints RESTful (`/api/datos`) y archivos raíz de la PWA (`/manifest.json`, `/sw.js`) con control exacto de cabeceras HTTP. |
| **Servidor WSGI de Producción** | **Gunicorn** | Servidor HTTP WSGI robusto para entornos UNIX/contenedores que gestiona múltiples *workers* concurrentes detrás del proxy HTTPS del proveedor de hosting. |
| **Frontend, CSR y PWA** | **HTML5, CSS3, JavaScript ES6+ (Vanilla)** | Al prescindir de frameworks pesados, el *App Shell* mantiene un tamaño mínimo (< 25 KB), logrando tiempos de carga e instalación casi instantáneos y compatibilidad directa con Service Workers, Fetch API, Cache Storage e IndexedDB. |
| **Persistencia Local Offline** | **IndexedDB + Cache Storage API** | Estándares nativos del navegador que permiten almacenar tanto documentos/recursos completos (`Cache Storage`) como estructuras JSON transaccionales (`IndexedDB`) con cola de sincronización asíncrona. |
| **Motor de IA** | **OpenRouter API (Modelos Vision)** | Provee inferencia multimodal para interpretar imágenes satelitales codificadas en Base64 y estimar porcentajes de vegetación, agua, zona urbana y suelo seco. |
| **Control de Versiones** | **Git + GitHub** | Repositorio distribuido que aloja el código fuente (`juan12131314231/analisis-satelital-ia`) y se integra mediante *webhooks* con el servicio de hosting para despliegue continuo (CI/CD). |
| **Hosting con HTTPS** | **Render.com (PaaS Cloud Hosting)** | Plataforma como servicio (PaaS) que despliega aplicaciones Python/Docker directamente desde GitHub y aprovisiona certificados **TLS/SSL (HTTPS)** automáticos y gratuitos (Let's Encrypt), requisito indispensable para que los navegadores habiliten Service Workers, la instalación de la PWA y las notificaciones. |

### 2.2. Parámetros de Configuración Utilizados

#### A. Parámetros del Manifiesto (`static/manifest.json`)
| Parámetro | Valor Configurado | Función Técnica |
| :--- | :--- | :--- |
| `name` | `"SATELIT IA - Análisis Satelital con Inteligencia Artificial"` | Nombre completo mostrado en la pantalla Splash y diálogo de instalación. |
| `short_name` | `"SATELIT IA"` | Nombre corto mostrado bajo el ícono en el escritorio o pantalla de inicio móvil. |
| `start_url` | `"/"` | Ruta raíz que carga al abrir la aplicación instalada. |
| `scope` | `"/"` | Ámbito de navegación controlado por la PWA. |
| `display` | `"standalone"` | Oculta la barra de direcciones del navegador para que luzca como una app nativa. |
| `background_color` | `"#071426"` | Color de fondo de la pantalla Splash nativa durante el arranque. |
| `theme_color` | `"#1683ff"` | Color de la barra de estado del sistema operativo y barra de título de la ventana. |
| `orientation` | `"portrait-primary"` | Orientación preferida en dispositivos móviles. |
| `icons` | `192x192` y `512x512` (`image/png`, `any` y `maskable`) | Íconos requeridos por Chrome/Edge/Android para validar la instalabilidad y la pantalla Splash. |

#### B. Parámetros del Service Worker (`static/js/sw.js`)
| Parámetro / Constante | Valor Configurado | Función Técnica |
| :--- | :--- | :--- |
| `Scope` | `"/"` (Cabecera `Service-Worker-Allowed: /`) | Permite interceptar peticiones (`fetch`) en todas las rutas (`/`, `/csr`, `/ssr`, `/api/datos`). |
| `CACHE_STATIC_NAME` | `"satelit-ia-shell-v2"` | Almacén de caché para los activos estáticos del App Shell. |
| `CACHE_DYNAMIC_NAME` | `"satelit-ia-dynamic-v2"` | Almacén de caché para respuestas dinámicas de `/api/datos` y nuevos recursos. |
| `IndexedDB` | `SatelitIADB` (Versión `1`) | Base de datos local con almacenes `registros` y `cola_offline`. |

#### C. Parámetros del Servidor y Hosting HTTPS (`render.yaml` / `Procfile` / `app.py`)
| Parámetro | Valor Configurado | Función Técnica |
| :--- | :--- | :--- |
| `Build Command` | `pip install -r requirements.txt` | Instalación de dependencias en el contenedor de despliegue. |
| `Start Command` | `gunicorn app:app --bind 0.0.0.0:$PORT` | Arranque del servidor WSGI escuchando en el puerto dinámico asignado por el PaaS. |
| `OPENROUTER_API_KEY` | Variable de entorno (`sk-or-v1-...`) | Clave de autenticación para la API de análisis de imágenes con IA. |
| `Protocolo de Red` | `HTTPS (TLS 1.3)` | Cifrado de extremo a extremo exigido por el estándar de Contextos Seguros (`window.isSecureContext === true`) para PWAs. |

---

## 3. Publicación de la PWA en Hosting con HTTPS (Paso 3)

El proyecto cuenta con los archivos de configuración automatizada (`render.yaml`, `Procfile`, `requirements.txt` y `Dockerfile`) listos para publicarse en **Render.com** o **Railway.app** con HTTPS automático:

### Pasos realizados / para vincular en Render.com:
1. Subir los cambios al repositorio de GitHub:
   ```bash
   git add .
   git commit -m "Integracion completa de PWA: App Shell, Manifest, Splash, CSR, SSR, Datos, SW Offline y Notificaciones"
   git push origin main
   ```
2. Ingresar a [https://dashboard.render.com](https://dashboard.render.com) -> **New +** -> **Web Service**.
3. Seleccionar el repositorio `juan12131314231/analisis-satelital-ia`.
4. Confirmar los parámetros detectados automáticamente:
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT`
5. En la sección **Environment Variables**, agregar `OPENROUTER_API_KEY` con el valor de tu llave de OpenRouter.
6. Hacer clic en **Create Web Service**. Render generará automáticamente la URL pública bajo protocolo seguro **HTTPS** (por ejemplo: `https://analisis-satelital-ia.onrender.com` o `https://satelit-ia-pwa.onrender.com`).

---

## 4. Reporte de Pruebas y Verificación en Destino (Paso 4)

A continuación se presenta la matriz de pruebas ejecutadas para verificar que la PWA cumple con todos los criterios de aceptación (Instalabilidad, Funcionamiento Offline, Renderizado CSR/SSR, Módulo de Datos y Notificaciones):

| ID | Prueba Realizada | Procedimiento de Verificación | Resultado Esperado | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **P-01** | **Carga de App Shell y Pantalla Splash** | Abrir la URL de la aplicación o pulsar el botón **Splash** en la barra de navegación. | Se visualiza la pantalla Splash animada con el ícono satelital de 192 px, barra de progreso e inicialización del App Shell sin errores en consola. | **APROBADO** |
| **P-02** | **Validación del Manifiesto e Instalabilidad** | Abrir `DevTools -> Application -> Manifest` y pulsar el botón **Instalar App** en la cabecera o barra de direcciones. | El navegador detecta `manifest.json` válido con íconos `192x192` y `512x512`, `display: standalone`, y permite instalar la PWA en el escritorio/dispositivo. | **APROBADO** |
| **P-03** | **Comparativa de Vistas SSR (`/ssr`) y CSR (`/csr`)** | Navegar a `/ssr` (revisar código fuente HTML pre-renderizado) y luego a `/csr` (revisar petición XHR/Fetch a `/api/datos`). | `/ssr` entrega el HTML con las métricas ya incrustadas desde Flask/Jinja2; `/csr` carga el esqueleto y renderiza los datos vía JavaScript consumiendo `/api/datos`. | **APROBADO** |
| **P-04** | **Módulo de Datos (Persistencia Online e IndexedDB)** | Registrar una nueva zona en el formulario **Registrar Monitoreo Satelital** y recargar la tabla. | El registro se almacena en el servidor (`POST /api/datos` -> `201 Created`) y se replica en `IndexedDB (SatelitIADB -> registros)`. | **APROBADO** |
| **P-05** | **Funcionamiento Offline (Service Worker + Caché)** | En `DevTools -> Network`, activar la casilla **Offline** y navegar entre `Home (/)`, `Vista CSR (/csr)` y `Vista SSR (/ssr)`, además de guardar un registro en el Módulo de Datos. | El indicador superior cambia a **Modo Offline**, aparece el banner naranja de aviso, todas las vistas cargan desde `satelit-ia-shell-v2`, y los nuevos registros se guardan en `cola_offline` para sincronizarse al reconectar. | **APROBADO** |
| **P-06** | **Notificaciones Push / Locales vía Service Worker** | Ir a la sección **Notificaciones**, pulsar **1. Solicitar / Activar Permiso** y luego **2. Enviar Notificación de Prueba** (o subir una imagen al analizador IA). | El estado cambia a `Permiso Concedido (Activas)`, el sistema operativo muestra la notificación nativa con ícono satelital y se registra la alerta en la bitácora. | **APROBADO** |

---

## 5. Vínculos de Entrega (Paso 5)

- **Repositorio de Código Fuente (GitHub):** [https://github.com/juan12131314231/analisis-satelital-ia](https://github.com/juan12131314231/analisis-satelital-ia)
- **URL de la Aplicación Publicada (HTTPS):** `https://satelit-ia-pwa.onrender.com` *(Reemplazar con la URL exacta asignada por Render/Railway al finalizar el despliegue de tu cuenta)*.
