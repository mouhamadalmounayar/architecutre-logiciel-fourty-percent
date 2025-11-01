package com.example.alerts.processing;

import com.example.alerts.model.*;
import com.example.alerts.repositories.PatientRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Outgoing;
import org.jboss.logging.Logger;

@ApplicationScoped
public class EnrichmentProcessor {

    private final PatientRepository patientRepository;
    private final Optional<String> fallbackRecipients;
    private static final Logger LOG = Logger.getLogger(
        EnrichmentProcessor.class
    );

    public EnrichmentProcessor(
        PatientRepository patientRepository,
        @ConfigProperty(
            name = "alert.enrichment.fallbackRecipients",
            defaultValue = ""
        ) Optional<String> fallbackRecipients
    ) {
        this.patientRepository = patientRepository;
        this.fallbackRecipients = fallbackRecipients;
    }

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
            case "bpm_high" -> "High Heart Rate Alert";
            case "bp_critical" -> "Critical Blood Pressure Alert";
            default -> "Health Alert";
        };
    }

    private String buildMessage(String alert, String subject) {
        return switch (alert) {
            case "bpm_very_high" -> "Patient %s has a very high heart rate.".formatted(
                subject
            );
            case "bpm_high" -> "Patient %s has a high heart rate.".formatted(
                subject
            );
            case "bp_critical" -> "Patient %s has a critical blood pressure reading.".formatted(
                subject
            );
            default -> "Health alert detected for %s.".formatted(subject);
        };
    }

    private List<Recipient> fallback() {
        if (
            fallbackRecipients.isEmpty() || fallbackRecipients.get().isBlank()
        ) return List.of();
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
        LOG.infof("Processing alert event: %s", in.toString());
        LOG.infof(
            "Alert details - house_id: %s, alert_message: %s, metrics: %s",
            in.house_id,
            in.alert_message,
            in.metrics
        );

        try {
            String title = buildTitle(in.alert_message);
            String severity = mapSeverity(in.alert_message);

            LOG.infof("Looking up patient for house_id: %s", in.house_id);
            Optional<Patient> patientOpt = lookupPatient(in.house_id);

            String subject = patientOpt
                .map(p -> p.firstName + " " + p.lastName)
                .orElse("Unknown patient");

            LOG.infof(
                "Patient lookup for house_id %s: %s",
                in.house_id,
                patientOpt.isPresent() ? "found" : "not found"
            );
            String message = buildMessage(in.alert_message, subject);
            List<Recipient> recipients = new ArrayList<>();
            if (patientOpt.isPresent()) {
                Patient patient = patientOpt.get();
                LOG.infof(
                    "Patient found: %s %s (ID: %d)",
                    patient.firstName,
                    patient.lastName,
                    patient.id
                );

                if (patient.doctor != null && patient.doctor.email != null) {
                    var r = new Recipient();
                    r.email = patient.doctor.email;
                    r.role = "doctor";
                    recipients.add(r);
                    LOG.infof(
                        "Added doctor recipient: %s",
                        patient.doctor.email
                    );
                } else {
                    LOG.warnf(
                        "Patient %d has no doctor or doctor email",
                        patient.id
                    );
                }

                if (patient.nurse != null && patient.nurse.email != null) {
                    var r = new Recipient();
                    r.email = patient.nurse.email;
                    r.role = "nurse";
                    recipients.add(r);
                    LOG.infof("Added nurse recipient: %s", patient.nurse.email);
                } else {
                    LOG.warnf(
                        "Patient %d has no nurse or nurse email",
                        patient.id
                    );
                }
            } else {
                LOG.warnf("No patient found for house_id: %s", in.house_id);
            }
            if (recipients.isEmpty()) {
                LOG.warnf(
                    "No recipients found for alert, using default recipient"
                );
                var r = new Recipient();
                r.email = "default@example.com";
                r.role = "default";
                recipients.add(r);
            }
            EnrichedAlert out = new EnrichedAlert();
            out.title = title;
            out.message = message;
            out.recipients = recipients;
            out.severity = severity;
            out.patientId = in.house_id; // provisoire
            out.timestamp = Instant.now();
            Map<String, Object> meta = new HashMap<>();
            meta.put("alert_message", in.alert_message);
            if (in.metrics != null) meta.put("metrics", in.metrics);
            out.meta = meta;

            LOG.infof(
                "Enriched alert created with %d recipients",
                recipients.size()
            );
            return out;
        } catch (Exception e) {
            LOG.errorf(
                e,
                "Error processing alert event for house_id: %s",
                in.house_id
            );
            throw e;
        }
    }

    @Transactional
    Optional<Patient> lookupPatient(String houseId) {
        try {
            Integer id = Integer.parseInt(houseId);
            LOG.infof("Querying database for patient with houseId: %d", id);
            Optional<Patient> result = patientRepository.findByHouseId(id);
            LOG.infof(
                "Database query completed. Patient found: %s",
                result.isPresent()
            );
            return result;
        } catch (NumberFormatException e) {
            LOG.errorf("Invalid house_id format: %s", houseId);
            return Optional.empty();
        } catch (Exception e) {
            LOG.errorf(
                e,
                "Database error looking up patient with house_id: %s",
                houseId
            );
            return Optional.empty();
        }
    }
}
