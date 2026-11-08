package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClientToolsTest {
    @Test
    void snippetsMatchTheNodeBytes(@TempDir Path root) throws Exception {
        Path[] files = Snippets.write(root, "2026-01-15", "Api-Version");
        assertEquals("curl -H \"Api-Version: 2026-01-15\" https://api.example.test/hotels\n", Files.readString(files[0]));
        assertEquals("await fetch(\"https://api.example.test/hotels\", { headers: { \"Api-Version\": \"2026-01-15\" } });\n", Files.readString(files[1]));
        assertEquals("java.net.http.HttpRequest.newBuilder(java.net.URI.create(\"https://api.example.test/hotels\")).header(\"Api-Version\", \"2026-01-15\").GET().build();\n", Files.readString(files[2]));
        assertTrue(files[0].endsWith(Path.of("snippets", "2026-01-15", "curl.txt")));
        assertEquals("curl -H \"X-Version: 2026-03-01\" https://api.example.test/hotels\n", Snippets.curl("2026-03-01", "X-Version"));
    }

    @Test
    void generateClientRewindsTheAlias(@TempDir Path dir) throws Exception {
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
        GenerateClient.write(dir, "apiversa.client.generated");
        String older = Files.readString(dir.resolve("generated/Hotel_2026_01_15.java"));
        String head = Files.readString(dir.resolve("generated/Hotel_2026_03_01.java"));
        assertTrue(older.contains("record Hotel_2026_01_15(String city)"));
        assertTrue(head.contains("record Hotel_2026_03_01(String locality)"));
    }
}
