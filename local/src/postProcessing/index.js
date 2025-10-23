import express from 'express';
import mqtt from 'mqtt';

const app = express();
app.use(express.json());

// MQTT pour publier les alertes confirmées (optionnel mais conseillé)
const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = Number(process.env.MQTT_PORT || 1883);
const mqttClient = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

mqttClient.on('connect', () => {
  console.log(`PostProcessing connected to MQTT ${BROKER}:${PORT}`);
});

// Seuils et logique de confirmation (BPM)
const BPM_MIN_CRIT = Number(process.env.BPM_MIN_CRIT || 45);
const BPM_MAX_CRIT = Number(process.env.BPM_MAX_CRIT || 120);
const CONFIRM_WINDOW_SEC  = Number(process.env.BPM_CONFIRM_WINDOW_SEC || 6);
const CONFIRM_MIN_SAMPLES = Number(process.env.BPM_CONFIRM_MIN_SAMPLES || 3);
const CONFIRM_RATIO       = Number(process.env.BPM_CONFIRM_RATIO || 0.66);

const WINDOW_MS = CONFIRM_WINDOW_SEC * 1000;

// Si aucun échantillon n'arrive pendant STALE_MS, on considère le flux comme inactif
const STALE_SEC = Number(process.env.STALE_SEC || 30);
const STALE_MS = STALE_SEC * 1000;

// État par flux (patient/stream)
const streams = new Map(); // streamId -> { win: [ {t, critical, value} ], inAlert: bool }

function getStreamState(id) {
  let s = streams.get(id);
  if (!s) { s = { win: [], inAlert: false }; streams.set(id, s); }
  return s;
}

function prune(win, now) {
  while (win.length && now - win[0].t > WINDOW_MS) win.shift();
}

function isCriticalBpm(value) {
  return value < BPM_MIN_CRIT || value > BPM_MAX_CRIT;
}

function publishAlert(kind, streamId, payload) {
  const topic = `medical/alerts/${kind.toLowerCase()}`;
  mqttClient.publish(topic, JSON.stringify({ streamId, ...payload }), { qos: 1 });
  // forward to Validator (non-blocking)
  void forwardToValidator({ streamId, ...payload });
}

// Optional: forward alert to a Validator microservice (HTTP webhook)
const VALIDATOR_URL = process.env.VALIDATOR_URL || null; // e.g. http://iot-validator:9000/alerts

async function forwardToValidator(payload) {
  if (!VALIDATOR_URL) return;
  try {
    // simple POST with retry
    for (let i = 0; i < 2; i++) {
      try {
        const res = await fetch(VALIDATOR_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`status=${res.status}`);
        console.log('→ Forwarded alert to Validator');
        return;
      } catch (err) {
        console.warn(`Validator POST attempt ${i + 1} failed: ${err?.message || err}`);
        if (i === 1) throw err;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  } catch (err) {
    console.error('Failed to forward alert to Validator:', err?.message || err);
  }
}

app.get('/health', (_req, res) => res.json({status: 'ok'}));

app.post('/v1/vitals', (req, res) => {
  const { kind, streamId, value, unit, timestamp, topic } = req.body || {};
  const now = Date.now();

  if (!kind || !streamId || typeof value !== 'number') {
    return res.status(400).json({ error: 'invalid payload' });
  }

  // --- BPM ---
  if (kind === 'BPM') {
  const st = getStreamState(streamId);
  // mettre à jour la marque de temps dernier échantillon
  st.lastSampleAt = now;
    const critical = isCriticalBpm(value) || (topic?.includes('/alert/'));
    st.win.push({ t: now, critical, value, unit, sensorTs: timestamp });
    prune(st.win, now);

    const total = st.win.length;
    const criticalCount = st.win.reduce((n, s) => n + (s.critical ? 1 : 0), 0);
    const ratio = total ? criticalCount / total : 0;

    // entrée en alerte
    if (!st.inAlert && total >= CONFIRM_MIN_SAMPLES && ratio >= CONFIRM_RATIO) {
      st.inAlert = true;
      const direction = value < BPM_MIN_CRIT ? 'BRADYCARDIE' : 'TACHYCARDIE';
      const payload = {
        status: 'CONFIRMED',
        kind,
        direction,
        value,
        unit,
        thresholds: { min: BPM_MIN_CRIT, max: BPM_MAX_CRIT },
        windowSec: CONFIRM_WINDOW_SEC,
        windowStats: { total, critical: criticalCount, ratio: Number(ratio.toFixed(2)) },
        at: new Date().toISOString(),
      };
      console.log('🚑  ALERTE VITALE CONFIRMÉE:', streamId, payload);
      publishAlert(kind, streamId, payload);
    }

    // sortie d’alerte
    if (st.inAlert && total >= CONFIRM_MIN_SAMPLES && ratio < 0.2) {
      st.inAlert = false;
      const payload = { status: 'RECOVERED', kind, at: new Date().toISOString() };
      console.log('✅  Retour à la normale:', streamId);
      publishAlert(kind, streamId, payload);
    }
    return res.json({ ok: true });
  }

  // (plus tard: SpO2 etc.)
  return res.status(204).end();
});

const HTTP_PORT = Number(process.env.PORT || 8080);
app.listen(HTTP_PORT, () => {
  console.log(`PostProcessing HTTP listening on :${HTTP_PORT}`);
  console.log(`Seuils BPM: <${BPM_MIN_CRIT} ou >${BPM_MAX_CRIT} | confirmation ${CONFIRM_MIN_SAMPLES} échantillons / ${CONFIRM_WINDOW_SEC}s (ratio ${CONFIRM_RATIO})`);
});

// Balayage périodique pour détecter les flux inactifs et éventuellement clore les alertes si pas de nouvelles données
setInterval(() => {
  const now = Date.now();
  for (const [id, st] of streams.entries()) {
    if (st.inAlert && st.lastSampleAt && now - st.lastSampleAt > STALE_MS) {
      // plus de données depuis un moment — on notifie une récupération "stale" pour éviter alertes persistantes
      st.inAlert = false;
      st.win = [];
      const payload = { status: 'RECOVERED_STALE', kind: 'BPM', at: new Date().toISOString() };
      console.log('⏳  Flux stale, fermeture d\'alerte:', id);
      publishAlert('BPM', id, payload);
    }
  }
}, Math.max(1000, Math.floor(STALE_MS / 3)));