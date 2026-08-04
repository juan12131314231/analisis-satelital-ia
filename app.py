from flask import Flask, request, render_template
import requests
import base64
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


def imagen_a_base64(archivo):
    imagen_bytes = archivo.read()
    return base64.b64encode(imagen_bytes).decode("utf-8")


def analizar_con_ia(imagen_base64):
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "openrouter/free",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """
Analiza esta imagen satelital en español.

Dime:
1. Si parece una imagen satelital.
2. Qué detectas: vegetación, agua, zonas urbanas, carreteras o suelo seco.
3. Porcentajes aproximados.
4. Conclusión.
5. Recomendación.
"""
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{imagen_base64}"
                        }
                    }
                ]
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()

        resultado = response.json()
        return resultado["choices"][0]["message"]["content"]

    except requests.exceptions.SSLError:
        return "Error SSL: tu PC o red no pudo conectarse de forma segura con OpenRouter."

    except requests.exceptions.RequestException as e:
        return f"Error conectando con OpenRouter: {e}"

    except Exception as e:
        return f"Error inesperado: {e}"


@app.route("/", methods=["GET", "POST"])
def index():
    respuesta = None

    if request.method == "POST":
        archivo = request.files["imagen"]
        imagen_base64 = imagen_a_base64(archivo)
        respuesta = analizar_con_ia(imagen_base64)

    return render_template("index.html", respuesta=respuesta)


if __name__ == "__main__":
    app.run(debug=True) 