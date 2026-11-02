package io.github.kathanp.apiversa.spring;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

/** CORE-10. A production Boot context reads the lock. */
class LockStartupTest {
    @Test
    void CORE10_productionStartupFailsWhenTheLockChanges(@TempDir Path dir) throws Exception {
        Files.writeString(dir.resolve("versions.yaml"), """
                head: "2026-03-01"
                versions:
                  - date: "2026-03-01"
                  - date: "2026-01-15"
                default: oldest
                """);
        Path change = dir.resolve("2026-03-01.add-name.yaml");
        Files.writeString(change, """
                version: "2026-03-01"
                id: add-name
                description: Hotel.name was added.
                changes:
                  - op: field.add
                    schema: Hotel
                    path: name
                    default: Bay
                """);
        Files.writeString(dir.resolve(".lock.json"), "{\"files\":{\"" + change.getFileName() + "\":\"0000\"}}");
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ApiversaAutoConfiguration.class))
                .withBean(ObjectMapper.class, ObjectMapper::new)
                .withBean(ApiversaSchemas.class, () -> new ApiversaSchemas().schema("Hotel", "id", "name"))
                .withPropertyValues("apiversa.dir=" + dir.toAbsolutePath(), "apiversa.today=2026-11-01", "spring.profiles.active=production")
                .run(context -> {
                    assertTrue(context.getStartupFailure() != null);
                    assertTrue(text(context.getStartupFailure()).contains("AV-E006"));
                });
        Files.writeString(dir.resolve(".lock.json"), "{\"files\":{\"" + change.getFileName() + "\":\"" + sha256(Files.readAllBytes(change)) + "\"}}");
        new WebApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(ApiversaAutoConfiguration.class))
                .withBean(ObjectMapper.class, ObjectMapper::new)
                .withBean(ApiversaSchemas.class, () -> new ApiversaSchemas().schema("Hotel", "id", "name"))
                .withPropertyValues("apiversa.dir=" + dir.toAbsolutePath(), "apiversa.today=2026-11-01", "spring.profiles.active=production")
                .run(context -> assertTrue(context.getStartupFailure() == null, text(context.getStartupFailure())));
    }

    private static String sha256(byte[] bytes) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder out = new StringBuilder(hash.length * 2);
        for (byte value : hash) out.append(String.format("%02x", value));
        return out.toString();
    }

    private static String text(Throwable error) {
        if (error == null) return "";
        StringBuilder out = new StringBuilder();
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current.getMessage() != null) out.append(current.getMessage()).append('\n');
            if (current instanceof io.github.kathanp.apiversa.ApiversaException apiversa) out.append(apiversa.code()).append('\n');
        }
        return out.toString();
    }
}
