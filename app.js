
const catalogo = document.getElementById("catalogo");
const buscador = document.getElementById("buscador");
const mensaje = document.getElementById("mensaje");

let peliculasGuardadas = [];
let temporizador;
let busquedaActual = 0;

function normalizar(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function crearTarjeta(pelicula, esTMDB = false) {

    const tarjeta = document.createElement("article");
    tarjeta.className = "pelicula";

    const titulo = document.createElement("h2");
    titulo.textContent = pelicula.titulo;

    const anio = document.createElement("p");
    anio.textContent = "Año: " + (pelicula.anio || "Desconocido");

    const director = document.createElement("p");
    director.textContent = "Director: " + (pelicula.director || "Desconocido");

    tarjeta.append(titulo, anio, director);

    if (esTMDB) {

        const nota = document.createElement("div");
        nota.className = "nota";
        nota.textContent = Number(pelicula.valoracion || 0).toFixed(1) + "/10";

        const votos = document.createElement("p");
        votos.textContent = "Votos TMDB: " + pelicula.votos;

        const sinopsis = document.createElement("p");
        sinopsis.textContent = pelicula.sinopsis || "Sin sinopsis disponible.";

        tarjeta.append(nota, votos, sinopsis);

    } else {

        const categoria = document.createElement("p");
        categoria.textContent = "Categoría: " + (pelicula.categoria || "Sin categoría");

        tarjeta.appendChild(categoria);

        (pelicula.valoraciones || []).forEach(function(valoracion) {

            const nota = document.createElement("p");

            nota.textContent = valoracion.nota === null
                ? valoracion.fuente + ": Pendiente"
                : valoracion.fuente + ": " + valoracion.nota + "/10";

            tarjeta.appendChild(nota);
        });

        if (pelicula.url) {

            try {
                const url = new URL(pelicula.url);

                if (url.protocol === "https:" || url.protocol === "http:") {

                    const enlace = document.createElement("a");

                    enlace.href = url.href;
                    enlace.textContent = "VER PELÍCULA";
                    enlace.target = "_blank";
                    enlace.rel = "noopener noreferrer";
                    enlace.className = "boton-pelicula";

                    tarjeta.appendChild(enlace);
                }

            } catch (error) {
                console.error("URL no válida:", pelicula.titulo);
            }
        }
    }

    return tarjeta;
}


function mostrarPeliculas(peliculas, esTMDB = false, numeroBusqueda = busquedaActual) {

    catalogo.innerHTML = "";

    peliculas.forEach(function(pelicula) {

        const tarjeta = crearTarjeta(pelicula, esTMDB);

        catalogo.appendChild(tarjeta);

        if (esTMDB) {
            mostrarOpciones(pelicula, tarjeta, numeroBusqueda);
        }
    });
}


// BUSCAR OPCIONES PARA CADA PELICULA
async function mostrarOpciones(pelicula, tarjeta, numeroBusqueda) {

    const seccion = document.createElement("section");
    seccion.className = "opciones-pelicula";

    const titulo = document.createElement("h3");
    titulo.textContent = "Opciones para ver esta película";

    const cargando = document.createElement("p");
    cargando.textContent = "Buscando plataformas disponibles...";

    seccion.append(titulo, cargando);
    tarjeta.appendChild(seccion);

    try {

        const parametros = new URLSearchParams({
            q: pelicula.titulo,
            anio: pelicula.anio || ""
        });

        const respuesta = await fetch("/api/fuentes?" + parametros.toString());

        const fuentes = await respuesta.json();

        if (numeroBusqueda !== busquedaActual) return;

        if (!respuesta.ok) {
            throw new Error(fuentes.error || "Error al buscar opciones");
        }

        seccion.innerHTML = "";
        seccion.appendChild(titulo);

        if (!Array.isArray(fuentes) || fuentes.length === 0) {

            const sinResultados = document.createElement("p");
            sinResultados.textContent = "No se encontraron opciones disponibles.";

            seccion.appendChild(sinResultados);
            return;
        }

        fuentes.forEach(function(fuente, indice) {

            try {

                const url = new URL(fuente.url);

                if (url.protocol !== "https:" && url.protocol !== "http:") {
                    return;
                }

                const articulo = document.createElement("article");
                articulo.className = "opcion-enlace";

                const numero = document.createElement("strong");
                numero.textContent = "Opción " + (indice + 1);

                const nombreEnlace = document.createElement("p");
                nombreEnlace.textContent = fuente.titulo || fuente.plataforma || "Opción disponible";

                const plataforma = document.createElement("p");
                plataforma.textContent = fuente.plataforma || "Plataforma disponible";

                const enlace = document.createElement("a");
                enlace.href = url.href;
                enlace.textContent = "VER";
                enlace.target = "_blank";
                enlace.rel = "noopener noreferrer";
                enlace.className = "boton-pelicula";

                const contenido = document.createElement("p");
                contenido.textContent = fuente.contenido || "";

                articulo.append(numero, nombreEnlace, plataforma, enlace, contenido);
                seccion.appendChild(articulo);

            } catch (error) {
                console.error("Enlace no válido:", fuente.url);
            }
        });

        if (seccion.querySelectorAll(".opcion-enlace").length === 0) {

            const sinResultados = document.createElement("p");
            sinResultados.textContent = "No se encontraron enlaces válidos.";

            seccion.appendChild(sinResultados);
        }

    } catch (error) {

        if (numeroBusqueda !== busquedaActual) return;

        cargando.textContent = "No se pudieron cargar las opciones.";
        console.error("Error buscando opciones:", error);
    }
}


// CARGAR CATALOGO LOCAL
async function cargarPeliculas() {

    try {

        const respuesta = await fetch("/movies.json");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el catálogo");
        }

        peliculasGuardadas = await respuesta.json();

        mostrarPeliculas(peliculasGuardadas);

        mensaje.textContent = "Películas de tu catálogo";

    } catch (error) {

        mensaje.textContent = "Error al cargar el catálogo";
        console.error(error);
    }
}


// BUSCAR PELICULAS
async function buscarPeliculas(texto) {

    const numeroBusqueda = ++busquedaActual;
    const consulta = normalizar(texto);

    const resultadosLocales = peliculasGuardadas.filter(function(pelicula) {

        return normalizar(pelicula.titulo).includes(consulta) ||
            normalizar(pelicula.director).includes(consulta);
    });

    if (resultadosLocales.length > 0) {

        mostrarPeliculas(resultadosLocales);
        mensaje.textContent = "Resultados de tu catálogo";

        return;
    }

    mensaje.textContent = "Buscando en TMDB...";
    catalogo.innerHTML = "";

    try {

        const respuesta = await fetch(
            "/api/buscar?q=" + encodeURIComponent(texto)
        );

        const resultados = await respuesta.json();

        if (numeroBusqueda !== busquedaActual) return;

        if (!respuesta.ok) {
            throw new Error(resultados.error || "Error al buscar");
        }

        if (resultados.length === 0) {

            mensaje.textContent = "No se encontraron películas";
            return;
        }

        mostrarPeliculas(resultados, true, numeroBusqueda);

        mensaje.textContent = "Resultados encontrados en TMDB";

    } catch (error) {

        if (numeroBusqueda !== busquedaActual) return;

        mensaje.textContent = "Error: " + error.message;
        console.error(error);
    }
}


// BUSCADOR
buscador.addEventListener("input", function() {

    clearTimeout(temporizador);

    const texto = buscador.value.trim();

    if (texto.length === 0) {

        busquedaActual++;

        mostrarPeliculas(peliculasGuardadas);

        mensaje.textContent = "Películas de tu catálogo";

        return;
    }

    if (texto.length < 2) return;

    temporizador = setTimeout(function() {
        buscarPeliculas(texto);
    }, 500);
});


cargarPeliculas();
