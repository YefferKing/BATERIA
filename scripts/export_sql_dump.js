const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'bateria'
};

async function generateFullDump() {
  console.log('Iniciando volcado completo de la base de datos MySQL...');
  const conn = await mysql.createConnection(dbConfig);

  try {
    let sqlDump = `-- ====================================================================
-- VOLCADO COMPLETO DE BASE DE DATOS: BATERIAS SANITARIAS
-- Fecha de generación: ${new Date().toISOString()}
-- Incluye: Estructura DDL, Roles, 10 Permisos, Admin, 13 Actividades,
--          15 Municipios, 219 Veredas y 1.399 Beneficiarios.
-- ====================================================================

CREATE DATABASE IF NOT EXISTS \`bateria\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`bateria\`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. TABLA DE ROLES
DROP TABLE IF EXISTS \`rol_permisos\`;
DROP TABLE IF EXISTS \`permisos\`;
DROP TABLE IF EXISTS \`usuario_veredas\`;
DROP TABLE IF EXISTS \`inspeccion_detalles\`;
DROP TABLE IF EXISTS \`inspecciones\`;
DROP TABLE IF EXISTS \`usuarios\`;
DROP TABLE IF EXISTS \`roles\`;
DROP TABLE IF EXISTS \`actividades_inspeccion\`;
DROP TABLE IF EXISTS \`beneficiarios\`;
DROP TABLE IF EXISTS \`veredas\`;
DROP TABLE IF EXISTS \`municipios\`;

CREATE TABLE \`roles\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`nombre\` VARCHAR(50) NOT NULL UNIQUE,
  \`descripcion\` VARCHAR(200) NULL,
  \`creado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`permisos\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`clave\` VARCHAR(50) NOT NULL UNIQUE,
  \`nombre\` VARCHAR(100) NOT NULL,
  \`descripcion\` VARCHAR(255) NULL,
  \`creado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`rol_permisos\` (
  \`rol_id\` INT NOT NULL,
  \`permiso_id\` INT NOT NULL,
  PRIMARY KEY (\`rol_id\`, \`permiso_id\`),
  FOREIGN KEY (\`rol_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`permiso_id\`) REFERENCES \`permisos\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`usuarios\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`nombre\` VARCHAR(150) NOT NULL,
  \`usuario\` VARCHAR(50) NOT NULL UNIQUE,
  \`documento\` VARCHAR(50) NOT NULL UNIQUE,
  \`pin\` VARCHAR(20) NOT NULL,
  \`rol_id\` INT NOT NULL,
  \`cargo\` VARCHAR(100) NULL,
  \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
  \`creado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`actualizado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`rol_id\`) REFERENCES \`roles\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`municipios\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`nombre\` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`veredas\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`municipio_id\` INT NOT NULL,
  \`nombre\` VARCHAR(150) NOT NULL,
  FOREIGN KEY (\`municipio_id\`) REFERENCES \`municipios\`(\`id\`) ON DELETE CASCADE,
  UNIQUE KEY \`uk_municipio_vereda\` (\`municipio_id\`, \`nombre\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`beneficiarios\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`fase\` INT NOT NULL DEFAULT 1,
  \`municipio_id\` INT NOT NULL,
  \`vereda_id\` INT NOT NULL,
  \`nombre\` VARCHAR(200) NOT NULL,
  \`documento\` VARCHAR(50) NOT NULL,
  \`estado\` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: VIVO, 0: FALLECIDO',
  \`coordenadas\` VARCHAR(150) NULL,
  \`creado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`municipio_id\`) REFERENCES \`municipios\`(\`id\`),
  FOREIGN KEY (\`vereda_id\`) REFERENCES \`veredas\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`actividades_inspeccion\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`orden\` INT NOT NULL,
  \`nombre\` VARCHAR(150) NOT NULL,
  \`peso_porcentual\` DECIMAL(6,3) NOT NULL DEFAULT 7.690,
  \`activo\` TINYINT(1) NOT NULL DEFAULT 1,
  \`creado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`usuario_veredas\` (
  \`usuario_id\` INT NOT NULL,
  \`municipio_id\` INT NOT NULL,
  \`vereda_id\` INT NOT NULL,
  \`asignado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`usuario_id\`, \`vereda_id\`),
  FOREIGN KEY (\`usuario_id\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`municipio_id\`) REFERENCES \`municipios\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`vereda_id\`) REFERENCES \`veredas\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`inspecciones\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`beneficiario_id\` INT NOT NULL,
  \`inspector_id\` INT NOT NULL,
  \`fecha_visita\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`avance_global\` DECIMAL(6,3) NOT NULL DEFAULT 0.000,
  \`estado_bateria\` ENUM('SIN_INICIAR', 'EN_EJECUCION', 'TERMINADO') NOT NULL DEFAULT 'SIN_INICIAR',
  \`coordenadas_gps\` VARCHAR(150) NULL,
  \`estado_clima\` VARCHAR(50) NULL,
  \`observaciones\` TEXT NULL,
  \`fotos\` LONGTEXT NULL,
  \`sincronizado\` TINYINT(1) NOT NULL DEFAULT 1,
  \`creado_en\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`beneficiario_id\`) REFERENCES \`beneficiarios\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`inspector_id\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`inspeccion_detalles\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`inspeccion_id\` INT NOT NULL,
  \`actividad_id\` INT NOT NULL,
  \`porcentaje\` INT NOT NULL DEFAULT 0,
  \`estado_actividad\` ENUM('SIN_INICIAR', 'EN_EJECUCION', 'TERMINADO') NOT NULL DEFAULT 'SIN_INICIAR',
  \`peso_porcentual\` DECIMAL(6,3) NOT NULL DEFAULT 7.690,
  \`observacion_item\` VARCHAR(255) NULL,
  FOREIGN KEY (\`inspeccion_id\`) REFERENCES \`inspecciones\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`actividad_id\`) REFERENCES \`actividades_inspeccion\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. INSERTAR ROLES
INSERT INTO \`roles\` (\`id\`, \`nombre\`, \`descripcion\`) VALUES
(1, 'admin', 'Administrador con acceso total al sistema, reportes y gestión de inspectores'),
(2, 'inspector', 'Inspector de campo con acceso restringido para diligenciar formularios de visita técnica');

-- 3. INSERTAR 10 PERMISOS
INSERT INTO \`permisos\` (\`id\`, \`clave\`, \`nombre\`, \`descripcion\`) VALUES
(1, 'VER_DASHBOARD', 'Ver Dashboard Gerencial', 'Acceso al dashboard ejecutivo, KPIs globales y Podio de Honor'),
(2, 'VER_REPORTES', 'Ver Reportes y Analítica', 'Acceso a reportes dinámicos, multi-filtros y avance de 13 actividades'),
(3, 'VER_INSPECCIONES', 'Ver Inspecciones de Campo', 'Auditar y consultar visitas de campo con fotos, GPS y porcentajes'),
(4, 'VER_BENEFICIARIOS', 'Ver Beneficiarios', 'Consultar base de datos y búsqueda de beneficiarios'),
(5, 'GESTIONAR_INSPECTORES', 'Gestionar Inspectores', 'Crear, editar, activar y desactivar inspectores'),
(6, 'ASIGNAR_ZONAS', 'Asignar Zonas Territoriales', 'Asignar municipios y veredas de trabajo a inspectores'),
(7, 'EDITAR_PIN_INSPECTOR', 'Modificar PIN de Acceso', 'Cambiar el PIN o credenciales de los inspectores'),
(8, 'GESTIONAR_ROLES', 'Gestionar Roles y Permisos', 'Configurar y asignar permisos por rol en la matriz'),
(9, 'EXPORTAR_DATOS', 'Exportar Datos a Excel / CSV', 'Descargar información consolidada en Excel o CSV'),
(10, 'DILIGENCIAR_FORMULARIO', 'Diligenciar Formulario en Campo', 'Permiso para realizar y sincronizar visitas técnicas en campo');

-- 4. INSERTAR ROL_PERMISOS
INSERT INTO \`rol_permisos\` (\`rol_id\`, \`permiso_id\`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 10);

-- 5. INSERTAR USUARIO ADMINISTRADOR PRINCIPAL
INSERT INTO \`usuarios\` (\`id\`, \`nombre\`, \`usuario\`, \`documento\`, \`pin\`, \`rol_id\`, \`cargo\`, \`activo\`) VALUES
(1, 'Administrador Principal', 'admin', '00000000', '1234', 1, 'Super Administrador', 1);

-- 6. INSERTAR 13 CAPÍTULOS OFICIALES DE CONSTRUCCIÓN
INSERT INTO \`actividades_inspeccion\` (\`id\`, \`orden\`, \`nombre\`, \`peso_porcentual\`, \`activo\`) VALUES
(1, 1, 'Preliminares', 0.169, 1),
(2, 2, 'Cimentación', 10.024, 1),
(3, 3, 'Mampostería', 3.608, 1),
(4, 4, 'Estructura', 8.490, 1),
(5, 5, 'Cubierta', 6.159, 1),
(6, 6, 'Instalaciones Sanitarias', 9.243, 1),
(7, 7, 'Instalaciones Hidráulicas', 6.813, 1),
(8, 8, 'Instalaciones Eléctricas', 1.965, 1),
(9, 9, 'Acabados - Pañetes', 12.000, 1),
(10, 10, 'Acabados - Enchapes', 5.058, 1),
(11, 11, 'Carpintería Metálica', 3.181, 1),
(12, 12, 'Tanques Sépticos', 29.617, 1),
(13, 13, 'Campo de Infiltración', 3.673, 1);
\n`;

    // Volcar Municipios
    const [munRows] = await conn.query('SELECT * FROM municipios ORDER BY id ASC');
    if (munRows.length > 0) {
      sqlDump += `-- 7. INSERTAR MUNICIPIOS (${munRows.length})\n`;
      sqlDump += `INSERT INTO \`municipios\` (\`id\`, \`nombre\`) VALUES\n`;
      sqlDump += munRows.map(m => `(${m.id}, ${mysql.escape(m.nombre)})`).join(',\n') + ';\n\n';
    }

    // Volcar Veredas
    const [verRows] = await conn.query('SELECT * FROM veredas ORDER BY id ASC');
    if (verRows.length > 0) {
      sqlDump += `-- 8. INSERTAR VEREDAS (${verRows.length})\n`;
      sqlDump += `INSERT INTO \`veredas\` (\`id\`, \`municipio_id\`, \`nombre\`) VALUES\n`;
      sqlDump += verRows.map(v => `(${v.id}, ${v.municipio_id}, ${mysql.escape(v.nombre)})`).join(',\n') + ';\n\n';
    }

    // Volcar Beneficiarios en bloques de 200
    const [benRows] = await conn.query('SELECT * FROM beneficiarios ORDER BY id ASC');
    if (benRows.length > 0) {
      sqlDump += `-- 9. INSERTAR BENEFICIARIOS OFICIALES (${benRows.length})\n`;
      const chunkSize = 200;
      for (let i = 0; i < benRows.length; i += chunkSize) {
        const chunk = benRows.slice(i, i + chunkSize);
        sqlDump += `INSERT INTO \`beneficiarios\` (\`id\`, \`fase\`, \`municipio_id\`, \`vereda_id\`, \`nombre\`, \`documento\`, \`estado\`, \`coordenadas\`) VALUES\n`;
        sqlDump += chunk.map(b => `(${b.id}, ${b.fase}, ${b.municipio_id}, ${b.vereda_id}, ${mysql.escape(b.nombre)}, ${mysql.escape(b.documento)}, ${b.estado}, ${mysql.escape(b.coordenadas)})`).join(',\n') + ';\n';
      }
      sqlDump += '\n';
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    const outputPath = path.join(__dirname, '..', 'database_clean_production.sql');
    fs.writeFileSync(outputPath, sqlDump, 'utf8');
    console.log(`✓ Archivo database_clean_production.sql generado exitosamente en: ${outputPath}`);
  } catch (err) {
    console.error('Error al generar volcado SQL:', err);
  } finally {
    await conn.end();
  }
}

generateFullDump();
