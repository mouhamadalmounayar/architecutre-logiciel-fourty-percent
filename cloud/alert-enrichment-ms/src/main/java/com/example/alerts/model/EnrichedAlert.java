package com.example.alerts.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class EnrichedAlert {
  public String title;
  public String message;
  public List<Recipient> recipients;
  public String severity;
  public String patientId;     // ou house_id pour la démo
  public Instant timestamp;
  public Map<String,Object> meta;
}
