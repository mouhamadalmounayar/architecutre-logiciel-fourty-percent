import 'dotenv/config';
import KafkaConsumerService from './kafka/kafkaConsumer.js';
import NotificationHandler from './handlers/notificationHandler.js';
import config from './config/config.js';

console.log('🚀 Starting Notification Service...');
console.log('Configuration:');
console.log('- Kafka Brokers:', config.kafka.brokers);
console.log('- Kafka Topics:', config.kafka.topics);
console.log('- SMTP Server:', `${config.email.host}:${config.email.port}`);
console.log('');

if (!config.email.user || !config.email.pass) {
  console.error('Please set SMTP_USER and SMTP_PASS environment variables (use a Gmail App Password).');
  process.exit(1);
}

const consumer = new KafkaConsumerService({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  groupId: config.kafka.groupId,
  topics: config.kafka.topics,
});

const handler = new NotificationHandler(config.email);

// Wire message handling
consumer.setMessageHandler(async (topic, data) => {
  await handler.handleAlert(topic, data);
});

// Graceful shutdown
const shutdown = async (sig) => {
  console.log(`\n${sig} received. Shutting down...`);
  try {
    await consumer.stop();
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise rejection:', reason);
});

(async () => {
  console.log('Waiting for Kafka messages...\n');
  await consumer.start();
})();
