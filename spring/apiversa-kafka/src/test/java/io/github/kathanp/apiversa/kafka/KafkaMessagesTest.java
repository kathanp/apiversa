package io.github.kathanp.apiversa.kafka;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.YamlDocs;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.junit.jupiter.api.Test;

class KafkaMessagesTest {
    @Test
    void upgradesAConsumerRecordAndDowngradesAProducerRecord() throws Exception {
        Engine.Bundle bundle = bundle();
        ConsumerRecord<String, String> incoming = new ConsumerRecord<>("hotels", 0, 0L, "h_1", "{\"city\":\"Paris\"}");
        incoming.headers().add("Api-Version", "2026-01-15".getBytes(StandardCharsets.UTF_8));
        ConsumerRecord<String, String> upgraded = new ApiversaKafkaInterceptor(bundle, "Hotel").intercept(incoming, null);
        assertEquals("{\"locality\":\"Paris\"}", upgraded.value());
        assertEquals("2026-01-15", new String(upgraded.headers().lastHeader("Api-Version").value(), StandardCharsets.UTF_8));

        ProducerRecord<String, String> outgoing = ApiversaMessages.downgrade(bundle, "hotels", "h_1", "{\"locality\":\"Paris\"}", "Hotel", "2026-01-15", "Api-Version");
        assertEquals("{\"city\":\"Paris\"}", outgoing.value());
        assertEquals("2026-01-15", new String(outgoing.headers().lastHeader("Api-Version").value(), StandardCharsets.UTF_8));
    }

    @Test
    void headerMapConvertsWithoutAKafkaClient() throws Exception {
        Engine.Bundle bundle = bundle();
        String upgraded = ApiversaMessages.convert(bundle, "{\"city\":\"Paris\"}", "Hotel", "up", Map.of("Api-Version", List.of("2026-01-15")), "Api-Version");
        assertEquals("{\"locality\":\"Paris\"}", upgraded);
        String head = ApiversaMessages.convert(bundle, "{\"locality\":\"Paris\"}", "Hotel", "down", Map.of("Api-Version", List.of("2026-03-01")), "Api-Version");
        assertEquals("{\"locality\":\"Paris\"}", head);
        assertNull(ApiversaMessages.convert(bundle, null, "Hotel", "up", Map.of(), "Api-Version"));
        String missing = ApiversaMessages.convert(bundle, "{\"city\":\"Paris\"}", "Hotel", "up", null, "Api-Version");
        assertEquals("{\"locality\":\"Paris\"}", missing);
        ApiversaException unknown = assertThrows(ApiversaException.class, () -> ApiversaMessages.convert(bundle, "{\"city\":\"Paris\"}", "Hotel", "up", Map.of("Api-Version", List.of("2026-02-01")), "Api-Version"));
        assertEquals("AV-E002", unknown.code());
    }

    @Test
    void readsTheVersionHeaderCaseInsensitivelyAndKeepsNonJson() throws Exception {
        Engine.Bundle bundle = bundle();
        RecordHeaders headers = new RecordHeaders();
        headers.add("api-version", "2026-01-15".getBytes(StandardCharsets.UTF_8));
        headers.add("trace", "1".getBytes(StandardCharsets.UTF_8));
        ConsumerRecord<String, String> incoming = new ConsumerRecord<>("hotels", 0, 1L, "h_1", "{\"city\":\"Paris\"}");
        incoming.headers().add("api-version", "2026-01-15".getBytes(StandardCharsets.UTF_8));
        incoming.headers().add("trace", "1".getBytes(StandardCharsets.UTF_8));
        ConsumerRecord<String, String> same = ApiversaMessages.upgrade(bundle, incoming, "Hotel", "Api-Version");
        assertEquals("{\"locality\":\"Paris\"}", same.value());
        assertEquals("1", new String(same.headers().lastHeader("trace").value(), StandardCharsets.UTF_8));
        ConsumerRecord<String, String> broken = new ConsumerRecord<>("hotels", 0, 2L, "h_1", "not-json");
        broken.headers().add("Api-Version", "2026-01-15".getBytes(StandardCharsets.UTF_8));
        assertThrows(Json.SyntaxException.class, () -> ApiversaMessages.upgrade(bundle, broken, "Hotel", "Api-Version"));
        Map<String, List<String>> read = ApiversaMessages.headerValues(headers, "Api-Version");
        assertEquals(List.of("2026-01-15"), read.get("Api-Version"));
        assertEquals(Map.of(), ApiversaMessages.headerValues(null, "Api-Version"));
        RecordHeaders blank = new RecordHeaders();
        blank.add("Api-Version", null);
        assertEquals(Map.of(), ApiversaMessages.headerValues(blank, "Api-Version"));
    }

    private static Engine.Bundle bundle() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: rename-city
                description: "Hotel.city renamed to locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """);
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
