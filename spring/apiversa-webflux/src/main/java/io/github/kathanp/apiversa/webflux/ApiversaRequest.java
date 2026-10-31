package io.github.kathanp.apiversa.webflux;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Names the request schema. The value is a registry name, for example {@code "Hotel"}. */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ApiversaRequest {
    String value();
}
