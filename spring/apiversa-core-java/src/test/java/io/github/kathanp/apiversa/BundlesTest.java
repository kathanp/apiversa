package io.github.kathanp.apiversa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BundlesTest {
    @Test
    void datesAndChangesStayInsideOneBundle(@TempDir Path root) throws Exception {
        Path billing = root.resolve("billing");
        Path identity = root.resolve("identity");
        write(billing, """
                version: "2026-03-01"
                id: rename-city
                description: "city became locality."
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """);
        write(identity, """
                version: "2026-03-01"
                id: add-stars
                description: "stars was added."
                changes:
                  - op: field.add
                    schema: Hotel
                    path: stars
                    default: 1
                """);
        Bundles bundles = Bundles.load(Map.of("billing", billing, "identity", identity), "2026-11-07", Map.of("Hotel", new Json.SchemaDef(java.util.List.of())));
        Engine.Result billed = Engine.execute(bundles.get("billing"), new Engine.Request("Hotel", "2026-01-15", "{\"city\":\"Paris\"}", null, null, null, null, null, false, null, false), "up");
        assertTrue(String.valueOf(billed.body()).contains("locality"));
        ApiversaException unknown = assertThrows(ApiversaException.class, () -> Engine.resolve(bundles.get("billing"), java.util.Map.of("Api-Version", java.util.List.of("2026-02-01")), "Api-Version", null, null));
        assertEquals("AV-E002", unknown.code());
        assertThrows(ApiversaException.class, () -> bundles.get("missing"));
        assertThrows(ApiversaException.class, () -> Bundles.refuseSharedPins(2, new MemoryPinStore()));
    }

    private static void write(Path dir, String change) throws Exception {
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Files.writeString(dir.resolve("2026-03-01.change.yaml"), change.stripIndent());
    }
}
