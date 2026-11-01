package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.snakeyaml.engine.v2.exceptions.YamlEngineException;

/** Fixed seed for CI. The HARDEN run records a fresh seed beside the result. */
class FuzzTest {
    private static final int SEED = 0x41504956;
    private static final int INPUTS = 100_000;

    @Test
    void parsesAndConvertsOneHundredThousandInputs() throws Exception {
        java.util.function.DoubleSupplier yaml = mulberry32(SEED);
        for (int i = 0; i < INPUTS; i++) acceptYaml(sampleYaml(yaml));
        java.util.function.DoubleSupplier json = mulberry32(SEED + 1);
        for (int i = 0; i < INPUTS; i++) acceptJson("{\"name\":\"" + token(json) + "\"}");
        Engine.Bundle bundle = bundle();
        java.util.function.DoubleSupplier ops = mulberry32(SEED + 2);
        for (int i = 0; i < INPUTS; i++) acceptExecute(bundle, sample(ops), "up");
        java.util.function.DoubleSupplier down = mulberry32(SEED + 3);
        for (int i = 0; i < INPUTS; i++) acceptExecute(bundle, sample(down), "down");
        Object cleaned = YamlDocs.parse("name: a\n__proto__: 1\n");
        assertFalse(((Map<?, ?>) cleaned).containsKey("__proto__"));
        Map<String, Object> wide = new LinkedHashMap<>();
        wide.put("note", "x".repeat(10_000));
        Engine.Bundle timed = renameOnly();
        long started = System.nanoTime();
        Engine.execute(timed, new Engine.Request("Note", "2026-01-15", wide, null, null, List.of(), List.of(), null, false, null, false), "up");
        assertTrue((System.nanoTime() - started) / 1_000_000.0 < 10);
    }

    private static Map<String, Object> sample(java.util.function.DoubleSupplier rng) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", token(rng));
        body.put("status", "old");
        body.put("city", token(rng));
        return body;
    }

    private static void acceptYaml(String text) {
        try {
            YamlDocs.parse(text);
        } catch (ApiversaException | YamlEngineException ignored) {
            return;
        }
    }

    private static void acceptJson(String text) {
        try {
            Json.parse(text, "up", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS);
        } catch (ApiversaException | Json.SyntaxException ignored) {
            return;
        }
    }

    private static void acceptExecute(Engine.Bundle bundle, Map<String, Object> body, String direction) {
        try {
            java.util.List<String[]> query = new java.util.ArrayList<>();
            query.add(new String[] {"town", String.valueOf(body.get("city"))});
            java.util.List<String[]> headers = new java.util.ArrayList<>();
            headers.add(new String[] {"X-City", "Paris"});
            boolean error = "down".equals(direction);
            Engine.execute(bundle, new Engine.Request("Hotel", "2026-01-15", body, "GET", "/hotels/h_1", query, headers, error ? 404 : 200, error, error ? "missing" : null, false), direction);
        } catch (ApiversaException | Json.SyntaxException ignored) {
            return;
        }
    }

    private static Engine.Bundle renameOnly() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: fuzz-rename
                description: "Ten kilobyte budget."
                changes:
                  - op: field.rename
                    schema: Note
                    from: note
                    to: text
                """);
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Note", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
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
                id: fuzz-ops
                description: "Every op in one fuzz change."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: name
                    to: title
                  - op: field.add
                    schema: Hotel
                    path: guestCount
                    default: 1
                  - op: field.remove
                    schema: Hotel
                    path: city
                    default: ""
                  - op: field.move
                    schema: Hotel
                    from: city
                    to: address.city
                  - op: field.type
                    schema: Hotel
                    path: name
                    down:
                      from: name
                    up:
                      value: "$.name"
                  - op: enum.add
                    schema: Hotel
                    path: status
                    value: fresh
                    fallback: old
                  - op: enum.remove
                    schema: Hotel
                    path: status
                    value: old
                    replacement: fresh
                  - op: enum.rename
                    schema: Hotel
                    path: status
                    from: old
                    to: legacy
                  - op: object.wrap
                    schema: Hotel
                    fields:
                      - name
                    into: label
                  - op: error.shape
                    code: missing
                    down:
                      message: "$.name"
                  - op: query.rename
                    method: GET
                    path: /hotels/:id
                    from: town
                    to: city
                  - op: query.add
                    method: GET
                    path: /hotels/:id
                    name: guestCount
                    default: "0"
                  - op: query.remove
                    method: GET
                    path: /hotels/:id
                    name: town
                  - op: header.rename
                    from: X-City
                    to: X-Locality
                  - op: status.change
                    method: GET
                    path: /hotels/:id
                    from: 200
                    to: 201
                  - op: endpoint.add
                    method: GET
                    path: /hotels/:id
                  - op: custom
                    converter: identity
                """);
        Engine.Converter identity = new Engine.Converter() {
            public Object up(Object value) {
                return value;
            }
        };
        return Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of()), "Note", new Json.SchemaDef(List.of())), Map.of("identity", identity), null, null, null);
    }

    private static String sampleYaml(java.util.function.DoubleSupplier rng) {
        String key = token(rng);
        int kind = (int) Math.floor(rng.getAsDouble() * 5);
        if (kind == 0) return "";
        if (kind == 1) return key + ": " + token(rng) + "\n__proto__: 1\n";
        if (kind == 2) return "items:\n  - " + token(rng) + "\n  - " + (int) Math.floor(rng.getAsDouble() * 10) + "\n";
        if (kind == 3) return "\tbad";
        return key + ":\n  nested: " + token(rng) + "\n";
    }

    private static String token(java.util.function.DoubleSupplier rng) {
        String alphabet = "abcxyz_012";
        int length = 1 + (int) Math.floor(rng.getAsDouble() * 6);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < length; i++) out.append(alphabet.charAt((int) Math.floor(rng.getAsDouble() * alphabet.length())));
        return out.toString();
    }

    private static java.util.function.DoubleSupplier mulberry32(int seed) {
        int[] state = { seed };
        return () -> {
            state[0] = state[0] + 0x6d2b79f5;
            int value = state[0];
            value = (value ^ (value >>> 15)) * (value | 1);
            value ^= value + ((value ^ (value >>> 7)) * (value | 61));
            return Integer.toUnsignedLong(value ^ (value >>> 14)) / 4294967296.0;
        };
    }
}
