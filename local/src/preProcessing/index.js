import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'mosquitto';
const PORT = Number(process.env.MQTT_PORT || 1883);

const VITALS_PREPROCESSED_TOPIC_BASE = process.env.VITALS_PREPROCESSED_TOPIC_BASE || 'preprocessed/vitals';

const BPM_MIN_VALID = Number(process.env.BPM_MIN_VALID || 25);
const BPM_MAX_VALID = Number(process.env.BPM_MAX_VALID || 220);
const SPO2_MIN_VALID = Number(process.env.SPO2_MIN_VALID || 50);
const SPO2_MAX_VALID = Number(process.env.SPO2_MAX_VALID || 100);

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

client.on('connect', () => {
  console.log(`[pre] MQTT connected to ${BROKER}:${PORT}`);
  client.subscribe([
    'sensors/#',
    'home/patient/+/cardiac/metrics',
    'home/patient/+/spo2/metrics'
  ], { qos: 1 }, (err) => {
    if (err) console.error('[pre] subscribe error:', err);
    else console.log('[pre] subscribed to sensors + home/patient metrics');
  });
});

function toISO(t) {
  if (Array.isArray(t) && t.length === 3) {
    const [d, m, y] = t;
    return new Date(Date.UTC(y, m - 1, d)).toISOString();
  }
  const d = new Date(t || Date.now());
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeEvent(topic, data) {
  if (topic.includes('/alert/')) return null;
  const tsISO = toISO(data?.timestamp);
  const patientId = data?.patientId || null;
  const streamId = patientId || topic;
  if (topic.endsWith('/bloodPressure') || topic.endsWith('/cardiac/metrics')) {
    const bpm = Number(data?.bpm);
    if (!Number.isFinite(bpm) || bpm < BPM_MIN_VALID || bpm > BPM_MAX_VALID) return null;
    return { kind: 'BPM', streamId, value: bpm, unit: 'bpm', timestamp: tsISO, topic };
  }
  if (topic.endsWith('/bloodOxygen') || topic.endsWith('/spo2/metrics')) {
    const spo2 = Number(data?.spo2 ?? data?.Spo2);
    if (!Number.isFinite(spo2) || spo2 < SPO2_MIN_VALID || spo2 > SPO2_MAX_VALID) return null;
    return { kind: 'SPO2', streamId, value: spo2, unit: '%', timestamp: tsISO, topic };
  }
  return null;
}

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const evt = normalizeEvent(topic, data);
    if (!evt) return;

    const pubTopic = evt.kind === 'BPM'
      ? `${VITALS_PREPROCESSED_TOPIC_BASE}/bpm`
      : `${VITALS_PREPROCESSED_TOPIC_BASE}/spo2`;

    client.publish(pubTopic, JSON.stringify(evt), { qos: 1 }, (err) => {
      if (err) console.error('[pre] publish error:', err);
      else console.log(`[pre] MQTT message published on topic "${pubTopic}": ${message.toString()}`);

    });
  } catch (e) {
    console.error('[pre] error:', e?.message || e);
  }
});

process.on('SIGINT', () => { client.end(true); process.exit(0); });
