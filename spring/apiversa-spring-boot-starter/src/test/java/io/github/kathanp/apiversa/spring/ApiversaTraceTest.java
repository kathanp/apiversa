package io.github.kathanp.apiversa.spring;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ApiversaTraceTest {
    @Test
    void traceIsOnOutsideProductionUnlessDisabled() {
        ApiversaProperties open = new ApiversaProperties();
        open.resolveTrace(new MockEnvironment());
        assertTrue(open.isTrace());

        ApiversaProperties production = new ApiversaProperties();
        production.resolveTrace(new MockEnvironment().withProperty("ignored", "1"));
        MockEnvironment prod = new MockEnvironment();
        prod.setActiveProfiles("production");
        production.resolveTrace(prod);
        assertFalse(production.isTrace());

        ApiversaProperties forced = new ApiversaProperties();
        forced.setTrace(true);
        forced.resolveTrace(prod);
        assertTrue(forced.isTrace());

        ApiversaProperties muted = new ApiversaProperties();
        muted.setTrace(false);
        muted.resolveTrace(new MockEnvironment());
        assertFalse(muted.isTrace());
    }
}
