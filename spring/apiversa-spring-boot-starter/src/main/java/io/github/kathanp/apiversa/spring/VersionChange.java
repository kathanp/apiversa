package io.github.kathanp.apiversa.spring;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@link io.github.kathanp.apiversa.Engine.Converter}.
 * The value is the change file's {@code converter} name, for example {@code "2026-03-01.price-object"}.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface VersionChange {
    String value();
}
