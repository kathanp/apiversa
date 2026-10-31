package io.github.kathanp.apiversa.test;

import java.util.Optional;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

/** JUnit 5 extension. Reads {@link ApiversaVersion} from the method, then the class. */
public final class ApiversaExtension implements BeforeEachCallback, AfterEachCallback {
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    public static Optional<String> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    @Override
    public void beforeEach(ExtensionContext context) {
        ApiversaVersion mark = context.getTestMethod().map(method -> method.getAnnotation(ApiversaVersion.class)).orElse(null);
        if (mark == null) mark = context.getTestClass().map(type -> type.getAnnotation(ApiversaVersion.class)).orElse(null);
        if (mark != null) CURRENT.set(mark.value());
    }

    @Override
    public void afterEach(ExtensionContext context) {
        CURRENT.remove();
    }
}
