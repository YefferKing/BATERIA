/**
 * SISTEMA DE AUTENTICACIÓN Y ROLES OFFLINE (RBAC)
 * Control de permisos basado en las tablas de Roles y Permisos de MySQL / IndexedDB.
 */

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  async init() {
    const sessionUser = await window.dbManager.getSession();
    if (!sessionUser) {
      this.currentUser = null;
      return null;
    }

    // Refrescar permisos y datos más recientes del usuario desde la base de datos
    try {
      const freshUser = await window.dbManager.findUserByIdentifier(sessionUser.usuario || sessionUser.documento);
      if (freshUser) {
        this.currentUser = {
          id: freshUser.id,
          nombre: freshUser.nombre,
          usuario: freshUser.usuario,
          documento: freshUser.documento,
          rol_id: freshUser.rol_id,
          rol: freshUser.rol_nombre || (freshUser.rol_id === 1 ? 'admin' : 'inspector'),
          cargo: freshUser.cargo,
          permisos: Array.isArray(freshUser.permisos) ? freshUser.permisos : (sessionUser.permisos || [])
        };
        await window.dbManager.saveSession(this.currentUser);
        return this.currentUser;
      }
    } catch (e) {
      console.log('Usando sesión local cached:', e);
    }

    this.currentUser = sessionUser;
    return this.currentUser;
  }

  async login(identifier, pin) {
    if (!identifier || !pin) {
      throw new Error('Por favor ingrese su usuario o número de documento y su PIN.');
    }

    const cleanPin = String(pin).trim();
    const user = await window.dbManager.findUserByIdentifier(identifier);

    if (!user) {
      throw new Error('Usuario o número de documento no registrado en el dispositivo.');
    }

    if (!user.activo) {
      throw new Error('Este usuario se encuentra inactivo. Contacte al Administrador.');
    }

    if (String(user.pin).trim() !== cleanPin) {
      throw new Error('PIN o clave de acceso incorrecta.');
    }

    // Obtener rol y lista de permisos asignados en MySQL
    const rolNombre = user.rol_nombre || (user.rol_id === 1 ? 'admin' : 'inspector');
    let permisos = Array.isArray(user.permisos) ? user.permisos : [];

    this.currentUser = {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      documento: user.documento,
      rol_id: user.rol_id,
      rol: rolNombre,
      cargo: user.cargo,
      permisos: permisos
    };

    await window.dbManager.saveSession(this.currentUser);
    return this.currentUser;
  }

  async logout() {
    this.currentUser = null;
    await window.dbManager.clearSession();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // Comprobar si el usuario tiene el permiso requerido
  hasPermission(permisoRequerido) {
    if (!this.currentUser) return false;
    return this.currentUser.permisos.includes(permisoRequerido);
  }

  isAdmin() {
    return this.currentUser && this.currentUser.rol === 'admin';
  }

  isInspector() {
    return this.currentUser && this.currentUser.rol === 'inspector';
  }

  // Ocultar/mostrar elementos de la UI según permisos
  applyUIPermissions() {
    const protectedElements = document.querySelectorAll('[data-permiso]');
    protectedElements.forEach((el) => {
      if (el.classList.contains('app-view')) return;
      const requiredPermission = el.dataset.permiso;
      if (this.hasPermission(requiredPermission)) {
        el.style.display = '';
        el.removeAttribute('aria-hidden');
      } else {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }
}

window.authService = new AuthService();
