package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugin.logging.SystemStreamLog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ReplayMojoTest {
    @Test
    void failsWhenARecordedResponseChanges(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Files.writeString(dir.resolve("2026-03-01.rename.yaml"), """
                version: "2026-03-01"
                id: rename
                description: Hotel.city renamed to locality.
                changes:
                  - op: field.rename
                    schema: Hotel
                    from: city
                    to: locality
                """);
        Path samples = dir.resolve("samples.jsonl");
        Files.writeString(samples, "{\"version\":\"2026-01-15\",\"schema\":\"Hotel\",\"request\":{\"city\":\"Paris\"},\"response\":{\"city\":\"Paris\"}}\n");
        ReplayMojo replay = new ReplayMojo();
        set(replay, "dir", dir.toFile());
        set(replay, "samples", samples.toFile());
        set(replay, "today", "2026-10-31");
        replay.setLog(new SystemStreamLog());
        replay.execute();
        Files.writeString(samples, "{\"version\":\"2026-01-15\",\"schema\":\"Hotel\",\"request\":{\"city\":\"Paris\"},\"response\":{\"locality\":\"Paris\"}}\n");
        MojoFailureException failed = assertThrows(MojoFailureException.class, replay::execute);
        assertTrue(failed.getMessage().contains("response differs"));
    }

    private static void set(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
