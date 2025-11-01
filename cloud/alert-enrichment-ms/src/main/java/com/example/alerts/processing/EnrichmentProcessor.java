package com.example.alerts.processing;

import com.example.alerts.model.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Outgoing;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class EnrichmentProcessor {

  @ConfigProperty(name = "alert.enrichment.fallbackRecipients", defaultValue = "")
  Optional<String> fallbackRecipients;

  private String mapSeverity(String alert) {
    return switch (alert) {
      case "bpm_very_high", "bp_critical" -> "critical";
      case "bpm_high" -> "warning";
      default -> "info";
    };
  }

  private String buildTitle(String alert) {
    return switch (alert) {
      case "bpm_very_high" -> "Critical Heart Rate Alert";
      case "bpm_high"      -> "High Heart Rate Alert";
      case "bp_critical"   -> "Critical Blood Pressure Alert";
      default              -> "Health Alert";
    };
  }

  private String buildMessage(String alert, String subject) {
    return switch (alert) {
      case "bpm_very_high" -> "Patient %s has a very high heart rate.".formatted(subject);
      case "bpm_high"      -> "Patient %s has a high heart rate.".formatted(subject);
      case "bp_critical"   -> "Patient %s has a critical blood pressure reading.".formatted(subject);
      default              -> "Health alert detected for %s.".formatted(subject);
    };
  }

  private List<Recipient> fallback() {
    if (fallbackRecipients.isEmpty() || fallbackRecipients.get().isBlank()) return List.of();
    List<Recipient> out = new ArrayList<>();
    for (String m : fallbackRecipients.get().split(",")) {
      var r = new Recipient();
      r.email = m.trim();
      r.role = "fallback";
      out.add(r);
    }
    return out;
  }

  @Incoming("alert-events")
  @Outgoing("enriched-alerts-events")
  public EnrichedAlert enrich(RawAlertEvent in) {
    String subject = (in.house_id != null ? "House " + in.house_id : "Unknown patient");
    String title = buildTitle(in.alert_message);
    String severity = mapSeverity(in.alert_message);
    String message = buildMessage(in.alert_message, subject);

    List<Recipient> recipients = fallback(); // DB viendra ensuite

    EnrichedAlert out = new EnrichedAlert();
    out.title = title;
    out.message = message;
    out.recipients = recipients;
    out.severity = severity;
    out.patientId = in.house_id;     // provisoire
    out.timestamp = Instant.now();
    Map<String,Object> meta = new HashMap<>();
    meta.put("alert_message", in.alert_message);
    if (in.metrics != null) meta.put("metrics", in.metrics);
    out.meta = meta;
    return out;
  }
}
