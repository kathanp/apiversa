package io.github.kathanp.apiversa.client;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ApiversaClientTest {
    @Test
    void sendsThePinnedDateToTheLocalStub() throws Exception {
        AtomicReference<String> version = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/hotels", exchange -> {
            version.set(exchange.getRequestHeaders().getFirst("Api-Version"));
            byte[] body = "{\"name\":\"Bay\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
            Hotel hotel = new ApiversaClient(HttpClient.newHttpClient(), base, "Api-Version").get("2026-01-15", "/hotels", Hotel.class);
            assertEquals("2026-01-15", version.get());
            assertEquals("Bay", hotel.name());
        } finally {
            server.stop(0);
        }
    }

    public record Hotel(String name) {}
}
