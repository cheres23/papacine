import os
from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

api_key = os.getenv("TAVILY_API_KEY")

if not api_key:
    print("ERROR: No se ha encontrado la API KEY")
else:
    print("API KEY encontrada")

    client = TavilyClient(api_key=api_key)

    print("Buscando Titanic...")

    respuesta = client.search("Titanic pelicula 1997")

    for resultado in respuesta["results"]:
        print(resultado["title"])
        print(resultado["url"])
        print("----------------")