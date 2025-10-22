package com.example.alerts.kafka;

import com.example.alerts.model.AlertEvent;
import io.quarkus.kafka.client.serialization.ObjectMapperDeserializer;

public class AlertEventDeserializer extends ObjectMapperDeserializer<AlertEvent> {
    public AlertEventDeserializer() { super(AlertEvent.class); }
}