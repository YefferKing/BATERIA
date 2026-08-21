const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname)));

// Configuración Pool MySQL RDS
const dbConfig = {
  host: process.env.DB_HOST || 'bateria.cypwu0wsknim.us-east-1.rds.amazonaws.com',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'Baterias2026*',
  database: process.env.DB_NAME || 'flota',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM articulos');
    res.json({ ok: true, mensaje: 'Base de datos flota activa', articulos_registrados: rows[0].count });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   1. AUTENTICACIÓN Y USUARIOS
   ========================================================================== */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, pin } = req.body;
    if (!identifier || !pin) {
      return res.status(400).json({ ok: false, error: 'Usuario/cédula y PIN requeridos' });
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const cleanPin = String(pin).trim();

    const [rows] = await pool.query(`
      SELECT u.id, u.nombre, u.usuario, u.documento, u.pin, u.rol_id, r.nombre as rol_nombre, u.cargo, u.telefono, u.activo,
             GROUP_CONCAT(p.clave) as permisos
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN rol_permisos rp ON r.id = rp.rol_id
      LEFT JOIN permisos p ON rp.permiso_id = p.id
      WHERE (LOWER(u.usuario) = ? OR u.documento = ?) AND u.activo = 1
      GROUP BY u.id
    `, [cleanId, cleanId]);

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Usuario o documento no encontrado en el sistema' });
    }

    const user = rows[0];
    if (String(user.pin).trim() !== cleanPin) {
      return res.status(401).json({ ok: false, error: 'PIN o contraseña incorrecta' });
    }

    res.json({
      ok: true,
      data: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        documento: user.documento,
        rol_id: user.rol_id,
        rol: user.rol_nombre,
        cargo: user.cargo,
        telefono: user.telefono,
        permisos: user.permisos ? user.permisos.split(',') : []
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    const { rol_id } = req.query;
    let query = `
      SELECT u.id, u.nombre, u.usuario, u.documento, u.rol_id, r.nombre as rol_nombre, u.cargo, u.telefono, u.licencia_conduccion, u.activo
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
    `;
    const params = [];
    if (rol_id) {
      query += ' WHERE u.rol_id = ?';
      params.push(rol_id);
    }
    query += ' ORDER BY u.nombre ASC';
    const [rows] = await pool.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   2. CATÁLOGO DE ACTIVIDADES Y ARTÍCULOS CON CUBICAJE
   ========================================================================== */
app.get('/api/actividades', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM actividades_constructivas ORDER BY orden ASC');
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/articulos', async (req, res) => {
  try {
    const { actividad_id, search } = req.query;
    let whereClauses = ['a.activo = 1'];
    let params = [];

    if (actividad_id) {
      whereClauses.push('a.actividad_id = ?');
      params.push(actividad_id);
    }
    if (search) {
      whereClauses.push('(a.nombre LIKE ? OR a.codigo LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
      SELECT a.*, ac.nombre as actividad_nombre, ac.orden as actividad_orden,
             COALESCE(SUM(sb.cantidad_disponible), 0) as stock_total_disponible
      FROM articulos a
      JOIN actividades_constructivas ac ON a.actividad_id = ac.id
      LEFT JOIN stock_bodega sb ON a.id = sb.articulo_id
      ${whereSQL}
      GROUP BY a.id
      ORDER BY ac.orden ASC, a.nombre ASC
    `;
    const [rows] = await pool.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/articulos', async (req, res) => {
  try {
    const { codigo, nombre, actividad_id, unidad_medida, peso_unitario_kg, largo_m, ancho_m, alto_m, precio_referencia } = req.body;
    if (!codigo || !nombre || !actividad_id || !unidad_medida || !peso_unitario_kg) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos incompletos' });
    }

    const l = parseFloat(largo_m) || 0.50;
    const w = parseFloat(ancho_m) || 0.50;
    const h = parseFloat(alto_m) || 0.50;
    const volumen_m3 = (l * w * h);

    const [result] = await pool.query(`
      INSERT INTO articulos (codigo, nombre, actividad_id, unidad_medida, peso_unitario_kg, largo_m, ancho_m, alto_m, volumen_m3, precio_referencia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [codigo.trim(), nombre.trim(), parseInt(actividad_id, 10), unidad_medida.trim(), parseFloat(peso_unitario_kg), l, w, h, volumen_m3, parseFloat(precio_referencia) || 0]);

    res.json({ ok: true, id: result.insertId, mensaje: 'Artículo registrado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   3. PROVEEDORES
   ========================================================================== */
app.get('/api/proveedores', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM proveedores WHERE activo = 1 ORDER BY razon_social ASC');
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/proveedores', async (req, res) => {
  try {
    const { razon_social, nit, contacto_nombre, telefono, email, direccion, municipio } = req.body;
    if (!razon_social || !nit || !municipio) {
      return res.status(400).json({ ok: false, error: 'Razón social, NIT y Municipio son obligatorios' });
    }

    const [result] = await pool.query(`
      INSERT INTO proveedores (razon_social, nit, contacto_nombre, telefono, email, direccion, municipio)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [razon_social.trim(), nit.trim(), contacto_nombre || '', telefono || '', email || '', direccion || '', municipio.trim()]);

    res.json({ ok: true, id: result.insertId, mensaje: 'Proveedor registrado exitosamente' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   4. BODEGAS Y STOCK EN TIEMPO REAL
   ========================================================================== */
app.get('/api/bodegas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM bodegas WHERE activo = 1 ORDER BY tipo ASC, nombre ASC');
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/stock', async (req, res) => {
  try {
    const { bodega_id } = req.query;
    let query = `
      SELECT sb.*, a.codigo, a.nombre as articulo_nombre, a.unidad_medida, a.peso_unitario_kg, a.volumen_m3,
             ac.nombre as actividad_nombre, b.nombre as bodega_nombre, b.tipo as bodega_tipo, b.municipio as bodega_municipio
      FROM stock_bodega sb
      JOIN articulos a ON sb.articulo_id = a.id
      JOIN actividades_constructivas ac ON a.actividad_id = ac.id
      JOIN bodegas b ON sb.bodega_id = b.id
    `;
    const params = [];
    if (bodega_id) {
      query += ' WHERE sb.bodega_id = ?';
      params.push(bodega_id);
    }
    query += ' ORDER BY b.nombre ASC, ac.orden ASC, a.nombre ASC';
    const [rows] = await pool.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   5. COMPRAS / ENTRADAS DE ALMACÉN (INCREMENTA STOCK)
   ========================================================================== */
app.post('/api/compras', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { numero_factura, proveedor_id, bodega_destino_id, fecha_compra, items, observaciones, creado_por } = req.body;

    if (!numero_factura || !proveedor_id || !bodega_destino_id || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, error: 'Datos de compra incompletos o sin artículos' });
    }

    let totalValor = 0;
    for (const it of items) {
      totalValor += (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
    }

    // 1. Insertar Cabecera de Compra
    const [compraRes] = await connection.query(`
      INSERT INTO compras (numero_factura, proveedor_id, bodega_destino_id, fecha_compra, total_valor, observaciones, creado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [numero_factura.trim(), parseInt(proveedor_id, 10), parseInt(bodega_destino_id, 10), fecha_compra || new Date(), totalValor, observaciones || '', creado_por || 1]);

    const compraId = compraRes.insertId;

    // 2. Insertar Detalle y Aumentar Stock en Bodega
    for (const it of items) {
      const artId = parseInt(it.articulo_id, 10);
      const cant = parseFloat(it.cantidad) || 0;
      const pu = parseFloat(it.precio_unitario) || 0;
      const subtotal = cant * pu;

      await connection.query(`
        INSERT INTO compras_detalle (compra_id, articulo_id, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `, [compraId, artId, cant, pu, subtotal]);

      // Upsert en stock_bodega
      await connection.query(`
        INSERT INTO stock_bodega (bodega_id, articulo_id, cantidad_disponible)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE cantidad_disponible = cantidad_disponible + VALUES(cantidad_disponible)
      `, [parseInt(bodega_destino_id, 10), artId, cant]);
    }

    await connection.commit();
    res.json({ ok: true, id: compraId, mensaje: `Compra registrada exitosamente. ${items.length} artículos ingresaron al stock.` });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    connection.release();
  }
});

/* ==========================================================================
   6. FLOTA DE VEHÍCULOS
   ========================================================================== */
app.get('/api/vehiculos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT v.*, u.nombre as conductor_nombre, u.telefono as conductor_telefono, u.licencia_conduccion
      FROM vehiculos v
      LEFT JOIN usuarios u ON v.conductor_id = u.id
      WHERE v.activo = 1
      ORDER BY v.capacidad_peso_kg DESC
    `);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   7. BENEFICIARIOS (1.399)
   ========================================================================== */
app.get('/api/beneficiarios', async (req, res) => {
  try {
    const { search, municipio_id, limit = 50 } = req.query;
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

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
      SELECT b.id, b.fase, b.nombre, b.documento, b.coordenadas,
             m.nombre as municipio, v.nombre as vereda
      FROM beneficiarios b
      JOIN municipios m ON b.municipio_id = m.id
      JOIN veredas v ON b.vereda_id = v.id
      ${whereSQL}
      ORDER BY m.nombre ASC, b.nombre ASC
      LIMIT ?
    `;
    const [rows] = await pool.query(query, [...params, parseInt(limit, 10)]);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   8. CUBICACIÓN Y CREACIÓN DE ÓRDENES DE DESPACHO
   ========================================================================== */
// Endpoint para evaluar compatibilidad de carga de un pedido contra toda la flota
app.post('/api/ordenes/evaluar-carga', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'Debe enviar al menos un artículo para calcular carga' });
    }

    // Consultar fichas técnicas de los artículos solicitados
    const artIds = items.map(i => parseInt(i.articulo_id, 10));
    const [artRows] = await pool.query('SELECT * FROM articulos WHERE id IN (?)', [artIds]);

    const artMap = new Map(artRows.map(a => [a.id, a]));

    let pesoTotalKg = 0;
    let volumenTotalM3 = 0;
    let maxLargoItem = 0;
    let maxAnchoItem = 0;
    let maxAltoItem = 0;

    for (const it of items) {
      const art = artMap.get(parseInt(it.articulo_id, 10));
      if (art) {
        const cant = parseFloat(it.cantidad) || 0;
        const pesoSub = cant * parseFloat(art.peso_unitario_kg);
        const volSub = cant * parseFloat(art.volumen_m3);
        pesoTotalKg += pesoSub;
        volumenTotalM3 += volSub;

        if (parseFloat(art.largo_m) > maxLargoItem) maxLargoItem = parseFloat(art.largo_m);
        if (parseFloat(art.ancho_m) > maxAnchoItem) maxAnchoItem = parseFloat(art.ancho_m);
        if (parseFloat(art.alto_m) > maxAltoItem) maxAltoItem = parseFloat(art.alto_m);
      }
    }

    // Consultar todos los vehículos y verificar cuáles son aptos
    const [vehiculos] = await pool.query(`
      SELECT v.*, u.nombre as conductor_nombre
      FROM vehiculos v
      LEFT JOIN usuarios u ON v.conductor_id = u.id
      WHERE v.activo = 1
    `);

    const evaluacionVehiculos = vehiculos.map(v => {
      const capPeso = parseFloat(v.capacidad_peso_kg);
      const capVol = parseFloat(v.capacidad_volumen_m3);
      const largoUtil = parseFloat(v.largo_util_m);
      const anchoUtil = parseFloat(v.ancho_util_m);
      const altoUtil = parseFloat(v.alto_util_m);

      const sobrepeso = pesoTotalKg > capPeso;
      const sobrevolumen = volumenTotalM3 > capVol;
      const noCabeLargo = maxLargoItem > largoUtil;
      const noCabeAncho = maxAnchoItem > anchoUtil;
      const noCabeAlto = maxAltoItem > altoUtil;

      const apto = !sobrepeso && !sobrevolumen && !noCabeLargo && !noCabeAncho && !noCabeAlto;

      const pctPeso = Math.min(100, Math.round((pesoTotalKg / capPeso) * 100));
      const pctVol = Math.min(100, Math.round((volumenTotalM3 / capVol) * 100));

      let razonesRechazo = [];
      if (sobrepeso) razonesRechazo.push(`Excede peso (${(pesoTotalKg/1000).toFixed(2)}T / ${(capPeso/1000).toFixed(2)}T)`);
      if (sobrevolumen) razonesRechazo.push(`Excede cubicaje (${volumenTotalM3.toFixed(2)}m³ / ${capVol.toFixed(2)}m³)`);
      if (noCabeLargo) razonesRechazo.push(`Artículos de ${maxLargoItem}m exceden el largo de carrocería (${largoUtil}m)`);
      if (noCabeAncho) razonesRechazo.push(`Artículos de ${maxAnchoItem}m exceden el ancho (${anchoUtil}m)`);

      return {
        ...v,
        apto,
        pct_peso: pctPeso,
        pct_volumen: pctVol,
        razones_rechazo: razonesRechazo
      };
    });

    res.json({
      ok: true,
      resumen_carga: {
        peso_total_kg: pesoTotalKg,
        peso_total_ton: (pesoTotalKg / 1000).toFixed(3),
        volumen_total_m3: volumenTotalM3.toFixed(4),
        max_dimensiones_articulo: { largo_m: maxLargoItem, ancho_m: maxAnchoItem, alto_m: maxAltoItem }
      },
      evaluacion_vehiculos: evaluacionVehiculos
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/ordenes', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      tipo_origen, origen_bodega_id, origen_proveedor_id,
      tipo_destino, destino_beneficiario_id, destino_bodega_id,
      vehiculo_id, fecha_programada, items, observaciones, creado_por
    } = req.body;

    if (!tipo_origen || !tipo_destino || !vehiculo_id || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, error: 'Datos de orden incompletos' });
    }

    // Obtener datos del vehículo y su conductor
    const [vehRows] = await connection.query('SELECT * FROM vehiculos WHERE id = ?', [vehiculo_id]);
    if (vehRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, error: 'Vehículo seleccionado no existe' });
    }
    const vehiculo = vehRows[0];
    const conductorId = vehiculo.conductor_id;

    // Calcular peso y volumen total
    const artIds = items.map(i => parseInt(i.articulo_id, 10));
    const [artRows] = await connection.query('SELECT * FROM articulos WHERE id IN (?)', [artIds]);
    const artMap = new Map(artRows.map(a => [a.id, a]));

    let pesoTotalKg = 0;
    let volumenTotalM3 = 0;

    const itemsProcesados = items.map(it => {
      const art = artMap.get(parseInt(it.articulo_id, 10));
      const cant = parseFloat(it.cantidad) || 0;
      const pesoUnit = parseFloat(art.peso_unitario_kg);
      const volUnit = parseFloat(art.volumen_m3);
      const pesoSub = cant * pesoUnit;
      const volSub = cant * volUnit;

      pesoTotalKg += pesoSub;
      volumenTotalM3 += volSub;

      return {
        articulo_id: art.id,
        cantidad: cant,
        peso_unitario_kg: pesoUnit,
        volumen_unitario_m3: volUnit,
        peso_subtotal_kg: pesoSub,
        volumen_subtotal_m3: volSub
      };
    });

    const pctPeso = ((pesoTotalKg / parseFloat(vehiculo.capacidad_peso_kg)) * 100).toFixed(2);
    const pctVol = ((volumenTotalM3 / parseFloat(vehiculo.capacidad_volumen_m3)) * 100).toFixed(2);

    // Generar código consecutivo de orden
    const [countRows] = await connection.query('SELECT COUNT(*) as total FROM ordenes_despacho');
    const consecutivo = String(countRows[0].total + 1).padStart(4, '0');
    const codigoOrden = `ORD-2026-${consecutivo}`;

    // Insertar Orden Cabecera
    const [ordenRes] = await connection.query(`
      INSERT INTO ordenes_despacho (
        codigo_orden, tipo_origen, origen_bodega_id, origen_proveedor_id,
        tipo_destino, destino_beneficiario_id, destino_bodega_id,
        vehiculo_id, conductor_id, peso_total_kg, volumen_total_m3,
        porcentaje_ocupacion_peso, porcentaje_ocupacion_volumen,
        estado, fecha_programada, observaciones, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DESPACHADA', ?, ?, ?)
    `, [
      codigoOrden, tipo_origen, origen_bodega_id || null, origen_proveedor_id || null,
      tipo_destino, destino_beneficiario_id || null, destino_bodega_id || null,
      vehiculo_id, conductorId, pesoTotalKg, volumenTotalM3,
      pctPeso, pctVol, fecha_programada || new Date(), observaciones || '', creado_por || 1
    ]);

    const ordenId = ordenRes.insertId;

    // Insertar Detalle y Descontar Stock si el origen es Bodega Central
    for (const it of itemsProcesados) {
      await connection.query(`
        INSERT INTO ordenes_detalle (orden_id, articulo_id, cantidad, peso_unitario_kg, volumen_unitario_m3, peso_subtotal_kg, volumen_subtotal_m3)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [ordenId, it.articulo_id, it.cantidad, it.peso_unitario_kg, it.volumen_unitario_m3, it.peso_subtotal_kg, it.volumen_subtotal_m3]);

      if (tipo_origen === 'BODEGA_CENTRAL' && origen_bodega_id) {
        await connection.query(`
          UPDATE stock_bodega 
          SET cantidad_disponible = GREATEST(0, cantidad_disponible - ?)
          WHERE bodega_id = ? AND articulo_id = ?
        `, [it.cantidad, parseInt(origen_bodega_id, 10), it.articulo_id]);
      }
    }

    await connection.commit();
    res.json({
      ok: true,
      id: ordenId,
      codigo_orden: codigoOrden,
      mensaje: `Orden de despacho ${codigoOrden} creada y programada con éxito.`
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    connection.release();
  }
});

app.get('/api/ordenes', async (req, res) => {
  try {
    const { estado, conductor_id } = req.query;
    let whereClauses = [];
    let params = [];

    if (estado) {
      whereClauses.push('od.estado = ?');
      params.push(estado);
    }
    if (conductor_id) {
      whereClauses.push('od.conductor_id = ?');
      params.push(conductor_id);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
      SELECT od.*,
             v.placa as vehiculo_placa, v.tipo as vehiculo_tipo, v.marca as vehiculo_marca,
             u.nombre as conductor_nombre, u.telefono as conductor_telefono,
             b_orig.nombre as origen_bodega_nombre, p_orig.razon_social as origen_proveedor_nombre,
             ben.nombre as destino_beneficiario_nombre, ben.documento as destino_beneficiario_doc,
             m.nombre as municipio_destino, ver.nombre as vereda_destino,
             b_dest.nombre as destino_bodega_nombre, b_dest.municipio as destino_bodega_mun
      FROM ordenes_despacho od
      JOIN vehiculos v ON od.vehiculo_id = v.id
      JOIN usuarios u ON od.conductor_id = u.id
      LEFT JOIN bodegas b_orig ON od.origen_bodega_id = b_orig.id
      LEFT JOIN proveedores p_orig ON od.origen_proveedor_id = p_orig.id
      LEFT JOIN beneficiarios ben ON od.destino_beneficiario_id = ben.id
      LEFT JOIN municipios m ON ben.municipio_id = m.id
      LEFT JOIN veredas ver ON ben.vereda_id = ver.id
      LEFT JOIN bodegas b_dest ON od.destino_bodega_id = b_dest.id
      ${whereSQL}
      ORDER BY od.id DESC
    `;
    const [rows] = await pool.query(query, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/ordenes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [ordRows] = await pool.query(`
      SELECT od.*,
             v.placa as vehiculo_placa, v.tipo as vehiculo_tipo, v.marca as vehiculo_marca,
             u.nombre as conductor_nombre, u.telefono as conductor_telefono,
             b_orig.nombre as origen_bodega_nombre, b_orig.direccion as origen_bodega_dir,
             p_orig.razon_social as origen_proveedor_nombre, p_orig.direccion as origen_proveedor_dir, p_orig.telefono as origen_proveedor_tel,
             ben.nombre as destino_beneficiario_nombre, ben.documento as destino_beneficiario_doc, ben.telefono as destino_beneficiario_tel,
             m.nombre as municipio_destino, ver.nombre as vereda_destino, ben.coordenadas as destino_coordenadas,
             b_dest.nombre as destino_bodega_nombre, b_dest.direccion as destino_bodega_dir, b_dest.responsable_nombre as destino_bodega_resp
      FROM ordenes_despacho od
      JOIN vehiculos v ON od.vehiculo_id = v.id
      JOIN usuarios u ON od.conductor_id = u.id
      LEFT JOIN bodegas b_orig ON od.origen_bodega_id = b_orig.id
      LEFT JOIN proveedores p_orig ON od.origen_proveedor_id = p_orig.id
      LEFT JOIN beneficiarios ben ON od.destino_beneficiario_id = ben.id
      LEFT JOIN municipios m ON ben.municipio_id = m.id
      LEFT JOIN veredas ver ON ben.vereda_id = ver.id
      LEFT JOIN bodegas b_dest ON od.destino_bodega_id = b_dest.id
      WHERE od.id = ?
    `, [id]);

    if (ordRows.length === 0) return res.status(404).json({ ok: false, error: 'Orden no encontrada' });

    const orden = ordRows[0];
    const [items] = await pool.query(`
      SELECT od.*, a.codigo, a.nombre as articulo_nombre, a.unidad_medida, ac.nombre as actividad_nombre
      FROM ordenes_detalle od
      JOIN articulos a ON od.articulo_id = a.id
      JOIN actividades_constructivas ac ON a.actividad_id = ac.id
      WHERE od.orden_id = ?
      ORDER BY ac.orden ASC, a.nombre ASC
    `, [id]);

    const [evidencia] = await pool.query('SELECT * FROM entregas_evidencia WHERE orden_id = ?', [id]);

    res.json({
      ok: true,
      data: {
        ...orden,
        items,
        evidencia: evidencia[0] || null
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================================
   9. VISTA MÓVIL DEL CONDUCTOR Y CONFIRMACIÓN DE ENTREGA CON FIRMA
   ========================================================================== */
app.put('/api/ordenes/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!['DESPACHADA', 'EN_RUTA', 'ENTREGADA', 'CANCELADA'].includes(estado)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido' });
    }

    let extraSet = '';
    if (estado === 'EN_RUTA') extraSet = ', fecha_despacho = NOW()';
    if (estado === 'ENTREGADA') extraSet = ', fecha_entrega = NOW()';

    await pool.query(`UPDATE ordenes_despacho SET estado = ? ${extraSet} WHERE id = ?`, [estado, id]);
    res.json({ ok: true, mensaje: `Estado actualizado a ${estado}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/ordenes/:id/confirmar-entrega', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { recibido_por_nombre, recibido_por_documento, recibido_por_rol, firma_digital_base64, foto_descarga_url, coordenadas_gps, observaciones } = req.body;

    if (!recibido_por_nombre || !recibido_por_documento) {
      await connection.rollback();
      return res.status(400).json({ ok: false, error: 'Nombre y documento de quien recibe son obligatorios' });
    }

    // 1. Guardar Evidencia
    await connection.query(`
      INSERT INTO entregas_evidencia (orden_id, fecha_entrega, recibido_por_nombre, recibido_por_documento, recibido_por_rol, firma_digital_base64, foto_descarga_url, coordenadas_gps, observaciones)
      VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE fecha_entrega=VALUES(fecha_entrega), recibido_por_nombre=VALUES(recibido_por_nombre), firma_digital_base64=VALUES(firma_digital_base64), observaciones=VALUES(observaciones)
    `, [id, recibido_por_nombre.trim(), recibido_por_documento.trim(), recibido_por_rol || 'Beneficiario', firma_digital_base64 || null, foto_descarga_url || null, coordenadas_gps || null, observaciones || '']);

    // 2. Marcar Orden como ENTREGADA
    await connection.query('UPDATE ordenes_despacho SET estado = "ENTREGADA", fecha_entrega = NOW() WHERE id = ?', [id]);

    // 3. Si el destino era una Bodega Satélite, ingresar el stock a esa bodega municipal
    const [ordRows] = await connection.query('SELECT tipo_destino, destino_bodega_id FROM ordenes_despacho WHERE id = ?', [id]);
    if (ordRows.length > 0 && ordRows[0].tipo_destino === 'BODEGA_SATELITE' && ordRows[0].destino_bodega_id) {
      const destBodegaId = ordRows[0].destino_bodega_id;
      const [items] = await connection.query('SELECT articulo_id, cantidad FROM ordenes_detalle WHERE orden_id = ?', [id]);
      for (const it of items) {
        await connection.query(`
          INSERT INTO stock_bodega (bodega_id, articulo_id, cantidad_disponible)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE cantidad_disponible = cantidad_disponible + VALUES(cantidad_disponible)
        `, [destBodegaId, it.articulo_id, it.cantidad]);
      }
    }

    await connection.commit();
    res.json({ ok: true, mensaje: '¡Entrega confirmada y acta digital firmada exitosamente!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    connection.release();
  }
});

/* ==========================================================================
   10. KPIS Y DASHBOARD LOGÍSTICO
   ========================================================================== */
app.get('/api/dashboard/kpis', async (req, res) => {
  try {
    const [artCount] = await pool.query('SELECT COUNT(*) as total FROM articulos WHERE activo = 1');
    const [provCount] = await pool.query('SELECT COUNT(*) as total FROM proveedores WHERE activo = 1');
    const [vehCount] = await pool.query('SELECT COUNT(*) as total FROM vehiculos WHERE activo = 1');
    const [ordCount] = await pool.query(`
      SELECT 
        COUNT(*) as total_ordenes,
        SUM(CASE WHEN estado = 'DESPACHADA' THEN 1 ELSE 0 END) as despachadas,
        SUM(CASE WHEN estado = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
        SUM(CASE WHEN estado = 'ENTREGADA' THEN 1 ELSE 0 END) as entregadas,
        COALESCE(SUM(peso_total_kg), 0) as total_kg_transportados
      FROM ordenes_despacho
    `);
    const [stockBajo] = await pool.query(`
      SELECT COUNT(*) as alertas_stock
      FROM stock_bodega sb
      WHERE sb.cantidad_disponible <= sb.stock_minimo
    `);

    res.json({
      ok: true,
      data: {
        total_articulos: artCount[0].total,
        total_proveedores: provCount[0].total,
        total_vehiculos: vehCount[0].total,
        ordenes: ordCount[0],
        alertas_stock: stockBajo[0].alertas_stock
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚚 SERVIDOR DE FLOTA Y LOGÍSTICA INICIADO CON ÉXITO`);
  console.log(`📍 URL Local: http://localhost:${PORT}`);
  console.log(`🗄️  Base de Datos: ${dbConfig.database} en AWS RDS`);
  console.log(`======================================================\n`);
});
