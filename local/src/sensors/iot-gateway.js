import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = process.env.MQTT_PORT || 1883;

const TOPIC_ALERT_BLOOD_PRESSURE = 'sensors/alert/bloodPressure';
const TOPIC_REGULAR_BLOOD_PRESSURE = 'sensors/regular/bloodPressure';
const TOPIC_ALERT_BLOOD_OXYGEN = 'sensors/alert/bloodOxygen';
const TOPIC_REGULAR_BLOOD_OXYGEN = 'sensors/regular/bloodOxygen';

const ABERRANT_RATE = 1 / 20;
const NORMAL_REGULAR_INTERVAL = 2000;
const LONG_REGULAR_INTERVAL = 15000;
const NORMAL_ALERT_INTERVAL = 120000;
const QUICK_ALERT_INTERVAL = 20000;
const QUICK_ALERT_RATE = 1 / 5;

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

client.on('connect', () => {
    console.log('✅ Sensors connected to MQTT broker');
    scheduleRegularBPM();
    scheduleRegularOxygen();
    scheduleAlertData();
});

function scheduleRegularBPM() {
    const isLongDelay = Math.random() < ABERRANT_RATE;
    const delay = isLongDelay ? LONG_REGULAR_INTERVAL : NORMAL_REGULAR_INTERVAL;
    if (isLongDelay) console.warn(`⏱️ BPM: Simulating missing data, next send in ${delay / 1000}s`);

    setTimeout(() => {
        sendRegularBPM();
        scheduleRegularBPM();
    }, delay);
}

function scheduleRegularOxygen() {
    const isLongDelay = Math.random() < ABERRANT_RATE;
    const delay = isLongDelay ? LONG_REGULAR_INTERVAL : NORMAL_REGULAR_INTERVAL;
    if (isLongDelay) console.warn(`⏱️ SpO₂: Simulating missing data, next send in ${delay / 1000}s`);

    setTimeout(() => {
        sendRegularOxygen();
        scheduleRegularOxygen();
    }, delay);
}

function scheduleAlertData() {
    const isQuick = Math.random() < QUICK_ALERT_RATE;
    const delay = isQuick ? QUICK_ALERT_INTERVAL : NORMAL_ALERT_INTERVAL;
    if (isQuick) console.warn(`🚨 Quick alert mode: every ${delay / 1000}s`);

    setTimeout(() => {
        sendAlertBPM();
        sendAlertOxygen();
        scheduleAlertData();
    }, delay);
}

function sendRegularBPM() {
    let bpm = Math.random() < ABERRANT_RATE
        ? (Math.random() < 0.5 ? Math.floor(-10 - Math.random() * 40) : Math.floor(280 + Math.random() * 100))
        : Math.floor(60 + Math.random() * 40);

    if (bpm < 60 || bpm > 100) console.warn(`⚠️ Aberrant BPM: ${bpm}`);

    publishData(TOPIC_REGULAR_BLOOD_PRESSURE, { bpm });
}

function sendRegularOxygen() {
    let spo2 = Math.random() < ABERRANT_RATE
        ? (Math.random() < 0.5 ? Math.floor(50 + Math.random() * 10) : Math.floor(110 + Math.random() * 10))
        : Math.floor(95 + Math.random() * 4);

    if (spo2 < 95 || spo2 > 99) console.warn(`⚠️ Aberrant SpO₂: ${spo2}%`);

    publishData(TOPIC_REGULAR_BLOOD_OXYGEN, { spo2 });
}

function sendAlertBPM() {
    const bpm = Math.random() < 0.5
        ? Math.floor(10 + Math.random() * 40)
        : Math.floor(120 + Math.random() * 80);
    publishData(TOPIC_ALERT_BLOOD_PRESSURE, { bpm });
    console.log('🚨 Alert BPM sent:', bpm);
}

function sendAlertOxygen() {
    const spo2 = Math.floor(70 + Math.random() * 15);
    publishData(TOPIC_ALERT_BLOOD_OXYGEN, { spo2 });
    console.log('🚨 Alert SpO₂ sent:', spo2);
}

// --- PUBLISH HELPER ---
function publishData(topic, data) {
    const message = JSON.stringify({ ...data, timestamp: Date.now() });
    client.publish(topic, message);
    console.log(`📤 Sent to ${topic}:`, message);
}
