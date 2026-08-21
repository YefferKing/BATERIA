
/* ==========================================================================
   PLUGINS DE ETIQUETAS DE PORCENTAJE VISIBLES PARA CHART.JS
   ========================================================================== */
const visibleDonutPercentagePlugin = {
  id: 'visibleDonutPercentagePlugin',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    const dataset = data.datasets[0];
    if (!dataset) return;
    const total = dataset.data.reduce((a, b) => a + (Number(b) || 0), 0);
    if (total === 0) return;

    chart.getDatasetMeta(0).data.forEach((element, index) => {
      const val = Number(dataset.data[index]) || 0;
      if (val <= 0) return;
      const pctVal = ((val / total) * 100);
      const pctStr = pctVal.toFixed(1) + '%';

      // Posición del centroide del arco
      const pos = element.tooltipPosition();
      if (!pos || isNaN(pos.x) || isNaN(pos.y)) return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(pctStr, pos.x, pos.y);
      ctx.restore();
    });
  }
};

const visibleBarLabelsPlugin = {
  id: 'visibleBarLabelsPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const isHorizontal = chart.config.options && chart.config.options.indexAxis === 'y';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || !meta.visible) return;

      meta.data.forEach((element, index) => {
        const val = dataset.data[index];
        if (val === null || val === undefined || val === 0) return;

        ctx.save();
        ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        ctx.font = 'bold 10px "Inter", "Segoe UI", sans-serif';

        let labelText = '';
        if (dataset.customLabels && dataset.customLabels[index]) {
          labelText = dataset.customLabels[index];
        } else if (typeof val === 'number') {
          labelText = (dataset.label && dataset.label.includes('%')) ? `${val.toFixed(1)}%` : `${val}`;
        } else {
          labelText = String(val);
        }

        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, element.x + 5, element.y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(labelText, element.x, element.y - 2);
        }
        ctx.restore();
      });
    });
  }
};

/**
 * CONTROLADOR PRINCIPAL DE LA APLICACIÓN
 * Autenticación Offline, Control de Roles/Permisos y Gestión con MySQL.
 */

/* ==========================================================================
   SISTEMA DE GESTIÓN DE TEMA (MODO OSCURO / CLARO)
   ========================================================================== */
window.initTheme = function () {
  try {
    const savedTheme = localStorage.getItem('app_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    window.applyTheme(currentTheme, false);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('app_theme')) {
          window.applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  } catch (e) {
    console.warn('Error inicializando tema:', e);
  }
};

window.applyTheme = function (theme, showNotice = false) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('app_theme', theme);
  } catch (e) {}

  // Meta theme-color para barra de estado en móviles
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#090d16' : '#0f172a');
  }

  // Actualizar ítem en el menú desplegable de perfil
  const dropdownIcon = document.getElementById('dropdown-theme-icon');
  const dropdownText = document.getElementById('dropdown-theme-text');
  if (dropdownIcon) dropdownIcon.textContent = isDark ? '☀️' : '🌙';
  if (dropdownText) dropdownText.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';

  // Actualizar botón en el header durante la pantalla de login
  const headerLoginIcon = document.getElementById('header-login-theme-icon');
  const headerLoginText = document.getElementById('header-login-theme-text');
  if (headerLoginIcon) headerLoginIcon.textContent = isDark ? '☀️' : '🌙';
  if (headerLoginText) headerLoginText.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';

  // Configurar defaults globales de Chart.js
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = isDark ? '#cbd5e1' : '#475569';
    Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  }

  if (showNotice && typeof showToast === 'function') {
    showToast(`Modo ${isDark ? 'Oscuro' : 'Claro'} activado`, 'info');
  }
};

window.toggleTheme = function () {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  window.applyTheme(newTheme, true);

  // Si estamos en la vista de administración, refrescar el dashboard gerencial o reporte de inmediato
  const adminView = document.getElementById('view-admin');
  if (adminView && adminView.classList.contains('active')) {
    const dashPane = document.getElementById('admin-tab-dashboard');
    if (dashPane && dashPane.style.display !== 'none' && typeof renderExecutiveDashboard === 'function') {
      renderExecutiveDashboard();
    }
    const reportPane = document.getElementById('admin-tab-reportes');
    if (reportPane && reportPane.style.display !== 'none' && typeof aplicarFiltrosReporte === 'function') {
      aplicarFiltrosReporte();
    }
  }
};

// Inicializar tema de inmediato
window.initTheme();

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Confirmar sincronización de UI de tema
  window.initTheme();

  // 1. Inicializar Base de Datos Local
  try {
    await window.dbManager.init();
    console.log('IndexedDB inicializada y sincronizada con MySQL.');
  } catch (err) {
    showToast('Error en almacenamiento local: ' + err.message, 'danger');
  }

  // 2. Control de Estado de Red (Online / Offline)
  setupNetworkListener();

  // 3. Inicializar Autenticación y comprobar sesión previa
  const currentSession = await window.authService.init();
  if (currentSession) {
    renderAppForUser(currentSession);
  } else {
    showView('view-login');
  }

  // 4. Asignar Eventos de la Interfaz
  setupEventListeners();
});

/* ==========================================================================
   GESTIÓN DE RED & MODO OFFLINE
   ========================================================================== */
function setupNetworkListener() {
  const dot = document.getElementById('avatar-status-dot');

  function updateStatus() {
    const isOnline = navigator.onLine;
    if (dot) {
      if (isOnline) {
        dot.className = 'avatar-status-dot online';
        dot.title = 'En Línea';
      } else {
        dot.className = 'avatar-status-dot offline';
        dot.title = 'Sin Conexión (Offline)';
      }
    }
  }

  window.addEventListener('online', () => {
    updateStatus();
    showToast('Conexión con el servidor disponible.', 'info');
  });

  window.addEventListener('offline', () => {
    updateStatus();
    showToast('Modo sin conexión activo (100% operativo en campo).', 'warning');
  });

  updateStatus();
}

/* ==========================================================================
   CONTROL DE NAVEGACIÓN & VISTAS
   ========================================================================== */
function showView(viewId) {
  document.querySelectorAll('.app-view').forEach((v) => v.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  const userHeader = document.getElementById('header-user-info');
  const loginThemeBtn = document.getElementById('header-login-theme-btn');
  const user = window.authService.getCurrentUser();

  if (user) {
    userHeader.style.display = 'inline-block';
    if (loginThemeBtn) loginThemeBtn.style.display = 'none';

    // Datos dentro del dropdown
    document.getElementById('dropdown-user-fullname').textContent = user.nombre;
    const roleBadge = document.getElementById('dropdown-user-role');
    if (roleBadge) {
      const rolDisplay = (user.rol_nombre || user.rol || 'USUARIO').toUpperCase();
      roleBadge.textContent = rolDisplay;
      roleBadge.className = `badge ${user.rol_id === 1 ? 'badge-role-admin' : 'badge-role-inspector'}`;
    }
    document.getElementById('dropdown-user-sub').textContent = `Usuario: ${user.usuario} | Doc: ${user.documento}`;
  } else {
    userHeader.style.display = 'none';
    if (loginThemeBtn) loginThemeBtn.style.display = 'inline-flex';
  }

  window.authService.applyUIPermissions();
  updateSyncUI();
}

function renderAppForUser(user) {
  const hasAdminAccess = window.authService.hasPermission('VER_PANEL_ADMIN') ||
                         window.authService.hasPermission('GESTIONAR_INSPECTORES') ||
                         window.authService.hasPermission('EDITAR_PIN_INSPECTOR') ||
                         window.authService.hasPermission('VER_REGISTROS_GLOBALES') ||
                         window.authService.hasPermission('EXPORTAR_DATOS');

  const hasFormAccess = window.authService.hasPermission('DILIGENCIAR_FORMULARIO');

  if (hasAdminAccess) {
    showView('view-admin');
    loadAdminDashboard();
  } else if (hasFormAccess) {
    showView('view-inspector');
    loadInspectorDashboard(user);
  } else {
    showView('view-no-permissions');
  }
}

/* ==========================================================================
   EVENTOS DE LOGIN & ACCESOS
   ========================================================================== */
// Variables globales de paginación de inspectores
let inspectorsData = [];
let inspectorsFiltered = [];
let currentInspectorPage = 1;
const INSPECTORS_PER_PAGE = 10;

// Variables globales de paginación de beneficiarios
let beneficiariosData = [];
let beneficiariosFiltered = [];
let currentBenPage = 1;
const BENEFICIARIOS_PER_PAGE = 20;
let municipiosData = [];
let veredasData = [];

function setupEventListeners() {
  // Formulario de Login
  const loginForm = document.getElementById('form-login');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value;
    const pin = document.getElementById('login-pin').value;
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    try {
      const user = await window.authService.login(identifier, pin);
      showToast(`Bienvenido/a, ${user.nombre}`, 'success');
      loginForm.reset();
      renderAppForUser(user);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });

  // Botón Ver / Ocultar Clave (Ojo)
  const btnTogglePin = document.getElementById('btn-toggle-pin');
  const pinInput = document.getElementById('login-pin');
  const iconShow = document.getElementById('eye-icon-show');
  const iconHide = document.getElementById('eye-icon-hide');

  if (btnTogglePin && pinInput) {
    btnTogglePin.addEventListener('click', () => {
      const isPassword = pinInput.type === 'password';
      pinInput.type = isPassword ? 'text' : 'password';
      if (iconShow && iconHide) {
        iconShow.style.display = isPassword ? 'none' : 'block';
        iconHide.style.display = isPassword ? 'block' : 'none';
      }
    });
  }

  // Desplegable de Perfil de Usuario (Dropdown)
  const profileTrigger = document.getElementById('user-profile-trigger');
  const profileMenu = document.getElementById('user-profile-menu');

  if (profileTrigger && profileMenu) {
    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileMenu.classList.contains('show');
      profileMenu.classList.toggle('show', !isOpen);
      profileTrigger.classList.toggle('active', !isOpen);
    });

    // Cerrar al hacer clic en cualquier lugar fuera
    document.addEventListener('click', (e) => {
      if (!profileTrigger.contains(e.target) && !profileMenu.contains(e.target)) {
        profileMenu.classList.remove('show');
        profileTrigger.classList.remove('active');
      }
    });
  }

function resetAppState() {
  currentInspectorPage = 1;
  currentBenPage = 1;
  const searchInspectors = document.getElementById('search-inspectors-input');
  if (searchInspectors) searchInspectors.value = '';

  const searchBen = document.getElementById('filter-ben-search');
  if (searchBen) searchBen.value = '';
  const munSelect = document.getElementById('filter-ben-municipio');
  if (munSelect) munSelect.value = '';
  const veredaSelect = document.getElementById('filter-ben-vereda');
  if (veredaSelect) veredaSelect.value = '';
  const faseSelect = document.getElementById('filter-ben-fase');
  if (faseSelect) faseSelect.value = '';
  const estadoSelect = document.getElementById('filter-ben-estado');
  if (estadoSelect) estadoSelect.value = '';

  document.querySelectorAll('.admin-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-pane').forEach((p) => (p.style.display = 'none'));
  const firstTabBtn = document.querySelector('.admin-tabs .tab-btn[data-tab="admin-tab-inspectores"]');
  const firstPane = document.getElementById('admin-tab-inspectores');
  if (firstTabBtn) firstTabBtn.classList.add('active');
  if (firstPane) firstPane.style.display = 'block';
}

  // Botón Cerrar Sesión desde el Dropdown
  const btnDropdownLogout = document.getElementById('btn-dropdown-logout');
  if (btnDropdownLogout) {
    btnDropdownLogout.addEventListener('click', async () => {
      if (profileMenu) profileMenu.classList.remove('show');
      if (profileTrigger) profileTrigger.classList.remove('active');
      await window.authService.logout();
      resetAppState();
      showToast('Sesión cerrada correctamente.', 'info');
      showView('view-login');
    });
  }

  // Tabs de Administrador
  document.querySelectorAll('.admin-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.admin-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-pane').forEach((p) => (p.style.display = 'none'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.style.display = 'block';

      if (btn.dataset.tab === 'admin-tab-dashboard') {
        renderExecutiveDashboard();
      } else if (btn.dataset.tab === 'admin-tab-reportes') {
        loadReportesAdminPage();
      } else if (btn.dataset.tab === 'admin-tab-permisos') {
        loadRolesAndPermissions();
      } else if (btn.dataset.tab === 'admin-tab-beneficiarios') {
        loadBeneficiariosDashboard();
      } else if (btn.dataset.tab === 'admin-tab-inspecciones') {
        loadInspeccionesAdminPage();
      } else if (btn.dataset.tab === 'admin-tab-inspectores') {
        loadInspectorsTable();
      }
    });
  });

  // Filtros y Búsqueda de Beneficiarios
  const filterBenSearch = document.getElementById('filter-ben-search');
  if (filterBenSearch) {
    filterBenSearch.addEventListener('input', () => filterBeneficiarios());
  }

  const filterBenMunicipio = document.getElementById('filter-ben-municipio');
  if (filterBenMunicipio) {
    filterBenMunicipio.addEventListener('change', () => onMunicipioFilterChange());
  }

  const filterBenVereda = document.getElementById('filter-ben-vereda');
  if (filterBenVereda) {
    filterBenVereda.addEventListener('change', () => filterBeneficiarios());
  }

  const filterBenFase = document.getElementById('filter-ben-fase');
  if (filterBenFase) {
    filterBenFase.addEventListener('change', () => filterBeneficiarios());
  }

  const filterBenEstado = document.getElementById('filter-ben-estado');
  if (filterBenEstado) {
    filterBenEstado.addEventListener('change', () => filterBeneficiarios());
  }

  // Búsqueda con Paginación en tabla de inspectores
  const searchInspectors = document.getElementById('search-inspectors-input');
  if (searchInspectors) {
    searchInspectors.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      if (!term) {
        inspectorsFiltered = [...inspectorsData];
      } else {
        inspectorsFiltered = inspectorsData.filter((i) => {
          const nombre = (i.nombre || '').toLowerCase();
          const doc = String(i.documento || '').toLowerCase();
          const user = (i.usuario || '').toLowerCase();
          const rol = (i.rol_nombre || '').toLowerCase();
          return nombre.includes(term) || doc.includes(term) || user.includes(term) || rol.includes(term);
        });
      }
      currentInspectorPage = 1;
      renderInspectorsPage();
    });
  }

  // 1. Crear Nuevo Inspector / Usuario
  const formCreateInspector = document.getElementById('form-create-inspector');
  if (formCreateInspector) {
    formCreateInspector.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('create-user-nombre').value.trim();
      const documento = document.getElementById('create-user-documento').value.trim();
      const usuario = document.getElementById('create-user-usuario').value.trim();
      const pin = document.getElementById('create-user-pin').value.trim();
      const rol_id = parseInt(document.getElementById('create-user-rol').value, 10);
      const activo = document.getElementById('create-user-activo').checked;

      try {
        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, documento, usuario, pin, rol_id, activo })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al crear usuario');

        showToast('Usuario creado exitosamente.', 'success');
        closeModal('modal-create-inspector');
        formCreateInspector.reset();

        await window.dbManager.syncDataFromMySQL();
        await loadAdminDashboard();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // 2. Editar Inspector / Usuario
  const formEditInspector = document.getElementById('form-edit-inspector');
  if (formEditInspector) {
    formEditInspector.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = parseInt(document.getElementById('edit-inspector-id').value, 10);
      const nombre = document.getElementById('edit-inspector-nombre').value.trim();
      const documento = document.getElementById('edit-inspector-documento').value.trim();
      const pin = document.getElementById('edit-inspector-pin').value.trim();
      const rol_id = parseInt(document.getElementById('edit-inspector-rol').value, 10);
      const activo = document.getElementById('edit-inspector-activo').checked;

      try {
        const res = await fetch(`/api/usuarios/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, documento, pin, rol_id, activo })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al actualizar usuario');

        showToast('Usuario actualizado exitosamente.', 'success');
        closeModal('modal-edit-inspector');

        await window.dbManager.syncDataFromMySQL();
        await loadAdminDashboard();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // 3. Crear Nuevo Rol
  const formCreateRole = document.getElementById('form-create-role');
  if (formCreateRole) {
    formCreateRole.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('create-role-nombre').value.trim();
      const descripcion = document.getElementById('create-role-descripcion').value.trim();

      try {
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, descripcion })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error al crear rol');

        showToast('Rol creado exitosamente.', 'success');
        closeModal('modal-create-role');
        formCreateRole.reset();

        await window.dbManager.syncDataFromMySQL();
        await loadRolesAndPermissions();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // 4. Editar Beneficiario
  const formEditBen = document.getElementById('form-edit-beneficiario');
  if (formEditBen) {
    formEditBen.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = parseInt(document.getElementById('edit-ben-id').value, 10);
      const nombre = document.getElementById('edit-ben-nombre').value.trim();
      const documento = document.getElementById('edit-ben-documento').value.trim();
      const fase = parseInt(document.getElementById('edit-ben-fase').value, 10);
      const estado = parseInt(document.getElementById('edit-ben-estado').value, 10);
      const municipio_id = parseInt(document.getElementById('edit-ben-municipio').value, 10);
      const vereda_id = parseInt(document.getElementById('edit-ben-vereda').value, 10);
      const coordenadas = document.getElementById('edit-ben-coordenadas').value.trim();

      const munObj = municipiosData.find((m) => m.id === municipio_id);
      const verObj = veredasData.find((v) => v.id === vereda_id);

      const updatedPayload = {
        id,
        fase,
        municipio_id,
        municipio: munObj ? munObj.nombre : '',
        vereda_id,
        vereda: verObj ? verObj.nombre : '',
        nombre,
        documento,
        estado,
        coordenadas: coordenadas || null
      };

      try {
        const savedData = await window.dbManager.updateBeneficiario(updatedPayload);

        // Actualizar en memoria local
        const idx = beneficiariosData.findIndex((b) => b.id === id);
        if (idx !== -1) {
          beneficiariosData[idx] = { ...beneficiariosData[idx], ...updatedPayload, ...(savedData || {}) };
        }
        const fIdx = beneficiariosFiltered.findIndex((b) => b.id === id);
        if (fIdx !== -1) {
          beneficiariosFiltered[fIdx] = { ...beneficiariosFiltered[fIdx], ...updatedPayload, ...(savedData || {}) };
        }

        // Actualizar métricas
        document.getElementById('stat-beneficiarios-vivos').textContent = Number(beneficiariosData.filter((b) => b.estado == 1).length).toLocaleString('es-CO');
        document.getElementById('stat-beneficiarios-fallecidos').textContent = Number(beneficiariosData.filter((b) => b.estado == 0).length).toLocaleString('es-CO');

        renderBeneficiariosPage();
        closeModal('modal-edit-beneficiario');
        showToast('Beneficiario actualizado exitosamente.', 'success');
      } catch (err) {
        showToast('Error al actualizar beneficiario: ' + err.message, 'danger');
      }
    });
  }

  // 9.1 Formulario Crear Nuevo Beneficiario
  const formCreateBen = document.getElementById('form-create-beneficiario');
  if (formCreateBen) {
    formCreateBen.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('create-ben-nombre').value.trim();
      const documento = document.getElementById('create-ben-documento').value.trim();
      const fase = parseInt(document.getElementById('create-ben-fase').value, 10);
      const estado = parseInt(document.getElementById('create-ben-estado').value, 10);
      const municipio_id = parseInt(document.getElementById('create-ben-municipio').value, 10);
      const vereda_id = parseInt(document.getElementById('create-ben-vereda').value, 10);
      const coordenadas = document.getElementById('create-ben-coordenadas').value.trim();

      if (!nombre || !documento || !municipio_id || !vereda_id) {
        showToast('Por favor diligencie todos los campos obligatorios (*).', 'warning');
        return;
      }

      const munObj = municipiosData.find((m) => m.id === municipio_id);
      const verObj = veredasData.find((v) => v.id === vereda_id);

      const newPayload = {
        fase,
        municipio_id,
        municipio: munObj ? munObj.nombre : '',
        vereda_id,
        vereda: verObj ? verObj.nombre : '',
        nombre: nombre.toUpperCase(),
        documento,
        estado,
        coordenadas: coordenadas || null,
        avance: 0,
        estado_bateria: 'SIN_INICIAR'
      };

      try {
        const savedData = await window.dbManager.createBeneficiario(newPayload);

        // Actualizar en memoria local
        beneficiariosData.unshift({ ...newPayload, ...(savedData || {}) });
        beneficiariosFiltered.unshift({ ...newPayload, ...(savedData || {}) });

        // Actualizar métricas
        const totalEl = document.getElementById('stat-total-beneficiarios');
        if (totalEl) totalEl.textContent = Number(beneficiariosData.length).toLocaleString('es-CO');
        const vivosEl = document.getElementById('stat-beneficiarios-vivos');
        if (vivosEl) vivosEl.textContent = Number(beneficiariosData.filter((b) => b.estado == 1).length).toLocaleString('es-CO');
        const fallEl = document.getElementById('stat-beneficiarios-fallecidos');
        if (fallEl) fallEl.textContent = Number(beneficiariosData.filter((b) => b.estado == 0).length).toLocaleString('es-CO');

        renderBeneficiariosPage();
        closeModal('modal-create-beneficiario');
        formCreateBen.reset();
        showToast('Beneficiario registrado exitosamente en el sistema.', 'success');
      } catch (err) {
        showToast('Error al registrar beneficiario: ' + err.message, 'danger');
      }
    });
  }
}

function resetAppState() {
  // Limpiar inputs de búsqueda y formularios
  const searchInput = document.getElementById('search-inspectors-input');
  if (searchInput) searchInput.value = '';

  const loginForm = document.getElementById('form-login');
  if (loginForm) loginForm.reset();

  currentInspectorPage = 1;
  inspectorsData = [];
  inspectorsFiltered = [];

  // Resetear tabs siempre a la primera pestaña
  document.querySelectorAll('.admin-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-pane').forEach((p) => (p.style.display = 'none'));
  const firstTabBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-inspectores"]');
  const firstTabPane = document.getElementById('admin-tab-inspectores');
  if (firstTabBtn) firstTabBtn.classList.add('active');
  if (firstTabPane) firstTabPane.style.display = 'block';
}

/* ==========================================================================
   MÓDULO CENTRAL: INSPECCIÓN DE CAMPO Y EVALUACIÓN DE ACTIVIDADES
   ========================================================================== */
let currentInspectorBeneficiarios = [];
let selectedBeneficiario = null;
let activitiesList = [];
let currentActivitiesScores = {};
let currentInspectionPhotos = [];

async function loadInspectorDashboard(user) {
  document.getElementById('inspector-title-name').textContent = user.nombre;
  document.getElementById('inspector-doc-badge').textContent = `Cédula: ${user.documento}`;

  // 1. Cargar catálogo de los 13 Capítulos / Actividades
  activitiesList = await window.dbManager.getActividades();

  // 2. Cargar catálogos de apoyo si están vacíos
  if (municipiosData.length === 0) {
    municipiosData = await window.dbManager.getMunicipios();
    veredasData = await window.dbManager.getVeredasByMunicipio();
  }

  // 3. Cargar beneficiarios filtrados según asignación territorial del inspector
  currentInspectorBeneficiarios = await window.dbManager.getBeneficiariosForInspector(user.id);

  // 4. Mostrar información de zona asignada
  const zonas = await window.dbManager.getUserZonas(user.id);
  const territoryInfoEl = document.getElementById('insp-territory-info');
  if (territoryInfoEl) {
    if (zonas && zonas.length > 0) {
      const munNames = Array.from(new Set(zonas.map((z) => z.municipio).filter(Boolean)));
      territoryInfoEl.textContent = `📍 Zona asignada: ${munNames.join(', ') || 'Veredas específicas'} (${zonas.length} veredas • ${currentInspectorBeneficiarios.length} beneficiarios)`;
    } else {
      territoryInfoEl.textContent = `📍 Cobertura Global (${currentInspectorBeneficiarios.length} beneficiarios)`;
    }
  }

  clearSelectedBeneficiaryForInspection();
}

window.onSearchBeneficiaryForInspection = function () {
  const rawInput = document.getElementById('insp-search-beneficiary')?.value || '';
  const query = rawInput.toLowerCase().trim().replace(/^#/, '');
  const dropdown = document.getElementById('insp-search-results-dropdown');
  if (!dropdown) return;

  // Filtrar estrictamente solo beneficiarios vivos (estado = 1)
  const poolVivos = currentInspectorBeneficiarios.filter((b) => b.estado == 1);

  // Si no hay texto, mostrar los primeros 15 beneficiarios asignados para selección rápida
  let matches = [];
  if (!query) {
    matches = poolVivos.slice(0, 15);
  } else {
    matches = poolVivos.filter((b) => {
      const nom = (b.nombre || '').toLowerCase();
      const doc = (b.documento || '').toLowerCase();
      const idStr = String(b.id);
      const mun = (b.municipio || '').toLowerCase();
      const ver = (b.vereda || '').toLowerCase();
      return nom.includes(query) || doc.includes(query) || idStr.includes(query) || mun.includes(query) || ver.includes(query);
    }).slice(0, 20);
  }

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        No se encontraron beneficiarios con "<strong>${escapeHtml(query)}</strong>" en tu zona asignada.
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches
    .map((b) => {
      return `
        <div onclick="selectBeneficiaryForInspection(${b.id})" style="padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;" onmouseover="this.style.background='var(--bg-subtle)'" onmouseout="this.style.background='transparent'">
          <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">
              #${b.id} • ${escapeHtml(b.nombre)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              CC: <code>${escapeHtml(b.documento)}</code> • 🏛️ ${escapeHtml(b.municipio || '')} - 🌲 ${escapeHtml(b.vereda || '')} (Fase ${b.fase})
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 3px 8px;">
            Seleccionar ➔
          </button>
        </div>
      `;
    })
    .join('');

  dropdown.style.display = 'block';
};

// Cerrar dropdown si se hace clic fuera
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('insp-search-results-dropdown');
  const searchInput = document.getElementById('insp-search-beneficiary');
  if (dropdown && searchInput && !dropdown.contains(e.target) && e.target !== searchInput) {
    dropdown.style.display = 'none';
  }
});

window.clearSelectedBeneficiaryForInspection = function () {
  selectedBeneficiario = null;
  currentActivitiesScores = {};
  currentInspectionPhotos = [];

  const searchInput = document.getElementById('insp-search-beneficiary');
  if (searchInput) searchInput.value = '';

  const dropdown = document.getElementById('insp-search-results-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const formContainer = document.getElementById('insp-form-container');
  if (formContainer) formContainer.style.display = 'none';

  renderInspectionPhotos();
};

window.selectBeneficiaryForInspection = async function (beneficiarioId) {
  const b = currentInspectorBeneficiarios.find((item) => item.id === beneficiarioId) || (await window.dbManager.getBeneficiarios()).find((item) => item.id === beneficiarioId);
  if (!b || b.estado != 1) return;

  selectedBeneficiario = b;
  currentInspectionPhotos = [];

  // Ocultar dropdown y setear nombre en input
  const dropdown = document.getElementById('insp-search-results-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const searchInput = document.getElementById('insp-search-beneficiary');
  if (searchInput) searchInput.value = `#${b.id} - ${b.nombre} (CC: ${b.documento})`;

  // Llenar tarjeta de beneficiario
  document.getElementById('insp-ben-nombre').textContent = b.nombre;
  document.getElementById('insp-ben-cedula').textContent = b.documento;
  document.getElementById('insp-ben-municipio').textContent = b.municipio || 'N/A';
  document.getElementById('insp-ben-vereda').textContent = b.vereda || 'N/A';
  document.getElementById('insp-ben-fase-badge').textContent = `Fase ${b.fase}`;
  document.getElementById('insp-ben-estado-badge').textContent = b.estado == 1 ? 'VIVO' : 'FALLECIDO';
  document.getElementById('insp-ben-estado-badge').className = `badge ${b.estado == 1 ? 'badge-status-active' : 'badge-status-inactive'}`;

  // Coordenadas automáticas registradas del beneficiario
  const gpsInput = document.getElementById('insp-coordenadas-input');
  let coords = b.coordenadas || '';
  if (!coords && (b.latitud || b.longitud)) {
    coords = `${b.latitud || ''}, ${b.longitud || ''}`.trim().replace(/^,|,$/g, '');
  }
  if (gpsInput) gpsInput.value = coords || 'Sin coordenadas registradas';

  const obsInput = document.getElementById('insp-observaciones-input');
  if (obsInput) obsInput.value = '';

  // 4. Cargar última inspección registrada para inicializar los porcentajes acumulados
  let previousScores = {};
  let hasPreviousVisits = false;
  try {
    const latestInsp = await window.dbManager.getLatestInspectionForBeneficiario(b.id);
    if (latestInsp && Array.isArray(latestInsp.detalles) && latestInsp.detalles.length > 0) {
      hasPreviousVisits = true;
      for (const d of latestInsp.detalles) {
        previousScores[d.actividad_id] = {
          porcentaje: parseInt(d.porcentaje, 10) || 0,
          observacion: d.observacion_item || ''
        };
      }
    }
  } catch (err) {
    console.error('Error al cargar última inspección:', err);
  }

  // Inicializar puntuaciones de las 13 actividades
  currentActivitiesScores = {};
  for (const act of activitiesList) {
    const prev = previousScores[act.id];
    const isRated = Boolean(hasPreviousVisits && prev !== undefined);
    const pct = isRated ? prev.porcentaje : null;
    const statusObj = pct !== null ? window.dbManager.calculateActivityStatus(pct) : null;

    currentActivitiesScores[act.id] = {
      actividad_id: act.id,
      nombre: act.nombre,
      orden: act.orden,
      peso: parseFloat(act.peso_porcentual) || 7.69,
      porcentaje: pct,
      isRated: isRated,
      estado: statusObj ? statusObj.key : 'PENDIENTE',
      observacion: prev ? prev.observacion : ''
    };
  }

  // Renderizar las tarjetas de actividades
  renderActivitiesGrid();
  recalculateGlobalProgress();
  renderInspectionPhotos();

  // Mostrar el contenedor del formulario
  document.getElementById('insp-form-container').style.display = 'block';

  // Scroll suave al formulario
  document.getElementById('insp-form-container').scrollIntoView({ behavior: 'smooth' });
};

function renderActivitiesGrid() {
  const container = document.getElementById('insp-activities-grid');
  if (!container) return;

  const percentages = [0, 25, 50, 75, 100];

  container.innerHTML = activitiesList
    .map((act) => {
      const score = currentActivitiesScores[act.id] || { isRated: false, porcentaje: null, peso: 7.69, observacion: '' };
      const isRated = score.isRated && score.porcentaje !== null;
      const currentPct = isRated ? score.porcentaje : null;
      const statusObj = isRated ? window.dbManager.calculateActivityStatus(currentPct) : null;

      const badgeHtml = isRated
        ? `<span id="act-badge-${act.id}" class="badge ${statusObj.badgeClass}" style="font-size: 0.75rem;">
            ${statusObj.icon} ${statusObj.label} (${currentPct}%)
          </span>`
        : `<span id="act-badge-${act.id}" class="badge" style="background: #fef2f2; color: #dc2626; border: 1px dashed #f87171; font-size: 0.75rem;">
            ⚠️ Pendiente por calificar
          </span>`;

      return `
        <div class="activity-card" id="act-card-${act.id}">
          <div>
            <div class="activity-card-header">
              <div>
                <div class="activity-title">${act.orden}. ${escapeHtml(act.nombre)}</div>
                <div class="activity-weight-badge">Ponderación: ${Number(act.peso_porcentual).toFixed(3)}%</div>
              </div>
              ${badgeHtml}
            </div>

            <!-- Selector de Pastillas de Porcentaje -->
            <div class="pct-pill-group" id="pct-group-${act.id}">
              ${percentages
                .map((pct) => {
                  const isActive = isRated && currentPct === pct ? `active-${pct}` : '';
                  return `
                    <button type="button" class="pct-pill-btn ${isActive}" onclick="setActivityScore(${act.id}, ${pct})">
                      ${pct}%
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>

          <!-- Campo de Observación opcional de la actividad -->
          <div style="margin-top: 0.75rem;">
            <input type="text" class="form-input" placeholder="Nota de este ítem (opcional)..." value="${escapeHtml(score.observacion || '')}" oninput="setActivityObservation(${act.id}, this.value)" style="font-size: 0.78rem; padding: 0.35rem 0.5rem; height: 28px;">
          </div>
        </div>
      `;
    })
    .join('');
}

window.setActivityScore = function (actividadId, percentage) {
  if (!currentActivitiesScores[actividadId]) return;

  currentActivitiesScores[actividadId].porcentaje = percentage;
  currentActivitiesScores[actividadId].isRated = true;

  const statusObj = window.dbManager.calculateActivityStatus(percentage);
  currentActivitiesScores[actividadId].estado = statusObj.key;

  // Quitar borde de alerta si existía
  const cardEl = document.getElementById(`act-card-${actividadId}`);
  if (cardEl) {
    cardEl.style.border = '';
    cardEl.style.boxShadow = '';
  }

  // Actualizar Badge en la tarjeta
  const badgeEl = document.getElementById(`act-badge-${actividadId}`);
  if (badgeEl) {
    badgeEl.className = `badge ${statusObj.badgeClass}`;
    badgeEl.style.background = '';
    badgeEl.style.border = '';
    badgeEl.innerHTML = `${statusObj.icon} ${statusObj.label} (${percentage}%)`;
  }

  // Actualizar botones de pastillas
  const group = document.getElementById(`pct-group-${actividadId}`);
  if (group) {
    const percentages = [0, 25, 50, 75, 100];
    const buttons = group.querySelectorAll('.pct-pill-btn');
    buttons.forEach((btn, idx) => {
      const p = percentages[idx];
      btn.className = `pct-pill-btn ${p === percentage ? `active-${p}` : ''}`;
    });
  }

  // Recalcular el avance global de la obra
  recalculateGlobalProgress();
};

window.setAllActivitiesScore = function (percentage) {
  for (const act of activitiesList) {
    setActivityScore(act.id, percentage);
  }
  showToast(`Todas las 13 actividades calificadas en ${percentage}%.`, 'info');
};

window.setActivityObservation = function (actividadId, text) {
  if (currentActivitiesScores[actividadId]) {
    currentActivitiesScores[actividadId].observacion = text;
  }
};

function recalculateGlobalProgress() {
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const actId in currentActivitiesScores) {
    const item = currentActivitiesScores[actId];
    totalWeighted += (item.porcentaje * item.peso) / 100;
    totalWeight += item.peso;
  }

  // Normalizar sobre 100%
  let globalPercentage = totalWeighted;
  if (globalPercentage > 100) globalPercentage = 100;
  if (globalPercentage < 0) globalPercentage = 0;

  // Determinar Estado Global de la Batería (Gris = Sin Iniciar, Naranja = En Ejecución, Verde = Terminado)
  let globalStatusKey = 'SIN_INICIAR';
  let globalStatusLabel = '⚪ SIN INICIAR';
  let globalBadgeClass = 'badge-status-sin-iniciar';

  if (globalPercentage >= 99.9) {
    globalStatusKey = 'TERMINADO';
    globalStatusLabel = '🟢 TERMINADO';
    globalBadgeClass = 'badge-status-terminado';
  } else if (globalPercentage > 0) {
    globalStatusKey = 'EN_EJECUCION';
    globalStatusLabel = '🟠 EN EJECUCIÓN';
    globalBadgeClass = 'badge-status-ejecucion';
  }

  // Actualizar UI
  const fillEl = document.getElementById('insp-global-meter-fill');
  if (fillEl) fillEl.style.width = `${globalPercentage}%`;

  const pctLabelEl = document.getElementById('insp-global-pct-label');
  if (pctLabelEl) pctLabelEl.textContent = `${globalPercentage.toFixed(2)}%`;

  const statusBadgeEl = document.getElementById('insp-global-status-badge');
  if (statusBadgeEl) {
    statusBadgeEl.className = `badge ${globalBadgeClass}`;
    statusBadgeEl.textContent = globalStatusLabel;
  }

  return {
    percentage: globalPercentage,
    status: globalStatusKey
  };
}

/* ==========================================================================
   MANEJO DE FOTOS DE EVIDENCIA (100% OFFLINE / MÁXIMO 4 FOTOS / RESIZE)
   ========================================================================== */
const MAX_INSPECTION_PHOTOS = 4;

window.handleInspectionPhotoUpload = async function (event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  if (currentInspectionPhotos.length >= MAX_INSPECTION_PHOTOS) {
    showToast(`Solo se permite un máximo de ${MAX_INSPECTION_PHOTOS} fotos por visita.`, 'warning');
    event.target.value = '';
    return;
  }

  const availableSlots = MAX_INSPECTION_PHOTOS - currentInspectionPhotos.length;
  const countToProcess = Math.min(files.length, availableSlots);

  if (files.length > availableSlots) {
    showToast(`Solo se pueden agregar ${availableSlots} foto(s) más para no exceder el límite de 4.`, 'warning');
  }

  for (let i = 0; i < countToProcess; i++) {
    const file = files[i];
    try {
      const resizedBase64 = await resizeImageFile(file, 1200, 1200, 0.8);
      currentInspectionPhotos.push(resizedBase64);
    } catch (err) {
      console.error('Error al procesar foto:', err);
    }
  }

  event.target.value = '';
  renderInspectionPhotos();
};

function resizeImageFile(file, maxWidth, maxHeight, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.removeInspectionPhoto = function (index) {
  currentInspectionPhotos.splice(index, 1);
  renderInspectionPhotos();
};

function renderInspectionPhotos() {
  const container = document.getElementById('insp-photo-gallery');
  const emptyMsg = document.getElementById('insp-photo-empty-msg');
  const countBadge = document.getElementById('insp-photo-count-badge');
  const btnLabel = document.getElementById('insp-photo-btn-label');

  if (countBadge) {
    countBadge.textContent = `${currentInspectionPhotos.length} / ${MAX_INSPECTION_PHOTOS} fotos`;
    if (currentInspectionPhotos.length >= MAX_INSPECTION_PHOTOS) {
      countBadge.className = 'badge badge-status-active';
    } else {
      countBadge.className = 'badge';
      countBadge.style.background = 'var(--bg-subtle)';
    }
  }

  if (btnLabel) {
    if (currentInspectionPhotos.length >= MAX_INSPECTION_PHOTOS) {
      btnLabel.style.opacity = '0.6';
      btnLabel.style.pointerEvents = 'none';
      btnLabel.innerHTML = `✓ Límite de 4 fotos alcanzado`;
    } else {
      btnLabel.style.opacity = '1';
      btnLabel.style.pointerEvents = 'auto';
      btnLabel.innerHTML = `📷 Tomar / Adjuntar Fotos (${MAX_INSPECTION_PHOTOS - currentInspectionPhotos.length} restantes) <input type="file" id="insp-photo-input" accept="image/*" multiple capture="environment" style="display: none;" onchange="handleInspectionPhotoUpload(event)">`;
    }
  }

  if (!container) return;

  if (currentInspectionPhotos.length === 0) {
    container.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  container.innerHTML = currentInspectionPhotos
    .map((photoSrc, idx) => {
      return `
        <div class="photo-card-item">
          <img src="${photoSrc}" alt="Evidencia ${idx + 1}">
          <div style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.65); color: white; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: bold;">
            Foto ${idx + 1}/${MAX_INSPECTION_PHOTOS}
          </div>
          <button type="button" class="photo-delete-btn" onclick="removeInspectionPhoto(${idx})" title="Eliminar foto ${idx + 1}">
            ✕
          </button>
        </div>
      `;
    })
    .join('');
}

/* ==========================================================================
   CAPTURA DE GEOLOCALIZACIÓN GPS
   ========================================================================== */
window.captureGPSCoordinates = function () {
  const gpsInput = document.getElementById('insp-coordenadas-input');
  if (!navigator.geolocation) {
    showToast('Geolocalización no soportada por tu navegador.', 'warning');
    return;
  }

  showToast('Obteniendo ubicación GPS en tiempo real...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const acc = position.coords.accuracy ? ` (±${Math.round(position.coords.accuracy)}m)` : '';
      const gpsStr = `Lat: ${lat}, Lng: ${lng}${acc}`;
      if (gpsInput) gpsInput.value = gpsStr;
      showToast(`GPS capturado con éxito: ${gpsStr}`, 'success');
    },
    (error) => {
      showToast('No fue posible obtener la ubicación GPS: ' + error.message, 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

/* ==========================================================================
   GUARDAR INSPECCIÓN (SINCRONIZACIÓN HÍBRIDA MYSQL / INDEXEDDB)
   ========================================================================== */
window.saveInspectionForm = async function () {
  if (!selectedBeneficiario) {
    showToast('Por favor selecciona primero un beneficiario.', 'warning');
    return;
  }

  const currentUser = window.authService.getCurrentUser();
  if (!currentUser) {
    showToast('Sesión no válida. Por favor inicia sesión nuevamente.', 'danger');
    return;
  }

  // 1. Validación Obligatoria: Las 13 Actividades Constructivas deben estar calificadas
  const unrated = Object.values(currentActivitiesScores).filter((s) => !s.isRated || s.porcentaje === null);
  if (unrated.length > 0) {
    showToast(`⚠️ Es obligatorio calificar las 13 actividades constructivas. Faltan ${unrated.length} actividad(es) por calificar.`, 'warning');
    unrated.forEach((u) => {
      const card = document.getElementById(`act-card-${u.actividad_id}`);
      if (card) {
        card.style.border = '2px solid #ef4444';
        card.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.25)';
      }
    });
    const firstCard = document.getElementById(`act-card-${unrated[0].actividad_id}`);
    if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // 2. Validación Obligatoria: Exactamente 4 Fotos de Evidencia
  if (!currentInspectionPhotos || currentInspectionPhotos.length < 4) {
    const totalCurrent = currentInspectionPhotos ? currentInspectionPhotos.length : 0;
    const missing = 4 - totalCurrent;
    showToast(`⚠️ Es obligatorio adjuntar las 4 fotos de evidencia (${totalCurrent}/4). Faltan ${missing} foto(s).`, 'warning');
    const photoSection = document.getElementById('insp-photo-btn-label');
    if (photoSection) {
      photoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      photoSection.style.outline = '2px solid #ef4444';
      setTimeout(() => { photoSection.style.outline = 'none'; }, 3000);
    }
    return;
  }

  // 3. Validación Obligatoria: Observaciones Generales
  const obsInput = document.getElementById('insp-observaciones-input');
  const obsVal = obsInput ? obsInput.value.trim() : '';
  if (!obsVal) {
    showToast('⚠️ El campo de Observaciones Generales de la visita es obligatorio.', 'warning');
    if (obsInput) {
      obsInput.focus();
      obsInput.style.borderColor = 'var(--danger)';
      setTimeout(() => { obsInput.style.borderColor = 'var(--border-color)'; }, 3000);
    }
    return;
  }

  // 3. Coordenadas GPS y Estado del Clima
  const gpsVal = document.getElementById('insp-coordenadas-input')?.value.trim() || '';
  const climaVal = document.getElementById('insp-clima-select')?.value || 'Soleado';

  const { percentage: globalPct, status: globalStatus } = recalculateGlobalProgress();

  // Construir payload
  const inspectionPayload = {
    beneficiario_id: selectedBeneficiario.id,
    inspector_id: currentUser.id,
    avance_global: globalPct,
    estado_bateria: globalStatus,
    coordenadas_gps: gpsVal,
    estado_clima: climaVal,
    observaciones: obsVal,
    fotos: currentInspectionPhotos,
    detalles: Object.values(currentActivitiesScores).map((s) => ({
      actividad_id: s.actividad_id,
      porcentaje: s.porcentaje,
      estado_actividad: s.estado,
      peso_porcentual: s.peso,
      observacion_item: s.observacion
    }))
  };

  try {
    const result = await window.dbManager.saveInspeccion(inspectionPayload);
    showToast(result.mensaje, 'success');

    // Actualizar indicador de sincronización
    updateSyncUI();

    // Limpiar formulario y ofrecer continuar
    clearSelectedBeneficiaryForInspection();
  } catch (err) {
    showToast('Error al guardar la inspección: ' + err.message, 'danger');
  }
};

/* ==========================================================================
   HISTORIAL DE INSPECCIONES PREVIAS DE UN BENEFICIARIO
   ========================================================================== */
window.openBeneficiaryInspectionHistory = async function () {
  if (selectedBeneficiario) {
    return window.openBeneficiarioHistorialModal(selectedBeneficiario.id);
  }
};

window.openBeneficiarioHistorialModal = async function (beneficiarioId) {
  let ben = null;
  if (beneficiarioId) {
    if (typeof reportBeneficiariosData !== 'undefined') {
      ben = reportBeneficiariosData.find((b) => b.id == beneficiarioId);
    }
    if (!ben) {
      const all = await window.dbManager.getBeneficiarios();
      ben = all.find((b) => b.id == beneficiarioId);
    }
  } else if (selectedBeneficiario) {
    ben = selectedBeneficiario;
  }

  if (!ben) {
    showToast('No se encontró la información del beneficiario', 'warning');
    return;
  }

  document.getElementById('historial-modal-title').textContent = `🕒 Historial de Visitas: ${ben.nombre}`;
  document.getElementById('historial-modal-subtitle').textContent = `CC: ${ben.documento} • ${ben.municipio || ''} - ${ben.vereda || ''}`;

  const timelineContainer = document.getElementById('historial-visitas-timeline');
  timelineContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando historial de visitas...</div>`;

  document.getElementById('modal-beneficiario-historial').classList.add('active');

  try {
    const historial = await window.dbManager.getHistorialInspeccionesForBeneficiario(ben.id);

    if (!historial || historial.length === 0) {
      timelineContainer.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📋</div>
          <div style="font-weight: 600; color: var(--text-primary);">Sin visitas de inspección registradas</div>
          <p style="font-size: 0.85rem; margin-top: 4px;">Esta batería sanitaria se encuentra actualmente en estado <strong>Sin Iniciar (0%)</strong>.</p>
        </div>
      `;
      return;
    }

    timelineContainer.innerHTML = historial
      .map((item, idx) => {
        const fecha = new Date(item.fecha_visita).toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        const fotosArr = item.fotos ? (typeof item.fotos === 'string' ? JSON.parse(item.fotos) : item.fotos) : [];

        let badgeClass = 'badge-status-sin-iniciar';
        let statusLabel = '⚪ Sin Iniciar';
        if (item.estado_bateria === 'TERMINADO' || item.avance_global >= 99.9) {
          badgeClass = 'badge-status-terminado';
          statusLabel = '🟢 Terminado';
        } else if (item.avance_global > 0) {
          badgeClass = 'badge-status-ejecucion';
          statusLabel = '🟠 En Ejecución';
        }

        return `
          <div style="border-left: 3px solid var(--primary); padding-left: 1rem; margin-bottom: 1.25rem; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <strong style="font-size: 0.95rem; color: var(--text-primary);">Visita #${historial.length - idx}</strong>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${fecha} • Inspector: <strong>${escapeHtml(item.inspector_nombre || 'Inspector')}</strong></div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="badge ${badgeClass}">${statusLabel}</span>
                <span style="font-weight: 800; font-size: 1rem; color: var(--primary);">${Number(item.avance_global).toFixed(2)}%</span>
              </div>
            </div>

            ${item.observaciones ? `
              <div style="background: var(--bg-subtle); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.82rem; margin-top: 0.5rem; color: var(--text-secondary);">
                📝 <strong>Observaciones:</strong> ${escapeHtml(item.observaciones)}
              </div>
            ` : ''}

            ${item.coordenadas_gps ? `
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                📍 GPS Visita: <code>${escapeHtml(item.coordenadas_gps)}</code>
              </div>
            ` : ''}

            ${fotosArr && fotosArr.length > 0 ? `
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                ${fotosArr.map((f) => `<img src="${f}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);">`).join('')}
              </div>
            ` : ''}
          </div>
        `;
      })
      .join('');
  } catch (err) {
    timelineContainer.innerHTML = `<div style="color: var(--danger); padding: 1rem;">Error al cargar historial: ${err.message}</div>`;
  }
};

/* ==========================================================================
   MÓDULO ADMINISTRADOR: CONSULTA Y BITÁCORA GLOBAL DE INSPECCIONES
   ========================================================================== */
let inspeccionesAdminData = [];
let inspeccionesAdminFiltered = [];
let currentInspAdminPage = 1;
const INSPECCIONES_PER_PAGE = 15;

async function loadInspeccionesAdminPage() {
  const tbody = document.getElementById('admin-inspecciones-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando bitácora de inspecciones...</td></tr>`;
  }

  try {
    let list = [];
    if (navigator.onLine) {
      const res = await fetch('/api/inspecciones?limit=500');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) list = json.data;
      }
    }

    if (list.length === 0) {
      // Fallback a IndexedDB local
      list = await window.dbManager.getPendingInspecciones();
    }

    inspeccionesAdminData = list;
    inspeccionesAdminFiltered = [...list];

    // Cargar opciones en filtros
    populateInspeccionesFilters();

    // Actualizar tarjetas de métricas
    updateInspeccionesMetrics();

    // Renderizar tabla
    renderInspeccionesTable();
  } catch (err) {
    console.error('Error al cargar inspecciones:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger); padding: 1.5rem;">Error al cargar bitácora: ${err.message}</td></tr>`;
    }
  }
}

function updateInspeccionesMetrics() {
  const total = inspeccionesAdminData.length;
  const ejecucion = inspeccionesAdminData.filter((i) => i.estado_bateria === 'EN_EJECUCION' || (i.avance_global > 0 && i.avance_global < 99.9)).length;
  const terminadas = inspeccionesAdminData.filter((i) => i.estado_bateria === 'TERMINADO' || i.avance_global >= 99.9).length;
  const sininiciar = inspeccionesAdminData.filter((i) => i.estado_bateria === 'SIN_INICIAR' || i.avance_global == 0).length;

  const totalEl = document.getElementById('stat-insp-total');
  if (totalEl) totalEl.textContent = total;

  const ejecEl = document.getElementById('stat-insp-ejecucion');
  if (ejecEl) ejecEl.textContent = ejecucion;

  const termEl = document.getElementById('stat-insp-terminadas');
  if (termEl) termEl.textContent = terminadas;

  const sinEl = document.getElementById('stat-insp-sininiciar');
  if (sinEl) sinEl.textContent = sininiciar;
}

async function populateInspeccionesFilters() {
  if (!municipiosData || municipiosData.length === 0) {
    municipiosData = await window.dbManager.getMunicipios();
  }

  const munSelect = document.getElementById('filter-insp-municipio');
  if (munSelect) {
    const currentVal = munSelect.value;
    munSelect.innerHTML = `<option value="">🏛️ Todos los Municipios</option>` +
      municipiosData.map((m) => `<option value="${m.nombre}" ${currentVal === m.nombre ? 'selected' : ''}>${m.nombre}</option>`).join('');
  }

  let users = inspectorsData;
  if (!users || users.length === 0) {
    users = await window.dbManager.getUsers();
  }

  const inspSelect = document.getElementById('filter-insp-inspector');
  if (inspSelect) {
    const currentVal = inspSelect.value;
    inspSelect.innerHTML = `<option value="">👷 Todos los Inspectores</option>` +
      users.map((u) => `<option value="${u.nombre}" ${currentVal === u.nombre ? 'selected' : ''}>${u.nombre}</option>`).join('');
  }
}

window.onFilterInspeccionesChange = function () {
  const search = (document.getElementById('filter-insp-search')?.value || '').toLowerCase().trim();
  const mun = document.getElementById('filter-insp-municipio')?.value || '';
  const estado = document.getElementById('filter-insp-estado')?.value || '';
  const inspector = document.getElementById('filter-insp-inspector')?.value || '';

  inspeccionesAdminFiltered = inspeccionesAdminData.filter((item) => {
    const matchSearch = !search ||
      (item.beneficiario_nombre && item.beneficiario_nombre.toLowerCase().includes(search)) ||
      (item.beneficiario_documento && item.beneficiario_documento.includes(search)) ||
      (item.inspector_nombre && item.inspector_nombre.toLowerCase().includes(search));

    const matchMun = !mun || item.municipio === mun;
    const matchEstado = !estado || item.estado_bateria === estado;
    const matchInspector = !inspector || item.inspector_nombre === inspector;

    return matchSearch && matchMun && matchEstado && matchInspector;
  });

  currentInspAdminPage = 1;
  renderInspeccionesTable();
};

function renderInspeccionesTable() {
  const tbody = document.getElementById('admin-inspecciones-tbody');
  const paginationInfo = document.getElementById('pagination-insp-info');
  const paginationControls = document.getElementById('pagination-insp-controls');
  if (!tbody) return;

  if (inspeccionesAdminFiltered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No se encontraron visitas de inspección registradas con los filtros seleccionados.
        </td>
      </tr>
    `;
    if (paginationInfo) paginationInfo.textContent = 'Mostrando 0 registros';
    if (paginationControls) paginationControls.innerHTML = '';
    return;
  }

  const total = inspeccionesAdminFiltered.length;
  const totalPages = Math.ceil(total / INSPECCIONES_PER_PAGE);
  if (currentInspAdminPage > totalPages) currentInspAdminPage = totalPages;

  const start = (currentInspAdminPage - 1) * INSPECCIONES_PER_PAGE;
  const end = Math.min(start + INSPECCIONES_PER_PAGE, total);
  const pageItems = inspeccionesAdminFiltered.slice(start, end);

  tbody.innerHTML = pageItems
    .map((item) => {
      const fecha = new Date(item.fecha_visita).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short'
      });

      const pct = parseFloat(item.avance_global) || 0;
      let badgeClass = 'badge-status-sin-iniciar';
      let statusLabel = '⚪ Sin Iniciar';
      if (item.estado_bateria === 'TERMINADO' || pct >= 99.9) {
        badgeClass = 'badge-status-terminado';
        statusLabel = '🟢 Terminado';
      } else if (pct > 0) {
        badgeClass = 'badge-status-ejecucion';
        statusLabel = '🟠 En Ejecución';
      }

      let fotosArr = [];
      try {
        fotosArr = item.fotos ? (typeof item.fotos === 'string' ? JSON.parse(item.fotos) : item.fotos) : [];
      } catch (e) {}

      return `
        <tr>
          <td style="font-weight: bold; color: var(--text-muted);">#${item.id || '—'}</td>
          <td style="white-space: nowrap; font-size: 0.8rem;">${fecha}</td>
          <td>
            <strong style="color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(item.beneficiario_nombre)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">CC: <code>${escapeHtml(item.beneficiario_documento)}</code></div>
          </td>
          <td>
            <div style="font-size: 0.82rem; font-weight: 600;">${escapeHtml(item.municipio || '')}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.vereda || '')}</div>
          </td>
          <td>
            <div style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(item.inspector_nombre || 'Inspector')}</div>
          </td>
          <td style="width: 140px;">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; font-weight: bold; margin-bottom: 2px;">
              <span>${pct.toFixed(1)}%</span>
            </div>
            <div style="height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
              <div style="height: 100%; width: ${pct}%; background: ${pct >= 99.9 ? '#059669' : pct > 0 ? '#ea580c' : '#64748b'};"></div>
            </div>
          </td>
          <td>
            <span class="badge ${badgeClass}" style="font-size: 0.75rem;">${statusLabel}</span>
          </td>
          <td style="text-align: center; font-size: 0.78rem;">
            ${fotosArr && fotosArr.length > 0 ? `📷 <strong>${fotosArr.length}</strong> foto(s)` : `<span style="color: var(--text-muted);">—</span>`}
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="openInspectionDetailAdmin(${item.id})" style="font-size: 0.78rem; padding: 4px 8px;">
              👁️ Ver Detalle
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  if (paginationInfo) {
    paginationInfo.textContent = `Mostrando ${start + 1} - ${end} de ${total} visitas`;
  }

  renderInspeccionesPagination(totalPages);
}

function renderInspeccionesPagination(totalPages) {
  const container = document.getElementById('pagination-insp-controls');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="pagination-btn pagination-prev-btn" ${currentInspAdminPage === 1 ? 'disabled' : ''} onclick="changeInspeccionesPage(${currentInspAdminPage - 1})" title="Página anterior">
      ◀
    </button>
  `;

  const isMobile = window.innerWidth <= 640;
  const windowSize = isMobile ? 1 : 2;
  const startPage = Math.max(1, currentInspAdminPage - windowSize);
  const endPage = Math.min(totalPages, currentInspAdminPage + windowSize);

  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="changeInspeccionesPage(1)">1</button>`;
    if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `
      <button class="pagination-btn ${p === currentInspAdminPage ? 'active' : ''}" onclick="changeInspeccionesPage(${p})">
        ${p}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
    html += `<button class="pagination-btn" onclick="changeInspeccionesPage(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="pagination-btn pagination-next-btn" ${currentInspAdminPage === totalPages ? 'disabled' : ''} onclick="changeInspeccionesPage(${currentInspAdminPage + 1})" title="Página siguiente">
      ▶
    </button>
  `;

  container.innerHTML = html;
}

window.changeInspeccionesPage = function (newPage) {
  currentInspAdminPage = newPage;
  renderInspeccionesTable();
};

let activeInspectionDetailData = null;

window.openInspectionDetailAdmin = async function (inspeccionId) {
  try {
    const res = await fetch(`/api/inspecciones/${inspeccionId}`);
    if (!res.ok) throw new Error('No se pudo cargar el detalle de la inspección');
    const json = await res.json();
    if (!json.ok || !json.data) throw new Error('Datos inválidos');

    const insp = json.data;
    activeInspectionDetailData = insp;

    document.getElementById('admin-detail-title').textContent = `🔍 Visita de Inspección #${insp.id}`;
    document.getElementById('admin-detail-subtitle').textContent = `Registrada por ${insp.inspector_nombre || 'Inspector'}`;

    document.getElementById('admin-detail-ben-nombre').textContent = insp.beneficiario_nombre;
    document.getElementById('admin-detail-ben-doc').textContent = `Cédula: ${insp.beneficiario_documento}`;
    document.getElementById('admin-detail-ubicacion').textContent = `🏛️ ${insp.municipio} - 🌲 ${insp.vereda}`;
    document.getElementById('admin-detail-fase').textContent = `Fase del Proyecto: ${insp.fase || '1'}`;

    document.getElementById('admin-detail-inspector').textContent = `👷 ${insp.inspector_nombre}`;
    document.getElementById('admin-detail-fecha').textContent = new Date(insp.fecha_visita).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'medium' });

    const pct = parseFloat(insp.avance_global) || 0;
    document.getElementById('admin-detail-pct').textContent = `${pct.toFixed(2)}%`;

    let badgeClass = 'badge-status-sin-iniciar';
    let statusLabel = '⚪ Sin Iniciar';
    if (insp.estado_bateria === 'TERMINADO' || pct >= 99.9) {
      badgeClass = 'badge-status-terminado';
      statusLabel = '🟢 Terminado';
    } else if (pct > 0) {
      badgeClass = 'badge-status-ejecucion';
      statusLabel = '🟠 En Ejecución';
    }
    const badgeEl = document.getElementById('admin-detail-estado-badge');
    badgeEl.className = `badge ${badgeClass}`;
    badgeEl.textContent = statusLabel;

    document.getElementById('admin-detail-observaciones').textContent = insp.observaciones || '(Sin observaciones registradas)';
    document.getElementById('admin-detail-gps').textContent = `${insp.coordenadas_gps || '(Sin GPS)'} • Clima: ${insp.estado_clima || 'Soleado'}`;

    // Fotos de evidencia
    let fotosArr = [];
    try {
      fotosArr = insp.fotos ? (typeof insp.fotos === 'string' ? JSON.parse(insp.fotos) : insp.fotos) : [];
    } catch (e) {}

    const fotosContainer = document.getElementById('admin-detail-fotos-container');
    if (fotosArr && fotosArr.length > 0) {
      fotosContainer.innerHTML = fotosArr
        .map((f, idx) => `
          <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); width: 140px; height: 140px;">
            <img src="${f}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="window.open('${f}', '_blank')" title="Clic para ampliar">
            <span style="position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7); color: white; font-size: 0.65rem; padding: 1px 6px; border-radius: 3px; font-weight: bold;">Foto ${idx + 1}</span>
          </div>
        `)
        .join('');
    } else {
      fotosContainer.innerHTML = `<div style="font-size: 0.82rem; color: var(--text-muted); font-style: italic;">No se registraron fotografías de evidencia para esta visita.</div>`;
    }

    // Desglose de actividades constructivas
    const actGrid = document.getElementById('admin-detail-actividades-grid');
    if (Array.isArray(insp.detalles) && insp.detalles.length > 0) {
      actGrid.innerHTML = insp.detalles
        .map((d) => {
          const actPct = parseInt(d.porcentaje, 10) || 0;
          const statusObj = window.dbManager.calculateActivityStatus(actPct);
          return `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.25rem;">
                <strong style="font-size: 0.82rem; color: var(--text-primary);">${d.orden || ''}. ${escapeHtml(d.actividad_nombre || '')}</strong>
                <span class="badge ${statusObj.badgeClass}" style="font-size: 0.7rem; padding: 2px 6px;">${actPct}%</span>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Ponderación: ${Number(d.peso_porcentual).toFixed(2)}%</div>
              ${d.observacion_item ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; background: var(--bg-subtle); padding: 2px 5px; border-radius: 3px;">📝 ${escapeHtml(d.observacion_item)}</div>` : ''}
            </div>
          `;
        })
        .join('');
    } else {
      actGrid.innerHTML = `<div style="color: var(--text-muted); font-size: 0.82rem;">Sin desglose de actividades registrado.</div>`;
    }

    document.getElementById('modal-inspection-detail-admin').classList.add('active');
  } catch (err) {
    showToast('Error al cargar detalle: ' + err.message, 'danger');
  }
};

window.openFichaTecnicaFromDetail = function () {
  if (activeInspectionDetailData) {
    window.openFichaTecnica(activeInspectionDetailData);
  }
};

window.openFichaTecnica = async function (inspDataOrId) {
  let insp = null;
  if (typeof inspDataOrId === 'object' && inspDataOrId !== null) {
    insp = inspDataOrId;
  } else {
    try {
      const res = await fetch(`/api/inspecciones/${inspDataOrId}`);
      const json = await res.json();
      if (json.ok && json.data) insp = json.data;
    } catch (e) {}
  }

  if (!insp) {
    showToast('No se encontró la información para generar la Ficha Técnica', 'warning');
    return;
  }

  currentFichaData = insp;
  window.cambiarTipoFicha(currentFichaTipo || 'obra');
  document.getElementById('modal-ficha-tecnica').classList.add('active');
};

let currentFichaData = null;
let currentFichaTipo = 'obra'; // 'obra' | 'interventoria'

window.cambiarTipoFicha = function (tipo) {
  currentFichaTipo = tipo;
  const btnObra = document.getElementById('btn-tipo-obra');
  const btnInterv = document.getElementById('btn-tipo-interventoria');
  const container = document.getElementById('ficha-tecnica-printable');

  if (!currentFichaData || !container) return;

  const defaultActNames = [
    'Preliminares',
    'Cimentación',
    'Mampostería',
    'Estructura',
    'Cubierta',
    'Instalaciones Sanitarias',
    'Instalaciones Hidráulicas',
    'Instalaciones Eléctricas',
    'Acabados - Pañetes',
    'Acabados - Enchapes',
    'Carpintería Metálica',
    'Tanques Sépticos',
    'Campo de Infiltración'
  ];

  let detallesList = [];
  if (Array.isArray(currentFichaData.detalles) && currentFichaData.detalles.length > 0) {
    detallesList = currentFichaData.detalles;
  } else if (currentFichaData.actividadesScores) {
    detallesList = defaultActNames.map((name, idx) => ({
      orden: idx + 1,
      actividad_nombre: name,
      porcentaje: currentFichaData.actividadesScores[idx + 1] || 0
    }));
  } else {
    detallesList = defaultActNames.map((name, idx) => ({
      orden: idx + 1,
      actividad_nombre: name,
      porcentaje: currentFichaData.avance_global >= 99.9 ? 100 : 0
    }));
  }

  const fechaStr = currentFichaData.fecha_visita ? new Date(currentFichaData.fecha_visita).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }) : new Date().toLocaleDateString('es-CO');
  const faseStr = `Fase ${currentFichaData.fase || '1'}`;
  const climaStr = currentFichaData.estado_clima || 'Soleado';
  const codStr = `BPIN-2026-${String(currentFichaData.beneficiario_id || currentFichaData.id).padStart(4, '0')}`;
  const nomStr = currentFichaData.beneficiario_nombre || 'N/A';
  const docStr = currentFichaData.beneficiario_documento || 'N/A';
  const munStr = (currentFichaData.municipio || '').toUpperCase();
  const verStr = (currentFichaData.vereda || '').toUpperCase();
  const coordsStr = currentFichaData.coordenadas_gps || 'N/A';
  const obsStr = currentFichaData.observaciones && currentFichaData.observaciones.trim().length > 0 ? currentFichaData.observaciones : '<<OBSERVACIÓN>>';

  let fotosArr = [];
  try {
    fotosArr = currentFichaData.fotos ? (typeof currentFichaData.fotos === 'string' ? JSON.parse(currentFichaData.fotos) : currentFichaData.fotos) : [];
  } catch (e) {}

  const validFotos = Array.isArray(fotosArr) ? fotosArr.filter((f) => f && typeof f === 'string' && f.trim().length > 0) : [];
  const hasPhotos = validFotos.length > 0;

  const placeholderSvg = `<svg width="44" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#cbd5e1" fill="#f8fafc"/><circle cx="8.5" cy="8.5" r="1.8" fill="#cbd5e1"/><path d="M21 15l-5-5L5 21" stroke="#cbd5e1" fill="none"/><path d="M15 15l-2-2-4 4" stroke="#cbd5e1" fill="none"/></svg>`;
  const foto1Html = validFotos[0] ? `<img src="${validFotos[0]}" style="width: 100%; height: 100%; object-fit: contain;">` : placeholderSvg;
  const foto2Html = validFotos[1] ? `<img src="${validFotos[1]}" style="width: 100%; height: 100%; object-fit: contain;">` : placeholderSvg;

  const globalAvance = parseFloat(currentFichaData.avance_global) || 0;
  let genStatus = 'Sin Iniciar';
  if (globalAvance >= 99.9 || currentFichaData.estado_bateria === 'TERMINADO') genStatus = 'Terminado (100%)';
  else if (globalAvance > 0 || currentFichaData.estado_bateria === 'EN_EJECUCION') genStatus = 'En Ejecución';

  const mHeader = document.querySelector('#modal-ficha-tecnica .modal-header');

  if (tipo === 'obra') {
    if (mHeader) mHeader.style.background = '#253116';
    if (btnObra) {
      btnObra.style.background = '#ffffff';
      btnObra.style.color = '#3a4b24';
      btnObra.style.fontWeight = '800';
    }
    if (btnInterv) {
      btnInterv.style.background = 'transparent';
      btnInterv.style.color = '#ffffff';
    }

    // Filas para Obra (con badges verde oscuro / ámbar / rojo)
    const rowsHtml = defaultActNames.map((name, idx) => {
      const ord = idx + 1;
      const det = detallesList.find((d) => (d.orden == ord) || (d.actividad_id == ord)) || detallesList[idx];
      const p = det ? parseInt(det.porcentaje, 10) || 0 : 0;
      
      let estadoBadge = `
        <span style="display: inline-flex; align-items: center; gap: 4px; color: #374151; font-weight: 600; font-size: 8px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="9.5" fill="#ffffff"/><line x1="7" y1="12" x2="17" y2="12" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg>
          No iniciado
        </span>
      `;
      if (p >= 100) {
        estadoBadge = `
          <span style="display: inline-flex; align-items: center; gap: 4px; color: #1e293b; font-weight: 700; font-size: 8px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#386620"><circle cx="12" cy="12" r="10" /><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#ffffff"/></svg>
            Terminado
          </span>
        `;
      } else if (p > 0) {
        estadoBadge = `
          <span style="display: inline-flex; align-items: center; gap: 4px; color: #1e293b; font-weight: 700; font-size: 8px;">
            <svg width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.2"/><circle cx="12" cy="12" r="5.5" fill="#f59e0b"/><circle cx="12" cy="12" r="2.5" fill="#ffffff"/></svg>
            En Proceso
          </span>
        `;
      }

      const bgRow = idx % 2 === 0 ? '#ffffff' : '#fcfdfa';
      return `
        <tr style="background: ${bgRow}; border-bottom: 1px solid #e5ebd9;">
          <td style="border-right: 1px solid #e5ebd9; border-left: 1px solid #829470; padding: 2px 4px; text-align: center; font-weight: 800; color: #1e293b;">${ord}</td>
          <td style="border-right: 1px solid #e5ebd9; padding: 2px 6px; color: #1e293b; font-weight: 600;">${name}</td>
          <td style="border-right: 1px solid #e5ebd9; padding: 2px 6px; text-align: center; font-weight: 700; color: #000000;">${p}%</td>
          <td style="border-right: 1px solid #829470; padding: 2px 6px; text-align: left;">${estadoBadge}</td>
        </tr>
      `;
    }).join('');

    const fotosSectionObra = hasPhotos ? `
      <!-- 6. REGISTRO FOTOGRÁFICO -->
      <div style="margin-bottom: 8px;">
        <div style="display: inline-flex; align-items: center; gap: 5px; background: #3a4b24; color: #ffffff; font-size: 8.5px; font-weight: 900; padding: 2.5px 12px 2.5px 8px; border-radius: 10px 10px 0 0; margin-left: 6px; letter-spacing: 0.3px;">
          <div style="width: 14px; height: 14px; background: #232f14; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>
          </div>
          <span>REGISTRO FOTOGRÁFICO</span>
        </div>
        <div style="border: 1.2px solid #829470; border-radius: 8px; padding: 8px 10px; margin-top: -1px; background: #ffffff;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 14px; height: 14px; background: #3a4b24; color: #ffffff; border-radius: 3px; font-size: 8px; font-weight: 900; display: flex; align-items: center; justify-content: center;">1</div>
                <div style="font-size: 8px; font-weight: 800; color: #1e293b; text-transform: uppercase;">VISTA GENERAL</div>
              </div>
              <div style="border: 1.2px dashed #9fb08e; border-radius: 6px; height: 95px; display: flex; align-items: center; justify-content: center; background: #fdfdfd; overflow: hidden;">
                ${foto1Html}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 14px; height: 14px; background: #3a4b24; color: #ffffff; border-radius: 3px; font-size: 8px; font-weight: 900; display: flex; align-items: center; justify-content: center;">2</div>
                <div style="font-size: 8px; font-weight: 800; color: #1e293b; text-transform: uppercase;">EXCAVACIÓN</div>
              </div>
              <div style="border: 1.2px dashed #9fb08e; border-radius: 6px; height: 95px; display: flex; align-items: center; justify-content: center; background: #fdfdfd; overflow: hidden;">
                ${foto2Html}
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : '';

    container.style.borderColor = '#4a5c32';
    container.style.padding = '10px 12px';
    container.innerHTML = `
      <div>
        <!-- 1. ENCABEZADO INSTITUCIONAL OBRA -->
        <div style="position: relative; overflow: hidden; margin-bottom: 6px; padding-bottom: 2px;">
          <div style="position: absolute; right: -5px; top: -5px; width: 120px; height: 50px; pointer-events: none; z-index: 1;">
            <svg width="120" height="50" viewBox="0 0 120 50" fill="none" style="display: block;">
              <polygon points="50,0 72,0 48,50 26,50" fill="#d2cca6" opacity="0.8" />
              <polygon points="75,0 95,0 71,50 51,50" fill="#5c7040" />
              <polygon points="98,0 120,0 96,50 74,50" fill="#33431f" />
            </svg>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: center; position: relative; z-index: 2;">
            <tr>
              <td style="width: 20%; vertical-align: middle; text-align: center; padding: 0 4px;">
                <img src="img/ENCABEZADO_OBRA.png" alt="UT Baterías Catatumbo" style="max-height: 56px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;">
              </td>
              <td style="width: 80%; vertical-align: middle; text-align: center; padding: 2px 25px 2px 5px;">
                <div style="font-size: 11.5px; font-weight: 900; color: #111827; letter-spacing: 0.6px; margin-bottom: 2px;">PROYECTO</div>
                <div style="font-size: 6.8px; font-weight: 700; color: #1e293b; line-height: 1.25; max-width: 480px; margin: 0 auto; text-transform: uppercase;">CONSTRUCCIÓN DE UNIDADES SANITARIAS EN MUNICIPIOS DE LA REGIÓN DEL CATATUMBO Y EN MUNICIPIOS DEL DEPARTAMENTO NORTE DE SANTANDER, EN EL MARCO DE LOS PROYECTOS DE INVERSIÓN IDENTIFICADOS CON BPIN 20230000000116 Y BPIN 202600000008720</div>
                <div style="font-size: 9.5px; font-weight: 900; color: #111827; margin-top: 4px; letter-spacing: 0.4px;">CONTRATO DE OBRA No. LP-SAPSB-03731-2026</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- 2. TÍTULO Y BANNER VERDE OSCURO CON CHEVRONS -->
        <div style="background: #3a4b24; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 6px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; background: #232f14; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>
            </div>
            <span style="color: #ffffff; font-size: 11.5px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase;">FICHA TÉCNICA AVANCE DE OBRA</span>
          </div>
          <div style="display: flex; gap: 3px; align-items: center;">
            <div style="width: 12px; height: 16px; transform: skewX(-25deg); background: #4d6032;"></div>
            <div style="width: 12px; height: 16px; transform: skewX(-25deg); background: #6a8247;"></div>
            <div style="width: 12px; height: 16px; transform: skewX(-25deg); background: #92ab6d;"></div>
          </div>
        </div>

        <!-- 3. BARRA DE METADATOS: FECHA / FASE / CLIMA -->
        <div style="border: 1.2px solid #829470; border-radius: 8px; padding: 4px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; font-weight: 800; color: #1e293b; margin-bottom: 8px; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3a4b24" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>FECHA:</span>
            <span style="font-weight: 700; color: #1e293b;">${fechaStr}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3a4b24" stroke-width="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>FASE:</span>
            <span style="font-weight: 700; color: #1e293b;">${faseStr}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a4b24" stroke-width="2.2"><path d="M12 2v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M20 12h2"></path><path d="M19.07 4.93l-1.41 1.41"></path><path d="M15.5 17a4.5 4.5 0 1 0-8.9 0h8.9z"></path></svg>
            <span>E. CLIMA:</span>
            <span style="font-weight: 700; color: #1e293b;">${climaStr}</span>
          </div>
        </div>

        <!-- 4. INFORMACIÓN DEL BENEFICIARIO -->
        <div style="margin-bottom: 8px;">
          <div style="display: inline-flex; align-items: center; gap: 5px; background: #3a4b24; color: #ffffff; font-size: 8.5px; font-weight: 900; padding: 2.5px 12px 2.5px 8px; border-radius: 10px 10px 0 0; margin-left: 6px; letter-spacing: 0.3px;">
            <div style="width: 14px; height: 14px; background: #232f14; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <span>INFORMACIÓN DEL BENEFICIARIO</span>
          </div>
          <div style="border: 1.2px solid #829470; border-radius: 8px; padding: 6px 10px; margin-top: -1px; background: #ffffff;">
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
              <tr style="border-bottom: 1px solid #edf2e9;">
                <td style="padding: 2.5px 4px; width: 14%; font-weight: 800; color: #1e293b;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#3a4b24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 6.33 7 5.5 7z"/></svg>
                    Código:
                  </span>
                </td>
                <td style="padding: 2.5px 4px; width: 36%; font-weight: 600; color: #000000;">${codStr}</td>
                <td style="padding: 2.5px 4px; width: 14%; font-weight: 800; color: #1e293b;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#3a4b24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    Municipio:
                  </span>
                </td>
                <td style="padding: 2.5px 4px; width: 36%; font-weight: 600; color: #000000;">${munStr}</td>
              </tr>
              <tr style="border-bottom: 1px solid #edf2e9;">
                <td style="padding: 2.5px 4px; font-weight: 800; color: #1e293b;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#3a4b24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    Nombre:
                  </span>
                </td>
                <td style="padding: 2.5px 4px; font-weight: 700; color: #000000;">${nomStr}</td>
                <td style="padding: 2.5px 4px; font-weight: 800; color: #1e293b;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#3a4b24"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2L7 10l-6 8h22L14 6z"/></svg>
                    Vereda:
                  </span>
                </td>
                <td style="padding: 2.5px 4px; font-weight: 600; color: #000000;">${verStr}</td>
              </tr>
              <tr>
                <td style="padding: 2.5px 4px; font-weight: 800; color: #1e293b;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#3a4b24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    Documento:
                  </span>
                </td>
                <td style="padding: 2.5px 4px; font-weight: 600; color: #000000;">${docStr}</td>
                <td style="padding: 2.5px 4px; font-weight: 800; color: #1e293b;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3a4b24" stroke-width="2.2"><circle cx="12" cy="12" r="7"></circle><line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line><line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line></svg>
                    Coordenadas:
                  </span>
                </td>
                <td style="padding: 2.5px 4px; font-weight: 600; color: #000000;">${coordsStr}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 5. AVANCE DE EJECUCIÓN DE ACTIVIDADES (13 ACTIVIDADES) -->
        <div style="margin-bottom: 8px;">
          <div style="font-size: 9.5px; font-weight: 900; color: #1e293b; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; letter-spacing: 0.3px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#3a4b24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
            <span>AVANCE DE EJECUCIÓN DE ACTIVIDADES</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8px; border-radius: 6px; overflow: hidden; border: 1px solid #829470;">
            <thead>
              <tr style="background: #3a4b24; color: #ffffff; font-weight: 800; text-align: center; text-transform: uppercase;">
                <th style="padding: 3.5px 4px; width: 8%; border-right: 1px solid #4a5c32;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    ÍTEM
                  </div>
                </th>
                <th style="padding: 3.5px 6px; width: 44%; text-align: left; border-right: 1px solid #4a5c32;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>
                    ACTIVIDAD
                  </div>
                </th>
                <th style="padding: 3.5px 6px; width: 23%; border-right: 1px solid #4a5c32;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><circle cx="12" cy="12" r="10" fill="none" stroke="#ffffff" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="#ffffff" stroke-width="2" fill="none"/></svg>
                    AVANCE (%)
                  </div>
                </th>
                <th style="padding: 3.5px 6px; width: 25%;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
                    ESTADO
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f3f6f0; font-weight: 800; border-top: 1.5px solid #829470; font-size: 8px;">
                <td colspan="2" style="padding: 3px 6px; text-align: right; color: #1e293b;">AVANCE TOTAL PONDERADO:</td>
                <td style="padding: 3px 6px; text-align: center; color: #3a4b24; font-weight: 900; font-size: 8.5px;">${globalAvance.toFixed(2)}%</td>
                <td style="padding: 3px 6px; text-align: center; font-weight: 700; color: #1e293b;">${genStatus}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        ${fotosSectionObra}

        <!-- 7. OBSERVACIONES -->
        <div style="margin-bottom: 4px;">
          <div style="display: inline-flex; align-items: center; gap: 5px; background: #3a4b24; color: #ffffff; font-size: 8.5px; font-weight: 900; padding: 2.5px 12px 2.5px 8px; border-radius: 10px 10px 0 0; margin-left: 6px; letter-spacing: 0.3px;">
            <div style="width: 14px; height: 14px; background: #232f14; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#ffffff"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </div>
            <span>OBSERVACIONES</span>
          </div>
          <div style="border: 1.2px solid #829470; border-radius: 8px; padding: 6px 10px 4px 10px; margin-top: -1px; background: #ffffff;">
            <div style="font-size: 8px; font-weight: 600; color: #1e293b; min-height: 14px; margin-bottom: 3px; white-space: pre-wrap;">${obsStr}</div>
            <div style="border-bottom: 1px dotted #9fb08e; margin-bottom: 5px; height: 1px;"></div>
            <div style="border-bottom: 1px dotted #9fb08e; margin-bottom: 5px; height: 1px;"></div>
            <div style="border-bottom: 1px dotted #9fb08e; height: 1px;"></div>
          </div>
        </div>
      </div>

      <!-- PIE DE PÁGINA INSTITUCIONAL OBRA -->
      <div style="margin-top: 4px; padding-top: 2px;">
        <div style="text-align: center; font-size: 7.5px; color: #3a4b24; font-weight: 700; line-height: 1.25;">
          <div>Dirección: Cll 20 AN#16E -73 VILLA CATALINA - NIZA | Correo: utbateriascatatumbo@gmail.com</div>
        </div>
      </div>
    `;

  } else {
    // ==========================================
    // FORMATO FICHA DE INTERVENTORÍA (DISEÑO AZUL 2 COLUMNAS)
    // ==========================================
    if (mHeader) mHeader.style.background = '#0b2447';
    if (btnObra) {
      btnObra.style.background = 'transparent';
      btnObra.style.color = '#ffffff';
    }
    if (btnInterv) {
      btnInterv.style.background = '#ffffff';
      btnInterv.style.color = '#0f3b7a';
      btnInterv.style.fontWeight = '800';
    }

    const rowsIntervHtml = defaultActNames.map((name, idx) => {
      const ord = idx + 1;
      const det = detallesList.find((d) => (d.orden == ord) || (d.actividad_id == ord)) || detallesList[idx];
      const p = det ? parseInt(det.porcentaje, 10) || 0 : 0;
      
      let estadoTexto = 'No iniciado';
      if (p >= 100) estadoTexto = 'Terminado';
      else if (p > 0) estadoTexto = 'En Proceso';

      const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
        <tr style="background: ${bgRow}; border-bottom: 1px solid #e2e8f0; font-size: 7.6px;">
          <td style="border-right: 1px solid #cbd5e1; border-left: 1px solid #0f3b7a; padding: 1.8px 3px; text-align: center; font-weight: 700; color: #0f3b7a;">${ord}</td>
          <td style="border-right: 1px solid #cbd5e1; padding: 1.8px 5px; color: #1e293b; font-weight: 600;">${name}</td>
          <td style="border-right: 1px solid #cbd5e1; padding: 1.8px 4px; text-align: center; font-weight: 700; color: #000000;">${p}%</td>
          <td style="border-right: 1px solid #0f3b7a; padding: 1.8px 4px; text-align: center; font-weight: 600; color: #1e293b;">${estadoTexto}</td>
        </tr>
      `;
    }).join('');

    const fotosSectionInterv = hasPhotos ? `
      <!-- 5. REGISTRO FOTOGRÁFICO INTERVENTORÍA -->
      <div style="margin-bottom: 4px; position: relative;">
        <!-- Dotted Matrix Top Right of Photo Section -->
        <div style="position: absolute; right: -4px; top: -14px; display: grid; grid-template-columns: repeat(4, 3.5px); gap: 3.5px; z-index: 3;">
          <div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div>
          <div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div>
          <div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div>
        </div>

        <div style="display: inline-flex; align-items: center; background: #0f3b7a; color: #ffffff; font-size: 7.5px; font-weight: 900; padding: 2px 10px; border-radius: 6px 6px 0 0; margin-left: 2px; letter-spacing: 0.3px;">
          REGISTRO FOTOGRÁFICO
        </div>
        <div style="border: 1.2px solid #0f3b7a; border-radius: 6px; padding: 6px 8px; margin-top: -1px; background: #ffffff;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <!-- Foto 1 -->
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <div style="display: inline-flex; align-items: center; gap: 4px;">
                <div style="width: 14px; height: 14px; background: #0f3b7a; color: #ffffff; border-radius: 50%; font-size: 7.5px; font-weight: 900; display: flex; align-items: center; justify-content: center;">1</div>
                <div style="border: 1px solid #0f3b7a; border-radius: 4px; padding: 1px 6px; font-size: 7.2px; font-weight: 800; color: #0f3b7a; text-transform: capitalize;">Vista General</div>
              </div>
              <div style="border: 1.2px solid #0f3b7a; border-radius: 6px; height: 95px; display: flex; align-items: center; justify-content: center; background: #f8fafc; overflow: hidden;">
                ${foto1Html}
              </div>
            </div>
            <!-- Foto 2 -->
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <div style="display: inline-flex; align-items: center; gap: 4px;">
                <div style="width: 14px; height: 14px; background: #0f3b7a; color: #ffffff; border-radius: 50%; font-size: 7.5px; font-weight: 900; display: flex; align-items: center; justify-content: center;">2</div>
                <div style="border: 1px solid #0f3b7a; border-radius: 4px; padding: 1px 6px; font-size: 7.2px; font-weight: 800; color: #0f3b7a; text-transform: capitalize;">Excavación</div>
              </div>
              <div style="border: 1.2px solid #0f3b7a; border-radius: 6px; height: 95px; display: flex; align-items: center; justify-content: center; background: #f8fafc; overflow: hidden;">
                ${foto2Html}
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : '';

    container.style.borderColor = '#0f3b7a';
    container.style.padding = '12px 14px';
    container.innerHTML = `
      <div style="position: relative;">
        <!-- Top Right Blue Polygon Accent -->
        <div style="position: absolute; right: -14px; top: -12px; width: 75px; height: 50px; pointer-events: none; overflow: hidden; border-top-right-radius: 10px; z-index: 1;">
          <svg width="75" height="50" viewBox="0 0 75 50" fill="none">
            <polygon points="32,0 75,0 75,50" fill="#0f3b7a"/>
            <polygon points="10,0 32,0 75,50 53,50" fill="#1e5bb0" opacity="0.65"/>
          </svg>
        </div>

        <!-- 1. ENCABEZADO INSTITUCIONAL INTERVENTORÍA -->
        <div style="margin-top: 4px; margin-bottom: 5px; position: relative; z-index: 2;">
          <table style="width: 100%; border-collapse: collapse; text-align: center;">
            <tr>
              <td style="width: 32%; vertical-align: middle; text-align: left; padding: 2px 6px 2px 4px;">
                <img src="img/ENCABEZADO_INTERVENTORIA.png" alt="Interventoría" style="max-height: 46px; max-width: 100%; object-fit: contain; display: block; margin: 0;" onerror="this.onerror=null; this.src='img/ENCABEZADO_INTERVENTOR.png';">
              </td>
              <td style="width: 68%; vertical-align: middle; text-align: center; padding: 2px 25px 2px 4px;">
                <div style="font-size: 11px; font-weight: 900; color: #111827; letter-spacing: 0.5px; margin-bottom: 2px;">PROYECTO</div>
                <div style="font-size: 6.5px; font-weight: 700; color: #1e293b; line-height: 1.2; text-transform: uppercase;">CONSTRUCCIÓN DE UNIDADES SANITARIAS EN MUNICIPIOS DE LA REGIÓN DEL CATATUMBO Y EN MUNICIPIOS DEL DEPARTAMENTO NORTE DE SANTANDER, EN EL MARCO DE LOS PROYECTOS DE INVERSIÓN IDENTIFICADOS CON BPIN 20230000000016 Y BPIN 202600000008720</div>
                <div style="font-size: 8.8px; font-weight: 900; color: #111827; margin-top: 3px; letter-spacing: 0.3px;">CONTRATO DE OBRA No. LP-SAPSB-03731-2026</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Separador de línea con puntos en los extremos -->
        <div style="display: flex; align-items: center; margin: 4px 0 6px 0;">
          <div style="width: 4.5px; height: 4.5px; border-radius: 50%; background: #0f3b7a;"></div>
          <div style="flex: 1; height: 1.2px; background: #0f3b7a;"></div>
          <div style="width: 4.5px; height: 4.5px; border-radius: 50%; background: #0f3b7a;"></div>
        </div>

        <!-- 2. TÍTULO CENTRADO CON LÍNEAS LATERALES -->
        <div style="text-align: center; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div style="width: 28px; height: 1.2px; background: #0f3b7a;"></div>
          <span style="font-size: 11px; font-weight: 900; color: #0f3b7a; letter-spacing: 0.6px; text-transform: uppercase;">FICHA TÉCNICA – AVANCE DE OBRA</span>
          <div style="width: 28px; height: 1.2px; background: #0f3b7a;"></div>
        </div>

        <!-- 3. SECCIÓN MEDIA: 2 COLUMNAS (IZQUIERDA: DATOS + BENEFICIARIO | DERECHA: ACTIVIDADES) -->
        <div style="display: grid; grid-template-columns: 31% 67%; gap: 2%; margin-bottom: 6px;">
          <!-- COLUMNA IZQUIERDA -->
          <div style="display: flex; flex-direction: column;">
            <!-- DATOS GENERALES -->
            <div style="margin-bottom: 6px;">
              <div style="display: inline-flex; align-items: center; background: #0f3b7a; color: #ffffff; font-size: 7.5px; font-weight: 900; padding: 2px 10px; border-radius: 6px 6px 0 0; margin-left: 2px; letter-spacing: 0.3px;">
                DATOS GENERALES
              </div>
              <div style="border: 1.2px solid #0f3b7a; border-radius: 6px; padding: 5px 6px; margin-top: -1px; background: #ffffff; display: flex; flex-direction: column; gap: 4px; font-size: 7.8px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f3b7a" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">FECHA:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">${fechaStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f3b7a" stroke-width="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">FASE:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">${faseStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f3b7a" stroke-width="2.2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">E. CLIMA:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">&lt;${climaStr.toUpperCase()}&gt;</span>
                </div>
              </div>
            </div>

            <!-- INFORMACIÓN DEL BENEFICIARIO -->
            <div>
              <div style="display: inline-flex; align-items: center; background: #0f3b7a; color: #ffffff; font-size: 7.5px; font-weight: 900; padding: 2px 10px; border-radius: 6px 6px 0 0; margin-left: 2px; letter-spacing: 0.3px;">
                INFORMACIÓN DEL BENEFICIARIO
              </div>
              <div style="border: 1.2px solid #0f3b7a; border-radius: 6px; padding: 5px 6px; margin-top: -1px; background: #ffffff; display: flex; flex-direction: column; gap: 4px; font-size: 7.6px;">
                <div style="display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#0f3b7a"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">Código:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">${codStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#0f3b7a"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">Nombre:</span>
                  <span style="font-weight: 700; color: #000000; margin-left: auto; text-align: right; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nomStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#0f3b7a"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">Documento:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">${docStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#0f3b7a"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">Municipio:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">${munStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#0f3b7a"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2L7 10l-6 8h22L14 6z"/></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">Vereda:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto;">${verStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f3b7a" stroke-width="2.2"><circle cx="12" cy="12" r="7"></circle><line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line><line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line></svg>
                  <span style="font-weight: 800; color: #0f3b7a;">Coordenadas:</span>
                  <span style="font-weight: 600; color: #1e293b; margin-left: auto; font-size: 7px;">${coordsStr}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- COLUMNA DERECHA: TABLA AVANCE DE ACTIVIDADES -->
          <div>
            <div style="font-size: 8.8px; font-weight: 900; color: #0f3b7a; margin-bottom: 3px; letter-spacing: 0.3px;">
              AVANCE DE EJECUCIÓN DE ACTIVIDADES
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 7.5px; border-radius: 6px; overflow: hidden; border: 1px solid #0f3b7a;">
              <thead>
                <tr style="background: #0f3b7a; color: #ffffff; font-weight: 800; text-align: center; text-transform: uppercase;">
                  <th style="padding: 2.5px 3px; width: 8%; border-right: 1px solid #1e5bb0;">ÍTEM</th>
                  <th style="padding: 2.5px 5px; width: 44%; text-align: left; border-right: 1px solid #1e5bb0;">ACTIVIDAD</th>
                  <th style="padding: 2.5px 4px; width: 24%; border-right: 1px solid #1e5bb0;">AVANCE (%)</th>
                  <th style="padding: 2.5px 4px; width: 24%;">ESTADO</th>
                </tr>
              </thead>
              <tbody>
                ${rowsIntervHtml}
              </tbody>
            </table>
          </div>
        </div>

        ${fotosSectionInterv}

        <!-- 4. OBSERVACIONES (CON LÍNEAS SÓLIDAS TIPO FORMATO) -->
        <div style="margin-bottom: 6px;">
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #0f3b7a; color: #ffffff; font-size: 7.5px; font-weight: 900; padding: 2px 10px; border-radius: 6px 6px 0 0; margin-left: 2px; letter-spacing: 0.3px;">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#ffffff"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            <span>OBSERVACIONES</span>
          </div>
          <div style="border: 1.2px solid #0f3b7a; border-radius: 6px; padding: 5px 8px 4px 8px; margin-top: -1px; background: #ffffff;">
            <div style="font-size: 7.6px; font-weight: 600; color: #1e293b; min-height: 12px; margin-bottom: 2px; white-space: pre-wrap;">${obsStr}</div>
            <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; height: 1px;"></div>
            <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; height: 1px;"></div>
            <div style="border-bottom: 1px solid #cbd5e1; height: 1px;"></div>
          </div>
        </div>

        <!-- 6. DECORACIONES INFERIORES: MATRIZ DE PUNTOS Y LÍNEA AZUL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; padding: 0 4px;">
          <div style="display: grid; grid-template-columns: repeat(5, 3.5px); gap: 3.5px;">
            <div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div>
            <div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div>
            <div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div><div style="width: 3.5px; height: 3.5px; border-radius: 50%; background: #0f3b7a;"></div>
          </div>
          <div style="width: 140px; height: 2px; background: #0f3b7a; border-radius: 1px;"></div>
        </div>
      </div>
    `;
  }
};

window.printFichaTecnica = function () {
  try {
    const cleanText = (txt) =>
      (txt || '')
        .toString()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quitar tildes para nombres de archivo compatibles
        .replace(/[\/\\:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .toUpperCase();

    let docTitle = 'FICHA_TECNICA';
    if (currentFichaData) {
      const nombre = cleanText(currentFichaData.beneficiario_nombre || 'BENEFICIARIO');
      const cedula = cleanText(currentFichaData.beneficiario_documento || 'CC');
      const mun = cleanText(currentFichaData.municipio || 'MUNICIPIO');
      const vereda = cleanText(currentFichaData.vereda || 'VEREDA');

      let fecha = '';
      if (currentFichaData.fecha_visita) {
        const d = new Date(currentFichaData.fecha_visita);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const anio = d.getFullYear();
        fecha = `${dia}-${mes}-${anio}`;
      } else {
        const d = new Date();
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const anio = d.getFullYear();
        fecha = `${dia}-${mes}-${anio}`;
      }

      const prefix = currentFichaTipo === 'interventoria' ? 'FICHA_INTERVENTORIA' : 'FICHA_OBRA';
      docTitle = `${prefix}_${nombre}_${cedula}_${mun}_${vereda}_${fecha}`;
    }

    const fichaElement = document.getElementById('ficha-tecnica-printable');
    if (!fichaElement) {
      window.print();
      return;
    }

    // Crear iframe aislado para imprimir solo el documento puro sin modales ni fondos
    let printFrame = document.getElementById('print-ficha-iframe');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'print-ficha-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.style.zIndex = '-9999';
      document.body.appendChild(printFrame);
    }

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${docTitle}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 5mm 6mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            text-shadow: none !important;
            box-shadow: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            width: 100% !important;
            height: 100% !important;
          }
          .ficha-tecnica-sheet {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 255mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        </style>
      </head>
      <body>
        ${fichaElement.outerHTML}
      </body>
      </html>
    `);
    doc.close();

    // Asignar título en la ventana principal y en el iframe para que el navegador sugiera el nombre de archivo exacto
    const originalTitle = document.title;
    document.title = docTitle;

    // Esperar a que se renderice el iframe e imprimir
    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 2000);
    }, 350);
  } catch (e) {
    console.error('Error al imprimir Ficha Técnica:', e);
    window.print();
  }
};

window.openFichaTecnicaForBeneficiario = async function (beneficiarioId) {
  try {
    let ben = null;
    if (typeof beneficiariosData !== 'undefined' && beneficiariosData.length > 0) {
      ben = beneficiariosData.find((b) => b.id == beneficiarioId);
    }
    if (!ben && typeof reportBeneficiariosData !== 'undefined' && reportBeneficiariosData.length > 0) {
      ben = reportBeneficiariosData.find((b) => b.id == beneficiarioId);
    }
    if (!ben) {
      const all = await window.dbManager.getBeneficiarios();
      ben = all.find((b) => b.id == beneficiarioId);
    }

    if (!ben) {
      showToast('No se encontró la información del beneficiario.', 'warning');
      return;
    }

    // Consultar historial de visitas para este beneficiario
    const historial = await window.dbManager.getHistorialInspeccionesForBeneficiario(ben.id);

    if (historial && historial.length > 0) {
      const latestInsp = historial[0];
      if (latestInsp.id) {
        try {
          const res = await fetch(`/api/inspecciones/${latestInsp.id}`);
          if (res.ok) {
            const json = await res.json();
            if (json.ok && json.data) {
              return window.openFichaTecnica(json.data);
            }
          }
        } catch (e) {}
      }

      return window.openFichaTecnica({
        ...latestInsp,
        beneficiario_nombre: ben.nombre,
        beneficiario_documento: ben.documento,
        municipio: ben.municipio,
        vereda: ben.vereda,
        fase: ben.fase
      });
    }

    // Si aún no tiene visitas (0% Sin Iniciar), generar Ficha Técnica inicial oficial
    const unstartedFicha = {
      id: ben.id,
      beneficiario_id: ben.id,
      beneficiario_nombre: ben.nombre,
      beneficiario_documento: ben.documento,
      municipio: ben.municipio || 'Sin Municipio',
      vereda: ben.vereda || 'Sin Vereda',
      fase: ben.fase || '1',
      fecha_visita: new Date().toISOString(),
      estado_clima: 'Soleado',
      avance_global: 0.00,
      estado_bateria: 'SIN_INICIAR',
      coordenadas_gps: ben.coordenadas || 'N/A',
      observaciones: 'Batería Sanitaria en estado Sin Iniciar (0%). No se han registrado visitas previas.',
      inspector_nombre: ben.inspector || 'Inspector de Zona',
      fotos: [],
      actividadesScores: {}
    };

    window.openFichaTecnica(unstartedFicha);
  } catch (err) {
    showToast('Error al generar Ficha Técnica: ' + err.message, 'danger');
  }
};
/* ==========================================================================
   MÓDULO EJECUTIVO: DASHBOARD GERENCIAL, PODIO Y GRÁFICAS INTERACTIVAS
   ========================================================================== */
let chartEstadosDonut = null;
let chartBalanceMunicipios = null;
let chartMunicipiosStacked = null;
let chartActividadesDashboard = null;

window.copyChartImage = async function (canvasId, chartTitle = 'Gráfica') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    showToast('No se encontró el lienzo de la gráfica', 'danger');
    return;
  }

  // Canvas temporal con fondo blanco para preservar nitidez en WhatsApp / Word / PowerPoint
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(canvas, 0, 0);

  try {
    tempCanvas.toBlob(async (blob) => {
      if (!blob) throw new Error('No se pudo generar el blob de la imagen');
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast(`✅ "${chartTitle}" copiada al portapapeles. ¡Lista para pegar en Word, WhatsApp o PowerPoint!`, 'success');
      } else {
        window.downloadChartImage(canvasId, chartTitle.toLowerCase().replace(/\s+/g, '_'));
        showToast(`📥 Descargando imagen PNG de "${chartTitle}"`, 'info');
      }
    }, 'image/png');
  } catch (err) {
    console.error('Error al copiar imagen al portapapeles:', err);
    window.downloadChartImage(canvasId, chartTitle.toLowerCase().replace(/\s+/g, '_'));
    showToast(`📥 Descargando imagen PNG de "${chartTitle}"`, 'info');
  }
};

window.downloadChartImage = function (canvasId, filename = 'grafica') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
  link.href = tempCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


/* ==========================================================================
   EXPORTADORES DE EXCEL DETALLADOS PARA DASHBOARD Y REPORTES
   ========================================================================== */
window.downloadExcelFromHtml = function (filename, sheetName, htmlContent) {
  const fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${sheetName || 'Datos'}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th { background-color: #059669; color: #ffffff; font-weight: bold; border: 1px solid #047857; text-align: center; padding: 7px; font-size: 11pt; }
        td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-size: 10pt; }
        .th-blue { background-color: #0284c7; color: #ffffff; border: 1px solid #0369a1; }
        .th-purple { background-color: #7c3aed; color: #ffffff; border: 1px solid #6d28d9; }
        .th-gray { background-color: #475569; color: #ffffff; border: 1px solid #334155; }
        .num { text-align: right; }
        .center { text-align: center; }
        .title { font-size: 16pt; font-weight: bold; color: #065f46; margin-bottom: 4px; }
        .subtitle { font-size: 10pt; color: #64748b; margin-bottom: 15px; }
        .section-header { font-size: 13pt; font-weight: bold; padding: 6px; }
        .total-row { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #059669; }
        .badge-term { background-color: #d1fae5; color: #065f46; font-weight: bold; text-align: center; }
        .badge-ejec { background-color: #ffedd5; color: #9a3412; font-weight: bold; text-align: center; }
        .badge-sin { background-color: #f1f5f9; color: #475569; text-align: center; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + fullHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`📊 Archivo Excel "${filename}.xls" descargado con éxito con información detallada.`, 'success');
};

// 1. Exportar Detalle de Estados Globales
window.exportExcelDashboardEstados = async function () {
  const allBen = await window.dbManager.getBeneficiarios();
  let allInspections = [];
  if (navigator.onLine) {
    try {
      const res = await fetch('/api/inspecciones?limit=2000');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) allInspections = json.data;
      }
    } catch (e) {}
  }
  if (allInspections.length === 0) {
    allInspections = await window.dbManager.getPendingInspecciones();
  }

  const benProgressMap = {};
  const inspMap = {};
  allInspections.forEach((insp) => {
    if (benProgressMap[insp.beneficiario_id] === undefined) {
      benProgressMap[insp.beneficiario_id] = parseFloat(insp.avance_global) || 0;
      inspMap[insp.beneficiario_id] = insp;
    }
  });

  let cTerm = 0, cEjec = 0, cSin = 0;
  const listDetails = (allBen || []).map((b, idx) => {
    const prog = benProgressMap[b.id] !== undefined ? benProgressMap[b.id] : 0;
    let estado = 'Sin Iniciar';
    let estadoCls = 'badge-sin';
    if (prog >= 99.9) {
      estado = 'Terminada';
      estadoCls = 'badge-term';
      cTerm++;
    } else if (prog > 0) {
      estado = 'En Ejecución';
      estadoCls = 'badge-ejec';
      cEjec++;
    } else {
      cSin++;
    }
    const lastInsp = inspMap[b.id];
    return {
      num: idx + 1,
      documento: b.documento || '--',
      nombre: b.nombre || '',
      municipio: b.municipio || '',
      vereda: b.vereda || '',
      fase: b.fase === 2 ? 'Fase 2' : 'Fase 1',
      prog: prog.toFixed(2),
      estado,
      estadoCls,
      inspector: b.inspector_nombre || (lastInsp ? lastInsp.inspector_nombre : 'Sin Asignar'),
      fecha: lastInsp ? (lastInsp.fecha_inspeccion ? lastInsp.fecha_inspeccion.substring(0, 10) : '') : '--'
    };
  });

  const tot = listDetails.length;
  const html = `
    <div class="title">REPORTE DETALLADO: DISTRIBUCIÓN GLOBAL DE ESTADOS</div>
    <div class="subtitle">Proyecto Construcción de Baterías Sanitarias Rurales - Generado el ${new Date().toLocaleString('es-CO')}</div>

    <table>
      <thead>
        <tr>
          <th>Estado Constructivo</th>
          <th>Cantidad de Baterías</th>
          <th>Porcentaje del Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>🟢 Terminadas (100%)</td>
          <td class="num"><strong>${cTerm.toLocaleString('es-CO')}</strong></td>
          <td class="num"><strong>${(tot > 0 ? (cTerm / tot) * 100 : 0).toFixed(2)}%</strong></td>
        </tr>
        <tr>
          <td>🟠 En Ejecución (1% - 99%)</td>
          <td class="num"><strong>${cEjec.toLocaleString('es-CO')}</strong></td>
          <td class="num"><strong>${(tot > 0 ? (cEjec / tot) * 100 : 0).toFixed(2)}%</strong></td>
        </tr>
        <tr>
          <td>⚪ Sin Iniciar (0%)</td>
          <td class="num"><strong>${cSin.toLocaleString('es-CO')}</strong></td>
          <td class="num"><strong>${(tot > 0 ? (cSin / tot) * 100 : 0).toFixed(2)}%</strong></td>
        </tr>
        <tr class="total-row">
          <td>TOTAL UNIVERSO BENEFICIARIOS</td>
          <td class="num"><strong>${tot.toLocaleString('es-CO')}</strong></td>
          <td class="num"><strong>100.00%</strong></td>
        </tr>
      </tbody>
    </table>

    <br>
    <div class="section-header" style="color:#059669;">📋 DESGLOSE INDIVIDUAL DE TODOS LOS BENEFICIARIOS (${tot})</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Cédula / Documento</th>
          <th>Nombre del Beneficiario</th>
          <th>Municipio</th>
          <th>Vereda</th>
          <th>Fase</th>
          <th>% Avance Físico</th>
          <th>Estado</th>
          <th>Inspector Asignado</th>
          <th>Última Visita</th>
        </tr>
      </thead>
      <tbody>
        ${listDetails.map(d => `
          <tr>
            <td class="center">${d.num}</td>
            <td><code>${d.documento}</code></td>
            <td><strong>${escapeHtml(d.nombre)}</strong></td>
            <td>${escapeHtml(d.municipio)}</td>
            <td>${escapeHtml(d.vereda)}</td>
            <td class="center">${d.fase}</td>
            <td class="num"><strong>${d.prog}%</strong></td>
            <td class="${d.estadoCls}">${d.estado}</td>
            <td>${escapeHtml(d.inspector)}</td>
            <td class="center">${d.fecha}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  window.downloadExcelFromHtml('reporte_estados_globales', 'Distribucion Estados', html);
};

// 2. Exportar Balance General de Baterías Terminadas por Municipio
window.exportExcelBalanceMunicipios = async function () {
  const allBen = await window.dbManager.getBeneficiarios();
  const allMunsList = typeof window.dbManager.getMunicipios === 'function' ? await window.dbManager.getMunicipios() : [];
  let allInspections = [];
  if (navigator.onLine) {
    try {
      const res = await fetch('/api/inspecciones?limit=2000');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) allInspections = json.data;
      }
    } catch (e) {}
  }
  if (allInspections.length === 0) {
    allInspections = await window.dbManager.getPendingInspecciones();
  }

  const benProgressMap = {};
  allInspections.forEach((insp) => {
    if (benProgressMap[insp.beneficiario_id] === undefined) {
      benProgressMap[insp.beneficiario_id] = parseFloat(insp.avance_global) || 0;
    }
  });

  const munMap = {};
  allMunsList.forEach(m => {
    const name = (m.nombre || '').trim().toUpperCase();
    if (name) {
      munMap[name] = {
        total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0,
        f1: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 },
        f2: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 }
      };
    }
  });

  (allBen || []).forEach(b => {
    const mun = (b.municipio || 'SIN MUNICIPIO').trim().toUpperCase();
    if (!munMap[mun]) {
      munMap[mun] = {
        total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0,
        f1: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 },
        f2: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 }
      };
    }
    const prog = benProgressMap[b.id] !== undefined ? benProgressMap[b.id] : 0;
    const fKey = b.fase === 2 ? 'f2' : 'f1';

    munMap[mun].total++;
    munMap[mun].sumProgress += prog;
    munMap[mun][fKey].total++;
    munMap[mun][fKey].sumProgress += prog;

    if (prog >= 99.9) {
      munMap[mun].terminadas++;
      munMap[mun][fKey].terminadas++;
    } else if (prog > 0) {
      munMap[mun].ejecucion++;
      munMap[mun][fKey].ejecucion++;
    } else {
      munMap[mun].sinIniciar++;
      munMap[mun][fKey].sinIniciar++;
    }
  });

  const munsArr = Object.entries(munMap).map(([name, d]) => ({ name, ...d })).filter(m => m.total > 0);
  const f1List = munsArr.filter(m => m.f1.total > 0).sort((a, b) => (b.f1.terminadas / b.f1.total) - (a.f1.terminadas / a.f1.total) || a.name.localeCompare(b.name, 'es'));
  const f2List = munsArr.filter(m => m.f2.total > 0).sort((a, b) => (b.f2.terminadas / b.f2.total) - (a.f2.terminadas / a.f2.total) || a.name.localeCompare(b.name, 'es'));

  const sumF1Tot = f1List.reduce((acc, m) => acc + m.f1.total, 0);
  const sumF1Term = f1List.reduce((acc, m) => acc + m.f1.terminadas, 0);
  const sumF1Ejec = f1List.reduce((acc, m) => acc + m.f1.ejecucion, 0);
  const sumF1Sin = f1List.reduce((acc, m) => acc + m.f1.sinIniciar, 0);

  const sumF2Tot = f2List.reduce((acc, m) => acc + m.f2.total, 0);
  const sumF2Term = f2List.reduce((acc, m) => acc + m.f2.terminadas, 0);
  const sumF2Ejec = f2List.reduce((acc, m) => acc + m.f2.ejecucion, 0);
  const sumF2Sin = f2List.reduce((acc, m) => acc + m.f2.sinIniciar, 0);

  const html = `
    <div class="title">BALANCE TERRITORIAL: BATERÍAS TERMINADAS POR MUNICIPIO</div>
    <div class="subtitle">Comparativo organizado por Fase 1 y Fase 2 - Generado el ${new Date().toLocaleString('es-CO')}</div>

    <div class="section-header" style="color:#0284c7;">🔵 FASE 1 (CATATUMBO / NORTE DE SANTANDER)</div>
    <table>
      <thead>
        <tr>
          <th class="th-blue">Municipio</th>
          <th class="th-blue">Total Asignadas</th>
          <th class="th-blue">Baterías Terminadas</th>
          <th class="th-blue">% Terminadas</th>
          <th class="th-blue">En Ejecución</th>
          <th class="th-blue">Sin Iniciar</th>
        </tr>
      </thead>
      <tbody>
        ${f1List.map(m => {
          const pct = ((m.f1.terminadas / m.f1.total) * 100).toFixed(1);
          return `
            <tr>
              <td><strong>${escapeHtml(m.name)}</strong></td>
              <td class="num">${m.f1.total}</td>
              <td class="num" style="color:#059669; font-weight:bold;">${m.f1.terminadas}</td>
              <td class="num" style="font-weight:bold;">${pct}%</td>
              <td class="num">${m.f1.ejecucion}</td>
              <td class="num">${m.f1.sinIniciar}</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td>SUBTOTAL FASE 1</td>
          <td class="num">${sumF1Tot}</td>
          <td class="num" style="color:#059669;">${sumF1Term}</td>
          <td class="num">${(sumF1Tot > 0 ? (sumF1Term / sumF1Tot) * 100 : 0).toFixed(1)}%</td>
          <td class="num">${sumF1Ejec}</td>
          <td class="num">${sumF1Sin}</td>
        </tr>
      </tbody>
    </table>

    <br>
    <div class="section-header" style="color:#7c3aed;">🟣 FASE 2 (ÁREA METROPOLITANA Y OTRAS ZONAS)</div>
    <table>
      <thead>
        <tr>
          <th class="th-purple">Municipio</th>
          <th class="th-purple">Total Asignadas</th>
          <th class="th-purple">Baterías Terminadas</th>
          <th class="th-purple">% Terminadas</th>
          <th class="th-purple">En Ejecución</th>
          <th class="th-purple">Sin Iniciar</th>
        </tr>
      </thead>
      <tbody>
        ${f2List.map(m => {
          const pct = ((m.f2.terminadas / m.f2.total) * 100).toFixed(1);
          return `
            <tr>
              <td><strong>${escapeHtml(m.name)}</strong></td>
              <td class="num">${m.f2.total}</td>
              <td class="num" style="color:#059669; font-weight:bold;">${m.f2.terminadas}</td>
              <td class="num" style="font-weight:bold;">${pct}%</td>
              <td class="num">${m.f2.ejecucion}</td>
              <td class="num">${m.f2.sinIniciar}</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td>SUBTOTAL FASE 2</td>
          <td class="num">${sumF2Tot}</td>
          <td class="num" style="color:#059669;">${sumF2Term}</td>
          <td class="num">${(sumF2Tot > 0 ? (sumF2Term / sumF2Tot) * 100 : 0).toFixed(1)}%</td>
          <td class="num">${sumF2Ejec}</td>
          <td class="num">${sumF2Sin}</td>
        </tr>
      </tbody>
    </table>

    <br>
    <table>
      <thead>
        <tr>
          <th>RESUMEN CONSOLIDADO DEL PROYECTO</th>
          <th>TOTAL ASIGNADAS</th>
          <th>TOTAL TERMINADAS</th>
          <th>% TERMINACIÓN GLOBAL</th>
        </tr>
      </thead>
      <tbody>
        <tr class="total-row" style="font-size:12pt;">
          <td>TOTAL GENERAL</td>
          <td class="num">${(sumF1Tot + sumF2Tot).toLocaleString('es-CO')}</td>
          <td class="num" style="color:#059669;">${(sumF1Term + sumF2Term).toLocaleString('es-CO')}</td>
          <td class="num" style="color:#059669;">${((sumF1Tot + sumF2Tot) > 0 ? ((sumF1Term + sumF2Term) / (sumF1Tot + sumF2Tot)) * 100 : 0).toFixed(2)}%</td>
        </tr>
      </tbody>
    </table>
  `;

  window.downloadExcelFromHtml('balance_baterias_terminadas_municipio', 'Balance Terminadas', html);
};

// 3. Exportar Comparativo de Fases
window.exportExcelComparativoFases = async function () {
  const allBen = await window.dbManager.getBeneficiarios();
  const allMunsList = typeof window.dbManager.getMunicipios === 'function' ? await window.dbManager.getMunicipios() : [];
  let allInspections = [];
  if (navigator.onLine) {
    try {
      const res = await fetch('/api/inspecciones?limit=2000');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) allInspections = json.data;
      }
    } catch (e) {}
  }
  if (allInspections.length === 0) {
    allInspections = await window.dbManager.getPendingInspecciones();
  }

  const benProgressMap = {};
  allInspections.forEach((insp) => {
    if (benProgressMap[insp.beneficiario_id] === undefined) {
      benProgressMap[insp.beneficiario_id] = parseFloat(insp.avance_global) || 0;
    }
  });

  const munMap = {};
  allMunsList.forEach(m => {
    const name = (m.nombre || '').trim().toUpperCase();
    if (name) {
      munMap[name] = {
        total: 0,
        f1: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 },
        f2: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 }
      };
    }
  });

  (allBen || []).forEach(b => {
    const mun = (b.municipio || 'SIN MUNICIPIO').trim().toUpperCase();
    if (!munMap[mun]) {
      munMap[mun] = {
        total: 0,
        f1: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 },
        f2: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 }
      };
    }
    const prog = benProgressMap[b.id] !== undefined ? benProgressMap[b.id] : 0;
    const fKey = b.fase === 2 ? 'f2' : 'f1';

    munMap[mun].total++;
    munMap[mun][fKey].total++;
    munMap[mun][fKey].sumProgress += prog;

    if (prog >= 99.9) {
      munMap[mun][fKey].terminadas++;
    } else if (prog > 0) {
      munMap[mun][fKey].ejecucion++;
    } else {
      munMap[mun][fKey].sinIniciar++;
    }
  });

  const munsArr = Object.entries(munMap).map(([name, d]) => ({ name, ...d })).filter(m => m.total > 0).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const html = `
    <div class="title">COMPARATIVO TERRITORIAL: BATERÍAS ASIGNADAS (FASE 1 VS FASE 2)</div>
    <div class="subtitle">Detalle completo de los 15 municipios del proyecto - Generado el ${new Date().toLocaleString('es-CO')}</div>

    <table>
      <thead>
        <tr>
          <th rowspan="2" class="th-gray">Municipio</th>
          <th colspan="4" class="th-blue">FASE 1</th>
          <th colspan="4" class="th-purple">FASE 2</th>
          <th rowspan="2" class="th-gray">Total Baterías</th>
        </tr>
        <tr>
          <th class="th-blue">Total F1</th>
          <th class="th-blue">Terminadas</th>
          <th class="th-blue">Ejecución</th>
          <th class="th-blue">Sin Iniciar</th>
          <th class="th-purple">Total F2</th>
          <th class="th-purple">Terminadas</th>
          <th class="th-purple">Ejecución</th>
          <th class="th-purple">Sin Iniciar</th>
        </tr>
      </thead>
      <tbody>
        ${munsArr.map(m => `
          <tr>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td class="num">${m.f1.total}</td>
            <td class="num" style="color:#059669;">${m.f1.terminadas}</td>
            <td class="num">${m.f1.ejecucion}</td>
            <td class="num">${m.f1.sinIniciar}</td>
            <td class="num">${m.f2.total}</td>
            <td class="num" style="color:#059669;">${m.f2.terminadas}</td>
            <td class="num">${m.f2.ejecucion}</td>
            <td class="num">${m.f2.sinIniciar}</td>
            <td class="num" style="font-weight:bold; background:#f8fafc;">${m.total}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  window.downloadExcelFromHtml('comparativo_fase1_vs_fase2', 'Comparativo Fases', html);
};

// 4. Exportar Balance Territorial Consolidado
window.exportExcelConsolidadoTerritorial = async function () {
  await window.exportExcelBalanceMunicipios();
};

// 5. Exportadores para la Pestaña de Reportes
window.exportExcelReporteEstados = async function () {
  await window.exportExcelDashboardEstados();
};

window.exportExcelReporteSegmentos = async function () {
  await window.exportExcelComparativoFases();
};

window.exportExcelReporteVeredas = async function () {
  const select = document.getElementById('chart-veredas-municipio-select');
  const munName = select ? select.value : 'TODOS';
  const allBen = await window.dbManager.getBeneficiarios();
  const filtered = allBen.filter(b => munName === 'TODOS' || (b.municipio || '').toUpperCase() === munName.toUpperCase());

  const html = `
    <div class="title">REPORTE DETALLADO POR VEREDAS: ${escapeHtml(munName)}</div>
    <div class="subtitle">Total Registros: ${filtered.length} - Generado el ${new Date().toLocaleString('es-CO')}</div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Cédula</th>
          <th>Nombre del Beneficiario</th>
          <th>Municipio</th>
          <th>Vereda</th>
          <th>Fase</th>
          <th>Inspector</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((b, idx) => `
          <tr>
            <td class="center">${idx + 1}</td>
            <td><code>${b.documento}</code></td>
            <td><strong>${escapeHtml(b.nombre)}</strong></td>
            <td>${escapeHtml(b.municipio)}</td>
            <td>${escapeHtml(b.vereda)}</td>
            <td class="center">${b.fase === 2 ? 'Fase 2' : 'Fase 1'}</td>
            <td>${escapeHtml(b.inspector_nombre || 'Sin Asignar')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  window.downloadExcelFromHtml(`reporte_veredas_${munName.toLowerCase()}`, 'Veredas', html);
};

window.exportExcelReporteActividades = async function () {
  const activities = await window.dbManager.getActividades();
  const html = `
    <div class="title">REPORTE DETALLADO: AVANCE POR 13 ACTIVIDADES CONSTRUCTIVAS</div>
    <div class="subtitle">Ponderación Oficial de Capítulos de Obra - Generado el ${new Date().toLocaleString('es-CO')}</div>

    <table>
      <thead>
        <tr>
          <th># Ítem</th>
          <th>Capítulo / Actividad Constructiva</th>
          <th>Peso / Ponderación Oficial</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
        ${(activities || []).map(a => `
          <tr>
            <td class="center"><strong>${a.orden}</strong></td>
            <td><strong>${escapeHtml(a.nombre)}</strong></td>
            <td class="num"><strong>${a.ponderacion}%</strong></td>
            <td>${escapeHtml(a.descripcion || '--')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  window.downloadExcelFromHtml('avance_13_actividades_constructivas', 'Actividades', html);
};

window.renderProgressBarsReportToCanvas = function (canvas, fase1Muns, fase2Muns, totF1Term, totF1Total, pctF1Global, totF2Term, totF2Total, pctF2Global) {
  if (!canvas) return;

  const width = 850;
  const rowHeight = 34;
  const headerHeight = 70;
  const sectionHeaderHeight = 38;
  const footerHeight = 40;

  const totalHeight = headerHeight + sectionHeaderHeight + (fase1Muns.length * rowHeight) + 15 + sectionHeaderHeight + (fase2Muns.length * rowHeight) + footerHeight;

  canvas.width = width;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fondo Blanco Profesional y Limpio
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Encabezado
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('📈 BALANCE GENERAL: BATERÍAS TERMINADAS POR MUNICIPIO', 25, 36);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 12px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(`Universo Oficial: 1.399 Beneficiarios | Generado: ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`, 25, 56);

  let currentY = headerHeight;

  // Función auxiliar para dibujar una sección
  function drawSection(title, countText, items, isFase1, badgeBg, barColor) {
    // Encabezado de la fase
    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    ctx.roundRect(25, currentY, width - 50, 30, 4);
    ctx.fill();

    ctx.fillStyle = barColor;
    ctx.font = 'bold 13px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(title, 35, currentY + 20);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(width - 230, currentY + 4, 195, 22, 4);
    ctx.fill();

    ctx.fillStyle = barColor;
    ctx.font = 'bold 11px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(countText, width - 132, currentY + 19);
    ctx.textAlign = 'left';

    currentY += sectionHeaderHeight;

    // Items de cada municipio
    items.forEach((m) => {
      const term = isFase1 ? m.f1.terminadas : m.f2.terminadas;
      const tot = isFase1 ? m.f1.total : m.f2.total;
      const pct = tot > 0 ? parseFloat(((term / tot) * 100).toFixed(1)) : 0;

      // Nombre del municipio
      ctx.fillStyle = '#1e293b';
      ctx.font = '600 12px "Inter", "Segoe UI", sans-serif';
      ctx.fillText(m.name, 35, currentY + 16);

      // Fondo de la barra de progreso
      const barX = 230;
      const barWidth = 440;
      const barH = 10;
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(barX, currentY + 8, barWidth, barH, 5);
      ctx.fill();

      // Relleno de la barra
      if (pct > 0) {
        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(barX, currentY + 8, Math.max(8, (barWidth * pct) / 100), barH, 5);
        ctx.fill();
      }

      // Conteo y porcentaje a la derecha
      ctx.fillStyle = pct >= 99.9 ? '#059669' : '#0f172a';
      ctx.font = 'bold 11px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${term}/${tot} (${pct.toFixed(1)}%)`, width - 35, currentY + 17);
      ctx.textAlign = 'left';

      // Línea divisoria muy suave
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, currentY + rowHeight - 2);
      ctx.lineTo(width - 35, currentY + rowHeight - 2);
      ctx.stroke();

      currentY += rowHeight;
    });
  }

  // Dibujar FASE 1
  drawSection(`🔵 FASE 1 (${fase1Muns.length} MUNICIPIOS)`, `${totF1Term} / ${totF1Total} Terminadas (${pctF1Global}%)`, fase1Muns, true, '#e0f2fe', '#0284c7');

  currentY += 12;

  // Dibujar FASE 2
  drawSection(`🟣 FASE 2 (${fase2Muns.length} MUNICIPIOS)`, `${totF2Term} / ${totF2Total} Terminadas (${pctF2Global}%)`, fase2Muns, false, '#f3e8ff', '#8b5cf6');

  // Pie de página
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Proyecto Baterías Sanitarias Rurales - Sistema Oficial de Control y Seguimiento', width / 2, totalHeight - 14);
  ctx.textAlign = 'left';
};

async function renderExecutiveDashboard() {
  try {
    // 1. Obtener todos los beneficiarios y filtrar estrictamente los Vivos (Estado = 1)
    const allBeneficiarios = await window.dbManager.getBeneficiarios();
    const vivosBen = (allBeneficiarios || []).filter((b) => b.estado == 1);

    // 2. Obtener todas las inspecciones registradas
    let allInspections = [];
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/inspecciones?limit=2000');
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) allInspections = json.data;
        }
      } catch (e) {
        console.log('Cargando inspecciones locales para dashboard');
      }
    }

    if (allInspections.length === 0) {
      allInspections = await window.dbManager.getPendingInspecciones();
    }

    // 3. Mapear el último porcentaje de avance para cada beneficiario vivo
    const benProgressMap = {};
    allInspections.forEach((insp) => {
      if (benProgressMap[insp.beneficiario_id] === undefined) {
        benProgressMap[insp.beneficiario_id] = parseFloat(insp.avance_global) || 0;
      }
    });

    // 4. Inicializar y calcular métricas sobre los 15 municipios y el universo total (1399) con desglose por Fase 1 y Fase 2
    let globalSinIniciar = 0;
    let globalEjecucion = 0;
    let globalTerminadas = 0;
    let sumProgress = 0;

    const allMunsList = typeof window.dbManager.getMunicipios === 'function' ? await window.dbManager.getMunicipios() : [];
    const munMap = {};

    // Precargar todos los municipios oficiales para garantizar que aparezcan los 15
    (allMunsList || []).forEach(m => {
      const name = (m.nombre || '').trim().toUpperCase();
      if (name) {
        munMap[name] = {
          total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0,
          f1: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 },
          f2: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 }
        };
      }
    });

    (allBeneficiarios || []).forEach((b) => {
      const mun = (b.municipio || 'SIN MUNICIPIO').trim().toUpperCase();
      if (!munMap[mun]) {
        munMap[mun] = {
          total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0,
          f1: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 },
          f2: { total: 0, sinIniciar: 0, ejecucion: 0, terminadas: 0, sumProgress: 0 }
        };
      }

      const prog = benProgressMap[b.id] !== undefined ? benProgressMap[b.id] : 0;
      const faseKey = b.fase === 2 ? 'f2' : 'f1';

      munMap[mun].total++;
      munMap[mun].sumProgress += prog;
      munMap[mun][faseKey].total++;
      munMap[mun][faseKey].sumProgress += prog;
      sumProgress += prog;

      if (prog >= 99.9) {
        munMap[mun].terminadas++;
        munMap[mun][faseKey].terminadas++;
        globalTerminadas++;
      } else if (prog > 0) {
        munMap[mun].ejecucion++;
        munMap[mun][faseKey].ejecucion++;
        globalEjecucion++;
      } else {
        munMap[mun].sinIniciar++;
        munMap[mun][faseKey].sinIniciar++;
        globalSinIniciar++;
      }
    });

    const totalBeneficiarios = (allBeneficiarios || []).length;
    const totalVivos = vivosBen.length;
    const totalFallecidos = totalBeneficiarios - totalVivos;
    const globalAvg = totalBeneficiarios > 0 ? (sumProgress / totalBeneficiarios) : 0;

    // 5. Actualizar KPI Cards Principales del Dashboard Gerencial
    const statTotalEl = document.getElementById('dash-stat-total');
    if (statTotalEl) statTotalEl.textContent = totalBeneficiarios.toLocaleString('es-CO');

    const statVivosEl = document.getElementById('dash-stat-vivos');
    if (statVivosEl) statVivosEl.textContent = totalVivos.toLocaleString('es-CO');

    const statFallecidosEl = document.getElementById('dash-stat-fallecidos');
    if (statFallecidosEl) statFallecidosEl.textContent = totalFallecidos.toLocaleString('es-CO');

    const statSinEl = document.getElementById('dash-stat-sininiciar');
    if (statSinEl) statSinEl.textContent = globalSinIniciar.toLocaleString('es-CO');

    const statEjecEl = document.getElementById('dash-stat-ejecucion');
    if (statEjecEl) statEjecEl.textContent = globalEjecucion.toLocaleString('es-CO');

    const statTermEl = document.getElementById('dash-stat-terminadas');
    if (statTermEl) statTermEl.textContent = globalTerminadas.toLocaleString('es-CO');

    const statPromEl = document.getElementById('dash-stat-promedio');
    if (statPromEl) statPromEl.textContent = `${globalAvg.toFixed(2)}%`;

    // 6. Ranking y Podio de Honor (Top 3 Municipios)
    const sortedMuns = Object.entries(munMap).map(([name, d]) => ({
      name,
      total: d.total,
      sinIniciar: d.sinIniciar,
      ejecucion: d.ejecucion,
      terminadas: d.terminadas,
      avg: d.total > 0 ? (d.sumProgress / d.total) : 0,
      f1: {
        total: d.f1.total,
        sinIniciar: d.f1.sinIniciar,
        ejecucion: d.f1.ejecucion,
        terminadas: d.f1.terminadas,
        avg: d.f1.total > 0 ? (d.f1.sumProgress / d.f1.total) : 0
      },
      f2: {
        total: d.f2.total,
        sinIniciar: d.f2.sinIniciar,
        ejecucion: d.f2.ejecucion,
        terminadas: d.f2.terminadas,
        avg: d.f2.total > 0 ? (d.f2.sumProgress / d.f2.total) : 0
      }
    })).filter(m => m.total > 0).sort((a, b) => b.terminadas - a.terminadas || b.avg - a.avg || a.name.localeCompare(b.name, 'es'));

    const podioContainer = document.getElementById('dash-podio-container');
    if (podioContainer) {
      const top3 = sortedMuns.slice(0, 3);
      const podioMeta = [
        { place: '1º LUGAR', medal: '🥇' },
        { place: '2º LUGAR', medal: '🥈' },
        { place: '3º LUGAR', medal: '🥉' }
      ];

      if (top3.length === 0) {
        podioContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Aún no hay datos suficientes para el podio.</div>`;
      } else {
        podioContainer.innerHTML = top3.map((m, idx) => {
          const meta = podioMeta[idx] || podioMeta[0];
          return `
            <div class="podio-card podio-card-${idx + 1}">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span class="podio-rank-title" style="font-weight: 800; font-size: 0.82rem; letter-spacing: 0.5px;">${meta.place}</span>
                  <span style="font-size: 1.85rem; line-height: 1;">${meta.medal}</span>
                </div>
                <h4 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.5rem 0;">${escapeHtml(m.name)}</h4>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                  <span class="badge badge-status-terminado" style="font-size: 0.75rem;">🟢 ${m.terminadas} Terminadas</span>
                  <span class="badge badge-status-ejecucion" style="font-size: 0.75rem;">🟠 ${m.ejecucion} En Ejecución</span>
                  <span class="badge badge-status-sin-iniciar" style="font-size: 0.75rem;">⚪ ${m.sinIniciar} Sin Iniciar</span>
                </div>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 3px;">
                  <span>Avance Promedio:</span>
                  <span class="podio-avg-val" style="font-weight: 800;">${m.avg.toFixed(2)}%</span>
                </div>
                <div style="height: 7px; background: rgba(125,125,125,0.15); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${m.avg}%; background: ${m.avg >= 99.9 ? '#059669' : m.avg > 0 ? '#ea580c' : '#64748b'};"></div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 7. Gráfica 1: Donut de Estados Globales
    const canvasDonut = document.getElementById('chart-estados-donut');
    if (canvasDonut && typeof Chart !== 'undefined') {
      const ctxDonut = canvasDonut.getContext('2d');
      if (chartEstadosDonut) chartEstadosDonut.destroy();
      const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkTheme ? '#cbd5e1' : '#475569';
      
      const pctSin = totalBeneficiarios > 0 ? ((globalSinIniciar / totalBeneficiarios) * 100).toFixed(1) : '0.0';
      const pctEjec = totalBeneficiarios > 0 ? ((globalEjecucion / totalBeneficiarios) * 100).toFixed(1) : '0.0';
      const pctTerm = totalBeneficiarios > 0 ? ((globalTerminadas / totalBeneficiarios) * 100).toFixed(1) : '0.0';

      chartEstadosDonut = new Chart(ctxDonut, {
        type: 'doughnut',
        plugins: [visibleDonutPercentagePlugin],
        data: {
          labels: [`Sin Iniciar (${pctSin}%)`, `En Ejecución (${pctEjec}%)`, `Terminadas (${pctTerm}%)`],
          datasets: [{
            data: [globalSinIniciar, globalEjecucion, globalTerminadas],
            backgroundColor: ['#64748b', '#ea580c', '#059669'],
            borderWidth: 3,
            borderColor: isDarkTheme ? '#131b2e' : '#ffffff',
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, padding: 15, font: { size: 11, weight: '700' }, color: textColor }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed;
                  const pct = totalBeneficiarios > 0 ? ((val / totalBeneficiarios) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${val.toLocaleString('es-CO')} (${pct}%)`;
                }
              }
            }
          },
          cutout: '62%'
        }
      });
    }

    // 8. Gráfica 2 & Barras de Progreso: Balance General (% Baterías Terminadas por Municipio - Primero Fase 1 y luego Fase 2)
    const fase1Muns = sortedMuns.filter(m => m.f1.total > 0).sort((a, b) => {
      const pctB = (b.f1.terminadas / b.f1.total);
      const pctA = (a.f1.terminadas / a.f1.total);
      return pctB - pctA || b.f1.terminadas - a.f1.terminadas || a.name.localeCompare(b.name, 'es');
    });

    const fase2Muns = sortedMuns.filter(m => m.f2.total > 0).sort((a, b) => {
      const pctB = (b.f2.terminadas / b.f2.total);
      const pctA = (a.f2.terminadas / a.f2.total);
      return pctB - pctA || b.f2.terminadas - a.f2.terminadas || a.name.localeCompare(b.name, 'es');
    });

    const totF1Term = fase1Muns.reduce((acc, m) => acc + m.f1.terminadas, 0);
    const totF1Total = fase1Muns.reduce((acc, m) => acc + m.f1.total, 0);
    const pctF1Global = totF1Total > 0 ? ((totF1Term / totF1Total) * 100).toFixed(1) : '0.0';

    const totF2Term = fase2Muns.reduce((acc, m) => acc + m.f2.terminadas, 0);
    const totF2Total = fase2Muns.reduce((acc, m) => acc + m.f2.total, 0);
    const pctF2Global = totF2Total > 0 ? ((totF2Term / totF2Total) * 100).toFixed(1) : '0.0';

    const progressBarsContainer = document.getElementById('balance-progress-bars-container');
    if (progressBarsContainer) {
      if (sortedMuns.length === 0) {
        progressBarsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay datos registrados aún.</div>';
      } else {
        let htmlContent = '';

        // SECCIÓN 1: FASE 1
        htmlContent += `
          <div style="margin-bottom: 0.5rem; position: sticky; top: 0; background: var(--bg-surface); z-index: 2; padding: 4px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(2, 132, 199, 0.12); padding: 0.45rem 0.75rem; border-radius: var(--radius-sm); border-left: 4px solid #0284c7;">
              <strong style="font-size: 0.85rem; color: #0284c7; letter-spacing: 0.3px;">🔵 FASE 1 (${fase1Muns.length} Municipios)</strong>
              <span class="badge" style="background: #0284c7; color: #fff; font-size: 0.75rem;">${totF1Term} / ${totF1Total} Terminadas (${pctF1Global}%)</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem;">
        `;

        fase1Muns.forEach(m => {
          const pct = ((m.f1.terminadas / m.f1.total) * 100).toFixed(1);
          htmlContent += `
            <div style="background: var(--bg-surface); padding: 0.55rem 0.8rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <strong style="font-size: 0.84rem; color: var(--text-primary);">${escapeHtml(m.name)}</strong>
                <span class="badge ${parseFloat(pct) >= 99.9 ? 'badge-status-terminado' : 'badge-status-ejecucion'}" style="font-size: 0.72rem;">
                  🟢 ${m.f1.terminadas} / ${m.f1.total} Terminadas (${pct}%)
                </span>
              </div>
              <div style="height: 7px; background: rgba(125,125,125,0.15); border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${pct}%; background: #0284c7; border-radius: 4px; transition: width 0.4s ease;"></div>
              </div>
            </div>
          `;
        });
        htmlContent += `</div>`;

        // SECCIÓN 2: FASE 2
        htmlContent += `
          <div style="margin-bottom: 0.5rem; position: sticky; top: 0; background: var(--bg-surface); z-index: 2; padding: 4px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(139, 92, 246, 0.12); padding: 0.45rem 0.75rem; border-radius: var(--radius-sm); border-left: 4px solid #8b5cf6;">
              <strong style="font-size: 0.85rem; color: #8b5cf6; letter-spacing: 0.3px;">🟣 FASE 2 (${fase2Muns.length} Municipios)</strong>
              <span class="badge" style="background: #8b5cf6; color: #fff; font-size: 0.75rem;">${totF2Term} / ${totF2Total} Terminadas (${pctF2Global}%)</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        `;

        fase2Muns.forEach(m => {
          const pct = ((m.f2.terminadas / m.f2.total) * 100).toFixed(1);
          htmlContent += `
            <div style="background: var(--bg-surface); padding: 0.55rem 0.8rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <strong style="font-size: 0.84rem; color: var(--text-primary);">${escapeHtml(m.name)}</strong>
                <span class="badge ${parseFloat(pct) >= 99.9 ? 'badge-status-terminado' : 'badge-status-ejecucion'}" style="font-size: 0.72rem;">
                  🟢 ${m.f2.terminadas} / ${m.f2.total} Terminadas (${pct}%)
                </span>
              </div>
              <div style="height: 7px; background: rgba(125,125,125,0.15); border-radius: 4px; overflow: hidden;">
                <div style="height: 100%; width: ${pct}%; background: #8b5cf6; border-radius: 4px; transition: width 0.4s ease;"></div>
              </div>
            </div>
          `;
        });
        htmlContent += `</div>`;

        progressBarsContainer.innerHTML = htmlContent;
      }
    }

    // Dibujar el reporte de barras de progreso directamente en el canvas para exportación nítida (Copiar / Descargar PNG)
    const canvasBalance = document.getElementById('chart-balance-municipios');
    if (canvasBalance) {
      if (chartBalanceMunicipios) {
        chartBalanceMunicipios.destroy();
        chartBalanceMunicipios = null;
      }
      renderProgressBarsReportToCanvas(canvasBalance, fase1Muns, fase2Muns, totF1Term, totF1Total, pctF1Global, totF2Term, totF2Total, pctF2Global);
    }

    // 9. Gráfica 3: Doble Barra por Municipio (Comparativo Fase 1 vs Fase 2 - Primero Fase 1 y luego Fase 2)
    const canvasStacked = document.getElementById('chart-municipios-stacked');
    if (canvasStacked && typeof Chart !== 'undefined') {
      const ctxStacked = canvasStacked.getContext('2d');
      if (chartMunicipiosStacked) chartMunicipiosStacked.destroy();
      const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkTheme ? '#cbd5e1' : '#475569';
      const gridColor = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

      // Ordenar primero todos los de Fase 1, luego los que tienen ambas fases, y finalmente los de Fase 2
      const f1Only = sortedMuns.filter(m => m.f1.total > 0 && m.f2.total === 0).sort((a, b) => b.f1.total - a.f1.total || a.name.localeCompare(b.name, 'es'));
      const fBoth = sortedMuns.filter(m => m.f1.total > 0 && m.f2.total > 0).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      const f2Only = sortedMuns.filter(m => m.f2.total > 0 && m.f1.total === 0).sort((a, b) => b.f2.total - a.f2.total || a.name.localeCompare(b.name, 'es'));
      const stackedMunsOrdered = [...f1Only, ...fBoth, ...f2Only];

      const labels = stackedMunsOrdered.map((m) => m.name);
      const dataF1 = stackedMunsOrdered.map((m) => m.f1.total > 0 ? m.f1.total : null);
      const dataF2 = stackedMunsOrdered.map((m) => m.f2.total > 0 ? m.f2.total : null);

      // Etiquetas visibles directamente sobre las barras: Cantidad y Porcentaje de Avance
      const customLabelsF1 = stackedMunsOrdered.map((m) => m.f1.total > 0 ? `${m.f1.total} (${m.f1.avg.toFixed(1)}%)` : '');
      const customLabelsF2 = stackedMunsOrdered.map((m) => m.f2.total > 0 ? `${m.f2.total} (${m.f2.avg.toFixed(1)}%)` : '');

      chartMunicipiosStacked = new Chart(ctxStacked, {
        type: 'bar',
        plugins: [visibleBarLabelsPlugin],
        data: {
          labels,
          datasets: [
            {
              label: '🔵 Fase 1 (Baterías & % Avance)',
              data: dataF1,
              customLabels: customLabelsF1,
              backgroundColor: '#0284c7',
              borderRadius: 4
            },
            {
              label: '🟣 Fase 2 (Baterías & % Avance)',
              data: dataF2,
              customLabels: customLabelsF2,
              backgroundColor: '#8b5cf6',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { font: { size: 10, weight: '600' }, color: textColor, maxRotation: 45, minRotation: 0 },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { font: { size: 11 }, color: textColor },
              grid: { color: gridColor }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { boxWidth: 14, font: { size: 12, weight: '700' }, color: textColor }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const m = stackedMunsOrdered[ctx.dataIndex];
                  const faseInfo = ctx.datasetIndex === 0 ? m.f1 : m.f2;
                  const labelPrefix = ctx.datasetIndex === 0 ? '🔵 Fase 1' : '🟣 Fase 2';
                  if (faseInfo.total === 0) return null;
                  return [
                    ` ${labelPrefix}: ${faseInfo.total} baterías`,
                    `   📈 Avance Promedio: ${faseInfo.avg.toFixed(1)}%`,
                    `   🟢 Terminadas: ${faseInfo.terminadas}`,
                    `   🟠 En Ejecución: ${faseInfo.ejecucion}`,
                    `   ⚪ Sin Iniciar: ${faseInfo.sinIniciar}`
                  ];
                }
              }
            }
          }
        }
      });
    }

    // 9.5 Renderizar Analítica de las 13 Actividades Constructivas
    let actData = [];
    if (navigator.onLine) {
      try {
        const resAct = await fetch('/api/reportes/actividades-progreso');
        if (resAct.ok) {
          const jsonAct = await resAct.json();
          if (jsonAct.ok && Array.isArray(jsonAct.data)) actData = jsonAct.data;
        }
      } catch (e) {}
    }

    if (actData.length === 0) {
      // Fallback local con las 13 actividades oficiales
      const defaultActs = [
        { orden: 1, nombre: 'Preliminares', peso_porcentual: 0.169, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 2, nombre: 'Cimentación', peso_porcentual: 10.024, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 3, nombre: 'Mampostería', peso_porcentual: 3.608, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 4, nombre: 'Estructura', peso_porcentual: 8.490, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 5, nombre: 'Cubierta', peso_porcentual: 6.159, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 6, nombre: 'Instalaciones Sanitarias', peso_porcentual: 9.243, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 7, nombre: 'Instalaciones Hidráulicas', peso_porcentual: 6.813, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 8, nombre: 'Instalaciones Eléctricas', peso_porcentual: 1.965, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 9, nombre: 'Acabados - Pañetes', peso_porcentual: 12.000, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 10, nombre: 'Acabados - Enchapes', peso_porcentual: 5.058, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 11, nombre: 'Carpintería Metálica', peso_porcentual: 3.181, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 12, nombre: 'Tanques Sépticos', peso_porcentual: 29.617, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios },
        { orden: 13, nombre: 'Campo de Infiltración', peso_porcentual: 3.673, promedio_avance: 0, terminadas: 0, en_ejecucion: 0, sin_iniciar: totalBeneficiarios }
      ];
      actData = defaultActs;
    }

    // Gráfica de Barras Horizontales de 13 Actividades
    const canvasAct = document.getElementById('chart-actividades-dashboard');
    if (canvasAct && typeof Chart !== 'undefined') {
      const ctxAct = canvasAct.getContext('2d');
      if (chartActividadesDashboard) chartActividadesDashboard.destroy();
      const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkTheme ? '#cbd5e1' : '#475569';
      const gridColor = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

      const actLabels = actData.map((a) => `${a.orden}. ${a.nombre}`);
      const actValues = actData.map((a) => parseFloat(a.promedio_avance) || 0);

      chartActividadesDashboard = new Chart(ctxAct, {
        type: 'bar',
        data: {
          labels: actLabels,
          datasets: [{
            label: '% Avance Promedio',
            data: actValues,
            backgroundColor: actValues.map((v) => v >= 99.9 ? '#059669' : v > 0 ? '#ea580c' : '#94a3b8'),
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              max: 100,
              min: 0,
              ticks: { callback: (v) => v + '%', font: { size: 11 }, color: textColor },
              grid: { color: gridColor }
            },
            y: {
              ticks: { font: { size: 11, weight: '600' }, color: textColor },
              grid: { display: false }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` Avance Promedio: ${ctx.parsed.x}%`
              }
            }
          }
        }
      });
    }

    // Grid de Tarjetas Individuales de 13 Actividades
    const actGridEl = document.getElementById('dash-actividades-grid');
    if (actGridEl) {
      actGridEl.innerHTML = actData.map((act) => {
        const p = parseFloat(act.promedio_avance) || 0;
        let badgeColor = '#64748b';
        if (p >= 99.9) badgeColor = '#059669';
        else if (p > 0) badgeColor = '#ea580c';

        return `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.35rem; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.88rem; color: var(--text-primary);">${act.orden}. ${escapeHtml(act.nombre)}</strong>
                <span style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap;">${Number(act.peso_porcentual).toFixed(3)}% peso</span>
              </div>
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.6rem;">
                <span class="badge badge-status-terminado" style="font-size: 0.7rem; padding: 1px 5px;">🟢 ${act.terminadas || 0}</span>
                <span class="badge badge-status-ejecucion" style="font-size: 0.7rem; padding: 1px 5px;">🟠 ${act.en_ejecucion || 0}</span>
                <span class="badge badge-status-sin-iniciar" style="font-size: 0.7rem; padding: 1px 5px;">⚪ ${act.sin_iniciar || 0}</span>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px;">
                <span>Avance:</span>
                <span style="color: ${badgeColor}; font-weight: 800;">${p.toFixed(1)}%</span>
              </div>
              <div style="height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
                <div style="height: 100%; width: ${p}%; background: ${badgeColor};"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 10. Tabla Territorial Consolidada por Municipio
    const tbody = document.getElementById('dash-municipios-tbody');
    if (tbody) {
      if (sortedMuns.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Sin datos de municipios</td></tr>`;
      } else {
        tbody.innerHTML = sortedMuns.map((m) => {
          const pctSin = m.total > 0 ? ((m.sinIniciar / m.total) * 100).toFixed(1) : '0.0';
          const pctEjec = m.total > 0 ? ((m.ejecucion / m.total) * 100).toFixed(1) : '0.0';
          const pctTerm = m.total > 0 ? ((m.terminadas / m.total) * 100).toFixed(1) : '0.0';

          let generalBadge = 'badge-status-sin-iniciar';
          let generalLabel = '⚪ Sin Iniciar';
          if (m.avg >= 99.9 || m.terminadas === m.total) {
            generalBadge = 'badge-status-terminado';
            generalLabel = '🟢 Terminado';
          } else if (m.avg > 0 || m.ejecucion > 0 || m.terminadas > 0) {
            generalBadge = 'badge-status-ejecucion';
            generalLabel = '🟠 En Ejecución';
          }

          return `
            <tr>
              <td><strong style="color: var(--text-primary); font-size: 0.9rem;">🏛️ ${escapeHtml(m.name)}</strong></td>
              <td style="text-align: center;">
                <span style="font-weight: 700;">${m.total.toLocaleString('es-CO')}</span>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">
                  <span style="color: #0284c7; font-weight: 600;">F1: ${m.f1.total}</span> | <span style="color: #8b5cf6; font-weight: 600;">F2: ${m.f2.total}</span>
                </div>
              </td>
              <td style="text-align: center;">
                <span style="color: #64748b; font-weight: 600;">${m.sinIniciar}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">(${pctSin}%)</span>
              </td>
              <td style="text-align: center;">
                <span style="color: #ea580c; font-weight: 700;">${m.ejecucion}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">(${pctEjec}%)</span>
              </td>
              <td style="text-align: center;">
                <span style="color: #059669; font-weight: 700;">${m.terminadas}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">(${pctTerm}%)</span>
              </td>
              <td style="width: 175px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: bold; margin-bottom: 2px;">
                  <span>${m.avg.toFixed(1)}%</span>
                  <span style="font-size: 0.72rem; font-weight: normal; color: var(--text-muted);">
                    <span style="color: #0284c7; font-weight: 600;">F1: ${m.f1.avg.toFixed(1)}%</span> • <span style="color: #8b5cf6; font-weight: 600;">F2: ${m.f2.avg.toFixed(1)}%</span>
                  </span>
                </div>
                <div style="height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
                  <div style="height: 100%; width: ${m.avg}%; background: ${m.avg >= 99.9 ? '#059669' : m.avg > 0 ? '#ea580c' : '#64748b'};"></div>
                </div>
              </td>
              <td style="text-align: center;">
                <span class="badge ${generalBadge}" style="font-size: 0.75rem;">${generalLabel}</span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error al generar Dashboard Gerencial:', err);
  }
}

/* ==========================================================================
   MÓDULO DE REPORTES Y ANALÍTICA DINÁMICA CON MULTI-FILTRO
   ========================================================================== */
let reportBeneficiariosData = [];
let reportFilteredData = [];
let currentReportPage = 1;
const REPORT_PAGE_SIZE = 15;
let chartReportDonut = null;
let chartReportBar = null;
let chartReportActividades = null;
let chartReportVeredasMun = null;

async function loadReportesAdminPage() {
  const tbody = document.getElementById('report-table-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando módulo de reportes y analítica...</td></tr>`;
  }

  try {
    // 1. Obtener todos los beneficiarios del universo contractual (1399)
    const allBen = await window.dbManager.getBeneficiarios();

    // 2. Obtener todas las inspecciones para vincular avances y responsables
    let allInspections = [];
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/inspecciones?limit=3000');
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) allInspections = json.data;
        }
      } catch (e) {}
    }
    if (allInspections.length === 0) {
      allInspections = await window.dbManager.getPendingInspecciones();
    }

    // 3. Mapear última inspección por beneficiario
    const benInspMap = {};
    allInspections.forEach((insp) => {
      if (!benInspMap[insp.beneficiario_id]) {
        benInspMap[insp.beneficiario_id] = insp;
      }
    });

    // 4. Mapear inspectores asignados por zona
    let inspectorVeredasMap = {}; // vereda_id -> inspector_nombre
    try {
      const users = await window.dbManager.getAllUsers();
      if (Array.isArray(users)) {
        for (const u of users) {
          const zonas = await window.dbManager.getUserZonas(u.id);
          if (Array.isArray(zonas)) {
            zonas.forEach((z) => {
              inspectorVeredasMap[z.vereda_id] = u.nombre;
            });
          }
        }
      }
    } catch (e) {}

    // 5. Estructurar dataset enriquecido para reportes sobre los 1399
    reportBeneficiariosData = (allBen || []).map((b) => {
      const latestInsp = benInspMap[b.id];
      const avance = latestInsp ? parseFloat(latestInsp.avance_global) : 0;
      let estadoCalc = 'SIN_INICIAR';
      if (avance >= 99.9) estadoCalc = 'TERMINADO';
      else if (avance > 0) estadoCalc = 'EN_EJECUCION';

      const inspectorName = latestInsp?.inspector_nombre || inspectorVeredasMap[b.vereda_id] || 'Sin Asignar';

      return {
        id: b.id,
        nombre: b.nombre,
        documento: b.documento,
        municipio: b.municipio || 'Sin Municipio',
        vereda: b.vereda || 'Sin Vereda',
        fase: b.fase || '1',
        avance,
        estado: estadoCalc,
        inspector: inspectorName,
        actividadesScores: latestInsp?.actividadesScores || {},
        fecha_visita: latestInsp?.fecha_visita || null,
        fotosCount: latestInsp?.fotos ? (Array.isArray(latestInsp.fotos) ? latestInsp.fotos.length : JSON.parse(latestInsp.fotos || '[]').length) : 0,
        inspeccion_id: latestInsp?.id || null
      };
    });

    // 6. Poblar selectores de filtros
    populateReportFilterDropdowns();

    // 7. Aplicar filtros iniciales
    onReportFilterChange();
  } catch (err) {
    console.error('Error al inicializar Reportes Dinámicos:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 1.5rem;">Error al cargar reportes: ${err.message}</td></tr>`;
    }
  }
}

function populateReportFilterDropdowns() {
  const munSelect = document.getElementById('report-filter-municipio');
  if (munSelect) {
    const currentVal = munSelect.value;
    const munList = Array.from(new Set(reportBeneficiariosData.map((b) => b.municipio).filter(Boolean))).sort();
    munSelect.innerHTML = `<option value="">🏛️ Todos los Municipios</option>` +
      munList.map((m) => `<option value="${m}" ${currentVal === m ? 'selected' : ''}>${m}</option>`).join('');
  }

  const inspSelect = document.getElementById('report-filter-inspector');
  if (inspSelect) {
    const currentVal = inspSelect.value;
    const inspList = Array.from(new Set(reportBeneficiariosData.map((b) => b.inspector).filter((i) => i && i !== 'Sin Asignar'))).sort();
    inspSelect.innerHTML = `<option value="">👷 Todos los Inspectores</option>` +
      inspList.map((i) => `<option value="${i}" ${currentVal === i ? 'selected' : ''}>${i}</option>`).join('');
  }

  updateReportVeredasDropdown();
}

function updateReportVeredasDropdown() {
  const mun = document.getElementById('report-filter-municipio')?.value || '';
  const veredaSelect = document.getElementById('report-filter-vereda');
  if (!veredaSelect) return;

  const currentVal = veredaSelect.value;
  let pool = reportBeneficiariosData;
  if (mun) {
    pool = pool.filter((b) => b.municipio === mun);
  }

  const veredasList = Array.from(new Set(pool.map((b) => b.vereda).filter(Boolean))).sort();
  veredaSelect.innerHTML = `<option value="">🌲 Todas las Veredas</option>` +
    veredasList.map((v) => `<option value="${v}" ${currentVal === v ? 'selected' : ''}>${v}</option>`).join('');
}

window.onReportMunicipioChange = function () {
  updateReportVeredasDropdown();
  const munEl = document.getElementById('report-filter-municipio');
  const munSelect = document.getElementById('chart-veredas-municipio-select');
  if (munEl && munSelect && munEl.value) {
    munSelect.value = munEl.value;
  }
  onReportFilterChange();
};

window.resetReportFilters = function () {
  const searchEl = document.getElementById('report-filter-search');
  if (searchEl) searchEl.value = '';

  const faseEl = document.getElementById('report-filter-fase');
  if (faseEl) faseEl.value = '';

  const munEl = document.getElementById('report-filter-municipio');
  if (munEl) munEl.value = '';

  const verEl = document.getElementById('report-filter-vereda');
  if (verEl) verEl.value = '';

  const inspEl = document.getElementById('report-filter-inspector');
  if (inspEl) inspEl.value = '';

  const estEl = document.getElementById('report-filter-estado');
  if (estEl) estEl.value = '';

  const desdeEl = document.getElementById('report-filter-fecha-desde');
  if (desdeEl) desdeEl.value = '';

  const hastaEl = document.getElementById('report-filter-fecha-hasta');
  if (hastaEl) hastaEl.value = '';

  updateReportVeredasDropdown();
  onReportFilterChange();
};

window.onReportFilterChange = function () {
  const search = (document.getElementById('report-filter-search')?.value || '').toLowerCase().trim();
  const fase = document.getElementById('report-filter-fase')?.value || '';
  const mun = document.getElementById('report-filter-municipio')?.value || '';
  const vereda = document.getElementById('report-filter-vereda')?.value || '';
  const inspector = document.getElementById('report-filter-inspector')?.value || '';
  const estado = document.getElementById('report-filter-estado')?.value || '';
  const fDesde = document.getElementById('report-filter-fecha-desde')?.value || '';
  const fHasta = document.getElementById('report-filter-fecha-hasta')?.value || '';
  const sortOrder = document.getElementById('report-filter-order')?.value || 'AVANCE_DESC';

  // Filtrado reactivo multidimensional
  reportFilteredData = reportBeneficiariosData.filter((b) => {
    const matchSearch = !search ||
      (b.nombre && b.nombre.toLowerCase().includes(search)) ||
      (b.documento && b.documento.includes(search)) ||
      String(b.id) === search.replace(/^#/, '');

    const matchFase = !fase || String(b.fase) === String(fase);
    const matchMun = !mun || b.municipio === mun;
    const matchVer = !vereda || b.vereda === vereda;
    const matchInsp = !inspector || b.inspector === inspector;
    const matchEst = !estado || b.estado === estado;

    let matchFecha = true;
    if (fDesde || fHasta) {
      if (!b.fecha_visita) {
        matchFecha = false;
      } else {
        const vDate = b.fecha_visita.split('T')[0];
        if (fDesde && vDate < fDesde) matchFecha = false;
        if (fHasta && vDate > fHasta) matchFecha = false;
      }
    }

    return matchSearch && matchFase && matchMun && matchVer && matchInsp && matchEst && matchFecha;
  });

  // Ordenamiento inteligente: Por defecto las que tienen avance aparecen de PRIMERO
  reportFilteredData.sort((a, b) => {
    const avanceA = parseFloat(a.avance) || 0;
    const avanceB = parseFloat(b.avance) || 0;

    if (sortOrder === 'AVANCE_DESC') {
      // 1. Mayor avance primero
      if (avanceB !== avanceA) {
        return avanceB - avanceA;
      }
      // 2. Si tienen igual avance, fecha de visita más reciente primero
      if (a.fecha_visita && b.fecha_visita) {
        return new Date(b.fecha_visita) - new Date(a.fecha_visita);
      }
      if (a.fecha_visita) return -1;
      if (b.fecha_visita) return 1;
      return a.id - b.id;
    } else if (sortOrder === 'AVANCE_ASC') {
      return avanceA - avanceB;
    } else if (sortOrder === 'FECHA_DESC') {
      if (a.fecha_visita && b.fecha_visita) {
        return new Date(b.fecha_visita) - new Date(a.fecha_visita);
      }
      if (a.fecha_visita) return -1;
      if (b.fecha_visita) return 1;
      return a.id - b.id;
    } else if (sortOrder === 'NOMBRE_ASC') {
      return (a.nombre || '').localeCompare(b.nombre || '');
    }
    return a.id - b.id;
  });

  // 1. Recalcular KPIs Filtrados
  const total = reportFilteredData.length;
  const sinIniciar = reportFilteredData.filter((b) => b.estado === 'SIN_INICIAR').length;
  const ejecucion = reportFilteredData.filter((b) => b.estado === 'EN_EJECUCION').length;
  const terminadas = reportFilteredData.filter((b) => b.estado === 'TERMINADO').length;
  const sumAvance = reportFilteredData.reduce((acc, b) => acc + (b.avance || 0), 0);
  const avgAvance = total > 0 ? (sumAvance / total) : 0;

  const statTotalEl = document.getElementById('report-stat-total');
  if (statTotalEl) statTotalEl.textContent = total.toLocaleString('es-CO');

  const statSinEl = document.getElementById('report-stat-sininiciar');
  if (statSinEl) statSinEl.textContent = `${sinIniciar} (${total > 0 ? ((sinIniciar / total) * 100).toFixed(1) : 0}%)`;

  const statEjecEl = document.getElementById('report-stat-ejecucion');
  if (statEjecEl) statEjecEl.textContent = `${ejecucion} (${total > 0 ? ((ejecucion / total) * 100).toFixed(1) : 0}%)`;

  const statTermEl = document.getElementById('report-stat-terminadas');
  if (statTermEl) statTermEl.textContent = `${terminadas} (${total > 0 ? ((terminadas / total) * 100).toFixed(1) : 0}%)`;

  const statAvgEl = document.getElementById('report-stat-promedio');
  if (statAvgEl) statAvgEl.textContent = `${avgAvance.toFixed(2)}%`;

  // 2. Actualizar Tarjeta de Rendimiento de Inspector si aplica
  const inspCard = document.getElementById('report-inspector-summary-card');
  if (inspector && inspector !== 'Sin Asignar') {
    const inspTotal = reportFilteredData.length;
    const inspTerm = terminadas;
    const inspEjec = ejecucion;
    const inspSin = sinIniciar;
    const inspAvg = avgAvance;

    document.getElementById('report-inspector-nombre').textContent = inspector;
    document.getElementById('report-inspector-doc').textContent = `Filtro Activo • ${inspTotal} baterías asignadas`;
    document.getElementById('report-inspector-total').textContent = inspTotal;
    document.getElementById('report-inspector-term').textContent = inspTerm;
    document.getElementById('report-inspector-ejec').textContent = inspEjec;
    document.getElementById('report-inspector-sin').textContent = inspSin;
    document.getElementById('report-inspector-avg').textContent = `${inspAvg.toFixed(1)}%`;
    if (inspCard) inspCard.style.display = 'block';
  } else {
    if (inspCard) inspCard.style.display = 'none';
  }

  // 3. Renderizar Gráficas Dinámicas Filtradas
  renderReportCharts(total, sinIniciar, ejecucion, terminadas, mun, vereda, inspector);

  // 4. Renderizar Tabla y Paginación
  currentReportPage = 1;
  renderReportTable();
};

function renderReportCharts(total, sinIniciar, ejecucion, terminadas, selectedMun, selectedVereda, selectedInsp) {
  // Gráfica 1: Donut de Estados Filtrados
  const canvasDonut = document.getElementById('chart-report-donut');
  if (canvasDonut && typeof Chart !== 'undefined') {
    const ctxDonut = canvasDonut.getContext('2d');
    if (chartReportDonut) chartReportDonut.destroy();

    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    chartReportDonut = new Chart(ctxDonut, { plugins: [visibleDonutPercentagePlugin],
      type: 'doughnut',
      data: {
        labels: ['Sin Iniciar', 'En Ejecución', 'Terminadas'],
        datasets: [{
          data: [sinIniciar, ejecucion, terminadas],
          backgroundColor: ['#64748b', '#ea580c', '#059669'],
          borderWidth: 2,
          borderColor: isDarkTheme ? '#131b2e' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11, weight: '600' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${val} (${pct}%)`;
              }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  // Gráfica 2: Avance por Segmento (Vereda si hay municipio, o Municipio si es general)
  const canvasBar = document.getElementById('chart-report-bar');
  const titleEl = document.getElementById('chart-report-bar-title');
  if (canvasBar && typeof Chart !== 'undefined') {
    const ctxBar = canvasBar.getContext('2d');
    if (chartReportBar) chartReportBar.destroy();
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkTheme ? '#cbd5e1' : '#475569';
    const gridColor = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    let groupingKey = 'municipio';
    let titleText = '📊 Avance Promedio por Municipio';

    if (selectedMun) {
      groupingKey = 'vereda';
      titleText = `📊 Avance Promedio por Vereda (${selectedMun})`;
    } else if (selectedInsp) {
      groupingKey = 'vereda';
      titleText = `📊 Avance por Veredas del Inspector (${selectedInsp})`;
    }

    if (titleEl) titleEl.textContent = titleText;

    // Agrupar datos por la clave con desglose por Fase 1 y Fase 2
    const groupMap = {};
    reportFilteredData.forEach((b) => {
      const k = b[groupingKey] || 'Sin Definir';
      if (!groupMap[k]) {
        groupMap[k] = {
          total: 0, sum: 0,
          f1: { total: 0, sum: 0 },
          f2: { total: 0, sum: 0 }
        };
      }
      const avance = b.avance || 0;
      const faseKey = b.fase === 2 ? 'f2' : 'f1';

      groupMap[k].total++;
      groupMap[k].sum += avance;
      groupMap[k][faseKey].total++;
      groupMap[k][faseKey].sum += avance;
    });

    const sortedGroups = Object.entries(groupMap).map(([k, d]) => ({
      name: k,
      total: d.total,
      avg: d.total > 0 ? (d.sum / d.total) : 0,
      f1: {
        total: d.f1.total,
        avg: d.f1.total > 0 ? (d.f1.sum / d.f1.total) : 0
      },
      f2: {
        total: d.f2.total,
        avg: d.f2.total > 0 ? (d.f2.sum / d.f2.total) : 0
      }
    })).sort((a, b) => b.avg - a.avg).slice(0, 15);

    const labels = sortedGroups.map((g) => g.name);
    const dataAvgsF1 = sortedGroups.map((g) => parseFloat(g.f1.avg.toFixed(2)));
    const dataAvgsF2 = sortedGroups.map((g) => parseFloat(g.f2.avg.toFixed(2)));

    chartReportBar = new Chart(ctxBar, { plugins: [visibleBarLabelsPlugin],
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '🔵 Fase 1 (% Avance)',
            data: dataAvgsF1,
            backgroundColor: '#0284c7',
            borderRadius: 3
          },
          {
            label: '🟣 Fase 2 (% Avance)',
            data: dataAvgsF2,
            backgroundColor: '#8b5cf6',
            borderRadius: 3
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { max: 100, min: 0, ticks: { callback: (v) => v + '%', font: { size: 10 }, color: textColor }, grid: { color: gridColor } },
          y: { ticks: { font: { size: 11, weight: '600' }, color: textColor }, grid: { display: false } }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { boxWidth: 12, font: { size: 11, weight: '600' }, color: textColor }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const g = sortedGroups[ctx.dataIndex];
                if (ctx.datasetIndex === 0) {
                  return ` 🔵 Fase 1: ${ctx.parsed.x}% (${g.f1.total} baterías)`;
                } else {
                  return ` 🟣 Fase 2: ${ctx.parsed.x}% (${g.f2.total} baterías)`;
                }
              }
            }
          }
        }
      }
    });
  }

  // Gráfica 3 y Grid de las 13 Actividades Constructivas en Reportes
  const canvasAct = document.getElementById('chart-report-actividades');
  const gridAct = document.getElementById('report-actividades-grid');

  if (canvasAct || gridAct) {
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkTheme ? '#cbd5e1' : '#475569';
    const gridColor = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    const defaultActs = [
      { id: 1, orden: 1, nombre: 'Preliminares', peso_porcentual: 0.169 },
      { id: 2, orden: 2, nombre: 'Cimentación', peso_porcentual: 10.024 },
      { id: 3, orden: 3, nombre: 'Mampostería', peso_porcentual: 3.608 },
      { id: 4, orden: 4, nombre: 'Estructura', peso_porcentual: 8.490 },
      { id: 5, orden: 5, nombre: 'Cubierta', peso_porcentual: 6.159 },
      { id: 6, orden: 6, nombre: 'Instalaciones Sanitarias', peso_porcentual: 9.243 },
      { id: 7, orden: 7, nombre: 'Instalaciones Hidráulicas', peso_porcentual: 6.813 },
      { id: 8, orden: 8, nombre: 'Instalaciones Eléctricas', peso_porcentual: 1.965 },
      { id: 9, orden: 9, nombre: 'Acabados - Pañetes', peso_porcentual: 12.000 },
      { id: 10, orden: 10, nombre: 'Acabados - Enchapes', peso_porcentual: 5.058 },
      { id: 11, orden: 11, nombre: 'Carpintería Metálica', peso_porcentual: 3.181 },
      { id: 12, orden: 12, nombre: 'Tanques Sépticos', peso_porcentual: 29.617 },
      { id: 13, orden: 13, nombre: 'Campo de Infiltración', peso_porcentual: 3.673 }
    ];

    const actReportData = defaultActs.map((act) => {
      let sumPct = 0;
      let countTerm = 0;
      let countEjec = 0;
      let countSin = 0;

      reportFilteredData.forEach((b) => {
        let score = 0;
        if (b.actividadesScores && b.actividadesScores[act.id] !== undefined) {
          score = parseInt(b.actividadesScores[act.id], 10) || 0;
        }

        sumPct += score;
        if (score >= 99.9) countTerm++;
        else if (score > 0) countEjec++;
        else countSin++;
      });

      const avg = total > 0 ? (sumPct / total) : 0;
      return {
        ...act,
        avg: parseFloat(avg.toFixed(2)),
        terminadas: countTerm,
        en_ejecucion: countEjec,
        sin_iniciar: countSin
      };
    });

    if (canvasAct && typeof Chart !== 'undefined') {
      const ctxAct = canvasAct.getContext('2d');
      if (chartReportActividades) chartReportActividades.destroy();

      chartReportActividades = new Chart(ctxAct, { plugins: [visibleBarLabelsPlugin],
        type: 'bar',
        data: {
          labels: actReportData.map((a) => `${a.orden}. ${a.nombre}`),
          datasets: [{
            label: '% Avance Promedio',
            data: actReportData.map((a) => a.avg),
            backgroundColor: actReportData.map((a) => a.avg >= 99.9 ? '#059669' : a.avg > 0 ? '#ea580c' : '#94a3b8'),
            borderRadius: 3
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { max: 100, min: 0, ticks: { callback: (v) => v + '%', font: { size: 10 }, color: textColor }, grid: { color: gridColor } },
            y: { ticks: { font: { size: 11, weight: '600' }, color: textColor }, grid: { display: false } }
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` Avance: ${ctx.parsed.x}%` } }
          }
        }
      });
    }

    if (gridAct) {
      gridAct.innerHTML = actReportData.map((act) => {
        let badgeColor = '#64748b';
        if (act.avg >= 99.9) badgeColor = '#059669';
        else if (act.avg > 0) badgeColor = '#ea580c';

        return `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.35rem; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.88rem; color: var(--text-primary);">${act.orden}. ${escapeHtml(act.nombre)}</strong>
                <span style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap;">${Number(act.peso_porcentual).toFixed(3)}% peso</span>
              </div>
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.6rem;">
                <span class="badge badge-status-terminado" style="font-size: 0.7rem; padding: 1px 5px;">🟢 ${act.terminadas}</span>
                <span class="badge badge-status-ejecucion" style="font-size: 0.7rem; padding: 1px 5px;">🟠 ${act.en_ejecucion}</span>
                <span class="badge badge-status-sin-iniciar" style="font-size: 0.7rem; padding: 1px 5px;">⚪ ${act.sin_iniciar}</span>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px;">
                <span>Avance:</span>
                <span style="color: ${badgeColor}; font-weight: 800;">${act.avg.toFixed(1)}%</span>
              </div>
              <div style="height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
                <div style="height: 100%; width: ${act.avg}%; background: ${badgeColor};"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Gráfica 4: Avance Detallado por Veredas de cada Municipio
  renderVeredasMunicipioChart(selectedMun);
}

window.onVeredasMunicipioChartChange = function () {
  renderVeredasMunicipioChart();
};

function renderVeredasMunicipioChart(preselectedMun = null) {
  const munSelect = document.getElementById('chart-veredas-municipio-select');
  const canvas = document.getElementById('chart-report-veredas-mun');
  const wrapper = document.getElementById('chart-report-veredas-mun-wrapper');
  const kpiContainer = document.getElementById('veredas-mun-kpi-summary');
  const gridContainer = document.getElementById('report-veredas-grid');

  if (!munSelect || !reportBeneficiariosData.length) return;

  // 1. Obtener lista única de municipios con beneficiarios
  const munList = Array.from(new Set(reportBeneficiariosData.map((b) => b.municipio).filter(Boolean))).sort();
  if (munList.length === 0) return;

  const currentSelectVal = munSelect.value;
  const targetMun = preselectedMun || currentSelectVal || munList[0];

  // Poblar select si es necesario
  if (munSelect.options.length !== munList.length) {
    munSelect.innerHTML = munList
      .map((m) => `<option value="${m}" ${m === targetMun ? 'selected' : ''}>🏛️ ${m}</option>`)
      .join('');
  } else if (preselectedMun && munSelect.value !== preselectedMun) {
    munSelect.value = preselectedMun;
  }

  const selectedMun = munSelect.value || targetMun;

  // 2. Filtrar beneficiarios del municipio
  const munBeneficiarios = reportBeneficiariosData.filter((b) => b.municipio === selectedMun);

  // 3. Agrupar datos por Vereda
  const veredasMap = {};
  munBeneficiarios.forEach((b) => {
    const vName = b.vereda || 'Sin Vereda';
    if (!veredasMap[vName]) {
      veredasMap[vName] = {
        nombre: vName,
        total: 0,
        terminadas: 0,
        en_ejecucion: 0,
        sin_iniciar: 0,
        sumAvance: 0,
        inspectores: new Set()
      };
    }
    const item = veredasMap[vName];
    item.total++;
    const av = parseFloat(b.avance) || 0;
    item.sumAvance += av;
    if (b.estado === 'TERMINADO' || av >= 99.9) {
      item.terminadas++;
    } else if (b.estado === 'EN_EJECUCION' || av > 0) {
      item.en_ejecucion++;
    } else {
      item.sin_iniciar++;
    }
    if (b.inspector && b.inspector !== 'Sin Asignar') {
      item.inspectores.add(b.inspector);
    }
  });

  const veredasList = Object.values(veredasMap).map((v) => ({
    ...v,
    avg: v.total > 0 ? (v.sumAvance / v.total) : 0,
    inspectoresArr: Array.from(v.inspectores)
  })).sort((a, b) => b.avg - a.avg || b.total - a.total);

  // Métricas generales del municipio
  const totalMunBat = munBeneficiarios.length;
  const sumMunAvance = munBeneficiarios.reduce((acc, b) => acc + (parseFloat(b.avance) || 0), 0);
  const avgMunAvance = totalMunBat > 0 ? (sumMunAvance / totalMunBat) : 0;
  const termMun = munBeneficiarios.filter((b) => b.estado === 'TERMINADO' || (parseFloat(b.avance) || 0) >= 99.9).length;
  const ejecMun = munBeneficiarios.filter((b) => (b.estado === 'EN_EJECUCION' || (parseFloat(b.avance) || 0) > 0) && (parseFloat(b.avance) || 0) < 99.9).length;
  const sinMun = munBeneficiarios.filter((b) => b.estado === 'SIN_INICIAR' || (parseFloat(b.avance) || 0) === 0).length;

  // 4. Renderizar Resumen de KPI del Municipio
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Veredas</div>
        <strong style="font-size: 1.15rem; color: var(--text-primary);">${veredasList.length}</strong>
      </div>
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Baterías</div>
        <strong style="font-size: 1.15rem; color: var(--text-primary);">${totalMunBat}</strong>
      </div>
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; text-align: center;">
        <div style="font-size: 0.7rem; color: var(--primary); font-weight: 700; text-transform: uppercase;">Avance Promedio</div>
        <strong style="font-size: 1.15rem; color: var(--primary);">${avgMunAvance.toFixed(1)}%</strong>
      </div>
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; text-align: center;">
        <div style="font-size: 0.7rem; color: #059669; font-weight: 700; text-transform: uppercase;">🟢 Terminadas</div>
        <strong style="font-size: 1.15rem; color: #059669;">${termMun}</strong>
      </div>
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; text-align: center;">
        <div style="font-size: 0.7rem; color: #ea580c; font-weight: 700; text-transform: uppercase;">🟠 En Ejecución</div>
        <strong style="font-size: 1.15rem; color: #ea580c;">${ejecMun}</strong>
      </div>
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; text-align: center;">
        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">⚪ Sin Iniciar</div>
        <strong style="font-size: 1.15rem; color: #64748b;">${sinMun}</strong>
      </div>
    `;
  }

  // 5. Renderizar Gráfica de Barras de Veredas
  if (canvas && typeof Chart !== 'undefined') {
    const ctx = canvas.getContext('2d');
    if (chartReportVeredasMun) chartReportVeredasMun.destroy();

    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDarkTheme ? '#cbd5e1' : '#475569';
    const gridColor = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    const dynamicHeight = Math.max(260, veredasList.length * 32);
    if (wrapper) wrapper.style.height = `${dynamicHeight}px`;

    const labels = veredasList.map((v) => `${v.nombre} (${v.total} bat.)`);
    const avgs = veredasList.map((v) => parseFloat(v.avg.toFixed(1)));
    const bgColors = veredasList.map((v) => v.avg >= 99.9 ? '#059669' : v.avg > 0 ? '#ea580c' : '#94a3b8');

    chartReportVeredasMun = new Chart(ctx, { plugins: [visibleBarLabelsPlugin],
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '% Avance Promedio',
          data: avgs,
          backgroundColor: bgColors,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            max: 100,
            min: 0,
            ticks: { callback: (val) => val + '%', font: { size: 10 }, color: textColor },
            grid: { color: gridColor }
          },
          y: {
            ticks: { font: { size: 11, weight: '600' }, color: textColor },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const v = veredasList[idx];
                return [
                  ` % Avance Promedio: ${ctx.parsed.x}%`,
                  ` Total Baterías: ${v.total}`,
                  ` Terminadas: ${v.terminadas} | En Ejecución: ${v.en_ejecucion} | Sin Iniciar: ${v.sin_iniciar}`,
                  ` Inspector(es): ${v.inspectoresArr.join(', ') || 'Sin Asignar'}`
                ];
              }
            }
          }
        }
      }
    });
  }

  // 6. Renderizar Grid de Tarjetas Individuales por Vereda
  if (gridContainer) {
    gridContainer.innerHTML = veredasList.map((v) => {
      let badgeColor = '#64748b';
      let statusIcon = '⚪';
      if (v.avg >= 99.9) {
        badgeColor = '#059669';
        statusIcon = '🟢';
      } else if (v.avg > 0) {
        badgeColor = '#ea580c';
        statusIcon = '🟠';
      }

      return `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.85rem; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.35rem; margin-bottom: 0.35rem;">
              <strong style="font-size: 0.88rem; color: var(--text-primary);">🌲 ${escapeHtml(v.nombre)}</strong>
              <span style="font-size: 0.72rem; font-weight: 700; color: var(--primary); background: var(--bg-subtle); padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${v.total} bat.</span>
            </div>
            
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(v.inspectoresArr.join(', ') || 'Sin Asignar')}">
              👷 ${escapeHtml(v.inspectoresArr.join(', ') || 'Sin Asignar')}
            </div>

            <div style="display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.6rem;">
              <span class="badge badge-status-terminado" style="font-size: 0.68rem; padding: 1px 5px;">🟢 ${v.terminadas}</span>
              <span class="badge badge-status-ejecucion" style="font-size: 0.68rem; padding: 1px 5px;">🟠 ${v.en_ejecucion}</span>
              <span class="badge badge-status-sin-iniciar" style="font-size: 0.68rem; padding: 1px 5px;">⚪ ${v.sin_iniciar}</span>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 3px;">
              <span>Avance Vereda:</span>
              <span style="color: ${badgeColor}; font-weight: 800;">${v.avg.toFixed(1)}%</span>
            </div>
            <div style="height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
              <div style="height: 100%; width: ${v.avg}%; background: ${badgeColor}; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderReportTable() {
  const tbody = document.getElementById('report-table-tbody');
  const countBadge = document.getElementById('report-table-count-badge');
  const paginationInfo = document.getElementById('pagination-report-info');
  const paginationControls = document.getElementById('pagination-report-controls');
  if (!tbody) return;

  const total = reportFilteredData.length;
  if (countBadge) countBadge.textContent = `${total.toLocaleString('es-CO')} registros encontrados`;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No se encontraron registros de obras con los filtros seleccionados.
        </td>
      </tr>
    `;
    if (paginationInfo) paginationInfo.textContent = 'Mostrando 0 registros';
    if (paginationControls) paginationControls.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / REPORT_PAGE_SIZE);
  if (currentReportPage > totalPages) currentReportPage = totalPages;

  const start = (currentReportPage - 1) * REPORT_PAGE_SIZE;
  const end = Math.min(start + REPORT_PAGE_SIZE, total);
  const pageItems = reportFilteredData.slice(start, end);

  tbody.innerHTML = pageItems
    .map((b) => {
      const pct = b.avance || 0;
      let badgeClass = 'badge-status-sin-iniciar';
      let statusLabel = '⚪ Sin Iniciar';
      if (b.estado === 'TERMINADO' || pct >= 99.9) {
        badgeClass = 'badge-status-terminado';
        statusLabel = '🟢 Terminado';
      } else if (pct > 0) {
        badgeClass = 'badge-status-ejecucion';
        statusLabel = '🟠 En Ejecución';
      }

      const fechaStr = b.fecha_visita
        ? new Date(b.fecha_visita).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : 'Sin Visita';

      return `
        <tr>
          <td style="font-weight: bold; color: var(--text-muted);">#${b.id}</td>
          <td>
            <strong style="color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(b.nombre)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">CC: <code>${escapeHtml(b.documento)}</code></div>
          </td>
          <td>
            <div style="font-size: 0.82rem; font-weight: 600;">${escapeHtml(b.municipio)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(b.vereda)} (Fase ${b.fase})</div>
          </td>
          <td>
            <span style="font-size: 0.82rem; font-weight: 500;">👷 ${escapeHtml(b.inspector)}</span>
          </td>
          <td style="width: 130px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: bold; margin-bottom: 2px;">
              <span>${pct.toFixed(1)}%</span>
            </div>
            <div style="height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color);">
              <div style="height: 100%; width: ${pct}%; background: ${pct >= 99.9 ? '#059669' : pct > 0 ? '#ea580c' : '#64748b'};"></div>
            </div>
          </td>
          <td>
            <span class="badge ${badgeClass}" style="font-size: 0.75rem;">${statusLabel}</span>
          </td>
          <td style="text-align: center; font-size: 0.78rem; color: var(--text-secondary); white-space: nowrap;">
            ${fechaStr}
            ${b.fotosCount > 0 ? `<div style="font-size: 0.7rem; color: var(--primary);">📷 ${b.fotosCount} fotos</div>` : ''}
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="openBeneficiarioHistorialModal(${b.id})" style="font-size: 0.78rem; padding: 3px 8px;">
              👁️ Historial
            </button>
            <button class="btn btn-sm" onclick="openFichaTecnicaForBeneficiario(${b.id})" style="padding: 3px 8px; font-size: 0.75rem; margin-left: 4px; color: #ffffff; background: #dc2626; border: 1px solid #b91c1c; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;" title="Ver y descargar Ficha Técnica PDF">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v4zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg> Ficha Técnica
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  if (paginationInfo) {
    paginationInfo.textContent = `Mostrando ${start + 1} - ${end} de ${total} registros`;
  }

  renderReportPagination(totalPages);
}

function renderReportPagination(totalPages) {
  const container = document.getElementById('pagination-report-controls');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="pagination-btn pagination-prev-btn" ${currentReportPage === 1 ? 'disabled' : ''} onclick="changeReportPage(${currentReportPage - 1})" title="Página anterior">
      ◀
    </button>
  `;

  const isMobile = window.innerWidth <= 640;
  const windowSize = isMobile ? 1 : 2;
  const startPage = Math.max(1, currentReportPage - windowSize);
  const endPage = Math.min(totalPages, currentReportPage + windowSize);

  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="changeReportPage(1)">1</button>`;
    if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `
      <button class="pagination-btn ${p === currentReportPage ? 'active' : ''}" onclick="changeReportPage(${p})">
        ${p}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
    html += `<button class="pagination-btn" onclick="changeReportPage(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="pagination-btn pagination-next-btn" ${currentReportPage === totalPages ? 'disabled' : ''} onclick="changeReportPage(${currentReportPage + 1})" title="Página siguiente">
      ▶
    </button>
  `;

  container.innerHTML = html;
}

window.changeReportPage = function (newPage) {
  currentReportPage = newPage;
  renderReportTable();
};

window.exportReportToCSV = function () {
  let dataset = reportFilteredData;
  if (!dataset || dataset.length === 0) {
    dataset = reportBeneficiariosData;
  }

  if (!dataset || dataset.length === 0) {
    showToast('No hay registros disponibles para exportar', 'warning');
    return;
  }

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Reporte Baterías</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #64748b; padding: 8px; font-family: Calibri, sans-serif; font-size: 11pt; }
        td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10.5pt; font-family: Calibri, sans-serif; }
        .text-center { text-align: center; }
        .badge-sin { background-color: #f1f5f9; color: #475569; font-weight: bold; }
        .badge-ejec { background-color: #ffedd5; color: #c2410c; font-weight: bold; }
        .badge-term { background-color: #dcfce7; color: #15803d; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Beneficiario</th>
            <th>Documento (CC)</th>
            <th>Municipio</th>
            <th>Vereda</th>
            <th>Fase</th>
            <th>Inspector Asignado</th>
            <th>% Avance Global</th>
            <th>Estado Constructivo</th>
            <th>Fecha Última Visita</th>
            <th>1. Preliminares (0.169%)</th>
            <th>2. Cimentación (10.024%)</th>
            <th>3. Mampostería (3.608%)</th>
            <th>4. Estructura (8.490%)</th>
            <th>5. Cubierta (6.159%)</th>
            <th>6. Inst. Sanitarias (9.243%)</th>
            <th>7. Inst. Hidráulicas (6.813%)</th>
            <th>8. Inst. Eléctricas (1.965%)</th>
            <th>9. Pañetes (12.000%)</th>
            <th>10. Enchapes (5.058%)</th>
            <th>11. Carpintería (3.181%)</th>
            <th>12. Tanques Sépticos (29.617%)</th>
            <th>13. Campo Infiltración (3.673%)</th>
          </tr>
        </thead>
        <tbody>
          ${dataset.map((b) => {
            const scores = b.actividadesScores || {};
            let estadoClass = 'badge-sin';
            let estadoLabel = 'Sin Iniciar';
            if (b.estado === 'TERMINADO' || (b.avance && b.avance >= 99.9)) {
              estadoClass = 'badge-term';
              estadoLabel = 'Terminado';
            } else if (b.estado === 'EN_EJECUCION' || (b.avance && b.avance > 0)) {
              estadoClass = 'badge-ejec';
              estadoLabel = 'En Ejecución';
            }

            return `
              <tr>
                <td class="text-center">${b.id}</td>
                <td><strong>${escapeHtml(b.nombre || '')}</strong></td>
                <td class="text-center" style="mso-number-format:'\\@';">${escapeHtml(b.documento || '')}</td>
                <td>${escapeHtml(b.municipio || '')}</td>
                <td>${escapeHtml(b.vereda || '')}</td>
                <td class="text-center">${escapeHtml(b.fase || '1')}</td>
                <td>${escapeHtml(b.inspector || 'Sin Asignar')}</td>
                <td class="text-center" style="font-weight: bold;">${Number(b.avance || 0).toFixed(2)}%</td>
                <td class="text-center ${estadoClass}">${estadoLabel}</td>
                <td class="text-center">${b.fecha_visita ? new Date(b.fecha_visita).toLocaleString('es-CO') : 'Sin Visita'}</td>
                <td class="text-center">${scores[1] !== undefined ? scores[1] + '%' : '0%'}</td>
                <td class="text-center">${scores[2] !== undefined ? scores[2] + '%' : '0%'}</td>
                <td class="text-center">${scores[3] !== undefined ? scores[3] + '%' : '0%'}</td>
                <td class="text-center">${scores[4] !== undefined ? scores[4] + '%' : '0%'}</td>
                <td class="text-center">${scores[5] !== undefined ? scores[5] + '%' : '0%'}</td>
                <td class="text-center">${scores[6] !== undefined ? scores[6] + '%' : '0%'}</td>
                <td class="text-center">${scores[7] !== undefined ? scores[7] + '%' : '0%'}</td>
                <td class="text-center">${scores[8] !== undefined ? scores[8] + '%' : '0%'}</td>
                <td class="text-center">${scores[9] !== undefined ? scores[9] + '%' : '0%'}</td>
                <td class="text-center">${scores[10] !== undefined ? scores[10] + '%' : '0%'}</td>
                <td class="text-center">${scores[11] !== undefined ? scores[11] + '%' : '0%'}</td>
                <td class="text-center">${scores[12] !== undefined ? scores[12] + '%' : '0%'}</td>
                <td class="text-center">${scores[13] !== undefined ? scores[13] + '%' : '0%'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Reporte_Baterias_Sanitarias_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('✅ Archivo Excel descargado con éxito', 'success');
};

async function loadAdminDashboard() {
  const currentUser = window.authService.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol_id === 1);

  const canViewDashboard = window.authService.hasPermission('VER_DASHBOARD') || window.authService.hasPermission('VER_PANEL_ADMIN') || isSuperAdmin;
  const canViewReportes = window.authService.hasPermission('VER_REPORTES') || isSuperAdmin;
  const canViewInspectores = window.authService.hasPermission('GESTIONAR_INSPECTORES') || window.authService.hasPermission('EDITAR_PIN_INSPECTOR') || isSuperAdmin;
  const canViewBeneficiarios = window.authService.hasPermission('VER_BENEFICIARIOS') || window.authService.hasPermission('VER_PANEL_ADMIN') || isSuperAdmin;
  const canViewInspecciones = window.authService.hasPermission('VER_INSPECCIONES') || window.authService.hasPermission('VER_REGISTROS_GLOBALES') || isSuperAdmin;
  const canManageRoles = window.authService.hasPermission('GESTIONAR_ROLES') || isSuperAdmin;
  const canManageInspectors = window.authService.hasPermission('GESTIONAR_INSPECTORES') || isSuperAdmin;

  // 1. Mostrar / Ocultar botones de cada pestaña según permisos
  const tabDashboardBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-dashboard"]');
  const tabReportesBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-reportes"]');
  const tabInspectoresBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-inspectores"]');
  const tabBeneficiariosBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-beneficiarios"]');
  const tabInspeccionesBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-inspecciones"]');
  const tabPermisosBtn = document.querySelector('.admin-tabs button[data-tab="admin-tab-permisos"]');

  if (tabDashboardBtn) tabDashboardBtn.style.display = canViewDashboard ? 'inline-flex' : 'none';
  if (tabReportesBtn) tabReportesBtn.style.display = canViewReportes ? 'inline-flex' : 'none';
  if (tabInspectoresBtn) tabInspectoresBtn.style.display = canViewInspectores ? 'inline-flex' : 'none';
  if (tabBeneficiariosBtn) tabBeneficiariosBtn.style.display = canViewBeneficiarios ? 'inline-flex' : 'none';
  if (tabInspeccionesBtn) tabInspeccionesBtn.style.display = canViewInspecciones ? 'inline-flex' : 'none';
  if (tabPermisosBtn) tabPermisosBtn.style.display = canManageRoles ? 'inline-flex' : 'none';

  // 2. Mostrar/Ocultar botón + Nuevo Inspector
  const btnCreateInspector = document.querySelector('button[onclick="openCreateInspectorModal()"]');
  if (btnCreateInspector) {
    btnCreateInspector.style.display = canManageInspectors ? 'inline-flex' : 'none';
  }

  // 3. Seleccionar la primera pestaña visible permitida
  document.querySelectorAll('.admin-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-pane').forEach((p) => (p.style.display = 'none'));

  if (canViewDashboard && tabDashboardBtn) {
    tabDashboardBtn.classList.add('active');
    document.getElementById('admin-tab-dashboard').style.display = 'block';
    await renderExecutiveDashboard();
  } else if (canViewReportes && tabReportesBtn) {
    tabReportesBtn.classList.add('active');
    document.getElementById('admin-tab-reportes').style.display = 'block';
    await loadReportesAdminPage();
  } else if (canViewInspectores && tabInspectoresBtn) {
    tabInspectoresBtn.classList.add('active');
    document.getElementById('admin-tab-inspectores').style.display = 'block';
    await loadInspectorsTable();
  } else if (canViewBeneficiarios && tabBeneficiariosBtn) {
    tabBeneficiariosBtn.classList.add('active');
    document.getElementById('admin-tab-beneficiarios').style.display = 'block';
    await loadBeneficiariosDashboard();
  } else if (canViewInspecciones && tabInspeccionesBtn) {
    tabInspeccionesBtn.classList.add('active');
    document.getElementById('admin-tab-inspecciones').style.display = 'block';
    await loadInspeccionesAdminPage();
  } else if (canManageRoles && tabPermisosBtn) {
    tabPermisosBtn.classList.add('active');
    document.getElementById('admin-tab-permisos').style.display = 'block';
    await loadRolesAndPermissions();
  }
}

/* ==========================================================================
   MONITOR INTEGRAL DE ACTIVIDAD DIARIA Y COBERTURA TERRITORIAL
   ========================================================================== */
let currentInspectoresActivityList = [];

window.resetInspActivityFilters = function () {
  const inspEl = document.getElementById('insp-act-filter-inspector');
  if (inspEl) inspEl.value = '';
  const munEl = document.getElementById('insp-act-filter-municipio');
  if (munEl) munEl.value = '';
  const verEl = document.getElementById('insp-act-filter-vereda');
  if (verEl) verEl.value = '';

  const dateInput = document.getElementById('insp-activity-date');
  if (dateInput) dateInput.value = '';

  loadInspectoresActivityData();
};

async function enrichInspectoresActivityData(data, targetDate) {
  const allBeneficiarios = typeof window.dbManager.getBeneficiarios === 'function' ? await window.dbManager.getBeneficiarios() : (reportBeneficiariosData || []);
  const allInspections = typeof window.dbManager.getInspecciones === 'function' ? await window.dbManager.getInspecciones() : [];
  const allMuns = typeof window.dbManager.getMunicipios === 'function' ? await window.dbManager.getMunicipios() : [];
  const allVers = typeof window.dbManager.getVeredas === 'function' ? await window.dbManager.getVeredas() : [];

  const munNameMap = {};
  allMuns.forEach((m) => { munNameMap[m.id] = m.nombre; });
  const verNameMap = {};
  allVers.forEach((v) => { verNameMap[v.id] = { nombre: v.nombre, municipio_id: v.municipio_id }; });

  // Mapa de censo total por cada municipio y vereda
  const censoMap = {};
  allBeneficiarios.forEach((b) => {
    if (b.estado == 1 && b.municipio && b.vereda) {
      const k = `${b.municipio.trim().toUpperCase()}__${b.vereda.trim().toUpperCase()}`;
      if (!censoMap[k]) {
        censoMap[k] = {
          municipio: b.municipio.trim(),
          vereda: b.vereda.trim(),
          total: 0,
          inspectores: new Set()
        };
      }
      censoMap[k].total++;
      if (b.inspector) censoMap[k].inspectores.add(b.inspector.trim().toLowerCase());
    }
  });

  for (const insp of data) {
    const inspNameNorm = (insp.nombre || '').trim().toLowerCase();

    // 1. Obtener todas las visitas del inspector para la fecha/período
    let visitas = Array.isArray(insp.visitas_periodo) ? insp.visitas_periodo : [];
    if (visitas.length === 0 && allInspections.length > 0) {
      visitas = allInspections.filter((i) => {
        if (i.inspector_id != insp.id) return false;
        if (targetDate === 'all') return true;
        if (!i.fecha_visita) return false;
        return i.fecha_visita.split('T')[0] === targetDate;
      }).map((i) => {
        const b = allBeneficiarios.find((x) => x.id === i.beneficiario_id);
        return {
          ...i,
          beneficiario_nombre: b?.nombre || 'Beneficiario',
          beneficiario_documento: b?.documento || '',
          municipio: b?.municipio || i.municipio || '',
          vereda: b?.vereda || i.vereda || ''
        };
      });
    }

    // 2. Determinar todas las veredas y municipios del inspector
    const veredasMap = {};

    // A. Consultar asignaciones oficiales de zonas desde IndexedDB / API (ej: las 13 veredas)
    try {
      const assignedZonasDB = typeof window.dbManager.getUserZonas === 'function' ? await window.dbManager.getUserZonas(insp.id) : [];
      if (Array.isArray(assignedZonasDB)) {
        assignedZonasDB.forEach((z) => {
          const mId = z.municipio_id || verNameMap[z.vereda_id]?.municipio_id;
          const munName = z.municipio || munNameMap[mId] || '';
          const verName = z.vereda || verNameMap[z.vereda_id]?.nombre || '';
          if (munName && verName) {
            const k = `${munName.trim().toUpperCase()}__${verName.trim().toUpperCase()}`;
            const censoInfo = censoMap[k] || { total: z.total_baterias || 0 };
            veredasMap[k] = {
              municipio: munName.trim(),
              vereda: verName.trim(),
              total_baterias: censoInfo.total || z.total_baterias || 0,
              visitas_en_periodo: 0,
              baterias_visitadas_periodo: 0,
              cubierta_en_periodo: false,
              asignada_formal: true
            };
          }
        });
      }
    } catch (e) {
      console.log('Error al obtener zonas asignadas del inspector:', e.message);
    }

    // B. Desde zonas_asignadas recibidas del servidor si aún no estaban
    if (Array.isArray(insp.zonas_asignadas)) {
      insp.zonas_asignadas.forEach((z) => {
        if (z.municipio && z.vereda) {
          const k = `${z.municipio.trim().toUpperCase()}__${z.vereda.trim().toUpperCase()}`;
          if (!veredasMap[k]) {
            const censoInfo = censoMap[k] || { total: z.total_baterias || 0 };
            veredasMap[k] = {
              municipio: z.municipio.trim(),
              vereda: z.vereda.trim(),
              total_baterias: censoInfo.total || z.total_baterias || 0,
              visitas_en_periodo: 0,
              baterias_visitadas_periodo: 0,
              cubierta_en_periodo: false,
              asignada_formal: true
            };
          }
        }
      });
    }

    // C. Desde visitas registradas (para veredas que visite fuera de su asignación)
    visitas.forEach((v) => {
      if (v.municipio && v.vereda) {
        const k = `${v.municipio.trim().toUpperCase()}__${v.vereda.trim().toUpperCase()}`;
        if (!veredasMap[k]) {
          const censoInfo = censoMap[k] || { total: 0 };
          veredasMap[k] = {
            municipio: v.municipio.trim(),
            vereda: v.vereda.trim(),
            total_baterias: censoInfo.total || 0,
            visitas_en_periodo: 0,
            baterias_visitadas_periodo: 0,
            cubierta_en_periodo: false,
            asignada_formal: false
          };
        }
      }
    });

    // D. Desde censo de beneficiarios que tengan asignado este inspector por nombre
    Object.keys(censoMap).forEach((k) => {
      const c = censoMap[k];
      if (c.inspectores.has(inspNameNorm)) {
        if (!veredasMap[k]) {
          veredasMap[k] = {
            municipio: c.municipio,
            vereda: c.vereda,
            total_baterias: c.total,
            visitas_en_periodo: 0,
            baterias_visitadas_periodo: 0,
            cubierta_en_periodo: false,
            asignada_formal: true
          };
        }
      }
    });

    // Calcular estadísticas de visitas y censo por vereda
    let totalCenso = 0;
    const distinctVeredasVisitadas = new Set();

    Object.keys(veredasMap).forEach((k) => {
      const z = veredasMap[k];
      totalCenso += (z.total_baterias || 0);

      const visitsVereda = visitas.filter((v) =>
        v.municipio && v.vereda &&
        v.municipio.trim().toUpperCase() === z.municipio.toUpperCase() &&
        v.vereda.trim().toUpperCase() === z.vereda.toUpperCase()
      );

      const uniqueBatVisitadas = new Set(visitsVereda.map((v) => v.beneficiario_id));
      z.visitas_en_periodo = visitsVereda.length;
      z.baterias_visitadas_periodo = uniqueBatVisitadas.size;
      z.cubierta_en_periodo = visitsVereda.length > 0;

      if (z.cubierta_en_periodo) {
        distinctVeredasVisitadas.add(k);
      }
    });

    insp.zonas_asignadas = Object.values(veredasMap);
    insp.total_baterias_asignadas = totalCenso;
    insp.veredas_cubiertas_periodo = distinctVeredasVisitadas.size;
    insp.total_visitas_periodo = visitas.length;
    insp.trabajo_en_fecha = visitas.length > 0;
    insp.visitas_periodo = visitas;

    const munsSet = new Set();
    insp.zonas_asignadas.forEach((z) => munsSet.add(z.municipio));
    insp.municipios = Array.from(munsSet);
  }

  return data;
}

window.updateInspActivityDropdownsForSelectedInspector = function () {
  const inspIdStr = document.getElementById('insp-act-filter-inspector')?.value || '';
  const munSelect = document.getElementById('insp-act-filter-municipio');
  const veredaSelect = document.getElementById('insp-act-filter-vereda');

  let targetList = currentInspectoresActivityList;
  if (inspIdStr) {
    targetList = targetList.filter((i) => String(i.id) === inspIdStr);
  }

  // Municipios disponibles para este inspector
  const availableMuns = new Set();
  targetList.forEach((i) => {
    if (Array.isArray(i.municipios)) i.municipios.forEach((m) => availableMuns.add(typeof m === 'string' ? m : m.nombre));
    if (Array.isArray(i.zonas_asignadas)) i.zonas_asignadas.forEach((z) => availableMuns.add(z.municipio));
    if (Array.isArray(i.visitas_periodo)) i.visitas_periodo.forEach((v) => availableMuns.add(v.municipio));
  });

  if (munSelect) {
    const currentMun = munSelect.value;
    munSelect.innerHTML = '<option value="">Todos los Municipios (' + availableMuns.size + ')</option>' +
      Array.from(availableMuns).sort().map((m) => `<option value="${escapeHtml(m)}" ${m === currentMun ? 'selected' : ''}>🏛️ ${escapeHtml(m)}</option>`).join('');
  }

  // Veredas disponibles para este inspector
  const selectedMun = munSelect ? munSelect.value : '';
  const availableVeredas = new Set();

  targetList.forEach((insp) => {
    if (Array.isArray(insp.zonas_asignadas)) {
      insp.zonas_asignadas.forEach((z) => {
        if (!selectedMun || z.municipio === selectedMun) {
          if (z.vereda) availableVeredas.add(z.vereda);
        }
      });
    }
    if (Array.isArray(insp.visitas_periodo)) {
      insp.visitas_periodo.forEach((v) => {
        if (!selectedMun || v.municipio === selectedMun) {
          if (v.vereda) availableVeredas.add(v.vereda);
        }
      });
    }
  });

  if (veredaSelect) {
    const currentVereda = veredaSelect.value;
    veredaSelect.innerHTML = '<option value="">Todas las Veredas (' + availableVeredas.size + ')</option>' +
      Array.from(availableVeredas).sort().map((v) => `<option value="${escapeHtml(v)}" ${v === currentVereda ? 'selected' : ''}>🌲 ${escapeHtml(v)}</option>`).join('');
  }
};

window.onInspActivityMunicipioChange = function () {
  const inspIdStr = document.getElementById('insp-act-filter-inspector')?.value || '';
  const mun = document.getElementById('insp-act-filter-municipio')?.value || '';
  const veredaSelect = document.getElementById('insp-act-filter-vereda');

  let targetList = currentInspectoresActivityList;
  if (inspIdStr) {
    targetList = targetList.filter((i) => String(i.id) === inspIdStr);
  }

  if (veredaSelect) {
    const currentVereda = veredaSelect.value;
    const allVeredas = new Set();

    targetList.forEach((insp) => {
      if (Array.isArray(insp.zonas_asignadas)) {
        insp.zonas_asignadas.forEach((z) => {
          if (!mun || z.municipio === mun) {
            if (z.vereda) allVeredas.add(z.vereda);
          }
        });
      }
      if (Array.isArray(insp.visitas_periodo)) {
        insp.visitas_periodo.forEach((v) => {
          if (!mun || v.municipio === mun) {
            if (v.vereda) allVeredas.add(v.vereda);
          }
        });
      }
    });

    veredaSelect.innerHTML = '<option value="">Todas las Veredas (' + allVeredas.size + ')</option>' +
      Array.from(allVeredas).sort().map((v) => `<option value="${escapeHtml(v)}" ${v === currentVereda ? 'selected' : ''}>🌲 ${escapeHtml(v)}</option>`).join('');
  }

  renderInspActivityView();
};

window.onInspActivityFilterChange = function () {
  window.updateInspActivityDropdownsForSelectedInspector();
  renderInspActivityView();
};

window.selectInspActivityInspector = function (inspectorId) {
  const inspEl = document.getElementById('insp-act-filter-inspector');
  if (inspEl) {
    inspEl.value = String(inspectorId);
    window.updateInspActivityDropdownsForSelectedInspector();
    renderInspActivityView();
  }
};

window.loadInspectoresActivityData = async function () {
  const dateInput = document.getElementById('insp-activity-date');
  const targetDate = dateInput ? (dateInput.value || 'all') : 'all';

  const viewContainer = document.getElementById('insp-activity-dynamic-view');
  if (viewContainer) {
    viewContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Consultando monitor de actividad y cobertura...</div>`;
  }

  try {
    let data = [];
    if (navigator.onLine) {
      try {
        const res = await fetch(`/api/inspectores/actividad-diaria?fecha=${targetDate}`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) data = json.data;
        }
      } catch (e) {
        console.log('Error API actividad inspectores, calculando local:', e.message);
      }
    }

    if (data.length === 0) {
      // Fallback local desde IndexedDB
      const allUsers = await window.dbManager.getAllUsers();
      const inspectores = (allUsers || []).filter((u) => u.rol_nombre === 'INSPECTOR' || u.rol_id === 2 || (u.cargo && u.cargo.toLowerCase().includes('inspector')));
      data = inspectores.map((insp) => ({
        id: insp.id,
        nombre: insp.nombre,
        documento: insp.documento,
        email: insp.email,
        telefono: insp.telefono,
        activo: insp.activo,
        municipios: insp.zonas || [],
        zonas_asignadas: [],
        total_baterias_asignadas: 0,
        total_visitas_periodo: 0,
        trabajo_en_fecha: false,
        ultima_visita_periodo: null,
        visitas_periodo: [],
        total_historico: 0
      }));
    }

    // Auto-enriquecer con el censo y visitas completas
    data = await enrichInspectoresActivityData(data, targetDate);
    currentInspectoresActivityList = data;

    // Poblar dropdown de inspectores
    const inspSelect = document.getElementById('insp-act-filter-inspector');
    if (inspSelect) {
      const currentVal = inspSelect.value;
      inspSelect.innerHTML = '<option value="">🌟 Todos los Inspectores (' + data.length + ')</option>' +
        data.map((i) => `<option value="${i.id}" ${String(i.id) === currentVal ? 'selected' : ''}>👷 ${escapeHtml(i.nombre)} (${i.total_visitas_periodo} visitas)</option>`).join('');
    }

    window.updateInspActivityDropdownsForSelectedInspector();
    renderInspActivityView();
  } catch (err) {
    console.error('Error al cargar monitor de actividad:', err);
    if (viewContainer) {
      viewContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--danger);">Error al cargar monitor: ${escapeHtml(err.message)}</div>`;
    }
  }
};

window.renderInspActivityView = function () {
  const inspIdStr = document.getElementById('insp-act-filter-inspector')?.value || '';
  const munFilter = document.getElementById('insp-act-filter-municipio')?.value || '';
  const veredaFilter = document.getElementById('insp-act-filter-vereda')?.value || '';
  const dateInput = document.getElementById('insp-activity-date');
  const targetDate = dateInput ? (dateInput.value || 'Histórico Completo') : 'Histórico Completo';

  const viewContainer = document.getElementById('insp-activity-dynamic-view');
  if (!viewContainer) return;

  // Filtrar inspectores según selección
  let displayInspectores = currentInspectoresActivityList;
  if (inspIdStr) {
    displayInspectores = displayInspectores.filter((i) => String(i.id) === inspIdStr);
  }
  if (munFilter) {
    displayInspectores = displayInspectores.filter((i) => {
      const inMuns = Array.isArray(i.municipios) && i.municipios.some((m) => (typeof m === 'string' ? m : m.nombre) === munFilter);
      const inZonas = Array.isArray(i.zonas_asignadas) && i.zonas_asignadas.some((z) => z.municipio === munFilter);
      const inVisitas = Array.isArray(i.visitas_periodo) && i.visitas_periodo.some((v) => v.municipio === munFilter);
      return inMuns || inZonas || inVisitas;
    });
  }

  // Actualizar Mini KPIs
  const totalInspectores = displayInspectores.length;
  const inspectoresActivos = displayInspectores.filter((i) => (i.total_visitas_periodo || 0) > 0).length;
  let totalVisitas = 0;
  const veredasCubiertasSet = new Set();

  displayInspectores.forEach((i) => {
    let visits = i.visitas_periodo || [];
    if (munFilter) visits = visits.filter((v) => v.municipio === munFilter);
    if (veredaFilter) visits = visits.filter((v) => v.vereda === veredaFilter);
    totalVisitas += visits.length;
    visits.forEach((v) => {
      if (v.vereda) veredasCubiertasSet.add(`${v.municipio} - ${v.vereda}`);
    });
  });

  const topInspector = [...displayInspectores].sort((a, b) => (b.total_visitas_periodo || 0) - (a.total_visitas_periodo || 0))[0];

  const trabajaronEl = document.getElementById('insp-act-trabajaron');
  if (trabajaronEl) {
    trabajaronEl.textContent = `${inspectoresActivos} / ${totalInspectores}`;
    trabajaronEl.style.color = inspectoresActivos > 0 ? '#059669' : '#64748b';
  }

  const totalVisitasEl = document.getElementById('insp-act-total-visitas');
  if (totalVisitasEl) totalVisitasEl.textContent = `${totalVisitas} visita${totalVisitas === 1 ? '' : 's'}`;

  const veredasCubiertasEl = document.getElementById('insp-act-veredas-cubiertas');
  if (veredasCubiertasEl) veredasCubiertasEl.textContent = `${veredasCubiertasSet.size} vereda${veredasCubiertasSet.size === 1 ? '' : 's'}`;

  const topInspEl = document.getElementById('insp-act-top-inspector');
  if (topInspEl) {
    if (topInspector && topInspector.total_visitas_periodo > 0) {
      topInspEl.innerHTML = `🏆 ${escapeHtml(topInspector.nombre)} <span style="color: var(--primary); font-size: 0.8rem;">(${topInspector.total_visitas_periodo} vis.)</span>`;
    } else {
      topInspEl.textContent = 'Sin actividad en el período';
    }
  }

  // SI SE SELECCIONÓ UN INSPECTOR ESPECÍFICO: MOSTRAR SU FICHA DE COBERTURA Y BITÁCORA EN VIVO
  if (inspIdStr && displayInspectores.length > 0) {
    const insp = displayInspectores[0];
    let visitas = insp.visitas_periodo || [];
    if (munFilter) visitas = visitas.filter((v) => v.municipio === munFilter);
    if (veredaFilter) visitas = visitas.filter((v) => v.vereda === veredaFilter);

    let zonas = insp.zonas_asignadas || [];
    if (munFilter) zonas = zonas.filter((z) => z.municipio === munFilter);
    if (veredaFilter) zonas = zonas.filter((z) => z.vereda === veredaFilter);

    // Calcular avance promedio de las obras visitadas
    let sumAvance = 0;
    visitas.forEach((v) => { sumAvance += parseFloat(v.avance_global) || 0; });
    const avgAvance = visitas.length > 0 ? (sumAvance / visitas.length).toFixed(1) : '0.0';

    viewContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- BANNER DE PERFIL DEL INSPECTOR -->
        <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 800; box-shadow: 0 4px 10px rgba(15,46,89,0.35);">
              👷
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(insp.nombre)}</h3>
                <span class="badge ${insp.trabajo_en_fecha ? 'badge-status-terminado' : 'badge-status-sin-iniciar'}" style="font-size: 0.75rem; padding: 2px 8px;">
                  ${insp.trabajo_en_fecha ? '🟢 Trabajó en la fecha (' + visitas.length + ' visitas)' : '⚪ Sin Visitas en la fecha'}
                </span>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <span>🪪 CC: <strong>${escapeHtml(insp.documento)}</strong></span>
                ${insp.telefono ? `<span>📞 Tel: <strong>${escapeHtml(insp.telefono)}</strong></span>` : ''}
                ${insp.email ? `<span>✉️ Email: <strong>${escapeHtml(insp.email)}</strong></span>` : ''}
              </div>
            </div>
          </div>

          <div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.selectInspActivityInspector('')" style="font-size: 0.8rem; padding: 6px 12px;">
              ⬅️ Ver Todos los Inspectores
            </button>
          </div>
        </div>

        <!-- 4 TARJETAS DE COBERTURA Y RENDIMIENTO DEL INSPECTOR -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem;">
          <div class="stat-card" style="padding: 0.85rem 1rem; border-left: 4px solid var(--primary);">
            <div class="stat-card-top"><span class="stat-title">📋 Visitas Realizadas</span></div>
            <div class="stat-value" style="color: var(--primary); font-size: 1.4rem;">${visitas.length} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">en el período</span></div>
          </div>

          <div class="stat-card" style="padding: 0.85rem 1rem; border-left: 4px solid #ea580c;">
            <div class="stat-card-top"><span class="stat-title">🌲 Veredas Cubiertas</span></div>
            <div class="stat-value" style="color: #ea580c; font-size: 1.4rem;">${insp.veredas_cubiertas_periodo || 0} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">de ${zonas.length} asignadas</span></div>
          </div>

          <div class="stat-card" style="padding: 0.85rem 1rem; border-left: 4px solid #059669;">
            <div class="stat-card-top"><span class="stat-title">📈 % Avance Promedio de Obras</span></div>
            <div class="stat-value" style="color: #059669; font-size: 1.4rem;">${avgAvance}% <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">(promedio de ${visitas.length} visitas)</span></div>
          </div>

          <div class="stat-card" style="padding: 0.85rem 1rem; border-left: 4px solid #8b5cf6;">
            <div class="stat-card-top"><span class="stat-title">🏛️ Censo de Baterías Asignadas</span></div>
            <div class="stat-value" style="color: #8b5cf6; font-size: 1.4rem;">${insp.total_baterias_asignadas || 0} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">baterías</span></div>
          </div>
        </div>

        <!-- TABLA DE DESGLOSE DE COBERTURA POR VEREDA (¿QUÉ VISITÓ HOY VS QUÉ LE FALTA?) -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header" style="background: var(--bg-subtle);">
            <div>
              <h4 style="margin: 0; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                🗺️ Desglose de Cobertura por Municipio y Vereda
              </h4>
              <p style="font-size: 0.76rem; color: var(--text-muted); margin: 2px 0 0 0;">
                Estado de visitas por cada vereda asignada al inspector en la fecha consultada.
              </p>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Municipio</th>
                  <th>Vereda Asignada</th>
                  <th style="text-align: center;">Total Baterías (Censo)</th>
                  <th style="text-align: center;">Visitas Realizadas</th>
                  <th style="text-align: center;">Baterías Pendientes</th>
                  <th style="text-align: center;">Estado de Cobertura</th>
                </tr>
              </thead>
              <tbody>
                ${zonas.length === 0 ? `
                  <tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No hay veredas registradas bajo los filtros seleccionados.</td></tr>
                ` : zonas.map((z) => {
                  const cubierto = z.cubierta_en_periodo;
                  const pendientes = Math.max(0, (z.total_baterias || 0) - (z.baterias_visitadas_periodo || 0));
                  return `
                    <tr>
                      <td><strong style="color: var(--text-primary);">🏛️ ${escapeHtml(z.municipio)}</strong></td>
                      <td><strong style="color: var(--primary);">🌲 ${escapeHtml(z.vereda)}</strong></td>
                      <td style="text-align: center; font-weight: 700;">${z.total_baterias || 0}</td>
                      <td style="text-align: center; font-weight: 800; color: ${cubierto ? '#059669' : 'var(--text-muted)'};">
                        ${z.visitas_en_periodo || 0} visitas (${z.baterias_visitadas_periodo || 0} bat.)
                      </td>
                      <td style="text-align: center; font-weight: 700; color: ${pendientes > 0 ? '#ea580c' : '#059669'};">
                        ${pendientes} pendientes
                      </td>
                      <td style="text-align: center;">
                        <span class="badge ${cubierto ? 'badge-status-terminado' : 'badge-status-sin-iniciar'}" style="font-size: 0.75rem; padding: 2px 8px;">
                          ${cubierto ? '🟢 Visitada en la fecha' : '⚪ Pendiente de visita'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- BITÁCORA CRONOLÓGICA DE VISITAS DEL INSPECTOR -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header" style="background: var(--bg-subtle);">
            <div>
              <h4 style="margin: 0; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                🕒 Bitácora Cronológica de Visitas Registradas (${visitas.length})
              </h4>
              <p style="font-size: 0.76rem; color: var(--text-muted); margin: 2px 0 0 0;">
                Inspecciones subidas por ${escapeHtml(insp.nombre)} en ${targetDate}.
              </p>
            </div>
          </div>

          <div style="padding: 1rem;">
            ${visitas.length === 0 ? `
              <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <div style="font-size: 2.2rem; margin-bottom: 0.4rem;">⚪</div>
                <strong>El inspector no subió inspecciones en la fecha consultada (${targetDate}).</strong>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                ${visitas.map((v, idx) => {
                  const hora = v.fecha_visita ? new Date(v.fecha_visita).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';
                  const avance = parseFloat(v.avance_global) || 0;
                  let avanceBadge = 'badge-status-sin-iniciar';
                  let avanceLabel = '⚪ Sin Iniciar';
                  if (avance >= 99.9) {
                    avanceBadge = 'badge-status-terminado';
                    avanceLabel = '🟢 Terminada';
                  } else if (avance > 0) {
                    avanceBadge = 'badge-status-ejecucion';
                    avanceLabel = '🟠 En Ejecución';
                  }

                  let fotosHtml = '';
                  if (Array.isArray(v.fotos) && v.fotos.length > 0) {
                    fotosHtml = `
                      <div style="margin-top: 0.6rem;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">
                          📷 Evidencias Fotográficas (${v.fotos.length}):
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                          ${v.fotos.map((src, fIdx) => `
                            <div style="width: 75px; height: 75px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.15s ease;" onclick="openPhotoViewerModal('${src}', 'Evidencia Foto #${fIdx + 1} - ${escapeHtml(v.beneficiario_nombre)}')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                              <img src="${src}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    `;
                  }

                  return `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.9rem 1.1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.35rem;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                            <span style="background: var(--primary); color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800;">
                              ${idx + 1}
                            </span>
                            <strong style="font-size: 0.95rem; color: var(--text-primary);">
                              #${v.beneficiario_id} - ${escapeHtml(v.beneficiario_nombre || 'Beneficiario')}
                            </strong>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">(CC: <code>${escapeHtml(v.beneficiario_documento || '')}</code>)</span>
                          </div>
                          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                            🏛️ Municipio: <strong>${escapeHtml(v.municipio || '')}</strong> • 🌲 Vereda: <strong>${escapeHtml(v.vereda || '')}</strong>
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                          <span class="badge ${avanceBadge}" style="font-size: 0.78rem; padding: 2px 7px;">
                            ${avanceLabel} (${avance.toFixed(1)}%)
                          </span>
                          <span style="font-weight: 800; font-size: 0.85rem; color: var(--text-primary); background: var(--bg-subtle); padding: 3px 8px; border-radius: var(--radius-sm);">
                            🕒 ${hora}
                          </span>
                        </div>
                      </div>

                      ${v.observaciones ? `
                        <div style="font-size: 0.8rem; color: var(--text-secondary); background: var(--bg-subtle); padding: 0.4rem 0.65rem; border-radius: var(--radius-sm); margin-top: 0.4rem; border-left: 3px solid var(--primary);">
                          <strong>Observación:</strong> ${escapeHtml(v.observaciones)}
                        </div>
                      ` : ''}

                      ${fotosHtml}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

      </div>
    `;
    return;
  }

  // VISTA COMPARATIVA GENERAL: CUANDO SE MUESTRAN TODOS LOS INSPECTORES
  viewContainer.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Inspector</th>
            <th>Municipios Asignados</th>
            <th style="text-align: center;">¿Trabajó en la Fecha?</th>
            <th>Última Visita Registrada</th>
            <th style="text-align: center;">Total Visitas</th>
            <th style="text-align: center;">Total Histórico</th>
            <th style="text-align: center;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${displayInspectores.length === 0 ? `
            <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No se encontraron inspectores con los filtros seleccionados.</td></tr>
          ` : displayInspectores.map((insp) => {
            const trabajo = (insp.total_visitas_periodo || 0) > 0;
            const totalV = insp.total_visitas_periodo || 0;
            const badgeClass = trabajo ? 'badge-status-terminado' : 'badge-status-sin-iniciar';
            const badgeLabel = trabajo ? `🟢 Activo (${totalV} visita${totalV === 1 ? '' : 's'})` : '⚪ Sin Visitas';

            let ultimaVisitaHtml = '<span style="color: var(--text-muted); font-size: 0.8rem;">No registró visitas</span>';
            if (insp.ultima_visita_periodo) {
              const uv = insp.ultima_visita_periodo;
              const hora = uv.fecha_visita ? new Date(uv.fecha_visita).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
              const avance = parseFloat(uv.avance_global) || 0;
              let avanceColor = '#64748b';
              if (avance >= 99.9) avanceColor = '#059669';
              else if (avance > 0) avanceColor = '#ea580c';

              ultimaVisitaHtml = `
                <div>
                  <div style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary);">
                    🕒 ${hora} • #${uv.beneficiario_id} ${escapeHtml(uv.beneficiario_nombre || '')}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 1px;">
                    🏛️ ${escapeHtml(uv.municipio || '')} - 🌲 ${escapeHtml(uv.vereda || '')} • <strong style="color: ${avanceColor};">${avance.toFixed(1)}% de avance en esta obra</strong>
                  </div>
                </div>
              `;
            }

            const munDisplay = Array.isArray(insp.municipios) && insp.municipios.length > 0
              ? insp.municipios.map((m) => `<span class="badge" style="background: var(--bg-subtle); font-size: 0.7rem;">${escapeHtml(typeof m === 'string' ? m : (m.nombre || ''))}</span>`).join(' ')
              : '<span style="color: var(--text-muted); font-size: 0.78rem;">Todos los municipios</span>';

            return `
              <tr>
                <td>
                  <strong style="color: var(--text-primary); font-size: 0.9rem;">👷 ${escapeHtml(insp.nombre)}</strong>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">CC: <code>${escapeHtml(insp.documento)}</code> ${insp.telefono ? '• 📞 ' + escapeHtml(insp.telefono) : ''}</div>
                </td>
                <td>
                  <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                    ${munDisplay}
                  </div>
                </td>
                <td style="text-align: center;">
                  <span class="badge ${badgeClass}" style="font-size: 0.76rem; padding: 3px 8px; font-weight: 700;">
                    ${badgeLabel}
                  </span>
                </td>
                <td>
                  ${ultimaVisitaHtml}
                </td>
                <td style="text-align: center; font-weight: 800; font-size: 0.95rem; color: var(--primary);">
                  ${totalV}
                </td>
                <td style="text-align: center; font-weight: 800; font-size: 0.9rem; color: var(--text-muted);">
                  ${Number(insp.total_historico || 0).toLocaleString('es-CO')}
                </td>
                <td style="text-align: center;">
                  <button type="button" class="btn btn-primary btn-sm" onclick="window.selectInspActivityInspector(${insp.id})" style="font-size: 0.75rem; padding: 4px 10px;" title="Ver cobertura y bitácora completa de este inspector">
                    🔍 Ver Detalle
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
};

window.openBitacoraInspectorModal = function (inspectorId) {
  window.selectInspActivityInspector(inspectorId);
};

window.closeBitacoraInspectorModal = function () {
  const modal = document.getElementById('modal-bitacora-inspector');
  if (modal) modal.style.display = 'none';
};

async function loadInspectorsTable() {
  const currentUser = window.authService.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol_id === 1);

  const users = await window.dbManager.getAllUsers();
  inspectorsData = users || [];
  inspectorsFiltered = [...inspectorsData];

  // Métricas
  const totalInspectoresEl = document.getElementById('stat-total-inspectores');
  if (totalInspectoresEl) totalInspectoresEl.textContent = inspectorsData.length;

  const inspectoresActivosEl = document.getElementById('stat-inspectores-activos');
  if (inspectoresActivosEl) inspectoresActivosEl.textContent = inspectorsData.filter((i) => i.activo == 1 || i.activo === true).length;

  renderInspectorsPage();
  loadInspectoresActivityData();
}

function renderInspectorsPage() {
  const currentUser = window.authService.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol_id === 1);
  const canEditPin = window.authService.hasPermission('EDITAR_PIN_INSPECTOR') || isSuperAdmin;
  const canManageInspectors = window.authService.hasPermission('GESTIONAR_INSPECTORES') || isSuperAdmin;
  const canOpenEditModal = canManageInspectors || canEditPin;

  const total = inspectorsFiltered.length;
  const totalPages = Math.ceil(total / INSPECTORS_PER_PAGE) || 1;

  if (currentInspectorPage > totalPages) currentInspectorPage = totalPages;
  if (currentInspectorPage < 1) currentInspectorPage = 1;

  const startIdx = (currentInspectorPage - 1) * INSPECTORS_PER_PAGE;
  const endIdx = Math.min(startIdx + INSPECTORS_PER_PAGE, total);
  const pageItems = inspectorsFiltered.slice(startIdx, endIdx);

  // Renderizar filas de la tabla
  const tbody = document.getElementById('table-inspectors-body');
  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No se encontraron registros de usuarios.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageItems
      .map(
        (insp) => {
          const isAdmin = insp.rol_nombre === 'admin' || insp.rol_id === 1;
          const badgeClass = isAdmin ? 'badge-role-admin' : 'badge-role-inspector';
          const rolText = isAdmin ? 'Administrador' : (insp.rol_nombre ? insp.rol_nombre.toUpperCase() : 'INSPECTOR');

          const zonasDisplay = !isAdmin ? (
            insp.total_veredas > 0
              ? `<div style="font-size: 0.72rem; color: var(--primary); margin-top: 3px; font-weight: 550;">📍 ${escapeHtml(insp.municipios_asignados || '')} (${insp.total_veredas} veredas)</div>`
              : `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">📍 Sin zona asignada</div>`
          ) : '';

          const actionBtnHtml = canOpenEditModal ? `
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="openEditInspectorModal(${insp.id})" style="padding: 3px 8px; font-size: 0.75rem;">
                ✏️ Editar
              </button>
              ${!isAdmin ? `
                <button class="btn btn-primary btn-sm" onclick="openAssignInspectorZonesModal(${insp.id})" style="padding: 3px 8px; font-size: 0.75rem;">
                  📍 Zonas
                </button>
              ` : ''}
            </div>
          ` : `
            <span style="font-size: 0.75rem; color: var(--text-muted);">Solo lectura</span>
          `;

          const pinDisplay = canEditPin ? `PIN: ${escapeHtml(insp.pin)}` : 'PIN: ••••••';

          return `
          <tr>
            <td>
              <strong>${escapeHtml(insp.nombre)}</strong>
              ${zonasDisplay}
            </td>
            <td><code>${escapeHtml(insp.documento)}</code></td>
            <td><code>${escapeHtml(insp.usuario)}</code></td>
            <td><span class="badge ${badgeClass}">${escapeHtml(rolText)}</span></td>
            <td>
              <span style="font-family: monospace; background: var(--bg-subtle); padding: 2px 8px; border-radius: 4px; font-weight: bold; border: 1px solid var(--border-color);">
                ${pinDisplay}
              </span>
            </td>
            <td>
              <span class="badge ${insp.activo == 1 || insp.activo === true ? 'badge-status-active' : 'badge-status-inactive'}">
                ${insp.activo == 1 || insp.activo === true ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td>
              ${actionBtnHtml}
            </td>
          </tr>
        `;
        }
      )
      .join('');
  }

  // Actualizar Texto de Paginación
  const infoEl = document.getElementById('inspectors-pagination-info');
  if (infoEl) {
    if (total === 0) {
      infoEl.textContent = '0 registros';
    } else {
      infoEl.textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${total} registros`;
    }
  }

  // Renderizar Botones de Control de Paginación
  const controlsEl = document.getElementById('inspectors-pagination-controls');
  if (controlsEl) {
    let html = '';

    if (totalPages > 1) {
      // Botón Anterior
      html += `
        <button class="pagination-btn pagination-prev-btn" ${currentInspectorPage === 1 ? 'disabled' : ''} onclick="changeInspectorPage(${currentInspectorPage - 1})" title="Página anterior">
          ◀
        </button>
      `;

      const isMobile = window.innerWidth <= 640;
      const windowSize = isMobile ? 1 : 2;
      const startPage = Math.max(1, currentInspectorPage - windowSize);
      const endPage = Math.min(totalPages, currentInspectorPage + windowSize);

      if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="changeInspectorPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
      }

      // Números de Página
      for (let p = startPage; p <= endPage; p++) {
        html += `
          <button class="pagination-btn ${p === currentInspectorPage ? 'active' : ''}" onclick="changeInspectorPage(${p})">
            ${p}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
        html += `<button class="pagination-btn" onclick="changeInspectorPage(${totalPages})">${totalPages}</button>`;
      }

      // Botón Siguiente
      html += `
        <button class="pagination-btn pagination-next-btn" ${currentInspectorPage === totalPages ? 'disabled' : ''} onclick="changeInspectorPage(${currentInspectorPage + 1})" title="Página siguiente">
          ▶
        </button>
      `;
    }

    controlsEl.innerHTML = html;
  }
}

window.changeInspectorPage = function (newPage) {
  currentInspectorPage = newPage;
  renderInspectorsPage();
};

/* ==========================================================================
   RENDERIZADOS: VISTA CONSOLIDADO DE BENEFICIARIOS CON PAGINACIÓN
   ========================================================================== */
async function loadBeneficiariosDashboard() {
  try {
    let municipios = [];
    let veredas = [];
    let beneficiarios = [];

    // Consultar vía API si hay conexión online o desde IndexedDB
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/beneficiarios/catalogos');
        const json = await res.json();
        if (json.ok && json.data) {
          municipios = json.data.municipios || [];
          veredas = json.data.veredas || [];
          beneficiarios = json.data.beneficiarios || [];
        }
      } catch (e) {
        console.log('Fallo API beneficiarios, usando respaldo local IndexedDB:', e.message);
      }
    }

    if (beneficiarios.length === 0) {
      municipios = await window.dbManager.getMunicipios();
      veredas = await window.dbManager.getVeredasByMunicipio();
      beneficiarios = await window.dbManager.getBeneficiarios();
    }

    municipiosData = municipios;
    veredasData = veredas;
    beneficiariosData = beneficiarios;
    beneficiariosFiltered = [...beneficiariosData];

    // Poblar Selector de Municipios
    const munSelect = document.getElementById('filter-ben-municipio');
    if (munSelect) {
      munSelect.innerHTML = `
        <option value="">Todos los Municipios (${municipiosData.length})</option>
        ${municipiosData.map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('')}
      `;
    }

    // Poblar Selector de Veredas
    populateVeredasSelect();

    // Actualizar Métricas si los elementos existen
    const totalEl = document.getElementById('stat-total-beneficiarios') || document.getElementById('dash-stat-total');
    if (totalEl) totalEl.textContent = Number(beneficiariosData.length).toLocaleString('es-CO');

    const vivosEl = document.getElementById('stat-beneficiarios-vivos') || document.getElementById('dash-stat-vivos');
    if (vivosEl) vivosEl.textContent = Number(beneficiariosData.filter((b) => b.estado == 1).length).toLocaleString('es-CO');

    const fallEl = document.getElementById('stat-beneficiarios-fallecidos') || document.getElementById('dash-stat-fallecidos');
    if (fallEl) fallEl.textContent = Number(beneficiariosData.filter((b) => b.estado == 0).length).toLocaleString('es-CO');

    currentBenPage = 1;
    renderBeneficiariosPage();
  } catch (err) {
    console.error('Error al cargar beneficiarios:', err);
  }
}

function populateVeredasSelect(municipioId = null) {
  const veredaSelect = document.getElementById('filter-ben-vereda');
  if (!veredaSelect) return;

  let filteredVeredas = veredasData;
  if (municipioId) {
    filteredVeredas = veredasData.filter((v) => v.municipio_id === parseInt(municipioId, 10));
  }

  veredaSelect.innerHTML = `
    <option value="">Todas las Veredas (${filteredVeredas.length})</option>
    ${filteredVeredas.map((v) => `<option value="${v.id}">${escapeHtml(v.nombre)}</option>`).join('')}
  `;
}

function onMunicipioFilterChange() {
  const munId = document.getElementById('filter-ben-municipio').value;
  populateVeredasSelect(munId);
  filterBeneficiarios();
}

function filterBeneficiarios() {
  const search = (document.getElementById('filter-ben-search')?.value || '').toLowerCase().trim();
  const munId = document.getElementById('filter-ben-municipio')?.value;
  const veredaId = document.getElementById('filter-ben-vereda')?.value;
  const fase = document.getElementById('filter-ben-fase')?.value;
  const estado = document.getElementById('filter-ben-estado')?.value;

  beneficiariosFiltered = beneficiariosData.filter((b) => {
    // Búsqueda texto (nombre, cédula, municipio, vereda)
    if (search) {
      const matchName = b.nombre && b.nombre.toLowerCase().includes(search);
      const matchDoc = b.documento && String(b.documento).toLowerCase().includes(search);
      const matchMun = b.municipio && b.municipio.toLowerCase().includes(search);
      const matchVer = b.vereda && b.vereda.toLowerCase().includes(search);
      if (!matchName && !matchDoc && !matchMun && !matchVer) return false;
    }
    // Filtro Municipio
    if (munId && b.municipio_id !== parseInt(munId, 10)) return false;
    // Filtro Vereda
    if (veredaId && b.vereda_id !== parseInt(veredaId, 10)) return false;
    // Filtro Fase
    if (fase && b.fase !== parseInt(fase, 10)) return false;
    // Filtro Estado
    if (estado !== '' && estado !== undefined && b.estado !== parseInt(estado, 10)) return false;

    return true;
  });

  currentBenPage = 1;
  renderBeneficiariosPage();
}

function renderBeneficiariosPage() {
  const total = beneficiariosFiltered.length;
  const totalPages = Math.ceil(total / BENEFICIARIOS_PER_PAGE) || 1;

  if (currentBenPage > totalPages) currentBenPage = totalPages;
  if (currentBenPage < 1) currentBenPage = 1;

  const startIdx = (currentBenPage - 1) * BENEFICIARIOS_PER_PAGE;
  const endIdx = Math.min(startIdx + BENEFICIARIOS_PER_PAGE, total);
  const pageItems = beneficiariosFiltered.slice(startIdx, endIdx);

  const tbody = document.getElementById('table-beneficiarios-body');
  if (!tbody) return;

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No se encontraron beneficiarios con los filtros seleccionados.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageItems
      .map((b, idx) => {
        const rowNum = startIdx + idx + 1;
        const faseBadge = b.fase === 1 ? 'badge-role-admin' : 'badge-role-inspector';
        const isVivo = b.estado == 1;

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${rowNum}</td>
            <td><span class="badge ${faseBadge}">Fase ${b.fase}</span></td>
            <td><strong>${escapeHtml(b.nombre)}</strong></td>
            <td><code>${escapeHtml(b.documento)}</code></td>
            <td><strong style="color: var(--text-secondary);">${escapeHtml(b.municipio)}</strong></td>
            <td>${escapeHtml(b.vereda)}</td>
            <td>
              <span class="badge ${isVivo ? 'badge-status-active' : 'badge-status-inactive'}">
                ${isVivo ? 'Vivo' : 'Fallecido'}
              </span>
            </td>
            <td>
              <span style="font-family: monospace; font-size: 0.75rem; background: var(--bg-subtle); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-secondary);">
                ${escapeHtml(b.coordenadas || 'N/A')}
              </span>
            </td>
            <td style="text-align: center; white-space: nowrap;">
              <button class="btn btn-secondary btn-sm" onclick="openEditBeneficiarioModal(${b.id})" style="padding: 3px 8px; font-size: 0.75rem;">
                ✏️ Editar
              </button>
              <button class="btn btn-sm" onclick="openFichaTecnicaForBeneficiario(${b.id})" style="padding: 3px 8px; font-size: 0.75rem; margin-left: 4px; color: #ffffff; background: #dc2626; border: 1px solid #b91c1c; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;" title="Ver y descargar Ficha Técnica PDF">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v4zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg> Ficha Técnica
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // Info de Paginación
  const infoEl = document.getElementById('beneficiarios-pagination-info');
  if (infoEl) {
    if (total === 0) {
      infoEl.textContent = '0 beneficiarios';
    } else {
      infoEl.textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${Number(total).toLocaleString('es-CO')} beneficiarios`;
    }
  }

  // Controles de Paginación
  const controlsEl = document.getElementById('beneficiarios-pagination-controls');
  if (controlsEl) {
    let html = '';

    if (totalPages > 1) {
      // Botón Anterior
      html += `
        <button class="pagination-btn pagination-prev-btn" ${currentBenPage === 1 ? 'disabled' : ''} onclick="changeBenPage(${currentBenPage - 1})" title="Página anterior">
          ◀
        </button>
      `;

      // Numeración inteligente compacta
      const isMobile = window.innerWidth <= 640;
      const windowSize = isMobile ? 1 : 2; // 1 a cada lado en móvil, 2 en PC
      const startPage = Math.max(1, currentBenPage - windowSize);
      const endPage = Math.min(totalPages, currentBenPage + windowSize);

      if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="changeBenPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
      }

      for (let p = startPage; p <= endPage; p++) {
        html += `
          <button class="pagination-btn ${p === currentBenPage ? 'active' : ''}" onclick="changeBenPage(${p})">
            ${p}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
        html += `<button class="pagination-btn" onclick="changeBenPage(${totalPages})">${totalPages}</button>`;
      }

      // Botón Siguiente
      html += `
        <button class="pagination-btn pagination-next-btn" ${currentBenPage === totalPages ? 'disabled' : ''} onclick="changeBenPage(${currentBenPage + 1})" title="Página siguiente">
          ▶
        </button>
      `;
    }

    controlsEl.innerHTML = html;
  }
}

window.changeBenPage = function (newPage) {
  currentBenPage = newPage;
  renderBeneficiariosPage();
};

window.openEditBeneficiarioModal = async function (beneficiarioId) {
  const b = beneficiariosData.find((item) => item.id === beneficiarioId);
  if (!b) return;

  document.getElementById('edit-ben-id').value = b.id;
  document.getElementById('edit-ben-nombre').value = b.nombre;
  document.getElementById('edit-ben-documento').value = b.documento;
  document.getElementById('edit-ben-fase').value = b.fase;
  document.getElementById('edit-ben-estado').value = b.estado;
  document.getElementById('edit-ben-coordenadas').value = b.coordenadas || '';

  // Poblar Select de Municipios
  const munSelect = document.getElementById('edit-ben-municipio');
  if (munSelect) {
    munSelect.innerHTML = municipiosData
      .map((m) => `<option value="${m.id}" ${m.id === b.municipio_id ? 'selected' : ''}>${escapeHtml(m.nombre)}</option>`)
      .join('');
  }

  // Poblar Select de Veredas según el municipio del beneficiario
  populateEditBenVeredas(b.municipio_id, b.vereda_id);

  document.getElementById('modal-edit-beneficiario').classList.add('active');
};

function populateEditBenVeredas(municipioId, selectedVeredaId = null) {
  const veredaSelect = document.getElementById('edit-ben-vereda');
  if (!veredaSelect) return;

  const veredasForMun = veredasData.filter((v) => v.municipio_id === parseInt(municipioId, 10));
  veredaSelect.innerHTML = veredasForMun
    .map((v) => `<option value="${v.id}" ${v.id === selectedVeredaId ? 'selected' : ''}>${escapeHtml(v.nombre)}</option>`)
    .join('');
}

window.onEditBenMunicipioChange = function () {
  const munId = document.getElementById('edit-ben-municipio').value;
  populateEditBenVeredas(munId);
};

window.openCreateBeneficiarioModal = function () {
  const form = document.getElementById('form-create-beneficiario');
  if (form) form.reset();

  const munSelect = document.getElementById('create-ben-municipio');
  if (munSelect) {
    munSelect.innerHTML = `
      <option value="">Selecciona un Municipio</option>
      ${municipiosData.map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('')}
    `;
  }

  const veredaSelect = document.getElementById('create-ben-vereda');
  if (veredaSelect) {
    veredaSelect.innerHTML = `<option value="">Selecciona primero un Municipio</option>`;
  }

  document.getElementById('modal-create-beneficiario').classList.add('active');
};

window.onCreateBenMunicipioChange = function () {
  const munId = document.getElementById('create-ben-municipio').value;
  const veredaSelect = document.getElementById('create-ben-vereda');
  if (!veredaSelect) return;

  if (!munId) {
    veredaSelect.innerHTML = `<option value="">Selecciona primero un Municipio</option>`;
    return;
  }

  const veredasForMun = veredasData.filter((v) => v.municipio_id === parseInt(munId, 10));
  veredaSelect.innerHTML = `
    <option value="">Selecciona una Vereda</option>
    ${veredasForMun.map((v) => `<option value="${v.id}">${escapeHtml(v.nombre)}</option>`).join('')}
  `;
};

window.captureGPSForCreateBen = function () {
  if (!navigator.geolocation) {
    showToast('Tu dispositivo no soporta geolocalización GPS.', 'warning');
    return;
  }

  showToast('Obteniendo coordenadas GPS...', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const input = document.getElementById('create-ben-coordenadas');
      if (input) {
        input.value = `${lat}, ${lng}`;
        showToast('📍 Coordenadas GPS capturadas con éxito.', 'success');
      }
    },
    (err) => {
      showToast('No se pudo capturar el GPS: ' + err.message, 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

/* ==========================================================================
   GESTIÓN DE ROLES Y ASIGNACIÓN DINÁMICA DE PERMISOS
   ========================================================================== */
async function loadRolesAndPermissions() {
  const container = document.getElementById('roles-permissions-container');
  if (!container) return;

  const currentUser = window.authService.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol_id === 1);

  // Mostrar botón + Nuevo Rol solo al Administrador
  const btnCreateRole = document.querySelector('button[onclick="openCreateRoleModal()"]');
  if (btnCreateRole) {
    btnCreateRole.style.display = isSuperAdmin ? 'inline-flex' : 'none';
  }

  try {
    const [rolesRes, permisosRes] = await Promise.all([
      fetch('/api/roles'),
      fetch('/api/permisos')
    ]);

    const rolesData = await rolesRes.json();
    const permisosData = await permisosRes.json();

    const roles = rolesData.ok ? rolesData.data : [];
    const permisos = permisosData.ok ? permisosData.data : [];

    container.innerHTML = roles
      .map((role) => {
        const isAdminRole = role.nombre === 'admin' || role.id === 1;
        const rolePermisos = role.permisos || [];

        const permisosCheckboxes = permisos
          .map((p) => {
            const isChecked = rolePermisos.includes(p.clave) ? 'checked' : '';
            const isDisabled = !isSuperAdmin ? 'disabled' : '';

            return `
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.82rem; ${isDisabled ? 'cursor: not-allowed; opacity: 0.85;' : 'cursor: pointer;'}">
              <input type="checkbox" class="role-perm-cb-${role.id}" value="${p.id}" ${isChecked} ${isDisabled} style="margin-top: 2px;">
              <div>
                <strong>${escapeHtml(p.nombre)}</strong>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(p.descripcion || p.clave)}</div>
              </div>
            </label>
          `;
          })
          .join('');

        let actionButtonHtml = '';
        if (!isSuperAdmin) {
          actionButtonHtml = `
            <button class="btn btn-secondary btn-sm btn-block" disabled style="cursor: not-allowed; opacity: 0.65; font-size: 0.75rem;">
              🔒 Solo el Administrador puede editar
            </button>
          `;
        } else {
          actionButtonHtml = `
            <button class="btn btn-primary btn-sm btn-block" onclick="saveRolePermissions(${role.id})">
              💾 Guardar Permisos del Rol
            </button>
          `;
        }

        return `
        <div style="border: 1px solid var(--border-color); background: var(--bg-surface); padding: 1.1rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h4 style="color: ${isAdminRole ? 'var(--admin-color)' : 'var(--primary)'}; font-size: 0.95rem;">
              ${isAdminRole ? '👑' : '📋'} Rol: ${escapeHtml(role.nombre.toUpperCase())}
            </h4>
            <span class="badge ${isAdminRole ? 'badge-role-admin' : 'badge-role-inspector'}">ID: ${role.id}</span>
          </div>
          <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.85rem;">
            ${escapeHtml(role.descripcion || 'Sin descripción')}
          </p>
          <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-bottom: 1rem;">
            <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">
              PERMISOS ASIGNADOS:
            </span>
            ${permisosCheckboxes}
          </div>
          ${actionButtonHtml}
        </div>
      `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">Error al cargar roles y permisos: ${err.message}</div>`;
  }
}

// Guardar permisos asignados a un rol en MySQL
window.saveRolePermissions = async function (roleId) {
  const currentUser = window.authService.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol_id === 1);

  if (!currentUser || !isSuperAdmin) {
    showToast('Solo el Administrador Principal tiene autorización para modificar roles.', 'danger');
    return;
  }

  const checkboxes = document.querySelectorAll(`.role-perm-cb-${roleId}:checked`);
  const selectedPermissionIds = Array.from(checkboxes).map((cb) => parseInt(cb.value, 10));

  try {
    const res = await fetch(`/api/roles/${roleId}/permisos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permiso_ids: selectedPermissionIds })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Error al guardar permisos');

    await window.dbManager.syncDataFromMySQL();
    showToast('Permisos del rol actualizados exitosamente.', 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

/* ==========================================================================
   MODALES
   ========================================================================== */
window.openCreateInspectorModal = async function () {
  await populateRolesSelect('create-user-rol', 2);
  document.getElementById('modal-create-inspector').classList.add('active');
};

window.openEditInspectorModal = async function (inspectorId) {
  const currentUser = window.authService.getCurrentUser();
  const isSuperAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol_id === 1);
  const canEditPin = window.authService.hasPermission('EDITAR_PIN_INSPECTOR') || isSuperAdmin;
  const canManageInspectors = window.authService.hasPermission('GESTIONAR_INSPECTORES') || isSuperAdmin;

  if (!canManageInspectors && !canEditPin) {
    showToast('No tienes permisos para editar este usuario.', 'warning');
    return;
  }

  const users = await window.dbManager.getAllUsers();
  const insp = users.find((u) => u.id === inspectorId);
  if (!insp) return;

  await populateRolesSelect('edit-inspector-rol', insp.rol_id);

  document.getElementById('edit-inspector-id').value = insp.id;
  
  const nombreInput = document.getElementById('edit-inspector-nombre');
  nombreInput.value = insp.nombre;
  nombreInput.disabled = !canManageInspectors;

  const docInput = document.getElementById('edit-inspector-documento');
  docInput.value = insp.documento;
  docInput.disabled = !canManageInspectors;

  const pinInput = document.getElementById('edit-inspector-pin');
  pinInput.value = insp.pin;
  pinInput.disabled = !canEditPin;
  if (!canEditPin) {
    pinInput.type = 'password';
    pinInput.title = 'No tienes permiso para modificar el PIN de acceso.';
  } else {
    pinInput.type = 'text';
    pinInput.removeAttribute('title');
  }

  const rolSelect = document.getElementById('edit-inspector-rol');
  rolSelect.disabled = !canManageInspectors;

  const activoCheck = document.getElementById('edit-inspector-activo');
  activoCheck.checked = insp.activo == 1 || insp.activo === true;
  activoCheck.disabled = !canManageInspectors;

  document.getElementById('modal-edit-inspector').classList.add('active');
};

window.openCreateRoleModal = function () {
  document.getElementById('modal-create-role').classList.add('active');
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
};

async function populateRolesSelect(selectId, selectedRoleId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    const res = await fetch('/api/roles');
    const data = await res.json();
    const roles = data.ok ? data.data : [];

    select.innerHTML = roles
      .map(
        (r) => `<option value="${r.id}" ${selectedRoleId === r.id ? 'selected' : ''}>${r.nombre.toUpperCase()} - ${escapeHtml(r.descripcion || '')}</option>`
      )
      .join('');
  } catch (e) {
    select.innerHTML = `<option value="2">INSPECTOR</option><option value="1">ADMIN</option>`;
  }
}

/* ==========================================================================
   MODAL DE ASIGNACIÓN TERRITORIAL A INSPECTORES (MUNICIPIOS Y VEREDAS)
   ========================================================================== */
let modalAssignedVeredaIds = new Set();
let modalCurrentMunId = null;

window.openAssignInspectorZonesModal = async function (userId) {
  const users = await window.dbManager.getAllUsers();
  const insp = users.find((u) => u.id === userId);
  if (!insp) return;

  document.getElementById('assign-zones-user-id').value = insp.id;
  document.getElementById('assign-zones-modal-title').textContent = `📍 Asignar Territorio: ${insp.nombre}`;
  document.getElementById('assign-zones-modal-subtitle').textContent = `Usuario: ${insp.usuario} • Cédula: ${insp.documento}`;

  // Asegurar catálogos de municipios y veredas cargados
  if (municipiosData.length === 0) {
    municipiosData = await window.dbManager.getMunicipios();
    veredasData = await window.dbManager.getVeredasByMunicipio();
  }

  // Cargar zonas actualmente asignadas
  modalAssignedVeredaIds.clear();
  try {
    const assignedZonas = await window.dbManager.getUserZonas(userId);
    for (const z of assignedZonas) {
      modalAssignedVeredaIds.add(z.vereda_id);
    }
  } catch (err) {
    console.error('Error al cargar zonas asignadas:', err);
  }

  // Poblar Select de Municipios para filtro
  const munFilterSelect = document.getElementById('assign-zones-mun-filter');
  if (munFilterSelect) {
    munFilterSelect.innerHTML = `
      <option value="ALL">Todos los Municipios (${municipiosData.length})</option>
      ${municipiosData.map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('')}
    `;
    munFilterSelect.value = 'ALL';
  }

  const searchInput = document.getElementById('assign-zones-search-input');
  if (searchInput) searchInput.value = '';

  updateAssignZonesBadge();
  renderAssignZonesList();

  document.getElementById('modal-assign-inspector-zones').classList.add('active');
};

function updateAssignZonesBadge() {
  const countEl = document.getElementById('assign-zones-count-badge');
  if (countEl) {
    countEl.textContent = `${modalAssignedVeredaIds.size} veredas seleccionadas`;
  }
}

window.renderAssignZonesList = function () {
  const container = document.getElementById('assign-zones-checkboxes-container');
  if (!container) return;

  const munFilter = document.getElementById('assign-zones-mun-filter')?.value || 'ALL';
  const searchTerm = (document.getElementById('assign-zones-search-input')?.value || '').toLowerCase().trim();

  let veredas = veredasData;
  if (munFilter !== 'ALL') {
    veredas = veredas.filter((v) => v.municipio_id === parseInt(munFilter, 10));
  }

  if (searchTerm) {
    veredas = veredas.filter((v) => (v.nombre && v.nombre.toLowerCase().includes(searchTerm)) || (v.municipio && v.municipio.toLowerCase().includes(searchTerm)));
  }

  if (veredas.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">
        No se encontraron veredas con el filtro seleccionado.
      </div>
    `;
    return;
  }

  container.innerHTML = veredas
    .map((v) => {
      const isChecked = modalAssignedVeredaIds.has(v.id) ? 'checked' : '';
      const munObj = municipiosData.find((m) => m.id === v.municipio_id);
      const munNombre = munObj ? munObj.nombre : (v.municipio || '');

      return `
        <label style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(79, 70, 229, 0.06)' : 'var(--bg-subtle)'}; cursor: pointer; font-size: 0.8rem; transition: background 0.15s ease;">
          <input type="checkbox" value="${v.id}" ${isChecked} onchange="toggleAssignVereda(${v.id}, this.checked)" style="margin-top: 2px;">
          <div style="line-height: 1.25;">
            <strong style="color: var(--text-primary); font-size: 0.82rem;">${escapeHtml(v.nombre)}</strong>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(munNombre)}</div>
          </div>
        </label>
      `;
    })
    .join('');
};

window.toggleAssignVereda = function (veredaId, checked) {
  if (checked) {
    modalAssignedVeredaIds.add(veredaId);
  } else {
    modalAssignedVeredaIds.delete(veredaId);
  }
  updateAssignZonesBadge();
};

window.selectAllVeredasOfCurrentMun = function (selectAll) {
  const munFilter = document.getElementById('assign-zones-mun-filter')?.value || 'ALL';
  let veredas = veredasData;
  if (munFilter !== 'ALL') {
    veredas = veredas.filter((v) => v.municipio_id === parseInt(munFilter, 10));
  }

  for (const v of veredas) {
    if (selectAll) {
      modalAssignedVeredaIds.add(v.id);
    } else {
      modalAssignedVeredaIds.delete(v.id);
    }
  }

  updateAssignZonesBadge();
  renderAssignZonesList();
};

window.saveInspectorZoneAssignments = async function () {
  const userId = parseInt(document.getElementById('assign-zones-user-id').value, 10);
  if (!userId) return;

  const veredaIds = Array.from(modalAssignedVeredaIds);

  try {
    await window.dbManager.saveUserZonas(userId, veredaIds);
    showToast('Asignación territorial guardada exitosamente.', 'success');
    closeModal('modal-assign-inspector-zones');

    // Recargar tabla de inspectores para reflejar las nuevas zonas
    await loadAdminDashboard();
  } catch (err) {
    showToast('Error al guardar asignación: ' + err.message, 'danger');
  }
};

/* ==========================================================================
   UTILIDADES
   ========================================================================== */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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

/* ==========================================================================
   DESCARGA DIRECTA / INSTALACIÓN PWA EN DISPOSITIVO
   ========================================================================== */
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Mostrar botones de instalación directa
  document.querySelectorAll('.btn-install-pwa').forEach((btn) => {
    btn.style.display = 'inline-flex';
  });
});

window.installPWA = async function () {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      document.querySelectorAll('.btn-install-pwa').forEach((btn) => {
        btn.style.display = 'none';
      });
      showToast('Aplicación instalada exitosamente en este dispositivo.', 'success');
    }
    deferredInstallPrompt = null;
  } else {
    // Instrucciones si el navegador no disparó el evento automático
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      showToast('En Safari (iOS): Toca el botón Compartir ⎋ y selecciona "Agregar a pantalla de inicio ➕".', 'info');
    } else {
      showToast('Para instalar: Usa el icono de instalación ⬇️ en la barra de direcciones de Chrome/Edge, o en móvil: Menú ⋮ > "Instalar aplicación".', 'info');
    }
  }
};

window.addEventListener('appinstalled', () => {
  document.querySelectorAll('.btn-install-pwa').forEach((btn) => {
    btn.style.display = 'none';
  });
  showToast('¡Control Inspección ya está instalado como app nativa!', 'success');
});

/* ==========================================================================
   MOTOR DE SINCRONIZACIÓN AUTOMÁTICA Y ESTADO DE RED
   ========================================================================== */
async function updateSyncUI() {
  const syncIcon = document.getElementById('dropdown-sync-icon') || document.getElementById('header-sync-icon');
  const syncText = document.getElementById('dropdown-sync-text') || document.getElementById('header-sync-text');
  const dot = document.getElementById('avatar-status-dot');

  try {
    const pending = await window.dbManager.getPendingInspecciones();
    const isOnline = navigator.onLine;

    if (dot) {
      dot.className = isOnline ? 'avatar-status-dot online' : 'avatar-status-dot offline';
      dot.title = isOnline ? 'En Línea' : 'Sin Conexión (Offline)';
    }

    if (!syncIcon || !syncText) return;

    if (isOnline) {
      if (pending.length === 0) {
        syncIcon.textContent = '🟢';
        syncText.textContent = 'En Línea (Sincronizado)';
      } else {
        syncIcon.textContent = '🔄';
        syncText.textContent = `Sincronizar (${pending.length} pendientes)`;
      }
    } else {
      if (pending.length === 0) {
        syncIcon.textContent = '⚪';
        syncText.textContent = 'Offline (Sin pendientes)';
      } else {
        syncIcon.textContent = '💾';
        syncText.textContent = `Offline (${pending.length} en cola)`;
      }
    }
  } catch (e) {
    console.error('Error al actualizar UI de sincronización:', e);
  }
}

window.triggerManualSync = async function () {
  if (!navigator.onLine) {
    showToast('Estás sin conexión. Tus visitas están guardadas de forma segura en este dispositivo y se sincronizarán al detectar internet.', 'info');
    updateSyncUI();
    return;
  }

  const syncText = document.getElementById('dropdown-sync-text') || document.getElementById('header-sync-text');
  if (syncText) syncText.textContent = 'Sincronizando...';

  const result = await window.dbManager.syncPendingInspections();
  if (result.syncedCount > 0) {
    showToast(`🎉 ¡Éxito! Se sincronizaron ${result.syncedCount} visita(s) con la base de datos MySQL.`, 'success');
  } else if (result.syncedCount === 0 && result.ok) {
    showToast('✓ Todas tus visitas de inspección ya están sincronizadas con el servidor.', 'success');
  } else {
    showToast(result.mensaje || 'Error al sincronizar.', 'warning');
  }

  updateSyncUI();
};

window.addEventListener('online', async () => {
  showToast('📡 ¡Conexión a internet restablecida! Sincronizando visitas pendientes...', 'info');
  updateSyncUI();
  const result = await window.dbManager.syncPendingInspections();
  if (result.syncedCount > 0) {
    showToast(`🎉 ¡Sincronización automática completa! ${result.syncedCount} visita(s) guardadas en MySQL.`, 'success');
  }
  updateSyncUI();
});

window.addEventListener('offline', () => {
  showToast('📶 Has entrado en modo Sin Conexión (Offline). Puedes seguir realizando visitas normalmente.', 'info');
  updateSyncUI();
});

// Chequeo periódico de estado cada 15 segundos
setInterval(() => {
  updateSyncUI();
}, 15000);
