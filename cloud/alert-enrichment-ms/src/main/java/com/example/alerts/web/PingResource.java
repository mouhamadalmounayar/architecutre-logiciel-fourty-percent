package com.example.alerts.web;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/alerts")
public class PingResource {
  @GET @Produces(MediaType.TEXT_PLAIN)
  public String ping() { return "Hello from Quarkus REST"; }
}
