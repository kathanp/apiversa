package io.github.kathanp.apiversa.spring;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.YamlDocs;
import org.junit.jupiter.api.Test;
import org.springframework.aot.hint.RuntimeHints;

class ApiversaRuntimeHintsTest {
    @Test
    void registersEngineReflectionAndChangeFileResources() {
        RuntimeHints hints = new RuntimeHints();
        new ApiversaRuntimeHints().registerHints(hints, getClass().getClassLoader());
        assertNotNull(hints.reflection().getTypeHint(Engine.class));
        assertNotNull(hints.reflection().getTypeHint(YamlDocs.class));
        assertNotNull(hints.reflection().getTypeHint(ApiversaProperties.class));
        assertTrue(hints.resources().resourcePatternHints().flatMap(group -> group.getIncludes().stream()).anyMatch(include -> include.getPattern().contains("api-versions")));
    }
}
