package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ConformanceTest {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void fixturesMatchNode() throws Exception {
        Path root = Path.of("../../conformance/fixtures/core");
        try (var dirs = Files.list(root)) {
            for (Path dir : dirs.filter(Files::isDirectory).sorted().toList()) {
                Object versions = YamlDocs.parse(Files.readString(dir.resolve("versions.yaml")));
                List<Object> changes = new ArrayList<>();
                try (var files = Files.list(dir.resolve("changes"))) {
                    for (Path file : files.filter(path -> path.getFileName().toString().endsWith(".yaml")).sorted().toList()) {
                        changes.add(YamlDocs.parse(Files.readString(file)));
                    }
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> spec = JSON.readValue(dir.resolve("case.json").toFile(), Map.class);
                String schema = String.valueOf(spec.get("schema"));
                Map<String, SchemaDef> registry = new LinkedHashMap<>();
                registry.put(schema, fields(spec.get("fields")));
                if (spec.get("schemas") instanceof Map<?, ?> nested) {
                    for (Map.Entry<?, ?> entry : nested.entrySet()) registry.put(String.valueOf(entry.getKey()), fields(entry.getValue()));
                }
                Engine.Bundle bundle = Engine.build(versions, changes, "2026-10-30", registry, Map.of(), null, null, null);
                if (spec.get("request") instanceof Map<?, ?> request) {
                    checkRequest(dir.getFileName().toString(), bundle, schema, spec, request);
                    continue;
                }
                Object body = spec.containsKey("raw") ? spec.get("raw") : spec.get("input");
                try {
                    Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, String.valueOf(spec.get("version")), body, null, null, null, null, null, false, null, false), String.valueOf(spec.get("direction")));
                    if (spec.get("error") != null) throw new AssertionError(dir.getFileName() + " expected " + spec.get("error"));
                    assertEquals(canon(spec.get("expected")), canon(result.body()), dir.getFileName().toString());
                } catch (ApiversaException exception) {
                    assertEquals(spec.get("error"), exception.code(), dir.getFileName().toString());
                }
            }
        }
    }

    @Test
    void unknownVersionAndTooOldUseTheEnvelope() {
        Object versions = YamlDocs.parse("head: \"2026-03-01\"\nversions:\n  - date: \"2026-03-01\"\n  - date: \"2026-01-15\"\ndefault: oldest\n");
        Engine.Bundle bundle = Engine.build(versions, List.of(), "2026-10-30", Map.of(), Map.of(), null, null, null);
        ApiversaException unknown = assertThrowsCode(() -> Engine.resolve(bundle, Map.of("Api-Version", List.of("2026-02-01")), "Api-Version", null, null));
        assertEquals(400, unknown.status());
        assertEquals(List.of("2026-03-01", "2026-01-15"), unknown.envelope().get("error") instanceof Map<?, ?> error ? error.get("supportedVersions") : null);
        ApiversaException old = assertThrowsCode(() -> Engine.resolve(bundle, Map.of("api-version", List.of("2020-01-01")), "Api-Version", null, null));
        assertEquals("AV-E012", old.code());
        assertEquals(410, old.status());
        assertEquals("</apiversa/upgrade>; rel=\"sunset\"", old.headers().get(0)[1]);
    }

    @SuppressWarnings("unchecked")
    private static void checkRequest(String name, Engine.Bundle bundle, String schema, Map<String, Object> spec, Map<?, ?> request) {
        List<String[]> query = pairs(request.get("query"));
        List<String[]> headers = pairs(request.get("headers"));
        Integer status = request.get("status") instanceof Number number ? number.intValue() : null;
        String method = request.get("method") == null ? null : String.valueOf(request.get("method"));
        String path = request.get("path") == null ? null : String.valueOf(request.get("path"));
        try {
            Engine.Result result = Engine.execute(bundle, new Engine.Request(schema, String.valueOf(spec.get("version")), request.get("body"), method, path, query, headers, status, false, null, false), String.valueOf(spec.get("direction")));
            if (spec.get("error") != null) throw new AssertionError(name + " expected " + spec.get("error"));
            if (spec.get("response") instanceof Map<?, ?> response) {
                List<String[]> actualHeaders = new ArrayList<>(result.headers() == null ? List.of() : result.headers());
                actualHeaders.addAll(Engine.endpointDeprecationHeaders(bundle, String.valueOf(spec.get("version")), method, path));
                if (response.get("status") != null) assertEquals(((Number) response.get("status")).intValue(), result.status(), name);
                assertEquals(headerKey(pairs(response.get("headers"))), headerKey(actualHeaders), name);
                assertEquals(canon(response.get("body")), canon(result.body()), name);
                return;
            }
            Map<String, Object> expected = (Map<String, Object>) spec.get("expected");
            assertEquals(expected.get("method"), result.method(), name);
            assertEquals(expected.get("path"), result.path(), name);
            assertEquals(pairKey(pairs(expected.get("query")), false), pairKey(result.query(), false), name);
            assertEquals(headerKey(pairs(expected.get("headers"))), headerKey(result.headers()), name);
            assertEquals(canon(expected.get("body")), canon(result.body()), name);
        } catch (ApiversaException exception) {
            assertEquals(spec.get("error"), exception.code(), name);
        }
    }

    private static List<String[]> pairs(Object value) {
        List<String[]> out = new ArrayList<>();
        if (!(value instanceof List<?> list)) return out;
        for (Object item : list) {
            if (item instanceof List<?> pair && pair.size() >= 2) out.add(new String[] {String.valueOf(pair.get(0)), String.valueOf(pair.get(1))});
        }
        return out;
    }

    private static String headerKey(List<String[]> headers) {
        return pairKey(headers, true);
    }

    private static String pairKey(List<String[]> pairs, boolean ignoreNameCase) {
        if (pairs == null) return "";
        List<String> lines = new ArrayList<>();
        for (String[] pair : pairs) lines.add((ignoreNameCase ? pair[0].toLowerCase(Locale.ROOT) : pair[0]) + "=" + pair[1]);
        if (ignoreNameCase) lines.sort(Comparator.naturalOrder());
        return String.join("\n", lines);
    }

    private static ApiversaException assertThrowsCode(org.junit.jupiter.api.function.Executable executable) {
        try {
            executable.execute();
        } catch (Throwable exception) {
            assertInstanceOf(ApiversaException.class, exception);
            return (ApiversaException) exception;
        }
        throw new AssertionError("expected ApiversaException");
    }

    private static SchemaDef fields(Object value) {
        if (!(value instanceof List<?> names)) return new SchemaDef(null);
        List<SchemaField> fields = new ArrayList<>();
        for (Object name : names) fields.add(new SchemaField(String.valueOf(name), null, null));
        return new SchemaDef(fields);
    }

    private static String canon(Object value) {
        return Json.encode(Json.fromPlain(value, "up"), "up");
    }
}
