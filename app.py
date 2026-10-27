from flask import Flask, request, render_template, jsonify, make_response
import requests
import base64
import os
import json
from datetime import datetime
from dotenv import load_dotenv

# Buscar .env en la misma carpeta donde está app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "analisis.json")

load_dotenv(ENV_FILE)

app = Flask(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ============================================================
# CONFIGURACIÓN
# ============================================================

# Comprobación temporal para saber si Flask encuentra la API Key
print("========================================")
print("SATELIT IA - PWA INTEGRADA")
print("========================================")

if OPENROUTER_API_KEY:
    print("API KEY CARGADA: True")
    print("Longitud de la API Key:", len(OPENROUTER_API_KEY))
else:
    print("API KEY CARGADA: False")
    print("AVISO: No se encontró OPENROUTER_API_KEY (se usará simulación local de respaldo)")

print("========================================")


# ============================================================
# MÓDULO DE DATOS (PERSISTENCIA EN JSON + API REST)
# ============================================================

DATOS_INICIALES = [
    {
        "id": 1,
        "zona": "Reserva de la Biosfera Calakmul, MX",
        "coordenadas": "18.1054° N, 89.8108° W",
        "fecha": "2026-10-24 14:20",
        "vegetacion": "78%",
        "agua": "8%",
        "zona_urbana": "4%",
        "suelo_seco": "10%",
        "conclusion": "Alta densidad de cobertura forestal húmeda sin indicios recientes de deforestación crítica.",
        "origen": "Satélite Sentinel-2"
    },
    {
        "id": 2,
        "zona": "Cuenca del Valle de México, MX",
        "coordenadas": "19.4326° N, 99.1332° W",
        "fecha": "2026-10-25 11:05",
        "vegetacion": "22%",
        "agua": "6%",
        "zona_urbana": "58%",
        "suelo_seco": "14%",
        "conclusion": "Predominio de mancha urbana densa e infraestructura vial; se recomienda ampliar áreas verdes.",
        "origen": "Satélite Landsat-9"
    },
    {
        "id": 3,
        "zona": "Sistema Lagunar de Alvarado, VER",
        "coordenadas": "18.7686° N, 95.7589° W",
        "fecha": "2026-10-26 09:40",
        "vegetacion": "48%",
        "agua": "35%",
        "zona_urbana": "7%",
        "suelo_seco": "10%",
        "conclusion": "Equilibrio hidrológico estable con presencia de manglares saludables en la ribera.",
        "origen": "Análisis IA"
    }
]


def cargar_datos():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(DATOS_INICIALES, f, ensure_ascii=False, indent=4)
        return list(DATOS_INICIALES)
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return list(DATOS_INICIALES)


def guardar_datos(lista_datos):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(lista_datos, f, ensure_ascii=False, indent=4)


# ============================================================
# CONVERTIR IMAGEN A BASE64
# ============================================================

def imagen_a_base64(archivo):

    imagen_bytes = archivo.read()

    return base64.b64encode(imagen_bytes).decode("utf-8")


# ============================================================
# ANALIZAR IMAGEN CON OPENROUTER
# ============================================================

def analizar_con_ia(imagen_base64):

    if not OPENROUTER_API_KEY:

        return """1. Verificación de imagen satelital:
Sí, la imagen procesada corresponde a una captura de observación terrestre (Modo Demostración / Respaldo Local).

2. Elementos detectados y porcentajes aproximados:
   - Vegetación: 65%
   - Agua: 15%
   - Zonas urbanas: 10%
   - Carreteras: 3%
   - Suelo seco: 7%

3. Explicación de lo observado:
Se aprecia una cobertura vegetal predominante acompañada de un cuerpo de agua secundario y trazas de asentamientos humanos conectados por vías terrestres.

4. Conclusión:
El ecosistema presenta un balance saludable de biomasa con impacto urbano moderado.

5. Recomendación:
Monitorear periódicamente las zonas de suelo seco colindantes para prevenir erosión."""

    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {

        "Authorization": f"Bearer {OPENROUTER_API_KEY}",

        "Content-Type": "application/json",

        "HTTP-Referer": "http://127.0.0.1:5000",

        "X-Title": "SATELIT IA"

    }

    data = {

        # Router gratuito de OpenRouter
        "model": "openrouter/free",

        "messages": [

            {

                "role": "user",

                "content": [

                    {

                        "type": "text",

                        "text": """
Analiza esta imagen satelital en español.

Realiza el análisis de forma clara y sencilla.

Dime:

1. Si parece una imagen satelital.

2. Qué elementos detectas:
   - Vegetación
   - Agua
   - Zonas urbanas
   - Carreteras
   - Suelo seco

3. Da porcentajes aproximados de cada elemento.

4. Explica brevemente lo observado.

5. Proporciona una conclusión.

6. Proporciona una recomendación.

Si la imagen no parece satelital, indícalo claramente.
"""

                    },

                    {

                        "type": "image_url",

                        "image_url": {

                            "url": f"data:image/jpeg;base64,{imagen_base64}"

                        }

                    }

                ]

            }

        ]

    }

    try:

        print("Enviando imagen a OpenRouter...")

        response = requests.post(

            url,

            headers=headers,

            json=data,

            timeout=90

        )

        print("Código recibido:", response.status_code)

        # ----------------------------------------------------
        # ERROR DE AUTENTICACIÓN
        # ----------------------------------------------------

        if response.status_code == 401:

            return """
ERROR 401 - API Key no autorizada.

OpenRouter rechazó la API Key.

Verifica tu archivo .env y asegúrate de utilizar
una API Key válida de OpenRouter.
"""

        # ----------------------------------------------------
        # ERROR DE LÍMITE
        # ----------------------------------------------------

        if response.status_code == 429:

            return """
ERROR 429 - Demasiadas solicitudes.

El modelo gratuito puede haber alcanzado temporalmente
su límite de solicitudes.

Espera unos minutos e intenta nuevamente.
"""

        # ----------------------------------------------------
        # OTROS ERRORES HTTP
        # ----------------------------------------------------

        if response.status_code != 200:

            print("Respuesta de OpenRouter:")

            print(response.text)

            return f"""
Error de OpenRouter.

Código HTTP:
{response.status_code}

Respuesta:
{response.text}
"""

        # ----------------------------------------------------
        # PROCESAR RESPUESTA
        # ----------------------------------------------------

        resultado = response.json()

        # Comprobar que exista choices

        if "choices" not in resultado:

            print("Respuesta inesperada:")

            print(resultado)

            return """
OpenRouter respondió, pero no se encontró
el contenido esperado.
"""

        mensaje = resultado["choices"][0]["message"]

        contenido = mensaje.get("content")

        if not contenido:

            return """
OpenRouter no devolvió contenido de texto.
"""

        print("Análisis recibido correctamente.")

        return contenido

    # --------------------------------------------------------
    # ERROR SSL
    # --------------------------------------------------------

    except requests.exceptions.SSLError:

        return """
ERROR SSL.

Tu computadora o red no pudo establecer
una conexión segura con OpenRouter.
"""

    # --------------------------------------------------------
    # ERROR DE CONEXIÓN
    # --------------------------------------------------------

    except requests.exceptions.ConnectionError:

        return """
ERROR DE CONEXIÓN.

No fue posible conectarse con OpenRouter.

Comprueba tu conexión a Internet.
"""

    # --------------------------------------------------------
    # TIMEOUT
    # --------------------------------------------------------

    except requests.exceptions.Timeout:

        return """
ERROR DE TIEMPO DE ESPERA.

OpenRouter tardó demasiado en responder.

Intenta nuevamente.
"""

    # --------------------------------------------------------
    # ERROR HTTP
    # --------------------------------------------------------

    except requests.exceptions.RequestException as e:

        return f"""
ERROR CONECTANDO CON OPENROUTER:

{e}
"""

    # --------------------------------------------------------
    # ERROR GENERAL
    # --------------------------------------------------------

    except Exception as e:

        print("Error inesperado:")

        print(e)

        return f"""
ERROR INESPERADO:

{e}
"""


# ============================================================
# PÁGINA PRINCIPAL (APP SHELL + HOME + SPLASH + DATOS)
# ============================================================

@app.route("/", methods=["GET", "POST"])
def index():

    respuesta = None
    nombre_archivo = None

    if request.method == "POST":

        # Comprobar si llegó el archivo

        if "imagen" not in request.files:

            respuesta = "No se recibió ninguna imagen."

            return render_template(

                "index.html",

                respuesta=respuesta,
                registros=cargar_datos()

            )

        archivo = request.files["imagen"]

        # Comprobar que se haya seleccionado un archivo

        if archivo.filename == "":

            respuesta = "No seleccionaste ninguna imagen."

            return render_template(

                "index.html",

                respuesta=respuesta,
                registros=cargar_datos()

            )

        try:
            nombre_archivo = archivo.filename

            # Convertir imagen

            imagen_base64 = imagen_a_base64(archivo)

            # Analizar imagen

            respuesta = analizar_con_ia(imagen_base64)

            # Guardar en el módulo de datos automáticamente
            registros = cargar_datos()
            nuevo_id = max([r.get("id", 0) for r in registros], default=0) + 1
            resumen = respuesta.strip().replace("\n", " ")[:160] + "..."
            registros.insert(0, {
                "id": nuevo_id,
                "zona": f"Captura: {nombre_archivo}",
                "coordenadas": "Análisis por Imagen IA",
                "fecha": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "vegetacion": "65%",
                "agua": "15%",
                "zona_urbana": "10%",
                "suelo_seco": "10%",
                "conclusion": resumen,
                "origen": "OpenRouter Vision IA"
            })
            guardar_datos(registros)

        except Exception as e:

            respuesta = f"""

            Error procesando la imagen:

            {e}

            """

    return render_template(

        "index.html",

        respuesta=respuesta,
        registros=cargar_datos()

    )


# ============================================================
# API DEL MÓDULO DE DATOS (PARA CSR, SINCRONIZACIÓN Y CRUD)
# ============================================================

@app.route("/api/datos", methods=["GET", "POST"])
def api_datos():
    if request.method == "GET":
        registros = cargar_datos()
        resumen = registros[0] if registros else {
            "vegetacion": "65%",
            "agua": "15%",
            "zona_urbana": "10%",
            "suelo_seco": "10%"
        }
        return jsonify({
            "status": "ok",
            "titulo": "Análisis Satelital con IA (Renderizado CSR)",
            "descripcion": "Datos obtenidos dinámicamente vía Fetch API en formato JSON y almacenados en IndexedDB para soporte Offline.",
            "resumen": {
                "vegetacion": resumen.get("vegetacion", "65%"),
                "agua": resumen.get("agua", "15%"),
                "zona_urbana": resumen.get("zona_urbana", "10%"),
                "suelo_seco": resumen.get("suelo_seco", "10%")
            },
            "registros": registros,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

    # POST: Crear nuevo registro en el módulo de datos
    cuerpo = request.get_json(silent=True) or {}
    registros = cargar_datos()
    nuevo_id = max([r.get("id", 0) for r in registros], default=0) + 1

    def fmt_pct(val, defecto="0%"):
        s = str(val).strip() if val is not None else defecto
        return s if s.endswith("%") else f"{s}%"

    nuevo_registro = {
        "id": nuevo_id,
        "zona": cuerpo.get("zona") or "Sector Satelital Personalizado",
        "coordenadas": cuerpo.get("coordenadas") or "19.4326° N, 99.1332° W",
        "fecha": cuerpo.get("fecha") or datetime.now().strftime("%Y-%m-%d %H:%M"),
        "vegetacion": fmt_pct(cuerpo.get("vegetacion", "60%")),
        "agua": fmt_pct(cuerpo.get("agua", "15%")),
        "zona_urbana": fmt_pct(cuerpo.get("zona_urbana", "15%")),
        "suelo_seco": fmt_pct(cuerpo.get("suelo_seco", "10%")),
        "conclusion": cuerpo.get("conclusion") or "Registro telemétrico almacenado desde el módulo de datos de la PWA.",
        "origen": cuerpo.get("origen") or "Módulo de Datos PWA"
    }

    registros.insert(0, nuevo_registro)
    guardar_datos(registros)

    return jsonify({
        "status": "created",
        "mensaje": "Registro satelital guardado exitosamente.",
        "registro": nuevo_registro
    }), 201


@app.route("/api/datos/<int:registro_id>", methods=["DELETE"])
def eliminar_dato(registro_id):
    registros = cargar_datos()
    nuevos = [r for r in registros if r.get("id") != registro_id]
    guardar_datos(nuevos)
    return jsonify({
        "status": "deleted",
        "id": registro_id
    })


# ============================================================
# MANIFEST DE LA PWA
# ============================================================

@app.route("/manifest.json")
def manifest():
    response = make_response(app.send_static_file("manifest.json"))
    response.headers["Content-Type"] = "application/manifest+json"
    return response


# ============================================================
# SERVICE WORKER
# ============================================================

@app.route("/sw.js")
def service_worker():
    response = make_response(app.send_static_file("js/sw.js"))
    response.headers["Content-Type"] = "application/javascript"
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


# ============================================================
# PRÁCTICA 1.3 - SSR (SERVER-SIDE RENDERING)
# ============================================================

@app.route("/ssr")
def ssr():
    registros = cargar_datos()
    ultimo = registros[0] if registros else {}

    datos = {

        "titulo":
            "Análisis Satelital con IA (Vista SSR)",

        "descripcion":
            "Esta vista es generada completamente en el servidor (Server-Side Rendering) mediante Flask y el motor de plantillas Jinja2 antes de enviarse al navegador.",

        "vegetacion":
            ultimo.get("vegetacion", "65%"),

        "agua":
            ultimo.get("agua", "15%"),

        "zona_urbana":
            ultimo.get("zona_urbana", "10%"),

        "suelo_seco":
            ultimo.get("suelo_seco", "10%"),

        "zona_actual":
            ultimo.get("zona", "Reserva de la Biosfera Calakmul, MX"),

        "fecha_actual":
            ultimo.get("fecha", datetime.now().strftime("%Y-%m-%d %H:%M"))

    }

    return render_template(

        "ssr.html",

        datos=datos,
        registros=registros

    )


# ============================================================
# PRÁCTICA 1.3 - CSR (CLIENT-SIDE RENDERING)
# ============================================================

@app.route("/csr")
def csr():

    return render_template("csr.html")


# ============================================================
# EJECUTAR SERVIDOR
# ============================================================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))
    app.run(

        debug=True,

        host="0.0.0.0",

        port=port

    )