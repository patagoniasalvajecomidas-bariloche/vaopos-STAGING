// VAO POS — receptor de webhooks de Mercado Pago (Vercel, función Node).
// Solo hace tres cosas: 1) verifica la firma x-signature con la clave secreta del webhook, 2) avisa a Apps Script
// "mirá el pago N" (con un secreto compartido), 3) responde 200 si Apps Script lo procesó, o 500 para que Mercado Pago reintente.
// NO acredita nada ni confía en el contenido de la notificación: Apps Script consulta el pago en la API oficial.
// Variables de entorno (Vercel → Settings → Environment Variables, tipo "Sensitive"):
//   MP_WEBHOOK_SECRET   clave secreta del webhook (Mercado Pago → Tus integraciones → Webhooks)
//   VAO_RELAY_SECRET    el mismo valor que MP_RELAY_SECRET_VAO en las Propiedades del script
//   VAO_GAS_URL         URL /exec del Apps Script de ESTE entorno
const crypto = require('crypto');

// v040.1 — Validación alineada con el validador OFICIAL de Mercado Pago (SDK Node "mercadopago" 3.6.1,
// utils/webhook WebhookSignatureValidator):
//   · x-signature = "ts=<ts>,v1=<hex>" (claves en minúsculas; se ignoran las desconocidas);
//   · manifiesto = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" — data.id sale del PARÁMETRO de la URL (no del cuerpo);
//     un dato que falta se omite junto con su etiqueta; ts tiene que ser numérico;
//   · HMAC-SHA256 con la clave secreta del webhook, en hexadecimal, comparado en tiempo constante.
//   · Compatibilidad: si data.id tiene letras, también se acepta el id en minúsculas (regla de la documentación anterior).
function firmaValida(headers, query, body, secreto) {
  const uno = v => { const x = Array.isArray(v) ? v[0] : v; const t = x === undefined || x === null ? '' : String(x).trim(); return t; };
  const sig = uno(headers['x-signature']), reqId = uno(headers['x-request-id']);
  const dataId = uno(query && query['data.id']);
  const partes = {};
  sig.split(',').forEach(p => { const i = p.indexOf('='); if (i > 0) { const k = p.slice(0, i).trim().toLowerCase(), v = p.slice(i + 1).trim(); if (k && v) partes[k] = v; } });
  const ts = partes.ts, v1 = partes.v1;
  if (!sig || !ts || !/^\d+$/.test(ts) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return { ok: false, dataId };
  const manifiesto = id => (id ? 'id:' + id + ';' : '') + (reqId ? 'request-id:' + reqId + ';' : '') + 'ts:' + ts + ';';
  const igual = id => {
    const a = Buffer.from(crypto.createHmac('sha256', secreto).update(manifiesto(id)).digest('hex'), 'utf8'), b = Buffer.from(v1.toLowerCase(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const ok = igual(dataId) || (dataId !== dataId.toLowerCase() && igual(dataId.toLowerCase()));
  return { ok, dataId };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const secreto = process.env.MP_WEBHOOK_SECRET, relay = process.env.VAO_RELAY_SECRET, gas = process.env.VAO_GAS_URL;
  if (!secreto || !relay || !gas) return res.status(503).json({ error: 'not configured' });
  const query = req.query || {}, body = (req.body && typeof req.body === 'object') ? req.body : {};
  const f = firmaValida(req.headers || {}, query, body, secreto);
  if (!f.ok) return res.status(401).json({ error: 'invalid signature' });
  const tipo = String(query.type || query.topic || body.type || body.topic || '');
  if (tipo !== 'payment') return res.status(200).json({ ok: true, ignored: tipo || 'sin tipo' });   // la conciliación revisa el resto
  if (!/^\d{1,20}$/.test(f.dataId)) return res.status(200).json({ ok: true, ignored: 'id' });   // solo se reenvía el id que vino FIRMADO en la URL
  try {
    const r = await fetch(gas, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'mpNotificacion', data: { relay: relay, tipo: 'payment', id: f.dataId } }), signal: AbortSignal.timeout(15000) });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (j && j.success === true) return res.status(200).json({ ok: true });
    if (j && j.success === false && !j.reintentar && j.estado && j.estado !== 'ERROR') return res.status(200).json({ ok: true, estado: j.estado });
    return res.status(500).json({ error: 'retry' });   // Mercado Pago vuelve a avisar; la conciliación también lo recupera
  } catch (e) {
    return res.status(500).json({ error: 'retry' });
  }
};
module.exports.firmaValida = firmaValida;
