import Joi from "joi";
import type { AlertPayload } from "../models/alert_payload.js";

const alertPayloadSchema = Joi.object({
  timestamp: Joi.array()
    .items(
      Joi.number().integer().min(1).max(31),
      Joi.number().integer().min(1).max(12),
      Joi.number().integer().min(2000).max(3000),
    )
    .length(3)
    .required(),
  alert_message: Joi.string().trim().min(1).max(500).required(),
  metrics: Joi.object().pattern(Joi.string(), Joi.number()),
});

export class ValidationService {
  static validateAlertPayload(payload: any): {
    isValid: boolean;
    data?: AlertPayload;
    errors?: string[];
  } {
    const { error, value } = alertPayloadSchema.validate(payload);
    if (error) {
      return {
        isValid: false,
        errors: error.details.map((detail) => detail.message),
      };
    }
    return {
      isValid: true,
      data: value,
    };
  }

  static sanitizePayload(payload: any): any {
    if (typeof payload.alert_message === "string") {
      payload.alert_message = payload.alert_message.trim();
    }
    return payload;
  }
}
