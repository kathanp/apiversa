package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClientPythonTest {
    @Test
    void writesTheSameClassBytes(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", "python");
        assertEquals(older(), Files.readString(dir.resolve("generated/Hotel_2026_01_15.py")));
        assertEquals(head(), Files.readString(dir.resolve("generated/Hotel_2026_03_01.py")));
    }

    @Test
    void omittedLanguageStillWritesTheJavaRecord(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", null);
        assertTrue(Files.readString(dir.resolve("generated/Hotel_2026_01_15.java")).contains("record Hotel_2026_01_15(String city, String place, String address, String given, String family, Boolean active, double score)"));
    }

    @Test
    @DisplayName("CLIENT-05 refuses calling pip")
    void client05RefusesCallingPip(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", "python");
        try (var files = Files.list(dir.resolve("generated"))) {
            assertTrue(files.allMatch(path -> path.getFileName().toString().endsWith(".py")));
        }
    }

    private static void writeFixture(Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """.stripIndent());
        Files.writeString(dir.resolve("2026-03-01.reshape.yaml"), """
                version: "2026-03-01"
                id: reshape
                description: "Hotel fields moved."
                changes:
                  - op: field.alias
                    schema: Hotel
                    from: city
                    to: locality
                  - op: field.list
                    schema: Hotel
                    from: place
                    to: cities
                  - op: field.null
                    schema: Hotel
                    path: stars
                  - op: field.join
                    schema: Hotel
                    from: title
                    left: given
                    right: family
                    separator: " "
                """.stripIndent());
        Files.writeString(dir.resolve("head.json"), """
                {"Hotel":[{"name":"locality","type":"string"},{"name":"cities","type":"array"},{"name":"stars","type":"integer"},{"name":"address","type":"Address"},{"name":"title","type":"string"},{"name":"active","type":"boolean"},{"name":"score","type":"number"}],"Address":[{"name":"line","type":"string"}]}
                """.stripIndent().trim());
    }

    private static String older() {
        return """
                class Hotel_2026_01_15:
                    city: str
                    place: str
                    address: Address_2026_01_15
                    given: str
                    family: str
                    active: bool
                    score: float
                """;
    }

    private static String head() {
        return """
                class Hotel_2026_03_01:
                    locality: str
                    cities: list
                    stars: int
                    address: Address_2026_03_01
                    title: str
                    active: bool
                    score: float
                """;
    }
}
