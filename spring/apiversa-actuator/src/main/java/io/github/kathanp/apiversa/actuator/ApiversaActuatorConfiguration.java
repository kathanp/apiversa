package io.github.kathanp.apiversa.actuator;

import io.github.kathanp.apiversa.spring.ApiversaCounts;
import org.springframework.boot.actuate.autoconfigure.endpoint.condition.ConditionalOnAvailableEndpoint;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import io.github.kathanp.apiversa.Engine;

@AutoConfiguration
@ConditionalOnClass(name = "org.springframework.boot.actuate.endpoint.annotation.Endpoint")
public class ApiversaActuatorConfiguration {
    @Bean
    @ConditionalOnAvailableEndpoint
    ApiversaEndpoint apiversaEndpoint(Engine.Bundle bundle, ApiversaCounts counts) {
        return new ApiversaEndpoint(bundle, counts);
    }
}
