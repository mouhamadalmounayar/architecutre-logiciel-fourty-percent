import mqtt from 'mqtt';

const BROKER = process.env.MQTT_BROKER || 'localhost';
const PORT = process.env.MQTT_PORT || 1883;

const client = mqtt.connect(`mqtt://${BROKER}:${PORT}`);

client.on('connect', () => {
    console.log(`IoT App connected to MQTT broker at ${BROKER}:${PORT}`);

    client.subscribe('sensors/#', (err) => {
        if (err) {
            console.error('Erreur lors de l\'abonnement aux topics:', err);
        } else {
            console.log('Abonné à tous les topics des capteurs');
        }
    });
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log(`Message reçu sur ${topic}:`, data);
    } catch (err) {
        console.error('Erreur en analysant le message:', message.toString());
    }
});
