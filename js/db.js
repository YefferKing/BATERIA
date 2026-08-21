/**
 * CAPA DE BASE DE DATOS LOCAL (IndexedDB)
 * Tablas locales sincronizadas: roles, permisos, usuarios, municipios, veredas, beneficiarios, config/sesion
 */

const DB_NAME = 'BateriaOfflineDB';
const DB_VERSION = 6; // Actualizado a versión 6 con Inspecciones de Campo e Historial
const API_URL = '/api';

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tabla: Roles
        if (!db.objectStoreNames.contains('roles')) {
          db.createObjectStore('roles', { keyPath: 'id' });
        }

        // Tabla: Permisos
        if (!db.objectStoreNames.contains('permisos')) {
          db.createObjectStore('permisos', { keyPath: 'id' });
        }

        // Tabla: Usuarios
        if (!db.objectStoreNames.contains('usuarios')) {
          const userStore = db.createObjectStore('usuarios', { keyPath: 'id' });
          userStore.createIndex('documento', 'documento', { unique: true });
          userStore.createIndex('usuario', 'usuario', { unique: true });
          userStore.createIndex('rol_id', 'rol_id', { unique: false });
        }

        // Tabla: Municipios
        if (!db.objectStoreNames.contains('municipios')) {
          const munStore = db.createObjectStore('municipios', { keyPath: 'id' });
          munStore.createIndex('nombre', 'nombre', { unique: true });
        }

        // Tabla: Veredas
        if (!db.objectStoreNames.contains('veredas')) {
          const verStore = db.createObjectStore('veredas', { keyPath: 'id' });
          verStore.createIndex('municipio_id', 'municipio_id', { unique: false });
          verStore.createIndex('nombre', 'nombre', { unique: false });
        }

        // Tabla: Beneficiarios
        if (!db.objectStoreNames.contains('beneficiarios')) {
          const benStore = db.createObjectStore('beneficiarios', { keyPath: 'id' });
          benStore.createIndex('documento', 'documento', { unique: false });
          benStore.createIndex('municipio_id', 'municipio_id', { unique: false });
          benStore.createIndex('vereda_id', 'vereda_id', { unique: false });
          benStore.createIndex('fase', 'fase', { unique: false });
          benStore.createIndex('estado', 'estado', { unique: false });
        }

        // Tabla: Actividades de Inspección (13 Capítulos Parametrizables)
        if (!db.objectStoreNames.contains('actividades')) {
          const actStore = db.createObjectStore('actividades', { keyPath: 'id' });
          actStore.createIndex('orden', 'orden', { unique: true });
        }

        // Tabla: Asignaciones Territoriales de Inspectores
        if (!db.objectStoreNames.contains('usuario_veredas')) {
          const uvStore = db.createObjectStore('usuario_veredas', { keyPath: ['usuario_id', 'vereda_id'] });
          uvStore.createIndex('usuario_id', 'usuario_id', { unique: false });
          uvStore.createIndex('municipio_id', 'municipio_id', { unique: false });
        }

        // Tabla: Inspecciones de Campo
        if (!db.objectStoreNames.contains('inspecciones')) {
          const inspStore = db.createObjectStore('inspecciones', { keyPath: 'id', autoIncrement: true });
          inspStore.createIndex('beneficiario_id', 'beneficiario_id', { unique: false });
          inspStore.createIndex('inspector_id', 'inspector_id', { unique: false });
          inspStore.createIndex('sincronizado', 'sincronizado', { unique: false });
        }

        // Tabla: Detalles de Inspección (13 Actividades)
        if (!db.objectStoreNames.contains('inspeccion_detalles')) {
          const detStore = db.createObjectStore('inspeccion_detalles', { keyPath: 'id', autoIncrement: true });
          detStore.createIndex('inspeccion_id', 'inspeccion_id', { unique: false });
          detStore.createIndex('actividad_id', 'actividad_id', { unique: false });
        }

        // Tabla: Cola de Inspecciones Offline pendientes de sincronizar
        if (!db.objectStoreNames.contains('inspecciones_pendientes')) {
          db.createObjectStore('inspecciones_pendientes', { keyPath: 'local_id', autoIncrement: true });
        }

        // Tabla: Config y sesión activa
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'clave' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        await this.syncDataFromMySQL();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Error al abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Sincronizar catálogo de roles, usuarios, municipios, veredas, beneficiarios, actividades y zonas desde MySQL
  async syncDataFromMySQL() {
    try {
      if (!navigator.onLine) return;

      // 1. Sincronizar Usuarios (Solo los que existan en MySQL)
      try {
        const resUsers = await fetch(`${API_URL}/usuarios`, { signal: AbortSignal.timeout(15000) });
        if (resUsers.ok) {
          const json = await resUsers.json();
          if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
            const tx = this.db.transaction('usuarios', 'readwrite');
            const store = tx.objectStore('usuarios');
            store.clear(); // Limpiar inspectores quemados o viejos
            for (const u of json.data) {
              store.put(u);
            }
            await new Promise((res, rej) => {
              tx.oncomplete = () => res(true);
              tx.onerror = () => rej(tx.error);
            });
          }
        }
      } catch (errU) {
        console.log('Error sincronizando usuarios de MySQL:', errU.message);
      }

      // 2. Sincronizar Municipios, Veredas, Beneficiarios, Actividades y Asignaciones Territoriales
      try {
        const resCat = await fetch(`${API_URL}/beneficiarios/catalogos`, { signal: AbortSignal.timeout(30000) });
        if (resCat.ok) {
          const jsonCat = await resCat.json();
          if (jsonCat.ok && jsonCat.data) {
            const { municipios, veredas, beneficiarios, actividades, usuario_veredas } = jsonCat.data;

            if (Array.isArray(municipios) && municipios.length > 0) {
              const txM = this.db.transaction('municipios', 'readwrite');
              const storeM = txM.objectStore('municipios');
              storeM.clear();
              for (const m of municipios) storeM.put(m);
            }

            if (Array.isArray(veredas) && veredas.length > 0) {
              const txV = this.db.transaction('veredas', 'readwrite');
              const storeV = txV.objectStore('veredas');
              storeV.clear();
              for (const v of veredas) storeV.put(v);
            }

            if (Array.isArray(beneficiarios) && beneficiarios.length > 0) {
              const txB = this.db.transaction('beneficiarios', 'readwrite');
              const storeB = txB.objectStore('beneficiarios');
              storeB.clear();
              for (const b of beneficiarios) storeB.put(b);
            }

            if (Array.isArray(actividades) && actividades.length > 0) {
              const txA = this.db.transaction('actividades', 'readwrite');
              const storeA = txA.objectStore('actividades');
              storeA.clear();
              for (const a of actividades) storeA.put(a);
            }

            if (Array.isArray(usuario_veredas)) {
              const txUV = this.db.transaction('usuario_veredas', 'readwrite');
              const storeUV = txUV.objectStore('usuario_veredas');
              storeUV.clear();
              for (const uv of usuario_veredas) storeUV.put(uv);
            }
          }
        }
      } catch (errC) {
        console.log('Error sincronizando catálogos de MySQL:', errC.message);
      }
    } catch (e) {
      console.log('Modo Offline: Usando base de datos interna del dispositivo.');
    }
  }

  async seedInitialLocalData() {
    // Solo administrador por defecto si no hay nada en la BD
    const defaultUsers = [
      { id: 1, nombre: 'Administrador Principal', usuario: 'admin', documento: '00000000', pin: '1234', rol_id: 1, rol_nombre: 'admin', cargo: 'Super Administrador', activo: 1, permisos: ['VER_PANEL_ADMIN', 'GESTIONAR_INSPECTORES', 'EDITAR_PIN_INSPECTOR', 'VER_REGISTROS_GLOBALES', 'EXPORTAR_DATOS', 'DILIGENCIAR_FORMULARIO'] }
    ];

    const tx = this.db.transaction('usuarios', 'readwrite');
    const store = tx.objectStore('usuarios');
    for (const u of defaultUsers) {
      store.put(u);
    }
    return new Promise((res) => { tx.oncomplete = () => res(true); });
  }

  async countUsers() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('usuarios', 'readonly');
      const store = tx.objectStore('usuarios');
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });
  }

  /**
   * Obtener todos los usuarios:
   * 1. Si hay red (Online): Consulta directo a MySQL y actualiza la copia en IndexedDB.
   * 2. Si no hay red (Offline): Consulta de inmediato la base de datos interna IndexedDB.
   */
  async getAllUsers() {
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/usuarios`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) {
            // Guardar copia local en segundo plano en IndexedDB
            const tx = this.db.transaction('usuarios', 'readwrite');
            const store = tx.objectStore('usuarios');
            for (const u of json.data) {
              store.put(u);
            }
            return json.data; // Retornar directamente los datos frescos de MySQL
          }
        }
      } catch (err) {
        console.log('Fallo al conectar con el servidor, usando respaldo local IndexedDB:', err.message);
      }
    }

    // Consulta local desde IndexedDB (Modo Offline)
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('usuarios', 'readonly');
      const store = tx.objectStore('usuarios');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async findUserByIdentifier(identifier) {
    const cleanId = String(identifier).trim().toLowerCase();
    const allUsers = await this.getAllUsers();
    return allUsers.find(
      (u) => u.usuario.toLowerCase() === cleanId || String(u.documento) === cleanId
    );
  }

  async updateUser(user) {
    // 1. Guardar en IndexedDB local
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('usuarios', 'readwrite');
      const store = tx.objectStore('usuarios');
      const req = store.put(user);
      req.onsuccess = () => resolve(user);
      req.onerror = () => reject(req.error);
    });

    // 2. Si hay conexión con MySQL, sincronizar actualización en tiempo real
    try {
      await fetch(`${API_URL}/usuarios/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
    } catch (e) {
      console.log('Cambio guardado localmente en IndexedDB. Se sincronizará con MySQL al conectar.');
    }
    return user;
  }

  async saveSession(user) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      store.put({ clave: 'sesion_activa', usuario: user, timestamp: Date.now() });
      tx.oncomplete = () => resolve(true);
    });
  }

  async getSession() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('config', 'readonly');
      const store = tx.objectStore('config');
      const req = store.get('sesion_activa');
      req.onsuccess = () => resolve(req.result ? req.result.usuario : null);
      req.onerror = () => resolve(null);
    });
  }

  async clearSession() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      store.delete('sesion_activa');
      tx.oncomplete = () => resolve(true);
    });
  }

  /* ==========================================================================
     MÉTODOS DE CONSULTA PARA MUNICIPIOS, VEREDAS Y BENEFICIARIOS
     ========================================================================== */

  async getMunicipios() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('municipios', 'readonly');
      const store = tx.objectStore('municipios');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getVeredasByMunicipio(municipioId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('veredas', 'readonly');
      const store = tx.objectStore('veredas');
      const req = store.getAll();
      req.onsuccess = () => {
        const allVeredas = req.result || [];
        if (!municipioId) return resolve(allVeredas);
        resolve(allVeredas.filter((v) => v.municipio_id === parseInt(municipioId, 10)));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getBeneficiarios(filters = {}) {
    let localResults = await new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('beneficiarios', 'readonly');
        const store = tx.objectStore('beneficiarios');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });

    // Si la base local está vacía pero hay conexión a internet, traer de MySQL
    if (localResults.length === 0 && navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/beneficiarios/catalogos`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data && Array.isArray(json.data.beneficiarios) && json.data.beneficiarios.length > 0) {
            localResults = json.data.beneficiarios;
            // Guardar en segundo plano en IndexedDB
            const tx = this.db.transaction('beneficiarios', 'readwrite');
            const store = tx.objectStore('beneficiarios');
            for (const b of localResults) store.put(b);
          }
        }
      } catch (e) {
        console.log('Error trayendo beneficiarios de MySQL:', e.message);
      }
    }

    let results = localResults || [];
    if (filters.municipio_id) {
      results = results.filter((b) => b.municipio_id === parseInt(filters.municipio_id, 10));
    }
    if (filters.vereda_id) {
      results = results.filter((b) => b.vereda_id === parseInt(filters.vereda_id, 10));
    }
    if (filters.fase) {
      results = results.filter((b) => b.fase === parseInt(filters.fase, 10));
    }
    if (filters.estado !== undefined && filters.estado !== '') {
      results = results.filter((b) => b.estado === parseInt(filters.estado, 10));
    }
    if (filters.search) {
      const term = filters.search.toLowerCase().trim();
      results = results.filter(
        (b) =>
          (b.nombre && b.nombre.toLowerCase().includes(term)) ||
          (b.documento && String(b.documento).includes(term))
      );
    }
    return results;
  }

  async updateBeneficiario(beneficiario) {
    // 1. Actualizar en IndexedDB
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('beneficiarios', 'readwrite');
      const store = tx.objectStore('beneficiarios');
      const req = store.put(beneficiario);
      req.onsuccess = () => resolve(beneficiario);
      req.onerror = () => reject(req.error);
    });

    // 2. Si hay conexión online, sincronizar con el backend en MySQL
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/beneficiarios/${beneficiario.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(beneficiario)
        });
        const json = await res.json();
        if (json.ok && json.data) {
          return json.data;
        }
      } catch (e) {
        console.log('Cambio guardado en IndexedDB local. Se sincronizará con MySQL al reconectar.');
      }
    }
    return beneficiario;
  }

  async createBeneficiario(beneficiario) {
    let savedOnline = false;
    let createdRecord = { ...beneficiario };

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/beneficiarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(beneficiario)
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'Error al registrar beneficiario en el servidor');
        }
        savedOnline = true;
        createdRecord = json.data;
      } catch (e) {
        if (e.message && e.message.includes('Ya existe')) throw e;
        console.log('Guardando nuevo beneficiario localmente en IndexedDB');
      }
    }

    // Guardar en IndexedDB
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('beneficiarios', 'readwrite');
      const store = tx.objectStore('beneficiarios');
      const req = store.put(createdRecord);
      req.onsuccess = () => resolve(createdRecord);
      req.onerror = () => reject(req.error);
    });
  }

  async getActividades() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('actividades', 'readonly');
      const store = tx.objectStore('actividades');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => a.orden - b.orden);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Utilidad para derivar Estado Automático según Porcentaje (Gris = 0%, Naranja = 25/50/75%, Verde = 100%)
  calculateActivityStatus(percentage) {
    const pct = parseInt(percentage, 10) || 0;
    if (pct === 0) {
      return {
        key: 'SIN_INICIAR',
        label: 'Sin Iniciar',
        color: '#64748b',
        badgeClass: 'badge-status-sin-iniciar',
        icon: '⚪'
      };
    } else if (pct === 100) {
      return {
        key: 'TERMINADO',
        label: 'Terminado',
        color: '#059669',
        badgeClass: 'badge-status-terminado',
        icon: '🟢'
      };
    } else {
      return {
        key: 'EN_EJECUCION',
        label: 'En Ejecución',
        color: '#ea580c',
        badgeClass: 'badge-status-ejecucion',
        icon: '🟠'
      };
    }
  }

  /* ==========================================================================
     MÉTODOS DE ASIGNACIÓN TERRITORIAL (INSPECTORES <-> VEREDAS)
     ========================================================================== */

  async getUserZonas(userId) {
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/usuarios/${userId}/zonas`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) return json.data;
        }
      } catch (e) {
        console.log('Usando almacenamiento local de zonas');
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction('usuario_veredas', 'readonly');
      const store = tx.objectStore('usuario_veredas');
      const idx = store.index('usuario_id');
      const req = idx.getAll(parseInt(userId, 10));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async saveUserZonas(userId, veredaIds) {
    // 1. Si hay conexión online, guardar en MySQL
    if (navigator.onLine) {
      const res = await fetch(`${API_URL}/usuarios/${userId}/zonas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vereda_ids: veredaIds })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error al guardar zonas');
    }

    // 2. Sincronizar en IndexedDB
    await this.syncDataFromMySQL();
    return true;
  }

  /* ==========================================================================
     MÉTODOS DE INSPECCIONES DE CAMPO Y HISTORIAL
     ========================================================================== */

  // Obtener beneficiarios filtrados por la asignación territorial del inspector (SOLO VIVOS: estado === 1)
  async getBeneficiariosForInspector(userId) {
    const allBeneficiarios = await this.getBeneficiarios();
    // Filtrar estrictamente beneficiarios vivos
    const activeBeneficiarios = allBeneficiarios.filter((b) => b.estado == 1);
    const zonas = await this.getUserZonas(userId);

    // Si no tiene zonas asignadas o es admin, ve todos los beneficiarios vivos
    if (!zonas || zonas.length === 0) {
      return activeBeneficiarios;
    }

    const assignedVeredaIds = new Set(zonas.map((z) => z.vereda_id));
    return activeBeneficiarios.filter((b) => assignedVeredaIds.has(b.vereda_id));
  }

  // Obtener la última inspección de un beneficiario para cargar los % previos
  async getLatestInspectionForBeneficiario(beneficiarioId) {
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/beneficiarios/${beneficiarioId}/ultima-inspeccion`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) return json.data;
        }
      } catch (e) {
        console.log('Cargando última inspección desde IndexedDB');
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(['inspecciones', 'inspeccion_detalles'], 'readonly');
      const inspStore = tx.objectStore('inspecciones');
      const idx = inspStore.index('beneficiario_id');
      const req = idx.getAll(parseInt(beneficiarioId, 10));

      req.onsuccess = () => {
        const list = req.result || [];
        if (list.length === 0) return resolve(null);

        // Ordenar por fecha_visita descendente
        list.sort((a, b) => new Date(b.fecha_visita) - new Date(a.fecha_visita));
        const latest = list[0];

        // Obtener detalles
        const detStore = tx.objectStore('inspeccion_detalles');
        const detIdx = detStore.index('inspeccion_id');
        const detReq = detIdx.getAll(latest.id);

        detReq.onsuccess = () => {
          latest.detalles = detReq.result || [];
          resolve(latest);
        };
        detReq.onerror = () => resolve(latest);
      };
      req.onerror = () => resolve(null);
    });
  }

  // Obtener historial completo de inspecciones de un beneficiario
  async getHistorialInspeccionesForBeneficiario(beneficiarioId) {
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/beneficiarios/${beneficiarioId}/historial-inspecciones`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) return json.data;
        }
      } catch (e) {
        console.log('Cargando historial desde IndexedDB');
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction('inspecciones', 'readonly');
      const store = tx.objectStore('inspecciones');
      const idx = store.index('beneficiario_id');
      const req = idx.getAll(parseInt(beneficiarioId, 10));
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => new Date(b.fecha_visita) - new Date(a.fecha_visita));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  // Obtener todas las inspecciones (Online o desde IndexedDB)
  async getInspecciones() {
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/inspecciones?limit=1000`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) {
            const tx = this.db.transaction('inspecciones', 'readwrite');
            const store = tx.objectStore('inspecciones');
            for (const item of json.data) {
              store.put(item);
            }
            return json.data;
          }
        }
      } catch (e) {
        console.log('Error API inspecciones, usando IndexedDB:', e.message);
      }
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction('inspecciones', 'readonly');
      const store = tx.objectStore('inspecciones');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  // Guardar nueva inspección (Online con MySQL o Offline en cola)
  async saveInspeccion(inspectionData) {
    let savedOnline = false;
    let serverId = null;

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/inspecciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inspectionData)
        });
        const json = await res.json();
        if (res.ok && json.ok) {
          savedOnline = true;
          serverId = json.data?.inspeccion_id;
        }
      } catch (e) {
        console.log('Error de red al guardar en MySQL. Guardando en cola local.');
      }
    }

    // Guardar en IndexedDB local
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(['inspecciones', 'inspeccion_detalles'], 'readwrite');
        const inspStore = tx.objectStore('inspecciones');
        const detStore = tx.objectStore('inspeccion_detalles');

        const inspRecord = {
          ...inspectionData,
          fecha_visita: new Date().toISOString(),
          sincronizado: savedOnline ? 1 : 0
        };

        if (serverId) {
          inspRecord.id = Number(serverId);
        } else {
          delete inspRecord.id;
        }

        const reqInsp = serverId ? inspStore.put(inspRecord) : inspStore.add(inspRecord);
        
        reqInsp.onsuccess = () => {
          const localInspId = serverId ? Number(serverId) : reqInsp.result;

          if (Array.isArray(inspectionData.detalles)) {
            for (const d of inspectionData.detalles) {
              const detRecord = {
                ...d,
                inspeccion_id: localInspId
              };
              delete detRecord.id;
              detStore.add(detRecord);
            }
          }

          resolve({
            ok: true,
            savedOnline,
            inspeccion_id: serverId || localInspId,
            mensaje: savedOnline
              ? 'Inspección guardada y sincronizada con el servidor MySQL.'
              : 'Inspección guardada en el dispositivo (Modo Offline). Se sincronizará automáticamente al conectar.'
          });
        };

        reqInsp.onerror = () => reject(reqInsp.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Obtener total de inspecciones pendientes de sincronizar
  async getPendingInspecciones() {
    return new Promise((resolve) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction(['inspecciones', 'inspeccion_detalles'], 'readonly');
      const inspStore = tx.objectStore('inspecciones');
      const detStore = tx.objectStore('inspeccion_detalles');
      const pending = [];

      const req = inspStore.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.sincronizado === 0) {
            pending.push({ ...cursor.value, localId: cursor.key });
          }
          cursor.continue();
        } else {
          if (pending.length === 0) return resolve([]);

          // Traer detalles para cada inspección pendiente
          let loaded = 0;
          pending.forEach((item) => {
            const reqDet = detStore.index('inspeccion_id').getAll(item.localId);
            reqDet.onsuccess = () => {
              item.detalles = reqDet.result || [];
              loaded++;
              if (loaded === pending.length) resolve(pending);
            };
            reqDet.onerror = () => {
              item.detalles = [];
              loaded++;
              if (loaded === pending.length) resolve(pending);
            };
          });
        }
      };
      req.onerror = () => resolve([]);
    });
  }

  // Motor de Sincronización: Envía visitas pendientes a MySQL
  async syncPendingInspections() {
    if (!navigator.onLine) {
      return { ok: false, syncedCount: 0, mensaje: 'Sin conexión a internet.' };
    }

    const pending = await this.getPendingInspecciones();
    if (pending.length === 0) {
      return { ok: true, syncedCount: 0, mensaje: 'Todo está sincronizado.' };
    }

    let syncedCount = 0;
    for (const item of pending) {
      try {
        const payload = {
          beneficiario_id: item.beneficiario_id,
          inspector_id: item.inspector_id,
          avance_global: item.avance_global,
          estado_bateria: item.estado_bateria,
          coordenadas_gps: item.coordenadas_gps,
          observaciones: item.observaciones,
          fotos: item.fotos,
          detalles: item.detalles
        };

        const res = await fetch(`${API_URL}/inspecciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          if (json.ok) {
            await this.markInspectionAsSynced(item.localId, json.data?.inspeccion_id);
            syncedCount++;
          }
        }
      } catch (err) {
        console.error('Error al sincronizar visita local:', err);
      }
    }

    return {
      ok: true,
      syncedCount,
      totalPending: pending.length - syncedCount,
      mensaje: syncedCount > 0
        ? `Se sincronizaron ${syncedCount} visita(s) con la base de datos.`
        : 'No se pudieron sincronizar las visitas pendientes.'
    };
  }

  async markInspectionAsSynced(localId, serverId) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('inspecciones', 'readwrite');
      const store = tx.objectStore('inspecciones');
      const req = store.get(localId);
      req.onsuccess = () => {
        const data = req.result;
        if (data) {
          data.sincronizado = 1;
          if (serverId) data.server_id = serverId;
          store.put(data, localId);
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  }
}

window.dbManager = new DatabaseManager();
