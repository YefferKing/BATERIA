-- =============================================================================
-- BASE DE DATOS: flota
-- SISTEMA DE GESTIÓN LOGÍSTICA, CUBICACIÓN Y DESPACHO DE MATERIALES
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `flota` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `flota`;

-- 1. Roles del Sistema
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(50) NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `roles` (`id`, `nombre`, `descripcion`) VALUES
(1, 'admin', 'Administrador General / Director Logístico'),
(2, 'almacen', 'Encargado de Compras y Almacén Central'),
(3, 'conductor', 'Conductor / Transportista de Flota'),
(4, 'bodega_satelite', 'Responsable de Bodega Satélite Municipal')
ON DUPLICATE KEY UPDATE `nombre`=VALUES(`nombre`), `descripcion`=VALUES(`descripcion`);

-- 2. Permisos
CREATE TABLE IF NOT EXISTS `permisos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clave` VARCHAR(50) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `permisos` (`id`, `clave`, `nombre`, `descripcion`) VALUES
(1, 'VER_PANEL_CONTROL', 'Ver Panel y KPIs Logísticos', 'Acceso al dashboard general de abastecimiento y métricas'),
(2, 'GESTIONAR_PROVEEDORES', 'Gestionar Proveedores', 'Crear, editar y listar proveedores de materiales'),
(3, 'GESTIONAR_ARTICULOS', 'Gestionar Catálogo de Artículos', 'Crear y configurar pesos, medidas y clasificación de materiales'),
(4, 'REGISTRAR_COMPRAS', 'Registrar Compras y Entradas', 'Ingresar compras de materiales que alimentan el inventario'),
(5, 'CONSULTAR_STOCK', 'Consultar Stock e Inventario', 'Ver existencias en tiempo real por bodega central y satélites'),
(6, 'GESTIONAR_VEHICULOS', 'Gestionar Flota y Vehículos', 'Registrar camiones, capacidades de peso y dimensiones útiles'),
(7, 'CREAR_ORDENES_DESPACHO', 'Crear Órdenes de Despacho', 'Armar pedidos y ejecutar el algoritmo de cubicación de carga'),
(8, 'VER_MIS_VIAJES_CONDUCTOR', 'Ver Mis Viajes (Conductor)', 'Vista móvil especializada para el transportista en carretera'),
(9, 'CONFIRMAR_ENTREGA', 'Confirmar Entrega y Firma', 'Registrar fotos de entrega y firma digital del receptor'),
(10, 'GESTIONAR_BODEGAS', 'Gestionar Bodegas Satélite', 'Administrar bodegas municipales de acopio intermedio')
ON DUPLICATE KEY UPDATE `nombre`=VALUES(`nombre`), `descripcion`=VALUES(`descripcion`);

-- 3. Rol - Permisos
CREATE TABLE IF NOT EXISTS `rol_permisos` (
  `rol_id` INT NOT NULL,
  `permiso_id` INT NOT NULL,
  PRIMARY KEY (`rol_id`, `permiso_id`),
  FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Asignar permisos completos a admin
INSERT IGNORE INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),
(2,1),(2,2),(2,3),(2,4),(2,5),(2,7),
(3,8),(3,9),
(4,5),(4,9),(4,10);

-- 4. Usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(120) NOT NULL,
  `usuario` VARCHAR(50) NOT NULL UNIQUE,
  `documento` VARCHAR(30) NOT NULL UNIQUE,
  `pin` VARCHAR(10) NOT NULL,
  `rol_id` INT NOT NULL DEFAULT 3,
  `telefono` VARCHAR(30) NULL,
  `licencia_conduccion` VARCHAR(50) NULL,
  `cargo` VARCHAR(100) DEFAULT 'Colaborador',
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuario Admin inicial
INSERT INTO `usuarios` (`id`, `nombre`, `usuario`, `documento`, `pin`, `rol_id`, `cargo`, `activo`) VALUES
(1, 'Director Logístico', 'admin', '00000000', '1234', 1, 'Super Administrador de Flota', 1)
ON DUPLICATE KEY UPDATE `nombre`=VALUES(`nombre`);

-- 5. Las 13 Actividades Constructivas Oficiales
CREATE TABLE IF NOT EXISTS `actividades_constructivas` (
  `id` INT PRIMARY KEY,
  `orden` INT NOT NULL,
  `nombre` VARCHAR(120) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `activo` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `actividades_constructivas` (`id`, `orden`, `nombre`, `descripcion`) VALUES
(1, 1, 'PRELIMINARES', 'Localización, replanteo, excavación y campamento'),
(2, 2, 'CIMENTACIÓN', 'Zapatas, vigas de amarre y ciclópeo'),
(3, 3, 'DESAGÜES E INSTALACIONES SUBTERRÁNEAS', 'Tuberías sanitarias, cajas de inspección y drenaje'),
(4, 4, 'ESTRUCTURA', 'Columnas, columnetas y vigas de confinamiento'),
(5, 5, 'MAMPOSTERÍA', 'Muros en bloque o ladrillo tolete confinado'),
(6, 6, 'INSTALACIONES HIDRÁULICAS Y SANITARIAS', 'Redes de agua potable y aparatos sanitarios'),
(7, 7, 'INSTALACIONES ELÉCTRICAS', 'Ductería, cableado, luminarias e interruptores'),
(8, 8, 'CUBIERTA', 'Estructura metálica/madera y tejas onduladas'),
(9, 9, 'PISOS Y ACABADOS', 'Placas de concreto, enchapes y afinado de piso'),
(10, 10, 'PAÑETES Y ENCHAPES', 'Revoques muros y enchapes cerámicos en zona húmeda'),
(11, 11, 'CARPINTERÍA METÁLICA Y/O MADERA', 'Puertas metálicas, marcos y ventanas de ventilación'),
(12, 12, 'PINTURA', 'Vinilo y esmalte anticorrosivo en muros y marcos'),
(13, 13, 'TRATAMIENTO DE AGUAS RESIDUALES (TANQUE SÉPTICO)', 'Tanques sépticos, trampa de grasas y pozo de infiltración')
ON DUPLICATE KEY UPDATE `nombre`=VALUES(`nombre`), `orden`=VALUES(`orden`);

-- 6. Proveedores
CREATE TABLE IF NOT EXISTS `proveedores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `razon_social` VARCHAR(150) NOT NULL,
  `nit` VARCHAR(30) NOT NULL UNIQUE,
  `contacto_nombre` VARCHAR(100) NULL,
  `telefono` VARCHAR(30) NULL,
  `email` VARCHAR(100) NULL,
  `direccion` VARCHAR(200) NULL,
  `municipio` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Catálogo de Artículos y Materiales con Ficha Técnica
CREATE TABLE IF NOT EXISTS `articulos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(30) NOT NULL UNIQUE,
  `nombre` VARCHAR(150) NOT NULL,
  `actividad_id` INT NOT NULL,
  `unidad_medida` VARCHAR(30) NOT NULL, -- Bulto, Unidad, Varilla, Galon, M2, Tubo
  `peso_unitario_kg` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `largo_m` DECIMAL(6,2) NOT NULL DEFAULT 0.50,
  `ancho_m` DECIMAL(6,2) NOT NULL DEFAULT 0.50,
  `alto_m` DECIMAL(6,2) NOT NULL DEFAULT 0.50,
  `volumen_m3` DECIMAL(10,4) NOT NULL DEFAULT 0.1250,
  `precio_referencia` DECIMAL(12,2) DEFAULT 0.00,
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`actividad_id`) REFERENCES `actividades_constructivas`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Bodegas (Principal y Satélites Municipales)
CREATE TABLE IF NOT EXISTS `bodegas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `tipo` ENUM('CENTRAL', 'SATELITE_MUNICIPAL') NOT NULL DEFAULT 'SATELITE_MUNICIPAL',
  `municipio` VARCHAR(100) NOT NULL,
  `direccion` VARCHAR(200) NULL,
  `responsable_nombre` VARCHAR(100) NULL,
  `telefono` VARCHAR(30) NULL,
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bodega Central inicial
INSERT INTO `bodegas` (`id`, `nombre`, `tipo`, `municipio`, `direccion`, `responsable_nombre`, `telefono`, `activo`) VALUES
(1, 'Bodega Central de Materiales (Cúcuta)', 'CENTRAL', 'Cúcuta', 'Zona Industrial Km 2', 'Almacenista General', '3100000000', 1)
ON DUPLICATE KEY UPDATE `nombre`=VALUES(`nombre`);

-- 9. Stock de Inventario por Bodega
CREATE TABLE IF NOT EXISTS `stock_bodega` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bodega_id` INT NOT NULL,
  `articulo_id` INT NOT NULL,
  `cantidad_disponible` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `cantidad_reservada` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock_minimo` DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_bodega_articulo` (`bodega_id`, `articulo_id`),
  FOREIGN KEY (`bodega_id`) REFERENCES `bodegas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`articulo_id`) REFERENCES `articulos`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Compras y Entradas de Almacén
CREATE TABLE IF NOT EXISTS `compras` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `numero_factura` VARCHAR(50) NOT NULL,
  `proveedor_id` INT NOT NULL,
  `bodega_destino_id` INT NOT NULL,
  `fecha_compra` DATE NOT NULL,
  `total_valor` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('RECIBIDA', 'ANULADA') NOT NULL DEFAULT 'RECIBIDA',
  `observaciones` TEXT NULL,
  `creado_por` INT NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`),
  FOREIGN KEY (`bodega_destino_id`) REFERENCES `bodegas`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `compras_detalle` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `compra_id` INT NOT NULL,
  `articulo_id` INT NOT NULL,
  `cantidad` DECIMAL(10,2) NOT NULL,
  `precio_unitario` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`articulo_id`) REFERENCES `articulos`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Flota de Vehículos
CREATE TABLE IF NOT EXISTS `vehiculos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `placa` VARCHAR(15) NOT NULL UNIQUE,
  `tipo` ENUM('TURBO', 'CAMION_SENCILLO', 'DOBLE_TROQUE', 'CAMIONETA_4X4', 'TRACTOCAMION') NOT NULL DEFAULT 'TURBO',
  `marca` VARCHAR(50) NOT NULL,
  `modelo_anio` INT NOT NULL DEFAULT 2020,
  `conductor_id` INT NULL,
  `capacidad_peso_kg` DECIMAL(10,2) NOT NULL DEFAULT 3500.00, -- Ej: 3.5 Ton = 3500 Kg
  `capacidad_volumen_m3` DECIMAL(10,2) NOT NULL DEFAULT 18.00, -- Ej: 18 m3
  `largo_util_m` DECIMAL(6,2) NOT NULL DEFAULT 4.50,
  `ancho_util_m` DECIMAL(6,2) NOT NULL DEFAULT 2.10,
  `alto_util_m` DECIMAL(6,2) NOT NULL DEFAULT 2.20,
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`conductor_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Municipios, Veredas y Beneficiarios (Espejo / Vinculado al Universo de 1.399)
CREATE TABLE IF NOT EXISTS `municipios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `veredas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `municipio_id` INT NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  FOREIGN KEY (`municipio_id`) REFERENCES `municipios`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `beneficiarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `fase` INT NOT NULL DEFAULT 1,
  `municipio_id` INT NOT NULL,
  `vereda_id` INT NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `documento` VARCHAR(50) NOT NULL,
  `telefono` VARCHAR(30) NULL,
  `coordenadas` VARCHAR(100) NULL,
  FOREIGN KEY (`municipio_id`) REFERENCES `municipios`(`id`),
  FOREIGN KEY (`vereda_id`) REFERENCES `veredas`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Órdenes de Despacho
CREATE TABLE IF NOT EXISTS `ordenes_despacho` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo_orden` VARCHAR(30) NOT NULL UNIQUE, -- Ej: ORD-2026-0001
  `tipo_origen` ENUM('BODEGA_CENTRAL', 'PROVEEDOR_DIRECTO') NOT NULL DEFAULT 'BODEGA_CENTRAL',
  `origen_bodega_id` INT NULL,
  `origen_proveedor_id` INT NULL,
  `tipo_destino` ENUM('BENEFICIARIO_DIRECTO', 'BODEGA_SATELITE') NOT NULL DEFAULT 'BENEFICIARIO_DIRECTO',
  `destino_beneficiario_id` INT NULL,
  `destino_bodega_id` INT NULL,
  `vehiculo_id` INT NOT NULL,
  `conductor_id` INT NOT NULL,
  `peso_total_kg` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `volumen_total_m3` DECIMAL(10,4) NOT NULL DEFAULT 0.00,
  `porcentaje_ocupacion_peso` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `porcentaje_ocupacion_volumen` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('BORRADOR', 'DESPACHADA', 'EN_RUTA', 'ENTREGADA', 'CANCELADA') NOT NULL DEFAULT 'BORRADOR',
  `fecha_programada` DATE NOT NULL,
  `fecha_despacho` DATETIME NULL,
  `fecha_entrega` DATETIME NULL,
  `observaciones` TEXT NULL,
  `creado_por` INT NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`origen_bodega_id`) REFERENCES `bodegas`(`id`),
  FOREIGN KEY (`origen_proveedor_id`) REFERENCES `proveedores`(`id`),
  FOREIGN KEY (`destino_beneficiario_id`) REFERENCES `beneficiarios`(`id`),
  FOREIGN KEY (`destino_bodega_id`) REFERENCES `bodegas`(`id`),
  FOREIGN KEY (`vehiculo_id`) REFERENCES `vehiculos`(`id`),
  FOREIGN KEY (`conductor_id`) REFERENCES `usuarios`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ordenes_detalle` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_id` INT NOT NULL,
  `articulo_id` INT NOT NULL,
  `cantidad` DECIMAL(10,2) NOT NULL,
  `peso_unitario_kg` DECIMAL(10,2) NOT NULL,
  `volumen_unitario_m3` DECIMAL(10,4) NOT NULL,
  `peso_subtotal_kg` DECIMAL(10,2) NOT NULL,
  `volumen_subtotal_m3` DECIMAL(10,4) NOT NULL,
  FOREIGN KEY (`orden_id`) REFERENCES `ordenes_despacho`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`articulo_id`) REFERENCES `articulos`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Evidencias de Entrega y Firma Digital
CREATE TABLE IF NOT EXISTS `entregas_evidencia` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orden_id` INT NOT NULL UNIQUE,
  `fecha_entrega` DATETIME NOT NULL,
  `recibido_por_nombre` VARCHAR(150) NOT NULL,
  `recibido_por_documento` VARCHAR(50) NOT NULL,
  `recibido_por_rol` VARCHAR(50) DEFAULT 'Beneficiario',
  `firma_digital_base64` LONGTEXT NULL,
  `foto_descarga_url` TEXT NULL,
  `coordenadas_gps` VARCHAR(100) NULL,
  `observaciones` TEXT NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`orden_id`) REFERENCES `ordenes_despacho`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
