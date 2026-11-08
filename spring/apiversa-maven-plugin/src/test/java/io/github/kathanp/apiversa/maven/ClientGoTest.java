package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClientGoTest {
    @Test
    void writesTheSameStructBytes(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", "go");
        assertEquals(older(), Files.readString(dir.resolve("generated/Hotel_2026_01_15.go")));
        assertEquals(head(), Files.readString(dir.resolve("generated/Hotel_2026_03_01.go")));
    }

    @Test
    @DisplayName("CLIENT-06 refuses calling the go tool")
    void client06RefusesCallingTheGoTool(@TempDir Path dir) throws Exception {
        writeFixture(dir);
        GenerateClient.write(dir, "apiversa.client.generated", "go");
        try (var files = Files.list(dir.resolve("generated"))) {
            assertTrue(files.allMatch(path -> path.getFileName().toString().endsWith(".go")));
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
        return "package generated\n\ntype Hotel_2026_01_15 struct {\n\tcity string `json:\"city\"`\n\tplace string `json:\"place\"`\n\taddress Address_2026_01_15 `json:\"address\"`\n\tgiven string `json:\"given\"`\n\tfamily string `json:\"family\"`\n\tactive bool `json:\"active\"`\n\tscore float64 `json:\"score\"`\n}\n";
    }

    private static String head() {
        return "package generated\n\ntype Hotel_2026_03_01 struct {\n\tlocality string `json:\"locality\"`\n\tcities []string `json:\"cities\"`\n\tstars int64 `json:\"stars\"`\n\taddress Address_2026_03_01 `json:\"address\"`\n\ttitle string `json:\"title\"`\n\tactive bool `json:\"active\"`\n\tscore float64 `json:\"score\"`\n}\n";
    }
}
