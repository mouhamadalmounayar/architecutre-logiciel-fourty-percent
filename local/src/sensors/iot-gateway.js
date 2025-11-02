import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = process.env.MQTT_PORT || 1883;

const TOPIC_REGULAR_BLOOD_PRESSURE = 'sensors/regular/bloodPressure';
const TOPIC_REGULAR_BLOOD_OXYGEN = 'sensors/regular/bloodOxygen';

const LONG_REGULAR_RATE = 1 / 20;
const NORMAL_REGULAR_INTERVAL = 2000;
const LONG_REGULAR_INTERVAL = 15000;

const BURST_RATE = 1 / 15;
const BURST_MIN_COUNT = 5;
const BURST_MAX_COUNT = 30;

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

client.on('connect', () => {
    console.log('Sensors connected to MQTT broker');
    scheduleRegularBPM(0);
    scheduleRegularOxygen(0);
});

function scheduleRegularBPM(alertIterationsLeft = 0) {
    const isLongDelay = Math.random() < LONG_REGULAR_RATE;
    const delay = isLongDelay ? LONG_REGULAR_INTERVAL : NORMAL_REGULAR_INTERVAL;

    setTimeout(() => {
        let newAlertCount = alertIterationsLeft;

        if (alertIterationsLeft === 0 && Math.random() < BURST_RATE) {
            newAlertCount = Math.floor(BURST_MIN_COUNT + Math.random() * (BURST_MAX_COUNT - BURST_MIN_COUNT + 1));
        }

        sendRegularBPM(newAlertCount > 0);

        const nextCount = newAlertCount > 0 ? newAlertCount - 1 : 0;

        scheduleRegularBPM(nextCount);
    }, delay);
}

function scheduleRegularOxygen(alertIterationsLeft = 0) {
    const isLongDelay = Math.random() < LONG_REGULAR_RATE;
    const delay = isLongDelay ? LONG_REGULAR_INTERVAL : NORMAL_REGULAR_INTERVAL;

    setTimeout(() => {
        let newAlertCount = alertIterationsLeft;

        if (alertIterationsLeft === 0 && Math.random() < BURST_RATE) {
            newAlertCount = Math.floor(BURST_MIN_COUNT + Math.random() * (BURST_MAX_COUNT - BURST_MIN_COUNT + 1));
        }

        sendRegularOxygen(newAlertCount > 0);

        const nextCount = newAlertCount > 0 ? newAlertCount - 1 : 0;

        scheduleRegularOxygen(nextCount);
    }, delay);
}

function sendRegularBPM(forceAlert = false) {
    let bpm;

    if (forceAlert) {
        bpm = Math.random() < 0.5
            ? Math.floor(10 + Math.random() * 50)
            : Math.floor(120 + Math.random() * 60);
        console.log('Alert BPM:', bpm);
    } else {
        bpm = Math.floor(60 + Math.random() * 40);
    }

    publishData(TOPIC_REGULAR_BLOOD_PRESSURE, { bpm });
}

function sendRegularOxygen(forceAlert = false) {
    let spo2;

    if (forceAlert) {
        spo2 = Math.floor(70 + Math.random() * 15);
        console.log('Alert SpO₂:', spo2);
    } else {
        spo2 = Math.floor(95 + Math.random() * 4);
    }

    publishData(TOPIC_REGULAR_BLOOD_OXYGEN, { spo2 });
}

function publishData(topic, data) {
    const message = JSON.stringify({ ...data, timestamp: Date.now() });
    client.publish(topic, message);
    console.log(`Sent to ${topic}:`, message);
}