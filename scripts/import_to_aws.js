const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importToAWS(targetHost, targetPassword, targetUser) {
  const host = targetHost || process.env.DB_HOST || 'bateria.cypwu0wsknim.us-east-1.rds.amazonaws.com';
  const password = targetPassword || process.env.DB_PASSWORD || 'Baterias2026*';
  const user = targetUser || 'admin';
  const database = process.env.DB_NAME || 'bateria';

  console.log(`====================================================`);
  console.log(` Conectando a AWS RDS en: ${host}...`);
  console.log(` Usuario: ${user} | Base de datos: ${database}`);
  console.log(`====================================================`);

  let conn;
  try {
    conn = await mysql.createConnection({
      host,
      user,
      password,
      multipleStatements: true,
      connectTimeout: 20000
    });
    console.log('✓ Conexión establecida con éxito a AWS RDS.');

    const sqlFilePath = path.join(__dirname, '..', 'database_clean_production.sql');
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`No se encontró el archivo ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('⏳ Ejecutando script de producción limpia en AWS RDS (esto puede tomar ~15 segundos)...');

    await conn.query(sqlContent);
    console.log('✅ Base de datos de producción creada e importada exitosamente en AWS RDS.');

    // Validar conteo de datos oficiales importados
    await conn.changeUser({ database: 'bateria' });
    const [benCount] = await conn.query('SELECT COUNT(*) as total FROM beneficiarios');
    const [actCount] = await conn.query('SELECT COUNT(*) as total FROM actividades_inspeccion');
    const [inspCount] = await conn.query('SELECT COUNT(*) as total FROM inspecciones');
    const [users] = await conn.query('SELECT id, nombre, usuario, rol_id FROM usuarios');

    console.log('\n--- RESUMEN DE LA BASE DE DATOS EN AWS ---');
    console.log(`✓ Beneficiarios Oficiales cargados: ${benCount[0].total}`);
    console.log(`✓ Actividades Oficiales parametrizadas: ${actCount[0].total}`);
    console.log(`✓ Inspecciones de campo activas: ${inspCount[0].total} (Limpia para datos reales)`);
    console.log('✓ Usuarios creados:', users);

  } catch (err) {
    console.error('❌ Error al conectar o importar en AWS RDS:', err.message);
    if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️ TIP: Verifica que el Grupo de Seguridad de VPC (Security Group) en AWS permita tráfico entrante en el puerto 3306.');
    }
  } finally {
    if (conn) await conn.end();
  }
}

const args = process.argv.slice(2);
const customHost = args[0] || 'bateria.cypwu0wsknim.us-east-1.rds.amazonaws.com';
const customPass = args[1];

importToAWS(customHost, customPass);
