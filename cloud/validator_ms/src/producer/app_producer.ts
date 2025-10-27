import type { Producer } from "kafkajs";
import { type KafkaProducer } from "./producer.js";
import { kafka } from "../server.js";
export class AppProducer<T> implements KafkaProducer<T> {
	producer?: Producer;
	topicName: string;
	constructor(topicName: string) {
		this.topicName = topicName;
	}
	public init(): Promise<void> {
		this.producer = kafka.producer();
		return this.producer.connect();
	}
	public async produce(message: T): Promise<void> {
		await this.producer?.send({
			topic: this.topicName,
			messages: [{ value: JSON.stringify(message) }],
		});
	}
	public async destroy(): Promise<void> {
		await this.producer?.disconnect();
	}
}
