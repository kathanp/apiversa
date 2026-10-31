package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ClientFieldTest {
    @Test
    void mapsRenameMoveNestedArrayAndHeadOnlyFields() throws Exception {
        Object versions = YamlDocs.parse("""
                head: "2026-03-01"
                default: oldest
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                """);
        Object change = YamlDocs.parse("""
                version: "2026-03-01"
                id: reshape
                description: "Rename, move, and add fields."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: town
                    to: city
                  - op: field.move
                    schema: Hotel
                    from: location.city
                    to: address.city
                  - op: field.rename
                    schema: Hotel
                    from: guests[].fullName
                    to: guests[].name
                  - op: field.add
                    schema: Hotel
                    path: nickname
                    default: ""
                """);
        Engine.Bundle bundle = Engine.build(versions, List.of(change), "2026-10-31", Map.of("Hotel", new Json.SchemaDef(List.of())), Map.of(), null, null, null);
        assertEquals("town", Engine.clientField(bundle, "2026-01-15", "Hotel", "city").field());
        assertEquals("location.city", Engine.clientField(bundle, "2026-01-15", "Hotel", "address.city").field());
        assertEquals("guests[0].fullName", Engine.clientField(bundle, "2026-01-15", "Hotel", "guests[0].name").field());
        Engine.ClientField added = Engine.clientField(bundle, "2026-01-15", "Hotel", "nickname");
        assertEquals("_head", added.field());
        assertEquals("nickname", added.headPath());
        assertEquals("city", Engine.clientField(bundle, "2026-03-01", "Hotel", "city").field());
        assertNull(Engine.clientField(bundle, "2026-03-01", "Hotel", "city").headPath());
    }
}
