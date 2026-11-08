package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClientCheckTest {
    @Test
    void matchesAndDoesNotWrite(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", "python");
        GenerateClient.write(dir, "apiversa.client.generated", "go");
        String before = Files.readString(dir.resolve("generated/Hotel_2026_01_15.py"));
        assertTrue(Clients.matches(dir));
        assertEquals(before, Files.readString(dir.resolve("generated/Hotel_2026_01_15.py")));
    }

    @Test
    @DisplayName("SHR-06 refuses writing a file")
    void shr06RefusesWritingAFile(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", "python");
        GenerateClient.write(dir, "apiversa.client.generated", "go");
        Path file = dir.resolve("generated/Hotel_2026_01_15.py");
        Files.writeString(file, "class Hotel_2026_01_15:\n    city: object\n");
        assertFalse(Clients.matches(dir));
        assertEquals("class Hotel_2026_01_15:\n    city: object\n", Files.readString(file));
    }

    private static void writeFixture(Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.alias.yaml"), """
                version: "2026-03-01"
                id: alias-city
                description: "city became locality."
                changes:
                  - op: field.alias
                    schema: Hotel
                    from: city
                    to: locality
                """.stripIndent());
        Files.writeString(dir.resolve("head.json"), "{\"Hotel\":[{\"name\":\"locality\",\"type\":\"string\"}]}");
    }
}
