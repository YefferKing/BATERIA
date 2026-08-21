/**
 * LÓGICA PRINCIPAL DE LA APLICACIÓN FLOTA & LOGÍSTICA
 */

// Estado Global
let currentTab = 'tab-dashboard';
let articulosList = [];
let proveedoresList = [];
let bodegasList = [];
let vehiculosList = [];
let ordenesList = [];
let orderItemsDraft = []; // Artículos en la orden actual para cubicación

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();

  const user = window.flotaAuth.init();
  if (user) {
    renderAppForUser(user);
  } else {
    showView('view-login');
  }
});

/* ==========================================================================
   TEMA OSCURO / CLARO
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem('flota_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtnText(saved);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('flota_theme', next);
      updateThemeBtnText(next);
    });
  }
}

function updateThemeBtnText(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  }
}

/* ==========================================================================
   NAVEGACIÓN & VISTAS
   ========================================================================== */
function showView(viewId) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  const user = window.flotaAuth.getUser();
  const headerUser = document.getElementById('header-user-info');
  if (user && viewId !== 'view-login') {
    if (headerUser) {
      headerUser.style.display = 'flex';
      document.getElementById('user-display-name').textContent = user.nombre;
      document.getElementById('user-display-role').textContent = (user.cargo || user.rol).toUpperCase();
    }
  } else {
    if (headerUser) headerUser.style.display = 'none';
  }
}

function renderAppForUser(user) {
  if (user.rol === 'conductor' || user.rol_id === 3) {
    showView('view-conductor');
    loadConductorTrips();
  } else {
    showView('view-admin');
    switchTab('tab-dashboard');
  }
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-tabs-wrapper .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content-pane').forEach(p => {
    p.style.display = p.id === tabId ? 'block' : 'none';
  });

  if (tabId === 'tab-dashboard') loadDashboardData();
  if (tabId === 'tab-articulos') loadArticulosData();
  if (tabId === 'tab-proveedores') loadProveedoresData();
  if (tabId === 'tab-compras') loadComprasData();
  if (tabId === 'tab-stock') loadStockData();
  if (tabId === 'tab-vehiculos') loadVehiculosData();
  if (tabId === 'tab-ordenes') loadOrdenesData();
}

/* ==========================================================================
   EVENT LISTENERS
   ========================================================================== */
function setupEventListeners() {
  // Login Form
  const loginForm = document.getElementById('form-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('login-id').value;
      const pin = document.getElementById('login-pin').value;
      const errEl = document.getElementById('login-error');
      errEl.style.display = 'none';

      try {
        const user = await window.flotaAuth.login(id, pin);
        showToast(`Bienvenido/a, ${user.nombre}`, 'success');
        renderAppForUser(user);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.flotaAuth.logout();
      showToast('Sesión cerrada correctamente', 'info');
      showView('view-login');
    });
  }

  // Tabs Click
  document.querySelectorAll('.nav-tabs-wrapper .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

/* ==========================================================================
   1. DASHBOARD KPIS
   ========================================================================== */
async function loadDashboardData() {
  try {
    const res = await fetch('/api/dashboard/kpis');
    const json = await res.json();
    if (!json.ok) return;

    const { total_articulos, total_proveedores, total_vehiculos, ordenes } = json.data;

    document.getElementById('kpi-total-articulos').textContent = total_articulos || 0;
    document.getElementById('kpi-total-proveedores').textContent = total_proveedores || 0;
    document.getElementById('kpi-total-vehiculos').textContent = total_vehiculos || 0;
    document.getElementById('kpi-total-despachos').textContent = ordenes.total_ordenes || 0;
    document.getElementById('kpi-ton-transportadas').textContent = (parseFloat(ordenes.total_kg_transportados || 0) / 1000).toFixed(1) + ' Ton';
  } catch (e) {
    console.error('Error cargando KPIs:', e);
  }
}

/* ==========================================================================
   2. CATÁLOGO DE ARTÍCULOS X 13 ACTIVIDADES
   ========================================================================== */
async function loadArticulosData() {
  const container = document.getElementById('articulos-table-body');
  container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">Cargando catálogo...</td></tr>`;

  try {
    const res = await fetch('/api/articulos');
    const json = await res.json();
    if (json.ok) {
      articulosList = json.data || [];
      renderArticulosTable(articulosList);
    }
  } catch (e) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error al cargar artículos</td></tr>`;
  }
}

function renderArticulosTable(items) {
  const container = document.getElementById('articulos-table-body');
  if (items.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay artículos registrados.</td></tr>`;
    return;
  }

  container.innerHTML = items.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.codigo)}</strong></td>
      <td>
        <strong>${escapeHtml(a.nombre)}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.actividad_nombre)}</div>
      </td>
      <td><span class="badge badge-primary">${escapeHtml(a.unidad_medida)}</span></td>
      <td><strong>${parseFloat(a.peso_unitario_kg).toFixed(2)} Kg</strong></td>
      <td>${parseFloat(a.largo_m).toFixed(2)}m × ${parseFloat(a.ancho_m).toFixed(2)}m × ${parseFloat(a.alto_m).toFixed(2)}m</td>
      <td><span class="badge badge-info">${parseFloat(a.volumen_m3).toFixed(4)} m³</span></td>
      <td><strong style="color:var(--success);">$${Number(a.precio_referencia).toLocaleString('es-CO')}</strong></td>
    </tr>
  `).join('');
}

/* ==========================================================================
   3. PROVEEDORES
   ========================================================================== */
async function loadProveedoresData() {
  const container = document.getElementById('proveedores-table-body');
  container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">Cargando proveedores...</td></tr>`;

  try {
    const res = await fetch('/api/proveedores');
    const json = await res.json();
    if (json.ok) {
      proveedoresList = json.data || [];
      renderProveedoresTable(proveedoresList);
    }
  } catch (e) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar proveedores</td></tr>`;
  }
}

function renderProveedoresTable(items) {
  const container = document.getElementById('proveedores-table-body');
  if (items.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">No hay proveedores registrados.</td></tr>`;
    return;
  }

  container.innerHTML = items.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.razon_social)}</strong></td>
      <td>${escapeHtml(p.nit)}</td>
      <td>${escapeHtml(p.municipio)}</td>
      <td>${escapeHtml(p.contacto_nombre || 'N/A')}</td>
      <td>${escapeHtml(p.telefono || 'N/A')}</td>
      <td><span class="badge badge-success">Activo</span></td>
    </tr>
  `).join('');
}

/* ==========================================================================
   4. STOCK E INVENTARIO EN TIEMPO REAL
   ========================================================================== */
async function loadStockData() {
  const container = document.getElementById('stock-table-body');
  container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">Cargando stock...</td></tr>`;

  try {
    const res = await fetch('/api/stock');
    const json = await res.json();
    if (json.ok) {
      const stock = json.data || [];
      renderStockTable(stock);
    }
  } catch (e) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar stock</td></tr>`;
  }
}

function renderStockTable(items) {
  const container = document.getElementById('stock-table-body');
  if (items.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">No hay existencias registradas. Realiza una compra para alimentar el stock.</td></tr>`;
    return;
  }

  container.innerHTML = items.map(s => {
    const disp = parseFloat(s.cantidad_disponible);
    const min = parseFloat(s.stock_minimo);
    const badgeClass = disp <= min ? 'badge-danger' : (disp <= min * 2 ? 'badge-warning' : 'badge-success');

    return `
      <tr>
        <td><strong>${escapeHtml(s.bodega_nombre)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${escapeHtml(s.bodega_municipio)})</span></td>
        <td><strong>${escapeHtml(s.articulo_nombre)}</strong></td>
        <td>${escapeHtml(s.actividad_nombre)}</td>
        <td><span class="badge ${badgeClass}" style="font-size:0.85rem;">${disp} ${escapeHtml(s.unidad_medida)}</span></td>
        <td>${parseFloat(s.peso_unitario_kg * disp).toFixed(1)} Kg</td>
        <td>${parseFloat(s.volumen_m3 * disp).toFixed(3)} m³</td>
      </tr>
    `;
  }).join('');
}

/* ==========================================================================
   5. FLOTA DE VEHÍCULOS
   ========================================================================== */
async function loadVehiculosData() {
  const container = document.getElementById('vehiculos-table-body');
  container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">Cargando flota...</td></tr>`;

  try {
    const res = await fetch('/api/vehiculos');
    const json = await res.json();
    if (json.ok) {
      vehiculosList = json.data || [];
      renderVehiculosTable(vehiculosList);
    }
  } catch (e) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error al cargar flota</td></tr>`;
  }
}

function renderVehiculosTable(items) {
  const container = document.getElementById('vehiculos-table-body');
  if (items.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay vehículos registrados.</td></tr>`;
    return;
  }

  container.innerHTML = items.map(v => `
    <tr>
      <td><strong>${escapeHtml(v.placa)}</strong></td>
      <td><span class="badge badge-primary">${escapeHtml(v.tipo)}</span></td>
      <td>${escapeHtml(v.marca)} (${v.modelo_anio})</td>
      <td><strong>${(parseFloat(v.capacidad_peso_kg)/1000).toFixed(1)} Ton</strong> (${parseFloat(v.capacidad_peso_kg).toLocaleString()} Kg)</td>
      <td><span class="badge badge-info">${parseFloat(v.capacidad_volumen_m3).toFixed(1)} m³</span></td>
      <td>${parseFloat(v.largo_util_m).toFixed(2)}m × ${parseFloat(v.ancho_util_m).toFixed(2)}m × ${parseFloat(v.alto_util_m).toFixed(2)}m</td>
      <td>${escapeHtml(v.conductor_nombre || 'Sin Conductor Asignado')}</td>
    </tr>
  `).join('');
}

/* ==========================================================================
   6. ÓRDENES DE DESPACHO
   ========================================================================== */
async function loadOrdenesData() {
  const container = document.getElementById('ordenes-table-body');
  container.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem;">Cargando órdenes...</td></tr>`;

  try {
    const res = await fetch('/api/ordenes');
    const json = await res.json();
    if (json.ok) {
      ordenesList = json.data || [];
      renderOrdenesTable(ordenesList);
    }
  } catch (e) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Error al cargar órdenes</td></tr>`;
  }
}

function renderOrdenesTable(items) {
  const container = document.getElementById('ordenes-table-body');
  if (items.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem;">No hay órdenes de despacho registradas. Crea una nueva orden arriba.</td></tr>`;
    return;
  }

  container.innerHTML = items.map(o => {
    let badgeState = 'badge-primary';
    if (o.estado === 'EN_RUTA') badgeState = 'badge-warning';
    if (o.estado === 'ENTREGADA') badgeState = 'badge-success';
    if (o.estado === 'CANCELADA') badgeState = 'badge-danger';

    const destinoStr = o.tipo_destino === 'BENEFICIARIO_DIRECTO' 
      ? `Beneficiario: ${escapeHtml(o.destino_beneficiario_nombre || '')} (${escapeHtml(o.municipio_destino || '')})`
      : `Bodega Satélite: ${escapeHtml(o.destino_bodega_nombre || '')}`;

    return `
      <tr>
        <td><strong>${escapeHtml(o.codigo_orden)}</strong></td>
        <td>${destinoStr}</td>
        <td>${escapeHtml(o.vehiculo_placa)} (${escapeHtml(o.conductor_nombre)})</td>
        <td><strong>${(parseFloat(o.peso_total_kg)/1000).toFixed(2)} Ton</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${o.porcentaje_ocupacion_peso}%)</span></td>
        <td>${parseFloat(o.volumen_total_m3).toFixed(2)} m³ <span style="font-size:0.75rem; color:var(--text-muted);">(${o.porcentaje_ocupacion_volumen}%)</span></td>
        <td><span class="badge ${badgeState}">${escapeHtml(o.estado)}</span></td>
        <td>${o.fecha_programada ? o.fecha_programada.substring(0, 10) : ''}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="verDetalleOrden(${o.id})">🔍 Ver Ficha</button>
        </td>
      </tr>
    `;
  }).join('');
}

/* ==========================================================================
   7. MODAL: CREAR ORDEN & MOTOR DE CUBICACIÓN EN VIVO
   ========================================================================== */
function openCrearOrdenModal() {
  orderItemsDraft = [];
  document.getElementById('modal-crear-orden').classList.add('show');
  loadSelectsForOrder();
  renderOrderItemsDraft();
}

function closeCrearOrdenModal() {
  document.getElementById('modal-crear-orden').classList.remove('show');
}

async function loadSelectsForOrder() {
  // 1. Cargar Artículos
  if (articulosList.length === 0) {
    const res = await fetch('/api/articulos');
    const json = await res.json();
    if (json.ok) articulosList = json.data;
  }
  const artSelect = document.getElementById('order-item-select');
  artSelect.innerHTML = '<option value="">-- Seleccionar Material --</option>' + articulosList.map(a => `
    <option value="${a.id}">${escapeHtml(a.codigo)} - ${escapeHtml(a.nombre)} (${a.peso_unitario_kg} Kg | ${a.volumen_m3} m³)</option>
  `).join('');

  // 2. Cargar Bodegas y Proveedores
  const resB = await fetch('/api/bodegas');
  const jsonB = await resB.json();
  const resP = await fetch('/api/proveedores');
  const jsonP = await resP.json();

  const origSelect = document.getElementById('order-origen-select');
  origSelect.innerHTML = '<optgroup label="Bodegas Centrales">' + (jsonB.data || []).map(b => `<option value="BODEGA_${b.id}">Bodega: ${b.nombre}</option>`).join('') +
                         '</optgroup><optgroup label="Proveedores Directos">' + (jsonP.data || []).map(p => `<option value="PROV_${p.id}">Proveedor: ${p.razon_social} (${p.municipio})</option>`).join('') + '</optgroup>';

  // 3. Cargar Beneficiarios para destino
  const resBen = await fetch('/api/beneficiarios?limit=100');
  const jsonBen = await resBen.json();
  const destSelect = document.getElementById('order-destino-select');
  destSelect.innerHTML = '<optgroup label="Bodegas Satélite Municipales">' + (jsonB.data || []).filter(b => b.tipo === 'SATELITE_MUNICIPAL').map(b => `<option value="BOD_SAT_${b.id}">Bodega Satélite ${b.municipio} (${b.nombre})</option>`).join('') +
                         '</optgroup><optgroup label="Beneficiarios Directos (1.399)">' + (jsonBen.data || []).map(bn => `<option value="BEN_${bn.id}">Beneficiario: ${bn.nombre} - ${bn.municipio} (${bn.vereda})</option>`).join('') + '</optgroup>';
}

function addItemToOrderDraft() {
  const artId = document.getElementById('order-item-select').value;
  const cant = parseFloat(document.getElementById('order-item-cant').value);

  if (!artId || !cant || cant <= 0) {
    showToast('Selecciona un artículo y una cantidad válida mayor a 0', 'danger');
    return;
  }

  const art = articulosList.find(a => String(a.id) === String(artId));
  if (!art) return;

  const existIdx = orderItemsDraft.findIndex(i => String(i.articulo_id) === String(artId));
  if (existIdx >= 0) {
    orderItemsDraft[existIdx].cantidad += cant;
  } else {
    orderItemsDraft.push({
      articulo_id: art.id,
      codigo: art.codigo,
      nombre: art.nombre,
      unidad: art.unidad_medida,
      peso_kg: parseFloat(art.peso_unitario_kg),
      volumen_m3: parseFloat(art.volumen_m3),
      largo_m: parseFloat(art.largo_m),
      ancho_m: parseFloat(art.ancho_m),
      alto_m: parseFloat(art.alto_m),
      cantidad: cant
    });
  }

  document.getElementById('order-item-cant').value = '1';
  renderOrderItemsDraft();
  evaluarCubicacionEnVivo();
}

function removeDraftItem(idx) {
  orderItemsDraft.splice(idx, 1);
  renderOrderItemsDraft();
  evaluarCubicacionEnVivo();
}

function renderOrderItemsDraft() {
  const container = document.getElementById('order-items-draft-body');
  if (orderItemsDraft.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Agrega materiales a la orden para calcular cubicación.</td></tr>`;
    return;
  }

  container.innerHTML = orderItemsDraft.map((it, idx) => `
    <tr>
      <td><strong>${escapeHtml(it.codigo)}</strong></td>
      <td>${escapeHtml(it.nombre)}</td>
      <td><strong>${it.cantidad}</strong> ${escapeHtml(it.unidad)}</td>
      <td>${(it.cantidad * it.peso_kg).toFixed(1)} Kg</td>
      <td>${(it.cantidad * it.volumen_m3).toFixed(3)} m³</td>
      <td><button class="btn btn-secondary btn-sm" onclick="removeDraftItem(${idx})">❌</button></td>
    </tr>
  `).join('');
}

// 🧠 MOTOR DE CUBICACIÓN EN VIVO
async function evaluarCubicacionEnVivo() {
  const summaryEl = document.getElementById('cubication-summary-box');
  const fleetEl = document.getElementById('cubication-fleet-eval');

  if (orderItemsDraft.length === 0) {
    summaryEl.innerHTML = 'Agrega artículos a la orden para evaluar capacidad.';
    fleetEl.innerHTML = '';
    return;
  }

  try {
    const res = await fetch('/api/ordenes/evaluar-carga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: orderItemsDraft })
    });

    const json = await res.json();
    if (!json.ok) return;

    const { resumen_carga, evaluacion_vehiculos } = json;

    summaryEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div><strong>Peso Total:</strong> <span style="color:var(--primary); font-size:1.1rem; font-weight:800;">${resumen_carga.peso_total_ton} Ton</span> (${resumen_carga.peso_total_kg} Kg)</div>
        <div><strong>Volumen Total:</strong> <span style="color:var(--info); font-size:1.1rem; font-weight:800;">${resumen_carga.volumen_total_m3} m³</span></div>
        <div><strong>Artículo más Largo:</strong> ${resumen_carga.max_dimensiones_articulo.largo_m}m</div>
      </div>
    `;

    fleetEl.innerHTML = evaluacion_vehiculos.map(v => `
      <div class="veh-eval-card ${v.apto ? 'apto' : 'no-apto'}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${escapeHtml(v.placa)} - ${escapeHtml(v.marca)} (${escapeHtml(v.tipo)})</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              Capacidad: ${(v.capacidad_peso_kg/1000).toFixed(1)}T / ${v.capacidad_volumen_m3}m³ | Furgón: ${v.largo_util_m}m × ${v.ancho_util_m}m × ${v.alto_util_m}m
            </div>
          </div>
          <span class="badge ${v.apto ? 'badge-success' : 'badge-danger'}">
            ${v.apto ? '✅ APTO PARA CARGAR' : '❌ NO APTO'}
          </span>
        </div>
        ${!v.apto ? `
          <div style="font-size:0.78rem; color:var(--danger); margin-top:0.4rem; font-weight:600;">
            ⚠️ Motivo: ${v.razones_rechazo.join(' | ')}
          </div>
        ` : `
          <div style="font-size:0.78rem; color:var(--success); margin-top:0.4rem; font-weight:600;">
            Ocupación Peso: ${v.pct_peso}% | Ocupación Volumen: ${v.pct_volumen}%
          </div>
        `}
      </div>
    `).join('');

    // Poblar selector de vehículo solo con los aptos
    const vehSelect = document.getElementById('order-vehiculo-select');
    vehSelect.innerHTML = '<option value="">-- Seleccionar Vehículo Apto --</option>' + evaluacion_vehiculos.map(v => `
      <option value="${v.id}" ${!v.apto ? 'disabled' : ''}>
        ${v.apto ? '🟢' : '🔴'} ${v.placa} - ${v.marca} (${(v.capacidad_peso_kg/1000).toFixed(1)}T | Ocupa ${v.pct_peso}%)
      </option>
    `).join('');
  } catch (e) {
    console.error('Error evaluando cubicación:', e);
  }
}

async function guardarOrdenDespacho() {
  if (orderItemsDraft.length === 0) {
    showToast('La orden debe tener al menos un artículo', 'danger');
    return;
  }

  const origVal = document.getElementById('order-origen-select').value;
  const destVal = document.getElementById('order-destino-select').value;
  const vehId = document.getElementById('order-vehiculo-select').value;
  const fechaProg = document.getElementById('order-fecha-prog').value;
  const obs = document.getElementById('order-obs').value;

  if (!origVal || !destVal || !vehId) {
    showToast('Selecciona origen, destino y un vehículo apto', 'danger');
    return;
  }

  let tipoOrigen = origVal.startsWith('BODEGA_') ? 'BODEGA_CENTRAL' : 'PROVEEDOR_DIRECTO';
  let origBodegaId = origVal.startsWith('BODEGA_') ? origVal.replace('BODEGA_', '') : null;
  let origProvId = origVal.startsWith('PROV_') ? origVal.replace('PROV_', '') : null;

  let tipoDestino = destVal.startsWith('BEN_') ? 'BENEFICIARIO_DIRECTO' : 'BODEGA_SATELITE';
  let destBenId = destVal.startsWith('BEN_') ? destVal.replace('BEN_', '') : null;
  let destBodId = destVal.startsWith('BOD_SAT_') ? destVal.replace('BOD_SAT_', '') : null;

  try {
    const res = await fetch('/api/ordenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_origen: tipoOrigen,
        origen_bodega_id: origBodegaId,
        origen_proveedor_id: origProvId,
        tipo_destino: tipoDestino,
        destino_beneficiario_id: destBenId,
        destino_bodega_id: destBodId,
        vehiculo_id: parseInt(vehId, 10),
        fecha_programada: fechaProg,
        items: orderItemsDraft,
        observaciones: obs
      })
    });

    const json = await res.json();
    if (json.ok) {
      showToast(json.mensaje, 'success');
      closeCrearOrdenModal();
      loadOrdenesData();
    } else {
      showToast(json.error || 'Error creando orden', 'danger');
    }
  } catch (e) {
    showToast('Error de conexión con el servidor', 'danger');
  }
}

/* ==========================================================================
   8. VISTA MÓVIL DEL CONDUCTOR Y CONFIRMACIÓN DE ENTREGA
   ========================================================================== */
async function loadConductorTrips() {
  const user = window.flotaAuth.getUser();
  const container = document.getElementById('conductor-trips-container');
  container.innerHTML = '<div style="text-align:center; padding:2rem;">Cargando tus viajes programados...</div>';

  try {
    const res = await fetch(`/api/ordenes?conductor_id=${user.id}`);
    const json = await res.json();
    if (!json.ok || !json.data || json.data.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1rem;">
          <div style="font-size:3rem; margin-bottom:0.5rem;">🚚</div>
          <h3>No tienes viajes asignados</h3>
          <p style="color:var(--text-muted);">En cuanto te asignen una orden de carga aparecerá aquí.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = json.data.map(t => {
      const isEntregada = t.estado === 'ENTREGADA';
      const isEnRuta = t.estado === 'EN_RUTA';

      return `
        <div class="card" style="margin-bottom:1rem; border-left: 4px solid ${isEntregada ? 'var(--success)' : (isEnRuta ? 'var(--warning)' : 'var(--primary)')};">
          <div class="card-header">
            <div>
              <strong style="font-size:1.05rem;">${escapeHtml(t.codigo_orden)}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">Placa: ${escapeHtml(t.vehiculo_placa)} | ${(t.peso_total_kg/1000).toFixed(2)} Ton</div>
            </div>
            <span class="badge ${isEntregada ? 'badge-success' : (isEnRuta ? 'badge-warning' : 'badge-primary')}">${escapeHtml(t.estado)}</span>
          </div>
          <div class="card-body">
            <div style="margin-bottom:0.75rem;">
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">📍 PUNTO DE RECOGIDA:</div>
              <div>${t.tipo_origen === 'BODEGA_CENTRAL' ? escapeHtml(t.origen_bodega_nombre || 'Bodega Central') : escapeHtml(t.origen_proveedor_nombre || 'Proveedor')}</div>
            </div>
            <div style="margin-bottom:0.75rem;">
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">🏁 PUNTO DE ENTREGA:</div>
              <strong>${t.tipo_destino === 'BENEFICIARIO_DIRECTO' ? `${escapeHtml(t.destino_beneficiario_nombre)} (${escapeHtml(t.municipio_destino)} - ${escapeHtml(t.vereda_destino)})` : escapeHtml(t.destino_bodega_nombre)}</strong>
            </div>

            <div style="display:flex; gap:0.5rem; margin-top:1rem;">
              ${!isEntregada && !isEnRuta ? `
                <button class="btn btn-primary" style="flex:1;" onclick="actualizarEstadoViaje(${t.id}, 'EN_RUTA')">🚚 Iniciar Viaje / En Ruta</button>
              ` : ''}
              ${isEnRuta ? `
                <button class="btn btn-success" style="flex:1;" onclick="abrirModalEntrega(${t.id})">✍️ Confirmar Entrega y Firma</button>
              ` : ''}
              ${isEntregada ? `
                <span style="color:var(--success); font-weight:700;">✅ Entrega completada y firmada</span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div style="text-align:center; color:red;">Error al cargar tus viajes.</div>';
  }
}

async function actualizarEstadoViaje(ordenId, estado) {
  try {
    const res = await fetch(`/api/ordenes/${ordenId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    const json = await res.json();
    if (json.ok) {
      showToast(`Viaje actualizado a: ${estado}`, 'success');
      loadConductorTrips();
    }
  } catch (e) {
    showToast('Error al actualizar estado', 'danger');
  }
}

/* ==========================================================================
   FIRMA DIGITAL EN CANVAS
   ========================================================================== */
let activeOrderIdForDelivery = null;
let canvas, ctx, isDrawing = false;

function abrirModalEntrega(ordenId) {
  activeOrderIdForDelivery = ordenId;
  document.getElementById('modal-confirmar-entrega').classList.add('show');

  canvas = document.getElementById('signature-canvas');
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  limpiarFirma();

  // Mouse & Touch events
  canvas.onmousedown = (e) => { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
  canvas.onmousemove = (e) => { if (isDrawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } };
  window.onmouseup = () => { isDrawing = false; };

  canvas.ontouchstart = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
  };
  canvas.ontouchmove = (e) => {
    e.preventDefault();
    if (isDrawing) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      ctx.stroke();
    }
  };
  canvas.ontouchend = () => { isDrawing = false; };
}

function limpiarFirma() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function cerrarModalEntrega() {
  document.getElementById('modal-confirmar-entrega').classList.remove('show');
}

async function guardarEntregaConFirma() {
  const nombre = document.getElementById('entrega-nombre').value;
  const doc = document.getElementById('entrega-doc').value;
  const obs = document.getElementById('entrega-obs').value;

  if (!nombre || !doc) {
    showToast('Ingresa el nombre y cédula de quien recibe', 'danger');
    return;
  }

  const firmaBase64 = canvas.toDataURL('image/png');

  try {
    const res = await fetch(`/api/ordenes/${activeOrderIdForDelivery}/confirmar-entrega`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recibido_por_nombre: nombre,
        recibido_por_documento: doc,
        recibido_por_rol: 'Beneficiario / Encargado',
        firma_digital_base64: firmaBase64,
        observaciones: obs
      })
    });

    const json = await res.json();
    if (json.ok) {
      showToast(json.mensaje, 'success');
      cerrarModalEntrega();
      loadConductorTrips();
    } else {
      showToast(json.error || 'Error al guardar entrega', 'danger');
    }
  } catch (e) {
    showToast('Error de conexión', 'danger');
  }
}

/* ==========================================================================
   UTILIDADES
   ========================================================================== */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function createToastContainer() {
  const div = document.createElement('div');
  div.id = 'toast-container';
  div.className = 'toast-container';
  document.body.appendChild(div);
  return div;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
