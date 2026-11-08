package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Upgrade each request body and downgrade each response body. A missing input writes nothing. */
public final class Pact {
    private Pact() {}

    public static boolean write(Path dir, Path input, Path out) throws IOException {
        if (!Files.isRegularFile(input)) return true;
        try {
            Object plain = Json.toPlain(Json.parse(Files.readString(input), "startup", Json.MAX_BODY_BYTES, Json.MAX_ARRAY_ITEMS), null, Map.of());
            List<?> interactions = plain instanceof Map<?, ?> map && map.get("interactions") instanceof List<?> list ? list : List.of();
            Engine.Bundle bundle = Engine.load(dir, "2026-11-08", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
            List<Map<String, Object>> done = new ArrayList<>();
            for (Object item : interactions) {
                if (!(item instanceof Map<?, ?> row)) continue;
                String version = String.valueOf(row.get("version"));
                String schema = String.valueOf(row.get("schema"));
                Engine.resolve(bundle, Map.of("Api-Version", List.of(version)), "Api-Version", null, null);
                Object requestBody = body(row.get("request"));
                Object responseBody = body(row.get("response"));
                Map<String, Object> request = new LinkedHashMap<>();
                request.put("body", Engine.upgradeEvent(bundle, requestBody, schema, version));
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("body", Engine.downgradeEvent(bundle, responseBody, schema, version));
                Map<String, Object> next = new LinkedHashMap<>();
                next.put("version", version);
                next.put("schema", schema);
                next.put("request", request);
                next.put("response", response);
                done.add(next);
            }
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("interactions", done);
            Files.writeString(out, Json.encode(Json.fromPlain(root, "down"), "down") + "\n");
            return true;
        } catch (ApiversaException exception) {
            Files.deleteIfExists(out);
            throw exception;
        } catch (RuntimeException exception) {
            Files.deleteIfExists(out);
            throw exception;
        }
    }

    private static Object body(Object side) {
        if (side instanceof Map<?, ?> map && map.get("body") != null) return map.get("body");
        return Map.of();
    }
}
