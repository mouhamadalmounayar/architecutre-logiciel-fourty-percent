import express from 'express';
import mqtt from 'mqtt';

const app = express();
app.use(express.json());

const HOUSE_ID = process.env.HOUSE_ID || 'beux house';
const BROKER   = process.env.MQTT_BROKER || 'localhost';
const PORT     = Number(process.env.MQTT_PORT || 1883);
const AUTH_URL = process.env.AUTH_URL || 'http://host.docker.internal:3000/auth';
const VALIDATOR_URLS = (process.env.VALIDATOR_URL || '').split(',').map(s => s.trim()).filter(Boolean);

const BPM_MIN_CRIT        = Number(process.env.BPM_MIN_CRIT || 45);
const BPM_MAX_CRIT        = Number(process.env.BPM_MAX_CRIT || 120);
const SPO2_MIN_CRIT       = Number(process.env.SPO2_MIN_CRIT || 90);
const CONFIRM_WINDOW_SEC  = Number(process.env.BPM_CONFIRM_WINDOW_SEC || 6);
const CONFIRM_MIN_SAMPLES = Number(process.env.BPM_CONFIRM_MIN_SAMPLES || 3);
const CONFIRM_RATIO       = Number(process.env.BPM_CONFIRM_RATIO || 0.66);
const EXIT_RATIO          = Number(process.env.BPM_EXIT_RATIO || 0.2);
const COOLDOWN_SEC        = Number(process.env.COOLDOWN_SEC || 30);
const STALE_SEC           = Number(process.env.STALE_SEC || 30);

const WINDOW_MS   = CONFIRM_WINDOW_SEC * 1000;
const COOLDOWN_MS = COOLDOWN_SEC * 1000;
const STALE_MS    = STALE_SEC * 1000;

const mqttClient = mqtt.connect(`mqtt://${BROKER}:${PORT}`);
mqttClient.on('connect', () => console.log(`PostProcessing connected to MQTT ${BROKER}:${PORT}`));

let validatorToken = null;
function extractTokenShape(json) {
  return json?.token || json?.access_token || json?.data?.token || null;
}
async function getValidatorToken() {
  if (validatorToken) return validatorToken;
  try {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ house_id: HOUSE_ID }),
    });
    const json = await res.json().catch(() => ({}));
    validatorToken = extractTokenShape(json);
    return validatorToken;
  } catch {
    return null;
  }
}
function invalidateValidatorToken() { validatorToken = null; }
function toDateArray(d = new Date()) { return [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]; }

async function sendAlertToValidator(alertMessage, metrics, eventDate = new Date()) {
  if (!VALIDATOR_URLS.length) return;
  const payload = { timestamp: toDateArray(eventDate), alert_message: alertMessage, metrics };
  for (const url of VALIDATOR_URLS) {
    let tok = await getValidatorToken();
    let res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      invalidateValidatorToken();
      tok = await getValidatorToken();
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify(payload),
      });
    }
    if (res.ok) { console.log('[validator] alert sent:', url); return; }
    const t = await res.text().catch(() => '');
    console.warn(`[validator] POST ${url} failed: ${res.status} ${t}`);
  }
}

function publishVitalAlert(streamId, alert_message, metrics, date = new Date()) {
  const streamKey = encodeURIComponent(String(streamId));
  const topic = `house/${encodeURIComponent(HOUSE_ID)}/alerts/vital/${streamKey}`;
  const payload = { timestamp: date.toISOString(), alert_message, metrics };
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
  console.log('publish', topic, payload);
  void sendAlertToValidator(alert_message, metrics, date);
}

app.get('/health', (_req, res) => res.json({status: 'ok'}));

const streams = new Map();
function getOrInit(id) {
  let s = streams.get(id);
  if (!s) {
    s = {
      bpm: { win: [], inAlert: false, lastChange: 0, lastSampleAt: 0 },
      spo2: { win: [], inAlert: false, lastChange: 0, lastSampleAt: 0 }
    };
    streams.set(id, s);
  }
  return s;
}
function prune(win, now){ while (win.length && now - win[0].t > WINDOW_MS) win.shift(); }

app.post('/v1/vitals', (req, res) => {
  const { kind, streamId, value, unit, timestamp } = req.body || {};
  const now = Date.now();
  if (!kind || !streamId || typeof value !== 'number') return res.status(400).json({ error: 'invalid payload' });

  if (kind === 'BPM') {
    const stAll = getOrInit(streamId);
    const st = stAll.bpm;
    st.lastSampleAt = now;
    st.win.push({ t: now, v: value, unit, sensorTs: timestamp });
    prune(st.win, now);
    const total = st.win.length;
    const criticalCount = st.win.reduce((n, s)=> n + ((s.v < BPM_MIN_CRIT || s.v > BPM_MAX_CRIT) ? 1 : 0), 0);
    const ratio = total ? criticalCount / total : 0;
    if (!st.inAlert && total >= CONFIRM_MIN_SAMPLES && ratio >= CONFIRM_RATIO && (now - st.lastChange) > COOLDOWN_MS) {
      st.inAlert = true; st.lastChange = now;
      const vals = st.win.map(x=>x.v);
      const bpmMin = Math.min(...vals);
      const bpmMax = Math.max(...vals);
      const direction = bpmMin < BPM_MIN_CRIT ? 'bpm_really_low' : 'bpm_really_high';
      publishVitalAlert(streamId, direction, { bpm_min: bpmMin, bpm_max: bpmMax, window_sec: CONFIRM_WINDOW_SEC }, new Date());
      return res.json({ ok: true, entered: true });
    }
    if (st.inAlert && total >= CONFIRM_MIN_SAMPLES && ratio < EXIT_RATIO && (now - st.lastChange) > 1000) {
      st.inAlert = false; st.lastChange = now;
      publishVitalAlert(streamId, 'resolved', { window_sec: CONFIRM_WINDOW_SEC }, new Date());
      return res.json({ ok: true, recovered: true });
    }
    return res.json({ ok: true });
  }

  if (kind === 'SPO2') {
    const stAll = getOrInit(streamId);
    const st = stAll.spo2;
    st.lastSampleAt = now;
    st.win.push({ t: now, v: value, unit, sensorTs: timestamp });
    prune(st.win, now);
    const total = st.win.length;
    const criticalCount = st.win.reduce((n, s)=> n + ((s.v < SPO2_MIN_CRIT) ? 1 : 0), 0);
    const ratio = total ? criticalCount / total : 0;
    if (!st.inAlert && total >= CONFIRM_MIN_SAMPLES && ratio >= CONFIRM_RATIO && (now - st.lastChange) > COOLDOWN_MS) {
      st.inAlert = true; st.lastChange = now;
      const vals = st.win.map(x=>x.v);
      const spo2Min = Math.min(...vals);
      publishVitalAlert(streamId, 'oxy_low', { spo2_min: spo2Min, window_sec: CONFIRM_WINDOW_SEC }, new Date());
      return res.json({ ok: true, entered: true });
    }
    if (st.inAlert && total >= CONFIRM_MIN_SAMPLES && ratio < EXIT_RATIO && (now - st.lastChange) > 1000) {
      st.inAlert = false; st.lastChange = now;
      publishVitalAlert(streamId, 'resolved', { window_sec: CONFIRM_WINDOW_SEC }, new Date());
      return res.json({ ok: true, recovered: true });
    }
    return res.json({ ok: true });
  }

  return res.status(204).end();
});

const HTTP_PORT = Number(process.env.PORT || 8080);
app.listen(HTTP_PORT, () => {
  console.log(`PostProcessing HTTP listening on :${HTTP_PORT}`);
  console.log(`Seuils BPM: <${BPM_MIN_CRIT} ou >${BPM_MAX_CRIT} | fenêtre ${CONFIRM_WINDOW_SEC}s, min ${CONFIRM_MIN_SAMPLES}, ratio in=${CONFIRM_RATIO}, out=${EXIT_RATIO}`);
  console.log(`Seuil SpO₂ critique: <${SPO2_MIN_CRIT}%`);
});

setInterval(() => {
  const now = Date.now();
  for (const [id, st] of streams.entries()) {
    if (st.bpm.inAlert && st.bpm.lastSampleAt && now - st.bpm.lastSampleAt > STALE_MS) {
      st.bpm.inAlert = false; st.bpm.win = [];
      publishVitalAlert(id, 'resolved', { window_sec: CONFIRM_WINDOW_SEC, reason: 'stale_bpm' }, new Date());
    }
    if (st.spo2.inAlert && st.spo2.lastSampleAt && now - st.spo2.lastSampleAt > STALE_MS) {
      st.spo2.inAlert = false; st.spo2.win = [];
      publishVitalAlert(id, 'resolved', { window_sec: CONFIRM_WINDOW_SEC, reason: 'stale_spo2' }, new Date());
    }
  }
}, Math.max(1000, Math.floor(STALE_MS / 3)));