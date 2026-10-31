package io.github.kathanp.apiversa.webflux;

import static org.springframework.http.MediaType.APPLICATION_JSON;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@SpringBootTest(classes = WebFluxVersionTest.App.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "apiversa.dir=classpath:api-versions",
        "apiversa.today=2026-10-31"
})
@AutoConfigureWebTestClient
class WebFluxVersionTest {
    @jakarta.annotation.Resource
    private WebTestClient client;

    @Test
    void oldJsonDropsTheAddedFieldAndSendsDeprecation() {
        client.get().uri("/hotels/h_1").header("Api-Version", "2026-01-15").exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals("Apiversa-Trace", "2026-03-01.add-name")
                .expectHeader().exists("Deprecation")
                .expectHeader().exists("Sunset")
                .expectHeader().valueEquals("Link", "</apiversa/upgrade>; rel=\"deprecation\"")
                .expectBody().json("{\"id\":\"h_1\"}");
    }

    @Test
    void headJsonKeepsTheField() {
        client.get().uri("/hotels/h_1").header("Api-Version", "2026-03-01").exchange()
                .expectStatus().isOk()
                .expectHeader().doesNotExist("Deprecation")
                .expectBody().json("{\"id\":\"h_1\",\"name\":\"Bay\"}");
    }

    @Test
    void unknownVersionUsesTheEnvelope() {
        client.get().uri("/hotels/h_1").header("Api-Version", "2026-02-01").exchange()
                .expectStatus().isBadRequest()
                .expectBody().jsonPath("$.error.code").isEqualTo("AV-E002");
    }

    @Test
    void oldRequestIsUpgradedBeforeTheHandler() {
        client.post().uri("/hotels").header("Api-Version", "2026-01-15").contentType(APPLICATION_JSON).bodyValue("{\"id\":\"h_1\"}").exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"id\":\"h_1\",\"seen\":\"Bay\"}");
        client.get().uri("/search?town=Paris").header("Api-Version", "2026-01-15").exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"id\":\"Paris\"}");
    }

    @Test
    void streamsConvertOneLineAtATime() {
        client.get().uri("/hotels/stream").header("Api-Version", "2026-01-15").exchange()
                .expectStatus().isOk()
                .expectBody(String.class).isEqualTo("{\"id\":\"h_1\"}\n{\"id\":\"h_2\"}\n");
        client.get().uri("/events").header("Api-Version", "2026-01-15").exchange()
                .expectStatus().isOk()
                .expectBody(String.class).value(body -> {
                    if (!body.contains("data: {\"id\":\"h_1\"}") || body.contains("name")) throw new AssertionError(body);
                });
    }

    @Test
    void unannotatedRoutesStayUntouched() {
        client.get().uri("/health").exchange().expectStatus().isOk().expectBody(String.class).isEqualTo("ok");
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class App {
        @Bean
        Hotels hotels() {
            return new Hotels();
        }
    }

    @RestController
    static class Hotels {
        @GetMapping("/hotels/{id}")
        @ApiversaResponse("Hotel")
        Map<String, Object> get() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", "h_1");
            body.put("name", "Bay");
            return body;
        }

        @PostMapping("/hotels")
        @ApiversaRequest("Hotel")
        @ApiversaResponse("Hotel")
        Map<String, Object> create(@RequestBody Map<String, Object> body) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", body.get("id"));
            out.put("seen", body.get("name"));
            return out;
        }

        @GetMapping("/search")
        @ApiversaResponse("Hotel")
        Map<String, Object> search(@RequestParam(name = "city", required = false) String city) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", city);
            body.put("name", "Bay");
            return body;
        }

        @GetMapping(value = "/hotels/stream", produces = "application/x-ndjson")
        @ApiversaResponse("Hotel")
        Flux<String> stream() {
            return Flux.just("{\"id\":\"h_1\",\"name\":\"Bay\"}\n", "{\"id\":\"h_2\",\"name\":\"Bay\"}\n");
        }

        @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
        @ApiversaResponse("Hotel")
        Flux<String> events() {
            return Flux.just("{\"id\":\"h_1\",\"name\":\"Bay\"}");
        }

        @GetMapping("/health")
        String health() {
            return "ok";
        }
    }
}
