// ============================================================
// app.js — CryptoDash
// Buscador global dinámico, gráfico con Chart.js y consumo de CoinGecko API
// ============================================================

const CONFIGURACION_API = {
  clave: 'CG-ZJ6Egw2fyZpsEC9hewHSXAfE',
  cantidadInicial: 10,
};

const CLAVE_ALMACENAMIENTO = 'cryptogecko_favoritos';
const favoritos = cargarFavoritosGuardados();

let miGrafico = null;
let monedaGraficoActual = 'bitcoin';
let diasGraficoActual = 7;
let temporizadorBusqueda = null;

function cargarFavoritosGuardados() {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!guardado) return new Map();
    return new Map(Object.entries(JSON.parse(guardado)));
  } catch (error) {
    console.error('Error al leer favoritos guardados:', error);
    return new Map();
  }
}

function guardarFavoritos() {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(Object.fromEntries(favoritos)));
  } catch (error) {
    console.error('Error al guardar favoritos:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarMenu();
  inicializarBuscadorDinamico();
  inicializarFavoritos();
  inicializarFormularioAlertas();
  inicializarEventosGrafico();
  cargarTopMercado();
  aplicarEstadoFavoritosInicial();
  
  renderizarGrafico(monedaGraficoActual, diasGraficoActual);
});

function aplicarEstadoFavoritosInicial() {
  const contadorFavoritos = document.getElementById('contador-favoritos');
  if (contadorFavoritos) contadorFavoritos.textContent = favoritos.size;
  renderizarListaFavoritos();
  renderizarTablaPortafolio();
}

// ------------------------------------------------------------
// 1. MENÚ
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
// 2. BUSCADOR GLOBAL DINÁMICO (CoinGecko Search API)
// ------------------------------------------------------------
function inicializarBuscadorDinamico() {
  const campoBusqueda = document.getElementById('campo-busqueda');
  const indicadorCargando = document.getElementById('cargando-busqueda');
  if (!campoBusqueda) return;

  campoBusqueda.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    const texto = campoBusqueda.value.trim().toLowerCase();

    if (texto === '') {
      if (indicadorCargando) indicadorCargando.classList.remove('activo');
      cargarTopMercado();
      return;
    }

    if (indicadorCargando) indicadorCargando.classList.add('activo');

    // Debounce de 400ms para evitar llamadas excesivas a la API
    temporizadorBusqueda = setTimeout(() => {
      ejecutarBusquedaGlobal(texto);
    }, 400);
  });
}

async function ejecutarBusquedaGlobal(query) {
  const indicadorCargando = document.getElementById('cargando-busqueda');
  const urlSearch = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}&x_cg_demo_api_key=${CONFIGURACION_API.clave}`;

  try {
    const res = await fetch(urlSearch);
    if (!res.ok) throw new Error('Error al buscar monedas');
    const data = await res.json();

    if (!data.coins || data.coins.length === 0) {
      mostrarSinResultados();
      return;
    }

    // Obtener los primeros 10 IDs encontrados
    const idsEncontrados = data.coins.slice(0, 10).map((c) => c.id).join(',');
    
    // Consultar sus precios actuales en vivo
    const urlMarkets = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsEncontrados}&price_change_percentage=1h,24h,7d&x_cg_demo_api_key=${CONFIGURACION_API.clave}`;
    const resMarkets = await fetch(urlMarkets);
    const datosMercado = await resMarkets.json();

    reemplazarFilasConDatosReales(datosMercado);
  } catch (error) {
    console.error('Error durante la búsqueda global:', error);
    mostrarSinResultados();
  } finally {
    if (indicadorCargando) indicadorCargando.classList.remove('activo');
  }
}

function mostrarSinResultados() {
  const tabla = document.getElementById('tabla-cripto');
  const mensajeSinResultados = document.getElementById('sin-resultados');
  const contadorResultados = document.getElementById('contador-resultados');
  if (!tabla) return;

  tabla.querySelectorAll('.fila-cripto').forEach((fila) => fila.remove());
  if (mensajeSinResultados) mensajeSinResultados.classList.add('visible');
  if (contadorResultados) contadorResultados.textContent = 'Mostrando 0 resultados';
}

function actualizarContadorResultados() {
  const contadorResultados = document.getElementById('contador-resultados');
  const tablaCripto = document.getElementById('tabla-cripto');
  if (!contadorResultados || !tablaCripto) return;
  const total = tablaCripto.querySelectorAll('.fila-cripto').length;
  contadorResultados.textContent = `Mostrando ${total} resultados`;
}

// ------------------------------------------------------------
// 3. GRÁFICO (Chart.js)
// ------------------------------------------------------------
function inicializarEventosGrafico() {
  const tablaCripto = document.getElementById('tabla-cripto');
  const contenedorFiltros = document.getElementById('filtros-tiempo');

  if (tablaCripto) {
    tablaCripto.addEventListener('click', (evento) => {
      if (evento.target.closest('.boton-favorito')) return;
      const fila = evento.target.closest('.fila-cripto');
      if (!fila) return;

      const idMoneda = fila.dataset.id;
      const nombreMoneda = fila.dataset.nombre;
      const simboloMoneda = fila.dataset.simbolo;

      monedaGraficoActual = idMoneda;
      const titulo = document.getElementById('titulo-grafico');
      if (titulo) titulo.textContent = `${nombreMoneda} (${simboloMoneda}) — Historial de Precio`;

      renderizarGrafico(monedaGraficoActual, diasGraficoActual);
    });
  }

  if (contenedorFiltros) {
    contenedorFiltros.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.boton-tiempo');
      if (!boton) return;

      contenedorFiltros.querySelectorAll('.boton-tiempo').forEach((b) => b.classList.remove('activo'));
      boton.classList.add('activo');

      diasGraficoActual = parseInt(boton.dataset.dias, 10);
      renderizarGrafico(monedaGraficoActual, diasGraficoActual);
    });
  }
}

async function renderizarGrafico(idMoneda = 'bitcoin', dias = 7) {
  const canvas = document.getElementById('grafico-precio');
  if (!canvas || typeof Chart === 'undefined') return;

  const url = `https://api.coingecko.com/api/v3/coins/${idMoneda}/market_chart?vs_currency=usd&days=${dias}&x_cg_demo_api_key=${CONFIGURACION_API.clave}`;

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`HTTP error ${respuesta.status}`);
    const datos = await respuesta.json();

    const etiquetas = datos.prices.map((p) => {
      const fecha = new Date(p[0]);
      return dias === 1 ? fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fecha.toLocaleDateString();
    });

    const precios = datos.prices.map((p) => p[1]);

    if (miGrafico) miGrafico.destroy();

    const ctx = canvas.getContext('2d');
    miGrafico = new Chart(ctx, {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [{
          label: 'Precio USD',
          data: precios,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#262c3a' }, ticks: { color: '#6b7280' } },
          y: { grid: { color: '#262c3a' }, ticks: { color: '#6b7280' } }
        }
      }
    });
  } catch (error) {
    console.error('No se pudo cargar la información del gráfico:', error);
  }
}

// ------------------------------------------------------------
// 4. FAVORITOS
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

  if (tablaPortafolio) {
    tablaPortafolio.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.boton-quitar-portafolio');
      if (!boton) return;
      alternarFavorito(boton.dataset.moneda);
    });
  }
}

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
    const fila = boton ? boton.closest('.fila-cripto') : null;
    const datos = datosFila || (fila ? extraerDatosFila(fila) : null);
    if (!datos) return;
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
  if (!listaFavoritos) return;
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

function sincronizarFavoritosConFilas() {
  if (favoritos.size === 0) return;

  favoritos.forEach((_datosViejos, moneda) => {
    const boton = document.querySelector(`.boton-favorito[data-moneda="${CSS.escape(moneda)}"]`);
    if (!boton) return;
    boton.textContent = '★';
    boton.classList.add('activo');
  });
}

// ------------------------------------------------------------
// 5. FORMULARIO
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
      marcarError(campoCorreo, errorCorreo, 'Ingresa un correo válido.');
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
// 6. CARGAR TOP MERCADO
// ------------------------------------------------------------
async function cargarTopMercado() {
  const url =
    'https://api.coingecko.com/api/v3/coins/markets' +
    `?vs_currency=usd&order=market_cap_desc&per_page=${CONFIGURACION_API.cantidadInicial}` +
    `&page=1&price_change_percentage=1h,24h,7d&x_cg_demo_api_key=${CONFIGURACION_API.clave}`;

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`CoinGecko respondió con estado ${respuesta.status}`);
    const monedas = await respuesta.json();
    reemplazarFilasConDatosReales(monedas);
  } catch (error) {
    console.error('No se pudieron cargar los precios iniciales:', error);
  }
}

function reemplazarFilasConDatosReales(monedas) {
  const tabla = document.getElementById('tabla-cripto');
  const mensajeSinResultados = document.getElementById('sin-resultados');
  if (!tabla) return;

  tabla.querySelectorAll('.fila-cripto').forEach((fila) => fila.remove());

  if (mensajeSinResultados) mensajeSinResultados.classList.remove('visible');

  monedas.forEach((moneda, indice) => {
    const fila = document.createElement('div');
    fila.className = 'fila-cripto';
    fila.dataset.nombre = moneda.name;
    fila.dataset.simbolo = moneda.symbol.toUpperCase();
    fila.dataset.id = moneda.id;

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
  if (valor === undefined || valor === null) return '—';
  const decimales = valor < 1 ? 4 : 2;
  return '$' + Number(valor).toLocaleString('en-US', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formatearMonto(valor) {
  if (valor === undefined || valor === null) return '—';
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