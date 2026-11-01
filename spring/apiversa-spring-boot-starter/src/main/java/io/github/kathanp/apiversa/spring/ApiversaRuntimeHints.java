package io.github.kathanp.apiversa.spring;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.FormBodies;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.SchemaCheck;
import io.github.kathanp.apiversa.YamlDocs;
import org.snakeyaml.engine.v2.api.Load;
import org.snakeyaml.engine.v2.schema.JsonSchema;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;

/** Reflection and classpath change files for a Spring Boot native image. */
public final class ApiversaRuntimeHints implements RuntimeHintsRegistrar {
    private static final MemberCategory[] MEMBERS = {
        MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
        MemberCategory.INVOKE_PUBLIC_METHODS,
        MemberCategory.DECLARED_FIELDS
    };

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        for (Class<?> type : new Class<?>[] {
            Engine.class,
            YamlDocs.class,
            Json.class,
            SchemaCheck.class,
            FormBodies.class,
            ApiversaAutoConfiguration.class,
            ApiversaProperties.class,
            VersionChange.class,
            Load.class,
            JsonSchema.class
        }) hints.reflection().registerType(type, MEMBERS);
        hints.resources().registerPattern("api-versions/*.yaml");
        hints.resources().registerPattern("api-versions/*.yml");
    }
}
