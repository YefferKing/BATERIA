const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  host: process.env.DB_HOST || 'bateria.cypwu0wsknim.us-east-1.rds.amazonaws.com',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Baterias2026*',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  multipleStatements: true
};

async function initFlotaDatabase() {
  console.log('🚀 Conectando a MySQL para inicializar base de datos "flota"...');
  let connection = null;

  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Conexión establecida con éxito a MySQL en:', config.host);

    // 1. Crear base de datos flota
    console.log('1. Creando base de datos "flota"...');
    await connection.query('CREATE DATABASE IF NOT EXISTS `flota` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await connection.query('USE `flota`;');

    // 2. Ejecutar DDL desde database.sql
    console.log('2. Creando tablas y estructura en "flota"...');
    const sqlPath = path.join(__dirname, '..', 'database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await connection.query(sqlContent);
    console.log('✓ Estructura de tablas y roles creada exitosamente.');

    // 3. Sembrar catálogo de Artículos / Materiales clasificados por las 13 actividades
    console.log('3. Sembrando catálogo oficial de Materiales de Construcción con pesos y medidas...');
    const articulosSeed = [
      // Actividad 1: Preliminares
      ['MAT-001', 'Madera de Replanteo / Estacas (Docena)', 1, 'Docena', 15.00, 1.20, 0.30, 0.30, 0.1080, 45000.00],
      ['MAT-002', 'Lona de Cerramiento Verde (Rollo 50m)', 1, 'Rollo', 12.00, 1.00, 0.40, 0.40, 0.1600, 120000.00],

      // Actividad 2: Cimentación
      ['MAT-003', 'Cemento Gris Tipo Portland (Bulto 50 Kg)', 2, 'Bulto', 50.00, 0.60, 0.40, 0.15, 0.0360, 32000.00],
      ['MAT-004', 'Arena Gruesa Lavada (Metro Cúbico m³)', 2, 'M3', 1400.00, 1.00, 1.00, 1.00, 1.0000, 85000.00],
      ['MAT-005', 'Triturado 1/2" (Metro Cúbico m³)', 2, 'M3', 1500.00, 1.00, 1.00, 1.00, 1.0000, 95000.00],
      ['MAT-006', 'Malla Electrosoldada M-084 (Rollo 2.4x6m)', 2, 'Unidad', 25.00, 2.40, 0.40, 0.40, 0.3840, 180000.00],

      // Actividad 3: Desagües
      ['MAT-007', 'Tubo Sanitario PVC 4" (Tubo x 6 Metros)', 3, 'Tubo', 6.50, 6.00, 0.12, 0.12, 0.0864, 68000.00],
      ['MAT-008', 'Tubo Sanitario PVC 2" (Tubo x 6 Metros)', 3, 'Tubo', 3.20, 6.00, 0.06, 0.06, 0.0216, 38000.00],
      ['MAT-009', 'Caja de Inspección Prefabricada 40x40cm', 3, 'Unidad', 35.00, 0.45, 0.45, 0.45, 0.0911, 75000.00],

      // Actividad 4: Estructura
      ['MAT-010', 'Varilla Corrugada 3/8" (Unidad x 6 Metros)', 4, 'Varilla', 3.33, 6.00, 0.02, 0.02, 0.0024, 24000.00],
      ['MAT-011', 'Varilla Corrugada 1/2" (Unidad x 6 Metros)', 4, 'Varilla', 5.92, 6.00, 0.02, 0.02, 0.0024, 42000.00],
      ['MAT-012', 'Alambre Negro Recocido #18 (Kilo)', 4, 'Kilo', 1.00, 0.20, 0.20, 0.20, 0.0080, 8500.00],

      // Actividad 5: Mampostería
      ['MAT-013', 'Bloque de Cemento #4 (Unidad)', 5, 'Unidad', 8.50, 0.40, 0.10, 0.20, 0.0080, 2600.00],
      ['MAT-014', 'Ladrillo Tolete Común (Unidad)', 5, 'Unidad', 2.80, 0.24, 0.12, 0.06, 0.0017, 1200.00],

      // Actividad 6: Hidráulicas y Sanitarias
      ['MAT-015', 'Inodoro Sanitario Blanco con Tanque', 6, 'Juego', 28.00, 0.70, 0.45, 0.75, 0.2363, 240000.00],
      ['MAT-016', 'Lavamanos de Colgar Porcelana Blanca', 6, 'Unidad', 12.00, 0.45, 0.40, 0.35, 0.0630, 95000.00],
      ['MAT-017', 'Ducha Cromada con Llave y Registro', 6, 'Juego', 1.50, 0.30, 0.20, 0.15, 0.0090, 65000.00],
      ['MAT-018', 'Tubo Presión PVC 1/2" RDE 13.5 (Tubo x 6m)', 6, 'Tubo', 1.80, 6.00, 0.03, 0.03, 0.0054, 18000.00],

      // Actividad 7: Eléctricas
      ['MAT-019', 'Luminaria LED Panel 18W Sobreponer', 7, 'Unidad', 0.80, 0.25, 0.25, 0.05, 0.0031, 28000.00],
      ['MAT-020', 'Tubo Conduit PVC 1/2" (Tubo x 3 Metros)', 7, 'Tubo', 0.90, 3.00, 0.03, 0.03, 0.0027, 8500.00],

      // Actividad 8: Cubierta
      ['MAT-021', 'Teja Ondulada Fibrocemento #6 (1.83x0.92m)', 8, 'Unidad', 18.50, 1.83, 0.92, 0.05, 0.0842, 58000.00],
      ['MAT-022', 'Caballete Articulado para Teja (Par)', 8, 'Par', 8.00, 0.95, 0.35, 0.15, 0.0499, 42000.00],
      ['MAT-023', 'Perfil C Metálico 100x50x1.5mm (Tira 6m)', 8, 'Unidad', 14.20, 6.00, 0.10, 0.05, 0.0300, 92000.00],

      // Actividad 9 y 10: Pisos y Enchapes
      ['MAT-024', 'Cerámica para Piso Tráfico Medio (Caja 1.5m²)', 9, 'Caja', 22.00, 0.45, 0.45, 0.10, 0.0203, 48000.00],
      ['MAT-025', 'Enchape de Pared Blanco Brillante (Caja 1.5m²)', 10, 'Caja', 20.00, 0.40, 0.30, 0.12, 0.0144, 45000.00],
      ['MAT-026', 'Pega Corficol / Pegacor Gris (Bulto 25 Kg)', 10, 'Bulto', 25.00, 0.50, 0.35, 0.12, 0.0210, 26000.00],

      // Actividad 11: Carpintería
      ['MAT-027', 'Puerta Metálica con Marco y Cerradura (2.10x0.90m)', 11, 'Unidad', 24.00, 2.10, 0.90, 0.08, 0.1512, 380000.00],
      ['MAT-028', 'Ventana de Aluminio con Vidrio (0.60x0.40m)', 11, 'Unidad', 5.50, 0.60, 0.40, 0.08, 0.0192, 110000.00],

      // Actividad 12: Pintura
      ['MAT-029', 'Cuñete Pintura Tipo 1 Blanco (5 Galones)', 12, 'Cuñete', 22.00, 0.35, 0.35, 0.45, 0.0551, 165000.00],
      ['MAT-030', 'Galón Esmalte Anticorrosivo Gris', 12, 'Galon', 4.80, 0.20, 0.20, 0.25, 0.0100, 68000.00],

      // Actividad 13: Tanque Séptico
      ['MAT-031', 'Tanque Séptico Cónico Plástico 1.000 Litros', 13, 'Unidad', 48.00, 1.40, 1.40, 1.30, 2.5480, 890000.00],
      ['MAT-032', 'Trampa de Grasas Plástica 150 Litros', 13, 'Unidad', 12.00, 0.60, 0.60, 0.70, 0.2520, 260000.00]
    ];

    const insertArtSql = `
      INSERT INTO articulos (codigo, nombre, actividad_id, unidad_medida, peso_unitario_kg, largo_m, ancho_m, alto_m, volumen_m3, precio_referencia)
      VALUES ?
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), peso_unitario_kg=VALUES(peso_unitario_kg), largo_m=VALUES(largo_m), ancho_m=VALUES(ancho_m), alto_m=VALUES(alto_m), volumen_m3=VALUES(volumen_m3), precio_referencia=VALUES(precio_referencia);
    `;
    await connection.query(insertArtSql, [articulosSeed]);
    console.log(`✓ ${articulosSeed.length} Artículos sembrados con peso, medidas y cubicaje.`);

    // 4. Sembrar Proveedores representativos
    console.log('4. Sembrando Proveedores...');
    const proveedoresSeed = [
      ['Ferretería Central El Catatumbo S.A.S.', '901234567-1', 'Carlos Mendoza', '3124567890', 'ventas@ferrecentral.com', 'Av. 5 #10-20', 'Cúcuta'],
      ['Distribuidora de Cementos y Aceros Ocaña', '900876543-2', 'Patricia Gómez', '3157891234', 'pedidos@acerosocana.com', 'Calle 11 #4-50', 'Ocaña'],
      ['Plásticos y Tanques del Oriente', '901456123-3', 'Mauricio Rangel', '3186549870', 'contacto@tanquesoriente.com', 'Zona Industrial', 'Cúcuta'],
      ['Materiales y Agregados Tibú', '800543210-4', 'Jorge Peñaranda', '3112345678', 'agregados@tibu.com', 'Km 1 Vía El Tarra', 'Tibú']
    ];
    const insertProvSql = `
      INSERT INTO proveedores (razon_social, nit, contacto_nombre, telefono, email, direccion, municipio)
      VALUES ?
      ON DUPLICATE KEY UPDATE razon_social=VALUES(razon_social), telefono=VALUES(telefono);
    `;
    await connection.query(insertProvSql, [proveedoresSeed]);
    console.log('✓ Proveedores sembrados.');

    // 5. Sembrar Bodegas Satélite Municipales
    console.log('5. Sembrando Bodegas Satélite Municipales...');
    const bodegasSeed = [
      ['Bodega Satélite Convención', 'SATELITE_MUNICIPAL', 'Convención', 'Barrio El Centro, Cra 4 #5-12', 'Coordinador Convención', '3141112233'],
      ['Bodega Satélite Teorama', 'SATELITE_MUNICIPAL', 'Teorama', 'Salida a San Calixto Km 1', 'Coordinador Teorama', '3142223344'],
      ['Bodega Satélite El Tarra', 'SATELITE_MUNICIPAL', 'El Tarra', 'Calle Principal #8-30', 'Coordinador El Tarra', '3143334455'],
      ['Bodega Satélite Tibú', 'SATELITE_MUNICIPAL', 'Tibú', 'Barrio Barco, Vía La Gabarra', 'Coordinador Tibú', '3144445566']
    ];
    const insertBodegaSql = `
      INSERT INTO bodegas (nombre, tipo, municipio, direccion, responsable_nombre, telefono)
      VALUES ?
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
    `;
    await connection.query(insertBodegaSql, [bodegasSeed]);
    console.log('✓ Bodegas Central y Satélites configuradas.');

    // 6. Sembrar Conductores y Flota de Vehículos
    console.log('6. Sembrando Conductores y Vehículos...');
    const conductoresSeed = [
      ['Javier Rodríguez (Conductor)', 'conductor1', '1090111222', '1234', 3, '3101234567', 'C2-1090111', 'Conductor Titular Turbo', 1],
      ['Mario Becerra (Conductor)', 'conductor2', '1090222333', '1234', 3, '3119876543', 'C3-1090222', 'Conductor Titular Sencillo', 1],
      ['Andrés Galvis (Conductor)', 'conductor3', '1090333444', '1234', 3, '3135557788', 'C2-1090333', 'Conductor Camioneta 4x4', 1]
    ];
    for (const c of conductoresSeed) {
      await connection.query(
        'INSERT INTO usuarios (nombre, usuario, documento, pin, rol_id, telefono, licencia_conduccion, cargo, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), pin=VALUES(pin);',
        c
      );
    }

    const [condRows] = await connection.query('SELECT id, usuario FROM usuarios WHERE rol_id = 3 ORDER BY id ASC');
    const idC1 = condRows[0] ? condRows[0].id : 1;
    const idC2 = condRows[1] ? condRows[1].id : 1;
    const idC3 = condRows[2] ? condRows[2].id : 1;

    const vehiculosSeed = [
      ['WLM-456', 'TURBO', 'NPR Chevrolet Furgon', 2022, idC1, 4500.00, 22.00, 5.20, 2.20, 2.20, 1], // 4.5 Ton, 22 m3
      ['TTK-789', 'CAMION_SENCILLO', 'Kodiak Chevrolet Estacas', 2019, idC2, 8500.00, 36.00, 6.80, 2.40, 2.30, 1], // 8.5 Ton, 36 m3
      ['HGY-123', 'CAMIONETA_4X4', 'Toyota Hilux Platon', 2023, idC3, 1100.00, 4.50, 2.20, 1.50, 1.40, 1] // 1.1 Ton, 4.5 m3
    ];

    const insertVehSql = `
      INSERT INTO vehiculos (placa, tipo, marca, modelo_anio, conductor_id, capacidad_peso_kg, capacidad_volumen_m3, largo_util_m, ancho_util_m, alto_util_m, activo)
      VALUES ?
      ON DUPLICATE KEY UPDATE marca=VALUES(marca), capacidad_peso_kg=VALUES(capacidad_peso_kg), capacidad_volumen_m3=VALUES(capacidad_volumen_m3);
    `;
    await connection.query(insertVehSql, [vehiculosSeed]);
    console.log('✓ Flota de vehículos y conductores asignados.');

    // 7. Sincronizar Municipios, Veredas y los 1.399 Beneficiarios desde la BD 'bateria' si existe
    try {
      console.log('7. Copiando catálogo de 15 municipios, 219 veredas y 1.399 beneficiarios desde BD "bateria"...');
      await connection.query('INSERT IGNORE INTO flota.municipios (id, nombre) SELECT id, nombre FROM bateria.municipios;');
      await connection.query('INSERT IGNORE INTO flota.veredas (id, municipio_id, nombre) SELECT id, municipio_id, nombre FROM bateria.veredas;');
      await connection.query('INSERT IGNORE INTO flota.beneficiarios (id, fase, municipio_id, vereda_id, nombre, documento, coordenadas) SELECT id, fase, municipio_id, vereda_id, nombre, documento, coordenadas FROM bateria.beneficiarios;');
      
      const [bCount] = await connection.query('SELECT COUNT(*) as count FROM flota.beneficiarios;');
      console.log(`✓ ${bCount[0].count} Beneficiarios sincronizados exitosamente en la base de datos 'flota'.`);
    } catch (syncErr) {
      console.log('Aviso al sincronizar beneficiarios:', syncErr.message);
    }

    console.log('\n🎉 ¡BASE DE DATOS "flota" CREADA Y POBLADA EXITOSAMENTE EN AWS RDS!');
  } catch (err) {
    console.error('❌ Error al inicializar la base de datos flota:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

initFlotaDatabase();
