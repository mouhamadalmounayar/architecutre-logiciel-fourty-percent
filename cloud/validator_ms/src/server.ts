import express from "express";
import { Kafka } from "kafkajs";
import type { AlertPayload } from "./models/alert_payload.js";
import { AppProducer } from "./producer/app_producer.js";
import { ValidationService } from "./services/validation_service.js";
import { authenticateToken } from "./auth/authorization_middleware.js";
import { AuthenticationService } from "./services/authentication_service.js";
import retry from "async-retry";
const app = express();

// ============================================================================
// COLORIZED LOGGING FOR DEMO
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

function logAlertReceived(alertType: string, houseId: number, metrics: any) {
  const banner = '━'.repeat(80);
  console.log(`\n${colors.bright}${colors.bgBlue}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}*** CLOUD VALIDATOR - ALERT RECEIVED ***${colors.reset}`);
  console.log(`${colors.bright}${colors.bgBlue}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}House ID: ${houseId}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Alert Type: ${alertType}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Metrics: ${JSON.stringify(metrics)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Timestamp: ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.bright}${colors.bgBlue}${banner}${colors.reset}\n`);
}

function logKafkaPublished(topic: string) {
  const banner = '━'.repeat(80);
  console.log(`\n${colors.bright}${colors.bgGreen}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.green}*** KAFKA EVENT PUBLISHED ***${colors.reset}`);
  console.log(`${colors.bright}${colors.bgGreen}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.green}Topic: ${topic}${colors.reset}`);
  console.log(`${colors.bright}${colors.green}Timestamp: ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.bright}${colors.bgGreen}${banner}${colors.reset}\n`);
}

function logInfo(message: string) {
  console.log(`${colors.cyan}[VALIDATOR] ${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}[VALIDATOR] ${message}${colors.reset}`);
}

function logError(message: string) {
  console.log(`${colors.red}[VALIDATOR] ${message}${colors.reset}`);
}

const PORT: number = Number(process.env.PORT) || 3000;
const broker = process.env.KAFKA_BROKER || "localhost:9092";

// initialize kafka
export const kafka = new Kafka({
  clientId: "validator_microservice",
  brokers: [broker],
});

const admin = kafka.admin();
await retry(
  async () => {
    await admin.connect();
    const topicConfig = [
      {
        topic: "alert-events",
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: "enriched-alerts-events",
        numPartitions: 3,
        replicationFactor: 1,
      },
    ];
    await admin.createTopics({ topics: topicConfig });
  },
  {
    retries: 5,
    onRetry: (_err: Error, attempt: number) => {
      console.log(`Retrying topic creation attempt ${attempt}`);
    },
  },
);

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
    logInfo(`Received alert from house ${req.house_id}`);

    const validation = ValidationService.validateAlertPayload(payload);
    if (!validation.isValid) {
      logError(`Invalid alert payload: ${validation.errors?.join(", ")}`);
      res.status(400).json({ error: validation.errors?.join(", ") });
      return;
    }

    // SPECTACULAR LOG FOR DEMO - ALERT RECEIVED
    logAlertReceived(
      payload.alert_message || "unknown",
      Number(req.house_id),
      payload.metrics || {}
    );

    const producer = new AppProducer<AlertPayload>("alert-events");
    await producer.init();
    const house_id = req.house_id;
    await producer.produce({ house_id, ...validation.data! });

    // SPECTACULAR LOG FOR DEMO - KAFKA PUBLISHED
    logKafkaPublished("alert-events");

    logSuccess(`Alert validated and sent to Kafka for house ${house_id}`);

    res.status(201).json({
      message: "alert created successfully",
    });
  } catch (error: any) {
    logError(`Error processing alert: ${error.message}`);
    res
      .status(500)
      .json({ error: "internal server error", message: error.message });
  }
});

app.listen(PORT, () => {
  const banner = '═'.repeat(80);
  console.log(`\n${colors.bright}${colors.cyan}${banner}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}       CLOUD VALIDATOR MICROSERVICE${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${banner}${colors.reset}`);
  console.log(`${colors.cyan}Port: ${PORT}${colors.reset}`);
  console.log(`${colors.cyan}Kafka Broker: ${broker}${colors.reset}`);
  console.log(`${colors.cyan}Status: READY${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${banner}${colors.reset}\n`);
});
