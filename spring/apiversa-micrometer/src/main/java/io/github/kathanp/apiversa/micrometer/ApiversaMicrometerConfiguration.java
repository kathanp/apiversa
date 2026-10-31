package io.github.kathanp.apiversa.micrometer;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnClass(MeterRegistry.class)
public class ApiversaMicrometerConfiguration {
    @Bean
    MicrometerUsage micrometerUsage(MeterRegistry registry) {
        return new MicrometerUsage(registry);
    }
}
