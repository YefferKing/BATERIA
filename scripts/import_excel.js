const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'bateria'
};

async function importExcelData() {
  console.log('Iniciando importación desde Excel...');
  const conn = await mysql.createConnection(dbConfig);

  try {
    // 1. Crear tabla municipios
    await conn.query(`
      CREATE TABLE IF NOT EXISTS municipios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Crear tabla veredas
    await conn.query(`
      CREATE TABLE IF NOT EXISTS veredas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        municipio_id INT NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE CASCADE,
        UNIQUE KEY uk_municipio_vereda (municipio_id, nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Crear tabla beneficiarios
    await conn.query(`
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

    // 4. Leer Excel
    const filePath = path.join(__dirname, '..', 'BLOQUE DATOS CONSOLIDADO BATERIAS SANITARIAS.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['BLOQUE DATOS'];
    if (!sheet) throw new Error('No se encontró la hoja "BLOQUE DATOS" en el archivo Excel');

    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`Leídos ${rows.length} registros desde el Excel.`);

    // 5. Extraer e insertar municipios únicos
    const municipiosSet = new Set();
    for (const r of rows) {
      if (r.MUNICIPIO) municipiosSet.add(String(r.MUNICIPIO).trim().toUpperCase());
    }

    const municipioMap = new Map(); // nombre -> id
    for (const mun of municipiosSet) {
      await conn.query('INSERT INTO municipios (nombre) VALUES (?) ON DUPLICATE KEY UPDATE nombre=nombre', [mun]);
      const [res] = await conn.query('SELECT id FROM municipios WHERE nombre = ?', [mun]);
      if (res.length > 0) {
        municipioMap.set(mun, res[0].id);
      }
    }
    console.log(`✓ ${municipioMap.size} Municipios creados/mapeados.`);

    // 6. Extraer e insertar veredas únicas vinculadas a municipios
    const veredasMap = new Map(); // `${munId}_${veredaNombre}` -> veredaId
    for (const r of rows) {
      const munNombre = String(r.MUNICIPIO || '').trim().toUpperCase();
      const veredaNombre = String(r.VEREDA || '').trim().toUpperCase();
      const munId = municipioMap.get(munNombre);

      if (munId && veredaNombre) {
        const key = `${munId}_${veredaNombre}`;
        if (!veredasMap.has(key)) {
          await conn.query(
            'INSERT INTO veredas (municipio_id, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre=nombre',
            [munId, veredaNombre]
          );
          const [res] = await conn.query(
            'SELECT id FROM veredas WHERE municipio_id = ? AND nombre = ?',
            [munId, veredaNombre]
          );
          if (res.length > 0) {
            veredasMap.set(key, res[0].id);
          }
        }
      }
    }
    console.log(`✓ ${veredasMap.size} Veredas creadas/mapeadas.`);

    // 7. Limpiar y reinsertar beneficiarios
    await conn.query('TRUNCATE TABLE beneficiarios');

    const beneficiariosBatch = [];
    for (const r of rows) {
      const munNombre = String(r.MUNICIPIO || '').trim().toUpperCase();
      const veredaNombre = String(r.VEREDA || '').trim().toUpperCase();
      const munId = municipioMap.get(munNombre);
      const veredaId = veredasMap.get(`${munId}_${veredaNombre}`);

      const fase = parseInt(r.FASE, 10) || 1;
      const nombre = String(r.NOMBRE || '').trim();
      const documento = String(r.CEDULA || '').trim();
      const estadoStr = String(r.ESTADO || 'VIVO').trim().toUpperCase();
      const estado = estadoStr === 'FALLECIDO' ? 0 : 1;
      const coordenadas = r.COORDENADAS ? String(r.COORDENADAS).trim() : null;

      if (munId && veredaId && nombre && documento) {
        beneficiariosBatch.push([fase, munId, veredaId, nombre, documento, estado, coordenadas]);
      }
    }

    if (beneficiariosBatch.length > 0) {
      await conn.query(
        'INSERT INTO beneficiarios (fase, municipio_id, vereda_id, nombre, documento, estado, coordenadas) VALUES ?',
        [beneficiariosBatch]
      );
    }

    console.log(`✓ ${beneficiariosBatch.length} Beneficiarios importados exitosamente a MySQL.`);

    // Resumen final
    const [statsMun] = await conn.query('SELECT COUNT(*) as c FROM municipios');
    const [statsVer] = await conn.query('SELECT COUNT(*) as c FROM veredas');
    const [statsBen] = await conn.query('SELECT COUNT(*) as c FROM beneficiarios');
    const [statsVivos] = await conn.query('SELECT COUNT(*) as c FROM beneficiarios WHERE estado = 1');
    const [statsFallecidos] = await conn.query('SELECT COUNT(*) as c FROM beneficiarios WHERE estado = 0');

    console.log('================ RESUMEN DE IMPORTACIÓN ================');
    console.log(`• Total Municipios:   ${statsMun[0].c}`);
    console.log(`• Total Veredas:      ${statsVer[0].c}`);
    console.log(`• Total Beneficiarios: ${statsBen[0].c}`);
    console.log(`  - Estado VIVO (1):      ${statsVivos[0].c}`);
    console.log(`  - Estado FALLECIDO (0): ${statsFallecidos[0].c}`);
    console.log('========================================================');
  } catch (err) {
    console.error('Error durante la importación:', err);
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  importExcelData();
}

module.exports = { importExcelData };
