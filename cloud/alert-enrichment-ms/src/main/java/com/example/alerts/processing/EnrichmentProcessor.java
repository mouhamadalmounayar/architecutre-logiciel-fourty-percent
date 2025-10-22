package com.example.alerts.processing;

import com.example.alerts.model.AlertEvent;
import com.example.alerts.model.EnrichedAlertEvent;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Outgoing;

import java.time.Instant;
import java.util.Map;

@ApplicationScoped
public class EnrichmentProcessor {

    @Incoming("alert-events")                 // lit depuis Kafka
    @Outgoing("enriched-alerts-events")       // écrit vers Kafka
    public EnrichedAlertEvent enrich(AlertEvent in) {
        EnrichedAlertEvent out = new EnrichedAlertEvent();
        out.patientId = in.patientId;
        out.type = in.type;
        out.score = in.score;
        out.timestamp = in.timestamp != null ? in.timestamp : Instant.now();

        // Placeholder : logique d’enrichissement ultra simple
        String severity = (in.score != null && in.score > 0.85) ? "CRITICAL"
                : (in.score != null && in.score > 0.65) ? "WARN" : "OK";
        out.severity = severity;

        // Plus tard: lire Postgres pour récupérer email infirmier, info patient, etc.
        out.context = Map.of("nurseEmail", "nurse@example.org", "source", "alert-enrichment-ms");
        return out;
    }
}