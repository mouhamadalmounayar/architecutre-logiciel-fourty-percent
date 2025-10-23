import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = Number(process.env.MQTT_PORT || 1883);
const POSTPROCESSOR_URL = process.env.POSTPROCESSOR_URL || 'http://iot-postprocessing:8080/v1/vitals';

// filtres anti-bug capteur (prétraitement)
const BPM_MIN_VALID = Number(process.env.BPM_MIN_VALID || 25);
const BPM_MAX_VALID = Number(process.env.BPM_MAX_VALID || 220);

// Node 20 a fetch global
// Petit retry pour rendre le POST plus résilient en cas d'échecs réseau transitoires
async function postJson(url, body, attempts = 2, delayMs = 300) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`POST ${url} -> ${res.status} ${t}`);
      }
      return;
    } catch (err) {
      if (i === attempts - 1) {
        throw err;
      }
      console.warn(`POST ${url} failed (attempt ${i + 1}), retrying: ${err?.message || err}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

client.on('connect', () => {
  console.log(`Preprocessing connected to MQTT ${BROKER}:${PORT}`);
  client.subscribe('sensors/#', (err) => {
    if (err) console.error('Subscribe error:', err);
    else console.log("Abonné à 'sensors/#' (prétraitement)");
  });
});

// Normalisation minimale du message capteur → évènement générique
function normalizeEvent(topic, data) {
  const ts = Number(data?.timestamp) || Date.now();
  // streamId: patient si dispo, sinon on prend le topic comme clé
  const patientId = data?.patientId || null;
  const streamId = patientId || topic;

  if (topic.endsWith('/bloodPressure') && Number.isFinite(data?.bpm)) {
    const bpm = Number(data.bpm);

    // On ignore seulement les valeurs impossibles. (Les VITALES critiques seront gérées en postprocessing)
    if (bpm < BPM_MIN_VALID || bpm > BPM_MAX_VALID) {
      console.warn(`BPM aberrant ignoré: ${bpm} (attendu ${BPM_MIN_VALID}..${BPM_MAX_VALID})`);
      return null;
    }

    return {
      kind: 'BPM',
      streamId,
      value: bpm,
      unit: 'bpm',
      timestamp: ts,
      topic,
    };
  }

  // (Plus tard: SpO2, etc.)
  return null;
}

client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    // log léger
    // console.log(`← ${topic}`, data);

    const evt = normalizeEvent(topic, data);
    if (!evt) return;

    await postJson(POSTPROCESSOR_URL, evt);
    // console.log('→ POST postprocessing ok', evt);
  } catch (e) {
    console.error('Preprocessing error:', e?.message || e);
  }
});

process.on('SIGINT', () => { try { client.end(true); } finally { process.exit(0); } });