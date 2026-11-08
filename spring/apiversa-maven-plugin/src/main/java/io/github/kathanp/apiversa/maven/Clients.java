package io.github.kathanp.apiversa.maven;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Compare generated Python and Go files to the bytes already on disk. Never writes. */
public final class Clients {
    private Clients() {}

    public static boolean matches(Path dir) throws IOException {
        for (String lang : java.util.List.of("python", "go")) {
            for (GenerateClient.Source source : GenerateClient.sources(dir, "apiversa.client.generated", lang)) {
                Path file = dir.resolve("generated").resolve(source.name());
                if (!Files.isRegularFile(file) || !Files.readString(file).equals(source.text())) return false;
            }
        }
        return true;
    }
}
