export interface KafkaProducer<T> {
	init(): Promise<void>;
	produce(message: T): Promise<void>;
	destroy(): Promise<void>;
}
