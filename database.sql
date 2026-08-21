-- ====================================================================
-- BASE DE DATOS: bateria
-- Tablas: roles, permisos, rol_permisos, usuarios
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `bateria` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `bateria`;

-- 1. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(50) NOT NULL UNIQUE,
  `descripcion` VARCHAR(200) NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. TABLA DE PERMISOS
CREATE TABLE IF NOT EXISTS `permisos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clave` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. TABLA INTERMEDIA: ROL_PERMISOS
CREATE TABLE IF NOT EXISTS `rol_permisos` (
  `rol_id` INT NOT NULL,
  `permiso_id` INT NOT NULL,
  PRIMARY KEY (`rol_id`, `permiso_id`),
  FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(150) NOT NULL,
  `usuario` VARCHAR(50) NOT NULL UNIQUE,
  `documento` VARCHAR(50) NOT NULL UNIQUE,
  `pin` VARCHAR(20) NOT NULL,
  `rol_id` INT NOT NULL,
  `cargo` VARCHAR(100) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. TABLA DE MUNICIPIOS
CREATE TABLE IF NOT EXISTS `municipios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. TABLA DE VEREDAS
CREATE TABLE IF NOT EXISTS `veredas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `municipio_id` INT NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  FOREIGN KEY (`municipio_id`) REFERENCES `municipios`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_municipio_vereda` (`municipio_id`, `nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. TABLA DE BENEFICIARIOS
CREATE TABLE IF NOT EXISTS `beneficiarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `fase` INT NOT NULL DEFAULT 1,
  `municipio_id` INT NOT NULL,
  `vereda_id` INT NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `documento` VARCHAR(50) NOT NULL,
  `estado` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: VIVO, 0: FALLECIDO',
  `coordenadas` VARCHAR(150) NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`municipio_id`) REFERENCES `municipios`(`id`),
  FOREIGN KEY (`vereda_id`) REFERENCES `veredas`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. TABLA DE ACTIVIDADES DE INSPECCIÓN (13 Capítulos Parametrizables)
CREATE TABLE IF NOT EXISTS `actividades_inspeccion` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden` INT NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `peso_porcentual` DECIMAL(5,2) NOT NULL DEFAULT 7.69 COMMENT 'Ponderación porcentual sobre 100%',
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. TABLA DE ASIGNACIÓN TERRITORIAL (Inspectores -> Municipios y Veredas)
CREATE TABLE IF NOT EXISTS `usuario_veredas` (
  `usuario_id` INT NOT NULL,
  `municipio_id` INT NOT NULL,
  `vereda_id` INT NOT NULL,
  `asignado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`, `vereda_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`municipio_id`) REFERENCES `municipios`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vereda_id`) REFERENCES `veredas`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. TABLA DE INSPECCIONES (Visitas de Campo a Beneficiarios)
CREATE TABLE IF NOT EXISTS `inspecciones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `beneficiario_id` INT NOT NULL,
  `inspector_id` INT NOT NULL,
  `fecha_visita` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `avance_global` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `estado_bateria` ENUM('SIN_INICIAR', 'EN_EJECUCION', 'TERMINADO') NOT NULL DEFAULT 'SIN_INICIAR',
  `coordenadas_gps` VARCHAR(150) NULL,
  `observaciones` TEXT NULL,
  `fotos` LONGTEXT NULL COMMENT 'JSON con fotos base64 o rutas',
  `sincronizado` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`beneficiario_id`) REFERENCES `beneficiarios`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`inspector_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. TABLA DE DETALLES DE INSPECCIÓN (Calificación de los 13 Capítulos)
CREATE TABLE IF NOT EXISTS `inspeccion_detalles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `inspeccion_id` INT NOT NULL,
  `actividad_id` INT NOT NULL,
  `porcentaje` INT NOT NULL DEFAULT 0 COMMENT '0, 25, 50, 75, 100',
  `estado_actividad` ENUM('SIN_INICIAR', 'EN_EJECUCION', 'TERMINADO') NOT NULL DEFAULT 'SIN_INICIAR',
  `peso_porcentual` DECIMAL(6,3) NOT NULL DEFAULT 7.690,
  `observacion_item` VARCHAR(255) NULL,
  FOREIGN KEY (`inspeccion_id`) REFERENCES `inspecciones`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actividad_id`) REFERENCES `actividades_inspeccion`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar los 13 Capítulos / Actividades Constructivas
INSERT INTO `actividades_inspeccion` (`orden`, `nombre`, `peso_porcentual`, `activo`) VALUES
(1, 'Preliminares', 0.169, 1),
(2, 'Cimentación', 10.024, 1),
(3, 'Mampostería', 3.608, 1),
(4, 'Estructura', 8.490, 1),
(5, 'Cubierta', 6.159, 1),
(6, 'Instalaciones Sanitarias', 9.243, 1),
(7, 'Instalaciones Hidráulicas', 6.813, 1),
(8, 'Instalaciones Eléctricas', 1.965, 1),
(9, 'Acabados - Pañetes', 12.000, 1),
(10, 'Acabados - Enchapes', 5.058, 1),
(11, 'Carpintería Metálica', 3.181, 1),
(12, 'Tanques Sépticos', 29.617, 1),
(13, 'Campo de Infiltración', 3.673, 1);
ON DUPLICATE KEY UPDATE `nombre`=`nombre`;

-- ====================================================================
-- DATOS INICIALES Y CATÁLOGO DEL SISTEMA
-- ====================================================================

-- 1. Insertar Roles del Sistema
INSERT INTO `roles` (`id`, `nombre`, `descripcion`) VALUES
(1, 'admin', 'Administrador con acceso total al sistema, reportes y gestión de inspectores'),
(2, 'inspector', 'Inspector de campo con acceso restringido para diligenciar formularios de visita técnica')
ON DUPLICATE KEY UPDATE `nombre`=VALUES(`nombre`), `descripcion`=VALUES(`descripcion`);

-- 2. Insertar Catálogo Completo de Permisos (10 Permisos)
INSERT INTO `permisos` (`id`, `clave`, `nombre`, `descripcion`) VALUES
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
ON DUPLICATE KEY UPDATE `clave`=VALUES(`clave`), `nombre`=VALUES(`nombre`), `descripcion`=VALUES(`descripcion`);

-- 3. Asignar Permisos a Roles por Defecto
-- Rol Administrador: Acceso Completo (Permisos 1 al 10)
INSERT IGNORE INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10);

-- Rol Inspector: Solo Diligenciar Formulario en Campo (Permiso 10)
INSERT IGNORE INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(2, 10);

-- 4. Insertar Usuario Administrador por Defecto
INSERT INTO `usuarios` (`id`, `nombre`, `usuario`, `documento`, `pin`, `rol_id`, `cargo`, `activo`) VALUES
(1, 'Administrador Principal', 'admin', '00000000', '1234', 1, 'Super Administrador', 1)
ON DUPLICATE KEY UPDATE `id`=`id`;
