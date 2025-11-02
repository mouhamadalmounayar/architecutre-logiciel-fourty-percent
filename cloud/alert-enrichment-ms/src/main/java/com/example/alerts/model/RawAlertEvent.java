package com.example.alerts.model;

import java.util.Map;

public class RawAlertEvent {
  public int[] timestamp;
  public String alert_message;
  public String house_id;
  public Map<String,Object> metrics; 
}
