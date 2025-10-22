import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = process.env.MQTT_PORT || 1883;

const TOPIC_ALERT_BLOOD_PRESSURE = 'sensors/alert/bloodPressure';
const TOPIC_REGULAR_BLOOD_PRESSURE = 'sensors/regular/bloodPressure';
const TOPIC_ALERT_BLOOD_OXYGEN = 'sensors/alert/bloodOxygen';
const TOPIC_REGULAR_BLOOD_OXYGEN = 'sensors/regular/bloodOxygen';
const TOPIC_HEALTH_BLOOD_PRESSURE = 'sensors/health/bloodPressure';
const TOPIC_HEALTH_BLOOD_OXYGEN = 'sensors/health/bloodOxygen';

const LONG_REGULAR_RATE = 1 / 20;
const NORMAL_REGULAR_INTERVAL = 2000;
const LONG_REGULAR_INTERVAL = 15000;

const BURST_RATE = 1 / 15;
const BURST_MIN_COUNT = 5;
const BURST_MAX_COUNT = 30;

const HEALTH_INTERVAL = 60000;

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

let bpmHealthy = true;
let oxygenHealthy = true;

client.on('connect', () => {
    console.log('Sensors connected to MQTT broker');
    scheduleRegularBPM(0);
    scheduleRegularOxygen(0);
    scheduleHealthBPM();
    scheduleHealthOxygen();
});

function scheduleRegularBPM(alertIterationsLeft = 0) {
    const isLongDelay = Math.random() < LONG_REGULAR_RATE;
    const delay = isLongDelay ? LONG_REGULAR_INTERVAL : NORMAL_REGULAR_INTERVAL;

    if (isLongDelay) {
        bpmHealthy = false;
    } else {
        bpmHealthy = true;
    }

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

    if (isLongDelay) {
        oxygenHealthy = false;
    } else {
        oxygenHealthy = true;
    }

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

function scheduleHealthBPM() {
    setInterval(() => {
        const healthStatus = {
            sensor: 'bloodPressure',
            healthy: bpmHealthy,
            battery: Math.random() * 100,
            version: `1.${Math.floor(Math.random() * 9)}.${Math.floor(Math.random() * 9)}`,
            timestamp: Date.now()
        };
        publishData(TOPIC_HEALTH_BLOOD_PRESSURE, healthStatus);
    }, HEALTH_INTERVAL);
}

function scheduleHealthOxygen() {
    setInterval(() => {
        const healthStatus = {
            sensor: 'bloodOxygen',
            healthy: oxygenHealthy,
            battery: Math.random() * 100,
            version: `1.${Math.floor(Math.random() * 9)}.${Math.floor(Math.random() * 9)}`,
            timestamp: Date.now()
        };
        publishData(TOPIC_HEALTH_BLOOD_OXYGEN, healthStatus);
    }, HEALTH_INTERVAL);
}

function sendRegularBPM(forceAlert = false) {
    let bpm;

    if (forceAlert) {
        bpm = Math.random() < 0.5
            ? Math.floor(10 + Math.random() * 50)
            : Math.floor(120 + Math.random() * 60);
        console.log('Alert BPM:', bpm);
        publishData(TOPIC_ALERT_BLOOD_PRESSURE, { bpm });
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
        publishData(TOPIC_ALERT_BLOOD_OXYGEN, { spo2 });
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