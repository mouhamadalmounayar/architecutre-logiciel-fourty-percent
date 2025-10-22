package com.example.alerts.model;

import java.time.Instant;
import java.util.Map;

public class EnrichedAlertEvent {
    public String patientId;
    public String type;
    public Double score;
    public Instant timestamp;
    public String severity;         // WARN/CRITICAL/...
    public Map<String, Object> context; // ex. nurseEmail, patientMeta, etc.
}
