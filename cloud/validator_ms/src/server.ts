import express from "express";
import { Kafka } from "kafkajs";
import type { AlertPayload } from "./models/alert_payload.js";
import { AppProducer } from "./producer/app_producer.js";
import { ValidationService } from "./services/validation_service.js";
import { authenticateToken } from "./auth/authorization_middleware.js";
import { AuthenticationService } from "./services/authentication_service.js";

const app = express();

const PORT: number = Number(process.env.PORT) || 3000;
const broker = process.env.KAFKA_BROKER || "localhost:9092";

// initialize kafka
export const kafka = new Kafka({
	clientId: "validator_microservice",
	brokers: [broker],
});

const admin = kafka.admin();
(async () => {
	try {
		await admin.connect();
		const topicConfig = [
			{
				topic: "alert-events",
				numPartitions: 3,
				replicationFactor: 1,
			},
		];
		await admin.createTopics({ topics: topicConfig });
		console.log("topics created successfully");
	} catch (error) {
		console.error("error creating topics:", error);
	}
})();

app.use(express.json());

app.get("/status", (req, res, _) => {
	res.json({ status: "healthy" });
});
app.post("/auth", async (req, res, _) => {
	try {
		const { house_id } = req.body;
		// TODO: Validate house_id with postgres database
		const token = AuthenticationService.generateToken({ house_id: house_id });
		res.status(200).json({ token });
	} catch (error: any) {
		console.error(error.message);
		res
			.status(500)
			.json({ error: "internal server error", message: error.message });
	}
});

app.post("/alert", authenticateToken, async (req, res, _) => {
	const payload = req.body;
	try {
		const validation = ValidationService.validateAlertPayload(payload);
		if (!validation.isValid) {
			res.status(400).json({ error: validation.errors?.join(", ") });
			return;
		}
		const producer = new AppProducer<AlertPayload>("alert-events");
		await producer.init();
		const house_id = req.house_id;
		await producer.produce({ house_id, ...validation.data! });
		res.status(201).json({
			message: "alert created successfully",
		});
	} catch (error: any) {
		console.error(error.message);
		res
			.status(500)
			.json({ error: "internal server error", message: error.message });
	}
});

app.listen(PORT, () => {
	console.log("listening on port 3000");
});
