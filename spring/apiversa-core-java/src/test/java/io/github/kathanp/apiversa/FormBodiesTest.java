package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FormBodiesTest {
    @Test
    void renamesAUrlencodedFieldAndCopiesAFilePart() throws Exception {
        Engine.Bundle bundle = bundle();
        FormBodies.Result up = FormBodies.convert(bundle, "city=Paris&note=x", "application/x-www-form-urlencoded", "Hotel", "2026-01-15", "up");
        assertEquals(Map.of("locality", "Paris", "note", "x"), up.fields());
        assertEquals("note=x&locality=Paris", up.body());
        FormBodies.Result head = FormBodies.convert(bundle, "locality=Paris", "application/x-www-form-urlencoded", "Hotel", "2026-03-01", "up");
        assertEquals("locality=Paris", head.body());
        String file = "hello-file";
        String multipart = "--b\r\nContent-Disposition: form-data; name=\"city\"\r\n\r\nParis\r\n--b\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"a.txt\"\r\nContent-Type: application/octet-stream\r\n\r\n" + file + "\r\n--b--\r\n";
        FormBodies.Result converted = FormBodies.convert(bundle, multipart, "multipart/form-data; boundary=b", "Hotel", "2026-01-15", "up");
        assertEquals(Map.of("locality", "Paris"), converted.fields());
        assertTrue(converted.body().contains("name=\"locality\""));
        assertTrue(converted.body().contains(file));
        assertTrue(converted.body().contains("filename=\"a.txt\""));
        assertEquals("city=Paris", FormBodies.convert(bundle, "city=Paris", "text/plain", "Hotel", "2026-01-15", "up").body());
        assertEquals(multipart, FormBodies.convert(bundle, multipart, "multipart/form-data", "Hotel", "2026-01-15", "up").body());
        assertEquals("Lyon", FormBodies.convert(bundle, "city=Paris&city=Lyon", "application/x-www-form-urlencoded", "Hotel", "2026-01-15", "up").fields().get("locality"));
        assertNull(FormBodies.convert(bundle, null, null, "Hotel", "2026-01-15", "up").body());
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
