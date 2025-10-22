package com.example.alerts.model;

import java.time.Instant;
import java.util.Map;

public class AlertEvent {
    public String patientId;
    public String type;         // ex. "tachycardia"
    public Double score;        // ex. 0.92
    public Instant timestamp;
    public Map<String, Object> vitals;
}