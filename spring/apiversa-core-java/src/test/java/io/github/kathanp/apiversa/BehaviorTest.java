package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Core behavior that the conformance fixtures do not exercise. */
class BehaviorTest {
    private static final String VERSIONS = """
            head: "2026-03-01"
            versions:
              - date: "2026-03-01"
              - date: "2026-01-15"
            default: oldest
            """;

    @Test
    void queryHeaderStatusAndTrace() {
        Engine.Bundle bundle = bundle("""
                version: "2026-03-01"
                id: query-city
                description: query and header
                changes:
                  - op: query.rename
                    method: GET
                    path: /hotels
                    from: town
                    to: city
                  - op: query.add
                    method: GET
                    path: /hotels
                    name: guestCount
                    default: ""
                  - op: query.remove
                    method: GET
                    path: /hotels
                    name: debug
                  - op: header.rename
                    from: X-Old
                    to: X-New
                  - op: status.change
                    method: POST
                    path: /hotels
                    from: 200
                    to: 201
                """);
        Engine.Result up = Engine.execute(bundle, request("Hotel", "2026-01-15", null, "GET", "/hotels",
                pairs(pair("town", "x"), pair("town", "y"), pair("guestCount", ""), pair("debug", "1")),
                pairs(pair("x-old", "a")), null, false, null, true), "up");
        assertEquals("city", up.query().get(0)[0]);
        assertEquals("y", up.query().get(1)[1]);
        assertEquals("", up.query().get(2)[1]);
        assertEquals(3, up.query().size());
        assertEquals("X-New", up.headers().get(0)[0]);
        assertEquals("2026-03-01.query-city", up.trace());
        Engine.Result down = Engine.execute(bundle, request("Hotel", "2026-01-15", null, "POST", "/hotels", List.of(), pairs(pair("X-New", "a")), 201, false, null, false), "down");
        assertEquals(200, down.status());
        assertEquals("X-Old", down.headers().get(0)[0]);
        Engine.Result head = Engine.execute(bundle, request("Hotel", "2026-03-01", "same", "GET", "/hotels", pairs(pair("town", "x")), null, null, false, null, false), "up");
        assertSame("same", head.body());
        assertEquals("town", head.query().get(0)[0]);
    }

    @Test
    void endpointsGateTheVersion() {
        Engine.Bundle bundle = bundle("""
                version: "2026-03-01"
                id: routes
                description: routes
                changes:
                  - op: endpoint.rename
                    method: GET
                    from: /hotels/:id
                    to: /properties/:id
                  - op: endpoint.add
                    method: POST
                    path: /hotels
                  - op: endpoint.remove
                    method: DELETE
                    path: /hotels/:id
                    legacyHandler: deleteHotel
                """);
        Engine.Result renamed = Engine.execute(bundle, request("Hotel", "2026-01-15", null, "GET", "/hotels/h_1", null, null, null, false, null, false), "up");
        assertEquals("/properties/h_1", renamed.path());
        ApiversaException added = assertThrows(ApiversaException.class, () -> Engine.execute(bundle, request("Hotel", "2026-01-15", null, "POST", "/hotels", null, null, null, false, null, false), "up"));
        assertEquals("AV-E010", added.code());
        assertEquals(404, added.status());
        Engine.Result legacy = Engine.execute(bundle, request("Hotel", "2026-01-15", null, "DELETE", "/hotels/h_1", null, null, null, false, null, false), "up");
        assertEquals("deleteHotel", legacy.legacyHandler());
        ApiversaException removed = assertThrows(ApiversaException.class, () -> Engine.execute(bundle, request("Hotel", "2026-03-01", null, "DELETE", "/hotels/h_1", null, null, null, false, null, false), "up"));
        assertEquals("AV-E011", removed.code());
        assertEquals(410, removed.status());
    }

    @Test
    void errorShapeSkipsFieldOps() {
        Engine.Bundle bundle = bundle("""
                version: "2026-03-01"
                id: errors
                description: errors
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                  - op: error.shape
                    code: hotel_missing
                    down:
                      value:
                        error: missing
                """);
        Engine.Result error = Engine.execute(bundle, request("Hotel", "2026-01-15", "{\"id\":\"h_1\"}", null, null, null, null, 404, true, "hotel_missing", false), "down");
        assertEquals("{\"error\":\"missing\"}", Json.encode(Json.fromPlain(error.body(), "down"), "down"));
        Engine.Result unmatched = Engine.execute(bundle, request("Hotel", "2026-01-15", "{\"id\":\"h_1\"}", null, null, null, null, 404, true, "other", false), "down");
        assertEquals("{\"id\":\"h_1\"}", Json.encode(Json.fromPlain(unmatched.body(), "down"), "down"));
        Engine.Result success = Engine.execute(bundle, request("Hotel", "2026-01-15", "{\"id\":\"h_1\",\"name\":\"Bay\"}", null, null, null, null, 200, false, null, false), "down");
        assertEquals("{\"id\":\"h_1\"}", Json.encode(Json.fromPlain(success.body(), "down"), "down"));
    }

    @Test
    void fieldsEnumsWrapAndCustomRoundTrip() {
        Engine.Bundle bundle = bundle("""
                version: "2026-03-01"
                id: shapes
                description: shapes
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: town
                  - op: field.move
                    schema: Hotel
                    from: guest.name
                    to: name
                  - op: field.remove
                    schema: Hotel
                    path: debug
                    default: false
                  - op: enum.add
                    schema: Hotel
                    path: status
                    value: archived
                    fallback: closed
                  - op: enum.remove
                    schema: Hotel
                    path: tier
                    value: gold
                    replacement: silver
                  - op: enum.rename
                    schema: Hotel
                    path: plan
                    from: basic
                    to: starter
                  - op: object.wrap
                    schema: Hotel
                    fields: [amount]
                    into: price
                  - op: custom
                    converter: priceObject
                """, Map.of("priceObject", new Engine.Converter() {
            @Override
            public Object up(Object value) {
                return value;
            }

            @Override
            public Object down(Object value) {
                return value;
            }
        }), Map.of("Hotel", hotel()));
        Map<String, Object> old = map();
        old.put("city", "Paris");
        old.put("guest", Map.of("name", "Ada"));
        old.put("debug", true);
        old.put("tier", "gold");
        old.put("plan", "basic");
        old.put("amount", 10);
        old.put("status", "open");
        Engine.Result up = Engine.execute(bundle, request("Hotel", "2026-01-15", old, null, null, null, null, null, false, null, false), "up");
        String upgraded = canon(up.body());
        assertTrue(upgraded.contains("\"town\":\"Paris\""));
        assertTrue(upgraded.contains("\"name\":\"Ada\""));
        assertTrue(upgraded.contains("\"tier\":\"silver\""));
        assertTrue(upgraded.contains("\"plan\":\"starter\""));
        assertTrue(upgraded.contains("\"price\":{\"amount\":10}"));
        assertTrue(!upgraded.contains("debug"));
        Engine.Result down = Engine.execute(bundle, request("Hotel", "2026-01-15", up.body(), null, null, null, null, null, false, null, false), "down");
        assertTrue(canon(down.body()).contains("\"city\":\"Paris\""));
        assertTrue(canon(down.body()).contains("\"plan\":\"basic\""));
        Map<String, Object> nullPrice = map();
        nullPrice.put("price", null);
        ApiversaException wrapped = assertThrows(ApiversaException.class, () -> Engine.execute(bundle, request("Hotel", "2026-01-15", nullPrice, null, null, null, null, null, false, null, false), "down"));
        assertEquals("AV-E016", wrapped.code());
        assertEquals(500, wrapped.status());
    }

    @Test
    void listsConvertItemsOnly() {
        Map<String, SchemaDef> registry = new LinkedHashMap<>();
        registry.put("Hotel", new SchemaDef(List.of(new SchemaField("name", null, null), new SchemaField("title", null, null))));
        registry.put("Page", new SchemaDef(List.of(new SchemaField("data", null, "Hotel"), new SchemaField("next_cursor", null, null))));
        Engine.Bundle bundle = bundle("""
                version: "2026-03-01"
                id: rename-name
                description: rename
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: name
                    to: title
                """, Map.of(), registry);
        Map<String, Object> page = map();
        page.put("data", List.of(Map.of("title", "Bay")));
        page.put("next_cursor", "n");
        Engine.Result down = Engine.execute(bundle, request("Page", "2026-01-15", page, null, null, null, null, null, false, null, false), "down");
        assertEquals("{\"data\":[{\"name\":\"Bay\"}],\"next_cursor\":\"n\"}", canon(down.body()));
        Engine.Result array = Engine.execute(bundle, request("Hotel", "2026-01-15", "[{\"title\":\"Bay\"}]", null, null, null, null, null, false, null, false), "down");
        assertEquals("[{\"name\":\"Bay\"}]", canon(array.body()));
    }

    @Test
    void limitsPinsAndHeaders() {
        Engine.Bundle small = Engine.build(YamlDocs.parse(VERSIONS), List.of(change("""
                version: "2026-03-01"
                id: touch
                description: touch
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """)), "2026-10-30", Map.of("Hotel", hotel()), Map.of(), new Engine.Limits(8, 1), null, "error");
        ApiversaException body = assertThrows(ApiversaException.class, () -> Engine.execute(small, request("Hotel", "2026-01-15", "{\"id\":\"hotel\"}", null, null, null, null, null, false, null, false), "up"));
        assertEquals("AV-E008", body.code());
        assertEquals(413, body.status());
        ApiversaException items = assertThrows(ApiversaException.class, () -> Engine.execute(small, request("Hotel", "2026-01-15", "[1,2]", null, null, null, null, null, false, null, false), "down"));
        assertEquals("AV-E009", items.code());
        Engine.Bundle pass = Engine.build(YamlDocs.parse(VERSIONS), List.of(change("""
                version: "2026-03-01"
                id: touch
                description: touch
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """)), "2026-10-30", Map.of("Hotel", hotel()), Map.of(), new Engine.Limits(4, 10), null, "passthrough");
        Engine.Result through = Engine.execute(pass, request("Hotel", "2026-01-15", "{\"id\":\"hotel\"}", null, null, null, null, null, false, null, false), "down");
        assertEquals("{\"id\":\"hotel\"}", through.body());
        assertThrows(ApiversaException.class, () -> Engine.execute(pass, request("Hotel", "2026-01-15", "{\"id\":\"hotel\"}", null, null, null, null, null, false, null, false), "up"));
        Engine.Result clean = Engine.execute(bundle("""
                version: "2026-03-01"
                id: touch
                description: touch
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """), request("Hotel", "2026-01-15", "{\"__proto__\":1,\"constructor\":1,\"prototype\":1,\"id\":\"h\"}", null, null, null, null, null, false, null, false), "up");
        assertEquals("{\"id\":\"h\",\"name\":\"Bay\"}", canon(clean.body()));
        Map<String, String> pins = new LinkedHashMap<>();
        Engine.Bundle pinned = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: pin-on-first-call
                """), List.of(), "2026-10-30", Map.of(), Map.of(), null, new Engine.PinStore() {
            public String get(String clientId) { return pins.get(clientId); }
            public void set(String clientId, String date) { pins.put(clientId, date); }
        }, null);
        assertEquals("2026-03-01", Engine.resolve(pinned, Map.of(), "Api-Version", null, "c"));
        assertEquals("2026-03-01", pins.get("c"));
        assertEquals("AV-E002", assertThrows(ApiversaException.class, () -> Engine.resolve(pinned, Map.of(), "Api-Version", null, null)).code());
        assertThrows(ApiversaException.class, () -> Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                default: pin-on-first-call
                """), List.of(), "2026-10-30", Map.of(), Map.of(), null, null, null));
        Engine.Bundle latest = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: latest
                """), List.of(), "2026-10-30", Map.of(), Map.of(), null, null, null);
        assertEquals("2026-03-01", Engine.resolve(latest, null, "Api-Version", null, null));
        assertEquals("2026-01-15", Engine.resolve(bundle(""), Map.of("Api-Version", List.of("2026-01-15, 2026-01-15")), "Api-Version", "ignored", null));
        assertEquals("AV-E002", assertThrows(ApiversaException.class, () -> Engine.resolve(bundle(""), Map.of("Api-Version", List.of("2026-03-01, 2026-01-15")), null, null, null)).code());
        assertEquals("{\"error\":{\"code\":\"AV-E002\",\"message\":\"Unknown version.\",\"supportedVersions\":[\"2026-03-01\",\"2026-01-15\"]}}", canon(assertThrows(ApiversaException.class, () -> Engine.resolve(bundle(""), Map.of("Api-Version", List.of("nope")), null, null, null)).envelope()));
    }

    @Test
    void startupRejectsBadBundles(@TempDir Path dir) throws Exception {
        assertEquals("AV-E003", fails(() -> Engine.build(YamlDocs.parse("""
                head: "2099-01-01"
                versions:
                  - date: "2099-01-01"
                """), List.of(), "2026-10-30", Map.of(), Map.of(), null, null, null)));
        assertEquals("AV-E001", fails(() -> Engine.build(YamlDocs.parse(VERSIONS), List.of(change("""
                version: "2026-03-01"
                id: same
                description: a
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """), change("""
                version: "2026-03-01"
                id: same
                description: b
                changes:
                  - op: field.add
                    schema: Hotel
                    path: city
                    default: Paris
                """)), "2026-10-30", Map.of("Hotel", hotel()), Map.of(), null, null, null)));
        assertEquals("AV-E013", fails(() -> Engine.build(YamlDocs.parse(VERSIONS), List.of(change("""
                version: "2026-03-01"
                id: draft-one
                description: draft
                draft: true
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """)), "2026-10-30", Map.of("Hotel", hotel()), Map.of(), null, null, null)));
        assertEquals("AV-E001", fails(() -> Engine.build(YamlDocs.parse("""
                head: "2026-01-15"
                versions:
                  - date: "2026-01-15"
                  - date: "2026-03-01"
                """), List.of(), "2026-10-30", Map.of(), Map.of(), null, null, null)));
        assertEquals("AV-E001", fails(() -> Engine.build(YamlDocs.parse("""
                head: "2026-02-31"
                versions:
                  - date: "2026-02-31"
                """), List.of(), "2026-10-30", Map.of(), Map.of(), null, null, null)));
        String deep = String.join(".", java.util.Collections.nCopies(33, "a"));
        assertEquals("AV-E004", fails(() -> Engine.build(YamlDocs.parse(VERSIONS), List.of(change("""
                version: "2026-03-01"
                id: deep
                description: deep
                changes:
                  - op: field.add
                    schema: Hotel
                    path: %s
                    default: 1
                """.formatted(deep))), "2026-10-30", Map.of("Hotel", hotel()), Map.of(), null, null, null)));
        assertEquals("AV-E001", fails(() -> bundle("""
                version: "2026-03-01"
                id: missing-schema
                description: missing
                changes:
                  - op: field.add
                    schema: Missing
                    path: name
                    default: Bay
                """)));
        assertEquals("AV-E001", fails(() -> bundle("""
                version: "2026-03-01"
                id: missing-fn
                description: missing
                changes:
                  - op: custom
                    converter: missing
                """)));
        assertEquals("AV-E016", fails(() -> Engine.execute(bundle("""
                version: "2026-03-01"
                id: bad-expr
                description: expr
                changes:
                  - op: field.type
                    schema: Hotel
                    path: price
                    down: { value: 1 }
                    up: { from: missing }
                """), request("Hotel", "2026-01-15", "{\"price\":1}", null, null, null, null, null, false, null, false), "up")));
        assertInstanceOf(Json.SyntaxException.class, assertThrows(Json.SyntaxException.class, () -> Engine.execute(bundle("""
                version: "2026-03-01"
                id: touch
                description: touch
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """), request("Hotel", "2026-01-15", "{", null, null, null, null, null, false, null, false), "up")));
        Files.writeString(dir.resolve("versions.yaml"), VERSIONS);
        Files.writeString(dir.resolve("2026-03-01.add-name.yaml"), """
                version: "2026-03-01"
                id: add-name
                description: add name
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        Files.writeString(dir.resolve("notes.yaml"), "# comment\n");
        Engine.Bundle loaded = Engine.load(dir, "2026-10-30", Map.of("Hotel", hotel()), Map.of(), null, null, null);
        assertEquals("2026-03-01", loaded.head());
        assertEquals(1, loaded.changes().size());
        assertEquals("AV-E001", fails(() -> YamlDocs.parse("a: 1\na: 2\n")));
        assertEquals("AV-E001", fails(() -> YamlDocs.parse("a: &x 1\n")));
        assertEquals("AV-E001", fails(() -> YamlDocs.parse("\tname: 1\n")));
        assertEquals("yes", YamlDocs.parse("name: yes\n") instanceof Map<?, ?> map ? map.get("name") : null);
    }

    @Test
    void pathsBindNestedSchemasAndPlansAreFixed() {
        Map<String, SchemaDef> registry = new LinkedHashMap<>();
        registry.put("Hotel", new SchemaDef(List.of(new SchemaField("name", null, null))));
        registry.put("Booking", new SchemaDef(List.of(new SchemaField("hotel", "Hotel", null), new SchemaField("code", null, null))));
        Engine.Bundle bundle = bundle("""
                version: "2026-03-01"
                id: paths
                description: paths
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: rooms.*.name
                    to: rooms.*.title
                  - op: field.rename
                    schema: Hotel
                    from: guests[].name
                    to: guests[].title
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """, Map.of(), registry);
        Map<String, Object> body = map();
        body.put("rooms", Map.of("a", Map.of("name", "Bay")));
        body.put("guests", List.of(Map.of("name", "Ada")));
        Engine.Result renamed = Engine.execute(bundle, request("Hotel", "2026-01-15", body, null, null, null, null, null, false, null, false), "up");
        String text = canon(renamed.body());
        assertTrue(text.contains("\"title\":\"Bay\""));
        assertTrue(text.contains("\"title\":\"Ada\""));
        Map<String, Object> booking = map();
        booking.put("hotel", Map.of("id", "h_1"));
        booking.put("code", "b");
        Engine.Result nested = Engine.execute(bundle, request("Booking", "2026-01-15", booking, null, null, null, null, null, false, null, false), "up");
        assertTrue(canon(nested.body()).contains("\"name\":\"Bay\""));
        assertSame(Engine.plan(bundle, "2026-01-15", "up"), Engine.plan(bundle, "2026-01-15", "up"));
        Engine.Result head = Engine.execute(bundle, request("Hotel", "2026-03-01", body, null, null, null, null, null, false, null, false), "up");
        assertSame(body, head.body());
    }

    @Test
    void jsonEscapesDepthAndEnvelopeStatuses() {
        assertEquals("\"a\\nb\\u0000\"", Json.encode(Json.parse("\"a\\nb\\u0000\"", "up", 1000, 10), "up"));
        assertEquals("[true,false,null]", Json.encode(Json.parse("[true, false, null]", "up", 1000, 10), "up"));
        assertEquals("1", Json.encode(Json.parse("1.0", "up", 1000, 10), "up"));
        assertEquals("100", Json.encode(Json.parse("1e2", "up", 1000, 10), "up"));
        assertThrows(Json.SyntaxException.class, () -> Json.parse("", "up", 1000, 10));
        assertThrows(Json.SyntaxException.class, () -> Json.parse("01", "up", 1000, 10));
        assertThrows(ApiversaException.class, () -> Json.parse("{\"a\":" + "{\"a\":".repeat(40) + "1" + "}".repeat(40) + "}", "down", 100000, 10));
        assertEquals(400, new ApiversaException("AV-E004", "up", List.of(), List.of()).status());
        assertEquals(500, new ApiversaException("AV-E007", "down", List.of(), List.of()).status());
        assertNull(new ApiversaException("AV-E006", "startup", List.of(), List.of()).status());
        assertNull(new ApiversaException("AV-E004", "startup", List.of(), List.of()).status());
        assertThrows(ApiversaException.class, () -> Json.fromPlain(new Object(), "up"));
    }

    private static Engine.Bundle bundle(String change) {
        if (change.isBlank()) return Engine.build(YamlDocs.parse(VERSIONS), List.of(), "2026-10-30", Map.of("Hotel", hotel()), Map.of(), null, null, null);
        return bundle(change, Map.of(), Map.of("Hotel", hotel()));
    }

    private static Engine.Bundle bundle(String change, Map<String, Engine.Converter> converters, Map<String, SchemaDef> registry) {
        return Engine.build(YamlDocs.parse(VERSIONS), List.of(change(change)), "2026-10-30", registry, converters, null, null, null);
    }

    private static Object change(String yaml) {
        return YamlDocs.parse(yaml);
    }

    private static Engine.Request request(String schema, String version, Object body, String method, String path, List<String[]> query, List<String[]> headers, Integer status, boolean error, String code, boolean trace) {
        return new Engine.Request(schema, version, body, method, path, query, headers, status, error, code, trace);
    }

    private static String[] pair(String name, String value) {
        return new String[] {name, value};
    }

    private static List<String[]> pairs(String[]... items) {
        return List.of(items);
    }

    private static SchemaDef hotel() {
        List<SchemaField> fields = new ArrayList<>();
        for (String name : List.of("id", "name", "city", "town", "status", "tier", "plan", "price", "amount", "debug", "guest")) {
            fields.add(new SchemaField(name, "guest".equals(name) ? "Guest" : null, null));
        }
        return new SchemaDef(fields);
    }

    private static Map<String, Object> map() {
        return new LinkedHashMap<>();
    }

    private static String canon(Object value) {
        return Json.encode(Json.fromPlain(value, "down"), "down");
    }

    private static String fails(org.junit.jupiter.api.function.Executable executable) {
        return assertThrows(ApiversaException.class, executable).code();
    }
}
