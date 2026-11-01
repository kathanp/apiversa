package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.Json.SchemaField;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Response headers, sunset enforcement, header and link ops, events, and the step diff. */
class LaterEngineTest {
    @Test
    void echoesTheVersionAndWarnsOnlyWhenUnpinned() {
        Engine.Bundle bundle = bundle("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """, "");
        Engine.Decision explicit = Engine.resolveDecision(bundle, Map.of("Api-Version", List.of("2026-03-01")), "Api-Version", null, null);
        assertEquals("header", explicit.source());
        assertEquals(List.of("Api-Version=2026-03-01"), named(Engine.versionHeaders("Api-Version", explicit)));
        Engine.Decision fallback = Engine.resolveDecision(bundle, Map.of(), "Api-Version", null, null);
        assertEquals("default", fallback.source());
        assertEquals("2026-01-15", fallback.version());
        assertEquals("Apiversa-Default", Engine.versionHeaders("Api-Version", fallback).get(1)[0]);
        Engine.Decision resolved = Engine.resolveDecision(bundle, Map.of(), "Api-Version", "2026-03-01", null);
        assertEquals("resolver", resolved.source());
        assertEquals(1, Engine.versionHeaders("Api-Version", resolved).size());
    }

    @Test
    void enforcesSunsetOnlyWhenAsked() {
        Engine.Bundle enforced = bundle("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                    sunset: "2026-06-01"
                    sunsetEnforce: true
                default: oldest
                """, "");
        ApiversaException rejected = assertThrows(ApiversaException.class, () -> Engine.resolve(enforced, Map.of("Api-Version", List.of("2026-01-15")), "Api-Version", null, null));
        assertEquals("AV-E012", rejected.code());
        assertEquals("2026-01-15", rejected.headers().get(1)[1]);
        Engine.Bundle open = bundle("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                    sunset: "2026-06-01"
                default: oldest
                """, "");
        assertEquals("2026-01-15", Engine.resolve(open, Map.of("Api-Version", List.of("2026-01-15")), "Api-Version", null, null));
    }

    @Test
    void addsHeadersRewritesLinksAndLeavesDeprecatedFields() {
        Engine.Bundle headers = bundle("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """, """
                version: "2026-03-01"
                id: rooms
                description: rooms header
                changes:
                  - op: header.add
                    name: X-Rooms
                    default: "1"
                """);
        Engine.Result added = execute(headers, "2026-01-15", "up", null, List.of());
        assertEquals("1", pair(added.headers(), "X-Rooms"));
        Engine.Result kept = execute(headers, "2026-01-15", "up", null, List.<String[]>of(new String[] {"X-Rooms", ""}));
        assertEquals("", pair(kept.headers(), "X-Rooms"));
        Engine.Result removed = execute(headers, "2026-01-15", "down", null, List.<String[]>of(new String[] {"X-Rooms", "1"}));
        assertNull(pair(removed.headers(), "X-Rooms"));

        Map<String, SchemaDef> hotel = Map.of("Hotel", new SchemaDef(List.of(new SchemaField("url", null, null))));
        Engine.Bundle links = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """), List.of(YamlDocs.parse("""
                version: "2026-03-01"
                id: link
                description: url moved
                changes:
                  - op: link.rewrite
                    schema: Hotel
                    path: url
                    from: /hotels/:id
                    to: /properties/:id
                """)), "2026-10-31", hotel, Map.of(), null, null, null);
        Engine.Result rewritten = Engine.execute(links, new Engine.Request("Hotel", "2026-01-15", Map.of("url", "/hotels/h_1"), null, null, List.of(), List.of(), null, false, null, false), "up");
        assertEquals("/properties/h_1", ((Map<?, ?>) rewritten.body()).get("url"));
        Engine.Result absolute = Engine.execute(links, new Engine.Request("Hotel", "2026-01-15", Map.of("url", "https://api.example/hotels/h_1?x=1"), null, null, List.of(), List.of(), null, false, null, false), "up");
        assertEquals("https://api.example/properties/h_1?x=1", ((Map<?, ?>) absolute.body()).get("url"));
        Engine.Result untouched = Engine.execute(links, new Engine.Request("Hotel", "2026-01-15", Map.of("url", "/other/h_1"), null, null, List.of(), List.of(), null, false, null, false), "up");
        assertEquals("/other/h_1", ((Map<?, ?>) untouched.body()).get("url"));
    }

    @Test
    void upgradesAnEventAndConvertsOnlyTheMatchingVariant() {
        Map<String, SchemaDef> schemas = new LinkedHashMap<>();
        schemas.put("Hotel", new SchemaDef(List.of(new SchemaField("locality", null, null))));
        schemas.put("PaymentMethod", new SchemaDef(List.of(new SchemaField("type", null, null)), Map.of("card", "Card", "bank_account", "BankAccount"), "type"));
        schemas.put("Card", new SchemaDef(List.of(new SchemaField("type", null, null), new SchemaField("brand", null, null))));
        schemas.put("BankAccount", new SchemaDef(List.of(new SchemaField("type", null, null))));
        Engine.Bundle bundle = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """), List.of(YamlDocs.parse("""
                version: "2026-03-01"
                id: card-brand
                description: brand renamed
                changes:
                  - op: field.rename
                    schema: Card
                    from: network
                    to: brand
                """)), "2026-10-31", schemas, Map.of(), null, null, null);
        Object card = Engine.upgradeEvent(bundle, Map.of("type", "card", "network", "visa"), "PaymentMethod", "2026-01-15");
        assertEquals("visa", ((Map<?, ?>) card).get("brand"));
        Object bank = Engine.upgradeEvent(bundle, Map.of("type", "bank_account", "network", "visa"), "PaymentMethod", "2026-01-15");
        assertEquals("visa", ((Map<?, ?>) bank).get("network"));
        assertThrows(ApiversaException.class, () -> Engine.upgradeEvent(bundle, Map.of(), "Hotel", "1999-01-01"));
        Object head = Engine.upgradeEvent(bundle, Map.of("type", "card", "brand", "visa"), "PaymentMethod", "2026-03-01");
        assertEquals("visa", ((Map<?, ?>) head).get("brand"));
    }

    @Test
    void diffsTwoStepsAndPrintsNothingForTheSameDate() {
        Map<String, SchemaDef> hotel = Map.of("Hotel", new SchemaDef(List.of(new SchemaField("locality", null, null), new SchemaField("stars", null, null))));
        Engine.Bundle bundle = Engine.build(YamlDocs.parse("""
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                  - date: "2025-10-01"
                default: oldest
                """), List.of(YamlDocs.parse("""
                version: "2026-01-15"
                id: add-stars
                description: stars was added.
                changes:
                  - op: field.add
                    schema: Hotel
                    path: stars
                    default: 0
                """), YamlDocs.parse("""
                version: "2026-03-01"
                id: rename-city
                description: city became locality.
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """)), "2026-10-31", hotel, Map.of(), null, null, null);
        String text = Engine.diffText(bundle, "Hotel", "2025-10-01", "2026-03-01", "{\"city\":\"Paris\"}");
        assertEquals(true, text.indexOf("2026-01-15.add-stars") < text.indexOf("2026-03-01.rename-city"));
        assertEquals("", Engine.diffText(bundle, "Hotel", "2026-03-01", "2026-03-01", "{}"));
    }

    private static List<String> named(List<String[]> headers) {
        return headers.stream().map(pair -> pair[0] + "=" + pair[1]).toList();
    }

    private static String pair(List<String[]> headers, String name) {
        if (headers == null) return null;
        for (String[] header : headers) if (header[0].equalsIgnoreCase(name)) return header[1];
        return null;
    }

    private static Engine.Result execute(Engine.Bundle bundle, String version, String direction, Object body, List<String[]> headers) {
        return Engine.execute(bundle, new Engine.Request(null, version, body, "GET", "/hotels", List.of(), headers, null, false, null, false), direction);
    }

    private static Engine.Bundle bundle(String versions, String change) {
        List<Object> changes = change.isBlank() ? List.of() : List.of(YamlDocs.parse(change));
        return Engine.build(YamlDocs.parse(versions), changes, "2026-10-31", Map.of(), Map.of(), null, null, null);
    }
}
