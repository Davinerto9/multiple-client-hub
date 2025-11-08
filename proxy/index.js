// proxy/index.js
const express = require('express');
const net = require('net');
const cors = require('cors');
const path = require('path');

const APP_PORT = 3000;
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 6789;

const app = express();
app.use(cors());
app.use(express.json());

// ---- servir frontend ----
const webDir = path.join(__dirname, '..', 'web');
app.use(express.static(webDir));
app.get('/', (_req, res) => res.sendFile(path.join(webDir, 'index.html')));

// ---- helper: enviar comando API al servidor Java ----
function sendApi(op, payload = {}) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = '';

    sock.connect(TCP_PORT, TCP_HOST, () => {
      const line = 'API ' + JSON.stringify({ op, ...payload }) + '\n';
      sock.write(line);
    });

    sock.on('data', (chunk) => { buf += chunk.toString('utf8'); });
    sock.on('error', reject);
    sock.on('close', () => {
      // el server Java cierra al terminar; devolvemos lo recibido
      try { resolve(JSON.parse(buf.trim())); }
      catch { resolve(buf.trim()); }
    });
  });
}

// ---- endpoints API HTTP ----
app.post('/api/create-group', async (req, res) => {
  try { res.json(await sendApi('create_group', req.body)); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});

app.post('/api/send-user', async (req, res) => {
  try { res.json(await sendApi('send_user', req.body)); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});

app.post('/api/send-group', async (req, res) => {
  try { res.json(await sendApi('send_group', req.body)); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});

app.get('/api/history-user', async (req, res) => {
  try { res.json(await sendApi('history_user', { u1:req.query.u1, u2:req.query.u2 })); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});

app.get('/api/history-group', async (req, res) => {
  try { res.json(await sendApi('history_group', { group:req.query.group })); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});

app.listen(APP_PORT, () => {
  console.log(`Proxy HTTP escuchando en http://localhost:${APP_PORT}`);
});
