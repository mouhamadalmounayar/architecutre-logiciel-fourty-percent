export default {
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(s => s.trim()).filter(Boolean),
    groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
    topics: (process.env.KAFKA_TOPICS || 'alerts').split(',').map(s => s.trim()).filter(Boolean),
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};
