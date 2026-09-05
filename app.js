// ============================================================
// app.js — CryptoGecko
// Interactividad, DOM, formulario, menú y conexión con la API
// de CoinGecko para precios en vivo
// ============================================================

// 👉 PEGA AQUÍ TU API KEY GRATUITA (Demo plan) DE COINGECKO.
// La consigues en https://www.coingecko.com/en/api/pricing
const CONFIGURACION_API = {
  clave: 'CG-ZJ6Egw2fyZpsEC9hewHSXAfE',
  cantidadMonedas: 9,
};

// Clave usada en localStorage para que los favoritos sobrevivan al
// navegar entre index.html y portafolio.html (son documentos distintos,
// así que una variable en memoria no alcanza).
const CLAVE_ALMACENAMIENTO = 'cryptogecko_favoritos';

// Estado global de favoritos: Map<nombreMoneda, datosFila>.
// Guardamos los datos (precio, cambios, volumen, etc.) y no solo el
// nombre, porque la tabla de "Mi Portafolio" necesita pintarlos sin
// depender de que la fila original siga en el DOM (y, en portafolio.html,
// la fila original ni siquiera existe en esa página).
const favoritos = cargarFavoritosGuardados();

function cargarFavoritosGuardados() {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!guardado) return new Map();
    return new Map(Object.entries(JSON.parse(guardado)));
  } catch (error) {
    console.error('No se pudieron leer los favoritos guardados:', error);
    return new Map();
  }
}

function guardarFavoritos() {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(Object.fromEntries(favoritos)));
  } catch (error) {
    console.error('No se pudieron guardar los favoritos:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarMenu();
  inicializarBuscador();
  inicializarFavoritos();
  inicializarFormularioAlertas();
  cargarPreciosDesdeAPI();
  aplicarEstadoFavoritosInicial();
});

// Al cargar cualquiera de las dos páginas, refleja los favoritos que ya
// estaban guardados: marca las ☆ correspondientes en la tabla de precios
// (si estamos en index.html) y pinta la tabla de "Mi Portafolio" (si
// estamos en portafolio.html).
function aplicarEstadoFavoritosInicial() {
  const contadorFavoritos = document.getElementById('contador-favoritos');
  if (contadorFavoritos) contadorFavoritos.textContent = favoritos.size;
  renderizarListaFavoritos();
  sincronizarFavoritosConFilas();
  renderizarTablaPortafolio();
}

// ------------------------------------------------------------
// 1. INTERACTIVIDAD: menú hamburguesa que se abre y se cierra
// ------------------------------------------------------------
function inicializarMenu() {
  const botonMenu = document.getElementById('boton-menu');
  const menu = document.getElementById('menu-principal');
  if (!botonMenu || !menu) return;

  botonMenu.addEventListener('click', () => {
    const abierto = menu.classList.toggle('menu-abierto');
    botonMenu.setAttribute('aria-expanded', abierto);
    botonMenu.textContent = abierto ? '✕' : '☰';
  });
}

// ------------------------------------------------------------
// 2. MANIPULACIÓN DEL DOM: buscador que filtra la tabla en vivo
//    (vuelve a leer las filas en cada tecla, así funciona con
//    los datos de ejemplo Y con los datos reales de la API)
// ------------------------------------------------------------
function inicializarBuscador() {
  const campoBusqueda = document.getElementById('campo-busqueda');
  const mensajeSinResultados = document.getElementById('sin-resultados');
  const tablaCripto = document.getElementById('tabla-cripto');
  if (!campoBusqueda || !tablaCripto) return;

  actualizarContadorResultados();

  campoBusqueda.addEventListener('input', () => {
    const texto = campoBusqueda.value.trim().toLowerCase();
    const filas = tablaCripto.querySelectorAll('.fila-cripto');
    let visibles = 0;

    filas.forEach((fila) => {
      const nombre = fila.dataset.nombre.toLowerCase();
      const simbolo = fila.dataset.simbolo.toLowerCase();
      const coincide = nombre.includes(texto) || simbolo.includes(texto);
      fila.classList.toggle('oculta', !coincide);
      if (coincide) visibles++;
    });

    actualizarContadorResultados();
    if (mensajeSinResultados) {
      mensajeSinResultados.classList.toggle('visible', visibles === 0);
    }
  });
}

function actualizarContadorResultados() {
  const contadorResultados = document.getElementById('contador-resultados');
  const tablaCripto = document.getElementById('tabla-cripto');
  if (!contadorResultados || !tablaCripto) return;
  const total = tablaCripto.querySelectorAll('.fila-cripto').length;
  const visibles = tablaCripto.querySelectorAll('.fila-cripto:not(.oculta)').length;
  contadorResultados.textContent = `Mostrando ${visibles} de ${total} criptomonedas`;
}

// ------------------------------------------------------------
// 3. DOM + CONTADOR: favoritos (⭐) con lista dinámica.
//    Usa delegación de eventos en la tabla, así los botones
//    que crea la API (después del fetch) también funcionan.
// ------------------------------------------------------------
function inicializarFavoritos() {
  const tabla = document.getElementById('tabla-cripto');
  const tablaPortafolio = document.getElementById('tabla-portafolio');
  if (tabla) {
    tabla.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.boton-favorito');
      if (!boton) return;
      alternarFavorito(boton.dataset.moneda);
    });
  }

  // Botón "Quitar" dentro de la propia tabla de portafolio
  if (tablaPortafolio) {
    tablaPortafolio.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.boton-quitar-portafolio');
      if (!boton) return;
      alternarFavorito(boton.dataset.moneda);
    });
  }
}

// Lee los valores ya renderizados de una fila (precio, cambios, volumen...)
// para poder reconstruir esa misma fila dentro de "Mi Portafolio" sin
// tener que volver a pedir nada a la API.
function extraerDatosFila(fila) {
  const columnas = fila.children;
  return {
    simbolo: fila.dataset.simbolo || '',
    imagen: fila.querySelector('.icono-crypto')?.getAttribute('src') || '',
    precio: columnas[2] ? columnas[2].textContent.trim() : '—',
    cambio1h: columnas[3] ? columnas[3].outerHTML : '<div>—</div>',
    cambio24h: columnas[4] ? columnas[4].outerHTML : '<div>—</div>',
    cambio7d: columnas[5] ? columnas[5].outerHTML : '<div>—</div>',
    volumen: columnas[6] ? columnas[6].textContent.trim() : '—',
    capMercado: columnas[7] ? columnas[7].textContent.trim() : '—',
  };
}

function alternarFavorito(moneda, datosFila) {
  const boton = document.querySelector(`.boton-favorito[data-moneda="${CSS.escape(moneda)}"]`);

  if (favoritos.has(moneda)) {
    favoritos.delete(moneda);
    if (boton) {
      boton.textContent = '☆';
      boton.classList.remove('activo');
    }
  } else {
    // Si no nos pasaron los datos directamente, los tomamos de la fila
    // de la tabla de precios que disparó el clic.
    const fila = boton ? boton.closest('.fila-cripto') : null;
    const datos = datosFila || (fila ? extraerDatosFila(fila) : null);
    if (!datos) return; // sin datos de la moneda no hay nada que mostrar en el portafolio
    favoritos.set(moneda, datos);
    if (boton) {
      boton.textContent = '★';
      boton.classList.add('activo');
    }
  }

  const contadorFavoritos = document.getElementById('contador-favoritos');
  if (contadorFavoritos) contadorFavoritos.textContent = favoritos.size;
  guardarFavoritos();
  renderizarListaFavoritos();
  renderizarTablaPortafolio();
}

function renderizarListaFavoritos() {
  const listaFavoritos = document.getElementById('lista-favoritos');
  if (!listaFavoritos) return; // esta tarjeta solo existe en index.html
  listaFavoritos.innerHTML = '';

  if (favoritos.size === 0) {
    const vacio = document.createElement('li');
    vacio.className = 'favorito-vacio';
    vacio.textContent = 'Toca la ⭐ de una moneda para agregarla aquí';
    listaFavoritos.appendChild(vacio);
    return;
  }

  favoritos.forEach((_datos, moneda) => {
    const item = document.createElement('li');

    const nombre = document.createElement('span');
    nombre.textContent = `⭐ ${moneda}`;

    const quitar = document.createElement('button');
    quitar.className = 'quitar-favorito';
    quitar.textContent = '✕';
    quitar.setAttribute('aria-label', `Quitar ${moneda} de favoritos`);
    quitar.addEventListener('click', () => alternarFavorito(moneda));

    item.appendChild(nombre);
    item.appendChild(quitar);
    listaFavoritos.appendChild(item);
  });
}

// ------------------------------------------------------------
// TABLA "MI PORTAFOLIO": misma estructura que la tabla de precios,
// pero solo con las monedas marcadas como favoritas.
// ------------------------------------------------------------
function renderizarTablaPortafolio() {
  const tabla = document.getElementById('tabla-portafolio');
  const vacio = document.getElementById('portafolio-vacio');
  const contador = document.getElementById('contador-portafolio');
  if (!tabla) return;

  tabla.querySelectorAll('.fila-cripto').forEach((fila) => fila.remove());

  if (favoritos.size === 0) {
    if (vacio) vacio.classList.add('visible');
    if (contador) contador.textContent = '';
    return;
  }

  if (vacio) vacio.classList.remove('visible');
  if (contador) {
    const sufijo = favoritos.size === 1 ? 'criptomoneda' : 'criptomonedas';
    contador.textContent = `${favoritos.size} ${sufijo} en tu portafolio`;
  }

  let indice = 0;
  favoritos.forEach((datos, moneda) => {
    indice += 1;
    const fila = document.createElement('div');
    fila.className = 'fila-cripto';
    fila.dataset.nombre = moneda;
    fila.dataset.simbolo = datos.simbolo;

    fila.innerHTML = `
      <div>${indice}</div>
      <div class="nombre-moneda">
        ${datos.imagen ? `<img src="${datos.imagen}" alt="${moneda}" class="icono-crypto">` : ''}
        <strong>${moneda}</strong> <span>${datos.simbolo}</span>
      </div>
      <div>${datos.precio}</div>
      ${datos.cambio1h}
      ${datos.cambio24h}
      ${datos.cambio7d}
      <div>${datos.volumen}</div>
      <div>${datos.capMercado}</div>
      <div><button class="boton-quitar-portafolio" data-moneda="${moneda}">Quitar</button></div>
    `;

    tabla.insertBefore(fila, vacio);
  });
}

// Cuando la API reemplaza las filas de ejemplo por datos reales, los
// botones de favorito nuevos nacen todos en ☆. Esta función busca, por
// nombre, las monedas que ya estaban marcadas y les devuelve su estado
// (y refresca sus datos guardados con los valores reales de la API).
function sincronizarFavoritosConFilas() {
  if (favoritos.size === 0) return;

  favoritos.forEach((_datosViejos, moneda) => {
    const boton = document.querySelector(`.boton-favorito[data-moneda="${CSS.escape(moneda)}"]`);
    if (!boton) return; // esa moneda ya no aparece en la tabla actual (p. ej. salió del top N)
    boton.textContent = '★';
    boton.classList.add('activo');
    const fila = boton.closest('.fila-cripto');
    if (fila) favoritos.set(moneda, extraerDatosFila(fila));
  });

  guardarFavoritos();
  renderizarTablaPortafolio();
}

// ------------------------------------------------------------
// 4. VALIDACIÓN DE FORMULARIO: alertas de precio
// ------------------------------------------------------------
function inicializarFormularioAlertas() {
  const formulario = document.getElementById('formulario-alertas');
  if (!formulario) return;

  const campoNombre = document.getElementById('nombre-usuario');
  const campoCorreo = document.getElementById('correo-usuario');
  const errorNombre = document.getElementById('error-nombre');
  const errorCorreo = document.getElementById('error-correo');
  const mensajeExito = document.getElementById('mensaje-exito-alertas');
  const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function marcarError(campo, elementoError, mensaje) {
    campo.classList.add('campo-invalido');
    elementoError.textContent = mensaje;
  }

  function limpiarError(campo, elementoError) {
    campo.classList.remove('campo-invalido');
    elementoError.textContent = '';
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    mensajeExito.textContent = '';
    let esValido = true;

    if (campoNombre.value.trim() === '') {
      marcarError(campoNombre, errorNombre, 'Por favor ingresa tu nombre.');
      esValido = false;
    } else {
      limpiarError(campoNombre, errorNombre);
    }

    const correo = campoCorreo.value.trim();
    if (correo === '') {
      marcarError(campoCorreo, errorCorreo, 'Por favor ingresa tu correo.');
      esValido = false;
    } else if (!patronCorreo.test(correo)) {
      marcarError(campoCorreo, errorCorreo, 'Ingresa un correo válido, ej: nombre@dominio.com');
      esValido = false;
    } else {
      limpiarError(campoCorreo, errorCorreo);
    }

    if (esValido) {
      mensajeExito.textContent = `¡Listo, ${campoNombre.value.trim()}! Te enviaremos alertas a ${correo}.`;
      formulario.reset();
    }
  });
}

// ------------------------------------------------------------
// 5. CONEXIÓN CON LA API DE COINGECKO
// ------------------------------------------------------------
async function cargarPreciosDesdeAPI() {
  if (!CONFIGURACION_API.clave || CONFIGURACION_API.clave === 'TU_API_KEY_AQUI') {
    console.warn(
      'CryptoGecko: agrega tu API key gratuita de CoinGecko en CONFIGURACION_API.clave ' +
      '(arriba de app.js) para mostrar precios en vivo. Mientras tanto se muestran los ' +
      'datos de ejemplo que ya están en el HTML.'
    );
    return;
  }

  const url =
    'https://api.coingecko.com/api/v3/coins/markets' +
    `?vs_currency=usd&order=market_cap_desc&per_page=${CONFIGURACION_API.cantidadMonedas}` +
    `&page=1&price_change_percentage=1h,24h,7d&x_cg_demo_api_key=${CONFIGURACION_API.clave}`;

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error(`CoinGecko respondió con estado ${respuesta.status}`);
    }
    const monedas = await respuesta.json();
    reemplazarFilasConDatosReales(monedas);
  } catch (error) {
    console.error('No se pudieron cargar los precios en vivo, se mantienen los datos de ejemplo:', error);
  }
}

function reemplazarFilasConDatosReales(monedas) {
  const tabla = document.getElementById('tabla-cripto');
  const mensajeSinResultados = document.getElementById('sin-resultados');
  if (!tabla) return;

  // Quita las filas de ejemplo antes de dibujar las reales
  tabla.querySelectorAll('.fila-cripto').forEach((fila) => fila.remove());

  monedas.forEach((moneda, indice) => {
    const fila = document.createElement('div');
    fila.className = 'fila-cripto';
    fila.dataset.nombre = moneda.name;
    fila.dataset.simbolo = moneda.symbol.toUpperCase();

    fila.innerHTML = `
      <div>${indice + 1}</div>
      <div class="nombre-moneda">
        <button class="boton-favorito" data-moneda="${moneda.name}" aria-label="Agregar ${moneda.name} a favoritos">☆</button>
        <img src="${moneda.image}" alt="${moneda.name}" class="icono-crypto">
        <strong>${moneda.name}</strong> <span>${moneda.symbol.toUpperCase()}</span>
      </div>
      <div>${formatearPrecio(moneda.current_price)}</div>
      ${formatearCambio(moneda.price_change_percentage_1h_in_currency)}
      ${formatearCambio(moneda.price_change_percentage_24h_in_currency)}
      ${formatearCambio(moneda.price_change_percentage_7d_in_currency)}
      <div>${formatearMonto(moneda.total_volume)}</div>
      <div>${formatearMonto(moneda.market_cap)}</div>
    `;

    if (mensajeSinResultados) {
      tabla.insertBefore(fila, mensajeSinResultados);
    } else {
      tabla.appendChild(fila);
    }
  });

  actualizarContadorResultados();
  sincronizarFavoritosConFilas();
}

function formatearPrecio(valor) {
  const decimales = valor < 1 ? 4 : 2;
  return '$' + Number(valor).toLocaleString('en-US', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formatearMonto(valor) {
  return '$' + Number(valor).toLocaleString('en-US');
}

function formatearCambio(valor) {
  if (valor === undefined || valor === null || Number.isNaN(valor)) {
    return '<div>—</div>';
  }
  const clase = valor >= 0 ? 'sube' : 'baja';
  const flecha = valor >= 0 ? '▲' : '▼';
  return `<div class="${clase}">${flecha} ${Math.abs(valor).toFixed(1)}%</div>`;
}