package com.example.alerts.kafka;

import com.example.alerts.model.RawAlertEvent;
import io.quarkus.kafka.client.serialization.ObjectMapperDeserializer;

public class AlertEventDeserializer extends ObjectMapperDeserializer<RawAlertEvent> {
  public AlertEventDeserializer() { super(RawAlertEvent.class); }
}
