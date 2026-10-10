// ===============================
// 🟩 PROYECTO: VAO POS MULTIHOJA
// 📍 Google Sheet: patagonia.salvaje.comidas@gmail.com
// 📍 Claude: patagonia.salvaje.comidas@gmail.com
// 📍 DeepSeek: patagonia.salvaje.comidas@gmail.com
// 🌐 URL: https://vaopos-staging.vercel.app/
// 📁 Repo: https://github.com/patagoniasalvajecomidas-bariloche/vaopos-STAGING
// 📊 Planilla ID: 1xgx98_heCPfvAntUwsbIgtAZNquOcN2L34EBEwwL3Oo
// 🔗 API: https://script.google.com/macros/s/AKfycbyz-MLKFaYNgifK4n1WnyZkP75Mvbfty-pAGL5f_RcOlmVlNtIp72rj25T-YhOPytjadA/exec
// 🧩 Arquitectura: 1 planilla, multihojas por cliente
// 🎯 Origen: VAO POS + funciones maduras de Seba21/Copihue
// ⚠️ ESTE ES EL SISTEMA DE PRUEBAS — NO PRODUCCIÓN
// 📅 Última edición: 21/09/2026
// ===============================

const SISTEMA = {
  proyecto:      'VAO POS MULTIHOJA',
  entorno:       'staging',
  googlesheet:   'patagonia.salvaje.comidas@gmail.com',
  claude:        'patagonia.salvaje.comidas@gmail.com',
  deepseek:      'patagonia.salvaje.comidas@gmail.com',
  url:           'https://vaopos-staging.vercel.app/',
  repo:          'patagoniasalvajecomidas-bariloche/vaopos-STAGING',
  planillaId:    '1xgx98_heCPfvAntUwsbIgtAZNquOcN2L34EBEwwL3Oo',
  api:           'https://script.google.com/macros/s/AKfycbyz-MLKFaYNgifK4n1WnyZkP75Mvbfty-pAGL5f_RcOlmVlNtIp72rj25T-YhOPytjadA/exec',
  arquitectura:  '1 planilla, multihojas por cliente',
  origen:        'VAO POS + funciones maduras de Seba21/Copihue',
  version:       'v022',
  ultimaEdicion: '21/09/2026'
};

// ===============================
// VAO SmartPOS — Motor API (STAGING)
// ===============================
// Columnas VENDEDORES:  A=Prefijo B=Nombre C=Teléfono D=Correo E=Categoría F=Fecha Alta G=Activo H=Comision% I=Alias Pago J=Link MP K=Notas
// ⚠️  Token MP NO va en Sheets — se guarda en Script Properties (seguro)
//     Para cargar tokens: ejecutar setTokenMP('PREFIJO', 'APP_USR-...')
// Columnas INVENTARIO:  A=Código B=Producto C=Stock D=P.Costo E=P.Venta F=Proveedor G=Categoría H=Reservada I=Reservada
// Columnas VENTAS:      A=Fecha B=Producto C=Cantidad D.P.Venta E=Modo de pago F=Total
// ===============================


function doGet(e) {
  const action  = e.parameter.action  || '';
  const prefijo = (e.parameter.prefijo || 'NE').toUpperCase();
  const data    = e.parameter.data ? JSON.parse(decodeURIComponent(e.parameter.data)) : {};

  var result;
  try {
    if      (action === 'getInfo')            { result = getInfo(); }
    else if (action === 'getVendedores')      { result = getVendedores(); }
    else if (action === 'crearVendedor')      { result = crearVendedor(data); }
    else if (action === 'getProductos')       { result = getProductos(prefijo, data.token || ''); }
    else if (action === 'vender')             { result = registrarVenta(data, prefijo); }
    else if (action === 'venderFiado')        { result = venderFiado(data, prefijo); }
    else if (action === 'ingresarMercaderia') { result = ingresarMercaderia(data, prefijo); }
    else if (action === 'ajustarStock')       { result = ajustarStock(data, prefijo); }
    else if (action === 'getEstadisticas')    { result = getEstadisticas(data, prefijo); }
    else if (action === 'getVentas')          { result = getVentas(prefijo, data.token || ''); }
    else if (action === 'getVentasDiarias')   { result = getVentasDiarias(data, prefijo); }
    else if (action === 'getTokenMP')         { result = getTokenMP(prefijo); }
    else if (action === 'adminLogin')         { result = adminLogin(data); }
    else if (action === 'clienteLogin')       { result = clienteLogin(data); }
    else if (action === 'cerrarSesion')       { result = cerrarSesionCliente(prefijo, data.token || ''); }
    else if (action === 'cerrarSesionAdmin')  { result = cerrarSesionAdmin(data.token || ''); }
    else if (action === 'renovarVigencia')    { result = renovarVigenciaCliente(data); }
    else if (action === 'resetPin')           { result = resetPinCliente(data); }
    else if (action === 'getConfig')          { result = getConfig(prefijo, data.token || ''); }
    else if (action === 'getResumenAdmin')    { result = getResumenAdmin(data.token || ''); }
    else if (action === 'activarCliente')     { result = activarCliente(data); }
    else if (action === 'suspenderCliente')   { result = suspenderCliente(data); }
    else if (action === 'getClientes')        { result = getClientesXX(prefijo); }
    else if (action === 'getFiados')          { result = listarFiadosXX(prefijo, data.token || ''); }
    else if (action === 'consultarDeuda')     { result = consultarDeudaXX(prefijo, data.token || '', data.telefono || ''); }
    else if (action === 'getFiadosCliente')   { result = listarFiadosClienteXX(prefijo, data); }
    else if (action === 'registrarFiado')     { result = registrarFiadoXX(prefijo, data); }
    else if (action === 'abonarFiado')        { result = abonarFiadoXX(prefijo, data); }
    else if (action === 'cobrarFiado')        { result = cobrarFiadoXX(prefijo, data); }
    else if (action === 'getHistorial')       { result = listarHistorialXX(prefijo, data.token || '', data.limite); }
    else if (action === 'getPrestamos')       { result = listarPrestamosXX(prefijo, data.token || ''); }
    else if (action === 'registrarPrestamo')  { result = registrarPrestamoXX(prefijo, data); }
    else if (action === 'pagarCuotaPrestamo') { result = pagarCuotaPrestamoXX(prefijo, data); }
    else if (action === 'cancelarPrestamo')   { result = cancelarPrestamoXX(prefijo, data); }
    else if (action === 'registrarMovimientoCaja') { result = registrarMovimientoCajaXX(prefijo, data); }
    else if (action === 'getMovimientosCaja') { result = listarMovimientosCajaXX(prefijo, data.token || '', data); }
    else if (action === 'registrarSalida')    { result = registrarSalidaXX(prefijo, data); }
    else if (action === 'getSalidas')         { result = listarSalidasXX(prefijo, data.token || '', data); }
    else if (action === 'ajusteRapido')       { result = { success: false, definitivo: true, error: 'Acción deshabilitada. Usá ✏️ Ajustar desde el POS.' }; } // v021 (P0-2): endpoint alternativo inseguro cerrado; ajustarProductoXX queda definida pero inalcanzable
    else if (action === 'getOfertas')         { result = getOfertasXX(prefijo, data.token || ''); }
    else if (action === 'getRecienLlegados')  { result = getRecienLlegadosXX(prefijo, data.token || ''); }
    else                                      { result = { error: 'Acción no reconocida: ' + action }; }
  } catch (err) {
    result = { error: err.message };
  }

  return respuestaJSON(result);
}

// ===============================
// GESTIÓN SEGURA DE TOKENS MP
// Los tokens NUNCA se guardan en Sheets — viven en Script Properties
// ===============================

// Ejecutar manualmente UNA VEZ desde el editor para cargar el token:
// setTokenMP('NE', 'APP_USR-...')
// setTokenMP('VA', 'APP_USR-...')
function setTokenMP(prefijo, token) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('MP_TOKEN_' + prefijo.toUpperCase(), token);
  Logger.log('Token guardado para ' + prefijo);
}

// Eliminar token de un vendedor
function deleteTokenMP(prefijo) {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('MP_TOKEN_' + prefijo.toUpperCase());
  Logger.log('Token eliminado para ' + prefijo);
}

// Ver qué prefijos tienen token cargado (SIN mostrar el token)
function listarTokensConfigurados() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var configurados = [];
  for (var key in props) {
    if (key.startsWith('MP_TOKEN_')) {
      configurados.push(key.replace('MP_TOKEN_', ''));
    }
  }
  Logger.log('Tokens configurados: ' + configurados.join(', '));
  return configurados;
}

// v022 (seguridad): el Access Token de Mercado Pago NUNCA se entrega al navegador.
// La acción se conserva solo por compatibilidad: responde siempre sin token
// y no consulta las propiedades del script.
function getTokenMP(prefijo) {
  return { token: '', configurado: false };
}

// ===============================
// INFO DEL SISTEMA
// Endpoint: ?action=getInfo
// Devuelve los datos del proyecto.
// ===============================
function getInfo() {
  return {
    ok: true,
    sistema: SISTEMA,
    fechaConsulta: new Date().toISOString()
  };
}

// ===============================
// HELPERS COMPARTIDOS (migrados de Copihue)
// ===============================

/**
 * Helper central para armar respuestas JSON en el Web App de GAS.
 * Recibe cualquier objeto JS y devuelve un ContentService.TextOutput
 * con el JSON serializado y el MIME type correcto, listo para
 * retornar desde doGet/doPost.
 */
function respuestaJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * _parseNumeroFlexible
 * Convierte a número cualquier valor que venga de una celda de Google Sheets,
 * sin importar el formato: número real, texto plano, formato argentino
 * ("1.500,50"), con coma decimal ("1,6"), con símbolo de moneda ("$1.500"),
 * vacío, null o undefined. Si no logra interpretar el valor, devuelve 0.
 */
function _parseNumeroFlexible(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
  if (typeof valor !== 'string') return 0;
  var texto = valor.trim();
  if (texto === '') return 0;
  texto = texto.replace(/[^0-9.,-]/g, '');
  if (texto === '' || texto === '-') return 0;
  var tieneComa = texto.indexOf(',') !== -1;
  var tienePunto = texto.indexOf('.') !== -1;
  if (tieneComa && tienePunto) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (tieneComa) {
    texto = texto.replace(',', '.');
  } else if (tienePunto) {
    var partes = texto.split('.');
    var ultimaParte = partes[partes.length - 1];
    if (partes.length === 2 && ultimaParte.length === 3) {
      texto = texto.replace('.', '');
    }
  }
  var numero = parseFloat(texto);
  return isNaN(numero) ? 0 : numero;
}

/**
 * _esActivoFlag_: normaliza distintos valores de una planilla de
 * Google Sheets para determinar si representan "activo" (true) o no (false).
 * Acepta: true, "SI", "SÍ", "TRUE", "VERDADERO", "X", "1" (sin importar
 * mayúsculas/minúsculas ni espacios al inicio/final). Cualquier otro
 * valor (false, null, undefined, "", otros textos) devuelve false.
 */
function _esActivoFlag_(valor) {
  if (valor === true) return true;
  if (typeof valor !== 'string') return false;
  var normalizado = valor.trim().toUpperCase();
  var valoresActivos = ['SI', 'SÍ', 'TRUE', 'VERDADERO', 'X', '1'];
  return valoresActivos.indexOf(normalizado) !== -1;
}

function getHojaInv(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('INVENTARIO_' + prefijo);
  if (!hoja) throw new Error('No existe hoja INVENTARIO_' + prefijo);
  return hoja;
}

function getHojaVentas(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('VENTAS_' + prefijo);
  if (!hoja) throw new Error('No existe hoja VENTAS_' + prefijo);
  return hoja;
}

function getVendedores() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('VENDEDORES');
  if (!hoja) throw new Error('No existe hoja VENDEDORES');
  var datos = hoja.getDataRange().getValues();
  var vendedores = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var prefijo = f[0] ? String(f[0]).trim().toUpperCase() : '';
    if (!prefijo) continue;
    // A=Prefijo B=Nombre C=Teléfono D=Correo E=Categoría F=Fecha Alta G=Activo H=Comision% I=Alias Pago J=Link MP K=Notas
    vendedores.push({
      prefijo:   prefijo,
      nombre:    String(f[1]  || '').trim(),
      telefono:  String(f[2]  || '').trim(),
      correo:    String(f[3]  || '').trim(),
      categoria: String(f[4]  || '').trim(),
      fechaAlta: f[5] ? Utilities.formatDate(new Date(f[5]), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      activo:    String(f[6]  || '').trim().toLowerCase() === 'si',
      comision:  parseFloat(f[7]) || 0,
      aliasPago: String(f[8]  || '').trim(),
      linkMP:    String(f[9]  || '').trim(),
      notas:     String(f[10] || '').trim()
      // tokenMP: NUNCA se devuelve desde getVendedores — se pide por separado con getTokenMP
    });
  }
  return { vendedores: vendedores };
}

function generarPinAleatorio() {
  return String(Math.floor(100000 + Math.random() * 900000)); // siempre 6 dígitos
}

function crearHojaConfigDefault(ss, prefijo, nombre, telefono, correo, aliasPago) {
  var nombreConfig = 'CONFIG_' + prefijo;
  if (ss.getSheetByName(nombreConfig)) return; // ya existe, no se toca

  var hoja = ss.insertSheet(nombreConfig);

  var datos = [
    ['campo', 'valor', 'notas'],
    ['', '', '--- IDENTIDAD ---'],
    ['title', 'Catalogo - ' + nombre, ''],
    ['slogan', '', ''],
    ['nombre_empresa', nombre, ''],
    ['telefono', telefono, ''],
    ['direccion', '', ''],
    ['email', correo, ''],
    ['ciudad', '', ''],
    ['descripcion', '', ''],
    ['logo_url', '', ''],
    ['url_sitio', '', ''],
    ['', '', '--- APARIENCIA ---'],
    ['tema_actual', 'T3', ''],
    ['color_primario', '#1E88E5', 'VAO Blue'],
    ['color_secundario', '#2CCB6F', 'VAO Green'],
    ['color_acento', '#FF9800', 'VAO Sunset'],
    ['', '', '--- PAGOS ---'],
    ['alias_transferencia', aliasPago, ''],
    ['qr_pago', '', ''],
    ['', '', '--- WIFI ---'],
    ['wifi_ssid', '', ''],
    ['wifi_clave', '', ''],
    ['qr_wifi', '', ''],
    ['', '', '--- RECIEN LLEGADOS ---'],
    ['RECIEN_LLEGADOS_PRECIO_MIN', 2000, ''],
    ['RECIEN_LLEGADOS_LIMITE', 60, ''],
    ['RECIEN_LLEGADOS_DIAS', 15, ''],
    ['', '', '--- SEGURIDAD ---'],
    ['PIN', '', 'inerte — el PIN real vive en Script Properties'],
    ['sesion_dias', 7, ''],
    ['intentos_max', 3, ''],
    ['', '', '--- MODULOS BASE (siempre TRUE) ---'],
    ['ventas', 'TRUE', ''],
    ['cobrar', 'TRUE', ''],
    ['ticket_wa', 'TRUE', ''],
    ['buscador', 'TRUE', ''],
    ['', '', '--- PACK 1 (default FALSE, activar manualmente) ---'],
    ['pack1_ingreso', 'FALSE', ''],
    ['pack1_hoy', 'FALSE', ''],
    ['pack1_recargar', 'FALSE', ''],
    ['pack1_notificaciones', 'FALSE', ''],
    ['pack1_info', 'FALSE', ''],
    ['', '', '--- PACK 2 (default FALSE) ---'],
    ['pack2_editor_stock', 'FALSE', ''],
    ['pack2_reportes', 'FALSE', ''],
    ['', '', '--- PACK 3 (default FALSE) ---'],
    ['pack3_editor_categoria', 'FALSE', ''],
    ['pack3_editor_nombre', 'FALSE', ''],
    ['pack3_finanzas', 'FALSE', ''],
    ['', '', '--- EXTRA (default FALSE) ---'],
    ['extra_horarios', 'FALSE', 'requiere CONF_DIARIA_' + prefijo],
    ['extra_ultimas_unidades', 'FALSE', ''],
    ['extra_prestamos', 'FALSE', ''],
    ['extra_retiro_caja', 'FALSE', ''],
    ['extra_retiro_local', 'FALSE', ''],
    ['extra_fiados', 'FALSE', ''],
    ['extra_lista_compras', 'FALSE', ''],
    ['extra_generador_flyer', 'FALSE', ''],
    ['extra_config_ofertas', 'FALSE', ''],
    ['extra_carga_foto', 'FALSE', ''],
    ['extra_herramientas', 'FALSE', ''],
    ['extra_raspadita', 'FALSE', ''],
    ['extra_tragamonedas', 'FALSE', '']
  ];

  hoja.getRange(1, 1, datos.length, 3).setValues(datos);
  var header = hoja.getRange(1, 1, 1, 3);
  header.setBackground('#1E88E5');
  header.setFontColor('#FFFFFF');
  header.setFontWeight('bold');
  hoja.setFrozenRows(1);
}

function crearVendedor(data) {
  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var prefijo   = (data.prefijo   || '').trim().toUpperCase();
  var nombre    = (data.nombre    || '').trim();
  var telefono  = (data.telefono  || '').trim();
  var correo    = (data.correo    || '').trim();
  var categoria = (data.categoria || 'GENERAL').trim().toUpperCase();
  var comision  = parseFloat(data.comision) || 0;
  var aliasPago = (data.aliasPago || '').trim();
  var linkMP    = (data.linkMP    || '').trim();
  var tokenMP   = (data.tokenMP   || '').trim(); // se guarda en Properties, NO en Sheets

  if (!prefijo || prefijo.length < 2) return { error: 'Prefijo inválido (mínimo 2 letras)' };
  if (!nombre) return { error: 'Nombre requerido' };

  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) return { error: 'No existe hoja VENDEDORES' };

  var datosVend = hVend.getDataRange().getValues();
  for (var i = 1; i < datosVend.length; i++) {
    if (String(datosVend[i][0]).trim().toUpperCase() === prefijo) {
      return { error: 'El prefijo ' + prefijo + ' ya existe' };
    }
  }

  var nombreInv = 'INVENTARIO_' + prefijo;
  if (!ss.getSheetByName(nombreInv)) {
    var hInv = ss.insertSheet(nombreInv);
    hInv.getRange(1,1,1,11).setValues([['Código','Producto','Stock','P.Costo','P.Venta','Proveedor','Categoría','Relampago','Destacada','Especial','PrecioPromo']]);
    hInv.getRange(1,1,1,11).setFontWeight('bold');
  }

  var nombreVentas = 'VENTAS_' + prefijo;
  if (!ss.getSheetByName(nombreVentas)) {
    var hVentas = ss.insertSheet(nombreVentas);
    hVentas.getRange(1,1,1,7).setValues([['Fecha','Producto','Cantidad','P.Venta','Modo de pago','Total','VentaId']]);
    hVentas.getRange(1,1,1,7).setFontWeight('bold');
  }

  crearHojaClientesXX(ss, prefijo);
  crearHojaFiadosXX(ss, prefijo);
  crearHojaHistorialXX(ss, prefijo);
  crearHojaPrestamosXX(ss, prefijo);
  crearHojaCajaMovimientosXX(ss, prefijo);
  crearHojaSalidasXX(ss, prefijo);
  crearHojaAjusteRapidoXX(ss, prefijo);
  crearHojaConfigDefault(ss, prefijo, nombre, telefono, correo, aliasPago);

  // Guardar en Sheets SIN el token — columnas: A=Prefijo B=Nombre C=Teléfono D=Correo E=Categoría F=Fecha Alta G=Activo H=Comision% I=Alias Pago J=Link MP K=Notas
  var ultimaFila = hVend.getLastRow() + 1;
  hVend.getRange(ultimaFila,1,1,11).setValues([[
    prefijo, nombre, telefono, correo, categoria,
    new Date(), 'si', comision, aliasPago, linkMP, ''
  ]]);

  // Si vino token, guardarlo en Properties (seguro)
  if (tokenMP) {
    PropertiesService.getScriptProperties().setProperty('MP_TOKEN_' + prefijo, tokenMP);
  }

  // PIN aleatorio de 6 dígitos — se registra con setPIN() (sin tocarla) y se devuelve UNA vez
  var pinGenerado = generarPinAleatorio();
  setPIN(prefijo, pinGenerado);

  // Crear también la fila comercial en CLIENTES_VAO (antes no se creaba — quedaba desincronizado)
  crearFilaClientesVao(prefijo, nombre, telefono, correo, categoria, aliasPago, linkMP, !!tokenMP);

  return { success: true, mensaje: '✅ Vendedor ' + nombre + ' (' + prefijo + ') creado', prefijo: prefijo, pin: pinGenerado };
}

function getProductos(prefijo, token) {
  var errAcceso = _requiereSesionValida_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var inv   = getHojaInv(prefijo);
  var datos = inv.getDataRange().getValues();
  var productos = [];
  for (var i = 1; i < datos.length; i++) {
    var fila   = datos[i];
    var nombre = fila[1] ? String(fila[1]).trim() : '';
    var precio = parseFloat(fila[4]) || 0;
    if (!nombre || precio <= 0) continue;
    productos.push({
      id:       i + 1,
      codigo:   fila[0] ? String(fila[0]).trim() : '',
      name:     nombre.toUpperCase(),
      price:    precio,
      costo:    parseFloat(fila[3]) || 0,
      stock:    parseInt(fila[2])   || 0,
      proveedor:fila[5] ? String(fila[5]).trim() : '',
      category: fila[6] ? String(fila[6]).trim().toUpperCase() : 'GENERAL'
    });
  }
  return { productos: productos };
}

function registrarVenta(data, prefijo) {
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  // ETAPA 1 (VentaId): si el POS manda VentaId, tiene que tener el formato
  // que genera el POS. Sin VentaId, la venta sigue exactamente como antes.
  var ventaId = String(data.ventaId || '').trim();
  if (ventaId && !/^VTA_\d{8}-\d{6}-[A-Z0-9]{4}$/.test(ventaId)) {
    return { error: 'VentaId inválido' };
  }

  var lock = LockService.getScriptLock();
  var tieneLock = false;
  try {
    tieneLock = lock.tryLock(10000); // 10s: prudente para el volumen actual, sin colgar el request
  } catch (e) {
    tieneLock = false;
  }
  if (!tieneLock) {
    return { error: 'Sistema ocupado, reintentar', ocupado: true };
  }

  try {
    // ETAPA 1 (VentaId): idempotencia. Dentro del lock: si este VentaId ya
    // está en VENTAS_XX, la venta ya se procesó — no se vuelve a descontar
    // stock ni a escribir filas; se devuelve lo que quedó registrado.
    if (ventaId) {
      var existente = _buscarVentaPorId_(getHojaVentas(prefijo), ventaId);
      if (existente.existe) {
        return {
          success: true,
          yaExistia: true,
          ventaId: ventaId,
          procesados: existente.procesados,
          errores: [],
          bloqueados: []
        };
      }
    }
    return _registrarVentaSinLock_(data, prefijo);
  } finally {
    lock.releaseLock();
  }
}

function _registrarVentaSinLock_(data, prefijo) {
  var inv      = getHojaInv(prefijo);
  var ventas   = getHojaVentas(prefijo);
  var items    = data.items || [];
  var metodo   = (data.metodoPago || 'EFECTIVO').toUpperCase();
  var ahora    = new Date();
  var errores  = [];
  var procesados = [];
  var bloqueados = [];
  var datosInv = inv.getDataRange().getValues();

  // ETAPA 4 (P0-1): antes de CUALQUIER escritura, cada fila tiene que seguir
  // siendo el producto que el POS cree (código; nombre solo como respaldo).
  // Si algún ítem no coincide se rechaza la operación completa sin escribir
  // nada. Respuesta success:false SIN 'error' = definitiva para el POS.
  var identidadIncorrecta = [];
  for (var v = 0; v < items.length; v++) {
    var filaV = parseInt(items[v].id);
    if (!filaV || filaV < 2 || filaV > datosInv.length) continue;
    if (!_identidadCoincide_(datosInv[filaV - 1], items[v].codigo, items[v].name)) {
      identidadIncorrecta.push(String(items[v].name || ('id ' + items[v].id)).trim().toUpperCase() +
        ': el inventario cambió — quitalo y volvé a agregarlo');
    }
  }
  if (identidadIncorrecta.length > 0) {
    return { success: false, procesados: [], bloqueados: [], errores: identidadIncorrecta, identidad: true };
  }

  for (var k = 0; k < items.length; k++) {
    var item     = items[k];
    var filaIdx  = parseInt(item.id);
    if (!filaIdx || filaIdx < 2 || filaIdx > datosInv.length) {
      errores.push('Producto no encontrado (id ' + item.id + ')');
      continue;
    }
    var stockActual = parseInt(datosInv[filaIdx-1][2]) || 0;
    var qty         = parseInt(item.qty) || 1;
    var precio      = (item.precioVenta !== undefined && item.precioVenta !== null && item.precioVenta !== '')
      ? parseFloat(item.precioVenta)
      : parseFloat(datosInv[filaIdx-1][4]) || 0;
    var nombre = String(datosInv[filaIdx-1][1]).trim().toUpperCase();

    // BLOQUEO DURO: sin stock no se registra ni se descuenta
    if (stockActual <= 0) {
      bloqueados.push(nombre);
      errores.push(nombre + ': sin stock (venta NO registrada)');
      continue;
    }

    // Stock insuficiente: registra pero avisa
    if (stockActual < qty) {
      errores.push(nombre + ': stock insuficiente (disponible: ' + stockActual + ')');
      qty = stockActual; // vende lo que hay
    }

    // ETAPA 1 (O2): primero la fila de VENTAS, después el stock.
    // Con VentaId se escribe también la columna G; sin VentaId (venta
    // antigua o venderFiado) se escriben las mismas 6 columnas de siempre.
    var uf = ventas.getLastRow() + 1;
    var ventaIdFila = String(data.ventaId || '').trim();
    if (ventaIdFila) {
      ventas.getRange(uf,1,1,7).setValues([[ahora, nombre, qty, precio, metodo, precio*qty, ventaIdFila]]);
    } else {
      ventas.getRange(uf,1,1,6).setValues([[ahora, nombre, qty, precio, metodo, precio*qty]]);
    }
    ventas.getRange(uf,1).setNumberFormat('dd/mm/yyyy hh:mm');
    ventas.getRange(uf,4).setNumberFormat('"$"#,##0');
    ventas.getRange(uf,6).setNumberFormat('"$"#,##0');
    inv.getRange(filaIdx,3).setValue(stockActual - qty);
    procesados.push({ name: nombre, qty: qty, precio: precio });
  }

  var success = procesados.length > 0;
  return {
    success: success,
    procesados: procesados,
    errores: errores,
    bloqueados: bloqueados
  };
}

// ETAPA 1 (VentaId): busca una venta ya registrada por su VentaId en la
// columna G de VENTAS_XX. Solo lectura. Devuelve los ítems en el mismo
// formato que `procesados` de _registrarVentaSinLock_ ({ name, qty, precio }).
function _buscarVentaPorId_(hojaVentas, ventaId) {
  if (!ventaId) return { existe: false, procesados: [] };
  var ultimaFila = hojaVentas.getLastRow();
  if (ultimaFila < 2 || hojaVentas.getMaxColumns() < 7) return { existe: false, procesados: [] };

  var celdas = hojaVentas.getRange(2, 7, ultimaFila - 1, 1)
    .createTextFinder(ventaId)
    .matchEntireCell(true)
    .matchCase(true)
    .findAll();
  if (!celdas.length) return { existe: false, procesados: [] };

  var procesados = [];
  for (var i = 0; i < celdas.length; i++) {
    var fila = hojaVentas.getRange(celdas[i].getRow(), 2, 1, 3).getValues()[0]; // B,C,D
    procesados.push({
      name:   String(fila[0] || '').trim().toUpperCase(),
      qty:    parseInt(fila[1]) || 0,
      precio: parseFloat(fila[2]) || 0
    });
  }
  return { existe: true, procesados: procesados };
}

// ETAPA 4 (P0-1): ¿la fila del inventario sigue siendo el producto esperado?
// v020: con código esperado se exige que coincidan el código Y el nombre
// (detecta tanto filas movidas como un código que quedó fijo mientras el
// producto a su alrededor cambió). Sin código (carritos/operaciones
// anteriores a V16): respaldo solo por nombre. Si no viene ninguno de los
// dos, no se verifica (compatibilidad). Solo lectura.
function _identidadCoincide_(fila, codigoEsperado, nombreEsperado) {
  var codigo = String(codigoEsperado || '').trim().toUpperCase();
  var nombre = String(nombreEsperado || '').trim().toUpperCase();
  if (codigo) {
    if (String(fila[0] || '').trim().toUpperCase() !== codigo) return false;
    if (nombre && String(fila[1] || '').trim().toUpperCase() !== nombre) return false;
    return true;
  }
  if (nombre) return String(fila[1] || '').trim().toUpperCase() === nombre;
  return true;
}

function venderFiado(data, prefijo) {
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var idOperacion = (data.idOperacion || '').trim();
  if (!idOperacion) return { error: 'idOperacion requerido' };

  var cliente  = (data.cliente  || '').trim();
  var telefono = (data.telefono || '').trim();
  if (!cliente) return { error: 'Cliente requerido para venta fiada' };

  var lock = LockService.getScriptLock();
  var tieneLock = false;
  try {
    tieneLock = lock.tryLock(10000);
  } catch (e) {
    tieneLock = false;
  }
  if (!tieneLock) {
    return { error: 'Sistema ocupado, reintentar', ocupado: true };
  }

  try {
    var props   = PropertiesService.getScriptProperties();
    var propKey = 'FIADO_OP_' + prefijo + '_' + idOperacion;

    // Chequeo temprano, ya dentro del lock: si el fiado ya existe, la
    // operación está completa — no vender, no tocar stock, no duplicar.
    var hojaFiados  = getHojaFiados(prefijo);
    var datosFiados = hojaFiados.getDataRange().getValues();
    var yaExiste = false;
    for (var f = 1; f < datosFiados.length; f++) {
      if (String(datosFiados[f][2]) === idOperacion) { yaExiste = true; break; }
    }
    if (yaExiste) {
      props.deleteProperty(propKey);
      return { success: true, ventaRegistrada: true, fiadoRegistrado: true, yaExistia: true, idOperacion: idOperacion };
    }

    var opStr = props.getProperty(propKey);
    var op    = null;
    if (opStr) { try { op = JSON.parse(opStr); } catch (e) { op = null; } }

    if (op && op.estado === 'INICIADA') {
      // Ambiguo: no se puede saber si la venta anterior llegó a completarse
      // antes de morir. Ante la duda, no se vende ni se descuenta stock de nuevo.
      return {
        success: false, ambiguo: true, idOperacion: idOperacion,
        error: 'Operación ambigua, requiere revisión manual antes de reintentar'
      };
    }

    if (!op) {
      // ETAPA 4 (P0-1): identidad ANTES de INICIADA y antes de vender. Si una
      // fila ya no es el producto esperado: cero VENTAS, cero FIADOS, ningún
      // estado pendiente en el backend, y respuesta definitiva estructurada.
      var datosInvId = getHojaInv(prefijo).getDataRange().getValues();
      var itemsId = data.items || [];
      var identidadIncorrecta = [];
      for (var v = 0; v < itemsId.length; v++) {
        var filaV = parseInt(itemsId[v].id);
        if (!filaV || filaV < 2 || filaV > datosInvId.length) continue;
        if (!_identidadCoincide_(datosInvId[filaV - 1], itemsId[v].codigo, itemsId[v].name)) {
          identidadIncorrecta.push(String(itemsId[v].name || ('id ' + itemsId[v].id)).trim().toUpperCase());
        }
      }
      if (identidadIncorrecta.length > 0) {
        props.deleteProperty(propKey);
        return {
          success: false, definitivo: true, identidad: true, idOperacion: idOperacion,
          error: 'El inventario cambió: ' + identidadIncorrecta.join(', ') + '. Quitalo y volvé a agregarlo.'
        };
      }

      // Operación realmente nueva: no hay FIADO_OP y el Ticket no existe en FIADOS_XX.
      props.setProperty(propKey, JSON.stringify({ estado: 'INICIADA', ts: new Date().getTime() }));

      var inv = getHojaInv(prefijo);
      var datosInv = inv.getDataRange().getValues();
      var items = data.items || [];
      var faltantes = [];
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var filaIdx = parseInt(it.id);
        if (!filaIdx || filaIdx < 2 || filaIdx > datosInv.length) {
          faltantes.push('Producto no encontrado (id ' + it.id + ')');
          continue;
        }
        var stockActual = parseInt(datosInv[filaIdx - 1][2]) || 0;
        var qty = parseInt(it.qty) || 1;
        if (stockActual < qty) {
          faltantes.push(String(datosInv[filaIdx - 1][1]).trim() + ': stock insuficiente (disponible ' + stockActual + ')');
        }
      }
      if (faltantes.length > 0) {
        props.deleteProperty(propKey);
        return { error: 'Stock insuficiente para venta fiada: ' + faltantes.join(' | ') };
      }

      var ventaData = Object.assign({}, data, { metodoPago: 'FIADO' });
      var resultadoVenta = _registrarVentaSinLock_(ventaData, prefijo);

      if (!resultadoVenta.success) {
        props.deleteProperty(propKey);
        return { error: 'No se pudo registrar la venta', detalle: resultadoVenta.errores };
      }

      var totalReal = 0;
      var cantidadTotal = 0;
      resultadoVenta.procesados.forEach(function (p) {
        totalReal += p.precio * p.qty;
        cantidadTotal += p.qty;
      });
      var descripcionReal = resultadoVenta.procesados.map(function (p) {
        return p.qty + 'x ' + p.name;
      }).join(', ');

      op = {
        estado: 'VENTA_REGISTRADA',
        cliente: cliente, telefono: telefono,
        total: totalReal, descripcion: descripcionReal,
        cantItems: cantidadTotal,
        ts: new Date().getTime()
      };
      props.setProperty(propKey, JSON.stringify(op));
    }

    // A esta altura, op.estado === 'VENTA_REGISTRADA' (recién creada o
    // reconciliada). El Ticket ya se revisó al principio de esta misma
    // ejecución, bajo el mismo lock, así que no puede haber cambiado.
    var resultadoFiado = registrarFiadoXX(prefijo, {
      token: data.token,
      cliente: op.cliente, telefono: op.telefono,
      total: op.total, descripcion: op.descripcion, cantItems: op.cantItems,
      ticket: idOperacion
    });

    if (resultadoFiado.success) {
      props.deleteProperty(propKey);
      return { success: true, ventaRegistrada: true, fiadoRegistrado: true, idOperacion: idOperacion, idFiado: resultadoFiado.idFiado };
    }

    return {
      success: false, ventaRegistrada: true, fiadoRegistrado: false,
      idOperacion: idOperacion,
      error: 'Venta registrada, fiado pendiente de reconciliar: ' + (resultadoFiado.error || 'error desconocido')
    };

  } finally {
    lock.releaseLock();
  }
}

// SEBA21: ingresarMercaderia() escribe siempre en la hoja Historial (11
//   columnas: Fecha,Producto,Cantidad,StockResultante,ID,Proveedor,
//   PrecioCosto,PrecioVenta,FechaVencimiento,IdOperacion,StockAnterior) y
//   usa idOperacion para no duplicar el ingreso si el cliente reintenta.
// VAO MULTIHOJA: mismo comportamiento sobre HISTORIAL_XX, salvo la
//   columna FechaVencimiento.
// MOTIVO: INVENTARIO_XX (creada en pasos anteriores) no tiene columna de
//   fecha de vencimiento — no existe ese dato para trasladar. Se omite
//   la columna en vez de dejarla siempre vacía; se puede agregar el día
//   que INVENTARIO_XX trackee vencimientos, sin tocar lo demás.
// ETAPA 3 — P1: el ingreso participa del MISMO ScriptLock que la venta y el
// fiado (mismo patrón que registrarVenta). Serializa ingreso ↔ venta/fiado/
// ingreso y deja la búsqueda de idOperacion en HISTORIAL_XX dentro del lock
// (dos solicitudes con el mismo ING_… ya no pueden sumar las dos).
// Si no consigue el lock no escribe nada y responde 'ocupado' (POS V14
// conserva el ingreso y reintenta con el mismo idOperacion).
function ingresarMercaderia(data, prefijo) {
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var lock = LockService.getScriptLock();
  var tieneLock = false;
  try {
    tieneLock = lock.tryLock(10000);
  } catch (e) {
    tieneLock = false;
  }
  if (!tieneLock) {
    return { error: 'Sistema ocupado, reintentar', ocupado: true };
  }

  try {
    return _ingresarMercaderiaSinLock_(data, prefijo);
  } finally {
    lock.releaseLock();
  }
}

// Cuerpo original de ingresarMercaderia, sin cambios (salvo la validación
// de sesión, que pasó al envoltorio). Llamar SOLO con el ScriptLock tomado.
function _ingresarMercaderiaSinLock_(data, prefijo) {
  var inv   = getHojaInv(prefijo);
  var hist  = getHojaHistorial(prefijo); // crea la hoja sola si un cliente viejo no la tiene
  var idOp  = String(data.idOperacion || '').trim();

  if (idOp) {
    var existente = _buscarIdOperacionHistorial_(hist, idOp);
    if (existente.existe) {
      return { success: true, yaExistia: true, mensaje: 'La operación ya estaba registrada — no se sumó stock de nuevo.' };
    }
  }

  var nombre   = (data.nombre   || '').trim().toUpperCase();
  var cantidad = parseInt(data.cantidad) || 0;
  var costo    = parseFloat(data.costo)  || 0;
  var venta    = parseFloat(data.venta)  || 0;
  var prov     = (data.proveedor || '').trim().toUpperCase();
  var cat      = (data.categoria || 'GENERAL').trim().toUpperCase();

  if (!nombre)       return { error: 'Nombre requerido' };
  if (cantidad <= 0) return { error: 'Cantidad inválida' };

  var datos = inv.getDataRange().getValues();
  var filaExistente = -1;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][1]).trim().toUpperCase() === nombre) { filaExistente = i+1; break; }
  }

  var tz = Session.getScriptTimeZone();
  var fechaHist = new Date();

  if (filaExistente > 0) {
    var stockAnterior = parseInt(datos[filaExistente-1][2]) || 0;
    var nuevoStock     = stockAnterior + cantidad;
    var codigoExist    = String(datos[filaExistente-1][0] || '');
    inv.getRange(filaExistente,3).setValue(nuevoStock);
    if (venta > 0) inv.getRange(filaExistente,5).setValue(venta);
    if (costo > 0) inv.getRange(filaExistente,4).setValue(costo);
    if (prov)      inv.getRange(filaExistente,6).setValue(prov);

    hist.appendRow([fechaHist, nombre, cantidad, nuevoStock, codigoExist, prov, costo || '', venta || '', idOp, stockAnterior]);

    return { success: true, mensaje: '📦 Stock actualizado: ' + nombre + ' (+' + cantidad + ')', nuevo: false };
  } else {
    var ultimaFila   = inv.getLastRow() + 1;
    var datosSlice   = datos.slice(1);
    var ultimoCodigo = 0;
    for (var j = 0; j < datosSlice.length; j++) {
      var cod = String(datosSlice[j][0]);
      if (cod.startsWith(prefijo)) {
        var num = parseInt(cod.replace(prefijo,'')) || 0;
        if (num > ultimoCodigo) ultimoCodigo = num;
      }
    }
    var nuevoCodigo = prefijo + String(ultimoCodigo+1).padStart(3,'0');
    inv.getRange(ultimaFila,1,1,7).setValues([[nuevoCodigo, nombre, cantidad, costo, venta, prov, cat]]);

    hist.appendRow([fechaHist, nombre, cantidad, cantidad, nuevoCodigo, prov, costo || '', venta || '', idOp, 0]);

    return { success: true, mensaje: '✅ Nuevo producto: ' + nombre + ' (' + nuevoCodigo + ')', nuevo: true };
  }
}

// v021 (P0-2): el Ajuste participa del MISMO ScriptLock que venta, fiado e
// ingreso (mismo patrón que ingresarMercaderia). La sesión se valida fuera.
function ajustarStock(data, prefijo) {
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var lock = LockService.getScriptLock();
  var tieneLock = false;
  try {
    tieneLock = lock.tryLock(10000);
  } catch (e) {
    tieneLock = false;
  }
  if (!tieneLock) {
    return { error: 'Sistema ocupado, reintentar', ocupado: true };
  }

  try {
    return _ajustarStockSinLock_(data, prefijo);
  } finally {
    lock.releaseLock();
  }
}

// Cuerpo de ajustarStock (v020) sin la validación de sesión, que pasó al
// envoltorio. Llamar SOLO con el ScriptLock tomado.
function _ajustarStockSinLock_(data, prefijo) {
  var inv        = getHojaInv(prefijo);
  var filaIdx    = parseInt(data.id);
  var nuevoStock = parseInt(data.stock);
  var nuevoPrecio= parseFloat(data.precio);
  var nuevoNombre= (data.nombre || '').trim().toUpperCase();
  var nuevoCodigo= (data.codigo || '').trim().toUpperCase();

  if (!filaIdx || filaIdx < 2) return { error: 'ID inválido' };

  // v021 (P0-2): el frontend TIENE que demostrar cuál fue el stock base que
  // vio el cajero. Sin stockOriginal numérico no se escribe nada.
  var so = data.stockOriginal;
  if (so === undefined || so === null || so === '' || isNaN(Number(so))) {
    return { success: false, definitivo: true, actualizarPOS: true,
             error: 'Tu POS está desactualizado. Recargá la página (Ctrl+F5) y volvé a hacer el ajuste.' };
  }
  var stockOriginal = Number(so);

  var filaActual  = inv.getRange(filaIdx, 1, 1, 7).getValues()[0];

  // ETAPA 4 (P0-1): se verifica la identidad ORIGINAL del producto elegido
  // (no los valores nuevos editados) ANTES de modificar cualquier celda.
  if ((data.codigoOriginal || data.nombreOriginal) &&
      !_identidadCoincide_(filaActual, data.codigoOriginal, data.nombreOriginal)) {
    return { success: false, definitivo: true, identidad: true,
             error: 'El producto cambió en el inventario. Recargá y volvé a elegirlo.' };
  }

  var nombreAntes = String(filaActual[1] || '').trim();
  var stockAntes  = Number(filaActual[2]) || 0;
  var precioAntes = Number(filaActual[4]) || 0;
  var catAntes    = String(filaActual[6] || '').trim();

  // v021 (P0-2): semántica ABSOLUTA. Si el stock solicitado es igual al
  // original, el usuario NO tocó el stock → no se escribe (se conserva el
  // real). Si lo cambió y la hoja ya no tiene el stock que vio → rechazo
  // definitivo, cero escrituras.
  var cambiaStock = !isNaN(nuevoStock) && nuevoStock >= 0 && nuevoStock !== stockOriginal;
  if (cambiaStock && stockAntes !== stockOriginal) {
    return { success: false, definitivo: true, stockCambio: true, stock: stockAntes,
             error: 'El stock cambió (ahora ' + stockAntes + '). Volvé a elegir el producto y ajustá de nuevo.' };
  }

  if (cambiaStock) inv.getRange(filaIdx,3).setValue(nuevoStock);
  if (!isNaN(nuevoPrecio)  && nuevoPrecio >  0) inv.getRange(filaIdx,5).setValue(nuevoPrecio);
  if (nuevoNombre) inv.getRange(filaIdx,2).setValue(nuevoNombre);
  if (nuevoCodigo) inv.getRange(filaIdx,1).setValue(nuevoCodigo);

  var stockDespues  = cambiaStock ? nuevoStock : stockAntes; // v021: lo que REALMENTE quedó
  var precioDespues = (!isNaN(nuevoPrecio) && nuevoPrecio >  0) ? nuevoPrecio : precioAntes;
  var nombreDespues = nuevoNombre ? nuevoNombre : nombreAntes;

  _registrarAuditoriaAjusteXX_(prefijo, {
    producto:     nombreAntes,
    nombreAntes:  nombreAntes,  nombreDespues:  nombreDespues,
    stockAntes:   stockAntes,   stockDespues:   stockDespues,
    precioAntes:  precioAntes,  precioDespues:  precioDespues,
    catAntes:     catAntes,     catDespues:     catAntes,
    usuario:      data.usuario
  });

  return { success: true, mensaje: 'Producto actualizado', stock: stockDespues };
}

function getEstadisticas(data, prefijo) {
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var ventas     = getHojaVentas(prefijo);
  var filas      = ventas.getDataRange().getValues();
  var hoy        = new Date();
  var hoyStr     = Utilities.formatDate(hoy, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var mesActual  = hoy.getMonth();
  var anioActual = hoy.getFullYear();
  var resHoy = {}, resMes = {}, resProductos = {}, resMeses = {};
  var ventasHoy = 0, ventasMes = 0;

  for (var i = 1; i < filas.length; i++) {
    var fila  = filas[i];
    var fecha = fila[0];
    if (!fecha || !(fecha instanceof Date)) continue;
    var nombre   = String(fila[1]||'').trim().toUpperCase();
    var qty      = parseFloat(fila[2])||0;
    var total    = parseFloat(fila[5])||0;
    var metodo   = String(fila[4]||'EFECTIVO').trim().toUpperCase();
    var fechaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var mesStr   = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM');
    var esMes    = fecha.getMonth()===mesActual && fecha.getFullYear()===anioActual;

    if (fechaStr===hoyStr) { resHoy[metodo]=(resHoy[metodo]||0)+total; ventasHoy+=total; }
    if (esMes)             { resMes[metodo]=(resMes[metodo]||0)+total; ventasMes+=total; }
    resMeses[mesStr]=(resMeses[mesStr]||0)+total;
    if (esMes && nombre) {
      if (!resProductos[nombre]) resProductos[nombre]={qty:0,total:0};
      resProductos[nombre].qty+=qty; resProductos[nombre].total+=total;
    }
  }

  var topProductos = [];
  var entries = Object.keys(resProductos).map(function(k){ return [k, resProductos[k]]; });
  entries.sort(function(a,b){ return b[1].total-a[1].total; });
  for (var t = 0; t < Math.min(10, entries.length); t++) {
    topProductos.push({ nombre:entries[t][0], qty:entries[t][1].qty, total:entries[t][1].total });
  }

  var histMeses = [];
  var mEntries = Object.keys(resMeses).sort();
  for (var m = 0; m < mEntries.length; m++) {
    histMeses.push({ mes:mEntries[m], total:resMeses[mEntries[m]] });
  }

  return { hoy:{metodos:resHoy,total:ventasHoy}, mes:{metodos:resMes,total:ventasMes}, topProductos:topProductos, histMeses:histMeses };
}

function getVentasDiarias(data, prefijo) {
  var ventas = getHojaVentas(prefijo);
  var anio   = parseInt(data.anio) || new Date().getFullYear();
  var mes    = parseInt(data.mes);
  var filas  = ventas.getDataRange().getValues();
  var dias   = {};
  var metodosArr = [];

  for (var i = 1; i < filas.length; i++) {
    var fila  = filas[i];
    var fecha = fila[0];
    if (!fecha || !(fecha instanceof Date)) continue;
    if (fecha.getFullYear() !== anio) continue;
    if (!isNaN(mes) && fecha.getMonth() !== mes) continue;
    var dia    = fecha.getDate();
    var metodo = String(fila[4]||'EFECTIVO').trim().toUpperCase();
    var total  = parseFloat(fila[5])||0;
    if (!dias[dia]) dias[dia]={};
    dias[dia][metodo]=(dias[dia][metodo]||0)+total;
    if (metodosArr.indexOf(metodo)===-1) metodosArr.push(metodo);
  }
  return { dias:dias, metodos:metodosArr.sort(), anio:anio, mes:isNaN(mes)?-1:mes };
}

function getVentas(prefijo, token) {
  var errAcceso = _requiereSesionValida_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var ventas  = getHojaVentas(prefijo);
  var filas   = ventas.getDataRange().getValues();
  var tz      = Session.getScriptTimeZone();
  var resultado = [];
  for (var i = 1; i < filas.length; i++) {
    var fila  = filas[i];
    var fecha = fila[0];
    if (!fecha || !(fecha instanceof Date)) continue;
    resultado.push({
      fecha:  Utilities.formatDate(fecha, tz, 'yyyy-MM-dd'),
      hora:   Utilities.formatDate(fecha, tz, 'HH:mm'),
      nombre: String(fila[1]||'').trim().toUpperCase(),
      qty:    parseFloat(fila[2])||0,
      precio: parseFloat(fila[3])||0,
      metodo: String(fila[4]||'EFECTIVO').trim().toUpperCase(),
      total:  parseFloat(fila[5])||0
    });
  }
  return { ventas: resultado };
}

// ===============================
// MÓDULO AUTH — VAO SmartPOS
// Gestión segura de acceso admin y PIN de clientes
// Tokens y PINs NUNCA en Sheets — solo en Script Properties
// ===============================

// ── HELPERS ──────────────────────────────────────────────────────

function generarToken(largo) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < (largo || 32); i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function hashSimple(texto) {
  // Hash básico para no guardar PINs en texto plano en Properties
  // No es criptográfico pero es suficiente para este sistema
  var hash = 0;
  var sal  = 'VAO2026';
  var str  = sal + texto + sal;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'H' + Math.abs(hash).toString(36).toUpperCase();
}

// ── ADMIN — CLAVE MAESTRA ─────────────────────────────────────────

function generarClaveAdmin() {
  var clave = 'ventilador220'; // CAMBIA ESTA CLAVE

  if (clave.length < 6) {
    Logger.log('ERROR: La clave debe tener al menos 6 caracteres');
    return;
  }

  var props = PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_CLAVE_HASH', hashSimple(clave));

  Logger.log('✅ Clave admin configurada correctamente');
}

function _test1_ping() {
  Logger.log('ping ok');
}


function adminLogin(data) {
  var clave = (data.clave || '').trim();
  if (!clave) return { error: 'Clave requerida' };

  var props     = PropertiesService.getScriptProperties();
  var claveHash = props.getProperty('ADMIN_CLAVE_HASH');

  if (!claveHash) return { error: 'Sistema no configurado — ejecutar setAdminClave() primero' };
  if (hashSimple(clave) !== claveHash) return { error: 'Clave incorrecta' };

  // Token de sesión admin — nace con 10 minutos de vigencia; se renueva
  // otros 10 minutos en cada acción válida (ver validarSesionAdmin).
  var token  = 'ADMIN_' + generarToken(24);
  var expira = new Date().getTime() + (10 * 60 * 1000);
  var ahora  = new Date().getTime();

  // Retirar la clave vieja de un solo admin global (migración, sin función
  // manual aparte) y limpiar sesiones admin vencidas de cualquier dispositivo,
  // sin tocar las que todavía están vigentes.
  props.deleteProperty('SESSION_ADMIN');
  var prefKey = 'SESSION_ADMIN_';
  var todas = props.getProperties();
  for (var key in todas) {
    if (key.indexOf(prefKey) !== 0) continue;
    try {
      var s = JSON.parse(todas[key]);
      if (!s.expira || ahora > s.expira) props.deleteProperty(key);
    } catch (e) { props.deleteProperty(key); }
  }

  props.setProperty('SESSION_ADMIN_' + token, JSON.stringify({ token: token, expira: expira }));

  Logger.log('✅ Login admin exitoso');
  return { success: true, token: token, expira: expira };
}

function validarSesionAdmin(token) {
  if (!token || !token.startsWith('ADMIN_')) return false;
  var props    = PropertiesService.getScriptProperties();
  var sesionStr= props.getProperty('SESSION_ADMIN_' + token);
  if (!sesionStr) return false;
  try {
    var sesion = JSON.parse(sesionStr);
    if (sesion.token !== token) return false;
    if (new Date().getTime() > sesion.expira) {
      props.deleteProperty('SESSION_ADMIN_' + token);
      return false;
    }
    // Actividad válida: renovar únicamente esta sesión otros 10 minutos.
    var nuevaExpira = new Date().getTime() + (10 * 60 * 1000);
    props.setProperty('SESSION_ADMIN_' + token, JSON.stringify({ token: token, expira: nuevaExpira }));
    return true;
  } catch(e) { return false; }
}

// ── PIN DE CLIENTES ───────────────────────────────────────────────

// Ejecutar desde el editor para cargar el PIN de un cliente:
// setPIN('MC', '1234')
function setPIN(prefijo, pin) {
  prefijo = (prefijo || '').trim().toUpperCase();
  pin     = (pin || '').trim();
  if (!prefijo) { Logger.log('ERROR: Prefijo requerido'); return; }
  if (!pin || pin.length < 4) { Logger.log('ERROR: PIN debe tener al menos 4 caracteres'); return; }

  var props = PropertiesService.getScriptProperties();
  props.setProperty('PIN_' + prefijo, hashSimple(pin));

  // Actualizar estado en hoja CLIENTES_VAO si existe
  actualizarEstadoCliente(prefijo, 'PIN', 'CONFIGURADO ✅');

  Logger.log('✅ PIN configurado para ' + prefijo);
}

function eliminarPIN(prefijo) {
  prefijo = (prefijo || '').trim().toUpperCase();
  PropertiesService.getScriptProperties().deleteProperty('PIN_' + prefijo);
  actualizarEstadoCliente(prefijo, 'PIN', 'PENDIENTE ⚠️');
  Logger.log('🗑️ PIN eliminado para ' + prefijo);
}


// ── VIGENCIA COMERCIAL (V8) ─────────────────────────────────────────
// Candado independiente de la suspensión manual. Lee exclusivamente
// CLIENTES_VAO, columna I (Fecha Vence). No toca VENDEDORES, no toca
// CONFIG_XX, no apaga switches, no crea hojas ni columnas.
// Regla: Fecha Vence vacía o futura o == hoy → VIGENTE (comparación por
// fecha calendario, no por hora). Fecha Vence anterior a hoy → VENCIDO.
function _obtenerVigenciaCliente_(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_VAO');
  if (!hoja) return { vigente: true, fechaVence: null };

  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === prefijo) {
      var fechaVenceRaw = datos[i][8]; // I = Fecha Vence
      if (!fechaVenceRaw) return { vigente: true, fechaVence: null };

      var fv     = new Date(fechaVenceRaw);
      var hoy    = new Date();
      var hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      var venceDia = new Date(fv.getFullYear(), fv.getMonth(), fv.getDate());
      return { vigente: hoyDia <= venceDia, fechaVence: fv };
    }
  }
  return { vigente: true, fechaVence: null };
}

function clienteLogin(data) {
  var prefijo = (data.prefijo || '').trim().toUpperCase();
  var pin     = (data.pin     || '').trim();

  if (!prefijo) return { error: 'Prefijo requerido' };
  if (!pin)     return { error: 'PIN requerido' };

  // Verificar que el cliente existe y está activo
  var infoCliente = obtenerInfoCliente(prefijo);
  if (!infoCliente)            return { error: 'Cliente no encontrado' };
  if (!infoCliente.activo)     return { error: 'Cliente inactivo — contactar a VAO Sistemas' };
  if (!_obtenerVigenciaCliente_(prefijo).vigente) return { error: 'Suscripción vencida — contactar a VAO Sistemas' };

  // Validar PIN
  var props   = PropertiesService.getScriptProperties();
  var pinHash = props.getProperty('PIN_' + prefijo);
  if (!pinHash) return { error: 'Acceso no configurado — contactar a VAO Sistemas' };
  if (hashSimple(pin) !== pinHash) return { error: 'PIN incorrecto' };

  // Generar token de sesión cliente (duración 7 días)
  var token  = 'CLI_' + prefijo + '_' + generarToken(20);
  var expira = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
  var ahora  = new Date().getTime();

  // Limpiar sesiones vencidas del mismo prefijo antes de agregar la nueva
  var prefKey = 'SESSION_' + prefijo + '_';
  var todas = props.getProperties();
  for (var key in todas) {
    if (key.indexOf(prefKey) !== 0) continue;
    try {
      var s = JSON.parse(todas[key]);
      if (!s.expira || ahora > s.expira) props.deleteProperty(key);
    } catch (e) { props.deleteProperty(key); }
  }

  props.setProperty('SESSION_' + prefijo + '_' + token, JSON.stringify({ token: token, expira: expira }));

  Logger.log('✅ Login exitoso: ' + prefijo);
  return {
    success: true,
    token:   token,
    expira:  expira,
    prefijo: prefijo,
    nombre:  infoCliente.nombre
  };
}

function validarSesionCliente(prefijo, token) {
  if (!prefijo || !token) return false;
  if (!token.startsWith('CLI_' + prefijo + '_')) return false;

  var props    = PropertiesService.getScriptProperties();
  var sesionStr= props.getProperty('SESSION_' + prefijo + '_' + token);
  if (!sesionStr) return false;

  try {
    var sesion = JSON.parse(sesionStr);
    if (sesion.token !== token) return false;
    if (new Date().getTime() > sesion.expira) {
      props.deleteProperty('SESSION_' + prefijo + '_' + token);
      return false;
    }
    return true;
  } catch(e) { return false; }
}

function cerrarSesionCliente(prefijo, token) {
  prefijo = (prefijo || '').trim().toUpperCase();
  token   = (token || '').trim();
  if (prefijo && token) {
    PropertiesService.getScriptProperties().deleteProperty('SESSION_' + prefijo + '_' + token);
  }
  return { success: true };
}

// Con la sesión ya scopeada por token en el propio nombre de la clave,
// no hace falta leer/comparar antes de borrar: si el token es incorrecto
// o viejo, esa clave puntual simplemente no existe, y el delete no afecta
// a ninguna otra sesión admin.
function cerrarSesionAdmin(token) {
  token = (token || '').trim();
  if (token) {
    PropertiesService.getScriptProperties().deleteProperty('SESSION_ADMIN_' + token);
  }
  return { success: true };
}

// ── HELPERS INTERNOS ──────────────────────────────────────────────

function obtenerInfoCliente(prefijo) {
  // Busca en VENDEDORES (planilla del sistema)
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('VENDEDORES');
  if (!hoja) return null;
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    if (String(f[0]).trim().toUpperCase() === prefijo) {
      return {
        prefijo: prefijo,
        nombre:  String(f[1] || '').trim(),
        activo:  String(f[6] || '').trim().toLowerCase() === 'si'
      };
    }
  }
  return null;
}

function actualizarEstadoCliente(prefijo, campo, valor) {
  // Actualiza columna L (Token MP) o M (PIN) en CLIENTES_VAO si existe
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName('CLIENTES_VAO');
    if (!hoja) return;
    var datos = hoja.getDataRange().getValues();
    var colMap = { 'TOKEN': 12, 'PIN': 13 }; // L=12, M=13
    var col = colMap[campo.toUpperCase()];
    if (!col) return;
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).trim().toUpperCase() === prefijo) {
        hoja.getRange(i+1, col).setValue(valor);
        return;
      }
    }
  } catch(e) { Logger.log('actualizarEstadoCliente: ' + e.message); }
}

// ── SINCRONIZACIÓN CLIENTES_VAO ↔ VENDEDORES ───────────────────────
// Fuente de verdad decidida (auditoría 2026-09-18):
//  - VENDEDORES.Activo (col G, si/no) sigue siendo el gate técnico de login
//    (lo usa obtenerInfoCliente/clienteLogin, NO SE TOCA en este paso).
//  - CLIENTES_VAO.Estado (ACTIVO/SUSPENDIDO/BAJA) es la vista comercial/admin.
//  - A partir de ahora ambas se mantienen sincronizadas: crearVendedor()
//    crea la fila en las dos hojas, y activarCliente/suspenderCliente
//    actualizan las dos en la misma operación.
// Columnas CLIENTES_VAO: A=Prefijo B=Nombre Negocio C=Contacto D=Teléfono
//  E=Correo F=Plan G=Estado H=Fecha Alta I=Fecha Vence J=Alias Pago
//  K=Link MP L=Token MP M=PIN N=Observaciones

// Crea la fila comercial en CLIENTES_VAO al dar de alta un cliente nuevo.
// Fecha Vence: no hay una regla de plazo definida en la especificación
// (días de prueba, vencimiento de plan, etc.) → se deja vacía a propósito,
// REQUIERE DECISIÓN. No se inventa un plazo.
function crearFilaClientesVao(prefijo, nombre, telefono, correo, plan, aliasPago, linkMP, tieneTokenMP) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_VAO');
  if (!hoja) { Logger.log('crearFilaClientesVao: no existe hoja CLIENTES_VAO'); return; }

  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === prefijo) return; // ya existe, no duplicar
  }

  var ultimaFila = hoja.getLastRow() + 1;
  hoja.getRange(ultimaFila, 1, 1, 14).setValues([[
    prefijo,                 // A Prefijo
    nombre,                  // B Nombre Negocio
    '',                      // C Contacto (nombre del dueño — no llega en el alta actual)
    telefono,                // D Teléfono
    correo,                  // E Correo
    plan || '',              // F Plan
    'ACTIVO',                // G Estado
    new Date(),               // H Fecha Alta
    '',                       // I Fecha Vence — REQUIERE DECISIÓN, se deja vacía
    aliasPago,                // J Alias Pago
    linkMP,                   // K Link MP
    tieneTokenMP ? 'CONFIGURADO ✅' : 'PENDIENTE ⚠️', // L Token MP
    'CONFIGURADO ✅',         // M PIN (crearVendedor siempre genera uno)
    ''                        // N Observaciones
  ]]);
}

// Endpoint admin — activa un cliente: VENDEDORES.Activo='si' + CLIENTES_VAO.Estado='ACTIVO'
function activarCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = (data.prefijo || '').trim().toUpperCase();
  if (!prefijo) return { error: 'Prefijo requerido' };

  var ok = _setActivoVendedor(prefijo, 'si');
  if (!ok) return { error: 'Cliente no encontrado en VENDEDORES' };
  _setEstadoClientesVao(prefijo, 'ACTIVO');

  return { success: true, mensaje: '✅ Cliente ' + prefijo + ' activado' };
}

// Endpoint admin — suspende un cliente: VENDEDORES.Activo='no' + CLIENTES_VAO.Estado='SUSPENDIDO'
// No borra ni toca PIN/Token — solo el estado. El login queda bloqueado porque
// clienteLogin() exige infoCliente.activo (ya usa esta misma columna).
function suspenderCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = (data.prefijo || '').trim().toUpperCase();
  if (!prefijo) return { error: 'Prefijo requerido' };

  var ok = _setActivoVendedor(prefijo, 'no');
  if (!ok) return { error: 'Cliente no encontrado en VENDEDORES' };
  _setEstadoClientesVao(prefijo, 'SUSPENDIDO');

  return { success: true, mensaje: '🔒 Cliente ' + prefijo + ' suspendido' };
}

// Endpoint admin — resetea el PIN de un cliente generando uno nuevo.
// Reutiliza generarPinAleatorio() y setPIN() tal cual existen, sin
// modificarlas. No toca sesiones existentes (setPIN nunca tocó
// SESSION_<prefijo>_<token>, y esta función tampoco lo hace).
function resetPinCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = (data.prefijo || '').trim().toUpperCase();
  if (!prefijo) return { error: 'Prefijo requerido' };

  var infoCliente = obtenerInfoCliente(prefijo);
  if (!infoCliente) return { error: 'Cliente no encontrado en VENDEDORES' };

  var nuevoPin = generarPinAleatorio();
  setPIN(prefijo, nuevoPin);

  return { success: true, prefijo: prefijo, pin: nuevoPin, mensaje: '✅ PIN reseteado' };
}

function _setActivoVendedor(prefijo, valorSiNo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('VENDEDORES');
  if (!hoja) return false;
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === prefijo) {
      hoja.getRange(i+1, 7).setValue(valorSiNo); // G = Activo
      return true;
    }
  }
  return false;
}

function _setEstadoClientesVao(prefijo, estado) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_VAO');
  if (!hoja) return;
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === prefijo) {
      hoja.getRange(i+1, 7).setValue(estado); // G = Estado
      return;
    }
  }
}

// Endpoint admin — renueva la vigencia comercial de un cliente (V8).
// Toca EXCLUSIVAMENTE CLIENTES_VAO columna I (Fecha Vence). No toca
// Estado ni VENDEDORES.Activo — la suspensión manual es independiente
// y esta función nunca la modifica.
// FÓRMULA ÚNICA: nuevaFecha = max(hoy, FechaVenceActual) + dias.
// Cubre los 3 casos a la vez: sin Fecha Vence → arranca desde hoy;
// vigente/vence hoy → conserva los días que ya tenía pagados; ya
// vencida → max() descarta la fecha pasada y arranca igual desde hoy.
function renovarVigenciaCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };

  var prefijo = (data.prefijo || '').trim().toUpperCase();
  var dias    = parseInt(data.dias, 10);
  if (!prefijo) return { error: 'Prefijo requerido' };
  if (!dias || dias <= 0 || dias !== parseFloat(data.dias)) return { error: 'Cantidad de días inválida' };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_VAO');
  if (!hoja) return { error: 'No existe hoja CLIENTES_VAO' };
  var datos = hoja.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === prefijo) {
      var hoy    = new Date();
      var hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

      var base = hoyDia;
      var fechaActual = datos[i][8]; // I = Fecha Vence
      if (fechaActual) {
        var fv    = new Date(fechaActual);
        var fvDia = new Date(fv.getFullYear(), fv.getMonth(), fv.getDate());
        base = new Date(Math.max(hoyDia.getTime(), fvDia.getTime()));
      }
      var nuevaFecha = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);

      hoja.getRange(i + 1, 9).setValue(nuevaFecha); // I = Fecha Vence
      return { success: true, prefijo: prefijo, fechaVence: nuevaFecha, mensaje: '✅ Vigencia renovada' };
    }
  }
  return { error: 'Cliente no encontrado en CLIENTES_VAO' };
}

// ===============================
// MÓDULO CLIENTES_XX — clientes del NEGOCIO de cada prefijo
// (NO confundir con CLIENTES_VAO, que es la administración comercial
// de VAO Sistemas sobre sus propios clientes-negocio)
// ===============================
// SEBA21: hoja "Clientes" con 2 columnas (Nombre, Telefono), liviana,
//   se autocompleta sola vía upsertCliente() cada vez que se guarda un
//   fiado — no es un CRM, es solo la lista para el buscador de fiados.
//   La deuda NO se guarda en Clientes: se calcula siempre leyendo FIADOS.
// VAO MULTIHOJA: mismo patrón, adaptado a hoja por cliente CLIENTES_XX.
// MOTIVO: la spec solo pide "buscar cliente" y que el cliente de un
//   fiado salga de esta hoja (no de localStorage) — no pide un CRM con
//   más campos, y agregar campos no pedidos sería inventar sin base.

function crearHojaClientesXX(ss, prefijo) {
  var nombreHoja = 'CLIENTES_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return; // ya existe, no se toca
  var hoja = ss.insertSheet(nombreHoja);
  hoja.getRange(1, 1, 1, 2).setValues([['Nombre', 'Telefono']]);
  hoja.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#e8f5e9');
  hoja.setFrozenRows(1);
}

function getHojaClientes(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_' + prefijo);
  if (!hoja) throw new Error('No existe hoja CLIENTES_' + prefijo);
  return hoja;
}

// Endpoint: ?action=getClientes&prefijo=XX — lista para el buscador de fiados
function getClientesXX(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_' + prefijo);
  if (!hoja) return { clientes: [] }; // cliente aún sin la hoja (creado antes de este paso)

  var datos = hoja.getDataRange().getValues();
  var clientes = [];
  for (var i = 1; i < datos.length; i++) {
    var nombre = String(datos[i][0] || '').trim();
    if (!nombre) continue;
    clientes.push({ nombre: nombre, telefono: String(datos[i][1] || '').trim() });
  }
  clientes.sort(function(a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  return { clientes: clientes };
}

// Inserta el cliente si no existe; si existe completa el teléfono solo si
// estaba vacío. Mismo comportamiento que upsertCliente() de Seba21, pero
// sobre la hoja CLIENTES_<prefijo>. La usará guardarFiadoXX en el paso 3
// (no es un endpoint propio todavía — no hay UI que la llame sola aún).
function upsertClienteXX(prefijo, nombre, telefono) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName('CLIENTES_' + prefijo);
    if (!hoja) { crearHojaClientesXX(ss, prefijo); hoja = ss.getSheetByName('CLIENTES_' + prefijo); }

    var nombreNorm = String(nombre || '').trim().toUpperCase();
    if (!nombreNorm) return;
    var telLimpio = String(telefono || '').replace(/\D/g, '');
    var datos = hoja.getDataRange().getValues();

    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0] || '').trim().toUpperCase() === nombreNorm) {
        if (!String(datos[i][1] || '').trim() && telLimpio) {
          hoja.getRange(i + 1, 2).setValue(telLimpio);
        }
        return;
      }
    }
    hoja.appendRow([String(nombre).trim(), telLimpio]);
  } catch (e) {
    Logger.log('upsertClienteXX error (no crítico): ' + e.message);
  }
}

// ===============================
// MÓDULO FIADOS_XX — fiado por cliente de negocio (CLIENTES_XX)
// Adaptado 1:1 de la estructura de columnas de Seba21/Copihue (hoja
// FIADOS, funciones listarFiados/consultarFiado/listarFiadosCliente/
// guardarFiado/abonarFiado/cobrarFiado) — misma cantidad de columnas,
// mismo orden, misma fórmula de estado. Solo cambia: cada cliente VAO
// tiene su propia hoja FIADOS_<prefijo> en vez de una sola hoja FIADOS
// global, y las llamadas pasan siempre por token de sesión del cliente.
//
// SEBA21: guardarFiado()/listarFiadosCliente() enriquecen cada fiado
//   con el detalle de productos del ticket (getDetalleTicket, leyendo
//   la hoja "Ventas" por número de ticket).
// VAO MULTIHOJA: no se enriquece con detalle de ticket.
// MOTIVO: VENTAS_XX (creada en pasos anteriores) no tiene número de
//   ticket ni columna de referencia a fiado — es una estructura más
//   simple que la de Seba21. Agregar eso ahora sería tocar VENTAS_XX
//   sin que el paso lo pida. Se deja fuera y documentado, no inventado.
//
// SEBA21: pagarFiadosSeleccionados() (cobro múltiple) registra el
//   ingreso en CAJA_MOVIMIENTOS.
// VAO MULTIHOJA: cobrarFiadoXX()/abonarFiadoXX() (cobro de a uno, que
//   es lo mínimo pedido en este paso) NO registran nada en caja.
// MOTIVO: CAJA_XX/CAJA_MOVIMIENTOS_XX todavía no existen (son el
//   Paso 6) — conectar ahí ahora rompería con una hoja inexistente.
//   Queda pendiente explícito para cuando se construya el Paso 6.
//
// Columnas FIADOS_<prefijo> (A–N, idénticas en orden a Seba21):
//  A=IdFiado B=Fecha C=Ticket D=Cliente E=Telefono F=Descripcion
//  G=CantItems H=TotalOriginal I=Saldo J=FechaVencimiento K=Estado
//  L=FechaPago M=MetodoPago N=Observaciones

function crearHojaFiadosXX(ss, prefijo) {
  var nombreHoja = 'FIADOS_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return; // ya existe, no se toca
  var hoja = ss.insertSheet(nombreHoja);
  var headers = ['IdFiado','Fecha','Ticket','Cliente','Telefono','Descripcion',
    'CantItems','TotalOriginal','Saldo','FechaVencimiento','Estado',
    'FechaPago','MetodoPago','Observaciones'];
  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#37474f').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
}

function getHojaFiados(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);
  if (!hoja) throw new Error('No existe hoja FIADOS_' + prefijo);
  return hoja;
}

// Chequeo de sesión reutilizado por todas las acciones de fiados —
// mismo chain que getConfig (Reglas 24-29): prefijo existe → activo → token válido.
// ===============================
// VALIDACIÓN DE SESIÓN — función única compartida (Paso 11)
// Antes de este paso existían 7 funciones _validarAcceso*_ (fiados,
// historial, préstamos, caja, salidas, ajuste, ofertas) con el cuerpo
// EXACTAMENTE IDÉNTICO, verificado línea por línea antes de tocar nada.
// Se unifican en esta única función; las 7 anteriores quedan como
// delegados de una línea (mismo nombre, mismo comportamiento, cero
// lógica duplicada) para no romper ningún llamado existente.
// ===============================
function _requiereSesionValida_(prefijo, token) {
  var infoCliente = obtenerInfoCliente(prefijo);
  if (!infoCliente)        return 'Cliente no encontrado';
  if (!infoCliente.activo) return 'Cliente inactivo — contactar a VAO Sistemas';
  if (!_obtenerVigenciaCliente_(prefijo).vigente) return 'Suscripción vencida — contactar a VAO Sistemas';
  if (!validarSesionCliente(prefijo, token)) return 'Sesión inválida o expirada';
  return null; // sin error = acceso OK
}

function _validarAccesoFiados_(prefijo, token)     { return _requiereSesionValida_(prefijo, token); }
function _validarAccesoHistorial_(prefijo, token)  { return _requiereSesionValida_(prefijo, token); }
function _validarAccesoPrestamos_(prefijo, token)  { return _requiereSesionValida_(prefijo, token); }
function _validarAccesoCaja_(prefijo, token)       { return _requiereSesionValida_(prefijo, token); }
function _validarAccesoSalidas_(prefijo, token)    { return _requiereSesionValida_(prefijo, token); }
function _validarAccesoAjuste_(prefijo, token)     { return _requiereSesionValida_(prefijo, token); }
function _validarAccesoOfertas_(prefijo, token)    { return _requiereSesionValida_(prefijo, token); }

// Endpoint: ?action=getFiados&prefijo=XX&data={token} — listado completo
// (oculta PAGADOs de más de 30 días, igual que Seba21)
function listarFiadosXX(prefijo, token) {
  var errAcceso = _validarAccesoFiados_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);
  if (!hoja) return { fiados: [] }; // cliente creado antes de este paso

  var datos = hoja.getDataRange().getValues();
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var fiados = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;

    var estado = String(fila[10] || '').toUpperCase();
    var vencFecha = fila[9] ? new Date(fila[9]) : null;
    if (vencFecha && vencFecha < hoy && estado !== 'PAGADO') estado = 'VENCIDO';

    if (estado === 'PAGADO') {
      var fechaPago = fila[11] ? new Date(fila[11]) : null;
      var hace30 = new Date(hoy); hace30.setDate(hace30.getDate() - 30);
      if (!fechaPago || fechaPago < hace30) continue;
    }

    var totalOriginal = parseFloat(fila[7]) || 0;
    var saldo         = parseFloat(fila[8]) || 0;

    fiados.push({
      fila:             i + 1,
      idFiado:          String(fila[0] || ''),
      fecha:            String(fila[1] || ''),
      ticket:           String(fila[2] || ''),
      cliente:          String(fila[3] || ''),
      telefono:         String(fila[4] || ''),
      descripcion:      String(fila[5] || ''),
      cantItems:        fila[6] || 0,
      totalOriginal:    totalOriginal,
      total:            saldo,
      totalAbonado:     Math.max(0, totalOriginal - saldo),
      fechaVencimiento: fila[9] ? String(fila[9]).split('T')[0] : '',
      fechaPago:        fila[11] ? String(fila[11]) : '',
      metodoPago:       String(fila[12] || ''),
      observaciones:    String(fila[13] || ''),
      estado:           estado
    });
  }

  fiados.sort(function(a, b) {
    if (a.estado === 'VENCIDO' && b.estado !== 'VENCIDO') return -1;
    if (b.estado === 'VENCIDO' && a.estado !== 'VENCIDO') return 1;
    return (a.fechaVencimiento || '').localeCompare(b.fechaVencimiento || '');
  });

  return { fiados: fiados };
}

// Endpoint: ?action=consultarDeuda&prefijo=XX&data={token,telefono}
function consultarDeudaXX(prefijo, token, telefono) {
  var errAcceso = _validarAccesoFiados_(prefijo, token);
  if (errAcceso) return { error: errAcceso };
  if (!telefono) return { deuda: null };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);
  if (!hoja) return { deuda: null };

  var datos = hoja.getDataRange().getValues();
  var telBuscar = String(telefono).replace(/\D/g, '');
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var totalDeuda = 0, pendientes = 0, vencidos = 0, nombreCliente = '';

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var telFila = String(fila[4] || '').replace(/\D/g, '');
    if (telFila !== telBuscar) continue;

    var estado = String(fila[10] || '').toUpperCase();
    if (estado === 'PAGADO') continue;

    var fechaVenc = fila[9] ? new Date(fila[9]) : null;
    if (fechaVenc && fechaVenc < hoy) estado = 'VENCIDO';

    var total = parseFloat(fila[8]) || 0;
    totalDeuda += total;
    pendientes++;
    if (estado === 'VENCIDO') vencidos++;
    if (!nombreCliente && fila[3]) nombreCliente = String(fila[3]);
  }

  if (pendientes === 0) return { deuda: null };
  return { deuda: { nombre: nombreCliente, total: totalDeuda, pendientes: pendientes, vencidos: vencidos } };
}

// Endpoint: ?action=getFiadosCliente&prefijo=XX&data={token,telefono|cliente}
// Historial de pendientes/vencidos de UN cliente puntual (para la ficha del cliente).
function listarFiadosClienteXX(prefijo, data) {
  var errAcceso = _validarAccesoFiados_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var telefono = String(data.telefono || '').replace(/\D/g, '');
  var cliente  = String(data.cliente  || '').trim().toUpperCase();
  if (!telefono && !cliente) return { error: 'Se requiere teléfono o cliente' };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);
  if (!hoja) return { fiados: [], totalDeuda: 0, cantFiados: 0, hayVencidos: false };

  var rows = hoja.getDataRange().getValues();
  var hoy  = new Date(); hoy.setHours(0,0,0,0);
  var fiados = [];

  for (var i = 1; i < rows.length; i++) {
    var fila = rows[i];
    if (!fila[0]) continue;

    var telFila = String(fila[4] || '').replace(/\D/g, '');
    var cliFila = String(fila[3] || '').trim().toUpperCase();
    var coincide = (telefono && telFila === telefono) || (!telefono && cliFila === cliente);
    if (!coincide) continue;

    var estado = String(fila[10] || '').toUpperCase();
    var vencFecha = fila[9] ? new Date(fila[9]) : null;
    if (vencFecha && vencFecha < hoy && estado !== 'PAGADO') estado = 'VENCIDO';
    if (estado === 'PAGADO') continue; // solo pendientes + vencidos

    var totalOriginal = parseFloat(fila[7]) || 0;
    var saldo         = parseFloat(fila[8]) || 0;

    fiados.push({
      idFiado:          String(fila[0]),
      fecha:            String(fila[1] || ''),
      ticket:           String(fila[2] || ''),
      cliente:          String(fila[3] || ''),
      telefono:         String(fila[4] || ''),
      descripcion:      String(fila[5] || ''),
      cantItems:        fila[6] || 0,
      totalOriginal:    totalOriginal,
      totalPendiente:   saldo,
      abonadoParcial:   totalOriginal > saldo,
      montoAbonado:     Math.round((totalOriginal - saldo) * 100) / 100,
      fechaVencimiento: fila[9] ? String(fila[9]).split('T')[0] : '',
      estado:           estado,
      observaciones:    String(fila[13] || '')
    });
  }

  fiados.sort(function(a, b) {
    if (a.estado === 'VENCIDO' && b.estado !== 'VENCIDO') return -1;
    if (b.estado === 'VENCIDO' && a.estado !== 'VENCIDO') return 1;
    return a.fecha.localeCompare(b.fecha);
  });

  var totalDeuda  = fiados.reduce(function(s, f) { return s + f.totalPendiente; }, 0);
  var hayVencidos = fiados.some(function(f) { return f.estado === 'VENCIDO'; });

  return {
    cliente:     fiados.length ? fiados[0].cliente : (data.cliente || ''),
    telefono:    telefono,
    totalDeuda:  Math.round(totalDeuda * 100) / 100,
    cantFiados:  fiados.length,
    hayVencidos: hayVencidos,
    fiados:      fiados
  };
}

// Endpoint: ?action=registrarFiado&prefijo=XX&data={token,cliente,telefono,
//   descripcion,cantItems,total,vencimiento,ticket,obs}
function registrarFiadoXX(prefijo, data) {
  var errAcceso = _validarAccesoFiados_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var cliente = (data.cliente || '').trim();
  var total   = parseFloat(data.total) || 0;
  if (!cliente) return { error: 'Cliente requerido' };
  if (total <= 0) return { error: 'Monto inválido' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('FIADOS_' + prefijo)) crearHojaFiadosXX(ss, prefijo);
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);

  var tz = Session.getScriptTimeZone();
  var fechaStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
  var numFiado = hoja.getLastRow();
  var idFiado  = data.idFiado || ('FIADO-' + String(numFiado).padStart(4, '0'));

  hoja.appendRow([
    idFiado, fechaStr,
    data.ticket || '', cliente, data.telefono || '',
    data.descripcion || 'FIADO', data.cantItems || 1,
    total, total,
    data.vencimiento || '',
    '', '', '',
    data.obs || ''
  ]);

  var nuevaFila = hoja.getLastRow();
  hoja.getRange(nuevaFila, 11).setFormula(
    '=IF(D' + nuevaFila + '="";"";IF(L' + nuevaFila + '<>"";"PAGADO";' +
    'IF(AND(J' + nuevaFila + '<>"";TODAY()>J' + nuevaFila + ');"VENCIDO";"PENDIENTE")))'
  );

  upsertClienteXX(prefijo, cliente, data.telefono || '');

  return { success: true, idFiado: idFiado };
}

// Endpoint: ?action=abonarFiado&prefijo=XX&data={token,idFiado,abono,metodoPago,idOperacion}
function abonarFiadoXX(prefijo, data) {
  var errAcceso = _validarAccesoFiados_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
  if (!data.idFiado) return { error: 'Falta ID del fiado' };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);
  if (!hoja) return { error: 'No existe hoja FIADOS_' + prefijo };

  var rows  = hoja.getDataRange().getValues();
  var idOp  = String(data.idOperacion || '').trim();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(data.idFiado)) continue;
    var obsPrevia = String(rows[i][13] || '');

    // Idempotencia — mismo patrón que Seba21: si idOperacion ya está en
    // las observaciones de este fiado, el abono ya se aplicó antes.
    if (idOp && obsPrevia.indexOf(idOp) !== -1) {
      return { success: true, yaExistia: true, nuevoTotal: parseFloat(rows[i][8]) || 0 };
    }

    var totalActual = parseFloat(rows[i][8]) || 0;
    var abono = parseFloat(data.abono) || 0;
    if (abono <= 0) return { error: 'Monto inválido' };

    var nuevoTotal = Math.max(0, totalActual - abono);
    hoja.getRange(i + 1, 9).setValue(nuevoTotal);

    var tz = Session.getScriptTimeZone();
    var fecha = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy');
    var nuevaObs = (obsPrevia ? obsPrevia + ' | ' : '') +
      'Abono $' + abono + ' (' + (data.metodoPago || 'EFECTIVO') + ') ' + fecha +
      (idOp ? ' [' + idOp + ']' : '');
    hoja.getRange(i + 1, 14).setValue(nuevaObs);

    if (nuevoTotal === 0) {
      hoja.getRange(i + 1, 11).setValue('PAGADO');
      hoja.getRange(i + 1, 12).setValue(fecha);
      hoja.getRange(i + 1, 13).setValue(data.metodoPago || 'EFECTIVO');
    }

    // Link con caja (Paso 6): un abono es plata real que entra al
    // negocio — mismo criterio que _registrarIngresoFiadoCaja_ de Seba21.
    _registrarIngresoFiadoCajaXX_(prefijo, abono, data.metodoPago, rows[i][3], 'Abono fiado ' + data.idFiado);

    return { success: true, nuevoTotal: nuevoTotal };
  }
  return { error: 'Fiado no encontrado' };
}

// Endpoint: ?action=cobrarFiado&prefijo=XX&data={token,idFiado,metodoPago,
//   esAbonoParcial,obs,idOperacion} — salda un fiado completo (o deja nota
//   si esAbonoParcial=true, igual que Seba21).
function cobrarFiadoXX(prefijo, data) {
  var errAcceso = _validarAccesoFiados_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
  if (!data.idFiado) return { error: 'Falta ID del fiado' };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('FIADOS_' + prefijo);
  if (!hoja) return { error: 'No existe hoja FIADOS_' + prefijo };

  var rows = hoja.getDataRange().getValues();
  var idOp = String(data.idOperacion || '').trim();
  var tz   = Session.getScriptTimeZone();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(data.idFiado)) continue;

    var obsExistente = String(rows[i][13] || '');
    if (idOp && obsExistente.indexOf(idOp) !== -1) return { success: true, yaExistia: true };

    var fechaPago = data.fechaPago || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');

    if (data.esAbonoParcial) {
      var nuevaObsP = obsExistente ? obsExistente + ' | ' + (data.obs || '') : (data.obs || '');
      hoja.getRange(i + 1, 14).setValue(nuevaObsP);
    } else {
      var saldoCobrado = parseFloat(rows[i][8]) || 0;
      hoja.getRange(i + 1, 9).setValue(0); // saldo = 0
      hoja.getRange(i + 1, 11).setValue('PAGADO');
      hoja.getRange(i + 1, 12).setValue(fechaPago);
      hoja.getRange(i + 1, 13).setValue(data.metodoPago || 'EFECTIVO');
      var notaObs = (data.obs || '') + (idOp ? ' [' + idOp + ']' : '');
      if (notaObs.trim()) hoja.getRange(i + 1, 14).setValue(obsExistente ? obsExistente + ' | ' + notaObs : notaObs);

      // Link con caja (Paso 6): cobro total = plata real que entra al
      // negocio — mismo criterio que _registrarIngresoFiadoCaja_ de Seba21.
      _registrarIngresoFiadoCajaXX_(prefijo, saldoCobrado, data.metodoPago, rows[i][3], 'Cobro fiado ' + data.idFiado);
    }
    return { success: true };
  }
  return { error: 'Fiado no encontrado: ' + data.idFiado };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea FIADOS_XX para clientes que ya existían antes de este paso
// (hoy: XX y LP). No borra nada si ya existe.
function backfillFiadosXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaFiadosXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('FIADOS_XX revisada/creada para: ' + creadas.join(', '));
}

// ===============================
// MÓDULO HISTORIAL_XX — todo lo que ingresa al local, por cliente
// Adaptado de la hoja "Historial" de Seba21 (11 columnas) — misma
// función: registrar cada ingreso de mercadería para poder auditarlo,
// deshacerlo y (más adelante, motor de inventario) calcular rotación.
//
// SEBA21: 11 columnas, incluye FechaVencimiento (col I).
// VAO MULTIHOJA: 10 columnas, sin FechaVencimiento.
// MOTIVO: INVENTARIO_XX no tiene columna de fecha de vencimiento —no hay
//   ese dato para trasladar—, se omite en vez de dejarla siempre vacía.
//
// Columnas HISTORIAL_<prefijo> (A–J):
//  A=Fecha B=Producto C=Cantidad D=StockResultante E=Codigo F=Proveedor
//  G=PrecioCosto H=PrecioVenta I=IdOperacion J=StockAnterior

function crearHojaHistorialXX(ss, prefijo) {
  var nombreHoja = 'HISTORIAL_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return; // ya existe, no se toca
  var hoja = ss.insertSheet(nombreHoja);
  var headers = ['Fecha','Producto','Cantidad','StockResultante','Codigo',
    'Proveedor','PrecioCosto','PrecioVenta','IdOperacion','StockAnterior'];
  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#37474f').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
}

// Devuelve la hoja HISTORIAL_<prefijo>, creándola sola si un cliente
// viejo (de antes de este paso) todavía no la tiene — igual criterio
// que getHojaFiados/getClientesXX para no romper clientes existentes.
function getHojaHistorial(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('HISTORIAL_' + prefijo);
  if (!hoja) { crearHojaHistorialXX(ss, prefijo); hoja = ss.getSheetByName('HISTORIAL_' + prefijo); }
  return hoja;
}

// Búsqueda simple por idOperacion (col I = índice 8). Alcanza para el
// volumen actual; si HISTORIAL_XX crece mucho se puede optimizar más
// adelante con TextFinder como hace Seba21 — no se hizo ahora para no
// sumar complejidad que este paso no pide.
function _buscarIdOperacionHistorial_(hoja, idOp) {
  if (!idOp) return { existe: false };
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][8] || '').trim() === idOp) {
      return { existe: true, fila: i + 1, fecha: datos[i][0], stockActual: datos[i][3] };
    }
  }
  return { existe: false };
}

// Endpoint: ?action=getHistorial&prefijo=XX&data={token,limite}
// Últimos ingresos, más reciente primero (por defecto 50, como
// getUltimosIngresos de Seba21).
function listarHistorialXX(prefijo, token, limite) {
  var errAcceso = _validarAccesoHistorial_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var hoja = getHojaHistorial(prefijo);
  var datos = hoja.getDataRange().getValues();
  var max = parseInt(limite) || 50;
  var ingresos = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[1]) continue; // sin producto = fila vacía
    ingresos.push({
      fecha:           fila[0] instanceof Date ? fila[0].toISOString() : String(fila[0] || ''),
      producto:        String(fila[1] || ''),
      cantidad:        fila[2] || 0,
      stockResultante: fila[3] || 0,
      codigo:          String(fila[4] || ''),
      proveedor:       String(fila[5] || ''),
      precioCosto:     fila[6] || '',
      precioVenta:     fila[7] || '',
      idOperacion:     String(fila[8] || ''),
      stockAnterior:   fila[9] || 0
    });
  }

  ingresos.reverse(); // más reciente primero
  var total = ingresos.length;
  return { total: total, ingresos: ingresos.slice(0, max) };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea HISTORIAL_XX para clientes que ya existían antes de este paso
// (hoy: XX y LP). No borra nada si ya existe.
function backfillHistorialXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaHistorialXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('HISTORIAL_XX revisada/creada para: ' + creadas.join(', '));
}

// ===============================
// MÓDULO PRESTAMOS_XX — plata que el NEGOCIO le debe a un tercero
// (acreedor), NO confundir con FIADOS_XX (que es al revés: lo que le
// deben AL negocio).
//
// SEBA21: no existe en el backend — vivía entero en localStorage del
//   navegador (clave 'copihue_prestamos'), como array de objetos
//   {id, fecha, acreedor, monto, motivo, cuotas, montoCuota,
//   vencimiento, obs, estado, pagos:[{fecha,monto}]}. Se estudió
//   directamente esa lógica de prestRegistrar()/prestPagarCuota()/
//   prestCancelar() en seba21v488_estable.html.
// VAO MULTIHOJA: mismos 11 campos, ahora en PRESTAMOS_XX (Sheets como
//   base de datos, ya no localStorage).
// MOTIVO: pagos era un array anidado en localStorage; una fila de
//   Sheets no admite un array real. Se traduce a un log de texto en la
//   columna Pagos ("fecha:monto;fecha:monto"), igual criterio que se
//   usó para las Observaciones/abonos de FIADOS_XX — no se inventa una
//   hoja aparte de pagos porque la especificación pide solo PRESTAMOS_XX.
//
// Columnas PRESTAMOS_<prefijo> (A–K), mismo orden que pidió Victor:
//  A=Id B=Fecha C=Acreedor D=Monto E=Motivo F=Cuotas G=MontoCuota
//  H=Vencimiento I=Observaciones J=Estado K=Pagos (log "fecha:monto;...")

function crearHojaPrestamosXX(ss, prefijo) {
  var nombreHoja = 'PRESTAMOS_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return;
  var hoja = ss.insertSheet(nombreHoja);
  var headers = ['Id','Fecha','Acreedor','Monto','Motivo','Cuotas','MontoCuota',
    'Vencimiento','Observaciones','Estado','Pagos'];
  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4527a0').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
}

function getHojaPrestamos(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('PRESTAMOS_' + prefijo);
  if (!hoja) { crearHojaPrestamosXX(ss, prefijo); hoja = ss.getSheetByName('PRESTAMOS_' + prefijo); }
  return hoja;
}

function _parsearPagosPrestamo_(log) {
  if (!log) return [];
  return String(log).split(';').filter(function(s){ return s; }).map(function(par) {
    var partes = par.split(':');
    return { fecha: partes[0], monto: parseFloat(partes[1]) || 0 };
  });
}

// Endpoint: ?action=getPrestamos&prefijo=XX&data={token}
// Mismo cálculo que prestRenderLista() de Seba21: saldo, % pagado,
// vencido/urgente según fecha, activo vs cancelado.
function listarPrestamosXX(prefijo, token) {
  var errAcceso = _validarAccesoPrestamos_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var hoja  = getHojaPrestamos(prefijo);
  var datos = hoja.getDataRange().getValues();
  var hoy   = new Date(); hoy.setHours(0,0,0,0);
  var prestamos = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;

    var monto      = parseFloat(fila[3]) || 0;
    var cuotas     = parseInt(fila[5]) || 1;
    var montoCuota = parseFloat(fila[6]) || 0;
    var vencStr    = fila[7] ? String(fila[7]) : '';
    var estado     = String(fila[9] || 'PENDIENTE').toUpperCase();
    var pagos      = _parsearPagosPrestamo_(fila[10]);
    var pagado     = pagos.reduce(function(s,p){ return s + p.monto; }, 0);
    var saldo      = Math.max(0, monto - pagado);
    var activo     = estado !== 'CANCELADO' && pagos.length < cuotas;

    var venc = vencStr ? new Date(vencStr) : null;
    var diasVenc = venc ? Math.round((venc - hoy) / 86400000) : null;

    prestamos.push({
      id:            String(fila[0]),
      fecha:         String(fila[1] || ''),
      acreedor:      String(fila[2] || ''),
      monto:         monto,
      motivo:        String(fila[4] || ''),
      cuotas:        cuotas,
      montoCuota:    montoCuota,
      vencimiento:   vencStr,
      observaciones: String(fila[8] || ''),
      estado:        activo ? estado : 'CANCELADO',
      cuotasPagadas: pagos.length,
      pagado:        Math.round(pagado * 100) / 100,
      saldo:         Math.round(saldo * 100) / 100,
      porcentaje:    monto > 0 ? Math.round(pagado / monto * 100) : 0,
      activo:        activo,
      vencido:       activo && diasVenc !== null && diasVenc < 0,
      urgente:       activo && diasVenc !== null && diasVenc >= 0 && diasVenc <= 7,
      diasVencimiento: diasVenc
    });
  }

  var totalDeuda = prestamos.filter(function(p){ return p.activo; })
    .reduce(function(s,p){ return s + p.saldo; }, 0);

  return { prestamos: prestamos, totalDeuda: Math.round(totalDeuda * 100) / 100 };
}

// Endpoint: ?action=registrarPrestamo&prefijo=XX&data={token,acreedor,
//   monto,motivo,cuotas,vencimiento,obs}
function registrarPrestamoXX(prefijo, data) {
  var errAcceso = _validarAccesoPrestamos_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var acreedor = (data.acreedor || '').trim();
  var monto    = parseFloat(data.monto) || 0;
  if (!acreedor) return { error: 'Ingresá el nombre del acreedor' };
  if (monto <= 0) return { error: 'Ingresá el monto' };

  var cuotas     = parseInt(data.cuotas) || 1;
  var montoCuota = Math.round(monto / cuotas);
  var hoja       = getHojaPrestamos(prefijo);
  var tz         = Session.getScriptTimeZone();
  var fechaStr   = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var idPrestamo = 'p_' + new Date().getTime();

  hoja.appendRow([
    idPrestamo, fechaStr, acreedor, monto, data.motivo || '',
    cuotas, montoCuota, data.vencimiento || '', data.obs || '',
    'PENDIENTE', ''
  ]);

  return { success: true, id: idPrestamo, montoCuota: montoCuota };
}

// Endpoint: ?action=pagarCuotaPrestamo&prefijo=XX&data={token,id}
// Mismo comportamiento que prestPagarCuota(): agrega un pago por el
// valor de la cuota, empuja el vencimiento +1 mes si quedan cuotas, y
// marca CANCELADO cuando se completan todas.
function pagarCuotaPrestamoXX(prefijo, data) {
  var errAcceso = _validarAccesoPrestamos_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
  if (!data.id) return { error: 'Falta ID del préstamo' };

  var hoja  = getHojaPrestamos(prefijo);
  var datos = hoja.getDataRange().getValues();

  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]) !== String(data.id)) continue;

    var cuotas     = parseInt(datos[i][5]) || 1;
    var montoCuota = parseFloat(datos[i][6]) || 0;
    var pagos      = _parsearPagosPrestamo_(datos[i][10]);
    if (pagos.length >= cuotas) return { error: 'Este préstamo ya está saldado' };

    var tz = Session.getScriptTimeZone();
    var fechaPago = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var logPrevio = String(datos[i][10] || '');
    var nuevoLog  = (logPrevio ? logPrevio + ';' : '') + fechaPago + ':' + montoCuota;
    hoja.getRange(i + 1, 11).setValue(nuevoLog);

    var cuotasPagadasAhora = pagos.length + 1;

    // Empujar vencimiento +1 mes si quedan cuotas (igual que Seba21)
    var vencStr = datos[i][7] ? String(datos[i][7]) : '';
    if (vencStr && cuotasPagadasAhora < cuotas) {
      var v = new Date(vencStr);
      v.setMonth(v.getMonth() + 1);
      hoja.getRange(i + 1, 8).setValue(Utilities.formatDate(v, tz, 'yyyy-MM-dd'));
    }

    if (cuotasPagadasAhora >= cuotas) {
      hoja.getRange(i + 1, 10).setValue('CANCELADO');
    }

    return {
      success: true,
      cuotasPagadas: cuotasPagadasAhora,
      cuotasTotal: cuotas,
      saldado: cuotasPagadasAhora >= cuotas
    };
  }
  return { error: 'Préstamo no encontrado' };
}

// Endpoint: ?action=cancelarPrestamo&prefijo=XX&data={token,id}
function cancelarPrestamoXX(prefijo, data) {
  var errAcceso = _validarAccesoPrestamos_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
  if (!data.id) return { error: 'Falta ID del préstamo' };

  var hoja  = getHojaPrestamos(prefijo);
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]) !== String(data.id)) continue;
    hoja.getRange(i + 1, 10).setValue('CANCELADO');
    return { success: true };
  }
  return { error: 'Préstamo no encontrado' };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea PRESTAMOS_XX para clientes que ya existían antes de este paso
// (hoy: XX y LP). No borra nada si ya existe.
function backfillPrestamosXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaPrestamosXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('PRESTAMOS_XX revisada/creada para: ' + creadas.join(', '));
}

// ===============================
// MÓDULO CAJA — plata que entra y sale del negocio, por cliente
//
// ESTUDIO DE REFERENCIA (Seba21/Copihue, antes de programar):
// - CAJA_MOVIMIENTOS SÍ existe en Seba21: 9 columnas (FECHA,HORA,TIPO,
//   MOTIVO,MONTO,MEDIO,CATEGORIA,OBSERVACION,VENDEDOR), función
//   registrarMovimientoCaja() y lectura getCajaEgresos()/otra similar.
//   Se traslada 1:1 a CAJA_MOVIMIENTOS_XX.
// - Una hoja "CAJA" (apertura/cierre/saldo) NO EXISTE en Seba21 — está
//   confirmado en su propio código: el comentario de getCajaDiaria()
//   dice textualmente "en vez de buscar una hoja 'Caja' que no existe",
//   y esa función calcula los totales del día leyendo las filas
//   "TOTAL TICKET" de la hoja Ventas de Seba21 (un concepto de ticket
//   agrupado que Seba21 sí tiene). VAO tampoco tiene hoy ninguna hoja
//   "CAJA" ni un concepto de ticket en VENTAS_XX.
// CONCLUSIÓN: no hay estructura de referencia en NINGÚN lado (ni Seba21
//   ni VAO) para lo que sería CAJA_XX como hoja de saldo/apertura/
//   cierre — inventar sus columnas violaría la regla de no inventar
//   contabilidad nueva. Por eso en este paso se construye y conecta
//   SOLO CAJA_MOVIMIENTOS_XX (que sí tiene referencia clara); CAJA_XX
//   queda marcada REQUIERE DECISIÓN (ver mensaje a Victor) y no se crea
//   todavía ninguna hoja con ese nombre.
//
// Columnas CAJA_MOVIMIENTOS_<prefijo> (A–I), idénticas a Seba21:
//  A=Fecha B=Hora C=Tipo(INGRESO/EGRESO) D=Motivo E=Monto F=Medio
//  G=Categoria H=Observacion I=Vendedor

function crearHojaCajaMovimientosXX(ss, prefijo) {
  var nombreHoja = 'CAJA_MOVIMIENTOS_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return;
  var hoja = ss.insertSheet(nombreHoja);
  var headers = ['Fecha','Hora','Tipo','Motivo','Monto','Medio','Categoria','Observacion','Vendedor'];
  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#37474f').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
}

function getHojaCajaMovimientos(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CAJA_MOVIMIENTOS_' + prefijo);
  if (!hoja) { crearHojaCajaMovimientosXX(ss, prefijo); hoja = ss.getSheetByName('CAJA_MOVIMIENTOS_' + prefijo); }
  return hoja;
}

// Endpoint: ?action=registrarMovimientoCaja&prefijo=XX&data={token,tipo,
//   motivo,monto,medio,categoria,observacion,vendedor}
function registrarMovimientoCajaXX(prefijo, data) {
  var errAcceso = _validarAccesoCaja_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var monto = parseFloat(data.monto) || 0;
  if (monto <= 0) return { error: 'Monto inválido' };

  var tz = Session.getScriptTimeZone();
  var ahora = new Date();
  var hoja = getHojaCajaMovimientos(prefijo);
  hoja.appendRow([
    Utilities.formatDate(ahora, tz, 'yyyy-MM-dd'),
    Utilities.formatDate(ahora, tz, 'HH:mm'),
    (data.tipo || 'EGRESO').toUpperCase(),
    data.motivo || '',
    monto,
    (data.medio || 'EFECTIVO').toUpperCase(),
    data.categoria || '',
    data.observacion || '',
    data.vendedor || ''
  ]);
  return { success: true };
}

// Igual criterio que _registrarIngresoFiadoCaja_ de Seba21, pero interno
// (no es un endpoint — lo llaman cobrarFiadoXX/abonarFiadoXX de este
// mismo archivo cuando entra plata real de un fiado).
function _registrarIngresoFiadoCajaXX_(prefijo, monto, medio, cliente, obs) {
  try {
    if (!monto || monto <= 0) return;
    var tz = Session.getScriptTimeZone();
    var ahora = new Date();
    var hoja = getHojaCajaMovimientos(prefijo);
    hoja.appendRow([
      Utilities.formatDate(ahora, tz, 'yyyy-MM-dd'),
      Utilities.formatDate(ahora, tz, 'HH:mm'),
      'INGRESO',
      'COBRO FIADO — ' + (cliente || '').toUpperCase(),
      monto,
      (medio || 'EFECTIVO').toUpperCase(),
      'FIADOS',
      obs || '',
      ''
    ]);
  } catch (e) {
    Logger.log('_registrarIngresoFiadoCajaXX_ error (no crítico): ' + e.message);
  }
}

// Endpoint: ?action=getMovimientosCaja&prefijo=XX&data={token,tipo,limite}
function listarMovimientosCajaXX(prefijo, token, opts) {
  var errAcceso = _validarAccesoCaja_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  opts = opts || {};
  var filtroTipo = opts.tipo ? String(opts.tipo).toUpperCase() : null;
  var limite = parseInt(opts.limite) || 100;

  var hoja  = getHojaCajaMovimientos(prefijo);
  var datos = hoja.getDataRange().getValues();
  var movimientos = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;
    var tipo = String(fila[2] || '').toUpperCase();
    if (filtroTipo && tipo !== filtroTipo) continue;
    movimientos.push({
      fecha:        String(fila[0] || ''),
      hora:         String(fila[1] || ''),
      tipo:         tipo,
      motivo:       String(fila[3] || ''),
      monto:        parseFloat(fila[4]) || 0,
      medio:        String(fila[5] || ''),
      categoria:    String(fila[6] || ''),
      observacion:  String(fila[7] || ''),
      vendedor:     String(fila[8] || '')
    });
  }

  movimientos.sort(function(a, b) { return (b.fecha + ' ' + b.hora).localeCompare(a.fecha + ' ' + a.hora); });
  var totalIngresos = movimientos.filter(function(m){ return m.tipo === 'INGRESO'; }).reduce(function(s,m){ return s+m.monto; }, 0);
  var totalEgresos  = movimientos.filter(function(m){ return m.tipo === 'EGRESO';  }).reduce(function(s,m){ return s+m.monto; }, 0);

  return {
    movimientos:    movimientos.slice(0, limite),
    total:          movimientos.length,
    totalIngresos:  Math.round(totalIngresos * 100) / 100,
    totalEgresos:   Math.round(totalEgresos * 100) / 100,
    saldoNeto:      Math.round((totalIngresos - totalEgresos) * 100) / 100
  };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea CAJA_MOVIMIENTOS_XX para clientes que ya existían antes de este
// paso (hoy: XX y LP). No borra nada si ya existe.
function backfillCajaMovimientosXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaCajaMovimientosXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('CAJA_MOVIMIENTOS_XX revisada/creada para: ' + creadas.join(', '));
}

// ===============================
// MÓDULO SALIDAS_XX — merma, consumo interno y otras bajas de stock
// que NO son una venta.
//
// SEBA21: hoja "SALIDAS" (10 columnas: Fecha,Hora,Producto,ID,Cantidad,
//   Costo Unit.,Precio Venta,Motivo,Observación,Vendedor), función
//   registrarSalidaInterna() (descuenta stock de Inventario por el
//   mismo índice de fila "id" que usa la venta, bloquea si no alcanza
//   el stock) y getSalidasInternas() (lectura). El motivo es un valor
//   cerrado que define el propio frontend de Seba21: CONSUMO, MERMA,
//   VENCIDO, REGALO, ROTURA, USO_INTERNO — se reutilizan esos 6 exactos,
//   no se inventan otros.
// VAO MULTIHOJA: mismo esquema y misma lógica sobre SALIDAS_XX,
//   usando el mismo "id" = número de fila de INVENTARIO_XX que ya usa
//   registrarVenta() (getProductos ya devuelve ese id).
// MOTIVO para NO agregar una columna de IdOperacion (a diferencia de
//   FIADOS/HISTORIAL/CAJA): Seba21 tampoco la tiene en SALIDAS, y la
//   regla de este paso es no agregar columnas que "parecen útiles" si
//   no están en la referencia — se deja igual que Seba21.
//
// Columnas SALIDAS_<prefijo> (A–J), idénticas a Seba21:
//  A=Fecha B=Hora C=Producto D=ID E=Cantidad F=CostoUnit G=PrecioVenta
//  H=Motivo I=Observacion J=Vendedor

var MOTIVOS_SALIDA_VALIDOS = ['CONSUMO','MERMA','VENCIDO','REGALO','ROTURA','USO_INTERNO'];

function crearHojaSalidasXX(ss, prefijo) {
  var nombreHoja = 'SALIDAS_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return;
  var hoja = ss.insertSheet(nombreHoja);
  var headers = ['Fecha','Hora','Producto','ID','Cantidad','CostoUnit','PrecioVenta','Motivo','Observacion','Vendedor'];
  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#37474f').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
}

function getHojaSalidas(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('SALIDAS_' + prefijo);
  if (!hoja) { crearHojaSalidasXX(ss, prefijo); hoja = ss.getSheetByName('SALIDAS_' + prefijo); }
  return hoja;
}

// Endpoint: ?action=registrarSalida&prefijo=XX&data={token,id,cantidad,
//   motivo,obs,vendedor} — id = número de fila de INVENTARIO_XX (el
//   mismo "id" que devuelve getProductos y que ya usa registrarVenta).
function registrarSalidaXX(prefijo, data) {
  var errAcceso = _validarAccesoSalidas_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var motivo = String(data.motivo || '').toUpperCase().trim();
  if (MOTIVOS_SALIDA_VALIDOS.indexOf(motivo) === -1) {
    return { error: 'Motivo no válido. Debe ser uno de: ' + MOTIVOS_SALIDA_VALIDOS.join(', ') };
  }

  var inv     = getHojaInv(prefijo);
  var datosInv = inv.getDataRange().getValues();
  var filaIdx = parseInt(data.id);
  if (!filaIdx || filaIdx < 2 || filaIdx > datosInv.length) return { error: 'Producto no encontrado' };

  var stockActual = parseInt(datosInv[filaIdx - 1][2]) || 0;
  var cantidad    = parseFloat(data.cantidad) || 0;
  if (cantidad <= 0) return { error: 'Cantidad inválida' };
  if (cantidad > stockActual) return { error: 'Stock insuficiente (hay ' + stockActual + ')' };

  var nombre = String(datosInv[filaIdx - 1][1] || '').trim().toUpperCase();
  var costo  = parseFloat(datosInv[filaIdx - 1][3]) || 0;
  var precio = parseFloat(datosInv[filaIdx - 1][4]) || 0;
  var nuevoStock = Math.max(0, stockActual - cantidad);
  inv.getRange(filaIdx, 3).setValue(nuevoStock);

  var tz    = Session.getScriptTimeZone();
  var ahora = new Date();
  var hoja  = getHojaSalidas(prefijo);
  hoja.appendRow([
    Utilities.formatDate(ahora, tz, 'yyyy-MM-dd'),
    Utilities.formatDate(ahora, tz, 'HH:mm'),
    nombre, 'ID' + filaIdx, cantidad, costo, precio,
    motivo, data.obs || '', data.vendedor || ''
  ]);

  return { success: true, nuevoStock: nuevoStock };
}

// Endpoint: ?action=getSalidas&prefijo=XX&data={token,motivo,fecha,limite}
function listarSalidasXX(prefijo, token, opts) {
  var errAcceso = _validarAccesoSalidas_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  opts = opts || {};
  var filtroMotivo = opts.motivo ? String(opts.motivo).toUpperCase() : null;
  var filtroFecha  = opts.fecha  ? String(opts.fecha) : null;
  var limite = parseInt(opts.limite) || 100;

  var hoja  = getHojaSalidas(prefijo);
  var datos = hoja.getDataRange().getValues();
  var registros = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;
    var fecha = String(fila[0] || '');
    if (filtroFecha && fecha !== filtroFecha) continue;
    var motivo = String(fila[7] || '').toUpperCase();
    if (filtroMotivo && motivo !== filtroMotivo) continue;

    registros.push({
      fecha:       fecha,
      hora:        String(fila[1] || ''),
      producto:    String(fila[2] || ''),
      idProducto:  String(fila[3] || ''),
      cantidad:    parseFloat(fila[4]) || 0,
      costoUnit:   parseFloat(fila[5]) || 0,
      precioVenta: parseFloat(fila[6]) || 0,
      motivo:      motivo,
      observacion: String(fila[8] || ''),
      vendedor:    String(fila[9] || '')
    });
  }

  registros.sort(function(a, b) { return (b.fecha + ' ' + b.hora).localeCompare(a.fecha + ' ' + a.hora); });
  var totalUnidades = registros.reduce(function(s, r) { return s + r.cantidad; }, 0);
  var totalCostoPerdido = registros.reduce(function(s, r) { return s + (r.cantidad * r.costoUnit); }, 0);

  return {
    registros: registros.slice(0, limite),
    total: registros.length,
    totalUnidades: totalUnidades,
    totalCostoPerdido: Math.round(totalCostoPerdido * 100) / 100
  };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea SALIDAS_XX para clientes que ya existían antes de este paso
// (hoy: XX y LP). No borra nada si ya existe.
function backfillSalidasXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaSalidasXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('SALIDAS_XX revisada/creada para: ' + creadas.join(', '));
}

// ===============================
// MÓDULO AJUSTE_RAPIDO_XX — corrección manual de un producto (stock,
// precio, nombre o categoría) desde el POS, con auditoría de qué
// cambió y qué había antes. NO es lo mismo que SALIDAS_XX: una salida
// es una baja de stock con un motivo de negocio (merma, consumo...);
// un ajuste rápido es corregir un dato del producto que estaba mal
// cargado (ej. "el stock real es 8, no 5" o "el precio subió a $900").
//
// SEBA21: función ajustarProducto() — hoja "Ajuste_Rapido" (11
//   columnas: FECHA,PRODUCTO,NOMBRE ANTES,NOMBRE DESPUÉS,STOCK ANTES,
//   STOCK DESPUÉS,PRECIO ANTES,PRECIO DESPUÉS,CATEGORÍA ANTES,
//   CATEGORÍA DESPUÉS,USUARIO). Busca el producto por nombre en
//   Inventario, actualiza solo los campos que vienen en la petición
//   (si no vienen, no cambia ese campo) y deja un registro con el
//   antes/después de cada uno.
// VAO MULTIHOJA: misma hoja (11 columnas) y misma lógica sobre
//   AJUSTE_RAPIDO_XX e INVENTARIO_XX (adaptando los índices de columna
//   al layout real de INVENTARIO_XX: Código,Producto,Stock,Costo,
//   Venta,Proveedor,Categoría).
//
// LO QUE SE OMITE A PROPÓSITO (documentado, no inventado):
// - ajustarProducto() de Seba21 también llama a
//   _ajustarMulticompraProducto_() (editor de Multicompra). Victor
//   indicó explícitamente que el código de Multicompra no se pasa
//   porque se va a sacar del sistema — se omite por completo, no se
//   reconstruye ni se inventa un equivalente.
// - Seba21 NO tiene ninguna función de LECTURA de "Ajuste_Rapido" — es
//   una hoja de auditoría de solo escritura, nunca se vuelve a leer
//   desde el código. Por eso este paso NO agrega un endpoint de
//   lectura (getAjustes): no hay referencia de qué forma debería tener
//   ni para qué se usaría. Si en el futuro hace falta mostrarlo en el
//   HTML, es una REQUIERE DECISIÓN aparte (qué filtros, qué formato).
//
// Columnas AJUSTE_RAPIDO_<prefijo> (A–K), idénticas a Seba21:
//  A=Fecha B=Producto C=NombreAntes D=NombreDespues E=StockAntes
//  F=StockDespues G=PrecioAntes H=PrecioDespues I=CategoriaAntes
//  J=CategoriaDespues K=Usuario

function crearHojaAjusteRapidoXX(ss, prefijo) {
  var nombreHoja = 'AJUSTE_RAPIDO_' + prefijo;
  if (ss.getSheetByName(nombreHoja)) return;
  var hoja = ss.insertSheet(nombreHoja);
  var headers = ['Fecha','Producto','NombreAntes','NombreDespues','StockAntes',
    'StockDespues','PrecioAntes','PrecioDespues','CategoriaAntes','CategoriaDespues','Usuario'];
  hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  hoja.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#37474f').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
}

function getHojaAjusteRapido(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('AJUSTE_RAPIDO_' + prefijo);
  if (!hoja) { crearHojaAjusteRapidoXX(ss, prefijo); hoja = ss.getSheetByName('AJUSTE_RAPIDO_' + prefijo); }
  return hoja;
}

// Endpoint: ?action=ajusteRapido&prefijo=XX&data={token,producto,
//   stockDespues,precioDespues,nombreNuevo,categoriaDespues,usuario}
// Solo cambia los campos que vienen en data — igual que Seba21.
function _registrarAuditoriaAjusteXX_(prefijo, datos) {
  var hojaAjuste = getHojaAjusteRapido(prefijo);
  hojaAjuste.appendRow([
    new Date(), datos.producto,
    datos.nombreAntes, datos.nombreDespues !== datos.nombreAntes ? datos.nombreDespues : '',
    datos.stockAntes,  datos.stockDespues,
    datos.precioAntes, datos.precioDespues !== datos.precioAntes ? datos.precioDespues : '',
    datos.catAntes,    datos.catDespues    !== datos.catAntes    ? datos.catDespues    : '',
    datos.usuario || 'POS'
  ]);
}

function ajustarProductoXX(prefijo, data) {
  var errAcceso = _validarAccesoAjuste_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };

  var producto = String(data.producto || '').trim();
  if (!producto) return { error: 'Nombre de producto vacío' };

  var inv = getHojaInv(prefijo);
  var datosInv = inv.getDataRange().getValues();
  var productoNorm = producto.toUpperCase().replace(/\s+/g, ' ');
  var filaProducto = -1, nombreActual = '', stockActual = 0, precioActual = 0, catActual = '';

  for (var i = 1; i < datosInv.length; i++) {
    if (!datosInv[i][1]) continue;
    var nombreEnSheet = String(datosInv[i][1]).trim().toUpperCase().replace(/\s+/g, ' ');
    if (nombreEnSheet === productoNorm) {
      filaProducto = i + 1;
      nombreActual = String(datosInv[i][1]).trim();
      stockActual  = Number(datosInv[i][2]) || 0;
      precioActual = Number(datosInv[i][4]) || 0;
      catActual    = String(datosInv[i][6] || '').trim();
      break;
    }
  }
  if (filaProducto === -1) return { error: 'Producto no encontrado: ' + producto };

  var stockNuevo  = (data.stockDespues !== undefined && data.stockDespues !== null && data.stockDespues !== '') ? Number(data.stockDespues)  : stockActual;
  var precioNuevo = (data.precioDespues !== undefined && data.precioDespues !== null && data.precioDespues !== '') ? Number(data.precioDespues) : precioActual;
  var nombreNuevo = data.nombreNuevo ? String(data.nombreNuevo).trim().toUpperCase() : nombreActual;
  var catNueva    = data.categoriaDespues ? String(data.categoriaDespues).trim().toUpperCase() : catActual;

  inv.getRange(filaProducto, 3).setValue(stockNuevo); // Stock
  if (precioNuevo !== precioActual) inv.getRange(filaProducto, 5).setValue(precioNuevo); // Venta
  if (nombreNuevo !== nombreActual) inv.getRange(filaProducto, 2).setValue(nombreNuevo); // Producto
  if (catNueva    !== catActual)    inv.getRange(filaProducto, 7).setValue(catNueva);    // Categoria

  _registrarAuditoriaAjusteXX_(prefijo, {
    producto:     producto,
    nombreAntes:  nombreActual, nombreDespues: nombreNuevo,
    stockAntes:   stockActual,  stockDespues:  stockNuevo,
    precioAntes:  precioActual, precioDespues: precioNuevo,
    catAntes:     catActual,    catDespues:    catNueva,
    usuario:      data.usuario
  });

  var cambios = [];
  if (stockNuevo  !== stockActual)  cambios.push('Stock: '  + stockActual  + ' → ' + stockNuevo);
  if (precioNuevo !== precioActual) cambios.push('Precio: $' + precioActual + ' → $' + precioNuevo);
  if (nombreNuevo !== nombreActual) cambios.push('Nombre: ' + nombreActual + ' → ' + nombreNuevo);
  if (catNueva    !== catActual)    cambios.push('Categoría: ' + catActual + ' → ' + catNueva);

  return { success: true, mensaje: cambios.length ? cambios.join(' | ') : 'Sin cambios', stockNuevo: stockNuevo };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea AJUSTE_RAPIDO_XX para clientes que ya existían antes de este
// paso (hoy: XX y LP). No borra nada si ya existe.
function backfillAjusteRapidoXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaAjusteRapidoXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('AJUSTE_RAPIDO_XX revisada/creada para: ' + creadas.join(', '));
}

// ===============================
// MÓDULO DE OFERTAS — sobre INVENTARIO_XX
//
// MAPEO REALIZADO ANTES DE PROGRAMAR (paso 9):
// 1) Lógica actual de VAO: ninguna todavía — CONFIG_XX solo tiene el
//    flag extra_config_ofertas (on/off) y los 3 campos de RECIEN_LLEGADOS,
//    sin motor implementado detrás.
// 2) Referencia funcional #1 — la planilla "Patagonia" que Victor dio
//    directamente como spec de columnas/fórmulas (RELAMPAGO, DESTACADA,
//    ESPECIAL, PRECIO_PROMO, fórmula de badge y de unitario, 27 pasos
//    de evaluación con prioridad estricta).
// 3) Referencia funcional #2 — calcularOfertas() de Seba21: confirma que
//    su columna J de Inventario usa exactamente el mismo sistema de
//    badges ("2X1","3X2","REPONER X PARA OFERTA", etc.) que la planilla
//    Patagonia — son el mismo motor. calcularOfertas() le agrega ARRIBA
//    una capa de selección/rotación/límites por día y horario (leída de
//    una hoja config_sistema con columnas por día de semana) y una
//    exclusión especial para "Jueves Cervecero".
//
// QUÉ SE CONSTRUYE EN ESTE PASO (con referencia clara, sin inventar):
// - RELAMPAGO (códigos 0-14, mismos mínimos de stock), DESTACADA
//   (10%-70%, nunca vende bajo costo), ESPECIAL (10% fijo) y la regla
//   de ERROR DOBLE OFERTA — igual que la planilla Patagonia/Seba21,
//   ahora calculado en GAS sobre INVENTARIO_XX en vez de con fórmulas
//   de Sheets (adaptación: INVENTARIO_XX lo edita la app, no una
//   persona a mano, así que el cálculo vive en el backend).
// - RECIÉN LLEGADOS: usa los 3 campos que YA EXISTEN en CONFIG_XX
//   (RECIEN_LLEGADOS_PRECIO_MIN/_LIMITE/_DIAS) cruzados con la fecha de
//   primer ingreso de cada producto en HISTORIAL_XX (paso 4) — no hace
//   falta ninguna estructura nueva.
//
// QUÉ SE DEJA EXPLÍCITAMENTE FUERA (documentado, no inventado):
// - PROMOS / COMBOS (por categoría "PROMOS"/"COMBOS" en la planilla
//   Patagonia): en VAO la columna Categoría de INVENTARIO_XX ya se usa
//   para la categoría real del producto (bebidas, comidas, etc.) —
//   reutilizarla como flag de tipo de oferta pisaría ese uso. REQUIERE
//   DECISIÓN: dónde guardar ese flag sin romper Categoría.
// - MULTICOMPRA: Victor indicó explícitamente que no pasa ese código
//   ("se van a sacar igual del sistema") — no hay ninguna referencia
//   para estudiar, así que no se puede migrar ni adaptar. Sigue fuera.
// - JUEVES CERVECERO y el resto de calcularOfertas() (límites por tipo,
//   horarios por día de semana, rotación diaria de relámpago): dependen
//   de una hoja de configuración con estructura por día de semana que
//   VAO no tiene — CONFIG_XX está fijada en 52 campos y agregar los que
//   harían falta (máximos, horarios, día cervecero) excede esa lista.
//   REQUIERE DECISIÓN de Victor antes de tocar CONFIG_XX.
// - ÚLTIMAS UNIDADES: en Seba21 es selección MANUAL de productos
//   (ids guardados en una clave de config_sistema), no un cálculo
//   automático por stock bajo. Guardar esa selección en VAO también
//   excedería los 52 campos de CONFIG_XX. REQUIERE DECISIÓN.
// - "Personalizadas con porcentajes": funcionalmente es lo mismo que
//   DESTACADA (% arbitrario entre 10 y 70) — no se construyó como tipo
//   aparte porque sería duplicar la misma lógica con otro nombre.
//
// Columnas usadas en INVENTARIO_<prefijo> (H–K, antes "Reservada"):
//  H=Relampago(0-14) I=Destacada(%) J=Especial(0/1) K=PrecioPromo

var CODIGOS_RELAMPAGO_VALIDOS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];

// Calcula el badge y el precio unitario de UNA fila de INVENTARIO_XX,
// siguiendo el mismo orden de prioridad que la planilla Patagonia.
function _calcularOfertaFila_(fila) {
  var nombre    = String(fila[1] || '').trim();
  var stock     = parseInt(fila[2]) || 0;
  var costo     = parseFloat(fila[3]) || 0;
  var venta     = parseFloat(fila[4]) || 0;
  var relampago = fila[7] === '' || fila[7] === undefined ? 0 : parseInt(fila[7]);
  var destacada = fila[8] === '' || fila[8] === undefined ? 0 : parseFloat(fila[8]);
  var especial  = fila[9] === '' || fila[9] === undefined ? 0 : parseInt(fila[9]);
  var precioPromo = parseFloat(fila[10]) || 0;

  if (!nombre) return { badge: '', unitario: '' };
  if (isNaN(relampago)) relampago = 0;
  if (isNaN(especial))  especial  = 0;
  if (stock <= 0) return { badge: 'sin stock', unitario: '' };

  if (especial !== 0 && especial !== 1) return { badge: 'ERROR ESPECIAL', unitario: '' };
  if (CODIGOS_RELAMPAGO_VALIDOS.indexOf(relampago) === -1) return { badge: 'CODIGO RELAMPAGO NO VALIDO', unitario: '' };

  var activos = (especial === 1 ? 1 : 0) + (destacada > 0 ? 1 : 0) + (relampago > 0 ? 1 : 0);
  if (activos > 1) return { badge: 'ERROR DOBLE OFERTA', unitario: '' };

  if (destacada > 0 && destacada < 10) return { badge: 'ERROR DESTACADA MINIMO 10%', unitario: '' };
  if (destacada > 0 && destacada > 70) return { badge: 'ERROR DESTACADA MAXIMO 70%', unitario: '' };
  if (destacada > 0 && costo > 0 && venta * (1 - destacada / 100) <= costo) return { badge: 'ERROR DESTACADA BAJO COSTO', unitario: '' };

  if (relampago >= 1 && relampago <= 9 && stock < relampago + 1) {
    return { badge: 'REPONER ' + ((relampago + 1) - stock) + ' PARA OFERTA', unitario: '' };
  }
  if (relampago === 10 && stock < 2) {
    return { badge: 'REPONER ' + (2 - stock) + ' PARA OFERTA', unitario: '' };
  }

  if (especial === 1)  return { badge: 'especial',  unitario: Math.round(venta * 0.9 * 100) / 100 };
  if (destacada > 0)   return { badge: 'destacada', unitario: Math.round(venta * (1 - destacada / 100) * 100) / 100 };

  if (relampago >= 1 && relampago <= 9) {
    var unitarioNxM = precioPromo > 0 ? Math.round((precioPromo / (relampago + 1)) * 100) / 100 : '';
    return { badge: (relampago + 1) + 'x' + relampago, unitario: unitarioNxM };
  }
  if (relampago === 10) return { badge: '2da50', unitario: Math.round(((venta + venta * 0.5) / 2) * 100) / 100 };
  if (relampago === 11) return { badge: '10%', unitario: Math.round(venta * 0.9  * 100) / 100 };
  if (relampago === 12) return { badge: '15%', unitario: Math.round(venta * 0.85 * 100) / 100 };
  if (relampago === 13) return { badge: '20%', unitario: Math.round(venta * 0.8  * 100) / 100 };
  if (relampago === 14) return { badge: '25%', unitario: Math.round(venta * 0.75 * 100) / 100 };

  return { badge: 'sin oferta', unitario: venta };
}

var BADGES_SIN_OFERTA_ACTIVA = ['', 'sin stock', 'sin oferta'];

// Endpoint: ?action=getOfertas&prefijo=XX&data={token}
// Devuelve, por separado, las ofertas activas y los productos con
// errores de configuración (para que el POS pueda avisar), sin tocar
// PROMOS/COMBOS/MULTICOMPRA/JUEVES CERVECERO (fuera de este paso).
function getOfertasXX(prefijo, token) {
  var errAcceso = _validarAccesoOfertas_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var inv = getHojaInv(prefijo);
  var datos = inv.getDataRange().getValues();
  var activas = [], errores = [], reponer = [];

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[1]) continue;
    var resultado = _calcularOfertaFila_(fila);
    var item = {
      fila: i + 1,
      codigo: String(fila[0] || ''),
      producto: String(fila[1]).trim(),
      stock: parseInt(fila[2]) || 0,
      precio: parseFloat(fila[4]) || 0,
      badge: resultado.badge,
      unitario: resultado.unitario
    };
    if (resultado.badge.indexOf('ERROR') === 0) errores.push(item);
    else if (resultado.badge.indexOf('REPONER') === 0) reponer.push(item);
    else if (BADGES_SIN_OFERTA_ACTIVA.indexOf(resultado.badge) === -1) activas.push(item);
  }

  return { activas: activas, errores: errores, reponer: reponer };
}

// Endpoint: ?action=getRecienLlegados&prefijo=XX&data={token}
// Usa RECIEN_LLEGADOS_PRECIO_MIN/_LIMITE/_DIAS (ya existentes en
// CONFIG_XX) cruzados con la primera fecha de ingreso de cada producto
// en HISTORIAL_XX (StockAnterior=0 = fue un alta, no una reposición).
function getRecienLlegadosXX(prefijo, token) {
  var errAcceso = _validarAccesoOfertas_(prefijo, token);
  if (errAcceso) return { error: errAcceso };

  var cfg = leerConfig(prefijo).config;
  var precioMin = parseFloat(cfg.RECIEN_LLEGADOS_PRECIO_MIN) || 0;
  var limite    = parseInt(cfg.RECIEN_LLEGADOS_LIMITE) || 10;
  var dias      = parseInt(cfg.RECIEN_LLEGADOS_DIAS) || 7;

  var hist = getHojaHistorial(prefijo);
  var histDatos = hist.getDataRange().getValues();
  var primerIngreso = {}; // producto -> fecha más antigua con StockAnterior=0

  for (var i = 1; i < histDatos.length; i++) {
    var fh = histDatos[i];
    if (!fh[1]) continue;
    if ((parseInt(fh[9]) || 0) !== 0) continue; // solo altas, no reposiciones
    var nombreH = String(fh[1]).trim().toUpperCase();
    var fechaH  = fh[0] instanceof Date ? fh[0] : new Date(fh[0]);
    if (isNaN(fechaH.getTime())) continue;
    if (!primerIngreso[nombreH] || fechaH < primerIngreso[nombreH]) primerIngreso[nombreH] = fechaH;
  }

  var inv = getHojaInv(prefijo);
  var invDatos = inv.getDataRange().getValues();
  var hoy = new Date();
  var recientes = [];

  for (var j = 1; j < invDatos.length; j++) {
    var filaP = invDatos[j];
    var nombreP = String(filaP[1] || '').trim();
    if (!nombreP) continue;
    var precio = parseFloat(filaP[4]) || 0;
    if (precio < precioMin) continue;

    var fechaAlta = primerIngreso[nombreP.toUpperCase()];
    if (!fechaAlta) continue; // sin historial de alta (cargado antes del paso 4, o vía import manual)
    var diasDesde = Math.floor((hoy - fechaAlta) / 86400000);
    if (diasDesde > dias) continue;

    recientes.push({
      producto: nombreP,
      precio: precio,
      stock: parseInt(filaP[2]) || 0,
      diasDesdeAlta: diasDesde
    });
  }

  recientes.sort(function(a, b) { return a.diasDesdeAlta - b.diasDesdeAlta; });
  return { recienLlegados: recientes.slice(0, limite), total: recientes.length };
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Renombra las columnas H/I ("Reservada") de INVENTARIO_XX a
// Relampago/Destacada y agrega Especial/PrecioPromo (J/K) en clientes
// que ya existían antes de este paso (hoy: XX y LP). No toca ningún
// valor de producto — solo encabezados y columnas nuevas en blanco.
function backfillColumnasOfertasXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var actualizadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    var hoja = ss.getSheetByName('INVENTARIO_' + prefijo);
    if (!hoja) continue;
    hoja.getRange(1, 8, 1, 4).setValues([['Relampago','Destacada','Especial','PrecioPromo']]);
    hoja.getRange(1, 8, 1, 4).setFontWeight('bold');
    actualizadas.push(prefijo);
  }
  Logger.log('Columnas de ofertas revisadas/creadas en INVENTARIO_XX para: ' + actualizadas.join(', '));
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Crea la hoja CLIENTES_XX para clientes que ya existían antes de este
// paso (hoy: XX y LP no la tienen). No borra nada si ya existe.
function backfillClientesXX() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creadas = [];
  for (var i = 1; i < datos.length; i++) {
    var prefijo = String(datos[i][0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearHojaClientesXX(ss, prefijo);
    creadas.push(prefijo);
  }
  Logger.log('CLIENTES_XX revisada/creada para: ' + creadas.join(', '));
}

// ── BACKFILL MANUAL (opcional, ejecutar UNA vez desde el editor) ──
// Completa la fila en CLIENTES_VAO de clientes que ya existen en
// VENDEDORES pero fueron creados antes de este cambio (hoy: LP).
// No modifica nada si el prefijo ya tiene fila en CLIENTES_VAO.
function backfillClientesVao() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  if (!hVend) { Logger.log('No existe VENDEDORES'); return; }
  var datos = hVend.getDataRange().getValues();
  var creados = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var prefijo = String(f[0] || '').trim().toUpperCase();
    if (!prefijo) continue;
    crearFilaClientesVao(
      prefijo,
      String(f[1] || '').trim(),   // nombre
      String(f[2] || '').trim(),   // telefono
      String(f[3] || '').trim(),   // correo
      String(f[4] || '').trim(),   // categoria → Plan
      String(f[8] || '').trim(),   // aliasPago
      String(f[9] || '').trim(),   // linkMP
      !!PropertiesService.getScriptProperties().getProperty('MP_TOKEN_' + prefijo)
    );
    creados.push(prefijo);
  }
  Logger.log('Backfill CLIENTES_VAO revisado para: ' + creados.join(', '));
}

// ── RESUMEN ADMIN ─────────────────────────────────────────────────

function getResumenAdmin(token) {
  if (!validarSesionAdmin(token)) return { error: 'Sesión admin inválida o expirada' };

  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var hVend   = ss.getSheetByName('VENDEDORES');
  if (!hVend) return { error: 'No existe hoja VENDEDORES' };

  var datos   = hVend.getDataRange().getValues();
  var clientes = [];
  var props   = PropertiesService.getScriptProperties();
  var todasProps = props.getProperties();

  for (var i = 1; i < datos.length; i++) {
    var f       = datos[i];
    var prefijo = String(f[0] || '').trim().toUpperCase();
    if (!prefijo) continue;

    var tienePin   = !!props.getProperty('PIN_' + prefijo);
    var tieneToken = !!props.getProperty('MP_TOKEN_' + prefijo);
    var tieneSesion= Object.keys(todasProps).some(function(k) {
      return k.indexOf('SESSION_' + prefijo + '_') === 0;
    });

    // Contar ventas del mes
    var totalMes = 0;
    try {
      var hVentas = ss.getSheetByName('VENTAS_' + prefijo);
      if (hVentas) {
        var ventas  = hVentas.getDataRange().getValues();
        var hoy     = new Date();
        for (var v = 1; v < ventas.length; v++) {
          var fecha = ventas[v][0];
          if (fecha instanceof Date &&
              fecha.getMonth() === hoy.getMonth() &&
              fecha.getFullYear() === hoy.getFullYear()) {
            totalMes += parseFloat(ventas[v][5]) || 0;
          }
        }
      }
    } catch(e) {}

    var vigencia = _obtenerVigenciaCliente_(prefijo);

    clientes.push({
      prefijo:     prefijo,
      nombre:      String(f[1] || '').trim(),
      activo:      String(f[6] || '').trim().toLowerCase() === 'si',
      tienePin:    tienePin,
      tieneToken:  tieneToken,
      sesionActiva:tieneSesion,
      ventasMes:   totalMes,
      vigente:     vigencia.vigente,
      fechaVence:  vigencia.fechaVence
    });
  }

  return { success: true, clientes: clientes };
}

// ===============================
// MÓDULO CONFIG — VAO SmartPOS
// Lee la configuración del cliente (hoja CONFIG_<prefijo>)
// El PIN es sensible y NUNCA se devuelve al frontend
// Cadena de validación (Reglas 24-29): prefijo → activo → token → token válido
// ===============================

function getConfig(prefijo, token) {
  var infoCliente = obtenerInfoCliente(prefijo);
  if (!infoCliente)        return { error: 'Cliente no encontrado' };
  if (!infoCliente.activo) return { error: 'Cliente inactivo — contactar a VAO Sistemas' };
  if (!_obtenerVigenciaCliente_(prefijo).vigente) return { error: 'Suscripción vencida — contactar a VAO Sistemas' };
  if (!validarSesionCliente(prefijo, token)) return { error: 'Sesión inválida o expirada' };

  var resultado = leerConfig(prefijo);
  if (resultado.config) delete resultado.config.PIN; // el PIN nunca sale del servidor
  return resultado;
}

function leerConfig(prefijo) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CONFIG_' + prefijo);
  if (!hoja) throw new Error('No existe hoja CONFIG_' + prefijo);

  var datos  = hoja.getDataRange().getValues();
  var config = {};

  for (var i = 1; i < datos.length; i++) {
    var campo = datos[i][0] ? String(datos[i][0]).trim() : '';
    if (!campo) continue; // fila separadora de sección ("--- IDENTIDAD ---", etc.), se ignora

    var valor = datos[i][1];
    if (valor === 'TRUE')  valor = true;
    if (valor === 'FALSE') valor = false;

    config[campo] = valor;
  }

  // Módulos base: nunca se apagan, aunque la planilla diga FALSE
  config.ventas    = true;
  config.cobrar    = true;
  config.ticket_wa = true;
  config.buscador  = true;

  return { config: config };
}
