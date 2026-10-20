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
// 📅 Última edición: 19/10/2026 (v034)
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
  version:       'v034',
  ultimaEdicion: '19/10/2026'
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


// v024: acciones que no pertenecen a un negocio (admin, login, info).
// Todas las demás exigen ?prefijo=XX.
var ACCIONES_SIN_PREFIJO_ = ['getInfo', 'crearVendedor', 'adminLogin', 'clienteLogin', 'cerrarSesionAdmin',
                             'renovarVigencia', 'resetPin', 'getResumenAdmin', 'activarCliente', 'suspenderCliente',
                             // v025: administración de planes y módulos (el prefijo va dentro de data)
                             'getPlanes', 'inicializarPlanes', 'previsualizarPlanes', 'guardarPlan', 'verificarPrefijo',
                             'cambiarPlanCliente', 'getModulosCliente', 'setModuloCliente',
                             'regularizarPrueba', // v028
                             'checkpointModulos', 'sincronizarModulos', 'previsualizarCambioPlan',
                             'checkpointPlanes', 'corregirPlanesFijos', 'agregarPlanPersonalizado', // v029
                             'recuperarCambioPlan', // v030
                             // v031: página pública planes.html (SIN sesión) — solo lectura de planes y registro de PRUEBA
                             'getPlanesPublicos', 'registroSolicitarCodigo', 'registroConfirmar', 'registroEstado',
                             // v031: Admin (con sesión admin)
                             'prepararPreciosPlanes', 'guardarPreciosPlan', 'guardarPromocion',
                             'registrosPanel', 'registrosConfig', 'registroAccion', 'confirmarPagoRecibido',
                             // v033: vigencia de planes pagos (Admin)
                             'estadoVigenciaCliente', 'registrarCortesia', 'regularizarVigencia', 'sincronizarVigencia', 'recuperarPagoEnCurso'];

// v026: doGet y doPost comparten el MISMO ruteo. POST sirve para pedidos
// largos (un carrito grande no entra en la URL). Los GET de siempre no cambian.
function doGet(e) {
  return _rutearPedido_(e);
}

function doPost(e) {
  var params = {};
  var q = (e && e.parameter) || {};
  Object.keys(q).forEach(function (k) { params[k] = q[k]; });
  var cuerpo = {};
  try { cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return respuestaJSON({ error: 'Pedido POST mal formado' }); }
  if (cuerpo.action)  params.action  = String(cuerpo.action);
  if (cuerpo.prefijo) params.prefijo = String(cuerpo.prefijo);
  if (cuerpo.data !== undefined) params.data = encodeURIComponent(JSON.stringify(cuerpo.data));
  return _rutearPedido_({ parameter: params });
}

function _rutearPedido_(e) {
  e = e || {}; e.parameter = e.parameter || {};
  const action  = e.parameter.action  || '';
  // v024: sin prefijo por defecto (antes caía en 'NE', un negocio real).
  const prefijo = String(e.parameter.prefijo || '').trim().toUpperCase();

  var result;
  try {
    // v024: un 'data' mal formado ahora devuelve error JSON en vez de romper la respuesta.
    const data = e.parameter.data ? JSON.parse(decodeURIComponent(e.parameter.data)) : {};
    var errModulo = null, bloqueoPrueba = null;
    if      (!prefijo && ACCIONES_SIN_PREFIJO_.indexOf(action) === -1) { result = { error: 'Prefijo requerido' }; }
    // v025: el servidor exige que el módulo esté habilitado (plan + CONFIG_XX)
    else if (Object.prototype.hasOwnProperty.call(MODULO_POR_ACCION_, action) &&
             (errModulo = _verificarModuloAccion_(prefijo, data, MODULO_POR_ACCION_[action]))) { result = { error: errModulo, moduloNoHabilitado: true }; }
    // v028: PRUEBA vencida → escrituras bloqueadas desde el servidor (también por API directa)
    else if (prefijo && ACCIONES_ESCRITURA_.indexOf(action) !== -1 &&
             (bloqueoPrueba = _bloqueoPruebaVencida_(prefijo, action, data))) { result = bloqueoPrueba; }
    else if (action === 'getInfo')            { result = getInfo(); }
    else if (action === 'exportarDatos')      { result = exportarDatos(prefijo, data.token || ''); }
    else if (action === 'regularizarPrueba')  { result = regularizarPrueba(data); }
    else if (action === 'checkpointModulos')  { result = checkpointModulos(data); }
    else if (action === 'sincronizarModulos') { result = sincronizarModulos(data); }
    else if (action === 'previsualizarCambioPlan') { result = previsualizarCambioPlan(data); }
    else if (action === 'checkpointPlanes')   { result = checkpointPlanes(data); }
    else if (action === 'corregirPlanesFijos'){ result = corregirPlanesFijos(data); }
    else if (action === 'agregarPlanPersonalizado') { result = agregarPlanPersonalizado(data); }
    else if (action === 'recuperarCambioPlan') { result = recuperarCambioPlan(data); }
    else if (action === 'getPlanesPublicos')  { result = getPlanesPublicos(data); }
    else if (action === 'registroSolicitarCodigo') { result = registroSolicitarCodigo(data); }
    else if (action === 'registroConfirmar')  { result = registroConfirmar(data); }
    else if (action === 'registroEstado')     { result = registroEstado(data); }
    else if (action === 'prepararPreciosPlanes') { result = prepararPreciosPlanes(data); }
    else if (action === 'guardarPreciosPlan') { result = guardarPreciosPlan(data); }
    else if (action === 'guardarPromocion')   { result = guardarPromocion(data); }
    else if (action === 'registrosPanel')     { result = registrosPanel(data); }
    else if (action === 'registrosConfig')    { result = registrosConfig(data); }
    else if (action === 'registroAccion')     { result = registroAccion(data); }
    else if (action === 'confirmarPagoRecibido') { result = confirmarPagoRecibido(data); }
    else if (action === 'estadoVigenciaCliente') { result = estadoVigenciaCliente(data); }
    else if (action === 'registrarCortesia')  { result = registrarCortesia(data); }
    else if (action === 'regularizarVigencia'){ result = regularizarVigencia(data); }
    else if (action === 'sincronizarVigencia'){ result = sincronizarVigencia(data); }
    else if (action === 'recuperarPagoEnCurso') { result = recuperarPagoEnCurso(data); }
    else if (action === 'verificarOperacion') { result = verificarOperacion(prefijo, data); }
    else if (action === 'getPlanes')          { result = getPlanes(data); }
    else if (action === 'inicializarPlanes')  { result = inicializarPlanes(data); }
    else if (action === 'previsualizarPlanes'){ result = previsualizarPlanes(data); }
    else if (action === 'guardarPlan')        { result = guardarPlan(data); }
    else if (action === 'verificarPrefijo')   { result = verificarPrefijo(data); }
    else if (action === 'cambiarPlanCliente') { result = cambiarPlanCliente(data); }
    else if (action === 'getModulosCliente')  { result = getModulosCliente(data); }
    else if (action === 'setModuloCliente')   { result = setModuloCliente(data); }
    else if (action === 'getVendedores')      { result = getVendedores(prefijo, data.token || ''); }
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
    else if (action === 'getClientes')        { result = getClientesXX(prefijo, data.token || ''); }
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

// v024: antes era público y devolvía teléfono, correo, comisión, alias y link
// de TODOS los negocios. Ahora exige la sesión del negocio y devuelve solo el
// suyo, con los datos que usa el POS (nombre, alias, link de pago).
function getVendedores(prefijo, token) {
  var errAcceso = _requiereSesionValida_(prefijo, token);
  if (errAcceso) return { error: errAcceso, vendedores: [] };

  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('VENDEDORES');
  if (!hoja) throw new Error('No existe hoja VENDEDORES');
  var datos = hoja.getDataRange().getValues();
  var vendedores = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var pref = f[0] ? String(f[0]).trim().toUpperCase() : '';
    if (!pref || pref !== prefijo) continue;
    // A=Prefijo B=Nombre C=Teléfono D=Correo E=Categoría F=Fecha Alta G=Activo H=Comision% I=Alias Pago J=Link MP K=Notas
    vendedores.push({
      prefijo:   pref,
      nombre:    String(f[1]  || '').trim(),
      activo:    String(f[6]  || '').trim().toLowerCase() === 'si',
      aliasPago: String(f[8]  || '').trim(),
      linkMP:    String(f[9]  || '').trim()
      // tokenMP: NUNCA se devuelve desde getVendedores
    });
  }
  return { vendedores: vendedores };
}

function generarPinAleatorio() {
  // v026: azar de Utilities.getUuid() (antes Math.random). Siempre 6 dígitos.
  var n = parseInt(Utilities.getUuid().replace(/-/g, '').substring(0, 12), 16);
  return String(100000 + (n % 900000));
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
  // v024: exige sesión admin.
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  // v031: el cuerpo pasó a _altaNegocioSinLock_ (mismas validaciones), para que el
  // alta automática de PRUEBA use exactamente el mismo camino. Acá solo se toma el lock.
  var d0 = String(data.nombre || '').trim();
  if (!d0) return { error: 'Nombre requerido' };
  var lock = LockService.getScriptLock();
  var tieneLock = false;
  try { tieneLock = lock.tryLock(10000); } catch (e) { tieneLock = false; }
  if (!tieneLock) return { error: 'Sistema ocupado, reintentar', ocupado: true };
  try { return _altaNegocioSinLock_(data, { origen: 'ADMIN' }); }
  finally { lock.releaseLock(); }
}

// v031: alta de un negocio. Quien la llama TIENE QUE tener el lock del script.
// La usan crearVendedor (Admin) y el alta automática de PRUEBA (planes.html).
function _altaNegocioSinLock_(data, opciones) {
  opciones = opciones || {};
  // v025: alta completa y segura. Primero se verifica TODO sin escribir nada;
  // si el prefijo choca con cualquier hoja existente (del sistema o de otro
  // negocio), con un negocio registrado o con datos de acceso viejos, se rechaza.
  var d = {
    prefijo:   _normalizarPrefijo_(data.prefijo),
    nombre:    String(data.nombre    || '').trim(),
    contacto:  String(data.contacto  || '').trim(),
    telefono:  String(data.telefono  || '').trim(),
    correo:    String(data.correo    || '').trim().toLowerCase(), // v026: siempre en minúsculas
    aliasPago: String(data.aliasPago || '').trim(),
    linkMP:    String(data.linkMP    || '').trim(),
    tokenMP:   String(data.tokenMP   || '').trim(), // se guarda en Properties, NO en Sheets
    comision:  parseFloat(data.comision) || 0,
    plan:      _normalizarPlan_(data.plan || data.categoria),
    obs:       opciones.obs || ''
  };
  if (!d.nombre) return { error: 'Nombre requerido' };

  {
    var chequeo = _chequearPrefijoDisponible_(d.prefijo);
    if (!chequeo.disponible) {
      return { error: 'No se puede usar el prefijo ' + d.prefijo + ': ' + chequeo.motivos.join(' · '), motivos: chequeo.motivos };
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName('VENDEDORES')) return { error: 'No existe hoja VENDEDORES' };

    var pl = _leerPlanes_();
    if (!pl.existe) return { error: 'Primero inicializá los planes (Admin → Planes)' };
    var plan = pl.planes[d.plan];
    if (!plan) return { error: 'Plan ' + (d.plan || '(vacío)') + ' no existe' };
    if (!plan.activo) return { error: 'El plan ' + plan.nombre + ' está inactivo' };
    if (plan.contratable === false) return { error: 'El plan ' + plan.nombre + ' todavía no se puede contratar' }; // v031 (PLUS: próximamente)
    // v033: un plan pago se activa SOLO registrando el pago confirmado (💳 Vigencia y pagos), nunca desde el alta.
    if (d.plan !== 'PRUEBA') return { error: 'Los planes pagos se activan registrando el pago confirmado. Dalo de alta como PRUEBA y después registrá el pago en 💳 Vigencia y pagos.', requierePago: true };
    // v029: el alta toma los módulos de PLANES_VAO; si al plan le falta una columna, no se adivina.
    var faltan = MODULOS_IMPLEMENTADOS_.filter(function (m) { return !plan.definidos[m.clave]; }).map(function (m) { return m.nombre; });
    if (faltan.length) return { error: 'PLANES_VAO está incompleto (falta: ' + faltan.join(', ') + '). Completalo en 🧩 Planes antes de dar altas.' };
    d.modulosPlan = plan.modulos;

    if (d.plan === 'PRUEBA') {
      // v028: PRUEBA = 7 días + 3 de gracia, fijos. Sin días manuales ni "sin vencimiento".
      if (!_vacio_(data.diasVigencia) && Number(data.diasVigencia) !== DIAS_PRUEBA_) {
        return { error: 'La prueba dura ' + DIAS_PRUEBA_ + ' días fijos (+ ' + DIAS_GRACIA_PRUEBA_ + ' de gracia): no se pueden elegir otros días.' };
      }
      if (!d.telefono && !d.correo) return { error: 'Para la prueba gratuita hace falta teléfono o correo del negocio.' };
      // v030: sin CLIENTES_VAO no se puede controlar "una prueba por persona" ni guardar el vencimiento.
      if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO')) return { error: 'Falta la hoja CLIENTES_VAO: no se puede dar una prueba gratuita sin registrar su vencimiento.' };
      var yaUso = _pruebaYaUsada_(d.telefono, d.correo);
      if (yaUso) return { error: 'Ese teléfono o correo ya está registrado (' + yaUso + '): la prueba gratuita es una sola vez. Elegí BÁSICO o PRO.' };
      var cp = _calcularPrueba_(new Date());
      d.fechaVence = cp.vence;   // último día de prueba (día 7)
      d.prueba = cp;
      return _crearNegocio_(d);
    }
    // Vigencia: los días que mande Admin; si no manda, los del plan; vacío = sin vencimiento.
    var dias = _enteroOpcional_(data.diasVigencia);
    if (isNaN(dias)) return { error: 'Días de vigencia inválidos' };
    if (dias === null) dias = plan.diasVigencia;
    if (dias) {
      var hoy = new Date();
      d.fechaVence = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
    }
    return _crearNegocio_(d);
  }
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

  // v028: cantidades enteras en rango y precios válidos, antes de escribir.
  var errItems = _errorItemsVenta_(items, _reglasNegocio_(prefijo));
  if (errItems) return { success: false, procesados: [], bloqueados: [], errores: [errItems], validacion: true };

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
    datosInv[filaIdx-1][2] = stockActual - qty; // v027: si el mismo producto viene en dos renglones, el segundo parte del stock ya descontado
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

  var idOperacion = String(data.idOperacion || '').trim();
  if (!idOperacion) return { error: 'idOperacion requerido' };

  var lock = LockService.getScriptLock();
  var tieneLock = false;
  try { tieneLock = lock.tryLock(10000); } catch (e) { tieneLock = false; }
  if (!tieneLock) return { error: 'Sistema ocupado, reintentar', ocupado: true };

  try {
    return _venderFiadoSinLock_(data, prefijo, idOperacion);
  } catch (err) {
    // v027: un error a mitad de camino NO borra el registro de la operación.
    // El próximo Confirmar (mismo idOperacion) retoma desde la última etapa segura.
    return { success: false, enProceso: true, idOperacion: idOperacion,
             error: 'El fiado se interrumpió (' + err.message + '). Quedó guardado: Confirmar lo retoma sin duplicar.' };
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// v027 — VENTA FIADA POR ETAPAS, RECUPERABLE CON EL MISMO idOperacion
// =====================================================================
// Antes (v018–v026): VENTAS y stock se escribían ANTES de guardar el estado
// VENTA_REGISTRADA, y las filas fiadas no tenían VentaId. Un corte en ese
// intervalo dejaba la operación "ambigua" para siempre: nadie podía saber si
// el stock se había descontado.
//
// Ahora, todo bajo el mismo ScriptLock, en este orden:
//   1. INICIADA   — se guarda el PLAN: por cada fila, stock ANTES y DESPUÉS.
//   2. stock      — cada producto se lleva a su valor DESPUÉS (valor fijo, no resta).
//   3. STOCK_OK
//   4. VENTAS     — todas las filas en UNA sola escritura, con el idOperacion en G.
//   5. VENTAS_OK
//   6. FIADOS     — una fila con Ticket = idOperacion.
//   7. fin        — se borra el registro de la operación.
// Recuperación (mismo idOperacion):
//   - Ticket en FIADOS        → ya estaba completo (no se repite nada).
//   - INICIADA                → producto por producto: stock = ANTES → falta;
//                               stock = DESPUÉS → ya se descontó; otro valor →
//                               AMBIGUA (alguien más lo cambió): no se toca y se informa.
//   - Filas con el id en G    → el stock ya estaba descontado (va antes).
//   - STOCK_OK / VENTAS_OK    → sigue desde ahí.
// Operaciones de versiones anteriores (sin plan) se tratan como antes: las
// INICIADA viejas siguen siendo ambiguas (no se reconcilian solas).
function _venderFiadoSinLock_(data, prefijo, idOperacion) {
  var props   = PropertiesService.getScriptProperties();
  var propKey = 'FIADO_OP_' + prefijo + '_' + idOperacion;
  var hojaFiados = getHojaFiados(prefijo);
  var hojaVentas = getHojaVentas(prefijo);

  // R0 — ¿la deuda ya existe? Entonces la operación está completa.
  var filaTicket = _filaTicketFiado_(hojaFiados, idOperacion);
  if (filaTicket) {
    _repararEstadoFiado_(hojaFiados, filaTicket);
    props.deleteProperty(propKey);
    return { success: true, ventaRegistrada: true, fiadoRegistrado: true, yaExistia: true, idOperacion: idOperacion };
  }

  var opStr = props.getProperty(propKey);
  var op = null;
  if (opStr) { try { op = JSON.parse(opStr); } catch (e) { return _fiadoAmbiguo_(idOperacion, ['el registro de la operación está dañado']); } }

  // ── operaciones de versiones anteriores (sin plan): mismo trato que antes ──
  if (op && !op.v) {
    if (op.estado === 'VENTA_REGISTRADA') {
      var rLeg = registrarFiadoXX(prefijo, { token: data.token, cliente: op.cliente, telefono: op.telefono,
        total: op.total, descripcion: op.descripcion, cantItems: op.cantItems, ticket: idOperacion });
      if (rLeg.success) { props.deleteProperty(propKey); return { success: true, ventaRegistrada: true, fiadoRegistrado: true, idOperacion: idOperacion, idFiado: rLeg.idFiado }; }
      return { success: false, ventaRegistrada: true, fiadoRegistrado: false, idOperacion: idOperacion,
               error: 'Venta registrada, fiado pendiente de reconciliar: ' + (rLeg.error || 'error desconocido') };
    }
    return { success: false, ambiguo: true, idOperacion: idOperacion,
             error: 'Operación ambigua, requiere revisión manual antes de reintentar' };
  }

  // ── operación nueva ──
  if (!op) {
    if (_buscarVentaPorId_(hojaVentas, idOperacion).existe) {
      return _fiadoAmbiguo_(idOperacion, ['hay ventas con este número en VENTAS_' + prefijo + ' pero no hay registro de la operación']);
    }
    var cliente  = String(data.cliente  || '').trim();
    var telefono = String(data.telefono || '').trim();
    if (!cliente) return { error: 'Cliente requerido para venta fiada' };

    var datosInv = getHojaInv(prefijo).getDataRange().getValues();
    var items = data.items || [];
    var errItems = _errorItemsVenta_(items, _reglasNegocio_(prefijo)); // v028
    if (errItems) return { success: false, definitivo: true, validacion: true, idOperacion: idOperacion, error: errItems };

    // Identidad (igual que v016): nada escrito si una fila ya no es el producto.
    var identidadIncorrecta = [];
    items.forEach(function (it) {
      var f = parseInt(it.id);
      if (!f || f < 2 || f > datosInv.length) return;
      if (!_identidadCoincide_(datosInv[f - 1], it.codigo, it.name)) identidadIncorrecta.push(String(it.name || ('id ' + it.id)).trim().toUpperCase());
    });
    if (identidadIncorrecta.length) {
      return { success: false, definitivo: true, identidad: true, idOperacion: idOperacion,
               error: 'El inventario cambió: ' + identidadIncorrecta.join(', ') + '. Quitalo y volvé a agregarlo.' };
    }

    // Plan agrupado por fila (si un producto aparece dos veces se suma).
    var porFila = {}, orden = [], faltantes = [];
    items.forEach(function (it) {
      var f = parseInt(it.id);
      if (!f || f < 2 || f > datosInv.length) { faltantes.push('Producto no encontrado (id ' + it.id + ')'); return; }
      var qty = parseInt(it.qty) || 1;
      if (!porFila[f]) {
        var precio = (it.precioVenta !== undefined && it.precioVenta !== null && it.precioVenta !== '') ? parseFloat(it.precioVenta) : (parseFloat(datosInv[f - 1][4]) || 0);
        porFila[f] = { fila: f, codigo: String(datosInv[f - 1][0] || '').trim().toUpperCase(),
                       nombre: String(datosInv[f - 1][1]).trim().toUpperCase(), qty: 0, precio: precio,
                       antes: parseInt(datosInv[f - 1][2]) || 0 };
        orden.push(f);
      }
      porFila[f].qty += qty;
    });
    orden.forEach(function (f) {
      var p = porFila[f];
      if (p.antes < p.qty) faltantes.push(p.nombre + ': stock insuficiente (disponible ' + p.antes + ')');
    });
    if (faltantes.length) return { error: 'Stock insuficiente para venta fiada: ' + faltantes.join(' | ') }; // texto que el POS reconoce (D1)
    if (!orden.length) return { error: 'Stock insuficiente para venta fiada: carrito vacío' };

    op = { v: 27, estado: 'INICIADA', cliente: cliente, telefono: telefono, ts: new Date().getTime(),
           plan: orden.map(function (f) { var p = porFila[f]; p.despues = p.antes - p.qty; return p; }) };
    props.setProperty(propKey, JSON.stringify(op));                       // ETAPA 1
  }

  var guardar = function () { op.ts = new Date().getTime(); props.setProperty(propKey, JSON.stringify(op)); };

  // ── ETAPA 2: stock ──
  if (op.estado === 'INICIADA') {
    if (_buscarVentaPorId_(hojaVentas, idOperacion).existe) {
      op.estado = 'STOCK_OK'; guardar();   // las filas de VENTAS van después del stock: ya estaba descontado
    } else {
      var inv = getHojaInv(prefijo);
      var datos = inv.getDataRange().getValues();
      var pendientes = [], dudas = [];
      op.plan.forEach(function (p) {
        var filaInv = datos[p.fila - 1];
        var mismo = filaInv && String(filaInv[1]).trim().toUpperCase() === p.nombre &&
                    String(filaInv[0] || '').trim().toUpperCase() === p.codigo;
        var actual = filaInv ? (parseInt(filaInv[2]) || 0) : null;
        if (!mismo) dudas.push(p.nombre + ': la fila ' + p.fila + ' ya no es ese producto');
        else if (actual === p.despues) { /* ya descontado */ }
        else if (actual === p.antes) pendientes.push(p);
        else dudas.push(p.nombre + ': stock ' + actual + ' (se esperaba ' + p.antes + ' antes o ' + p.despues + ' después)');
      });
      if (dudas.length) return _fiadoAmbiguo_(idOperacion, dudas);
      pendientes.forEach(function (p) { inv.getRange(p.fila, 3).setValue(p.despues); });
      op.estado = 'STOCK_OK'; guardar();                                 // ETAPA 3
    }
  }

  // ── ETAPA 4: VENTAS (una sola escritura, con el id en G) ──
  if (op.estado === 'STOCK_OK') {
    if (!_buscarVentaPorId_(hojaVentas, idOperacion).existe) {
      var ahora = new Date();
      var filas = op.plan.map(function (p) { return [ahora, p.nombre, p.qty, p.precio, 'FIADO', p.precio * p.qty, idOperacion]; });
      var uf = hojaVentas.getLastRow() + 1;
      hojaVentas.getRange(uf, 1, filas.length, 7).setValues(filas);
      hojaVentas.getRange(uf, 1, filas.length, 1).setNumberFormat('dd/mm/yyyy hh:mm');
      hojaVentas.getRange(uf, 4, filas.length, 1).setNumberFormat('"$"#,##0');
      hojaVentas.getRange(uf, 6, filas.length, 1).setNumberFormat('"$"#,##0');
    }
    op.estado = 'VENTAS_OK'; guardar();                                  // ETAPA 5
  }

  // ── ETAPA 6: la deuda ──
  var total = 0, cant = 0;
  op.plan.forEach(function (p) { total += p.precio * p.qty; cant += p.qty; });
  var descripcion = op.plan.map(function (p) { return p.qty + 'x ' + p.nombre; }).join(', ');
  var rf = registrarFiadoXX(prefijo, { token: data.token, cliente: op.cliente, telefono: op.telefono,
    total: total, descripcion: descripcion, cantItems: cant, ticket: idOperacion });
  if (rf.success) {
    props.deleteProperty(propKey);                                       // ETAPA 7
    return { success: true, ventaRegistrada: true, fiadoRegistrado: true, idOperacion: idOperacion, idFiado: rf.idFiado };
  }
  return { success: false, ventaRegistrada: true, fiadoRegistrado: false, idOperacion: idOperacion,
           error: 'Venta registrada, fiado pendiente de reconciliar: ' + (rf.error || 'error desconocido') };
}

function _filaTicketFiado_(hoja, ticket) {
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) if (String(datos[i][2]) === String(ticket)) return i + 1;
  return 0;
}

// Si se cortó justo después de agregar la fila de la deuda, falta la fórmula de Estado (K).
function _repararEstadoFiado_(hoja, fila) {
  if (String(hoja.getRange(fila, 11).getValue() || '') !== '') return;
  hoja.getRange(fila, 11).setFormula('=IF(D' + fila + '="";"";IF(L' + fila + '<>"";"PAGADO";' +
    'IF(AND(J' + fila + '<>"";TODAY()>J' + fila + ');"VENCIDO";"PENDIENTE")))');
}

function _fiadoAmbiguo_(idOperacion, detalle) {
  return { success: false, ambiguo: true, idOperacion: idOperacion, detalle: detalle,
           error: 'Operación ambigua, requiere revisión manual antes de reintentar: ' + detalle.join(' · ') };
}

// Ejecutar desde el editor: lista operaciones de fiado que quedaron a medias
// (no corrige nada). Sirve para revisar ambiguas.
function listarFiadosEnCurso() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lista = Object.keys(props).filter(function (k) { return k.indexOf('FIADO_OP_') === 0; }).map(function (k) {
    var op = {}; try { op = JSON.parse(props[k]); } catch (e) { op = { estado: 'ILEGIBLE' }; }
    var resto = k.replace('FIADO_OP_', ''), pref = resto.split('_')[0], id = resto.substring(pref.length + 1);
    var h = ss.getSheetByName('FIADOS_' + pref);
    var yaEsta = h ? _filaTicketFiado_(h, id) > 0 : false;
    return resto + ' → ' + (yaEsta ? 'DEUDA YA REGISTRADA (marca sobrante, se borra sola al reintentar) · ' : '') + (op.v ? 'v027 ' : 'anterior ') + (op.estado || '?') +
      (op.cliente ? ' · ' + op.cliente : '') + (op.ts ? ' · ' + new Date(op.ts).toISOString() : '');
  });
  Logger.log(lista.length ? lista.join('\n') : 'No hay fiados en curso');
  return lista;
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
  var prov     = (data.proveedor || '').trim().toUpperCase();
  var cat      = (data.categoria || 'GENERAL').trim().toUpperCase();

  if (!nombre)       return _rechazoValidacion_('Nombre requerido', 'nombre');

  var datos = inv.getDataRange().getValues();
  var filaExistente = -1;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][1]).trim().toUpperCase() === nombre) { filaExistente = i+1; break; }
  }

  // v028: PRIMERO VALIDAR, DESPUÉS ESCRIBIR. Si algo no cumple, no se toca
  // ni el inventario ni el historial.
  var val = _validarIngreso_(data, filaExistente > 0 ? datos[filaExistente-1] : null, _reglasNegocio_(prefijo));
  if (!val.ok) return val;
  var cantidad = val.cantidad;
  var costo    = val.costo || 0;
  var venta    = val.venta || 0;

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

  // v028: validar antes de escribir (stock entero en rango, precio vs costo, cambios grandes).
  var val28 = _validarAjuste_(data, filaActual, _reglasNegocio_(prefijo));
  if (!val28.ok) return val28;
  nuevoPrecio = val28.cambiaPrecio ? val28.nuevoPrecio : NaN;

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
  // v024: exigía nada; ahora exige la sesión del negocio, igual que getVentas.
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
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
      total:  parseFloat(fila[5])||0,
      ventaId: String(fila[6]||'').trim() // v023: identidad de la venta (vacío en ventas viejas y fiados)
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
  // v026: azar de Utilities.getUuid() (antes Math.random, predecible).
  var token = '';
  while (token.length < (largo || 32)) token += Utilities.getUuid().replace(/-/g, '');
  return token.substring(0, largo || 32);
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

// v024: la clave ya NO se escribe en el código.
// Procedimiento para cambiarla:
//   1) Configuración del proyecto → Propiedades del script → agregar
//      ADMIN_CLAVE_NUEVA con la clave nueva (mínimo 6 caracteres).
//   2) Ejecutar generarClaveAdmin(). Guarda el hash y BORRA ADMIN_CLAVE_NUEVA.
// La clave vigente sigue funcionando hasta que se haga este procedimiento.
function generarClaveAdmin() {
  var props = PropertiesService.getScriptProperties();
  var clave = String(props.getProperty('ADMIN_CLAVE_NUEVA') || '').trim();

  if (!clave) {
    Logger.log('ERROR: falta la propiedad ADMIN_CLAVE_NUEVA — no se cambió nada');
    return;
  }
  if (clave.length < 6) {
    props.deleteProperty('ADMIN_CLAVE_NUEVA');
    Logger.log('ERROR: La clave debe tener al menos 6 caracteres — no se cambió nada');
    return;
  }

  props.setProperty('ADMIN_CLAVE_HASH', _hashFuerte_(clave, 'ADMIN')); // v026: SHA-256
  props.deleteProperty('ADMIN_CLAVE_NUEVA');
  props.deleteProperty('LOGIN_FALLOS_ADMIN');

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

  if (!claveHash) return { error: 'Sistema no configurado — ejecutar generarClaveAdmin() primero' };
  // v026: límite de intentos + hash SHA-256 (las claves viejas se migran solas al entrar bien).
  var bloqueoA = _loginBloqueado_('ADMIN');
  if (bloqueoA) return { error: 'Demasiados intentos fallidos. Probá de nuevo en ' + bloqueoA + ' minuto' + (bloqueoA === 1 ? '' : 's') + '.', bloqueado: true };
  if (!_hashCoincide_(clave, claveHash, 'ADMIN')) { _registrarFalloLogin_('ADMIN', 5); return { error: 'Clave incorrecta' }; }
  _limpiarFallosLogin_('ADMIN');
  if (claveHash.indexOf('S2$') !== 0) props.setProperty('ADMIN_CLAVE_HASH', _hashFuerte_(clave, 'ADMIN'));

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
  props.setProperty('PIN_' + prefijo, _hashFuerte_(pin, prefijo)); // v026: SHA-256

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
  // v028: PRUEBA regularizada → se puede entrar y consultar siempre; las
  // escrituras las frena el ruteo cuando está VENCIDA.
  var ep28 = _estadoPrueba_(prefijo);
  if (ep28 && ep28.regularizada) return { vigente: true, fechaVence: ep28.vence, enTolerancia: ep28.estado === 'GRACIA', revisar: '', prueba: ep28 };
  // v025: + tolerancia del plan y fechas ilegibles. Nunca suspende por un dato
  // dudoso: si la fecha no se puede leer, deja entrar y marca "revisar".
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('CLIENTES_VAO');
  if (!hoja) return { vigente: true, fechaVence: null };

  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === prefijo) {
      var pl   = _leerPlanes_();
      var plan = pl.existe ? pl.planes[_normalizarPlan_(datos[i][5])] : null;
      var fechaVenceRaw = datos[i][8]; // I = Fecha Vence
      if (!fechaVenceRaw) {
        var codV = _normalizarPlan_(datos[i][5]);
        return { vigente: true, fechaVence: null,   // v033: NO se bloquea; solo se avisa
                 revisar: (codV && codV !== 'PRUEBA') ? 'PENDIENTE DE REGULARIZAR: plan pago sin vencimiento'
                        : ((plan && plan.diasVigencia) ? 'Sin fecha de vencimiento (su plan tiene duración)' : '') };
      }
      var fv = (fechaVenceRaw instanceof Date) ? fechaVenceRaw : new Date(fechaVenceRaw);
      if (isNaN(fv.getTime())) {
        return { vigente: true, fechaVence: null, revisar: 'Fecha de vencimiento ilegible: ' + fechaVenceRaw };
      }
      var hoy    = new Date();
      var hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      var venceDia = new Date(fv.getFullYear(), fv.getMonth(), fv.getDate());
      var tolerancia = plan ? (plan.diasTolerancia || 0) : 0;
      var limite = new Date(venceDia.getFullYear(), venceDia.getMonth(), venceDia.getDate() + tolerancia);
      var vigente = hoyDia <= limite;
      return { vigente: vigente, fechaVence: fv, enTolerancia: vigente && hoyDia > venceDia,
               diasTolerancia: tolerancia, revisar: '' };
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
  // v026: límite de intentos por negocio (CONFIG_XX intentos_max, mínimo 3,
  // 5 si no está) y hash SHA-256 con migración automática del PIN viejo.
  var bloqueo = _loginBloqueado_(prefijo);
  if (bloqueo) return { error: 'Demasiados intentos fallidos. Probá de nuevo en ' + bloqueo + ' minuto' + (bloqueo === 1 ? '' : 's') + '.', bloqueado: true };
  if (!_hashCoincide_(pin, pinHash, prefijo)) {
    _registrarFalloLogin_(prefijo, _intentosMaxNegocio_(prefijo));
    return { error: 'PIN incorrecto' };
  }
  _limpiarFallosLogin_(prefijo);
  if (pinHash.indexOf('S2$') !== 0) props.setProperty('PIN_' + prefijo, _hashFuerte_(pin, prefijo));

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
  if (_planDeNegocio_(_normalizarPrefijo_(data.prefijo)) === 'PRUEBA') {
    return { error: 'La prueba gratuita no se renueva: registrá el pago del plan en 💳 Vigencia y pagos.' }; // v028
  }
  // v033: ya no se suman días manuales sueltos. La vigencia de un plan pago se extiende SOLO con
  // un pago confirmado, una cortesía (sin pago, 1 a 7 días) o una regularización (con motivo).
  return { error: 'La vigencia de los planes pagos se extiende registrando un pago confirmado, una cortesía o una regularización (💳 Vigencia y pagos).', requierePago: true };
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
function getClientesXX(prefijo, token) {
  // v024: la lista de clientes (nombres y teléfonos) exige la sesión del negocio.
  var errAcceso = _validarAccesoFiados_(prefijo, token);
  if (errAcceso) return { error: errAcceso };
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

  // v027: la fórmula de Estado (K) va en la MISMA escritura que la fila, así
  // un corte no puede dejar una deuda sin Estado.
  var filaEsperada = numFiado + 1;
  var formulaEstado = function (f) {
    return '=IF(D' + f + '="";"";IF(L' + f + '<>"";"PAGADO";' +
      'IF(AND(J' + f + '<>"";TODAY()>J' + f + ');"VENCIDO";"PENDIENTE")))';
  };
  hoja.appendRow([
    idFiado, fechaStr,
    data.ticket || '', cliente, data.telefono || '',
    data.descripcion || 'FIADO', data.cantItems || 1,
    total, total,
    data.vencimiento || '',
    formulaEstado(filaEsperada), '', '',
    data.obs || ''
  ]);

  var nuevaFila = hoja.getLastRow();
  if (nuevaFila !== filaEsperada) hoja.getRange(nuevaFila, 11).setFormula(formulaEstado(nuevaFila)); // la hoja tenía filas vacías al final

  upsertClienteXX(prefijo, cliente, data.telefono || '');

  return { success: true, idFiado: idFiado };
}

// Endpoint: ?action=abonarFiado&prefijo=XX&data={token,idFiado,abono,metodoPago,idOperacion}
function abonarFiadoXX(prefijo, data) {
  var errAcceso = _validarAccesoFiados_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
  // v026: con ScriptLock (dos cobros simultáneos ya no pisan el saldo).
  return _conLock_(function () { return _abonarFiadoSinLock_(prefijo, data); });
}

function _abonarFiadoSinLock_(prefijo, data) {
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
    if (totalActual <= 0 || String(rows[i][10]).trim().toUpperCase() === 'PAGADO') {
      return { error: 'Este fiado ya está saldado — no se registró el pago', definitivo: true };
    }

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
  return _conLock_(function () { return _cobrarFiadoSinLock_(prefijo, data); }); // v026
}

function _cobrarFiadoSinLock_(prefijo, data) {
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
    if (!data.esAbonoParcial && String(rows[i][10]).trim().toUpperCase() === 'PAGADO') {
      return { error: 'Este fiado ya estaba pagado — no se registró de nuevo', definitivo: true }; // v026
    }

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
  var periodos33 = _leerPeriodos_(); // v033

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
    var pl25 = _leerPlanes_();
    var codPlan = _planDeNegocio_(prefijo);
    var planObj = pl25.existe ? pl25.planes[codPlan] : null;
    var revisar = [];
    if (vigencia.revisar) revisar.push(vigencia.revisar);
    var ep = codPlan === 'PRUEBA' ? _estadoPrueba_(prefijo) : null; // v028
    if (ep && !ep.regularizada) revisar.push('PRUEBA sin regularizar: ' + ep.discrepancia);
    if (pl25.existe && !planObj) revisar.push(codPlan ? 'Plan "' + codPlan + '" no está en PLANES_VAO (se usa solo CONFIG)' : 'Sin plan asignado (se usa solo CONFIG)');

    clientes.push({
      prueba:      ep ? (ep.regularizada ? { regularizada: true, estado: ep.estado, dia: ep.dia, altaTxt: ep.altaTxt, venceTxt: ep.venceTxt, finGraciaTxt: ep.finGraciaTxt }
                          : { regularizada: false, discrepancia: ep.discrepancia, propuesta: ep.propuesta }) : null, // v028
      plan:        codPlan,                         // v025
      planNombre:  planObj ? planObj.nombre : '',   // v025
      enTolerancia:!!vigencia.enTolerancia,         // v025
      revisar:     revisar,                         // v025: avisos para el administrador
      prefijo:     prefijo,
      nombre:      String(f[1] || '').trim(),
      activo:      String(f[6] || '').trim().toLowerCase() === 'si',
      tienePin:    tienePin,
      tieneToken:  tieneToken,
      sesionActiva:tieneSesion,
      ventasMes:   totalMes,
      vigente:     vigencia.vigente,
      fechaVence:  vigencia.fechaVence,
      comercial:   _estadoComercial_(prefijo, codPlan, vigencia, periodos33, todasProps) // v033
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
  // v025: el POS recibe los módulos YA combinados con el plan (EFECTIVO =
  // interruptor del negocio Y permiso del plan). Igual el servidor los vuelve
  // a exigir en cada acción, por si alguien altera el navegador.
  if (resultado.config) {
    var ef = _modulosEfectivos_(prefijo, resultado.config);
    Object.keys(ef.modulos).forEach(function (k) { resultado.config[k] = ef.modulos[k]; });
    resultado.config.plan = ef.codigoPlan;
    resultado.config.planNombre = ef.plan ? ef.plan.nombre : '';
    resultado.config.reglas = _reglasNegocio_(prefijo); // v028: los mismos límites que exige el servidor
    var ep = _estadoPrueba_(prefijo);
    resultado.config.estadoPrueba = (ep && ep.regularizada)
      ? { estado: ep.estado, dia: ep.dia, venceTxt: ep.venceTxt, finGraciaTxt: ep.finGraciaTxt } : null;
  }
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

// =====================================================================
// v025 — PREFIJOS SEGUROS, PLANES Y MÓDULOS
// =====================================================================
// Regla de oro: un alta NUNCA puede apropiarse de una hoja que ya existe
// (del sistema o de otro negocio). Todo se verifica ANTES de escribir y,
// si algo falla a mitad de camino, se deshace lo que esta misma alta creó.
// No se modifica ni se borra ninguna hoja preexistente.
// =====================================================================

// Regla ÚNICA de prefijo para altas nuevas (admin.html la recibe de getPlanes,
// así frontend y backend usan exactamente la misma). Coincide con index.html
// (2 o 3 letras). Los negocios existentes con otro formato siguen funcionando:
// esta regla solo se aplica al dar de alta.
var PREFIJO_PATRON_ = '^[A-Z]{2,3}$';
var PREFIJOS_RESERVADOS_ = ['VAO', 'ADM', 'SYS'];

// Hojas centrales del sistema (no pertenecen a ningún negocio).
var HOJAS_SISTEMA_ = ['VENDEDORES', 'CLIENTES_VAO', 'PLANES_VAO', 'SOLICITUDES_VAO', 'PROMOCIONES_VAO', 'CUPOS_PROMO_VAO', 'PERIODOS_VAO']; // v031: + registro y oferta · v033: + períodos

// Todas las hojas que usa un negocio XX. Un alta exige que NINGUNA exista.
// (CONF_DIARIA_ no se crea en el alta, pero la usa extra_horarios.)
var FAMILIAS_HOJAS_NEGOCIO_ = ['INVENTARIO_', 'VENTAS_', 'CLIENTES_', 'FIADOS_', 'HISTORIAL_', 'PRESTAMOS_',
                               'CAJA_MOVIMIENTOS_', 'SALIDAS_', 'AJUSTE_RAPIDO_', 'CONFIG_', 'CONF_DIARIA_'];

// Módulos que REALMENTE tienen pantalla en el POS hoy. Solo estos se ofrecen
// en los planes. Los demás interruptores de CONFIG_XX (préstamos, caja, etc.)
// no tienen pantalla: un negocio con plan reconocido no los recibe.
var MODULOS_IMPLEMENTADOS_ = [
  { clave: 'pack1_ingreso',      nombre: 'Ingreso de mercadería' },
  { clave: 'pack1_hoy',          nombre: 'Resumen del día' },
  { clave: 'pack2_editor_stock', nombre: 'Ajuste de stock' },
  { clave: 'pack2_reportes',     nombre: 'Reportes' },
  { clave: 'extra_fiados',       nombre: 'Fiados (cuentas de clientes)' }
];

// Qué módulo exige cada acción del servidor. Se controla en doGet, así el
// navegador no puede habilitarse un módulo cambiando una variable.
// (vender y venderFiado son la venta del POS: no se bloquean — ver informe.)
var MODULO_POR_ACCION_ = {
  ingresarMercaderia: 'pack1_ingreso',
  ajustarStock:       'pack2_editor_stock',
  getVentas:          'pack2_reportes',
  getVentasDiarias:   'pack2_reportes',
  getEstadisticas:    'pack2_reportes',
  getFiados:          'extra_fiados',
  getFiadosCliente:   'extra_fiados',
  registrarFiado:     'extra_fiados',
  abonarFiado:        'extra_fiados',
  cobrarFiado:        'extra_fiados',
  consultarDeuda:     'extra_fiados',
  getClientes:        'extra_fiados',
  getHistorial:       'extra_fiados',
  getPrestamos:       'extra_prestamos',
  registrarPrestamo:  'extra_prestamos',
  pagarCuotaPrestamo: 'extra_prestamos',
  cancelarPrestamo:   'extra_prestamos',
  registrarMovimientoCaja: 'extra_retiro_caja',
  getMovimientosCaja:      'extra_retiro_caja',
  registrarSalida:         'extra_retiro_caja',
  getSalidas:              'extra_retiro_caja'
};

var PLANES_COLUMNAS_ = ['Plan', 'Nombre', 'Activo', 'Dias_vigencia', 'Dias_tolerancia'];

// ── utilidades ─────────────────────────────────────────────────────

function _normalizarPrefijo_(p) {
  return String(p == null ? '' : p).trim().toUpperCase();
}

function _normalizarPlan_(p) {
  return String(p == null ? '' : p).trim().toUpperCase()
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
}

function _esVerdadero_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'TRUE' || s === 'SI' || s === 'SÍ' || s === 'VERDADERO';
}

// Entero >= 0, o null si está vacío. Devuelve NaN si es inválido.
function _enteroOpcional_(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  var n = Number(v);
  if (!isFinite(n) || n < 0 || Math.floor(n) !== n) return NaN;
  return n;
}

function _hojasDelNegocio_(prefijo) {
  return FAMILIAS_HOJAS_NEGOCIO_.map(function (f) { return f + prefijo; });
}

function _esModuloImplementado_(clave) {
  return MODULOS_IMPLEMENTADOS_.some(function (m) { return m.clave === clave; });
}

// ── verificación de prefijo (sin escribir nada) ────────────────────

function _chequearPrefijoDisponible_(prefijo) {
  var motivos = [];
  if (!new RegExp(PREFIJO_PATRON_).test(prefijo)) {
    return { disponible: false, motivos: ['El prefijo debe tener 2 o 3 letras (A-Z), sin números, espacios ni símbolos'] };
  }
  if (PREFIJOS_RESERVADOS_.indexOf(prefijo) !== -1) {
    motivos.push(prefijo + ' es un prefijo reservado del sistema');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Comparación sin distinguir mayúsculas: Google Sheets no admite dos hojas
  // que difieran solo en mayúsculas/minúsculas.
  var existentes = {};
  ss.getSheets().forEach(function (h) { existentes[String(h.getName()).trim().toUpperCase()] = true; });

  _hojasDelNegocio_(prefijo).forEach(function (nombre) {
    if (HOJAS_SISTEMA_.indexOf(nombre) !== -1) motivos.push(nombre + ' es una hoja del sistema');
    else if (existentes[nombre]) motivos.push('ya existe la hoja ' + nombre);
  });

  ['VENDEDORES', 'CLIENTES_VAO'].forEach(function (nombreHoja) {
    var h = ss.getSheetByName(nombreHoja);
    if (!h) return;
    var datos = h.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (_normalizarPrefijo_(datos[i][0]) === prefijo) { motivos.push('ya está registrado en ' + nombreHoja); break; }
    }
  });

  var props = PropertiesService.getScriptProperties().getProperties();
  var restos = Object.keys(props).filter(function (k) {
    return k === 'PIN_' + prefijo || k === 'MP_TOKEN_' + prefijo || k === 'PRUEBA_7_3_' + prefijo || k.indexOf('SESSION_' + prefijo + '_') === 0;
  });
  if (restos.length) motivos.push('quedan datos de acceso guardados de un negocio anterior con ese prefijo');

  return { disponible: motivos.length === 0, motivos: motivos };
}

// Endpoint admin: ?action=verificarPrefijo&data={token,prefijo}
function verificarPrefijo(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  var r = _chequearPrefijoDisponible_(prefijo);
  return { success: true, prefijo: prefijo, disponible: r.disponible, motivos: r.motivos };
}

// ── planes (hoja PLANES_VAO, editable desde Admin) ─────────────────

var _cachePlanes_ = null; // dura una sola ejecución (un pedido)

function _leerPlanes_() {
  if (_cachePlanes_) return _cachePlanes_;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('PLANES_VAO');
  if (!hoja) { _cachePlanes_ = { existe: false, planes: {}, orden: [] }; return _cachePlanes_; }

  var datos = hoja.getDataRange().getValues();
  var enc = (datos[0] || []).map(function (c) { return String(c).trim(); });
  var col = function (nombre) { return enc.indexOf(nombre); };
  var planes = {}, orden = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var codigo = _normalizarPlan_(f[col('Plan')]);
    if (!codigo) continue;
    var modulos = {}, definidos = {};
    MODULOS_IMPLEMENTADOS_.forEach(function (m) {
      var c = col(m.clave);
      definidos[m.clave] = c !== -1;                       // v029: columna ausente = "no definido", NO es FALSE
      modulos[m.clave] = c !== -1 && _esVerdadero_(f[c]);
    });
    var dv = _enteroOpcional_(f[col('Dias_vigencia')]);
    var dt = _enteroOpcional_(f[col('Dias_tolerancia')]);
    planes[codigo] = {
      codigo:         codigo,
      nombre:         String(f[col('Nombre')] || codigo).trim(),
      activo:         _esVerdadero_(f[col('Activo')]),
      diasVigencia:   (dv === null || isNaN(dv)) ? null : dv,
      diasTolerancia: (dt === null || isNaN(dt)) ? 0 : dt,
      fijo:           codigo === 'PRUEBA',
      definidos:      definidos,
      diasRaw:        f[col('Dias_vigencia')], toleranciaRaw: f[col('Dias_tolerancia')],
      modulos:        modulos,
      fila:           i + 1,
      // v031: datos comerciales (columnas opcionales; si faltan, null = "no configurado")
      precioRegular:     col('Precio_regular') === -1 ? null : _precioOpcional_(f[col('Precio_regular')]),
      precioLanzamiento: col('Precio_lanzamiento') === -1 ? null : _precioOpcional_(f[col('Precio_lanzamiento')]),
      moneda:            col('Moneda') === -1 ? null : (String(f[col('Moneda')] || '').trim().toUpperCase() || null),
      periodo:           col('Periodo_facturacion') === -1 ? null : (String(f[col('Periodo_facturacion')] || '').trim().toUpperCase() || null),
      contratable:       (col('Contratable') === -1 || _vacio_(f[col('Contratable')])) ? null : _esVerdadero_(f[col('Contratable')]),
      visible:           (col('Visible_en_planes') === -1 || _vacio_(f[col('Visible_en_planes')])) ? null : _esVerdadero_(f[col('Visible_en_planes')])
    };
    if (codigo === 'PRUEBA') { planes[codigo].diasVigencia = DIAS_PRUEBA_; planes[codigo].diasTolerancia = DIAS_GRACIA_PRUEBA_; } // v028: fijo
    orden.push(codigo);
  }
  _cachePlanes_ = { existe: true, planes: planes, orden: orden, hoja: hoja, encabezados: enc };
  return _cachePlanes_;
}

// Plan de un negocio: CLIENTES_VAO.F (vista comercial) y, si falta, VENDEDORES.E.
function _planDeNegocio_(prefijo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fuentes = [['CLIENTES_VAO', 5], ['VENDEDORES', 4]];
  for (var k = 0; k < fuentes.length; k++) {
    var h = ss.getSheetByName(fuentes[k][0]);
    if (!h) continue;
    var datos = h.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (_normalizarPrefijo_(datos[i][0]) === prefijo) {
        var p = _normalizarPlan_(datos[i][fuentes[k][1]]);
        if (p) return p;
        break;
      }
    }
  }
  return '';
}

// Regla única de módulos:
//   EFECTIVO = interruptor del negocio (CONFIG_XX) Y permiso del plan (PLANES_VAO)
// - Si el plan del negocio no está en PLANES_VAO (negocios anteriores), el plan
//   no restringe: manda solo CONFIG_XX, exactamente como hasta v024.
// - Con plan reconocido, un módulo sin pantalla nunca queda habilitado.
function _modulosEfectivos_(prefijo, config) {
  var planes = _leerPlanes_();
  var codigo = _planDeNegocio_(prefijo);
  var plan = planes.existe ? planes.planes[codigo] : null;
  var res = {};
  Object.keys(config || {}).forEach(function (k) {
    if (!/^(pack\d+_|extra_)/.test(k)) return;
    var interruptor = config[k] === true || _esVerdadero_(config[k]);
    // v029: si PLANES_VAO no tiene la columna de ese módulo, el plan no lo define
    // y manda CONFIG_XX (como antes). Nunca se apaga algo por una columna ausente.
    var permitido = plan ? (_esModuloImplementado_(k) && (plan.definidos && plan.definidos[k] === false ? true : !!plan.modulos[k])) : true;
    res[k] = interruptor && permitido;
  });
  return { modulos: res, plan: plan, codigoPlan: codigo, planReconocido: !!plan };
}

function _verificarModuloAccion_(prefijo, data, modulo) {
  // Sin sesión válida no se informa nada sobre módulos: la función de
  // destino devuelve su error de sesión habitual.
  if (_requiereSesionValida_(prefijo, (data && data.token) || '')) return null;
  var config;
  try { config = leerConfig(prefijo).config; } catch (e) { return null; }
  var ef = _modulosEfectivos_(prefijo, config);
  if (ef.modulos[modulo] === true) return null;
  return 'Este módulo no está habilitado para tu negocio — contactar a VAO Sistemas';
}

// Endpoint admin: ?action=getPlanes&data={token}
function getPlanes(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var pl = _leerPlanes_();
  return {
    success: true,
    existe: pl.existe,
    planes: pl.orden.map(function (c) {
      var p = pl.planes[c];
      return { codigo: p.codigo, nombre: p.nombre, activo: p.activo, diasVigencia: p.diasVigencia,
               diasTolerancia: p.diasTolerancia, modulos: p.modulos, fijo: !!p.fijo };
    }),
    modulosImplementados: MODULOS_IMPLEMENTADOS_,
    reglasPrefijo: { patron: PREFIJO_PATRON_, reservados: PREFIJOS_RESERVADOS_ }
  };
}

// Valores iniciales SUGERIDOS de los planes (son datos, no reglas: se editan
// desde Admin). Duración vacía = sin vencimiento automático.
function _planesIniciales_() {
  var todos = MODULOS_IMPLEMENTADOS_.map(function (m) { return m.clave; });
  return [
    { codigo: 'PRUEBA', nombre: 'Prueba', modulos: todos },
    { codigo: 'BASICO', nombre: 'Básico', modulos: ['pack1_ingreso', 'pack1_hoy', 'extra_fiados'] }, // v027: Fiados en todos los planes
    { codigo: 'PRO',    nombre: 'Pro',    modulos: todos }
  ];
}

// Qué módulos hoy encendidos dejaría de tener cada negocio existente si se
// crean los planes iniciales. No escribe nada.
function _impactoPlanesIniciales_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hVend = ss.getSheetByName('VENDEDORES');
  var iniciales = {};
  _planesIniciales_().forEach(function (p) { iniciales[p.codigo] = p; });
  var impacto = [];
  if (!hVend) return impacto;
  var datos = hVend.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var prefijo = _normalizarPrefijo_(datos[i][0]);
    if (!prefijo) continue;
    var codigo = _planDeNegocio_(prefijo);
    var plan = iniciales[codigo];
    if (!plan) { impacto.push({ prefijo: prefijo, plan: codigo, reconocido: false, pierde: [] }); continue; }
    var config = {};
    try { config = leerConfig(prefijo).config; } catch (e) {}
    var pierde = MODULOS_IMPLEMENTADOS_.filter(function (m) {
      return _esVerdadero_(config[m.clave]) && plan.modulos.indexOf(m.clave) === -1;
    }).map(function (m) { return m.nombre; });
    impacto.push({ prefijo: prefijo, plan: codigo, reconocido: true, pierde: pierde });
  }
  return impacto;
}

// Endpoint admin: vista previa antes de crear los planes.
function previsualizarPlanes(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  return { success: true, existe: _leerPlanes_().existe, planesIniciales: _planesIniciales_(),
           modulosImplementados: MODULOS_IMPLEMENTADOS_, impacto: _impactoPlanesIniciales_() };
}

// Endpoint admin: crea PLANES_VAO SOLO si no existe (nunca la sobrescribe).
function inicializarPlanes(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('PLANES_VAO')) return { error: 'PLANES_VAO ya existe — no se modifica', yaExiste: true };
  // v034: solo con confirmación explícita y bajo candado (un clic accidental o doble no crea ni pisa nada)
  if (data.confirmar !== true) return { error: 'Falta confirmar la creación de los planes iniciales.' };
  return _conLock_(function () { return _inicializarPlanesSinLock_(data); });
}

function _inicializarPlanesSinLock_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _cachePlanes_ = null;
  if (ss.getSheetByName('PLANES_VAO')) return { error: 'PLANES_VAO ya existe — no se modifica', yaExiste: true }; // se vuelve a mirar dentro del candado
  var claves = MODULOS_IMPLEMENTADOS_.map(function (m) { return m.clave; });
  var filas = [PLANES_COLUMNAS_.concat(claves).concat(['Notas'])];
  _planesIniciales_().forEach(function (p) {
    filas.push([p.codigo, p.nombre, 'TRUE', p.codigo === 'PRUEBA' ? DIAS_PRUEBA_ : '', p.codigo === 'PRUEBA' ? DIAS_GRACIA_PRUEBA_ : 0]
      .concat(claves.map(function (k) { return p.modulos.indexOf(k) !== -1 ? 'TRUE' : 'FALSE'; })).concat(['']));
  });
  var hoja = ss.insertSheet('PLANES_VAO');
  hoja.getRange(1, 1, filas.length, filas[0].length).setValues(filas);
  hoja.getRange(1, 1, 1, filas[0].length).setFontWeight('bold');
  hoja.setFrozenRows(1);
  _cachePlanes_ = null;
  return getPlanes(data);
}

// Endpoint admin: actualiza UN plan existente (no crea ni borra planes).
function guardarPlan(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var p = data.plan || {};
  var codigo = _normalizarPlan_(p.codigo);
  var pl = _leerPlanes_();
  if (!pl.existe) return { error: 'Primero inicializá los planes' };
  var actual = pl.planes[codigo];
  if (!actual) return { error: 'Plan ' + codigo + ' no encontrado' };

  var dv = _enteroOpcional_(p.diasVigencia), dt = _enteroOpcional_(p.diasTolerancia);
  if (isNaN(dv) || isNaN(dt)) return { error: 'Los días deben ser números enteros, 0 o mayores' };
  var nombre = String(p.nombre || '').trim();
  if (!nombre) return { error: 'El plan necesita un nombre' };

  var enc = pl.encabezados, hoja = pl.hoja, fila = actual.fila;
  var escribir = function (col, valor) {
    var c = enc.indexOf(col);
    if (c === -1) { c = enc.length; enc.push(col); hoja.getRange(1, c + 1).setValue(col); }
    hoja.getRange(fila, c + 1).setValue(valor);
  };
  escribir('Nombre', nombre);
  escribir('Activo', p.activo ? 'TRUE' : 'FALSE');
  if (codigo === 'PRUEBA') { escribir('Dias_vigencia', DIAS_PRUEBA_); escribir('Dias_tolerancia', DIAS_GRACIA_PRUEBA_); } // v028: no configurable
  else {
  escribir('Dias_vigencia', dv === null ? '' : dv);
  escribir('Dias_tolerancia', dt === null ? 0 : dt);
  }
  MODULOS_IMPLEMENTADOS_.forEach(function (m) {
    if (p.modulos && m.clave in p.modulos) escribir(m.clave, p.modulos[m.clave] ? 'TRUE' : 'FALSE');
  });
  _cachePlanes_ = null;
  return { success: true, mensaje: '✅ Plan ' + nombre + ' guardado' };
}

// ── alta con reversión ─────────────────────────────────────────────

function _crearHojaVerificada_(ss, nombre, crear, creadas) {
  if (ss.getSheetByName(nombre)) throw new Error('la hoja ' + nombre + ' ya existía — no se reutiliza');
  crear();
  if (!ss.getSheetByName(nombre)) throw new Error('no se pudo crear la hoja ' + nombre);
  creadas.push(nombre);
}

function _crearHojaConEncabezado_(ss, nombre, encabezado) {
  var h = ss.insertSheet(nombre);
  h.getRange(1, 1, 1, encabezado.length).setValues([encabezado]);
  h.getRange(1, 1, 1, encabezado.length).setFontWeight('bold');
}

function _crearNegocio_(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p = d.prefijo, creadas = [], filasAgregadas = [], propsAgregadas = [];
  try {
    _crearHojaVerificada_(ss, 'INVENTARIO_' + p, function () {
      _crearHojaConEncabezado_(ss, 'INVENTARIO_' + p, ['Código','Producto','Stock','P.Costo','P.Venta','Proveedor','Categoría','Relampago','Destacada','Especial','PrecioPromo']);
    }, creadas);
    _crearHojaVerificada_(ss, 'VENTAS_' + p, function () {
      _crearHojaConEncabezado_(ss, 'VENTAS_' + p, ['Fecha','Producto','Cantidad','P.Venta','Modo de pago','Total','VentaId']);
    }, creadas);
    _crearHojaVerificada_(ss, 'CLIENTES_' + p,         function () { crearHojaClientesXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'FIADOS_' + p,           function () { crearHojaFiadosXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'HISTORIAL_' + p,        function () { crearHojaHistorialXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'PRESTAMOS_' + p,        function () { crearHojaPrestamosXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'CAJA_MOVIMIENTOS_' + p, function () { crearHojaCajaMovimientosXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'SALIDAS_' + p,          function () { crearHojaSalidasXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'AJUSTE_RAPIDO_' + p,    function () { crearHojaAjusteRapidoXX(ss, p); }, creadas);
    _crearHojaVerificada_(ss, 'CONFIG_' + p, function () {
      crearHojaConfigDefault(ss, p, d.nombre, d.telefono, d.correo, d.aliasPago);
      // v029: interruptores EXACTAMENTE según PLANES_VAO para el plan elegido.
      var hc = ss.getSheetByName('CONFIG_' + p);
      var dc = hc.getDataRange().getValues();
      for (var i = 1; i < dc.length; i++) {
        var clave = String(dc[i][0]).trim();
        if (_esModuloImplementado_(clave)) hc.getRange(i + 1, 2).setValue(d.modulosPlan[clave] ? 'TRUE' : 'FALSE');
      }
    }, creadas);

    var hVend = ss.getSheetByName('VENDEDORES');
    var filaV = hVend.getLastRow() + 1;
    hVend.getRange(filaV, 1, 1, 11).setValues([[p, d.nombre, d.telefono, d.correo, d.plan, new Date(), 'si', d.comision, d.aliasPago, d.linkMP, '']]);
    filasAgregadas.push(['VENDEDORES', filaV]);

    var hCli = ss.getSheetByName('CLIENTES_VAO');
    if (hCli) {
      var filaC = hCli.getLastRow() + 1;
      hCli.getRange(filaC, 1, 1, 14).setValues([[p, d.nombre, d.contacto, d.telefono, d.correo, d.plan, 'ACTIVO',
        new Date(), d.fechaVence || '', d.aliasPago, d.linkMP, d.tokenMP ? 'CONFIGURADO ✅' : 'PENDIENTE ⚠️', 'CONFIGURADO ✅', d.obs || '']]);
      filasAgregadas.push(['CLIENTES_VAO', filaC]);
    }

    var props = PropertiesService.getScriptProperties();
    if (d.tokenMP) { props.setProperty('MP_TOKEN_' + p, d.tokenMP); propsAgregadas.push('MP_TOKEN_' + p); }
    var pin = generarPinAleatorio();
    props.setProperty('PIN_' + p, _hashFuerte_(pin, p)); // v026
    propsAgregadas.push('PIN_' + p);
    if (d.prueba) { // v028: marca de PRUEBA 7+3 con la fecha de alta del servidor
      props.setProperty('PRUEBA_7_3_' + p, JSON.stringify({ alta: d.prueba.alta.toISOString(), modo: 'alta' }));
      propsAgregadas.push('PRUEBA_7_3_' + p);
    }

    return { success: true, mensaje: '✅ Negocio ' + d.nombre + ' (' + p + ') creado', prefijo: p, pin: pin,
             plan: d.plan, fechaVence: d.fechaVence || null, hojasCreadas: creadas,
             prueba: d.prueba ? { altaTxt: d.prueba.altaTxt, venceTxt: d.prueba.venceTxt, finGraciaTxt: d.prueba.finGraciaTxt } : null };
  } catch (err) {
    // Reversión: se deshace SOLO lo que esta alta creó.
    var pendientes = [];
    var props2 = PropertiesService.getScriptProperties();
    propsAgregadas.forEach(function (k) { try { props2.deleteProperty(k); } catch (e) { pendientes.push('propiedad ' + k); } });
    filasAgregadas.slice().reverse().forEach(function (fa) {
      try {
        var h = ss.getSheetByName(fa[0]);
        if (h && _normalizarPrefijo_(h.getRange(fa[1], 1).getValue()) === p) h.deleteRow(fa[1]);
        else pendientes.push('fila ' + fa[1] + ' de ' + fa[0]);
      } catch (e) { pendientes.push('fila ' + fa[1] + ' de ' + fa[0]); }
    });
    creadas.slice().reverse().forEach(function (nombre) {
      try { var h = ss.getSheetByName(nombre); if (h) ss.deleteSheet(h); } catch (e) { pendientes.push('hoja ' + nombre); }
    });
    Logger.log('Alta de ' + p + ' cancelada: ' + err.message + (pendientes.length ? ' · revisar a mano: ' + pendientes.join(', ') : ''));
    return { error: 'Alta cancelada: ' + err.message + (pendientes.length ? ' — revisar a mano: ' + pendientes.join(', ') : ' — no quedó nada creado'),
             revertido: pendientes.length === 0, pendientesRevision: pendientes };
  }
}

// ── cambio de plan y módulos por negocio ───────────────────────────

function cambiarPlanCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  var codigo = _normalizarPlan_(data.plan);
  // v030: la firma de la vista previa es OBLIGATORIA. Sin ella no se sabe qué vio el Admin.
  if (!data.firma || typeof data.firma !== 'string') return { error: 'Falta la vista previa del cambio: abrila, revisala y confirmá desde ahí.', sinFirma: true };
  return _conLock_(function () {
    var pend = _cambioPlanPendiente_(prefijo);
    if (pend) return { error: 'Hay un cambio de plan sin terminar en ' + prefijo + ' (' + pend.de + ' → ' + pend.a + '). Revisalo en el checkpoint antes de hacer otro.', cambioPendiente: true };
    var pl = _leerPlanes_();
    if (!pl.existe) return { error: 'Primero inicializá los planes' };
    var plan = pl.planes[codigo];
    if (!plan) return { error: 'Plan ' + codigo + ' no encontrado' };
    if (!plan.activo) return { error: 'El plan ' + plan.nombre + ' está inactivo' };
    if (plan.contratable === false) return { error: 'El plan ' + plan.nombre + ' todavía no se puede contratar' }; // v031
    var planActual = _planDeNegocio_(prefijo);
    if (codigo === 'PRUEBA' && planActual !== 'PRUEBA') return { error: 'Un negocio no puede volver a PRUEBA: la prueba gratuita es solo al darlo de alta.' }; // v028
    if (codigo !== planActual) return { error: MSJ_PLAN_POR_PAGO_, requierePago: true }; // v033: solo se re-sincroniza el MISMO plan
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hCli = ss.getSheetByName('CLIENTES_VAO'), hVend = ss.getSheetByName('VENDEDORES');
    if (_filaPrefijo_(hVend, prefijo) === -1) return { error: 'Cliente no encontrado en VENDEDORES' };
    var fC = _filaPrefijo_(hCli, prefijo);
    if (fC === -1) return { error: 'Cliente sin fila en CLIENTES_VAO — ejecutar backfillClientesVao() antes de cambiar el plan' };
    var p = _planificarModulos_(prefijo, codigo);
    if (p.error) return { error: p.error };
    if (data.firma !== p.firma) return { error: 'La configuración cambió desde la vista previa: volvé a revisarla.', firmaVieja: true };

    // Registro ANTES de escribir: si algo se corta, queda dicho qué se iba a hacer.
    var reg = { v: 30, de: planActual, a: codigo, ts: new Date().getTime(),
                cambios: p.cambios.map(function (c) { return { clave: c.clave, nombre: c.nombre, actual: c.actual, nuevo: c.nuevo }; }) };
    PropertiesService.getScriptProperties().setProperty(_claveCambioPlan_(prefijo), JSON.stringify(reg));
    // Orden seguro: en cada paso intermedio el negocio tiene, como mucho, los módulos
    // de ANTES y de DESPUÉS a la vez permitidos por el plan más chico (nunca de más).
    _aplicarCambiosModulos_(prefijo, p.cambios.filter(function (c) { return !c.nuevo; }));  // 1) se apagan
    _escribirPlan_(hVend, prefijo, 5, codigo);                                              // 2) VENDEDORES (E)
    _escribirPlan_(hCli, prefijo, 6, codigo);                                               // 3) CLIENTES_VAO (F) — la que manda
    var aplicado = _aplicarCambiosModulos_(prefijo, p.cambios.filter(function (c) { return c.nuevo; })); // 4) se encienden
    aplicado.cambiados = p.cambios.length;
    PropertiesService.getScriptProperties().deleteProperty(_claveCambioPlan_(prefijo));     // 5) terminado
    _cachePlanes_ = null;

    var aviso = '';
    if (planActual === 'PRUEBA' && codigo !== 'PRUEBA') {
      var fv = _fechaValida_(hCli.getRange(_filaPrefijo_(hCli, prefijo), 9).getValue());
      aviso = 'La fecha de vencimiento sigue siendo la de la prueba (' + (fv ? _fechaTxt_(fv) : 'sin fecha') + '): renová la vigencia del nuevo plan.';
    }
    return { success: true, prefijo: prefijo, plan: codigo, aviso: aviso, modulos: aplicado, contradicciones: p.contradicciones,
             mensaje: '✅ ' + prefijo + ' pasó al plan ' + plan.nombre };
  });
}

function getModulosCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  if (!obtenerInfoCliente(prefijo)) return { error: 'Cliente no encontrado' };
  var config;
  try { config = leerConfig(prefijo).config; } catch (e) { return { error: e.message }; }
  var ef = _modulosEfectivos_(prefijo, config);
  return {
    success: true, prefijo: prefijo, plan: ef.codigoPlan, planReconocido: ef.planReconocido,
    editable: ef.codigoPlan === 'PERSONALIZADO', // v029: solo PERSONALIZADO se edita módulo por módulo
    planNombre: ef.plan ? ef.plan.nombre : '',
    modulos: MODULOS_IMPLEMENTADOS_.map(function (m) {
      return { clave: m.clave, nombre: m.nombre,
               permitidoPorPlan: ef.plan ? !!ef.plan.modulos[m.clave] : null,
               interruptor: config[m.clave] === true || _esVerdadero_(config[m.clave]),
               efectivo: ef.modulos[m.clave] === true };
    })
  };
}

// Prende/apaga UN módulo implementado en CONFIG_XX (configuración particular).
// No permite encender lo que el plan no incluye.
function setModuloCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  var modulo = String(data.modulo || '').trim();
  var activo = data.activo === true;
  if (!_esModuloImplementado_(modulo)) return { error: 'Módulo no disponible: ' + modulo };
  if (!obtenerInfoCliente(prefijo)) return { error: 'Cliente no encontrado' };

  if (_cambioPlanPendiente_(prefijo)) return { error: 'Hay un cambio de plan sin terminar en ' + prefijo + ': revisalo en el checkpoint primero.', cambioPendiente: true }; // v030
  var ef = _modulosEfectivos_(prefijo, {});
  // v029: los planes estándar (PRUEBA, BÁSICO, PRO) no se editan módulo por módulo.
  if (ef.codigoPlan !== 'PERSONALIZADO') {
    return { error: 'Los módulos de ' + (ef.plan ? ef.plan.nombre : (ef.codigoPlan || 'este plan')) + ' los define el plan. Para elegir módulos uno por uno, pasá el negocio a PERSONALIZADO.' };
  }
  if (activo && ef.plan && !ef.plan.modulos[modulo]) {
    return { error: 'El plan ' + ef.plan.nombre + ' no incluye este módulo — cambiá el plan primero' };
  }
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG_' + prefijo);
  if (!hoja) return { error: 'No existe hoja CONFIG_' + prefijo };
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === modulo) {
      hoja.getRange(i + 1, 2).setValue(activo ? 'TRUE' : 'FALSE');
      return getModulosCliente(data);
    }
  }
  hoja.appendRow([modulo, activo ? 'TRUE' : 'FALSE', 'agregado desde Admin (v025)']);
  return getModulosCliente(data);
}


// =====================================================================
// v026 — APRENDIZAJES DE SEBA BALANCE (verificación, hash, intentos)
// =====================================================================

function _conLock_(fn) {
  var lock = LockService.getScriptLock();
  var tiene = false;
  try { tiene = lock.tryLock(10000); } catch (e) { tiene = false; }
  if (!tiene) return { error: 'Sistema ocupado, reintentar', ocupado: true };
  try { return fn(); } finally { lock.releaseLock(); }
}

// Endpoint: ?action=verificarOperacion&prefijo=XX&data={token,tipo,id[,idFiado]}
// SOLO LECTURA. Responde si una operación enviada sin confirmar llegó.
// tipo: 'venta' (VentaId), 'fiado' (idOperacion), 'ingreso' (idOperacion),
//       'pagoFiado' (idOperacion de un abono/cobro + idFiado).
function verificarOperacion(prefijo, data) {
  var errAcceso = _requiereSesionValida_(prefijo, data.token || '');
  if (errAcceso) return { error: errAcceso };
  var tipo = String(data.tipo || '');
  var id = String(data.id || '').trim();
  if (!id || id.length > 80) return { error: 'Identificador inválido' };

  if (tipo === 'venta') {
    var r = _buscarVentaPorId_(getHojaVentas(prefijo), id);
    return { success: true, tipo: tipo, id: id, existe: r.existe, procesados: r.procesados || [] };
  }
  if (tipo === 'fiado') {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FIADOS_' + prefijo);
    var datos = hoja ? hoja.getDataRange().getValues() : [];
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][2]) === id) return { success: true, tipo: tipo, id: id, existe: true };
    }
    var opStr = PropertiesService.getScriptProperties().getProperty('FIADO_OP_' + prefijo + '_' + id);
    var estado = '';
    try { estado = opStr ? (JSON.parse(opStr).estado || '') : ''; } catch (e) { estado = 'ILEGIBLE'; }
    // Si quedó a medias en el servidor no se puede descartar: lo resuelve Confirmar o una revisión.
    return { success: true, tipo: tipo, id: id, existe: false, enProceso: !!estado, estado: estado };  // v027: INICIADA/STOCK_OK/VENTAS_OK los retoma Confirmar
  }
  if (tipo === 'ingreso') {
    var h = _buscarIdOperacionHistorial_(getHojaHistorial(prefijo), id);
    return { success: true, tipo: tipo, id: id, existe: !!h.existe };
  }
  if (tipo === 'pagoFiado') {
    var hf = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FIADOS_' + prefijo);
    var df = hf ? hf.getDataRange().getValues() : [];
    for (var k = 1; k < df.length; k++) {
      if (String(df[k][0]) !== String(data.idFiado || '')) continue;
      return { success: true, tipo: tipo, id: id, existe: String(df[k][13] || '').indexOf(id) !== -1,
               saldo: parseFloat(df[k][8]) || 0, estadoFiado: String(df[k][10] || '') };
    }
    return { success: true, tipo: tipo, id: id, existe: false, fiadoNoEncontrado: true };
  }
  return { error: 'Tipo de operación desconocido' };
}

// ── hash SHA-256 (con migración desde hashSimple) ──────────────────

function _hashFuerte_(texto, contexto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    'VAO2026|' + String(contexto || '') + '|' + String(texto), Utilities.Charset.UTF_8);
  return 'S2$' + bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

function _hashCoincide_(texto, guardado, contexto) {
  guardado = String(guardado || '');
  if (!guardado) return false;
  if (guardado.indexOf('S2$') === 0) return _hashFuerte_(texto, contexto) === guardado;
  return hashSimple(texto) === guardado; // formato viejo: se acepta y se migra al entrar bien
}

// ── límite de intentos de login ────────────────────────────────────

var MINUTOS_BLOQUEO_LOGIN_ = 15;

function _intentosMaxNegocio_(prefijo) {
  try {
    var n = parseInt(leerConfig(prefijo).config.intentos_max, 10);
    if (n >= 3) return n;
  } catch (e) {}
  return 5;
}

function _loginBloqueado_(clave) {
  var raw = PropertiesService.getScriptProperties().getProperty('LOGIN_FALLOS_' + clave);
  if (!raw) return 0;
  try {
    var st = JSON.parse(raw);
    var resto = (st.hasta || 0) - new Date().getTime();
    return resto > 0 ? Math.ceil(resto / 60000) : 0;
  } catch (e) { return 0; }
}

function _registrarFalloLogin_(clave, max) {
  var props = PropertiesService.getScriptProperties();
  var st = { n: 0, hasta: 0 };
  try { st = JSON.parse(props.getProperty('LOGIN_FALLOS_' + clave) || '{"n":0,"hasta":0}'); } catch (e) {}
  st.n = (st.n || 0) + 1;
  if (st.n >= max) { st.n = 0; st.hasta = new Date().getTime() + MINUTOS_BLOQUEO_LOGIN_ * 60000; }
  props.setProperty('LOGIN_FALLOS_' + clave, JSON.stringify(st));
}

function _limpiarFallosLogin_(clave) {
  PropertiesService.getScriptProperties().deleteProperty('LOGIN_FALLOS_' + clave);
}

// =====================================================================
// v028 — VALIDACIONES DE CANTIDAD Y PRECIO (servidor)
// =====================================================================
// Regla comercial de referencia (VAO POS, "💡 Sugerido (+50%)" desde V9):
//   precio de venta mínimo = costo × (1 + recargo_minimo_pct / 100)
//   Es RECARGO sobre el costo, NO margen sobre la venta:
//   recargo 50 % → costo 1000, venta 1500 → margen = 500/1500 = 33,3 %.
// Hasta v027 era solo una sugerencia en pantalla; desde v028 se exige.
// Todos los valores se pueden ajustar por negocio en CONFIG_XX (columna
// campo/valor). Si falta o es inválido se usa el valor seguro de abajo.
var REGLAS_DEFECTO_ = {
  recargo_minimo_pct:       50,        // venta ≥ costo × 1,50
  recargo_maximo_pct:       900,       // venta ≤ costo × 10 (más es sospechoso)
  cantidad_maxima:          5000,      // por ingreso o renglón de venta (bloqueo)
  cantidad_alerta:          200,       // más que esto pide confirmación
  stock_maximo:             100000,    // stock resultante máximo (bloqueo)
  precio_maximo:            10000000,  // precio unitario máximo (bloqueo)
  precio_alerta:            500000,    // sin costo de referencia, más que esto pide confirmación
  cambio_precio_alerta_pct: 50         // cambio de precio de ±50 % o más pide confirmación
};
var REGLAS_RANGO_ = {
  recargo_minimo_pct: [0, 1000], recargo_maximo_pct: [1, 100000], cantidad_maxima: [1, 100000],
  cantidad_alerta: [1, 100000], stock_maximo: [1, 10000000], precio_maximo: [1, 10000000000],
  precio_alerta: [1, 10000000000], cambio_precio_alerta_pct: [1, 10000]
};

function _reglasNegocio_(prefijo) {
  var cfg = {};
  try { cfg = leerConfig(prefijo).config || {}; } catch (e) { cfg = {}; }
  var r = {};
  Object.keys(REGLAS_DEFECTO_).forEach(function (k) {
    var v = cfg[k], n = (v === '' || v === null || v === undefined || v === true || v === false) ? NaN : Number(v);
    var rg = REGLAS_RANGO_[k];
    r[k] = (isFinite(n) && n >= rg[0] && n <= rg[1]) ? n : REGLAS_DEFECTO_[k];
  });
  if (r.cantidad_alerta > r.cantidad_maxima) r.cantidad_alerta = r.cantidad_maxima;
  if (r.recargo_maximo_pct <= r.recargo_minimo_pct) r.recargo_maximo_pct = REGLAS_DEFECTO_.recargo_maximo_pct > r.recargo_minimo_pct ? REGLAS_DEFECTO_.recargo_maximo_pct : r.recargo_minimo_pct * 10;
  if (r.precio_alerta > r.precio_maximo) r.precio_alerta = r.precio_maximo;
  return r;
}

// Entero sin signo ni decimales ("1.5", "-1", "10abc", "1e5" → NaN).
function _parseEntero_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!/^\d{1,9}$/.test(s)) return NaN;
  return Number(s);
}
// Importe: hasta 2 decimales, punto o coma, sin signo ni exponente.
function _parseDinero_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!/^\d{1,12}([.,]\d{1,2})?$/.test(s)) return NaN;
  return Number(s.replace(',', '.'));
}
function _vacio_(v) { return v === null || v === undefined || String(v).trim() === ''; }
function _pesos_(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

// Reglas de precio contra costo. Devuelve texto de error o ''.
function _errorPrecioCosto_(precio, costo, r) {
  if (!(costo > 0) || !(precio > 0)) return '';
  if (precio < costo) return 'El precio de venta (' + _pesos_(precio) + ') es MENOR que el costo (' + _pesos_(costo) + ').';
  var minimo = costo * (1 + r.recargo_minimo_pct / 100);
  if (precio < minimo) return 'El precio de venta (' + _pesos_(precio) + ') está por debajo del mínimo: costo + ' + r.recargo_minimo_pct + ' % = ' + _pesos_(Math.ceil(minimo)) + '.';
  var maximo = costo * (1 + r.recargo_maximo_pct / 100);
  if (precio > maximo) return 'El precio de venta (' + _pesos_(precio) + ') es más de ' + Math.round(maximo / costo) + ' veces el costo (' + _pesos_(costo) + '): revisá si sobra un cero.';
  return '';
}

function _rechazoValidacion_(msg, campo, extra) {
  var r = { success: false, definitivo: true, validacion: true, campo: campo || '', error: msg };
  if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
  return r;
}

// INGRESO. fila = fila actual del INVENTARIO (o null si es nuevo).
function _validarIngreso_(data, fila, r) {
  var cantidad = _parseEntero_(data.cantidad);
  if (isNaN(cantidad)) return _rechazoValidacion_('Cantidad inválida: tiene que ser un número entero, sin decimales ni signos.', 'cantidad');
  if (cantidad < 1) return _rechazoValidacion_('La cantidad tiene que ser 1 o más.', 'cantidad');
  if (cantidad > r.cantidad_maxima) return _rechazoValidacion_('Cantidad ' + cantidad + ' supera el máximo permitido por ingreso (' + r.cantidad_maxima + '). Revisá si sobra un cero.', 'cantidad');

  var costo = null, venta = null;
  if (!_vacio_(data.costo)) {
    costo = _parseDinero_(data.costo);
    if (isNaN(costo) || costo <= 0) return _rechazoValidacion_('Costo inválido: tiene que ser un importe mayor que 0.', 'costo');
    if (costo > r.precio_maximo) return _rechazoValidacion_('Costo ' + _pesos_(costo) + ' fuera de rango (máximo ' + _pesos_(r.precio_maximo) + ').', 'costo');
  }
  if (!_vacio_(data.venta)) {
    venta = _parseDinero_(data.venta);
    if (isNaN(venta) || venta <= 0) return _rechazoValidacion_('Precio de venta inválido: tiene que ser un importe mayor que 0.', 'venta');
    if (venta > r.precio_maximo) return _rechazoValidacion_('Precio de venta ' + _pesos_(venta) + ' fuera de rango (máximo ' + _pesos_(r.precio_maximo) + ').', 'venta');
  }
  var stockAntes = fila ? (parseInt(fila[2]) || 0) : 0;
  if (stockAntes + cantidad > r.stock_maximo) return _rechazoValidacion_('El stock quedaría en ' + (stockAntes + cantidad) + ', más que el máximo (' + r.stock_maximo + ').', 'cantidad');
  if (!fila && venta === null) return _rechazoValidacion_('Producto nuevo: ingresá el precio de venta.', 'venta');

  var precioActual = fila ? (Number(fila[4]) || 0) : 0, costoActual = fila ? (Number(fila[3]) || 0) : 0;
  var precioFinal = venta !== null ? venta : precioActual;
  var costoFinal  = costo !== null ? costo : costoActual;
  // La regla de precio se exige cuando el ingreso toca precio o costo (no se
  // bloquea el stock de un producto viejo que ya estaba mal de precio).
  if (venta !== null || costo !== null) {
    var e = _errorPrecioCosto_(precioFinal, costoFinal, r);
    if (e) return _rechazoValidacion_(e + (venta === null ? ' Con el costo nuevo tenés que actualizar el precio de venta.' : ''), venta === null ? 'venta' : 'venta',
      { precioMinimo: costoFinal > 0 ? Math.ceil(costoFinal * (1 + r.recargo_minimo_pct / 100)) : 0 });
  }
  var pide = [];
  if (cantidad > r.cantidad_alerta && data.confirmarCantidad !== true) pide.push('cantidad');
  if (venta !== null && fila && precioActual > 0 && venta !== precioActual &&
      Math.abs(venta / precioActual - 1) * 100 >= r.cambio_precio_alerta_pct && data.confirmarPrecio !== true) pide.push('precio');
  if (venta !== null && !(costoFinal > 0) && venta > r.precio_alerta && data.confirmarPrecio !== true && pide.indexOf('precio') === -1) pide.push('precio');
  if (pide.length) {
    return _rechazoValidacion_('Hace falta confirmar: ' + pide.map(function (p) {
      return p === 'cantidad' ? 'cantidad grande (' + cantidad + ')' : (precioActual > 0 && fila ? 'cambio de precio de ' + _pesos_(precioActual) + ' a ' + _pesos_(venta) : 'precio alto (' + _pesos_(venta) + ')');
    }).join(' y ') + '.', pide[0], { requiereConfirmacion: pide });
  }
  return { ok: true, cantidad: cantidad, costo: costo, venta: venta };
}

// AJUSTE. filaActual = fila del INVENTARIO antes de tocarla.
function _validarAjuste_(data, filaActual, r) {
  var stockAntes = Number(filaActual[2]) || 0, precioAntes = Number(filaActual[4]) || 0, costo = Number(filaActual[3]) || 0;
  var res = { cambiaPrecio: false, nuevoPrecio: precioAntes };
  if (!_vacio_(data.stock)) {
    var st = _parseEntero_(data.stock);
    if (isNaN(st)) return _rechazoValidacion_('Stock inválido: tiene que ser un número entero, 0 o más.', 'stock');
    if (st > r.stock_maximo) return _rechazoValidacion_('Stock ' + st + ' supera el máximo (' + r.stock_maximo + '). Revisá si sobra un cero.', 'stock');
    res.nuevoStock = st;
  }
  if (!_vacio_(data.precio)) {
    var pr = _parseDinero_(data.precio);
    if (isNaN(pr) || pr <= 0) return _rechazoValidacion_('Precio inválido: tiene que ser un importe mayor que 0.', 'precio');
    if (pr > r.precio_maximo) return _rechazoValidacion_('Precio ' + _pesos_(pr) + ' fuera de rango (máximo ' + _pesos_(r.precio_maximo) + ').', 'precio');
    if (pr !== precioAntes) {
      var e = _errorPrecioCosto_(pr, costo, r);
      if (e) return _rechazoValidacion_(e, 'precio', { precioMinimo: costo > 0 ? Math.ceil(costo * (1 + r.recargo_minimo_pct / 100)) : 0 });
      res.cambiaPrecio = true; res.nuevoPrecio = pr;
    }
  }
  var pide = [];
  if (res.nuevoStock !== undefined && res.nuevoStock !== Number(data.stockOriginal) &&
      Math.abs(res.nuevoStock - stockAntes) > r.cantidad_alerta && data.confirmarCantidad !== true) pide.push('cantidad');
  if (res.cambiaPrecio && precioAntes > 0 && Math.abs(res.nuevoPrecio / precioAntes - 1) * 100 >= r.cambio_precio_alerta_pct && data.confirmarPrecio !== true) pide.push('precio');
  if (res.cambiaPrecio && !(costo > 0) && res.nuevoPrecio > r.precio_alerta && data.confirmarPrecio !== true && pide.indexOf('precio') === -1) pide.push('precio');
  if (pide.length) {
    return _rechazoValidacion_('Hace falta confirmar: ' + pide.map(function (p) {
      return p === 'cantidad' ? 'cambio grande de stock (' + stockAntes + ' → ' + res.nuevoStock + ')' : 'cambio de precio de ' + _pesos_(precioAntes) + ' a ' + _pesos_(res.nuevoPrecio);
    }).join(' y ') + '.', pide[0], { requiereConfirmacion: pide });
  }
  res.ok = true;
  return res;
}

// VENTAS (normal y fiada): cantidades enteras dentro del rango y precios válidos.
// Precio 0 se permite (es el "🎁 Regalo" del POS).
function _errorItemsVenta_(items, r) {
  if (!items || !items.length) return 'El carrito está vacío.';
  for (var i = 0; i < items.length; i++) {
    var it = items[i], nombre = String(it.name || ('id ' + it.id)).trim().toUpperCase();
    var q = _parseEntero_(it.qty);
    if (isNaN(q) || q < 1) return nombre + ': cantidad inválida (' + it.qty + ').';
    if (q > r.cantidad_maxima) return nombre + ': cantidad ' + q + ' supera el máximo (' + r.cantidad_maxima + ').';
    if (!_vacio_(it.precioVenta)) {
      var p = _parseDinero_(it.precioVenta);
      if (isNaN(p)) return nombre + ': precio inválido (' + it.precioVenta + ').';
      if (p > r.precio_maximo) return nombre + ': precio ' + _pesos_(p) + ' fuera de rango.';
    }
  }
  return '';
}

// =====================================================================
// v028 — PLAN PRUEBA: 7 DÍAS + 3 DE GRACIA (FIJO, NO CONFIGURABLE)
// =====================================================================
// Día 1 = día del alta (fecha del SERVIDOR). Días 1–7: ACTIVA. Días 8–10:
// GRACIA (sigue operando, con aviso). Desde el día 11: VENCIDA → se bloquean
// las escrituras desde el servidor; se puede entrar, consultar y exportar.
// Nunca se borra nada. Solo rige para PRUEBA "regularizadas": las creadas
// por v028 o las que Admin regularizó (marca PRUEBA_7_3_XX). Las PRUEBA
// anteriores siguen como estaban y Admin las muestra para regularizar.
var DIAS_PRUEBA_ = 7, DIAS_GRACIA_PRUEBA_ = 3;
var ACCIONES_ESCRITURA_ = ['vender', 'venderFiado', 'ingresarMercaderia', 'ajustarStock', 'registrarFiado', 'abonarFiado',
  'cobrarFiado', 'registrarPrestamo', 'pagarCuotaPrestamo', 'cancelarPrestamo', 'registrarMovimientoCaja', 'registrarSalida'];

function _diaSolo_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function _sumarDias_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function _fechaTxt_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); }
function _fechaValida_(v) { if (!v) return null; var d = (v instanceof Date) ? v : new Date(v); return isNaN(d.getTime()) ? null : d; }

function _calcularPrueba_(alta) {
  var a = _diaSolo_(alta), hoy = _diaSolo_(new Date());
  var dia = Math.floor((hoy.getTime() - a.getTime()) / 86400000 + 0.5) + 1;
  var ultimoActivo = _sumarDias_(a, DIAS_PRUEBA_ - 1), ultimoGracia = _sumarDias_(a, DIAS_PRUEBA_ + DIAS_GRACIA_PRUEBA_ - 1);
  return { alta: a, dia: dia, vence: ultimoActivo, finGracia: ultimoGracia,
           estado: dia <= DIAS_PRUEBA_ ? 'ACTIVA' : (dia <= DIAS_PRUEBA_ + DIAS_GRACIA_PRUEBA_ ? 'GRACIA' : 'VENCIDA'),
           altaTxt: _fechaTxt_(a), venceTxt: _fechaTxt_(ultimoActivo), finGraciaTxt: _fechaTxt_(ultimoGracia) };
}

function _filaClientesVao_(prefijo) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO');
  if (!h) return null;
  var datos = h.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) if (_normalizarPrefijo_(datos[i][0]) === prefijo) return { hoja: h, fila: i + 1, datos: datos[i] };
  return null;
}

// null si el negocio no es PRUEBA.
function _estadoPrueba_(prefijo) {
  if (_planDeNegocio_(prefijo) !== 'PRUEBA') return null;
  var marca = PropertiesService.getScriptProperties().getProperty('PRUEBA_7_3_' + prefijo);
  if (marca) {
    var m = {}; try { m = JSON.parse(marca); } catch (e) {}
    var alta = _fechaValida_(m.alta);
    if (alta) { var c = _calcularPrueba_(alta); c.regularizada = true; return c; }
  }
  // PRUEBA anterior a v028: no se aplica la regla todavía; se describe la diferencia.
  var fc = _filaClientesVao_(prefijo);
  var altaOrig = fc ? _fechaValida_(fc.datos[7]) : null, venceOrig = fc ? _fechaValida_(fc.datos[8]) : null;
  var base = altaOrig || new Date();
  var prop = _calcularPrueba_(base);
  var difs = [];
  if (!altaOrig) difs.push('sin fecha de alta válida (se tomaría hoy)');
  if (!venceOrig) difs.push('sin fecha de vencimiento');
  else if (_diaSolo_(venceOrig).getTime() !== prop.vence.getTime()) difs.push('vence ' + _fechaTxt_(venceOrig) + ' (con la regla: ' + prop.venceTxt + ')');
  return { regularizada: false, discrepancia: difs.length ? difs.join(' · ') : 'fechas coinciden con la regla, falta confirmarla',
           propuesta: { altaTxt: prop.altaTxt, venceTxt: prop.venceTxt, finGraciaTxt: prop.finGraciaTxt, estado: prop.estado, dia: prop.dia, conservaAlta: !!altaOrig },
           venceActualTxt: venceOrig ? _fechaTxt_(venceOrig) : '' };
}

// Endpoint admin: vista previa (sin confirmar) o aplicación (confirmar:true).
function regularizarPrueba(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  var ep = _estadoPrueba_(prefijo);
  if (!ep) return { error: prefijo + ' no está en plan PRUEBA' };
  if (ep.regularizada) return { error: prefijo + ' ya está regularizada (prueba hasta ' + ep.venceTxt + ', gracia hasta ' + ep.finGraciaTxt + ')' };
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, prefijo: prefijo, discrepancia: ep.discrepancia, propuesta: ep.propuesta, venceActualTxt: ep.venceActualTxt };
  var fc = _filaClientesVao_(prefijo);
  if (!fc) return { error: 'Cliente sin fila en CLIENTES_VAO' };
  var altaOrig = _fechaValida_(fc.datos[7]);
  var alta = _diaSolo_(altaOrig || new Date());
  var c = _calcularPrueba_(alta);
  if (!altaOrig) fc.hoja.getRange(fc.fila, 8).setValue(alta);          // H = Fecha Alta (solo si no era válida)
  fc.hoja.getRange(fc.fila, 9).setValue(c.vence);                      // I = Fecha Vence = último día de prueba
  PropertiesService.getScriptProperties().setProperty('PRUEBA_7_3_' + prefijo, JSON.stringify({ alta: alta.toISOString(), modo: 'regularizada', el: new Date().toISOString() }));
  _cachePlanes_ = null;
  return { success: true, prefijo: prefijo, estado: c.estado, dia: c.dia, altaTxt: c.altaTxt, venceTxt: c.venceTxt, finGraciaTxt: c.finGraciaTxt,
           mensaje: '✅ ' + prefijo + ' regularizada: prueba hasta ' + c.venceTxt + ', gracia hasta ' + c.finGraciaTxt + ' (hoy: ' + c.estado + ')' };
}

// Bloqueo de escrituras para PRUEBA vencida (se llama desde el ruteo).
function _bloqueoPruebaVencida_(prefijo, action, data) {
  if (_requiereSesionValida_(prefijo, (data && data.token) || '')) return null; // sin sesión: error habitual de la función
  var ep = _estadoPrueba_(prefijo);
  if (!ep || !ep.regularizada || ep.estado !== 'VENCIDA') return null;
  // Lo que se empezó antes del vencimiento se puede verificar/terminar (no son operaciones nuevas).
  try {
    if (action === 'vender' && data.ventaId && _buscarVentaPorId_(getHojaVentas(prefijo), String(data.ventaId)).existe) return null;
    if (action === 'venderFiado' && data.idOperacion &&
        (PropertiesService.getScriptProperties().getProperty('FIADO_OP_' + prefijo + '_' + data.idOperacion) ||
         _filaTicketFiado_(getHojaFiados(prefijo), String(data.idOperacion)))) return null;
    if (action === 'ingresarMercaderia' && data.idOperacion && _buscarIdOperacionHistorial_(getHojaHistorial(prefijo), String(data.idOperacion)).existe) return null;
  } catch (e) {}
  var msg = '🔒 La prueba gratuita terminó el ' + ep.finGraciaTxt + '. Tus datos están guardados y podés consultarlos y descargarlos; para seguir vendiendo hay que pasar a un plan. Contactá a VAO Sistemas.';
  var r = { success: false, definitivo: true, pruebaVencida: true, error: msg };
  if (action === 'vender') { delete r.error; r.procesados = []; r.bloqueados = []; r.errores = [msg]; } // formato "definitivo" que entiende el POS
  return r;
}

// Consulta/exportación de los datos propios (también con la prueba vencida).
function exportarDatos(prefijo, token) {
  var err = _requiereSesionValida_(prefijo, token);
  if (err) return { error: err };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leer = function (n) { var h = ss.getSheetByName(n + prefijo); return h ? h.getDataRange().getDisplayValues() : []; };
  return { success: true, prefijo: prefijo, generado: new Date().toISOString(),
           inventario: leer('INVENTARIO_'), ventas: leer('VENTAS_'), fiados: leer('FIADOS_') };
}

// Una sola prueba por persona: mismo teléfono (últimos 8 dígitos) o correo.
function _pruebaYaUsada_(telefono, correo) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO');
  if (!h) return '';
  var tel = String(telefono || '').replace(/\D/g, ''), mail = String(correo || '').trim().toLowerCase();
  var t8 = tel.length >= 8 ? tel.slice(-8) : '';
  var datos = h.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var t = String(datos[i][3] || '').replace(/\D/g, ''), m = String(datos[i][4] || '').trim().toLowerCase();
    if ((t8 && t.length >= 8 && t.slice(-8) === t8) || (mail && m === mail)) return _normalizarPrefijo_(datos[i][0]);
  }
  return '';
}


// =====================================================================
// v029 — UNA SOLA CONFIGURACIÓN COHERENTE DE MÓDULOS
// =====================================================================
// PLANES_VAO dice qué módulos incluye cada plan estándar (PRUEBA, BÁSICO, PRO).
// CONFIG_XX guarda los interruptores del negocio. En planes estándar deben
// coincidir con el plan; en PERSONALIZADO cada módulo se elige dentro de lo
// que PLANES_VAO permita para ese plan.
// Ventas, cobro, ticket y buscador son ESENCIALES: siempre encendidos (leerConfig).
// El checkpoint SOLO LEE. Sincronizar exige confirmación y la "firma" de lo visto.
var PLANES_ESTANDAR_ = ['PRUEBA', 'BASICO', 'PRO'];

function _firma_(obj) { return hashSimple(JSON.stringify(obj)); }

function _interruptoresConfig_(prefijo) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG_' + prefijo);
  if (!h) return null;
  var datos = h.getDataRange().getValues(), res = {};
  for (var i = 1; i < datos.length; i++) {
    var k = String(datos[i][0] || '').trim();
    if (_esModuloImplementado_(k)) res[k] = _esVerdadero_(datos[i][1]);
  }
  return res;
}

// Qué interruptores habría que cambiar para que CONFIG_XX quede según el plan.
function _planificarModulos_(prefijo, codigoDestino) {
  var pl = _leerPlanes_();
  if (!pl.existe) return { error: 'Primero inicializá los planes' };
  var plan = pl.planes[codigoDestino];
  if (!plan) return { error: 'Plan ' + (codigoDestino || '(sin plan)') + ' no está en PLANES_VAO' };
  var cfg = _interruptoresConfig_(prefijo);
  if (!cfg) return { error: 'No existe CONFIG_' + prefijo };
  var cambios = [], noDefinidos = [], contradicciones = [];
  var estandar = PLANES_ESTANDAR_.indexOf(codigoDestino) !== -1;
  MODULOS_IMPLEMENTADOS_.forEach(function (m) {
    var actual = (m.clave in cfg) ? cfg[m.clave] : null;    // null = falta la fila en CONFIG
    if (!plan.definidos[m.clave]) { noDefinidos.push(m.nombre); return; } // no se toca lo que el plan no define
    // v030: PRUEBA, BÁSICO y PRO incluyen Fiados completos (decisión 15/10). Si PLANES_VAO
    // dice otra cosa, se informa y NO se apaga Fiados en ningún negocio por esa planilla.
    if (estandar && m.clave === MODULO_FIADOS_ && !plan.modulos[m.clave]) {
      contradicciones.push({ clave: m.clave, nombre: m.nombre, enConfig: actual,
        mensaje: 'PLANES_VAO dice que ' + plan.nombre + ' NO incluye Fiados, pero la regla es que PRUEBA, BÁSICO y PRO incluyen Fiados completos. ' +
                 'No se apaga ni se cambia nada: corregí PLANES_VAO en 🧩 Planes y volvé a revisar.' });
      return;
    }
    var nuevo;
    if (codigoDestino === 'PERSONALIZADO') nuevo = plan.modulos[m.clave] ? !!actual : false; // se conserva lo elegido, dentro del tope
    else nuevo = !!plan.modulos[m.clave];
    if (actual !== nuevo) cambios.push({ clave: m.clave, nombre: m.nombre, actual: actual, nuevo: nuevo });
  });
  var planActual = _planDeNegocio_(prefijo);
  return { plan: plan, planActual: planActual, cambios: cambios, noDefinidos: noDefinidos, contradicciones: contradicciones,
           firma: _firma_([prefijo, planActual, codigoDestino, cambios, contradicciones.map(function (c) { return c.clave; })]) };
}

function _aplicarCambiosModulos_(prefijo, cambios) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG_' + prefijo);
  var datos = h.getDataRange().getValues();
  cambios.forEach(function (c) {
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).trim() === c.clave) { h.getRange(i + 1, 2).setValue(c.nuevo ? 'TRUE' : 'FALSE'); return; }
    }
    h.appendRow([c.clave, c.nuevo ? 'TRUE' : 'FALSE', 'agregado al sincronizar con el plan (v029)']);
  });
  var cfg = _interruptoresConfig_(prefijo);
  var activos = [], inactivos = [];
  MODULOS_IMPLEMENTADOS_.forEach(function (m) { (cfg[m.clave] ? activos : inactivos).push(m.nombre); });
  return { activos: activos, inactivos: inactivos, cambiados: cambios.length };
}

function _checkpointUno_(prefijo) {
  var codigo = _planDeNegocio_(prefijo);
  var fc = _filaClientesVao_(prefijo);
  var planCli = fc ? _normalizarPlan_(fc.datos[5]) : '';
  var hV = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VENDEDORES');
  var planVend = '';
  if (hV) { var dv = hV.getDataRange().getValues(); for (var i = 1; i < dv.length; i++) if (_normalizarPrefijo_(dv[i][0]) === prefijo) { planVend = _normalizarPlan_(dv[i][4]); break; } }
  var r = { prefijo: prefijo, plan: codigo, avisos: [] };
  var pend = _cambioPlanPendiente_(prefijo);
  if (pend) { // v030: un cambio de plan se cortó a mitad de camino
    var rec = _estadoRecuperacion_(prefijo, pend);
    r.estado = 'CAMBIO_INCOMPLETO'; r.cambioPendiente = rec; r.diferencias = [];
    r.avisos.push('Un cambio de plan ' + pend.de + ' → ' + pend.a + ' quedó sin terminar. Elegí completarlo o revertirlo.');
    return r;
  }
  r.prueba = _resumenPrueba_(prefijo); // v030: PRUEBA regularizada o pendiente de regularizar
  if (planCli && planVend && planCli !== planVend) r.avisos.push('El plan no coincide: CLIENTES_VAO dice ' + planCli + ' y VENDEDORES dice ' + planVend + ' (se usa ' + codigo + ').');
  var p = _planificarModulos_(prefijo, codigo);
  if (p.error) { r.estado = 'NO_SE_PUEDE'; r.avisos.push(p.error); r.diferencias = []; return r; }
  r.planNombre = p.plan.nombre;
  r.diferencias = p.cambios.map(function (c) { return { clave: c.clave, nombre: c.nombre, enConfig: c.actual, segunPlan: c.nuevo }; });
  if (p.noDefinidos.length) r.avisos.push('PLANES_VAO no define para ' + p.plan.nombre + ': ' + p.noDefinidos.join(', ') + ' (se deja como está).');
  r.contradicciones = p.contradicciones;
  // v030: Fiados siempre a la vista: CONFIG, PLANES_VAO y la regla.
  var cfg = _interruptoresConfig_(prefijo) || {};
  var enCfg = (MODULO_FIADOS_ in cfg) ? cfg[MODULO_FIADOS_] : null;
  var enPlanilla = p.plan.definidos[MODULO_FIADOS_] ? !!p.plan.modulos[MODULO_FIADOS_] : null;
  var reglaAplica = PLANES_ESTANDAR_.indexOf(codigo) !== -1;
  r.fiados = { enConfig: enCfg, enPlanilla: enPlanilla, regla: reglaAplica ? true : null,
               ok: reglaAplica ? (enPlanilla === true && enCfg === true) : true };
  if (reglaAplica && enPlanilla === false) r.fiados.mensaje = 'PLANES_VAO no incluye Fiados en ' + p.plan.nombre + ' y la regla dice que sí. Mientras no se corrija la planilla, este negocio no ve la pantalla de Fiados.';
  else if (reglaAplica && enPlanilla === null) r.fiados.mensaje = 'PLANES_VAO no tiene la columna de Fiados.';
  else if (reglaAplica && enCfg !== true) r.fiados.mensaje = 'Fiados está apagado en CONFIG_' + prefijo + ': se enciende al sincronizar.';
  r.estado = r.diferencias.length ? 'DIFERENCIAS' : (p.contradicciones.length ? 'REVISAR_PLAN' : 'COINCIDE');
  r.firma = p.firma;
  return r;
}

// Endpoint admin, SOLO LECTURA: un negocio (prefijo) o todos.
function checkpointModulos(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var lista = [];
  if (data.prefijo) lista = [_normalizarPrefijo_(data.prefijo)];
  else {
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('VENDEDORES');
    var dv = h ? h.getDataRange().getValues() : [];
    for (var i = 1; i < dv.length; i++) { var p = _normalizarPrefijo_(dv[i][0]); if (p) lista.push(p); }
  }
  var negocios = lista.map(_checkpointUno_);
  return { success: true, soloLectura: true, negocios: negocios,
           resumen: { // v030
             pruebasSinRegularizar: negocios.filter(function (n) { return n.prueba && !n.prueba.regularizada; }).map(function (n) { return n.prefijo; }),
             fiadosConDiferencia: negocios.filter(function (n) { return n.fiados && !n.fiados.ok; }).map(function (n) { return n.prefijo; }),
             cambiosIncompletos: negocios.filter(function (n) { return n.estado === 'CAMBIO_INCOMPLETO'; }).map(function (n) { return n.prefijo; }) } };
}

// Endpoint admin: aplica lo que mostró el checkpoint (confirmar + misma firma).
function sincronizarModulos(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  if (data.confirmar !== true) return { error: 'Falta la confirmación' };
  return _conLock_(function () {
    if (_cambioPlanPendiente_(prefijo)) return { error: 'Hay un cambio de plan sin terminar en ' + prefijo + ': completalo o revertilo primero.', cambioPendiente: true }; // v030
    var codigo = _planDeNegocio_(prefijo);
    var p = _planificarModulos_(prefijo, codigo);
    if (p.error) return { error: p.error };
    if (data.firma !== p.firma) return { error: 'La configuración cambió desde que la revisaste: volvé a abrir el checkpoint.' };
    var res = _aplicarCambiosModulos_(prefijo, p.cambios);
    res.success = true; res.prefijo = prefijo; res.plan = codigo;
    res.mensaje = '✅ ' + prefijo + ' sincronizado con ' + p.plan.nombre + ' (' + p.cambios.length + ' cambio' + (p.cambios.length === 1 ? '' : 's') + ')';
    return res;
  });
}

// Endpoint admin, SOLO LECTURA: qué cambiaría al pasar a otro plan.
function previsualizarCambioPlan(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo), destino = _normalizarPlan_(data.plan);
  var actual = _planDeNegocio_(prefijo);
  if (destino === 'PRUEBA' && actual !== 'PRUEBA') return { error: 'Un negocio no puede volver a PRUEBA: la prueba gratuita es solo al darlo de alta.' };
  if (destino !== actual) return { error: MSJ_PLAN_POR_PAGO_, requierePago: true }; // v033
  if (_cambioPlanPendiente_(prefijo)) return { error: 'Hay un cambio de plan sin terminar en ' + prefijo + ': revisalo en el checkpoint primero.', cambioPendiente: true }; // v030
  var p = _planificarModulos_(prefijo, destino);
  if (p.error) return { error: p.error };
  if (!p.plan.activo) return { error: 'El plan ' + p.plan.nombre + ' está inactivo' };
  if (p.plan.contratable === false) return { error: 'El plan ' + p.plan.nombre + ' todavía no se puede contratar' }; // v031
  return { success: true, soloLectura: true, prefijo: prefijo, planActual: actual, planNuevo: destino, planNombre: p.plan.nombre,
           seActivan: p.cambios.filter(function (c) { return c.nuevo; }).map(function (c) { return c.nombre; }),
           seDesactivan: p.cambios.filter(function (c) { return !c.nuevo; }).map(function (c) { return c.nombre; }),
           noDefinidos: p.noDefinidos, contradicciones: p.contradicciones, firma: p.firma,
           avisoVigencia: actual === 'PRUEBA' && destino !== 'PRUEBA' ? 'Después de cambiar, renová la vigencia del nuevo plan (la fecha de la prueba no cambia sola).' : '' };
}

// Endpoint admin, SOLO LECTURA: estado de la tabla de planes.
function checkpointPlanes(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var pl = _leerPlanes_();
  if (!pl.existe) return { success: true, existe: false, avisos: ['No existe PLANES_VAO'] };
  var avisos = [], corregible = false;
  var pr = pl.planes.PRUEBA;
  if (pr && (Number(pr.diasRaw) !== DIAS_PRUEBA_ || Number(pr.toleranciaRaw) !== DIAS_GRACIA_PRUEBA_)) {
    avisos.push('PRUEBA en la hoja dice ' + (pr.diasRaw === '' ? '(vacío)' : pr.diasRaw) + ' días / ' + (pr.toleranciaRaw === '' ? '(vacío)' : pr.toleranciaRaw) +
      ' de gracia. La regla obligatoria es 7 + 3 (el sistema ya la aplica; se puede corregir la hoja).');
    corregible = true;
  }
  var fiadosFaltan = [];
  pl.orden.forEach(function (c) {
    var p = pl.planes[c];
    var faltan = MODULOS_IMPLEMENTADOS_.filter(function (m) { return !p.definidos[m.clave]; }).map(function (m) { return m.nombre; });
    if (faltan.length) avisos.push(p.nombre + ': falta definir ' + faltan.join(', ') + ' (columna ausente en PLANES_VAO).');
    // v030: PRUEBA, BÁSICO y PRO incluyen Fiados completos.
    if (PLANES_ESTANDAR_.indexOf(c) !== -1 && p.definidos[MODULO_FIADOS_] && !p.modulos[MODULO_FIADOS_]) {
      fiadosFaltan.push(c);
      avisos.push(p.nombre + ': PLANES_VAO NO incluye Fiados. La regla es que PRUEBA, BÁSICO y PRO incluyen Fiados completos.');
    }
  });
  return { success: true, existe: true, avisos: avisos, corregiblePrueba: corregible, fiadosFaltan: fiadosFaltan,
           corregibleFijos: corregible || fiadosFaltan.length > 0, tienePersonalizado: !!pl.planes.PERSONALIZADO,
           planes: pl.orden.map(function (c) { var p = pl.planes[c]; return { codigo: c, nombre: p.nombre, modulos: p.modulos, definidos: p.definidos }; }) };
}

// Endpoint admin: escribe 7 y 3 en la fila PRUEBA de PLANES_VAO (con confirmación).
function corregirPlanesFijos(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  if (data.confirmar !== true) return { error: 'Falta la confirmación' };
  var pl = _leerPlanes_();
  if (!pl.existe || !pl.planes.PRUEBA) return { error: 'No hay fila PRUEBA en PLANES_VAO' };
  var c1 = pl.encabezados.indexOf('Dias_vigencia'), c2 = pl.encabezados.indexOf('Dias_tolerancia'), f = pl.planes.PRUEBA.fila;
  if (c1 !== -1) pl.hoja.getRange(f, c1 + 1).setValue(DIAS_PRUEBA_);
  if (c2 !== -1) pl.hoja.getRange(f, c2 + 1).setValue(DIAS_GRACIA_PRUEBA_);
  // v030: Fiados incluido en PRUEBA, BÁSICO y PRO. Solo la planilla de planes: ningún CONFIG_XX cambia.
  var cF = pl.encabezados.indexOf(MODULO_FIADOS_), conFiados = [];
  if (cF !== -1) PLANES_ESTANDAR_.forEach(function (c) {
    var p = pl.planes[c];
    if (p && !p.modulos[MODULO_FIADOS_]) { pl.hoja.getRange(p.fila, cF + 1).setValue('TRUE'); conFiados.push(p.nombre); }
  });
  _cachePlanes_ = null;
  return { success: true, fiadosAgregados: conFiados,
           mensaje: '✅ PRUEBA en PLANES_VAO: 7 días + 3 de gracia' + (conFiados.length ? ' · Fiados incluido en ' + conFiados.join(', ') + ' (los negocios se revisan uno por uno en su checkpoint)' : '') };
}

// Endpoint admin: agrega la fila PERSONALIZADO (con confirmación). El tope son
// los módulos que existen hoy; qué tiene cada negocio se elige en su ficha.
function agregarPlanPersonalizado(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  if (data.confirmar !== true) return { error: 'Falta la confirmación' };
  var pl = _leerPlanes_();
  if (!pl.existe) return { error: 'Primero inicializá los planes' };
  if (pl.planes.PERSONALIZADO) return { error: 'PERSONALIZADO ya existe' };
  var fila = pl.encabezados.map(function (h) {
    if (h === 'Plan') return 'PERSONALIZADO';
    if (h === 'Nombre') return 'Personalizado';
    if (h === 'Activo') return 'TRUE';
    if (h === 'Dias_tolerancia') return 0;
    if (h === 'Notas') return 'Módulos elegidos uno por uno en la ficha del negocio';
    if (_esModuloImplementado_(h)) return 'TRUE';
    return '';
  });
  pl.hoja.appendRow(fila);
  _cachePlanes_ = null;
  return { success: true, mensaje: '✅ Plan PERSONALIZADO agregado' };
}


// =====================================================================
// v030 — CAMBIO DE PLAN SEGURO Y RECUPERABLE
// =====================================================================
// Antes de escribir, cambiarPlanCliente deja un registro (propiedad CAMBIO_PLAN_XX)
// con el plan de origen, el de destino y cada interruptor (antes → después).
// Si la ejecución se corta, el negocio queda marcado "CAMBIO_INCOMPLETO" en el
// checkpoint y no se acepta otro cambio hasta que Admin elija COMPLETAR o REVERTIR.
// La recuperación compara lo que HAY con lo que tiene que haber: solo escribe lo
// que falta, así que repetirla no duplica nada.
var MODULO_FIADOS_ = 'extra_fiados';

function _claveCambioPlan_(prefijo) { return 'CAMBIO_PLAN_' + prefijo; }

function _cambioPlanPendiente_(prefijo) {
  var v = PropertiesService.getScriptProperties().getProperty(_claveCambioPlan_(prefijo));
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return { de: '?', a: '?', cambios: [], ilegible: true }; }
}

function _filaPrefijo_(h, prefijo) {
  if (!h) return -1;
  var datos = h.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) if (_normalizarPrefijo_(datos[i][0]) === prefijo) return i + 1;
  return -1;
}

function _escribirPlan_(h, prefijo, col, codigo) {
  var f = _filaPrefijo_(h, prefijo);
  if (f === -1) throw new Error('No se encontró ' + prefijo + ' en ' + h.getName());
  if (_normalizarPlan_(h.getRange(f, col).getValue()) !== codigo) h.getRange(f, col).setValue(codigo);
}

// Qué falta para llegar a "completar" y a "revertir" (solo lectura).
function _estadoRecuperacion_(prefijo, reg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leerPlan = function (nombre, col) {
    var h = ss.getSheetByName(nombre), f = _filaPrefijo_(h, prefijo);
    return f === -1 ? null : _normalizarPlan_(h.getRange(f, col).getValue());
  };
  var cfg = _interruptoresConfig_(prefijo) || {};
  var items = [
    { que: 'Plan en VENDEDORES', hoy: leerPlan('VENDEDORES', 5), antes: reg.de, despues: reg.a },
    { que: 'Plan en CLIENTES_VAO', hoy: leerPlan('CLIENTES_VAO', 6), antes: reg.de, despues: reg.a }
  ];
  (reg.cambios || []).forEach(function (c) {
    items.push({ que: c.nombre || c.clave, clave: c.clave, hoy: (c.clave in cfg) ? cfg[c.clave] : null, antes: c.actual, despues: c.nuevo });
  });
  var faltaCompletar = items.filter(function (it) { return it.hoy !== it.despues; }).length;
  var faltaRevertir = items.filter(function (it) { return it.antes === null ? (it.hoy === true) : it.hoy !== it.antes; }).length;
  return { de: reg.de, a: reg.a, desde: reg.ts ? new Date(reg.ts).toISOString() : '', ilegible: !!reg.ilegible, items: items,
           faltaCompletar: faltaCompletar, faltaRevertir: faltaRevertir,
           firma: _firma_([prefijo, reg.ts || 0, items.map(function (it) { return [it.que, it.hoy]; })]) };
}

// Endpoint admin: sin confirmar = vista previa; con confirmar:true + modo + firma = aplica.
function recuperarCambioPlan(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  var reg0 = _cambioPlanPendiente_(prefijo);
  if (!reg0) return { error: prefijo + ' no tiene ningún cambio de plan pendiente' };
  if (reg0.ilegible) return { error: 'El registro del cambio pendiente está dañado: revisión manual (no se aplica nada a ciegas).' };
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, prefijo: prefijo, recuperacion: _estadoRecuperacion_(prefijo, reg0) };
  var modo = data.modo;
  if (modo !== 'completar' && modo !== 'revertir') return { error: 'Elegí completar o revertir' };
  return _conLock_(function () {
    var reg = _cambioPlanPendiente_(prefijo);
    if (!reg) return { error: prefijo + ' ya no tiene cambios pendientes' };
    var est = _estadoRecuperacion_(prefijo, reg);
    if (data.firma !== est.firma) return { error: 'El estado cambió desde que lo revisaste: volvé a abrir el checkpoint.', firmaVieja: true };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var destinoPlan = modo === 'completar' ? reg.a : reg.de;
    var cambios = (reg.cambios || []).map(function (c) {
      var objetivo = modo === 'completar' ? c.nuevo : (c.actual === null ? false : c.actual);
      return { clave: c.clave, nombre: c.nombre, nuevo: objetivo };
    });
    var cfg = _interruptoresConfig_(prefijo) || {};
    var faltan = cambios.filter(function (c) { return !((c.clave in cfg) && cfg[c.clave] === c.nuevo); });
    // Mismo orden seguro: apagar → planes → encender.
    _aplicarCambiosModulos_(prefijo, faltan.filter(function (c) { return !c.nuevo; }));
    _escribirPlan_(ss.getSheetByName('VENDEDORES'), prefijo, 5, destinoPlan);
    _escribirPlan_(ss.getSheetByName('CLIENTES_VAO'), prefijo, 6, destinoPlan);
    var res = _aplicarCambiosModulos_(prefijo, faltan.filter(function (c) { return c.nuevo; }));
    PropertiesService.getScriptProperties().deleteProperty(_claveCambioPlan_(prefijo));
    _cachePlanes_ = null;
    res.success = true; res.prefijo = prefijo; res.plan = destinoPlan; res.modo = modo; res.escritos = faltan.length;
    res.mensaje = '✅ ' + prefijo + (modo === 'completar' ? ': cambio completado, plan ' : ': cambio revertido, plan ') + destinoPlan;
    return res;
  });
}

// PRUEBA en el checkpoint: regularizada (con día y estado) o pendiente, a la vista.
function _resumenPrueba_(prefijo) {
  var ep = _estadoPrueba_(prefijo);
  if (!ep) return null;
  if (ep.regularizada) return { regularizada: true, estado: ep.estado, dia: ep.dia, venceTxt: ep.venceTxt, finGraciaTxt: ep.finGraciaTxt };
  return { regularizada: false, discrepancia: ep.discrepancia, propuesta: ep.propuesta,
           aviso: 'PRUEBA anterior a v028, SIN REGULARIZAR: hoy no vence sola (' + ep.discrepancia + '). No se bloquea en silencio: regularizala en la ficha del negocio (vista previa + confirmación).' };
}


// =====================================================================
// v031 — PRECIOS, OFERTA DE LANZAMIENTO Y ALTA AUTOMÁTICA DE PRUEBA
// =====================================================================
// planes.html (pública, sin sesión) lee los planes con getPlanesPublicos y
// registra una PRUEBA con registroSolicitarCodigo → registroConfirmar.
// El alta usa el MISMO camino que Admin (_altaNegocioSinLock_ → _crearNegocio_),
// bajo el lock del script. La contratación PAGA sigue bloqueada hasta tener el
// contrato digital revisado (confirmarPagoRecibido responde "bloqueado").

var COLUMNAS_PRECIO_ = ['Precio_regular', 'Precio_lanzamiento', 'Moneda', 'Periodo_facturacion', 'Contratable', 'Visible_en_planes'];
// Valores aprobados por Víctor el 17/10/2026 (solo se escriben donde la celda está vacía).
var PRECIOS_INICIALES_ = {
  PRUEBA:        { Precio_regular: 0,     Precio_lanzamiento: 0,     Moneda: 'ARS', Periodo_facturacion: 'PRUEBA',  Contratable: 'TRUE',  Visible_en_planes: 'TRUE' },
  BASICO:        { Precio_regular: 25000, Precio_lanzamiento: 15000, Moneda: 'ARS', Periodo_facturacion: 'MENSUAL', Contratable: 'TRUE',  Visible_en_planes: 'TRUE' },
  PLUS:          { Precio_regular: 35000, Precio_lanzamiento: 20000, Moneda: 'ARS', Periodo_facturacion: 'MENSUAL', Contratable: 'FALSE', Visible_en_planes: 'TRUE' },
  PRO:           { Precio_regular: 45000, Precio_lanzamiento: 25000, Moneda: 'ARS', Periodo_facturacion: 'MENSUAL', Contratable: 'TRUE',  Visible_en_planes: 'TRUE' },
  PERSONALIZADO: { Precio_regular: '',    Precio_lanzamiento: '',    Moneda: 'ARS', Periodo_facturacion: 'MENSUAL', Contratable: 'TRUE',  Visible_en_planes: 'TRUE' }
};
var ORDEN_PUBLICO_ = ['PRUEBA', 'BASICO', 'PLUS', 'PRO', 'PERSONALIZADO'];
var PROMO_ENC_ = ['Promo_id', 'Nombre', 'Estado', 'Cupo_total', 'Planes_elegibles', 'Meses_beneficio', 'Condiciones', 'Version_condiciones'];
var PROMO_INICIAL_ = ['LANZAMIENTO_2026', 'Oferta de lanzamiento', 'ACTIVA', 20, 'BASICO,PLUS,PRO', 6,
  'Precio de lanzamiento durante los primeros 6 meses de la contratación paga, para los primeros 20 comercios que contraten un plan pago elegible. No se renueva. Una vez por comercio. La prueba gratuita no cuenta.', 1];

function _precioOpcional_(v) {
  if (_vacio_(v)) return null;
  var n = Number(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : Math.round(n);
}
function _cacheScript_() { try { return CacheService.getScriptCache(); } catch (e) { return null; } }
function _limpiarCachePublica_() { var c = _cacheScript_(); if (c) try { c.remove('planesPublicos'); } catch (e) {} }

// ── PROMOCIÓN ─────────────────────────────────────────────────────────
function _leerPromo_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PROMOCIONES_VAO');
  if (!h) return null;
  var d = h.getDataRange().getValues();
  if (d.length < 2) return null;
  var enc = d[0].map(function (c) { return String(c).trim(); });
  var f = d[1], col = function (n) { return enc.indexOf(n); };
  var planes = String(f[col('Planes_elegibles')] || '').split(',').map(function (x) { return _normalizarPlan_(x); }).filter(String);
  return { hoja: h, fila: 2, id: String(f[col('Promo_id')] || ''), nombre: String(f[col('Nombre')] || ''),
           estado: String(f[col('Estado')] || '').trim().toUpperCase(), cupoTotal: _enteroOpcional_(f[col('Cupo_total')]) || 0,
           planes: planes, meses: _enteroOpcional_(f[col('Meses_beneficio')]) || 0,
           condiciones: String(f[col('Condiciones')] || ''), version: _enteroOpcional_(f[col('Version_condiciones')]) || 1, encabezados: enc };
}
// Cupos CONFIRMADOS: solo los registra la contratación paga (bloqueada en v031). Una PRUEBA nunca cuenta.
function _cuposConfirmados_(promoId) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CUPOS_PROMO_VAO');
  if (!h) return 0;
  var d = h.getDataRange().getValues(), conf = {}, enc = (d[0] || []).map(String);
  var cP = enc.indexOf('Prefijo'), cE = enc.indexOf('Evento'), cI = enc.indexOf('Promo_id');
  for (var i = 1; i < d.length; i++) {
    if (String(d[i][cI]) !== promoId) continue;
    var p = String(d[i][cP]);
    if (d[i][cE] === 'CONFIRMACION') conf[p] = true;
    if (d[i][cE] === 'LIBERACION') delete conf[p];
  }
  return Object.keys(conf).length;
}

// ── PÚBLICO: planes y precios (sin sesión) ───────────────────────────
function getPlanesPublicos(data) {
  var cache = _cacheScript_();
  if (cache) { try { var c = cache.get('planesPublicos'); if (c) { var o = JSON.parse(c); o.desdeCache = true; o.inscripcion = _estadoInscripcion_().inscripcion; return o; } } catch (e) {} }
  var pl = _leerPlanes_();
  var promo = _leerPromo_();
  var hayCupo = promo ? (promo.cupoTotal - _cuposConfirmados_(promo.id)) > 0 : false;
  var promoActiva = !!(promo && promo.estado === 'ACTIVA' && hayCupo);
  var preciosConfigurados = pl.existe && pl.encabezados.indexOf('Precio_regular') !== -1;
  var planes = [];
  if (pl.existe) {
    var orden = ORDEN_PUBLICO_.filter(function (c) { return pl.planes[c]; })
      .concat(pl.orden.filter(function (c) { return ORDEN_PUBLICO_.indexOf(c) === -1; }));
    orden.forEach(function (c) {
      var p = pl.planes[c];
      if (p.visible === false) return;
      if (!p.activo && c !== 'PLUS') return;                         // inactivos no se muestran (PLUS sí, como "Próximamente")
      var contratable = p.activo && p.contratable !== false;
      var modulos = MODULOS_IMPLEMENTADOS_.filter(function (m) { return p.modulos[m.clave]; }).map(function (m) { return m.nombre; });
      planes.push({
        codigo: c, nombre: p.nombre,
        precioRegular: p.precioRegular, precioLanzamiento: p.precioLanzamiento,
        moneda: p.moneda || 'ARS', periodo: p.periodo || (c === 'PRUEBA' ? 'PRUEBA' : 'MENSUAL'),
        contratable: contratable, proximamente: !contratable,
        cotizacion: c === 'PERSONALIZADO' && p.precioRegular === null,
        conPromo: promoActiva && promo.planes.indexOf(c) !== -1 && p.precioLanzamiento !== null && contratable,
        modulos: c === 'PLUS' && !contratable ? [] : modulos
      });
    });
  }
  var res = {
    success: true, preciosConfigurados: preciosConfigurados,
    prueba: { dias: DIAS_PRUEBA_, gracia: DIAS_GRACIA_PRUEBA_ },
    promo: promoActiva ? { nombre: promo.nombre, meses: promo.meses, planes: promo.planes, condiciones: promo.condiciones } : null,
    planes: planes,
    condicionesPrueba: { version: CONDICIONES_PRUEBA_.version, texto: CONDICIONES_PRUEBA_.texto, hash: _sha256Hex_(CONDICIONES_PRUEBA_.texto) },
    generado: new Date().toISOString()
  };
  if (cache) { try { cache.put('planesPublicos', JSON.stringify(res), 60); } catch (e) {} } // 60 s: evita leer la planilla en cada visita
  res.inscripcion = _estadoInscripcion_().inscripcion;
  return res;
}

// ── ADMIN: preparar columnas de precio, PLUS y la promoción ──────────
function _planPreciosIniciales_() {
  var pl = _leerPlanes_();
  if (!pl.existe) return { error: 'Primero inicializá los planes' };
  var enc = pl.encabezados.slice(), cambios = [];
  COLUMNAS_PRECIO_.forEach(function (c) { if (enc.indexOf(c) === -1) { cambios.push({ tipo: 'columna', columna: c }); enc.push(c); } });
  var col = function (n) { return enc.indexOf(n); };
  var datos = pl.hoja.getDataRange().getValues();
  Object.keys(PRECIOS_INICIALES_).forEach(function (cod) {
    var p = pl.planes[cod];
    if (!p) { if (cod === 'PLUS') cambios.push({ tipo: 'filaPLUS' }); return; }
    var fila = datos[p.fila - 1] || [];
    COLUMNAS_PRECIO_.forEach(function (c) {
      var actual = col(c) < fila.length ? fila[col(c)] : '';
      var nuevo = PRECIOS_INICIALES_[cod][c];
      if (_vacio_(actual) && !_vacio_(nuevo)) cambios.push({ tipo: 'celda', plan: cod, columna: c, valor: nuevo });
    });
  });
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PROMOCIONES_VAO')) cambios.push({ tipo: 'promo' });
  return { cambios: cambios, firma: _firma_(['precios', cambios]) };
}

function prepararPreciosPlanes(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var p0 = _planPreciosIniciales_();
  if (p0.error) return p0;
  var describir = function (c) {
    if (c.tipo === 'columna') return 'Agregar columna ' + c.columna + ' en PLANES_VAO';
    if (c.tipo === 'celda') return c.plan + ' · ' + c.columna + ' = ' + c.valor;
    if (c.tipo === 'filaPLUS') return 'Agregar PLUS (inactivo, NO contratable, módulos sin definir) — $35.000 / lanzamiento $20.000';
    return 'Crear PROMOCIONES_VAO: oferta de lanzamiento ACTIVA, 20 cupos, 6 meses, BÁSICO/PLUS/PRO';
  };
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, cambios: p0.cambios.map(describir), firma: p0.firma,
    nota: 'Solo se completan celdas vacías. No cambia ningún negocio, módulo ni vencimiento.' };
  return _conLock_(function () {
    var p = _planPreciosIniciales_();
    if (p.error) return p;
    if (data.firma !== p.firma) return { error: 'PLANES_VAO cambió desde la vista previa: volvé a revisarla.' };
    var pl = _leerPlanes_(), h = pl.hoja, enc = pl.encabezados.slice();
    p.cambios.forEach(function (c) {
      if (c.tipo === 'columna') { enc.push(c.columna); h.getRange(1, enc.length).setValue(c.columna); }
    });
    p.cambios.forEach(function (c) {
      if (c.tipo === 'celda') h.getRange(pl.planes[c.plan].fila, enc.indexOf(c.columna) + 1).setValue(c.valor);
    });
    if (p.cambios.some(function (c) { return c.tipo === 'filaPLUS'; })) {
      var fila = enc.map(function (e) {
        if (e === 'Plan') return 'PLUS';
        if (e === 'Nombre') return 'Plus';
        if (e === 'Activo') return 'FALSE';
        if (e === 'Dias_tolerancia') return 0;
        if (e === 'Notas') return 'Próximamente: módulos sin definir. No contratable.';
        if (_esModuloImplementado_(e)) return 'FALSE';
        if (PRECIOS_INICIALES_.PLUS.hasOwnProperty(e)) return PRECIOS_INICIALES_.PLUS[e];
        return '';
      });
      h.appendRow(fila);
    }
    if (p.cambios.some(function (c) { return c.tipo === 'promo'; })) {
      var hp = SpreadsheetApp.getActiveSpreadsheet().insertSheet('PROMOCIONES_VAO');
      hp.getRange(1, 1, 2, PROMO_ENC_.length).setValues([PROMO_ENC_, PROMO_INICIAL_]);
    }
    _cachePlanes_ = null; _limpiarCachePublica_();
    return { success: true, aplicados: p.cambios.length, mensaje: '✅ Precios y oferta preparados (' + p.cambios.length + ' cambios). Ningún negocio cambió.' };
  });
}

// Editar el precio de un plan (solo contrataciones NUEVAS; no hay precios pactados todavía).
function guardarPreciosPlan(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var codigo = _normalizarPlan_(data.plan);
  var pl = _leerPlanes_();
  if (!pl.existe || !pl.planes[codigo]) return { error: 'Plan no encontrado' };
  if (pl.encabezados.indexOf('Precio_regular') === -1) return { error: 'Primero prepará los precios (🧩 Planes → Preparar precios)' };
  var p = pl.planes[codigo];
  var reg = _vacio_(data.precioRegular) ? '' : Number(data.precioRegular);
  var lan = _vacio_(data.precioLanzamiento) ? '' : Number(data.precioLanzamiento);
  if (reg !== '' && (!/^\d{1,9}$/.test(String(data.precioRegular)) || reg > 100000000)) return { error: 'Precio regular inválido (entero, sin puntos ni signos)' };
  if (lan !== '' && (!/^\d{1,9}$/.test(String(data.precioLanzamiento)) || lan > 100000000)) return { error: 'Precio de lanzamiento inválido' };
  if (reg !== '' && lan !== '' && lan > reg) return { error: 'El precio de lanzamiento no puede ser mayor que el regular' };
  if (codigo === 'PRUEBA' && (reg || lan)) return { error: 'La PRUEBA es gratuita' };
  var contratable = data.contratable === undefined ? (p.contratable !== false) : data.contratable === true;
  if (contratable && !p.activo) return { error: 'Un plan inactivo no puede ser contratable' + (codigo === 'PLUS' ? ' (PLUS: definí y probá primero sus módulos)' : '') };
  var visible = data.visible === undefined ? (p.visible !== false) : data.visible === true;
  var nuevo = { Precio_regular: reg, Precio_lanzamiento: lan, Contratable: contratable ? 'TRUE' : 'FALSE', Visible_en_planes: visible ? 'TRUE' : 'FALSE' };
  var antes = { Precio_regular: p.precioRegular === null ? '' : p.precioRegular, Precio_lanzamiento: p.precioLanzamiento === null ? '' : p.precioLanzamiento,
                Contratable: p.contratable === false ? 'FALSE' : 'TRUE', Visible_en_planes: p.visible === false ? 'FALSE' : 'TRUE' };
  var negocios = 0, hc = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO');
  if (hc) hc.getDataRange().getValues().slice(1).forEach(function (r) { if (_normalizarPlan_(r[5]) === codigo) negocios++; });
  var firma = _firma_(['precio', codigo, antes, nuevo]);
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, plan: codigo, antes: antes, despues: nuevo, firma: firma,
    impacto: 'Afecta solo a contrataciones NUEVAS. ' + negocios + ' negocio(s) con plan ' + p.nombre + ' no cambian (sus condiciones no se modifican en silencio).' };
  return _conLock_(function () {
    _cachePlanes_ = null;
    var pl2 = _leerPlanes_(), p2 = pl2.planes[codigo];
    var antes2 = { Precio_regular: p2.precioRegular === null ? '' : p2.precioRegular, Precio_lanzamiento: p2.precioLanzamiento === null ? '' : p2.precioLanzamiento,
                   Contratable: p2.contratable === false ? 'FALSE' : 'TRUE', Visible_en_planes: p2.visible === false ? 'FALSE' : 'TRUE' };
    if (_firma_(['precio', codigo, antes2, nuevo]) !== data.firma) return { error: 'Los precios cambiaron desde la vista previa: volvé a revisarla.' };
    Object.keys(nuevo).forEach(function (k) { pl2.hoja.getRange(p2.fila, pl2.encabezados.indexOf(k) + 1).setValue(nuevo[k]); });
    _cachePlanes_ = null; _limpiarCachePublica_();
    return { success: true, mensaje: '✅ Precios de ' + p2.nombre + ' guardados (solo para contrataciones nuevas)' };
  });
}

function guardarPromocion(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var pr = _leerPromo_();
  if (!pr) return { error: 'Primero prepará los precios y la oferta (🧩 Planes)' };
  var estado = String(data.estado || pr.estado).toUpperCase();
  if (['ACTIVA', 'PAUSADA', 'FINALIZADA'].indexOf(estado) === -1) return { error: 'Estado inválido' };
  var cupo = data.cupoTotal === undefined ? pr.cupoTotal : Number(data.cupoTotal);
  if (!/^\d{1,4}$/.test(String(cupo))) return { error: 'Cupo inválido' };
  var conf = _cuposConfirmados_(pr.id);
  if (cupo < conf) return { error: 'El cupo no puede ser menor que los ' + conf + ' lugares ya confirmados' };
  var antes = { estado: pr.estado, cupoTotal: pr.cupoTotal }, despues = { estado: estado, cupoTotal: cupo };
  var firma = _firma_(['promo', antes, despues]);
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, antes: antes, despues: despues, confirmados: conf, firma: firma,
    impacto: 'No cambia el precio de ningún negocio. Cupos confirmados: ' + conf + '.' };
  return _conLock_(function () {
    var pr2 = _leerPromo_();
    if (_firma_(['promo', { estado: pr2.estado, cupoTotal: pr2.cupoTotal }, despues]) !== data.firma) return { error: 'La oferta cambió desde la vista previa.' };
    pr2.hoja.getRange(2, pr2.encabezados.indexOf('Estado') + 1).setValue(estado);
    pr2.hoja.getRange(2, pr2.encabezados.indexOf('Cupo_total') + 1).setValue(cupo);
    _limpiarCachePublica_();
    return { success: true, mensaje: '✅ Oferta: ' + estado + ' · cupo ' + cupo };
  });
}

// v033: confirmarPagoRecibido está más abajo (sección VIGENCIA DE PLANES PAGOS).

// ── CONDICIONES DE LA PRUEBA (no es el contrato pago) ────────────────
var CONDICIONES_PRUEBA_ = {
  version: 'PRUEBA-1 (STAGING · pendiente de revisión jurídica)',
  texto: [
    'Condiciones de la prueba gratuita de VAO POS',
    '1. La prueba es gratuita, sin tarjeta de crédito, y dura 7 días corridos desde la activación más 3 días de gracia. Desde el día 11 no se pueden registrar operaciones nuevas.',
    '2. Es una sola vez por persona o comercio (se controla por teléfono y correo). No se renueva ni se reinicia al cambiar de dispositivo.',
    '3. Tus registros (productos, ventas, fiados, caja, etc.) son tuyos: los podés consultar y descargar desde el primer día, también cuando la prueba termine.',
    '4. VAO POS funciona sobre una planilla central de VAO Sistemas con hojas separadas para cada comercio. Nunca se muestran datos de un comercio a otro.',
    '5. Usamos tu nombre, teléfono y correo solo para darte acceso, avisarte sobre tu prueba y responder tus consultas. No los vendemos ni los cedemos.',
    '6. El PIN de acceso es personal del comercio: cuidalo. Quien tenga el PIN puede operar el POS.',
    '7. Aceptar estas condiciones NO es contratar un plan pago. Para pasar a un plan pago vas a recibir el contrato y sus condiciones comerciales antes de aceptarlas.',
    '8. Podés pedir la baja o la eliminación de tus datos escribiendo a VAO Sistemas.'
  ].join('\n')
};

function _sha256Hex_(t) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8);
  return b.map(function (x) { var v = (x < 0 ? x + 256 : x).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

// ── CONFIGURACIÓN DE ALTAS AUTOMÁTICAS (Admin) ────────────────────────
var ALTAS_DEFECTO_ = { activas: false, maxSimultaneas: 10, maxPorDia: 3, maxCodigosPorDia: 40 }; // v032: solo Admin las habilita
function _configAltas_() {
  var c = {}; try { c = JSON.parse(PropertiesService.getScriptProperties().getProperty('ALTAS_AUTO_CONFIG') || '{}'); } catch (e) { c = {}; }
  return { activas: c.activas === undefined ? ALTAS_DEFECTO_.activas : c.activas === true,
           maxSimultaneas: _enteroValido_(c.maxSimultaneas, ALTAS_DEFECTO_.maxSimultaneas),
           maxPorDia: _enteroValido_(c.maxPorDia, ALTAS_DEFECTO_.maxPorDia),
           maxCodigosPorDia: _enteroValido_(c.maxCodigosPorDia, ALTAS_DEFECTO_.maxCodigosPorDia) };
}
function _enteroValido_(v, def) { var n = Number(v); return (v === undefined || v === null || v === '' || isNaN(n) || n < 0 || Math.floor(n) !== n) ? def : n; }

// Pruebas que hoy pueden operar (ACTIVA + GRACIA + anteriores sin regularizar). Una sola lectura de CLIENTES_VAO.
function _contarPruebas_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO');
  var props = PropertiesService.getScriptProperties().getProperties();
  var r = { activas: 0, gracia: 0, vencidas: 0, sinRegularizar: 0, suspendidas: 0, operando: 0 };
  if (!h) return r;
  h.getDataRange().getValues().slice(1).forEach(function (f) {
    var p = _normalizarPrefijo_(f[0]);
    if (!p || _normalizarPlan_(f[5]) !== 'PRUEBA') return;
    if (String(f[6] || '').toUpperCase() === 'SUSPENDIDO') { r.suspendidas++; return; }
    var m = props['PRUEBA_7_3_' + p], alta = null;
    if (m) { try { alta = _fechaValida_(JSON.parse(m).alta); } catch (e) {} }
    if (!alta) { r.sinRegularizar++; return; }
    var e = _calcularPrueba_(alta).estado;
    if (e === 'ACTIVA') r.activas++; else if (e === 'GRACIA') r.gracia++; else r.vencidas++;
  });
  r.operando = r.activas + r.gracia + r.sinRegularizar;
  return r;
}

function _hoyClave_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd'); }

// ¿Se puede abrir una prueba automática ahora? (sin contar excepciones de Admin)
function _estadoInscripcion_() {
  var cfg = _configAltas_();
  if (!cfg.activas) return { inscripcion: 'LISTA_ESPERA', motivo: 'Altas automáticas no habilitadas por Admin' };
  var cp = _contarPruebas_();
  if (cp.operando >= cfg.maxSimultaneas) return { inscripcion: 'LISTA_ESPERA', motivo: 'Límite de pruebas simultáneas (' + cfg.maxSimultaneas + ')' };
  if (_altasAutomaticasHoy_() >= cfg.maxPorDia) return { inscripcion: 'LISTA_ESPERA', motivo: 'Límite de altas del día (' + cfg.maxPorDia + ')' };
  return { inscripcion: 'ABIERTA', motivo: '' };
}

// ── SOLICITUDES (registro público) ────────────────────────────────────
var SOL_ENC_ = ['Solicitud_id', 'Fecha', 'Estado', 'Comercio', 'Responsable', 'Telefono', 'Correo', 'Condiciones_version', 'Condiciones_hash',
                'Correo_verificado', 'Prefijo', 'Origen', 'Excepcion', 'Fecha_activacion', 'Detalle', 'Actualizado'];
var SC_ = {}; SOL_ENC_.forEach(function (n, i) { SC_[n] = i; });

function _hojaSolicitudes_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName('SOLICITUDES_VAO');
  if (!h) { h = ss.insertSheet('SOLICITUDES_VAO'); h.getRange(1, 1, 1, SOL_ENC_.length).setValues([SOL_ENC_]); }
  return h;
}
function _leerSolicitudes_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SOLICITUDES_VAO');
  if (!h) return [];
  return h.getDataRange().getValues().slice(1).map(function (r, i) { var o = { fila: i + 2, raw: r }; SOL_ENC_.forEach(function (n, k) { o[n] = r[k]; }); return o; });
}
function _buscarSolicitud_(id) {
  id = String(id || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  var l = _leerSolicitudes_();
  for (var i = 0; i < l.length; i++) if (String(l[i].Solicitud_id) === id) return l[i];
  return null;
}
function _guardarSolicitud_(sol, cambios) {
  var h = _hojaSolicitudes_();
  var fila = sol.raw.slice(); while (fila.length < SOL_ENC_.length) fila.push('');
  Object.keys(cambios).forEach(function (k) { fila[SC_[k]] = cambios[k]; sol[k] = cambios[k]; });
  fila[SC_.Actualizado] = new Date();
  h.getRange(sol.fila, 1, 1, SOL_ENC_.length).setValues([fila]);   // UNA sola escritura por cambio de estado
  sol.raw = fila;
  return sol;
}
function _altasAutomaticasHoy_() {
  var hoy = _hoyClave_(), n = 0;
  _leerSolicitudes_().forEach(function (s) {
    if (s.Estado === 'ACTIVADA' && s.Origen === 'AUTO' && !s.Excepcion && s.Fecha_activacion &&
        Utilities.formatDate(new Date(s.Fecha_activacion), Session.getScriptTimeZone(), 'yyyyMMdd') === hoy) n++;
  });
  return n;
}

// Texto seguro para la planilla: sin caracteres de control, sin fórmulas al inicio, largo acotado.
function _textoPublico_(v, min, max) {
  var t = String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < min || t.length > max) return null;
  if (/^[=+\-@'"]/.test(t)) return null;                 // evita que Sheets lo tome como fórmula
  if (!/^[A-Za-zÀ-ÿ0-9 .,&()\/'ºª#-]+$/.test(t)) return null;
  return t;
}
function _correoPublico_(v) {
  var t = String(v || '').trim().toLowerCase();
  if (t.length > 100 || !/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,180}\.[a-z]{2,24}$/.test(t)) return null;
  return t;
}
function _telefonoPublico_(v) {
  var t = String(v || '').replace(/[\s()+.-]/g, '');
  return /^\d{8,15}$/.test(t) ? t : null;
}
function _enmascararCorreo_(c) { c = String(c || ''); var i = c.indexOf('@'); return i < 1 ? '' : c.charAt(0) + '***' + c.substring(i); }
function _claveIdentidad_(tel, correo) { return { t8: String(tel || '').slice(-8), c: String(correo || '').toLowerCase() }; }
function _mismaPersona_(s, tel, correo) {
  var a = _claveIdentidad_(s.Telefono, s.Correo), b = _claveIdentidad_(tel, correo);
  return (a.t8 && a.t8.length === 8 && a.t8 === b.t8) || (a.c && a.c === b.c);
}

function _codigoSeisDigitos_() {
  var n = parseInt(Utilities.getUuid().replace(/-/g, '').substring(0, 12), 16);
  return ('000000' + String(n % 1000000)).slice(-6);
}

function _enviarCorreo_(para, asunto, texto) {
  try {
    if (MailApp.getRemainingDailyQuota() < 3) return 'Sin cupo de correo de Google por hoy';
    MailApp.sendEmail({ to: para, subject: asunto, body: texto, name: 'VAO POS' });
    return '';
  } catch (e) { return 'No se pudo enviar el correo: ' + e.message; }
}

// Paso 1 (público): validar datos, controlar duplicados y límites de envío, y mandar el código.
function registroSolicitarCodigo(data) {
  data = data || {};
  if (data.web) return { error: 'No se pudo procesar la solicitud.' };            // trampa para robots (campo oculto)
  if (!data.solicitudId && data.t !== undefined && Number(data.t) < 3000) return { error: 'No se pudo procesar la solicitud.' }; // formulario completado demasiado rápido
  return _conLock_(function () {
    var sol = null, comercio, responsable, tel, correo;
    if (data.solicitudId) {                                                       // reenvío o invitación de Admin
      sol = _buscarSolicitud_(data.solicitudId);
      if (!sol) return { error: 'Solicitud no encontrada' };
      if (['CODIGO_ENVIADO', 'HABILITADA', 'CREANDO'].indexOf(sol.Estado) === -1) return _respuestaEstado_(sol); // v032: CREANDO = retomar con código
      comercio = sol.Comercio; responsable = sol.Responsable; tel = String(sol.Telefono); correo = sol.Correo;
    } else {
      comercio = _textoPublico_(data.comercio, 2, 60);
      responsable = _textoPublico_(data.responsable, 3, 60);
      tel = _telefonoPublico_(data.telefono);
      correo = _correoPublico_(data.correo);
      if (!comercio) return { error: 'Revisá el nombre del comercio (2 a 60 letras o números).', campo: 'comercio' };
      if (!responsable) return { error: 'Revisá el nombre y apellido del responsable.', campo: 'responsable' };
      if (!tel) return { error: 'Revisá el teléfono: solo números, con característica (8 a 15 dígitos).', campo: 'telefono' };
      if (!correo) return { error: 'Revisá el correo electrónico.', campo: 'correo' };
      if (data.acepta !== true || data.condicionesVersion !== CONDICIONES_PRUEBA_.version) return { error: 'Para seguir tenés que leer y aceptar las condiciones de la prueba.', campo: 'acepta' };
    }
    // Prueba ya usada (negocios existentes). Un alta cortada (CREANDO) puede encontrarse a sí misma: no es duplicado.
    var ya = (sol && sol.Estado === 'CREANDO') ? '' : _pruebaYaUsada_(tel, correo);
    if (ya) {
      if (!sol) _registrarDuplicado_(comercio, responsable, tel, correo, 'Ya existe el negocio ' + ya);
      else _guardarSolicitud_(sol, { Estado: 'DUPLICADO', Detalle: 'Ya existe el negocio ' + ya });
      return { error: 'Ese teléfono o correo ya tiene una prueba registrada. La prueba gratuita es una sola vez. Si sos el titular, escribinos a VAO Sistemas.', duplicado: true };
    }
    // Solicitudes abiertas de la misma persona
    if (!sol) {
      var abiertas = _leerSolicitudes_().filter(function (s) { return _mismaPersona_(s, tel, correo); });
      for (var i = abiertas.length - 1; i >= 0; i--) {
        var s = abiertas[i];
        if (s.Estado === 'CODIGO_ENVIADO' || s.Estado === 'HABILITADA') { sol = s; break; }
        if (['LISTA_ESPERA', 'CREANDO', 'ACTIVADA', 'ERROR', 'RECHAZADA'].indexOf(s.Estado) !== -1) return _respuestaEstado_(s);
      }
    }
    // Límites de envío (protegen el cupo de correos y frenan abusos)
    var cfg = _configAltas_(), props = PropertiesService.getScriptProperties();
    var kDia = 'REG_COD_DIA_' + _hoyClave_();
    var enviadosHoy = Number(props.getProperty(kDia) || 0);
    if (enviadosHoy >= cfg.maxCodigosPorDia) return { error: 'Hoy recibimos muchas solicitudes. Probá de nuevo mañana o escribinos a VAO Sistemas.', limite: true };
    var kPer = 'REG_COD_PER_' + _sha256Hex_('VAO|' + correo).substring(0, 16);
    var per = {}; try { per = JSON.parse(props.getProperty(kPer) || '{}'); } catch (e) { per = {}; }
    if (per.dia !== _hoyClave_()) per = { dia: _hoyClave_(), n: 0 };
    if (per.n >= 3) return { error: 'Ya te enviamos 3 códigos hoy. Revisá tu correo (también en spam) o probá mañana.', limite: true };
    // Solicitud (nueva o la misma)
    if (!sol) {
      var h = _hojaSolicitudes_(), id = Utilities.getUuid();
      var fila = SOL_ENC_.map(function () { return ''; });
      fila[SC_.Solicitud_id] = id; fila[SC_.Fecha] = new Date(); fila[SC_.Estado] = 'CODIGO_ENVIADO';
      fila[SC_.Comercio] = comercio; fila[SC_.Responsable] = responsable; fila[SC_.Telefono] = "'" + tel; fila[SC_.Correo] = correo;
      fila[SC_.Condiciones_version] = CONDICIONES_PRUEBA_.version; fila[SC_.Condiciones_hash] = _sha256Hex_(CONDICIONES_PRUEBA_.texto);
      fila[SC_.Origen] = 'AUTO'; fila[SC_.Actualizado] = new Date();
      h.appendRow(fila);
      sol = _buscarSolicitud_(id);
    }
    var codigo = _codigoSeisDigitos_();
    var otp = { h: _hashFuerte_(codigo, 'REG|' + sol.Solicitud_id), exp: new Date().getTime() + 15 * 60000, intentos: 0 };
    props.setProperty('REG_OTP_' + sol.Solicitud_id, JSON.stringify(otp));
    var err = _enviarCorreo_(correo, 'Tu código de VAO POS: ' + codigo,
      'Hola ' + responsable + ':\n\nTu código para crear la prueba gratuita de VAO POS para "' + comercio + '" es:\n\n    ' + codigo +
      '\n\nVence en 15 minutos y sirve una sola vez.\nSi no lo pediste, ignorá este correo.\n\nVAO Sistemas');
    if (err) { props.deleteProperty('REG_OTP_' + sol.Solicitud_id); return { error: err + '. Probá de nuevo en unos minutos.' }; }
    per.n++; props.setProperty(kPer, JSON.stringify(per)); props.setProperty(kDia, String(enviadosHoy + 1));
    if (['CODIGO_ENVIADO', 'HABILITADA', 'CREANDO'].indexOf(sol.Estado) === -1) _guardarSolicitud_(sol, { Estado: 'CODIGO_ENVIADO' });
    return { success: true, solicitudId: sol.Solicitud_id, correo: _enmascararCorreo_(correo), venceMin: 15,
             mensaje: 'Te enviamos un código de 6 números a ' + _enmascararCorreo_(correo) + '. Revisá también la carpeta de spam.' };
  });
}

function _registrarDuplicado_(comercio, responsable, tel, correo, detalle) {
  var desde = new Date().getTime() - 86400000;
  var ya = _leerSolicitudes_().some(function (s) { return s.Estado === 'DUPLICADO' && _mismaPersona_(s, tel, correo) && new Date(s.Fecha).getTime() > desde; });
  if (ya) return;                                                       // una alerta por persona y día alcanza
  var fila = SOL_ENC_.map(function () { return ''; });
  fila[SC_.Solicitud_id] = Utilities.getUuid(); fila[SC_.Fecha] = new Date(); fila[SC_.Estado] = 'DUPLICADO';
  fila[SC_.Comercio] = comercio; fila[SC_.Responsable] = responsable; fila[SC_.Telefono] = "'" + tel; fila[SC_.Correo] = correo;
  fila[SC_.Origen] = 'AUTO'; fila[SC_.Detalle] = detalle; fila[SC_.Actualizado] = new Date();
  _hojaSolicitudes_().appendRow(fila);
}

function _posUrl_(prefijo) { return SISTEMA.url + 'pos.html?p=' + prefijo; }

function _respuestaEstado_(s) {
  var base = { solicitudId: s.Solicitud_id, estado: s.Estado, correo: _enmascararCorreo_(s.Correo) };
  if (s.Estado === 'ACTIVADA') return Object.assign(base, { success: true, yaCreado: true, prefijo: s.Prefijo, posUrl: _posUrl_(s.Prefijo),
    mensaje: 'Tu prueba ya está creada. Entrá con el enlace y el PIN que te enviamos por correo.' });
  if (s.Estado === 'LISTA_ESPERA') return Object.assign(base, { success: true, listaEspera: true, // v032: la habilitación depende de Admin
    mensaje: 'Quedaste en la lista de espera. En este momento las nuevas pruebas las habilita VAO Sistemas en forma manual: si habilita la tuya, te llega un correo con el enlace para comenzar. No hay una fecha asegurada.' });
  if (s.Estado === 'CODIGO_ENVIADO' || s.Estado === 'HABILITADA') return Object.assign(base, { success: true, esperaCodigo: true,
    habilitada: s.Estado === 'HABILITADA', mensaje: s.Estado === 'HABILITADA' ? 'VAO Sistemas te habilitó: pedí tu código para crear la prueba.' : 'Ingresá el código que te enviamos por correo.' });
  if (s.Estado === 'CREANDO') return Object.assign(base, { success: true, esperaCodigo: true, reanudar: true,   // v032
    mensaje: 'Tu prueba quedó a medio crear por un corte. Para terminarla de forma segura, pedí un código nuevo a tu correo.' });
  if (s.Estado === 'ERROR') return Object.assign(base, { error: 'Tu prueba necesita una revisión de VAO Sistemas. No hace falta que la pidas de nuevo.', enRevision: true });
  if (s.Estado === 'RECHAZADA') return Object.assign(base, { error: 'Tu solicitud no fue aprobada. Si creés que es un error, escribinos a VAO Sistemas.', rechazada: true });
  return Object.assign(base, { error: 'Esta solicitud no se puede continuar. Escribinos a VAO Sistemas.' });
}

// Público: estado de una solicitud (para retomar si se recarga la página).
function registroEstado(data) {
  var s = _buscarSolicitud_((data || {}).solicitudId);
  if (!s) return { error: 'Solicitud no encontrada' };
  return _respuestaEstado_(s);
}

// Paso 2 (público): verificar el código y, si hay lugar, crear la PRUEBA. Todo bajo el lock.
function registroConfirmar(data) {
  data = data || {};
  return _conLock_(function () {
    var s = _buscarSolicitud_(data.solicitudId);
    if (!s) return { error: 'Solicitud no encontrada' };
    if (s.Estado !== 'CODIGO_ENVIADO' && s.Estado !== 'HABILITADA' && s.Estado !== 'CREANDO') return _respuestaEstado_(s);
    // v032: TODO camino que pueda crear o recuperar un negocio (y entregar un PIN) exige un código válido,
    // enviado al correo verificado. Conocer el solicitudId no alcanza.
    var v = _verificarCodigoRegistro_(s, data.codigo);
    if (!v.ok) return v.respuesta;
    if (s.Estado === 'CREANDO') return _reanudarAlta_(s, false);              // alta cortada: se retoma con el código nuevo
    var excepcion = s.Estado === 'HABILITADA';
    // Controles del servidor otra vez (no se confía en la página)
    var ya = _pruebaYaUsada_(String(s.Telefono), s.Correo);
    if (ya) { _guardarSolicitud_(s, { Estado: 'DUPLICADO', Correo_verificado: new Date(), Detalle: 'Ya existe el negocio ' + ya });
              return { error: 'Ese teléfono o correo ya tiene una prueba registrada. La prueba gratuita es una sola vez.', duplicado: true }; }
    if (!excepcion) {
      var ins = _estadoInscripcion_();
      if (ins.inscripcion !== 'ABIERTA') {
        _guardarSolicitud_(s, { Estado: 'LISTA_ESPERA', Correo_verificado: new Date(), Detalle: ins.motivo });
        return _respuestaEstado_(s);
      }
    }
    var pref = _generarPrefijo_(s.Comercio);
    if (!pref) { _guardarSolicitud_(s, { Estado: 'ERROR', Correo_verificado: new Date(), Detalle: 'No se encontró un prefijo libre' });
                 return { error: 'No pudimos crear tu prueba en este momento. VAO Sistemas ya fue avisado.', enRevision: true }; }
    _guardarSolicitud_(s, { Estado: 'CREANDO', Correo_verificado: new Date(), Prefijo: pref });   // marca ANTES de crear: recuperable
    return _crearAltaDeSolicitud_(s, pref);
  });
}

function _crearAltaDeSolicitud_(s, pref) {
  var r = _altaNegocioSinLock_({ prefijo: pref, nombre: s.Comercio, contacto: s.Responsable, telefono: String(s.Telefono).replace(/^'/, ''),
                                 correo: s.Correo, plan: 'PRUEBA' },
                               { origen: 'AUTO', obs: 'Alta automática (planes.html) · solicitud ' + s.Solicitud_id + (s.Excepcion ? ' · excepción: ' + s.Excepcion : '') });
  if (!r.success) {
    _guardarSolicitud_(s, { Estado: 'ERROR', Detalle: String(r.error || 'error desconocido').substring(0, 400) });
    return { error: 'No pudimos crear tu prueba en este momento. VAO Sistemas ya fue avisado y lo revisa.', enRevision: true, detalle: r.error };
  }
  _guardarSolicitud_(s, { Estado: 'ACTIVADA', Fecha_activacion: new Date(), Detalle: '' });
  var errMail = _enviarCorreo_(s.Correo, 'Tu prueba de VAO POS está lista',
    'Hola ' + s.Responsable + ':\n\nTu prueba gratuita de VAO POS para "' + s.Comercio + '" ya está activa.\n\n' +
    'Entrá desde: ' + _posUrl_(pref) + '\nTu PIN: ' + r.pin + '\n\n' +
    'La prueba dura 7 días (hasta el ' + r.prueba.venceTxt + ') más 3 días de gracia (hasta el ' + r.prueba.finGraciaTxt + ').\n' +
    'Guardá este correo. Cuidá tu PIN: quien lo tenga puede operar tu POS.\n\nVAO Sistemas');
  if (errMail) _guardarSolicitud_(s, { Detalle: 'Correo con PIN no enviado: ' + errMail });
  return { success: true, creado: true, prefijo: pref, pin: r.pin, posUrl: _posUrl_(pref),
           venceTxt: r.prueba.venceTxt, finGraciaTxt: r.prueba.finGraciaTxt, correoEnviado: !errMail };
}

// Un alta quedó en CREANDO (corte de Apps Script). Se mira qué quedó y nunca se crea un segundo negocio.
function _reanudarAlta_(s, porAdmin) {
  var pref = String(s.Prefijo || '');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
  var hojas = _hojasDelNegocio_(pref).filter(function (n) { return n.indexOf('CONF_DIARIA_') !== 0; });
  var hay = hojas.filter(function (n) { return !!ss.getSheetByName(n); });
  var enV = _filaPrefijo_(ss.getSheetByName('VENDEDORES'), pref) !== -1;
  var enC = _filaPrefijo_(ss.getSheetByName('CLIENTES_VAO'), pref) !== -1;
  var pin = !!props.getProperty('PIN_' + pref), marca = !!props.getProperty('PRUEBA_7_3_' + pref);
  var completo = pref && hay.length === hojas.length && enV && enC && pin && marca;
  var nada = pref && hay.length === 0 && !enV && !enC && !pin && !marca;
  if (!completo && pref && hay.length === hojas.length && enV) return _completarAltaCortada_(s, pref, enC, marca, porAdmin);
  if (completo) {
    // El negocio existe entero, pero el PIN se perdió con el corte: se genera uno nuevo y se envía.
    var nuevoPin = generarPinAleatorio();
    props.setProperty('PIN_' + pref, _hashFuerte_(nuevoPin, pref));
    var cp = _calcularPrueba_(_fechaValida_(JSON.parse(props.getProperty('PRUEBA_7_3_' + pref)).alta));
    _guardarSolicitud_(s, { Estado: 'ACTIVADA', Fecha_activacion: s.Fecha_activacion || new Date(), Detalle: 'Recuperada tras un corte' + (porAdmin ? ' (Admin)' : '') });
    var errM1 = _enviarCorreo_(s.Correo, 'Tu prueba de VAO POS está lista', 'Tu prueba de VAO POS ya está activa.\n\nEntrá desde: ' + _posUrl_(pref) + '\nTu PIN: ' + nuevoPin + '\n\nVAO Sistemas');
    if (errM1) _guardarSolicitud_(s, { Detalle: 'Recuperada tras un corte. Correo con PIN NO enviado: ' + errM1 + ' (usar Reset PIN)' });
    return { success: true, creado: true, recuperado: true, prefijo: pref, pin: nuevoPin, correoEnviado: !errM1, posUrl: _posUrl_(pref), venceTxt: cp.venceTxt, finGraciaTxt: cp.finGraciaTxt };
  }
  if (nada) return _crearAltaDeSolicitud_(s, _prefijoLibre_(pref) ? pref : (_generarPrefijo_(s.Comercio) || pref));
  // Restos SIN datos (solo hojas recién creadas: encabezado, o la CONFIG inicial) y sin registro ni accesos:
  // Admin puede limpiarlos y volver a crear. Nunca se borra una hoja con filas cargadas.
  var soloRestosVacios = pref && !enV && !enC && !pin && !marca && hay.every(function (n) {
    var h = ss.getSheetByName(n); return n.indexOf('CONFIG_') === 0 ? true : h.getLastRow() <= 1;
  });
  if (soloRestosVacios && porAdmin) {
    hay.forEach(function (n) { var h = ss.getSheetByName(n); if (h) ss.deleteSheet(h); });
    _guardarSolicitud_(s, { Detalle: 'Admin limpió ' + hay.length + ' hoja(s) vacía(s) de un alta cortada y reintentó' });
    return _crearAltaDeSolicitud_(s, _prefijoLibre_(pref) ? pref : (_generarPrefijo_(s.Comercio) || pref));
  }
  var detalle = 'Alta incompleta de ' + pref + ': hojas ' + hay.length + '/' + hojas.length + ', VENDEDORES ' + (enV ? 'sí' : 'no') +
                ', CLIENTES_VAO ' + (enC ? 'sí' : 'no') + ', PIN ' + (pin ? 'sí' : 'no') + ', marca PRUEBA ' + (marca ? 'sí' : 'no') + '. Revisión manual.';
  _guardarSolicitud_(s, { Estado: 'ERROR', Detalle: detalle });
  return { error: porAdmin ? detalle : 'Tu prueba necesita una revisión de VAO Sistemas. No hace falta que la pidas de nuevo.', enRevision: true, detalle: detalle };
}

// Hojas completas y fila en VENDEDORES (la CONFIG ya estaba terminada): se completan SOLO las piezas
// de esta misma alta que faltan (fila en CLIENTES_VAO, marca 7 + 3) y se genera un PIN nuevo.
function _completarAltaCortada_(s, pref, enC, marca, porAdmin) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
  var hV = ss.getSheetByName('VENDEDORES'), fV = _filaPrefijo_(hV, pref);
  var alta = _fechaValida_(hV.getRange(fV, 6).getValue()) || new Date();
  var cpA = _calcularPrueba_(alta);
  if (!enC) ss.getSheetByName('CLIENTES_VAO').appendRow([pref, s.Comercio, s.Responsable, String(s.Telefono).replace(/^'/, ''), s.Correo, 'PRUEBA', 'ACTIVO',
    alta, cpA.vence, '', '', 'PENDIENTE ⚠️', 'CONFIGURADO ✅', 'Alta automática (planes.html) · solicitud ' + s.Solicitud_id + ' · completada tras un corte']);
  if (!marca) props.setProperty('PRUEBA_7_3_' + pref, JSON.stringify({ alta: _diaSolo_(alta).toISOString(), modo: 'alta' }));
  var nuevoPin = generarPinAleatorio();
  props.setProperty('PIN_' + pref, _hashFuerte_(nuevoPin, pref));
  _guardarSolicitud_(s, { Estado: 'ACTIVADA', Fecha_activacion: s.Fecha_activacion || new Date(), Detalle: 'Completada tras un corte' + (porAdmin ? ' (Admin)' : '') });
  var errM2 = _enviarCorreo_(s.Correo, 'Tu prueba de VAO POS está lista', 'Tu prueba de VAO POS ya está activa.\n\nEntrá desde: ' + _posUrl_(pref) + '\nTu PIN: ' + nuevoPin + '\n\nVAO Sistemas');
  if (errM2) _guardarSolicitud_(s, { Detalle: 'Completada tras un corte. Correo con PIN NO enviado: ' + errM2 + ' (usar Reset PIN)' });
  return { success: true, creado: true, recuperado: true, prefijo: pref, pin: nuevoPin, correoEnviado: !errM2, posUrl: _posUrl_(pref), venceTxt: cpA.venceTxt, finGraciaTxt: cpA.finGraciaTxt };
}

// Prefijo nuevo: iniciales del comercio y, si están ocupadas, combinaciones al azar. Nunca reservado ni usado.
function _prefijoLibre_(p) { return _chequearPrefijoDisponible_(p).disponible; }
function _generarPrefijo_(nombre) {
  var limpio = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').trim();
  var pal = limpio.split(/\s+/).filter(function (w) { return w.length > 0; });
  var cands = [];
  if (pal.length >= 3) cands.push(pal[0][0] + pal[1][0] + pal[2][0]);
  if (pal.length >= 2) cands.push(pal[0][0] + pal[1][0] + (pal[1][1] || pal[0][1] || 'X'), pal[0][0] + pal[1][0]);
  if (pal.length >= 1 && pal[0].length >= 3) cands.push(pal[0].substring(0, 3));
  if (pal.length >= 1 && pal[0].length >= 2) cands.push(pal[0].substring(0, 2));
  // Conjuntos leídos una sola vez (evita leer la planilla por cada candidato)
  var ss = SpreadsheetApp.getActiveSpreadsheet(), usados = {};
  ss.getSheets().forEach(function (h) { usados['H:' + String(h.getName()).toUpperCase()] = true; });
  ['VENDEDORES', 'CLIENTES_VAO'].forEach(function (n) { var h = ss.getSheetByName(n); if (h) h.getDataRange().getValues().slice(1).forEach(function (r) { usados['P:' + _normalizarPrefijo_(r[0])] = true; }); });
  var props = Object.keys(PropertiesService.getScriptProperties().getProperties());
  var libre = function (p) {
    if (!new RegExp(PREFIJO_PATRON_).test(p) || PREFIJOS_RESERVADOS_.indexOf(p) !== -1 || usados['P:' + p]) return false;
    if (_hojasDelNegocio_(p).some(function (n) { return usados['H:' + n] || HOJAS_SISTEMA_.indexOf(n) !== -1; })) return false;
    return !props.some(function (k) { return k === 'PIN_' + p || k === 'MP_TOKEN_' + p || k === 'PRUEBA_7_3_' + p || k.indexOf('SESSION_' + p + '_') === 0; });
  };
  var LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var i = 0; i < 40; i++) {
    var hex = Utilities.getUuid().replace(/-/g, '');
    cands.push(LET[parseInt(hex.substr(0, 2), 16) % 26] + LET[parseInt(hex.substr(2, 2), 16) % 26] + LET[parseInt(hex.substr(4, 2), 16) % 26]);
  }
  for (var j = 0; j < cands.length; j++) if (libre(cands[j]) && _prefijoLibre_(cands[j])) return cands[j];
  return '';
}

// ── ADMIN: panel de pruebas y registros ───────────────────────────────
function registrosPanel(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var cfg = _configAltas_(), cp = _contarPruebas_(), sol = _leerSolicitudes_();
  var ahora = new Date().getTime(), semana = ahora - 7 * 86400000, hoy = _hoyClave_();
  var tz = Session.getScriptTimeZone();
  var fmt = function (d) { return d ? Utilities.formatDate(new Date(d), tz, 'dd/MM HH:mm') : ''; };
  var lista = sol.slice().reverse().slice(0, 150).map(function (s) {
    return { id: s.Solicitud_id, fecha: fmt(s.Fecha), estado: s.Estado, comercio: s.Comercio, responsable: s.Responsable,
             telefono: String(s.Telefono || '').replace(/^'/, ''), correo: s.Correo, prefijo: s.Prefijo, excepcion: s.Excepcion,
             activacion: fmt(s.Fecha_activacion), detalle: s.Detalle,
             atascada: s.Estado === 'CREANDO' && (ahora - new Date(s.Actualizado || s.Fecha).getTime()) > 5 * 60000 };
  });
  var pausada = !cfg.activas;
  var quota = -1; try { quota = MailApp.getRemainingDailyQuota(); } catch (e) {}
  var ins = _estadoInscripcion_();
  return { success: true, config: cfg, pruebas: cp, inscripcion: ins,
    altasHoy: sol.filter(function (s) { return s.Estado === 'ACTIVADA' && s.Origen === 'AUTO' && !s.Excepcion && s.Fecha_activacion && Utilities.formatDate(new Date(s.Fecha_activacion), tz, 'yyyyMMdd') === hoy; }).length,
    nuevosSemana: sol.filter(function (s) { return s.Estado === 'ACTIVADA' && s.Fecha_activacion && new Date(s.Fecha_activacion).getTime() > semana; }).length,
    enEspera: sol.filter(function (s) { return s.Estado === 'LISTA_ESPERA'; }).length,
    pendientesCodigo: sol.filter(function (s) { return s.Estado === 'CODIGO_ENVIADO' || s.Estado === 'HABILITADA'; }).length,
    duplicadosSemana: sol.filter(function (s) { return s.Estado === 'DUPLICADO' && new Date(s.Fecha).getTime() > semana; }).length,
    errores: lista.filter(function (x) { return x.estado === 'ERROR' || x.atascada; }).length,
    codigosHoy: Number(PropertiesService.getScriptProperties().getProperty('REG_COD_DIA_' + hoy) || 0),
    cuotaCorreo: quota, pausada: pausada, solicitudes: lista,
    pagoBloqueado: _entornoPagosSimulados_() ? 'Pagos REALES y los 20 cupos: bloqueados hasta tener el contrato digital revisado. En STAGING está habilitado el registro de pagos SIMULADOS (sin dinero real).'
                                             : 'La contratación paga y los 20 cupos están bloqueados hasta tener el contrato digital revisado.' };
}

function registrosConfig(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var actual = _configAltas_(), nuevo = {};
  nuevo.activas = data.activas === undefined ? actual.activas : data.activas === true;
  var campos = { maxSimultaneas: [0, 500], maxPorDia: [0, 100], maxCodigosPorDia: [0, 90] };
  for (var k in campos) {
    var v = data[k] === undefined ? actual[k] : data[k];
    if (!/^\d{1,3}$/.test(String(v)) || Number(v) < campos[k][0] || Number(v) > campos[k][1]) return { error: 'Valor inválido para ' + k + ' (' + campos[k][0] + ' a ' + campos[k][1] + ')' };
    nuevo[k] = Number(v);
  }
  var firma = _firma_(['altas', actual, nuevo]);
  var cp = _contarPruebas_();
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, antes: actual, despues: nuevo, firma: firma,
    impacto: 'Solo cambia las altas NUEVAS. Las ' + cp.operando + ' pruebas que hoy operan no cambian: ni fechas ni accesos.' };
  return _conLock_(function () {
    if (_firma_(['altas', _configAltas_(), nuevo]) !== data.firma) return { error: 'La configuración cambió desde la vista previa.' };
    var props = PropertiesService.getScriptProperties();
    props.setProperty('ALTAS_AUTO_CONFIG', JSON.stringify(nuevo));
    var hist = []; try { hist = JSON.parse(props.getProperty('ALTAS_AUTO_HIST') || '[]'); } catch (e) {}
    hist.push({ fecha: new Date().toISOString(), antes: actual, despues: nuevo }); hist = hist.slice(-20);
    props.setProperty('ALTAS_AUTO_HIST', JSON.stringify(hist));
    _limpiarCachePublica_();
    return { success: true, config: nuevo, mensaje: '✅ Configuración de altas guardada' };
  });
}

// Acciones de Admin sobre una solicitud: rechazar, habilitar (excepción) o reintentar un alta cortada.
function registroAccion(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var accion = String(data.accion || '');
  if (['rechazar', 'habilitar', 'reintentar'].indexOf(accion) === -1) return { error: 'Acción inválida' };
  var s0 = _buscarSolicitud_(data.solicitudId);
  if (!s0) return { error: 'Solicitud no encontrada' };
  var permitido = { rechazar: ['CODIGO_ENVIADO', 'LISTA_ESPERA', 'HABILITADA'], habilitar: ['LISTA_ESPERA'], reintentar: ['ERROR', 'CREANDO'] }[accion];
  if (permitido.indexOf(s0.Estado) === -1) return { error: 'No se puede ' + accion + ' una solicitud en estado ' + s0.Estado };
  if (data.confirmar !== true) {
    var txt = { rechazar: 'Se marca RECHAZADA. No se crea nada y el código pendiente deja de servir.',
                habilitar: 'Excepción de Admin: se le envía un correo para que verifique de nuevo su correo y cree la prueba aunque se haya alcanzado el límite. Igual se controla que no tenga una prueba anterior.',
                reintentar: 'Se revisa qué quedó del alta: si está completa, se activa con un PIN nuevo; si no quedó nada, se crea; si quedaron solo hojas vacías recién creadas (sin registros ni accesos), se limpian y se crea; si quedó algo más, queda para revisión manual (no se borra nada).' }[accion];
    return { success: true, vistaPrevia: true, accion: accion, solicitud: { comercio: s0.Comercio, correo: s0.Correo, estado: s0.Estado }, impacto: txt };
  }
  return _conLock_(function () {
    var s = _buscarSolicitud_(data.solicitudId);
    if (permitido.indexOf(s.Estado) === -1) return { error: 'La solicitud cambió de estado (' + s.Estado + ')' };
    var props = PropertiesService.getScriptProperties();
    if (accion === 'rechazar') {
      props.deleteProperty('REG_OTP_' + s.Solicitud_id);
      _guardarSolicitud_(s, { Estado: 'RECHAZADA', Detalle: 'Rechazada por Admin' + (data.motivo ? ': ' + String(data.motivo).substring(0, 200) : '') });
      return { success: true, mensaje: 'Solicitud rechazada' };
    }
    if (accion === 'habilitar') {
      var ya = _pruebaYaUsada_(String(s.Telefono), s.Correo);
      if (ya) { _guardarSolicitud_(s, { Estado: 'DUPLICADO', Detalle: 'Ya existe el negocio ' + ya }); return { error: 'No se puede: ya tiene una prueba (' + ya + ')' }; }
      var exc = 'Admin ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
      _guardarSolicitud_(s, { Estado: 'HABILITADA', Excepcion: exc });
      var err = _enviarCorreo_(s.Correo, 'Ya podés crear tu prueba de VAO POS',
        'Hola ' + s.Responsable + ':\n\nYa hay lugar para tu prueba gratuita de VAO POS.\nEntrá acá para confirmar tu correo y crearla:\n' +
        SISTEMA.url + 'planes.html?s=' + s.Solicitud_id + '\n\nVAO Sistemas');
      return { success: true, mensaje: 'Habilitada (excepción registrada)' + (err ? ' · ⚠️ ' + err : ' · correo enviado') };
    }
    var rr = _reanudarAlta_(s, true);
    if (rr && rr.pin) { delete rr.pin; rr.mensaje = '✅ Alta de ' + rr.prefijo + ' completada. El PIN se envió solo al correo del comercio.'; } // v032
    return rr;
  });
}


// =====================================================================
// v032 — VERIFICACIÓN DE CÓDIGO (compartida) Y RECORDATORIO DEL DÍA 5
// =====================================================================
function _verificarCodigoRegistro_(s, codigo) {
  var props = PropertiesService.getScriptProperties(), k = 'REG_OTP_' + s.Solicitud_id;
  var otp = null; try { otp = JSON.parse(props.getProperty(k) || 'null'); } catch (e) { otp = null; }
  var reanudar = s.Estado === 'CREANDO';
  if (!otp) return { ok: false, respuesta: { error: reanudar ? 'Para terminar tu prueba, pedí un código nuevo a tu correo.' : 'El código venció o ya se usó. Pedí uno nuevo.', codigoVencido: true, reanudar: reanudar } };
  if (new Date().getTime() > otp.exp) { props.deleteProperty(k); return { ok: false, respuesta: { error: 'El código venció. Pedí uno nuevo.', codigoVencido: true, reanudar: reanudar } }; }
  if (otp.intentos >= 5) { props.deleteProperty(k); return { ok: false, respuesta: { error: 'Demasiados intentos. Pedí un código nuevo.', codigoVencido: true, reanudar: reanudar } }; }
  var cod = String(codigo || '').replace(/\D/g, '');
  if (cod.length !== 6 || !_hashCoincide_(cod, otp.h, 'REG|' + s.Solicitud_id)) {
    otp.intentos++; props.setProperty(k, JSON.stringify(otp));
    return { ok: false, respuesta: { error: 'Código incorrecto. Te quedan ' + Math.max(0, 5 - otp.intentos) + ' intento(s).', codigoIncorrecto: true } };
  }
  props.deleteProperty(k);                                                     // un solo uso
  return { ok: true };
}

// ── Recordatorio por correo, UNA vez, el día 5 de la PRUEBA (quedan 2 de los 7 días) ──
// Lo ejecuta un disparador diario de Apps Script (instalarRecordatorioDiario), NO el POS.
// Solo lee CLIENTES_VAO y escribe la marca RECORDATORIO_D5_<prefijo>. No toca el negocio ni la prueba.
// Si un día el disparador no corrió, al día siguiente (6 o 7) se envía igual, con los días que quedan.
var RESERVA_CORREOS_ = 10;          // se dejan libres para los códigos de registro
var MAX_RECORDATORIOS_POR_CORRIDA_ = 40;

function _textoPlanesCorreo_() {
  var pp = getPlanesPublicos({}), lineas = [];
  (pp.planes || []).forEach(function (p) {
    if (p.codigo === 'PRUEBA' || !p.contratable) return;
    if (p.cotizacion) { lineas.push('• ' + p.nombre + ': cotización a medida.'); return; }
    if (p.precioRegular === null || p.precioRegular === undefined) return;
    var t = '• ' + p.nombre + ': $' + Number(p.precioRegular).toLocaleString('es-AR') + ' por mes';
    if (p.conPromo && pp.promo) t += ' (oferta de lanzamiento: $' + Number(p.precioLanzamiento).toLocaleString('es-AR') + ' por mes durante los primeros ' + pp.promo.meses + ' meses, según cupo disponible)';
    lineas.push(t + '.');
  });
  return lineas.length ? 'Planes y precios vigentes (en pesos argentinos):\n' + lineas.join('\n') : 'Consultanos los planes y precios vigentes respondiendo este correo.';
}

function _textoRecordatorio_(nombreNegocio, contacto, cp) {
  var quedan = Math.max(0, DIAS_PRUEBA_ - cp.dia);
  var cuando = quedan === 0 ? 'hoy es el último día' : (quedan === 1 ? 'te queda 1 día' : 'te quedan ' + quedan + ' días');
  return 'Hola' + (contacto ? ' ' + contacto : '') + ':\n\n' +
    'Tu prueba gratuita de VAO POS para "' + nombreNegocio + '" termina el ' + cp.venceTxt + ' (' + cuando + ' de los 7 gratuitos).\n' +
    'Después tenés 3 días de gracia, hasta el ' + cp.finGraciaTxt + '. Desde el día siguiente no se pueden registrar ventas nuevas, pero tus datos quedan guardados y los podés consultar y descargar.\n\n' +
    _textoPlanesCorreo_() + '\n\n' +
    'Para contratar un plan, respondé este correo indicando cuál te interesa. VAO Sistemas te va a enviar el contrato y las condiciones antes de cualquier pago.\n\n' +
    'Este es el único recordatorio que te enviamos sobre tu prueba.\nVAO Sistemas';
}

// Ejecutada por el disparador diario. Devuelve un resumen (también queda en el registro de ejecuciones).
function enviarRecordatoriosPrueba() {
  var res = { enviados: 0, yaEnviados: 0, errores: 0, sinCupo: false, revisar: [] };
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO');
  if (!h) return res;
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  var filas = h.getDataRange().getValues().slice(1);
  for (var i = 0; i < filas.length; i++) {
    if (res.enviados >= MAX_RECORDATORIOS_POR_CORRIDA_) break;
    var f = filas[i], p = _normalizarPrefijo_(f[0]);
    if (!p || _normalizarPlan_(f[5]) !== 'PRUEBA' || String(f[6] || '').toUpperCase() === 'SUSPENDIDO') continue;
    var correo = _correoPublico_(f[4]);
    if (!correo || !todas['PRUEBA_7_3_' + p]) continue;                       // sin correo válido o PRUEBA vieja sin fechas
    var alta = null; try { alta = _fechaValida_(JSON.parse(todas['PRUEBA_7_3_' + p]).alta); } catch (e) {}
    if (!alta) continue;
    var cp = _calcularPrueba_(alta);
    if (cp.dia < 5 || cp.dia > DIAS_PRUEBA_) continue;                          // solo días 5 a 7 (5 = el previsto)
    var k = 'RECORDATORIO_D5_' + p;
    var m0 = {}; try { m0 = JSON.parse(todas[k] || '{}'); } catch (e) { m0 = {}; }
    if (m0.estado === 'ENVIADO') { res.yaEnviados++; continue; }
    if (m0.estado === 'ENVIANDO') { res.revisar.push(p); continue; }           // pudo haberse enviado: no se repite
    if (m0.estado === 'ERROR' && (m0.intentos || 0) >= 3) continue;
    var cupo = 0; try { cupo = MailApp.getRemainingDailyQuota(); } catch (e) { cupo = 0; }
    if (cupo <= RESERVA_CORREOS_) { res.sinCupo = true; break; }              // se reintenta en la próxima corrida
    // Marca ANTES de enviar (con un lock corto, para que dos corridas no envíen el mismo correo)
    var lock = LockService.getScriptLock(), tengo = false;
    try { tengo = lock.tryLock(5000); } catch (e) { tengo = false; }
    if (!tengo) continue;                                                       // el POS está escribiendo: se reintenta mañana
    try {
      var m1 = {}; try { m1 = JSON.parse(props.getProperty(k) || '{}'); } catch (e) { m1 = {}; }
      if (m1.estado === 'ENVIADO' || m1.estado === 'ENVIANDO') { res.yaEnviados++; continue; }
      props.setProperty(k, JSON.stringify({ estado: 'ENVIANDO', fecha: new Date().toISOString(), dia: cp.dia, intentos: (m1.intentos || 0) + 1 }));
    } finally { lock.releaseLock(); }
    var err = '';
    try { MailApp.sendEmail({ to: correo, subject: 'Tu prueba de VAO POS termina el ' + cp.venceTxt, body: _textoRecordatorio_(String(f[1] || p), String(f[2] || ''), cp), name: 'VAO POS' }); }
    catch (e) { err = String(e.message || e); }
    var m2 = JSON.parse(props.getProperty(k));
    if (err) { m2.estado = 'ERROR'; m2.error = err.substring(0, 200); res.errores++; }
    else { m2.estado = 'ENVIADO'; m2.enviado = new Date().toISOString(); res.enviados++; }
    props.setProperty(k, JSON.stringify(m2));
  }
  Logger.log('Recordatorios día 5: ' + JSON.stringify(res));
  return res;
}

// Ejecutar UNA vez desde el editor (Apps Script pide autorizar los disparadores). Deja uno solo, diario, ~10 h.
function instalarRecordatorioDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'enviarRecordatoriosPrueba') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarRecordatoriosPrueba').timeBased().everyDays(1).atHour(10).create();
  Logger.log('Recordatorio diario instalado (enviarRecordatoriosPrueba, todos los días cerca de las 10 h)');
}
function quitarRecordatorioDiario() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'enviarRecordatoriosPrueba') { ScriptApp.deleteTrigger(t); n++; } });
  Logger.log('Disparadores quitados: ' + n);
}
// Desde el editor: muestra en el registro el texto que recibiría un negocio, SIN enviar nada.
function vistaPreviaRecordatorio(prefijo) {
  prefijo = _normalizarPrefijo_(prefijo);
  var fc = _filaClientesVao_(prefijo);
  var m = PropertiesService.getScriptProperties().getProperty('PRUEBA_7_3_' + prefijo);
  if (!fc || !m) { Logger.log(prefijo + ': no es una PRUEBA con fechas'); return ''; }
  var t = _textoRecordatorio_(String(fc.datos[1] || prefijo), String(fc.datos[2] || ''), _calcularPrueba_(_fechaValida_(JSON.parse(m).alta)));
  Logger.log(t);
  return t;
}


// =====================================================================
// v033 — VIGENCIA DE PLANES PAGOS (períodos mensuales, pagos, cortesía, regularización)
// =====================================================================
// El POS NO cambia: sigue leyendo SOLO CLIENTES_VAO.I (Fecha Vence). Este módulo escribe
// esa columna únicamente desde acciones de Admin con vista previa y confirmación, y deja el
// historial en PERIODOS_VAO (solo se agregan filas). Un plan pago se activa o se cambia SOLO
// registrando el pago (D7: el cambio entre planes pagos se aplica al confirmar la renovación).
// Pagos REALES: bloqueados en todo entorno hasta el contrato. En STAGING: pagos SIMULADOS (D4).

var MSJ_PLAN_POR_PAGO_ = 'Un plan pago se activa o se cambia registrando el pago confirmado de la renovación con el plan nuevo (💳 Vigencia y pagos). El cambio de plan por sí solo no confirma un pago ni da días.';
var PER_ENC_ = ['Registro_id', 'Prefijo', 'Plan', 'Tipo', 'Inicio', 'Fin', 'Ancla', 'Ciclo', 'Importe', 'Moneda', 'Medio', 'Referencia',
                'Fecha_pago', 'Clave', 'Motivo', 'Admin', 'Fecha_registro', 'Fin_promo'];
var PC_ = {}; PER_ENC_.forEach(function (n, i) { PC_[n] = i; });
var TIPOS_CONTRATO_ = ['PAGO', 'PAGO_SIMULADO', 'REGULARIZACION'];   // cuentan como "período contratado"
var MEDIOS_PAGO_ = ['TRANSFERENCIA', 'MERCADO_PAGO', 'EFECTIVO', 'OTRO'];

// D4 — pagos SIMULADOS solo en la planilla de STAGING. El ID está escrito ACÁ (no en SISTEMA):
// si este código se copia a PRODUCCIÓN, la planilla activa tiene otro ID y esto devuelve false.
function _entornoPagosSimulados_() {
  var PLANILLA_STAGING = '1xgx98_heCPfvAntUwsbIgtAZNquOcN2L34EBEwwL3Oo';
  try { if (SpreadsheetApp.getActiveSpreadsheet().getId() !== PLANILLA_STAGING) return false; } catch (e) { return false; }
  if (SISTEMA.entorno !== 'staging') return false;
  return PropertiesService.getScriptProperties().getProperty('PAGOS_SIMULADOS_STAGING') === 'SI'; // se carga a mano en el editor
}

// ── fechas calendario ────────────────────────────────────────────────
function _diasDelMes_(y, m) { return new Date(y, m + 1, 0).getDate(); }
function _aniversario_(y, m, ancla) { var yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12; return new Date(yy, mm, Math.min(ancla, _diasDelMes_(yy, mm))); }
// Período mensual: del inicio al día ANTERIOR al próximo aniversario (el fin está incluido).
function _periodoMensual_(inicio, ancla) {
  var a = _diaSolo_(inicio);
  var prox = _aniversario_(a.getFullYear(), a.getMonth() + 1, ancla);
  return { inicio: a, fin: _sumarDias_(prox, -1), proxima: prox };
}
function _unMesAdelante_(d) { var a = _diaSolo_(d); return _aniversario_(a.getFullYear(), a.getMonth() + 1, a.getDate()); }
function _fechaISOaDia_(t) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || ''));
  if (!m) return null;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) ? d : null;
}

// ── historial ────────────────────────────────────────────────────────
function _hojaPeriodos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), h = ss.getSheetByName('PERIODOS_VAO');
  if (!h) h = ss.insertSheet('PERIODOS_VAO');
  if (h.getLastRow() === 0) h.getRange(1, 1, 1, PER_ENC_.length).setValues([PER_ENC_]);   // también si un corte la dejó sin encabezado
  return h;
}
function _leerPeriodos_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PERIODOS_VAO');
  if (!h) return [];
  return h.getDataRange().getValues().slice(1).map(function (r) {
    var o = {}; PER_ENC_.forEach(function (n, k) { o[n] = r[k]; });
    o.Inicio = _fechaValida_(o.Inicio); o.Fin = _fechaValida_(o.Fin);
    o.Prefijo = _normalizarPrefijo_(o.Prefijo); return o;
  });
}
function _periodosDe_(prefijo, todos) { return (todos || _leerPeriodos_()).filter(function (r) { return r.Prefijo === prefijo && r.Fin && r.Tipo !== 'SINCRONIZACION'; }); }
function _ultimoPorFin_(lista) { var u = null; lista.forEach(function (r) { if (!u || _diaSolo_(r.Fin).getTime() >= _diaSolo_(u.Fin).getTime()) u = r; }); return u; }
function _claveCambioPago_(p) { return 'PAGO_EN_CURSO_' + p; }
function _pagoPendiente_(p) { var v = PropertiesService.getScriptProperties().getProperty(_claveCambioPago_(p)); if (!v) return null; try { return JSON.parse(v); } catch (e) { return { ilegible: true }; } }

// Estado comercial para Admin (no se usa en el POS).
function _estadoComercial_(prefijo, codPlan, vig, todos, props) {
  if (codPlan === 'PRUEBA') return { tipo: 'PRUEBA' };
  var mios = _periodosDe_(prefijo, todos), ult = _ultimoPorFin_(mios);
  var pagos = mios.filter(function (r) { return r.Tipo === 'PAGO' || r.Tipo === 'PAGO_SIMULADO'; });
  var up = pagos.length ? pagos[pagos.length - 1] : null;
  var fi = vig && vig.fechaVence ? _diaSolo_(new Date(vig.fechaVence)) : null;
  var estado;
  if (!mios.length) estado = fi ? 'HISTORICO_CON_FECHA' : 'HISTORICO_SIN_FECHA';
  else if (!fi || fi.getTime() !== _diaSolo_(ult.Fin).getTime()) estado = 'DESINCRONIZADO';
  else estado = vig.vigente ? (vig.enTolerancia ? 'EN_TOLERANCIA' : 'VIGENTE') : 'VENCIDO';
  var tz = Session.getScriptTimeZone(), f = function (d) { return d ? Utilities.formatDate(new Date(d), tz, 'dd/MM/yyyy') : ''; };
  return {
    tipo: 'PAGO', estado: estado, historico: !mios.length,
    planAsignado: codPlan,
    ultimoPago: up ? { fecha: f(up.Fecha_registro), importe: up.Importe, medio: up.Medio, referencia: String(up.Referencia || '').replace(/^'/, ''), simulado: up.Tipo === 'PAGO_SIMULADO' } : null,
    periodo: ult ? { inicio: f(ult.Inicio), fin: f(ult.Fin), tipo: ult.Tipo } : (fi ? { inicio: '', fin: f(fi), tipo: 'HISTORICO' } : null),
    proximaRenovacion: ult ? f(_sumarDias_(_diaSolo_(ult.Fin), 1)) : (fi ? f(_sumarDias_(fi, 1)) : ''),
    finPromo: '',   // la oferta exige contrato aceptado (todavía no existe)
    pagoEnCurso: !!(props && props[_claveCambioPago_(prefijo)])
  };
}

// ── cálculo del próximo período pago (D1, D5, D6 y aclaración 1) ─────
function _proximoPeriodoPago_(prefijo, planActual, todos) {
  var hoy = _diaSolo_(new Date()), mios = _periodosDe_(prefijo, todos), ult = _ultimoPorFin_(mios);
  var inicio = null, ancla = null, ciclo = 'NUEVO';
  if (planActual !== 'PRUEBA') {
    if (ult && _diaSolo_(ult.Fin).getTime() >= hoy.getTime()) {              // renueva ANTES de vencer: se encadena
      inicio = _sumarDias_(_diaSolo_(ult.Fin), 1); ciclo = 'RENOVACION';
      ancla = (ult.Tipo === 'CORTESIA' || !Number(ult.Ancla)) ? inicio.getDate() : Number(ult.Ancla);   // D6: después de una cortesía, ancla nueva
    } else if (!ult) {                                                        // histórico con fecha todavía vigente
      var vf = _obtenerVigenciaCliente_(prefijo).fechaVence;
      if (vf && _diaSolo_(new Date(vf)).getTime() >= hoy.getTime()) { inicio = _sumarDias_(_diaSolo_(new Date(vf)), 1); ancla = inicio.getDate(); ciclo = 'RENOVACION'; }
    }
  }
  if (!inicio) { inicio = hoy; ancla = hoy.getDate(); ciclo = 'NUEVO'; }      // primer pago, desde PRUEBA o después de vencer: ciclo nuevo
  var pm = _periodoMensual_(inicio, ancla);
  return { inicio: pm.inicio, fin: pm.fin, ancla: ancla, ciclo: ciclo };
}

// Cambio de plan con el orden seguro de v030 (sin reglas comerciales: las controla quien llama). Requiere el lock.
function _ejecutarCambioPlanInterno_(prefijo, codigo, planActual, p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reg = { v: 33, de: planActual, a: codigo, ts: new Date().getTime(), origen: 'pago',
              cambios: p.cambios.map(function (c) { return { clave: c.clave, nombre: c.nombre, actual: c.actual, nuevo: c.nuevo }; }) };
  PropertiesService.getScriptProperties().setProperty(_claveCambioPlan_(prefijo), JSON.stringify(reg));
  _aplicarCambiosModulos_(prefijo, p.cambios.filter(function (c) { return !c.nuevo; }));
  _escribirPlan_(ss.getSheetByName('VENDEDORES'), prefijo, 5, codigo);
  _escribirPlan_(ss.getSheetByName('CLIENTES_VAO'), prefijo, 6, codigo);
  _aplicarCambiosModulos_(prefijo, p.cambios.filter(function (c) { return c.nuevo; }));
  PropertiesService.getScriptProperties().deleteProperty(_claveCambioPlan_(prefijo));
  _cachePlanes_ = null;
}
function _escribirVence_(prefijo, fin) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CLIENTES_VAO'), f = _filaPrefijo_(h, prefijo);
  if (f === -1) throw new Error('No se encontró ' + prefijo + ' en CLIENTES_VAO');
  var actual = _fechaValida_(h.getRange(f, 9).getValue());
  if (!actual || _diaSolo_(actual).getTime() !== _diaSolo_(fin).getTime()) h.getRange(f, 9).setValue(_diaSolo_(fin));
}
function _filaPeriodo_(o) { return PER_ENC_.map(function (n) { return o[n] === undefined ? '' : o[n]; }); }
function _adminTexto_() { return 'Admin ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'); }
function _bloqueosComunes_(prefijo) {
  if (_pagoPendiente_(prefijo)) return 'Hay un pago a medio registrar en ' + prefijo + ': completalo primero.';
  if (_cambioPlanPendiente_(prefijo)) return 'Hay un cambio de plan sin terminar en ' + prefijo + ': resolvelo en el checkpoint primero.';
  return '';
}
function _fmtDia_(d) { return d ? Utilities.formatDate(_diaSolo_(new Date(d)), Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''; }

// ── REGISTRAR PAGO (Admin) ───────────────────────────────────────────
function confirmarPagoRecibido(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  if (!_entornoPagosSimulados_()) return { error: 'La contratación paga está bloqueada: falta el contrato digital implementado y revisado jurídicamente. No se registró ningún pago ni se tocó ningún cupo.', bloqueado: true };
  var prefijo = _normalizarPrefijo_(data.prefijo), destino = _normalizarPlan_(data.plan);
  var clave = String(data.clave || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(clave)) return { error: 'Falta la clave de la operación (recargá la ficha)' };
  if (!obtenerInfoCliente(prefijo)) return { error: 'Cliente no encontrado' };
  // un pago a medio registrar se completa primero (no se informa "ya registrado" si quedó incompleto)
  var bl = _bloqueosComunes_(prefijo); if (bl) return { error: bl, pagoEnCurso: !!_pagoPendiente_(prefijo) };
  // tocar dos veces: si la clave ya existe, se devuelve lo ya registrado
  var todos = _leerPeriodos_();
  var ya = todos.filter(function (r) { return String(r.Clave) === clave; })[0];
  if (ya) return { success: true, yaRegistrado: true, prefijo: prefijo, inicio: _fmtDia_(ya.Inicio), fin: _fmtDia_(ya.Fin), mensaje: 'Ese pago ya estaba registrado (no se duplicó).' };
  var pl = _leerPlanes_(), plan = pl.planes[destino];
  if (!plan || destino === 'PRUEBA') return { error: 'Elegí un plan pago' };
  if (!plan.activo || plan.contratable === false) return { error: 'El plan ' + plan.nombre + ' no se puede contratar' };
  var importe = String(data.importe || '');
  if (!/^\d{1,9}$/.test(importe) || Number(importe) <= 0) return { error: 'Importe inválido (entero, sin puntos)' };
  var medio = String(data.medio || '').toUpperCase();
  if (MEDIOS_PAGO_.indexOf(medio) === -1) return { error: 'Elegí el medio de pago' };
  var referencia = String(data.referencia || '').replace(/[\u0000-\u001F]/g, ' ').trim().substring(0, 80);
  if (/^[=+\-@]/.test(referencia)) return { error: 'Referencia inválida' };
  var fechaPago = data.fechaPago ? _fechaISOaDia_(data.fechaPago) : _diaSolo_(new Date());
  if (!fechaPago || fechaPago.getTime() > _diaSolo_(new Date()).getTime()) return { error: 'Fecha de pago inválida (no puede ser futura)' };
  var planActual = _planDeNegocio_(prefijo);
  var per = _proximoPeriodoPago_(prefijo, planActual, todos);
  var p = destino !== planActual ? _planificarModulos_(prefijo, destino) : { cambios: [], contradicciones: [] };
  if (p.error) return { error: p.error };
  var avisos = [];
  if (destino !== planActual) avisos.push(planActual === 'PRUEBA' ? 'Termina la PRUEBA: el negocio pasa a ' + plan.nombre + '.' : 'Cambio de plan ' + planActual + ' → ' + destino + ' al confirmar esta renovación (D7).');
  if (plan.precioRegular !== null && plan.precioRegular !== undefined && Number(importe) !== plan.precioRegular) avisos.push('El importe ($' + importe + ') no coincide con el precio de lista de ' + plan.nombre + ' ($' + plan.precioRegular + '). Se registra igual.');
  if (referencia && todos.some(function (r) { return String(r.Referencia).replace(/^'/, '') === referencia; })) avisos.push('⚠️ Esa referencia ya figura en otro pago.');
  var info = obtenerInfoCliente(prefijo);
  if (info && !info.activo) avisos.push('El negocio está SUSPENDIDO: registrar el pago no lo reactiva (eso se hace aparte).');
  avisos.push('SIMULADO (STAGING): no hay dinero real.');
  var firma = _firma_(['pago', prefijo, planActual, destino, _fmtDia_(per.inicio), _fmtDia_(per.fin), per.ancla, importe, medio, referencia, p.cambios]);
  var resumen = { prefijo: prefijo, planActual: planActual, planNuevo: destino, planNombre: plan.nombre, inicio: _fmtDia_(per.inicio), fin: _fmtDia_(per.fin),
                  proxima: _fmtDia_(_sumarDias_(per.fin, 1)), ancla: per.ancla, ciclo: per.ciclo, importe: Number(importe), medio: medio, referencia: referencia,
                  seActivan: p.cambios.filter(function (c) { return c.nuevo; }).map(function (c) { return c.nombre; }),
                  seDesactivan: p.cambios.filter(function (c) { return !c.nuevo; }).map(function (c) { return c.nombre; }), avisos: avisos, simulado: true };
  if (data.confirmar !== true) return Object.assign({ success: true, vistaPrevia: true, firma: firma }, resumen);
  return _conLock_(function () {
    var bl2 = _bloqueosComunes_(prefijo); if (bl2) return { error: bl2, pagoEnCurso: !!_pagoPendiente_(prefijo) };
    var todos2 = _leerPeriodos_();
    if (todos2.some(function (r) { return String(r.Clave) === clave; })) return { success: true, yaRegistrado: true, prefijo: prefijo, mensaje: 'Ese pago ya estaba registrado (no se duplicó).' };
    var pa2 = _planDeNegocio_(prefijo), per2 = _proximoPeriodoPago_(prefijo, pa2, todos2);
    var p2 = destino !== pa2 ? _planificarModulos_(prefijo, destino) : { cambios: [] };
    if (_firma_(['pago', prefijo, pa2, destino, _fmtDia_(per2.inicio), _fmtDia_(per2.fin), per2.ancla, importe, medio, referencia, p2.cambios]) !== data.firma)
      return { error: 'Algo cambió desde la vista previa: volvé a revisarla.', firmaVieja: true };
    var fila = _filaPeriodo_({ Registro_id: Utilities.getUuid(), Prefijo: prefijo, Plan: destino, Tipo: 'PAGO_SIMULADO', Inicio: per2.inicio, Fin: per2.fin,
      Ancla: per2.ancla, Ciclo: per2.ciclo, Importe: Number(importe), Moneda: 'ARS', Medio: medio, Referencia: referencia ? "'" + referencia : '',
      Fecha_pago: fechaPago, Clave: clave, Motivo: '', Admin: _adminTexto_(), Fecha_registro: new Date(), Fin_promo: '' });
    // 1) registro de recuperación  2) historial  3) plan (si cambia)  4) Fecha Vence  5) fin
    PropertiesService.getScriptProperties().setProperty(_claveCambioPago_(prefijo), JSON.stringify({ clave: clave, destino: destino, de: pa2, fin: per2.fin.toISOString(), fila: fila, ts: new Date().getTime() }));
    _hojaPeriodos_().appendRow(fila);
    if (destino !== pa2) _ejecutarCambioPlanInterno_(prefijo, destino, pa2, p2);
    _escribirVence_(prefijo, per2.fin);
    PropertiesService.getScriptProperties().deleteProperty(_claveCambioPago_(prefijo));
    return Object.assign({ success: true, registrado: true, mensaje: '✅ Pago SIMULADO registrado: ' + destino + ' del ' + _fmtDia_(per2.inicio) + ' al ' + _fmtDia_(per2.fin) }, resumen,
      { inicio: _fmtDia_(per2.inicio), fin: _fmtDia_(per2.fin), ciclo: per2.ciclo, ancla: per2.ancla });
  });
}

// Un pago quedó a medio registrar (corte de Apps Script): se completa sin duplicar.
function recuperarPagoEnCurso(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo), reg = _pagoPendiente_(prefijo);
  if (!reg) return { error: prefijo + ' no tiene pagos a medio registrar' };
  if (reg.ilegible) return { error: 'El registro del pago pendiente está dañado: revisión manual (no se aplica nada a ciegas).' };
  var hayFila = _leerPeriodos_().some(function (r) { return String(r.Clave) === String(reg.clave); });
  var planOk = _planDeNegocio_(prefijo) === reg.destino;
  var vf = _obtenerVigenciaCliente_(prefijo).fechaVence;
  var venceOk = vf && _diaSolo_(new Date(vf)).getTime() === _diaSolo_(new Date(reg.fin)).getTime();
  var faltan = [];
  if (!hayFila) faltan.push('fila del pago en PERIODOS_VAO'); if (!planOk) faltan.push('plan ' + reg.destino); if (!venceOk) faltan.push('Fecha Vence ' + _fmtDia_(reg.fin));
  if (data.confirmar !== true) return { success: true, vistaPrevia: true, faltan: faltan, mensaje: faltan.length ? 'Falta completar: ' + faltan.join(', ') : 'Todo aplicado: solo falta cerrar el registro.' };
  return _conLock_(function () {
    var r2 = _pagoPendiente_(prefijo); if (!r2) return { error: 'Ya no hay pago pendiente' };
    if (_cambioPlanPendiente_(prefijo)) return { error: 'Primero completá o revertí el cambio de plan pendiente (checkpoint).' };
    if (!_leerPeriodos_().some(function (r) { return String(r.Clave) === String(r2.clave); })) {
      var fila = r2.fila.slice(); fila[PC_.Inicio] = _fechaValida_(fila[PC_.Inicio]); fila[PC_.Fin] = _fechaValida_(fila[PC_.Fin]);
      fila[PC_.Fecha_pago] = _fechaValida_(fila[PC_.Fecha_pago]); fila[PC_.Fecha_registro] = _fechaValida_(fila[PC_.Fecha_registro]);
      _hojaPeriodos_().appendRow(fila);
    }
    var pa = _planDeNegocio_(prefijo);
    if (pa !== r2.destino) { var p = _planificarModulos_(prefijo, r2.destino); if (p.error) return { error: p.error }; _ejecutarCambioPlanInterno_(prefijo, r2.destino, pa, p); }
    _escribirVence_(prefijo, new Date(r2.fin));
    PropertiesService.getScriptProperties().deleteProperty(_claveCambioPago_(prefijo));
    return { success: true, mensaje: '✅ Pago completado: ' + r2.destino + ' hasta el ' + _fmtDia_(r2.fin) };
  });
}

// ── CORTESÍA (sin pago; D3, D9) ──────────────────────────────────────
function registrarCortesia(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo), plan = _planDeNegocio_(prefijo);
  if (!plan || plan === 'PRUEBA') return { error: 'La cortesía es solo para planes pagos (la prueba no se extiende).' };
  var dias = String(data.dias || '');
  if (!/^[1-7]$/.test(dias)) return { error: 'La cortesía es de 1 a 7 días.' };
  var motivo = String(data.motivo || '').replace(/[\u0000-\u001F]/g, ' ').trim();
  if (motivo.length < 5 || motivo.length > 200 || /^[=+\-@]/.test(motivo)) return { error: 'El motivo es obligatorio (5 a 200 caracteres).' };
  var calcular = function () {
    var mios = _periodosDe_(prefijo), contratos = mios.filter(function (r) { return TIPOS_CONTRATO_.indexOf(r.Tipo) !== -1; });
    if (!contratos.length) return { error: 'Este negocio no tiene un período contratado registrado: primero regularizalo o registrá un pago.' };
    var ultC = _ultimoPorFin_(contratos), ult = _ultimoPorFin_(mios);
    var yaUsada = mios.some(function (r) { return r.Tipo === 'CORTESIA' && r.Inicio && _diaSolo_(r.Inicio).getTime() > _diaSolo_(ultC.Inicio || ultC.Fin).getTime(); });
    if (yaUsada || ult.Tipo === 'CORTESIA') return { error: 'Ya se dio una cortesía en este período contratado (máximo una; no se encadenan).' };
    var hoy = _diaSolo_(new Date());
    var inicio = _diaSolo_(ult.Fin).getTime() >= hoy.getTime() ? _sumarDias_(_diaSolo_(ult.Fin), 1) : hoy;
    return { inicio: inicio, fin: _sumarDias_(inicio, Number(dias) - 1) };
  };
  var bl = _bloqueosComunes_(prefijo); if (bl) return { error: bl };
  var c = calcular(); if (c.error) return c;
  var firma = _firma_(['cortesia', prefijo, _fmtDia_(c.inicio), _fmtDia_(c.fin), motivo]);
  var res = { prefijo: prefijo, inicio: _fmtDia_(c.inicio), fin: _fmtDia_(c.fin), dias: Number(dias), motivo: motivo,
              aviso: 'Cortesía SIN PAGO: no cuenta como pago, no cambia el plan ni consume promociones. El próximo pago empezará al terminar la cortesía, con ancla nueva.' };
  if (data.confirmar !== true) return Object.assign({ success: true, vistaPrevia: true, firma: firma }, res);
  return _conLock_(function () {
    var bl2 = _bloqueosComunes_(prefijo); if (bl2) return { error: bl2 };
    var c2 = calcular(); if (c2.error) return c2;
    if (_firma_(['cortesia', prefijo, _fmtDia_(c2.inicio), _fmtDia_(c2.fin), motivo]) !== data.firma) return { error: 'Algo cambió desde la vista previa: volvé a revisarla.' };
    _hojaPeriodos_().appendRow(_filaPeriodo_({ Registro_id: Utilities.getUuid(), Prefijo: prefijo, Plan: plan, Tipo: 'CORTESIA', Inicio: c2.inicio, Fin: c2.fin,
      Ancla: '', Ciclo: '', Motivo: motivo, Admin: _adminTexto_(), Fecha_registro: new Date() }));
    _escribirVence_(prefijo, c2.fin);
    return Object.assign({ success: true, mensaje: '✅ Cortesía sin pago: hasta el ' + _fmtDia_(c2.fin) }, res);
  });
}

// ── REGULARIZAR histórico (D2, D8) ───────────────────────────────────
function regularizarVigencia(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo), plan = _planDeNegocio_(prefijo);
  if (!plan || plan === 'PRUEBA') return { error: 'Solo se regularizan planes pagos (la PRUEBA tiene su propia regularización).' };
  if (_periodosDe_(prefijo).length) return { error: 'Este negocio ya tiene historial de períodos: se renueva con pagos (o cortesía), no se regulariza.' };
  var fin = _fechaISOaDia_(data.fin), inicio = data.inicio ? _fechaISOaDia_(data.inicio) : null;
  if (!fin) return { error: 'Fecha de fin inválida' };
  if (data.inicio && (!inicio || inicio.getTime() > fin.getTime())) return { error: 'Fecha de inicio inválida' };
  var limite = _unMesAdelante_(new Date());
  if (fin.getTime() > limite.getTime()) return { error: 'Como máximo un mes calendario hacia adelante (hasta el ' + _fmtDia_(limite) + '). Más allá, registrá pagos.' };
  var motivo = String(data.motivo || '').replace(/[\u0000-\u001F]/g, ' ').trim();
  if (motivo.length < 5 || motivo.length > 200 || /^[=+\-@]/.test(motivo)) return { error: 'El motivo es obligatorio (5 a 200 caracteres).' };
  var bl = _bloqueosComunes_(prefijo); if (bl) return { error: bl };
  var hoy = _diaSolo_(new Date()), vf = _obtenerVigenciaCliente_(prefijo).fechaVence;
  var res = { prefijo: prefijo, plan: plan, fin: _fmtDia_(fin), inicio: inicio ? _fmtDia_(inicio) : '', venceActual: vf ? _fmtDia_(vf) : 'sin vencimiento', motivo: motivo,
              aviso: fin.getTime() < hoy.getTime() ? '⚠️ Con esa fecha el negocio queda VENCIDO (no podrá registrar ventas nuevas).' : 'No es un pago: se registra como REGULARIZACIÓN con tu motivo.' };
  var firma = _firma_(['regularizar', prefijo, res.fin, res.inicio, res.venceActual, motivo]);
  if (data.confirmar !== true) return Object.assign({ success: true, vistaPrevia: true, firma: firma }, res);
  return _conLock_(function () {
    if (_periodosDe_(prefijo).length) return { error: 'Ya tiene historial de períodos.' };
    var vf2 = _obtenerVigenciaCliente_(prefijo).fechaVence;
    if (_firma_(['regularizar', prefijo, res.fin, res.inicio, vf2 ? _fmtDia_(vf2) : 'sin vencimiento', motivo]) !== data.firma) return { error: 'Algo cambió desde la vista previa: volvé a revisarla.' };
    _hojaPeriodos_().appendRow(_filaPeriodo_({ Registro_id: Utilities.getUuid(), Prefijo: prefijo, Plan: plan, Tipo: 'REGULARIZACION', Inicio: inicio || '', Fin: fin,
      Ancla: _sumarDias_(fin, 1).getDate(), Ciclo: '', Motivo: motivo, Admin: _adminTexto_(), Fecha_registro: new Date() }));
    _escribirVence_(prefijo, fin);
    return Object.assign({ success: true, mensaje: '✅ Vigencia regularizada hasta el ' + res.fin }, res);
  });
}

// ── SINCRONIZAR: la Fecha Vence de la planilla no coincide con el historial ──
function sincronizarVigencia(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo), ult = _ultimoPorFin_(_periodosDe_(prefijo));
  if (!ult) return { error: 'Sin historial: usá Regularizar' };
  var vf = _obtenerVigenciaCliente_(prefijo).fechaVence;
  if (vf && _diaSolo_(new Date(vf)).getTime() === _diaSolo_(ult.Fin).getTime()) return { error: 'La fecha ya coincide con el historial' };
  var motivo = String(data.motivo || '').replace(/[\u0000-\u001F]/g, ' ').trim();
  if (motivo.length < 5 || /^[=+\-@]/.test(motivo)) return { error: 'El motivo es obligatorio' };
  var res = { prefijo: prefijo, enPlanilla: vf ? _fmtDia_(vf) : 'vacía', segunHistorial: _fmtDia_(ult.Fin), aviso: 'Vale el historial: se escribe ' + _fmtDia_(ult.Fin) + ' en Fecha Vence.' };
  var firma = _firma_(['sinc', prefijo, res.enPlanilla, res.segunHistorial, motivo]);
  if (data.confirmar !== true) return Object.assign({ success: true, vistaPrevia: true, firma: firma }, res);
  return _conLock_(function () {
    var bl = _bloqueosComunes_(prefijo); if (bl) return { error: bl };
    var vf2 = _obtenerVigenciaCliente_(prefijo).fechaVence;
    if (_firma_(['sinc', prefijo, vf2 ? _fmtDia_(vf2) : 'vacía', res.segunHistorial, motivo]) !== data.firma) return { error: 'Algo cambió desde la vista previa.' };
    _hojaPeriodos_().appendRow(_filaPeriodo_({ Registro_id: Utilities.getUuid(), Prefijo: prefijo, Plan: _planDeNegocio_(prefijo), Tipo: 'SINCRONIZACION', Inicio: '', Fin: ult.Fin,
      Motivo: motivo + ' (planilla decía: ' + res.enPlanilla + ')', Admin: _adminTexto_(), Fecha_registro: new Date() }));
    _escribirVence_(prefijo, ult.Fin);
    return Object.assign({ success: true, mensaje: '✅ Fecha Vence sincronizada con el historial: ' + res.segunHistorial }, res);
  });
}

// ── FICHA "💳 Vigencia y pagos" (Admin, solo lectura) ─────────────────
function estadoVigenciaCliente(data) {
  if (!validarSesionAdmin(data.token || '')) return { error: 'Sesión admin inválida o expirada' };
  var prefijo = _normalizarPrefijo_(data.prefijo);
  if (!obtenerInfoCliente(prefijo)) return { error: 'Cliente no encontrado' };
  var todos = _leerPeriodos_(), plan = _planDeNegocio_(prefijo), vig = _obtenerVigenciaCliente_(prefijo);
  var props = PropertiesService.getScriptProperties().getProperties();
  var com = _estadoComercial_(prefijo, plan, vig, todos, props);
  var mios = todos.filter(function (r) { return r.Prefijo === prefijo; });
  var pl = _leerPlanes_();
  var contratables = pl.existe ? pl.orden.filter(function (c) { var p = pl.planes[c]; return c !== 'PRUEBA' && p.activo && p.contratable !== false; })
    .map(function (c) { var p = pl.planes[c]; return { codigo: c, nombre: p.nombre, precioRegular: p.precioRegular }; }) : [];
  var contratos = mios.filter(function (r) { return TIPOS_CONTRATO_.indexOf(r.Tipo) !== -1; });
  var ultC = _ultimoPorFin_(contratos), ult = _ultimoPorFin_(mios.filter(function (r) { return r.Tipo !== 'SINCRONIZACION'; }));
  var cortesiaUsada = !!ultC && mios.some(function (r) { return r.Tipo === 'CORTESIA' && r.Inicio && _diaSolo_(r.Inicio).getTime() > _diaSolo_(ultC.Inicio || ultC.Fin).getTime(); });
  return {
    success: true, prefijo: prefijo, plan: plan, comercial: com, prueba: plan === 'PRUEBA' ? (vig.prueba ? { estado: vig.prueba.estado, venceTxt: vig.prueba.venceTxt, finGraciaTxt: vig.prueba.finGraciaTxt } : null) : null,
    historial: mios.slice().reverse().map(function (r) { return { tipo: r.Tipo, plan: r.Plan, inicio: _fmtDia_(r.Inicio), fin: _fmtDia_(r.Fin), ciclo: r.Ciclo, ancla: r.Ancla,
      importe: r.Importe, medio: r.Medio, referencia: String(r.Referencia || '').replace(/^'/, ''), motivo: r.Motivo, admin: r.Admin }; }),
    contratables: contratables, pagosSimulados: _entornoPagosSimulados_(),
    puedeCortesia: plan !== 'PRUEBA' && !!ultC && !cortesiaUsada && !(ult && ult.Tipo === 'CORTESIA'),
    puedeRegularizar: plan !== 'PRUEBA' && !_periodosDe_(prefijo, todos).length,
    limiteRegularizar: Utilities.formatDate(_unMesAdelante_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    desincronizado: com.estado === 'DESINCRONIZADO', pagoEnCurso: !!props[_claveCambioPago_(prefijo)],
    cambioPlanPendiente: !!props[_claveCambioPlan_(prefijo)]
  };
}
