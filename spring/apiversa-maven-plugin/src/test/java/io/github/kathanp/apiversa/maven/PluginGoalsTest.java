package io.github.kathanp.apiversa.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.ApiversaException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugin.logging.SystemStreamLog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PluginGoalsTest {
    @Test
    void checkChangelogAndLock(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Files.writeString(dir.resolve("2026-03-01.add-name.yaml"), """
                version: "2026-03-01"
                id: add-name
                description: Hotel.name was added.
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        CheckMojo check = new CheckMojo();
        set(check, "dir", dir.toFile());
        set(check, "today", "2026-10-30");
        check.setLog(new SystemStreamLog());
        check.execute();
        String notes = PluginGoals.changelog(dir, "2026-10-30");
        assertTrue(notes.contains("## 2026-03-01"));
        assertTrue(notes.contains("add-name: Hotel.name was added."));
        String lock = Files.readString(PluginGoals.lock(dir));
        assertTrue(lock.contains("2026-03-01.add-name.yaml"));
        assertTrue(lock.contains("\"files\""));
        Files.writeString(dir.resolve("versions.yaml"), "head: nope\n");
        assertEquals("Change file failed validation.", assertThrows(MojoFailureException.class, check::execute).getMessage());
    }

    @Test
    void initWritesTheSameFilesAsNode(@TempDir Path dir) throws Exception {
        Path created = PluginGoals.init(dir);
        String versions = Files.readString(created.resolve("versions.yaml"));
        String example = Files.readString(created.resolve("2026-03-01.price-object.yaml"));
        assertTrue(versions.contains("head: \"2026-01-15\""));
        assertTrue(example.startsWith("# Example only."));
        assertEquals("AV-E001", assertThrows(ApiversaException.class, () -> PluginGoals.init(dir)).code());
    }

    @Test
    void matrixListsChangesInChainOrder(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Files.writeString(dir.resolve("2026-03-01.add-name.yaml"), """
                version: "2026-03-01"
                id: add-name
                description: Hotel.name was added.
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        String matrix = PluginGoals.matrix(dir, "2026-10-30");
        assertTrue(matrix.contains("\"head\":\"2026-03-01\""));
        assertTrue(matrix.contains("2026-03-01.add-name"));
        assertTrue(matrix.contains("Hotel.name was added."));
        assertTrue(matrix.contains("\"2026-03-01\":[]") || matrix.contains("\"2026-03-01\": []"));
    }

    private static void set(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
