import { Kafka } from 'kafkajs';

class KafkaConsumerService {
  constructor(config) {
    this.kafka = new Kafka({
      clientId: config.clientId || 'notification-service',
      brokers: config.brokers || ['localhost:9092'],
    });

    // Harden consumer against long handlers (SMTP can be slow)
    this.consumer = this.kafka.consumer({
      groupId: config.groupId || 'notification-service-group',
      sessionTimeout: 30000,    //
      heartbeatInterval: 3000,  
      rebalanceTimeout: 60000,  
    });

    this.topics = config.topics || ['alerts'];
    this.messageHandler = null;
  }

  setMessageHandler(handler) {
    this.messageHandler = handler;
  }

  async start() {
    await this.consumer.connect();

    for (const topic of this.topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString() || '{}';
          let data;
          try {
            data = JSON.parse(value);
          } catch (parseErr) {
            console.error('❌ Failed to parse message JSON:', parseErr, 'value:', value);
            return;
          }

          console.log(`Received message from ${topic}:`, {
            partition,
            offset: message.offset,
            data,
          });

          if (this.messageHandler) {
            await this.messageHandler(topic, data);
          }
        } catch (error) {
          console.error('❌ Error in eachMessage:', error);
        }
      },
    });
  }

  async stop() {
    try {
      await this.consumer.disconnect();
    } catch (err) {
      console.error('Error during consumer disconnect:', err?.message || err);
    }
  }
}

export default KafkaConsumerService;
