package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TrafficReplayTest {
    @Test
    void reportsAResponseTheCurrentChainNoLongerProduces() throws Exception {
        Engine.Bundle bundle = bundle();
        String samples = """
                {"version":"2026-01-15","schema":"Hotel","request":{"id":"h_1"},"response":{"id":"h_1"}}

                {"version":"2026-01-15","schema":"Hotel","request":{"city":"Paris"},"response":{"locality":"Paris"}}
                {"version":"2026-01-15","schema":"Hotel"}
                not-json
                """;
        List<String> diffs = TrafficReplay.differences(bundle, samples);
        assertEquals(3, diffs.size());
        assertTrue(diffs.get(0).contains("line 3"));
        assertTrue(diffs.get(0).contains("response differs"));
        assertTrue(diffs.get(1).contains("line 4"));
        assertTrue(diffs.get(1).contains("not a sample"));
        assertTrue(diffs.get(2).contains("line 5"));
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
                id: rename
                description: Hotel.city renamed to locality.
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """);
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
    }
}
