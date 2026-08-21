require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const { processInspectionPhotos } = require('./services/s3Service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '')));

// Configuración de conexión a MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'bateria',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;

// Inicialización de la base de datos MySQL con roles, permisos y usuarios
async function initMySQL() {
  try {
    // 1. Crear base de datos 'bateria' si no existe
    const initialConn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await initialConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await initialConn.end();

    // 2. Pool a la base de datos 'bateria'
    pool = mysql.createPool(dbConfig);
    console.log(`✓ Conectado exitosamente a MySQL (Base de datos: ${dbConfig.database})`);

    // 4. Crear tabla 'roles'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL UNIQUE,
        descripcion VARCHAR(200) NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Crear tabla 'permisos'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permisos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clave VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255) NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Crear tabla intermedia 'rol_permisos'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rol_permisos (
        rol_id INT NOT NULL,
        permiso_id INT NOT NULL,
        PRIMARY KEY (rol_id, permiso_id),
        FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Crear tabla 'usuarios' con clave foránea a roles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        usuario VARCHAR(50) NOT NULL UNIQUE,
        documento VARCHAR(50) NOT NULL UNIQUE,
        pin VARCHAR(20) NOT NULL,
        rol_id INT NOT NULL,
        cargo VARCHAR(100) NULL,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (rol_id) REFERENCES roles(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Sembrar Roles
    await pool.query(`
      INSERT INTO roles (id, nombre, descripcion) VALUES
      (1, 'admin', 'Administrador con acceso total al sistema y gestión de inspectores'),
      (2, 'inspector', 'Inspector de campo con acceso restringido para diligenciar formularios')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
    `);

    // Migración automática: Asegurar columna rol_id si la tabla usuarios ya existía con esquema antiguo
    try {
      const [cols] = await pool.query('SHOW COLUMNS FROM usuarios');
      const colNames = cols.map(c => c.Field);
      if (!colNames.includes('rol_id')) {
        console.log('Actualizando esquema de tabla usuarios para incluir columna rol_id...');
        await pool.query('ALTER TABLE usuarios ADD COLUMN rol_id INT NOT NULL DEFAULT 2 AFTER pin');
        if (colNames.includes('rol')) {
          await pool.query('UPDATE usuarios SET rol_id = 1 WHERE rol = "admin"');
          await pool.query('UPDATE usuarios SET rol_id = 2 WHERE rol != "admin" OR rol IS NULL');
        }
      }
    } catch (migErr) {
      console.log('Aviso de migración usuarios:', migErr.message);
    }

    // 9. Sembrar Catálogo Completo de Permisos
    await pool.query(`
      INSERT INTO permisos (id, clave, nombre, descripcion) VALUES
      (1, 'VER_DASHBOARD', 'Ver Dashboard Gerencial', 'Acceso al dashboard ejecutivo, KPIs globales y Podio de Honor'),
      (2, 'VER_REPORTES', 'Ver Reportes y Analítica', 'Acceso a reportes dinámicos, multi-filtros y avance de 13 actividades'),
      (3, 'VER_INSPECCIONES', 'Ver Inspecciones de Campo', 'Auditar y consultar visitas de campo con fotos, GPS y porcentajes'),
      (4, 'VER_BENEFICIARIOS', 'Ver Beneficiarios', 'Consultar base de datos y búsqueda de beneficiarios'),
      (5, 'GESTIONAR_INSPECTORES', 'Gestionar Inspectores', 'Crear, editar, activar y desactivar inspectores'),
      (6, 'ASIGNAR_ZONAS', 'Asignar Zonas Territoriales', 'Asignar municipios y veredas de trabajo a inspectores'),
      (7, 'EDITAR_PIN_INSPECTOR', 'Modificar PIN de Acceso', 'Cambiar el PIN o credenciales de los inspectores'),
      (8, 'GESTIONAR_ROLES', 'Gestionar Roles y Permisos', 'Configurar y asignar permisos por rol en la matriz'),
      (9, 'EXPORTAR_DATOS', 'Exportar Datos a Excel / CSV', 'Descargar información consolidada en Excel o CSV'),
      (10, 'DILIGENCIAR_FORMULARIO', 'Diligenciar Formulario en Campo', 'Permiso para realizar y sincronizar visitas técnicas en campo')
      ON DUPLICATE KEY UPDATE clave=VALUES(clave), nombre=VALUES(nombre), descripcion=VALUES(descripcion);
    `);

    // 10. Asignar Permisos a Roles
    // Admin: permisos 1 al 10
    await pool.query(`
      INSERT IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES
      (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10);
    `);

    // Inspector: permiso 10 (DILIGENCIAR_FORMULARIO)
    await pool.query(`
      INSERT IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES
      (2, 10);
    `);

    // 11. Sembrar 1 Administrador y 20 Inspectores
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM usuarios');
    if (userCount[0].count === 0) {
      console.log('Sembrando Administrador y 20 Inspectores en tabla usuarios...');
      const seedUsers = [
        ['Administrador Principal', 'admin', '00000000', '1234', 1, 'Super Administrador', 1]
      ];

      for (let i = 1; i <= 20; i++) {
        const numPadded = String(i).padStart(2, '0');
        seedUsers.push([
          `Inspector ${numPadded}`,
          `inspector${numPadded}`,
          `100000${numPadded}`,
          `11${numPadded}`,
          2, // rol_id: 2 (inspector)
          `Inspector de Campo #${numPadded}`,
          1
        ]);
      }

      await pool.query('INSERT INTO usuarios (nombre, usuario, documento, pin, rol_id, cargo, activo) VALUES ?', [seedUsers]);
      console.log('✓ 21 Usuarios vinculados a sus roles correspondientes en MySQL.');
    }

    // 12. Crear tablas de Municipios, Veredas y Beneficiarios si no existen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS municipios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS veredas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        municipio_id INT NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE CASCADE,
        UNIQUE KEY uk_municipio_vereda (municipio_id, nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS beneficiarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fase INT NOT NULL DEFAULT 1,
        municipio_id INT NOT NULL,
        vereda_id INT NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        documento VARCHAR(50) NOT NULL,
        estado TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: VIVO, 0: FALLECIDO',
        coordenadas VARCHAR(150) NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (municipio_id) REFERENCES municipios(id),
        FOREIGN KEY (vereda_id) REFERENCES veredas(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Comprobar si se requiere importar desde Excel
    const [benCount] = await pool.query('SELECT COUNT(*) as count FROM beneficiarios');
    if (benCount[0].count === 0) {
      const { importExcelData } = require('./scripts/import_excel');
      await importExcelData();
    } else {
      console.log(`✓ ${benCount[0].count} Beneficiarios verificados y listos en MySQL.`);
    }

    // 13. Crear tabla de Actividades de Inspección (13 Capítulos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS actividades_inspeccion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orden INT NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        peso_porcentual DECIMAL(6,3) NOT NULL DEFAULT 7.690,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await pool.query('ALTER TABLE actividades_inspeccion MODIFY COLUMN peso_porcentual DECIMAL(6,3) NOT NULL DEFAULT 7.690');
      await pool.query('ALTER TABLE inspeccion_detalles MODIFY COLUMN peso_porcentual DECIMAL(6,3) NOT NULL DEFAULT 7.690');
    } catch (e) {}

    const officialActivities = [
      [1, 'Preliminares', 0.169, 1],
      [2, 'Cimentación', 10.024, 1],
      [3, 'Mampostería', 3.608, 1],
      [4, 'Estructura', 8.490, 1],
      [5, 'Cubierta', 6.159, 1],
      [6, 'Instalaciones Sanitarias', 9.243, 1],
      [7, 'Instalaciones Hidráulicas', 6.813, 1],
      [8, 'Instalaciones Eléctricas', 1.965, 1],
      [9, 'Acabados - Pañetes', 12.000, 1],
      [10, 'Acabados - Enchapes', 5.058, 1],
      [11, 'Carpintería Metálica', 3.181, 1],
      [12, 'Tanques Sépticos', 29.617, 1],
      [13, 'Campo de Infiltración', 3.673, 1]
    ];

    const [actCount] = await pool.query('SELECT COUNT(*) as count FROM actividades_inspeccion');
    if (actCount[0].count === 0) {
      await pool.query(
        'INSERT INTO actividades_inspeccion (orden, nombre, peso_porcentual, activo) VALUES ?',
        [officialActivities]
      );
      console.log('✓ 13 Capítulos/Actividades de construcción parametrizados en MySQL con pesos oficiales.');
    } else {
      // Actualizar pesos oficiales en las actividades existentes
      for (const act of officialActivities) {
        await pool.query(
          'UPDATE actividades_inspeccion SET peso_porcentual = ? WHERE orden = ?',
          [act[2], act[0]]
        );
      }

      // Recalcular avance_global de inspecciones históricas con los nuevos pesos oficiales
      try {
        await pool.query(`
          UPDATE inspecciones i
          JOIN (
            SELECT 
              d.inspeccion_id,
              ROUND(SUM((d.porcentaje * a.peso_porcentual) / 100), 2) as nuevo_avance
            FROM inspeccion_detalles d
            JOIN actividades_inspeccion a ON d.actividad_id = a.id
            GROUP BY d.inspeccion_id
          ) calc ON i.id = calc.inspeccion_id
          SET i.avance_global = calc.nuevo_avance;
        `);
      } catch (e) {}

      console.log('✓ Pesos porcentuales oficiales y avances recalculados en MySQL.');
    }

    // 14. Crear tabla de Asignación Territorial a Inspectores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuario_veredas (
        usuario_id INT NOT NULL,
        municipio_id INT NOT NULL,
        vereda_id INT NOT NULL,
        asignado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (usuario_id, vereda_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE CASCADE,
        FOREIGN KEY (vereda_id) REFERENCES veredas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 15. Crear tabla de Inspecciones de Campo
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspecciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        beneficiario_id INT NOT NULL,
        inspector_id INT NOT NULL,
        fecha_visita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        avance_global DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        estado_bateria ENUM('SIN_INICIAR', 'EN_EJECUCION', 'TERMINADO') NOT NULL DEFAULT 'SIN_INICIAR',
        coordenadas_gps VARCHAR(150) NULL,
        estado_clima VARCHAR(50) NULL DEFAULT 'Soleado',
        observaciones TEXT NULL,
        fotos LONGTEXT NULL,
        sincronizado TINYINT(1) NOT NULL DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id) ON DELETE CASCADE,
        FOREIGN KEY (inspector_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migración preventiva estado_clima
    try {
      const [colCheck] = await pool.query("SHOW COLUMNS FROM inspecciones LIKE 'estado_clima'");
      if (colCheck.length === 0) {
        await pool.query("ALTER TABLE inspecciones ADD COLUMN estado_clima VARCHAR(50) NULL DEFAULT 'Soleado' AFTER coordenadas_gps");
      }
    } catch (e) {}

    // 16. Crear tabla de Detalles de Inspección (13 Capítulos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspeccion_detalles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspeccion_id INT NOT NULL,
        actividad_id INT NOT NULL,
        porcentaje INT NOT NULL DEFAULT 0,
        estado_actividad ENUM('SIN_INICIAR', 'EN_EJECUCION', 'TERMINADO') NOT NULL DEFAULT 'SIN_INICIAR',
        peso_porcentual DECIMAL(5,2) NOT NULL DEFAULT 7.69,
        observacion_item VARCHAR(255) NULL,
        FOREIGN KEY (inspeccion_id) REFERENCES inspecciones(id) ON DELETE CASCADE,
        FOREIGN KEY (actividad_id) REFERENCES actividades_inspeccion(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (error) {
    console.error('⚠️ Error al inicializar estructura MySQL:', error.message);
  }
}

/* ==========================================================================
   RUTAS DE LA API REST (Roles, Permisos, Usuarios, Municipios, Veredas y Beneficiarios)
   ========================================================================== */

// 1. Health check
app.get('/api/health', async (req, res) => {
  try {
    if (!pool) throw new Error('Sin conexión con la base de datos');
    await pool.query('SELECT 1');
    res.json({ ok: true, mensaje: 'Base de datos activa', database: dbConfig.database });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Obtener usuarios con sus roles, permisos y resumen de zonas territoriales
app.get('/api/usuarios', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.nombre, 
        u.usuario, 
        u.documento, 
        u.pin, 
        u.rol_id, 
        r.nombre as rol_nombre, 
        u.cargo, 
        u.activo,
        GROUP_CONCAT(DISTINCT p.clave) as permisos,
        GROUP_CONCAT(DISTINCT m.nombre ORDER BY m.nombre ASC SEPARATOR ', ') as municipios_asignados,
        COUNT(DISTINCT uv.vereda_id) as total_veredas
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN rol_permisos rp ON r.id = rp.rol_id
      LEFT JOIN permisos p ON rp.permiso_id = p.id
      LEFT JOIN usuario_veredas uv ON u.id = uv.usuario_id
      LEFT JOIN municipios m ON uv.municipio_id = m.id
      GROUP BY u.id
      ORDER BY u.id ASC
    `;
    const [usuarios] = await pool.query(query);
    
    // Formatear array de permisos
    const data = usuarios.map(u => ({
      ...u,
      permisos: u.permisos ? u.permisos.split(',') : []
    }));

    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Obtener Roles y sus Permisos
app.get('/api/roles', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id, 
        r.nombre, 
        r.descripcion,
        GROUP_CONCAT(p.clave) as permisos
      FROM roles r
      LEFT JOIN rol_permisos rp ON r.id = rp.rol_id
      LEFT JOIN permisos p ON rp.permiso_id = p.id
      GROUP BY r.id
      ORDER BY r.id ASC
    `;
    const [roles] = await pool.query(query);
    res.json({
      ok: true,
      data: roles.map(r => ({ ...r, permisos: r.permisos ? r.permisos.split(',') : [] }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Crear nuevo usuario
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, usuario, documento, pin, rol_id, cargo, activo } = req.body;
    
    if (!nombre || !usuario || !documento || !pin) {
      return res.status(400).json({ ok: false, error: 'Todos los campos obligatorios deben ser diligenciados' });
    }

    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, usuario, documento, pin, rol_id, cargo, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, usuario, documento, pin, rol_id || 2, cargo || 'Inspector de Campo', activo !== undefined ? (activo ? 1 : 0) : 1]
    );

    res.json({ ok: true, id: result.insertId, mensaje: 'Usuario creado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Actualizar usuario / PIN / datos
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, documento, pin, rol_id, activo } = req.body;
    
    await pool.query(
      'UPDATE usuarios SET nombre = ?, documento = ?, pin = ?, rol_id = ?, activo = ? WHERE id = ?',
      [nombre, documento, pin, rol_id || 2, activo ? 1 : 0, id]
    );

    res.json({ ok: true, mensaje: 'Usuario actualizado con éxito' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Obtener lista de todos los permisos disponibles
app.get('/api/permisos', async (req, res) => {
  try {
    const [permisos] = await pool.query('SELECT id, clave, nombre, descripcion FROM permisos ORDER BY id ASC');
    res.json({ ok: true, data: permisos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Crear un nuevo Rol
app.post('/api/roles', async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) {
      return res.status(400).json({ ok: false, error: 'El nombre del rol es obligatorio' });
    }

    const [result] = await pool.query(
      'INSERT INTO roles (nombre, descripcion) VALUES (?, ?)',
      [nombre.toLowerCase().trim(), descripcion || '']
    );

    res.json({ ok: true, id: result.insertId, mensaje: 'Rol creado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Actualizar / Asignar permisos a un Rol
app.put('/api/roles/:id/permisos', async (req, res) => {
  try {
    const { id } = req.params;
    const { permiso_ids } = req.body;

    if (!Array.isArray(permiso_ids)) {
      return res.status(400).json({ ok: false, error: 'permiso_ids debe ser un arreglo de IDs' });
    }

    await pool.query('DELETE FROM rol_permisos WHERE rol_id = ?', [id]);

    if (permiso_ids.length > 0) {
      const values = permiso_ids.map(pId => [id, pId]);
      await pool.query('INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ?', [values]);
    }

    res.json({ ok: true, mensaje: 'Permisos del rol actualizados exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   RUTAS DE MUNICIPIOS, VEREDAS Y BENEFICIARIOS
   ========================================================================== */

// 9. Listar todos los municipios
app.get('/api/municipios', async (req, res) => {
  try {
    const [municipios] = await pool.query('SELECT id, nombre FROM municipios ORDER BY nombre ASC');
    res.json({ ok: true, data: municipios });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 10. Listar veredas (filtrable por municipio_id)
app.get('/api/veredas', async (req, res) => {
  try {
    const { municipio_id } = req.query;
    let query = 'SELECT v.id, v.municipio_id, m.nombre as municipio, v.nombre FROM veredas v JOIN municipios m ON v.municipio_id = m.id';
    const params = [];

    if (municipio_id) {
      query += ' WHERE v.municipio_id = ?';
      params.push(municipio_id);
    }
    query += ' ORDER BY v.nombre ASC';

    const [veredas] = await pool.query(query, params);
    res.json({ ok: true, data: veredas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 11. Listar veredas de un municipio específico
app.get('/api/municipios/:id/veredas', async (req, res) => {
  try {
    const { id } = req.params;
    const [veredas] = await pool.query(
      'SELECT id, municipio_id, nombre FROM veredas WHERE municipio_id = ? ORDER BY nombre ASC',
      [id]
    );
    res.json({ ok: true, data: veredas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 12. Listar beneficiarios con filtros y paginación
app.get('/api/beneficiarios', async (req, res) => {
  try {
    const { search, municipio_id, vereda_id, fase, estado, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let whereClauses = [];
    let params = [];

    if (search) {
      whereClauses.push('(b.nombre LIKE ? OR b.documento LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (municipio_id) {
      whereClauses.push('b.municipio_id = ?');
      params.push(municipio_id);
    }
    if (vereda_id) {
      whereClauses.push('b.vereda_id = ?');
      params.push(vereda_id);
    }
    if (fase) {
      whereClauses.push('b.fase = ?');
      params.push(fase);
    }
    if (estado !== undefined) {
      whereClauses.push('b.estado = ?');
      params.push(parseInt(estado, 10));
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Contar total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM beneficiarios b ${whereSQL}`,
      params
    );
    const total = countResult[0].total;

    // Obtener registros paginados
    const query = `
      SELECT 
        b.id,
        b.fase,
        b.municipio_id,
        m.nombre as municipio,
        b.vereda_id,
        v.nombre as vereda,
        b.nombre,
        b.documento,
        b.estado,
        b.coordenadas
      FROM beneficiarios b
      JOIN municipios m ON b.municipio_id = m.id
      JOIN veredas v ON b.vereda_id = v.id
      ${whereSQL}
      ORDER BY m.nombre ASC, v.nombre ASC, b.nombre ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, parseInt(limit, 10), offset]);

    res.json({
      ok: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 13. Sincronización completa para modo Offline
app.get('/api/beneficiarios/catalogos', async (req, res) => {
  try {
    const [municipios] = await pool.query('SELECT id, nombre FROM municipios ORDER BY nombre ASC');
    const [veredas] = await pool.query('SELECT id, municipio_id, nombre FROM veredas ORDER BY nombre ASC');
    const [beneficiarios] = await pool.query(`
      SELECT 
        b.id, b.fase, b.municipio_id, m.nombre as municipio,
        b.vereda_id, v.nombre as vereda,
        b.nombre, b.documento, b.estado, b.coordenadas
      FROM beneficiarios b
      JOIN municipios m ON b.municipio_id = m.id
      JOIN veredas v ON b.vereda_id = v.id
      ORDER BY b.id ASC
    `);
    const [actividades] = await pool.query(
      'SELECT id, orden, nombre, peso_porcentual, activo FROM actividades_inspeccion ORDER BY orden ASC'
    );
    const [usuarioVeredas] = await pool.query(
      'SELECT usuario_id, municipio_id, vereda_id FROM usuario_veredas'
    );

    res.json({
      ok: true,
      data: {
        municipios,
        veredas,
        beneficiarios,
        actividades,
        usuario_veredas: usuarioVeredas
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 14. Actualizar datos de un Beneficiario
app.put('/api/beneficiarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fase, municipio_id, vereda_id, nombre, documento, estado, coordenadas } = req.body;

    if (!nombre || !documento || !municipio_id || !vereda_id) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos incompletos' });
    }

    await pool.query(
      `UPDATE beneficiarios 
       SET fase = ?, municipio_id = ?, vereda_id = ?, nombre = ?, documento = ?, estado = ?, coordenadas = ?
       WHERE id = ?`,
      [parseInt(fase, 10) || 1, parseInt(municipio_id, 10), parseInt(vereda_id, 10), nombre.trim(), documento.trim(), parseInt(estado, 10), coordenadas ? coordenadas.trim() : null, id]
    );

    // Retornar datos actualizados con nombres de municipio y vereda
    const [updatedRows] = await pool.query(
      `SELECT 
        b.id, b.fase, b.municipio_id, m.nombre as municipio,
        b.vereda_id, v.nombre as vereda,
        b.nombre, b.documento, b.estado, b.coordenadas
       FROM beneficiarios b
       JOIN municipios m ON b.municipio_id = m.id
       JOIN veredas v ON b.vereda_id = v.id
       WHERE b.id = ?`,
      [id]
    );

    res.json({
      ok: true,
      mensaje: 'Beneficiario actualizado con éxito',
      data: updatedRows[0]
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 14.1 Registrar un nuevo Beneficiario
app.post('/api/beneficiarios', async (req, res) => {
  try {
    const { fase, municipio_id, vereda_id, nombre, documento, estado, coordenadas } = req.body;

    if (!nombre || !documento || !municipio_id || !vereda_id) {
      return res.status(400).json({ ok: false, error: 'Todos los campos obligatorios deben ser diligenciados' });
    }

    // Verificar si ya existe un beneficiario con el mismo documento
    const [existing] = await pool.query(
      'SELECT id, nombre FROM beneficiarios WHERE documento = ? LIMIT 1',
      [documento.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Ya existe un beneficiario registrado con el documento ${documento} (${existing[0].nombre})`
      });
    }

    const [result] = await pool.query(
      `INSERT INTO beneficiarios (fase, municipio_id, vereda_id, nombre, documento, estado, coordenadas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(fase, 10) || 1,
        parseInt(municipio_id, 10),
        parseInt(vereda_id, 10),
        nombre.trim().toUpperCase(),
        documento.trim(),
        estado !== undefined && estado !== null ? parseInt(estado, 10) : 1,
        coordenadas ? coordenadas.trim() : null
      ]
    );

    const newId = result.insertId;

    // Retornar datos completos del nuevo beneficiario
    const [newRows] = await pool.query(
      `SELECT 
        b.id, b.fase, b.municipio_id, m.nombre as municipio,
        b.vereda_id, v.nombre as vereda,
        b.nombre, b.documento, b.estado, b.coordenadas,
        0.00 as avance, 'SIN_INICIAR' as estado_bateria
       FROM beneficiarios b
       JOIN municipios m ON b.municipio_id = m.id
       JOIN veredas v ON b.vereda_id = v.id
       WHERE b.id = ?`,
      [newId]
    );

    res.json({
      ok: true,
      mensaje: 'Beneficiario registrado exitosamente en el sistema',
      data: newRows[0]
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 15. Catálogo de Actividades de Inspección (13 Capítulos)
app.get('/api/actividades', async (req, res) => {
  try {
    const [actividades] = await pool.query(
      'SELECT id, orden, nombre, peso_porcentual, activo FROM actividades_inspeccion ORDER BY orden ASC'
    );
    res.json({ ok: true, data: actividades });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 16. Consultar zonas/veredas asignadas a un usuario
app.get('/api/usuarios/:id/zonas', async (req, res) => {
  try {
    const { id } = req.params;
    const [zonas] = await pool.query(`
      SELECT 
        uv.usuario_id, uv.municipio_id, m.nombre as municipio, uv.vereda_id, v.nombre as vereda
      FROM usuario_veredas uv
      JOIN municipios m ON uv.municipio_id = m.id
      JOIN veredas v ON uv.vereda_id = v.id
      WHERE uv.usuario_id = ?
      ORDER BY m.nombre ASC, v.nombre ASC
    `, [id]);

    res.json({ ok: true, data: zonas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 17. Guardar/Asignar zonas y veredas a un usuario
app.put('/api/usuarios/:id/zonas', async (req, res) => {
  try {
    const { id } = req.params;
    const { vereda_ids } = req.body;

    if (!Array.isArray(vereda_ids)) {
      return res.status(400).json({ ok: false, error: 'vereda_ids debe ser un arreglo de IDs' });
    }

    // 1. Limpiar asignaciones previas
    await pool.query('DELETE FROM usuario_veredas WHERE usuario_id = ?', [id]);

    // 2. Insertar nuevas asignaciones si hay veredas seleccionadas
    if (vereda_ids.length > 0) {
      // Consultar municipio_id de cada vereda
      const [veredasInfo] = await pool.query(
        'SELECT id, municipio_id FROM veredas WHERE id IN (?)',
        [vereda_ids]
      );

      if (veredasInfo.length > 0) {
        const values = veredasInfo.map((v) => [parseInt(id, 10), v.municipio_id, v.id]);
        await pool.query(
          'INSERT INTO usuario_veredas (usuario_id, municipio_id, vereda_id) VALUES ?',
          [values]
        );
      }
    }

    res.json({ ok: true, mensaje: 'Zonas y veredas asignadas exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 18. Registrar una nueva visita de inspección de campo
app.post('/api/inspecciones', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      beneficiario_id,
      inspector_id,
      avance_global,
      estado_bateria,
      coordenadas_gps,
      estado_clima,
      observaciones,
      fotos,
      detalles
    } = req.body;

    if (!beneficiario_id || !inspector_id) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Beneficiario e Inspector son requeridos' });
    }

    // Validar y obtener datos del beneficiario para organizar la ruta en AWS S3
    const [benRows] = await conn.query(`
      SELECT b.id, b.nombre, b.documento, b.estado, m.nombre as municipio, v.nombre as vereda 
      FROM beneficiarios b
      LEFT JOIN municipios m ON b.municipio_id = m.id
      LEFT JOIN veredas v ON b.vereda_id = v.id
      WHERE b.id = ?
    `, [beneficiario_id]);

    if (benRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Beneficiario no encontrado' });
    }

    const benInfo = benRows[0];
    if (benInfo.estado != 1) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'No se puede registrar inspección a un beneficiario en estado Fallecido/Inactivo' });
    }

    // Procesar fotos de evidencia: Subir a AWS S3 (o almacenamiento local de respaldo)
    let processedPhotoUrls = [];
    if (Array.isArray(fotos) && fotos.length > 0) {
      processedPhotoUrls = await processInspectionPhotos(fotos, benInfo);
    } else if (typeof fotos === 'string' && fotos.trim().length > 0) {
      try {
        const parsed = JSON.parse(fotos);
        if (Array.isArray(parsed)) {
          processedPhotoUrls = await processInspectionPhotos(parsed, benInfo);
        }
      } catch (e) {
        processedPhotoUrls = await processInspectionPhotos([fotos], benInfo);
      }
    }

    // 1. Insertar Cabecera de Inspección
    const [inspResult] = await conn.query(
      `INSERT INTO inspecciones 
        (beneficiario_id, inspector_id, avance_global, estado_bateria, coordenadas_gps, estado_clima, observaciones, fotos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(beneficiario_id, 10),
        parseInt(inspector_id, 10),
        parseFloat(avance_global) || 0.00,
        estado_bateria || 'SIN_INICIAR',
        coordenadas_gps ? coordenadas_gps.trim() : null,
        estado_clima ? estado_clima.trim() : 'Soleado',
        observaciones ? observaciones.trim() : null,
        processedPhotoUrls.length > 0 ? JSON.stringify(processedPhotoUrls) : null
      ]
    );

    const inspeccionId = inspResult.insertId;

    // 2. Insertar Detalles de los 13 Capítulos
    if (Array.isArray(detalles) && detalles.length > 0) {
      const detailValues = detalles.map((d) => [
        inspeccionId,
        parseInt(d.actividad_id, 10),
        parseInt(d.porcentaje, 10) || 0,
        d.estado_actividad || 'SIN_INICIAR',
        parseFloat(d.peso_porcentual) || 7.69,
        d.observacion_item ? d.observacion_item.trim() : null
      ]);

      await conn.query(
        `INSERT INTO inspeccion_detalles 
          (inspeccion_id, actividad_id, porcentaje, estado_actividad, peso_porcentual, observacion_item)
         VALUES ?`,
        [detailValues]
      );
    }

    await conn.commit();

    res.json({
      ok: true,
      mensaje: 'Inspección guardada exitosamente',
      data: { inspeccion_id: inspeccionId }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
});

// 19. Obtener la última inspección y estado de los 13 ítems de un beneficiario
app.get('/api/beneficiarios/:id/ultima-inspeccion', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener la última visita registrada
    const [latestRows] = await pool.query(
      `SELECT 
        i.id, i.beneficiario_id, i.inspector_id, u.nombre as inspector_nombre,
        i.fecha_visita, i.avance_global, i.estado_bateria, i.coordenadas_gps,
        i.observaciones, i.fotos
       FROM inspecciones i
       LEFT JOIN usuarios u ON i.inspector_id = u.id
       WHERE i.beneficiario_id = ?
       ORDER BY i.fecha_visita DESC, i.id DESC
       LIMIT 1`,
      [id]
    );

    if (latestRows.length === 0) {
      return res.json({
        ok: true,
        data: null,
        mensaje: 'Sin inspecciones previas (Obra Sin Iniciar)'
      });
    }

    const ultimaInspeccion = latestRows[0];

    // Obtener los detalles de la última visita
    const [detalles] = await pool.query(
      `SELECT 
        d.id, d.actividad_id, a.nombre as actividad_nombre, a.orden,
        d.porcentaje, d.estado_actividad, d.peso_porcentual, d.observacion_item
       FROM inspeccion_detalles d
       JOIN actividades_inspeccion a ON d.actividad_id = a.id
       WHERE d.inspeccion_id = ?
       ORDER BY a.orden ASC`,
      [ultimaInspeccion.id]
    );

    ultimaInspeccion.detalles = detalles;

    res.json({ ok: true, data: ultimaInspeccion });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 20. Historial completo de visitas de inspección de un beneficiario
app.get('/api/beneficiarios/:id/historial-inspecciones', async (req, res) => {
  try {
    const { id } = req.params;

    const [historial] = await pool.query(
      `SELECT 
        i.id, i.beneficiario_id, i.inspector_id, u.nombre as inspector_nombre,
        i.fecha_visita, i.avance_global, i.estado_bateria, i.coordenadas_gps,
        i.observaciones, i.fotos
       FROM inspecciones i
       LEFT JOIN usuarios u ON i.inspector_id = u.id
       WHERE i.beneficiario_id = ?
       ORDER BY i.fecha_visita DESC, i.id DESC`,
      [id]
    );

    res.json({ ok: true, data: historial });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 21. Listado global de inspecciones
app.get('/api/inspecciones', async (req, res) => {
  try {
    const { inspector_id, municipio_id, estado_bateria, search, limit } = req.query;
    let query = `
      SELECT 
        i.id, i.beneficiario_id, b.nombre as beneficiario_nombre, b.documento as beneficiario_documento,
        m.id as municipio_id, m.nombre as municipio, v.nombre as vereda,
        i.inspector_id, u.nombre as inspector_nombre,
        i.fecha_visita, i.avance_global, i.estado_bateria, i.coordenadas_gps, i.estado_clima, i.observaciones, i.fotos
      FROM inspecciones i
      JOIN beneficiarios b ON i.beneficiario_id = b.id
      JOIN municipios m ON b.municipio_id = m.id
      JOIN veredas v ON b.vereda_id = v.id
      JOIN usuarios u ON i.inspector_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (inspector_id) {
      query += ` AND i.inspector_id = ?`;
      params.push(parseInt(inspector_id, 10));
    }

    if (municipio_id) {
      query += ` AND b.municipio_id = ?`;
      params.push(parseInt(municipio_id, 10));
    }

    if (estado_bateria) {
      query += ` AND i.estado_bateria = ?`;
      params.push(estado_bateria);
    }

    if (search) {
      query += ` AND (b.nombre LIKE ? OR b.documento LIKE ? OR u.nombre LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY i.fecha_visita DESC LIMIT ?`;
    params.push(parseInt(limit, 10) || 100);

    const [inspecciones] = await pool.query(query, params);

    // Adjuntar los puntajes individuales de las 13 actividades para cada inspección
    if (inspecciones.length > 0) {
      const inspIds = inspecciones.map((item) => item.id);
      const [detallesRows] = await pool.query(
        'SELECT inspeccion_id, actividad_id, porcentaje FROM inspeccion_detalles WHERE inspeccion_id IN (?)',
        [inspIds]
      );
      const scoresMap = {};
      detallesRows.forEach((d) => {
        if (!scoresMap[d.inspeccion_id]) scoresMap[d.inspeccion_id] = {};
        scoresMap[d.inspeccion_id][d.actividad_id] = parseInt(d.porcentaje, 10) || 0;
      });
      inspecciones.forEach((item) => {
        item.actividadesScores = scoresMap[item.id] || {};
      });
    }

    res.json({ ok: true, data: inspecciones });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/inspecciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [insp] = await pool.query(
      `SELECT 
        i.*, 
        b.nombre as beneficiario_nombre, b.documento as beneficiario_documento, b.fase,
        m.nombre as municipio, v.nombre as vereda,
        u.nombre as inspector_nombre, u.documento as inspector_documento
      FROM inspecciones i
      JOIN beneficiarios b ON i.beneficiario_id = b.id
      JOIN municipios m ON b.municipio_id = m.id
      JOIN veredas v ON b.vereda_id = v.id
      JOIN usuarios u ON i.inspector_id = u.id
      WHERE i.id = ?`,
      [id]
    );

    if (!insp || insp.length === 0) {
      return res.status(404).json({ ok: false, error: 'Inspección no encontrada' });
    }

    const [detalles] = await pool.query(
      `SELECT 
        d.*, a.nombre as actividad_nombre, a.orden, a.peso_porcentual
      FROM inspeccion_detalles d
      JOIN actividades_inspeccion a ON d.actividad_id = a.id
      WHERE d.inspeccion_id = ?
      ORDER BY a.orden ASC`,
      [id]
    );

    res.json({
      ok: true,
      data: {
        ...insp[0],
        detalles
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 21.5 Obtener actividad diaria y productividad de inspectores por fecha o rango
app.get('/api/inspectores/actividad-diaria', async (req, res) => {
  try {
    const { fecha, fecha_fin, inspector_id } = req.query;

    // Obtener todos los usuarios inspectores o con inspecciones realizadas
    let usersQuery = `
      SELECT u.id, u.nombre, u.usuario, u.documento, u.cargo, u.activo, u.rol_id, r.nombre as rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE (r.nombre = 'INSPECTOR' OR u.rol_id = 2 OR u.id IN (SELECT DISTINCT inspector_id FROM inspecciones))
    `;
    const userParams = [];
    if (inspector_id) {
      usersQuery += ' AND u.id = ?';
      userParams.push(parseInt(inspector_id, 10));
    }
    usersQuery += ' ORDER BY u.nombre ASC';
    const [inspectores] = await pool.query(usersQuery, userParams);

    // Obtener veredas asignadas a cada inspector desde usuario_veredas
    const [zonasRows] = await pool.query(
      `SELECT 
        uv.usuario_id, uv.municipio_id, m.nombre as municipio, uv.vereda_id, v.nombre as vereda
       FROM usuario_veredas uv
       JOIN municipios m ON uv.municipio_id = m.id
       JOIN veredas v ON uv.vereda_id = v.id
       ORDER BY m.nombre ASC, v.nombre ASC`
    );
    const zonasByInsp = {};
    const munsByInsp = {};
    zonasRows.forEach((z) => {
      if (!zonasByInsp[z.usuario_id]) zonasByInsp[z.usuario_id] = [];
      zonasByInsp[z.usuario_id].push(z);

      if (!munsByInsp[z.usuario_id]) munsByInsp[z.usuario_id] = new Set();
      munsByInsp[z.usuario_id].add(z.municipio);
    });

    // Conteo de beneficiarios vivos por vereda
    const [bensByVeredaRows] = await pool.query(
      `SELECT b.municipio_id, m.nombre as municipio, b.vereda_id, v.nombre as vereda, COUNT(*) as total_beneficiarios
       FROM beneficiarios b
       JOIN municipios m ON b.municipio_id = m.id
       JOIN veredas v ON b.vereda_id = v.id
       GROUP BY b.municipio_id, b.vereda_id`
    );
    const bensVeredaMap = {};
    const veredasInfoMap = {};
    bensByVeredaRows.forEach((b) => {
      bensVeredaMap[`${b.municipio_id}_${b.vereda_id}`] = b.total_beneficiarios;
      veredasInfoMap[`${b.municipio_id}_${b.vereda_id}`] = {
        municipio_id: b.municipio_id,
        municipio: b.municipio,
        vereda_id: b.vereda_id,
        vereda: b.vereda,
        total_beneficiarios: b.total_beneficiarios
      };
    });

    // Consultar inspecciones en el rango de fechas
    let inspQuery = `
      SELECT 
        i.id, i.beneficiario_id, b.nombre as beneficiario_nombre, b.documento as beneficiario_documento,
        b.municipio_id, b.vereda_id,
        m.nombre as municipio, v.nombre as vereda,
        i.inspector_id, i.fecha_visita, i.avance_global, i.estado_bateria, i.fotos, i.observaciones
      FROM inspecciones i
      JOIN beneficiarios b ON i.beneficiario_id = b.id
      JOIN municipios m ON b.municipio_id = m.id
      JOIN veredas v ON b.vereda_id = v.id
      WHERE 1=1
    `;
    const inspParams = [];

    if (fecha === 'all') {
      // Sin filtro de fecha -> Todo el historial
    } else if (fecha && fecha_fin) {
      inspQuery += ` AND DATE(i.fecha_visita) BETWEEN ? AND ?`;
      inspParams.push(fecha, fecha_fin);
    } else if (fecha) {
      inspQuery += ` AND DATE(i.fecha_visita) = ?`;
      inspParams.push(fecha);
    } else {
      // Por defecto fecha actual
      inspQuery += ` AND DATE(i.fecha_visita) = CURDATE()`;
    }

    if (inspector_id) {
      inspQuery += ` AND i.inspector_id = ?`;
      inspParams.push(parseInt(inspector_id, 10));
    }

    inspQuery += ` ORDER BY i.fecha_visita DESC`;

    const [inspeccionesFecha] = await pool.query(inspQuery, inspParams);

    // Agrupar inspecciones por inspector
    const inspMap = {};
    inspeccionesFecha.forEach((item) => {
      if (!inspMap[item.inspector_id]) inspMap[item.inspector_id] = [];
      let fotosArr = [];
      if (item.fotos) {
        try {
          fotosArr = typeof item.fotos === 'string' ? JSON.parse(item.fotos) : item.fotos;
        } catch (e) { fotosArr = []; }
      }
      inspMap[item.inspector_id].push({
        ...item,
        fotos: fotosArr
      });
    });

    // Consultar total histórico por inspector
    const [historicoRows] = await pool.query(
      `SELECT inspector_id, COUNT(*) as total_historico, MAX(fecha_visita) as ultima_visita_historica
       FROM inspecciones
       GROUP BY inspector_id`
    );
    const histMap = {};
    historicoRows.forEach((h) => {
      histMap[h.inspector_id] = {
        total: h.total_historico,
        ultima: h.ultima_visita_historica
      };
    });

    // Consultar TODAS las veredas donde el inspector ha realizado visitas históricas
    const [historicoVeredasRows] = await pool.query(
      `SELECT DISTINCT i.inspector_id, b.municipio_id, m.nombre as municipio, b.vereda_id, v.nombre as vereda
       FROM inspecciones i
       JOIN beneficiarios b ON i.beneficiario_id = b.id
       JOIN municipios m ON b.municipio_id = m.id
       JOIN veredas v ON b.vereda_id = v.id`
    );
    const histVeredasByInsp = {};
    historicoVeredasRows.forEach((hv) => {
      if (!histVeredasByInsp[hv.inspector_id]) histVeredasByInsp[hv.inspector_id] = [];
      histVeredasByInsp[hv.inspector_id].push(hv);
    });

    const resultado = inspectores.map((insp) => {
      const visitasDia = inspMap[insp.id] || [];
      const hist = histMap[insp.id] || { total: 0, ultima: null };
      const ultimaVisitaDia = visitasDia.length > 0 ? visitasDia[0] : null;

      // Combinar veredas asignadas formalmente con veredas donde ha trabajado
      const rawZonas = zonasByInsp[insp.id] || [];
      const histZonas = histVeredasByInsp[insp.id] || [];

      const mergedZonasMap = {};
      rawZonas.forEach((z) => {
        mergedZonasMap[`${z.municipio_id}_${z.vereda_id}`] = { ...z, asignada_formal: true };
      });
      histZonas.forEach((z) => {
        const k = `${z.municipio_id}_${z.vereda_id}`;
        if (!mergedZonasMap[k]) {
          mergedZonasMap[k] = { ...z, asignada_formal: false };
        }
      });

      // Si aún no tiene veredas específicas (ej: admin/inspector general), incluir las veredas de sus visitas del período
      visitasDia.forEach((v) => {
        const k = `${v.municipio_id}_${v.vereda_id}`;
        if (!mergedZonasMap[k]) {
          mergedZonasMap[k] = {
            municipio_id: v.municipio_id,
            municipio: v.municipio,
            vereda_id: v.vereda_id,
            vereda: v.vereda,
            asignada_formal: false
          };
        }
      });

      const finalZonasList = Object.values(mergedZonasMap);
      let totalBateriasAsignadas = 0;

      // Calcular cobertura por cada vereda
      const veredasCobertura = finalZonasList.map((z) => {
        const totalBat = bensVeredaMap[`${z.municipio_id}_${z.vereda_id}`] || 0;
        totalBateriasAsignadas += totalBat;

        const visitasVereda = visitasDia.filter((v) => v.municipio_id === z.municipio_id && v.vereda_id === z.vereda_id);
        const visitadosSet = new Set(visitasVereda.map((v) => v.beneficiario_id));

        return {
          municipio_id: z.municipio_id,
          municipio: z.municipio,
          vereda_id: z.vereda_id,
          vereda: z.vereda,
          total_baterias: totalBat,
          visitas_en_periodo: visitasVereda.length,
          baterias_visitadas_periodo: visitadosSet.size,
          cubierta_en_periodo: visitasVereda.length > 0
        };
      });

      const municipiosSet = munsByInsp[insp.id] || new Set();
      finalZonasList.forEach((z) => municipiosSet.add(z.municipio));
      visitasDia.forEach((v) => { if (v.municipio) municipiosSet.add(v.municipio); });

      const veredasVisitadasSet = new Set();
      visitasDia.forEach((v) => {
        if (v.vereda) veredasVisitadasSet.add(`${v.municipio} - ${v.vereda}`);
      });

      return {
        id: insp.id,
        nombre: insp.nombre,
        documento: insp.documento,
        email: insp.email,
        telefono: insp.telefono,
        activo: insp.activo,
        municipios: Array.from(municipiosSet),
        zonas_asignadas: veredasCobertura,
        total_baterias_asignadas: totalBateriasAsignadas,
        veredas_cubiertas_periodo: veredasVisitadasSet.size,
        total_visitas_periodo: visitasDia.length,
        trabajo_en_fecha: visitasDia.length > 0,
        ultima_visita_periodo: ultimaVisitaDia,
        visitas_periodo: visitasDia,
        total_historico: hist.total,
        ultima_visita_historica: hist.ultima
      };
    });

    res.json({
      ok: true,
      fecha_consulta: fecha || new Date().toISOString().split('T')[0],
      data: resultado
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 22. Consolidado de Avance de las 13 Actividades Constructivas (Dashboard & Analítica)
app.get('/api/reportes/actividades-progreso', async (req, res) => {
  try {
    const { municipio_id, inspector_id } = req.query;

    // 1. Obtener las 13 actividades constructivas con sus pesos oficiales
    const [actividades] = await pool.query('SELECT * FROM actividades_inspeccion WHERE activo = 1 ORDER BY orden ASC');

    // 2. Obtener total de beneficiarios del universo contractual (todos los 1399 o por municipio si filtra)
    const [totalBeneficiariosRows] = await pool.query(
      `SELECT COUNT(*) as total FROM beneficiarios b ${municipio_id ? 'WHERE b.municipio_id = ?' : ''}`,
      municipio_id ? [municipio_id] : []
    );
    const totalBeneficiariosGeneral = totalBeneficiariosRows[0]?.total || 0;

    // 3. Obtener detalles de la última visita por cada beneficiario
    let queryWhere = '';
    const params = [];
    if (municipio_id) {
      queryWhere = 'WHERE b.municipio_id = ?';
      params.push(municipio_id);
    }
    if (inspector_id) {
      queryWhere = (queryWhere ? `${queryWhere} AND ` : 'WHERE ') + 'i.inspector_id = ?';
      params.push(inspector_id);
    }

    const [latestDetails] = await pool.query(`
      SELECT 
        d.actividad_id,
        d.porcentaje,
        d.estado_actividad,
        i.beneficiario_id
      FROM inspeccion_detalles d
      JOIN inspecciones i ON d.inspeccion_id = i.id
      JOIN (
        SELECT beneficiario_id, MAX(id) as max_id
        FROM inspecciones
        GROUP BY beneficiario_id
      ) latest ON i.beneficiario_id = latest.beneficiario_id AND i.id = latest.max_id
      JOIN beneficiarios b ON i.beneficiario_id = b.id
      ${queryWhere}
    `, params);

    // 4. Consolidar por actividad sobre el universo total de beneficiarios
    const result = actividades.map((act) => {
      const detailsForAct = latestDetails.filter((d) => d.actividad_id === act.id);
      
      let sumPct = 0;
      let countTerminadas = 0;
      let countEjecucion = 0;
      let countSinIniciar = 0;

      detailsForAct.forEach((d) => {
        const p = parseInt(d.porcentaje, 10) || 0;
        sumPct += p;
        if (p >= 99.9) countTerminadas++;
        else if (p > 0) countEjecucion++;
        else countSinIniciar++;
      });

      const uninspectedCount = Math.max(0, totalBeneficiariosGeneral - detailsForAct.length);
      countSinIniciar += uninspectedCount;

      const avgProgress = totalBeneficiariosGeneral > 0 ? (sumPct / totalBeneficiariosGeneral) : 0;

      return {
        id: act.id,
        orden: act.orden,
        nombre: act.nombre,
        peso_porcentual: parseFloat(act.peso_porcentual),
        promedio_avance: parseFloat(avgProgress.toFixed(3)),
        terminadas: countTerminadas,
        en_ejecucion: countEjecucion,
        sin_iniciar: countSinIniciar,
        total_beneficiarios: totalBeneficiariosGeneral
      };
    });

    res.json({
      ok: true,
      data: result,
      total_beneficiarios: totalBeneficiariosGeneral
    });
  } catch (err) {
    console.error('Error al generar reporte de actividades:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Iniciar Servidor
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(` Servidor BATERÍA corriendo en: http://localhost:${PORT}`);
  console.log(`====================================================`);
  await initMySQL();
});
