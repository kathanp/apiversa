package io.github.kathanp.apiversa.spring;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest(classes = ApiversaWebTest.App.class)
@AutoConfigureMockMvc
class ApiversaWebTest {
    @jakarta.annotation.Resource
    private MockMvc mvc;

    @Test
    void oldResponseDropsTheAddedDefault() throws Exception {
        mvc.perform(get("/hotels/h_1").header("Api-Version", "2026-01-15"))
                .andExpect(status().isOk())
                .andExpect(header().string("Apiversa-Trace", "2026-03-01.add-name"))
                .andExpect(content().json("{\"id\":\"h_1\"}"));
    }

    @Test
    void headResponseKeepsTheName() throws Exception {
        mvc.perform(get("/hotels/h_1").header("Api-Version", "2026-03-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Bay"));
    }

    @Test
    void unknownVersionUsesTheEnvelope() throws Exception {
        mvc.perform(get("/hotels/h_1").header("Api-Version", "2026-02-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("AV-E002"))
                .andExpect(jsonPath("$.error.message").value("Unknown version."));
    }

    @Test
    void tooOldVersionSendsTheSunsetLink() throws Exception {
        mvc.perform(get("/hotels/h_1").header("Api-Version", "2020-01-01"))
                .andExpect(status().isGone())
                .andExpect(header().string("Link", "</apiversa/upgrade>; rel=\"sunset\""))
                .andExpect(jsonPath("$.error.code").value("AV-E012"));
    }

    @Test
    void oldQueryAndBodyAreUpgradedBeforeTheHandler() throws Exception {
        mvc.perform(get("/hotels").header("Api-Version", "2026-01-15").param("town", "Paris"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"id\":\"Paris\"}"));
        mvc.perform(post("/hotels").header("Api-Version", "2026-01-15").contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"h_1\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"id\":\"h_1\"}"));
    }

    @Test
    void unannotatedRoutesStayUntouched() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk()).andExpect(content().string("ok"));
    }

    @Test
    void propertyOrderIsTheRegistry() {
        @JsonPropertyOrder({"b", "a"})
        class Hotel {}
        List<String> names = new ApiversaSchemas().schema("Hotel", Hotel.class).registry().get("Hotel").fields().stream().map(field -> field.name()).toList();
        org.junit.jupiter.api.Assertions.assertEquals(List.of("b", "a"), names);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class App {
        @Bean
        ApiversaSchemas schemas() {
            return new ApiversaSchemas().schema("Hotel", "id", "name");
        }

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

        @GetMapping("/hotels")
        @ApiversaResponse("Hotel")
        Map<String, Object> list(@RequestParam(name = "city", required = false) String city) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", city);
            body.put("name", "Bay");
            return body;
        }

        @PostMapping("/hotels")
        @ApiversaRequest("Hotel")
        @ApiversaResponse("Hotel")
        Map<String, Object> post(@RequestBody Map<String, Object> body) {
            if (!"Bay".equals(body.get("name"))) throw new IllegalStateException("request was not upgraded");
            return body;
        }

        @GetMapping("/health")
        String health() {
            return "ok";
        }
    }
}
