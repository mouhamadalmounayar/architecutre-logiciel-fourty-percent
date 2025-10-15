import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = process.env.MQTT_PORT || 1883;
const TOPIC = 'sensors/bloodPressure';

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

client.on('connect', () => {
    console.log('Blood Pressure sensor connected to MQTT broker');

    setInterval(() => {
        const bpm = Math.floor(60 + Math.random() * 40);
        const message = JSON.stringify({ bpm, timestamp: Date.now() });

        client.publish(TOPIC, message);
        console.log('BPM sent:', message);
    }, 2000);
});
