
import os
import requests

from pathlib import Path
from urllib.parse import urlparse
from flask import Flask, jsonify, request, send_from_directory, send_file
from dotenv import load_dotenv
from tavily import TavilyClient

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR.parent

load_dotenv(WEB_DIR / ".env")

TOKEN = os.getenv("TMDB_BEARER_TOKEN")
TAVILY_KEY = os.getenv("TAVILY_API_KEY")

URL_BASE = "https://api.themoviedb.org/3"

app = Flask(__name__)

tavily = TavilyClient(api_key=TAVILY_KEY) if TAVILY_KEY else None


# Plataformas y servicios legales que queremos priorizar
DOMINIOS_PERMITIDOS = [
    "ok.ru",
]


@app.route("/")
def inicio():
    return send_file(WEB_DIR / "index.html")


@app.route("/prueba")
def prueba():
    return "PAPACINE FUNCIONA"


@app.route("/<path:archivo>")
def archivos(archivo):
    return send_from_directory(WEB_DIR, archivo)


def consultar_tmdb(endpoint, parametros=None):
    cabeceras = {
        "Authorization": f"Bearer {TOKEN}",
        "accept": "application/json"
    }

    respuesta = requests.get(
        URL_BASE + endpoint,
        headers=cabeceras,
        params=parametros,
        timeout=20
    )

    respuesta.raise_for_status()
    return respuesta.json()


@app.route("/api/buscar")
def buscar_pelicula():

    if not TOKEN:
        return jsonify({"error": "Falta configurar TMDB"}), 500

    nombre = request.args.get("q", "").strip()

    if not nombre:
        return jsonify({
            "error": "Escribe el nombre de una pelicula"
        }), 400

    try:
        datos = consultar_tmdb(
            "/search/movie",
            {
                "query": nombre,
                "language": "es-ES",
                "include_adult": "false"
            }
        )

        resultados = []

        for pelicula in datos.get("results", [])[:5]:

            creditos = consultar_tmdb(
                f"/movie/{pelicula['id']}/credits"
            )

            director = "Desconocido"

            for persona in creditos.get("crew", []):
                if persona.get("job") == "Director":
                    director = persona["name"]
                    break

            resultados.append({
                "id": pelicula["id"],
                "titulo": pelicula.get("title"),
                "anio": pelicula.get("release_date", "")[:4],
                "sinopsis": pelicula.get("overview"),
                "valoracion": pelicula.get("vote_average"),
                "votos": pelicula.get("vote_count"),
                "director": director
            })

        return jsonify(resultados)

    except requests.RequestException as error:
        print("Error TMDB:", error)

        return jsonify({
            "error": "No se pudo consultar TMDB"
        }), 502


def dominio_permitido(url):

    try:
        dominio = urlparse(url).hostname

        if not dominio:
            return False

        dominio = dominio.lower()

        return any(
            dominio == permitido or
            dominio.endswith("." + permitido)
            for permitido in DOMINIOS_PERMITIDOS
        )

    except Exception:
        return False


def obtener_nombre_plataforma(url):

    dominio = urlparse(url).hostname or ""

    return dominio.replace("www.", "")


@app.route("/api/fuentes")
def buscar_fuentes():

    if not tavily:
        return jsonify({
            "error": "Falta configurar Tavily"
        }), 500

    nombre = request.args.get("q", "").strip()
    anio = request.args.get("anio", "").strip()

    if not nombre:
        return jsonify({
            "error": "Escribe el nombre de una pelicula"
        }), 400

    try:

        consulta = (
            f'"{nombre}" {anio} castellano ok.ru '
            'OK.ru castellano película'
        )

        respuesta = tavily.search(
            query=consulta,
            search_depth="advanced",
            max_results=15
        )

        fuentes = []
        urls_encontradas = set()

        for resultado in respuesta.get("results", []):

            url = resultado.get("url", "").strip()

            if not url.startswith(("https://", "http://")):
                continue

            if not dominio_permitido(url):
                continue

            if url in urls_encontradas:
                continue

            urls_encontradas.add(url)

            fuentes.append({
                "titulo": resultado.get("title") or "Ver opciones",
                "url": url,
                "plataforma": obtener_nombre_plataforma(url),
                "contenido": resultado.get("content", "")[:300]
            })

            if len(fuentes) >= 6:
                break

        return jsonify(fuentes)

    except Exception as error:
        print("Error Tavily:", error)

        return jsonify({
            "error": "No se pudieron consultar las opciones"
        }), 502


print("CARPETA WEB:", WEB_DIR)
print("INDEX EXISTE:", (WEB_DIR / "index.html").exists())
print("TMDB ENCONTRADO:", bool(TOKEN))
print("TAVILY ENCONTRADO:", bool(TAVILY_KEY))
print("RUTAS REGISTRADAS:")
print(app.url_map)


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )
