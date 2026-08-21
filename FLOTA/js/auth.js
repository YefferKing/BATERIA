/**
 * SISTEMA DE AUTENTICACIÓN Y ROLES PARA FLOTA (RBAC)
 */
class FlotaAuth {
  constructor() {
    this.currentUser = null;
    this.STORAGE_KEY = 'flota_session_user';
  }

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        return this.currentUser;
      } catch (e) {
        this.currentUser = null;
      }
    }
    return null;
  }

  async login(identifier, pin) {
    if (!identifier || !pin) throw new Error('Ingresa tu usuario/cédula y PIN.');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, pin })
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error al iniciar sesión');

    this.currentUser = json.data;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser));
    return this.currentUser;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  getUser() {
    return this.currentUser;
  }

  isAdmin() {
    return this.currentUser && (this.currentUser.rol === 'admin' || this.currentUser.rol_id === 1);
  }

  isConductor() {
    return this.currentUser && (this.currentUser.rol === 'conductor' || this.currentUser.rol_id === 3);
  }

  hasPermission(key) {
    if (!this.currentUser) return false;
    if (this.isAdmin()) return true;
    return Array.isArray(this.currentUser.permisos) && this.currentUser.permisos.includes(key);
  }
}

window.flotaAuth = new FlotaAuth();
