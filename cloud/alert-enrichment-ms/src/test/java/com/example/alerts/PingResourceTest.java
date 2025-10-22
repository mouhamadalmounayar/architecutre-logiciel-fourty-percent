package com.example.alerts;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
class PingResourceTest {
    @Test
    void testHelloEndpoint() {
        given()
          .when().get("/C:/Program Files/Git/alerts")
          .then()
             .statusCode(200)
             .body(is("Hello from Quarkus REST"));
    }

}