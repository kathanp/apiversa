package io.github.kathanp.apiversa.springdoc;

import io.github.kathanp.apiversa.Engine;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;

/** One springdoc group per version date. */
@AutoConfiguration
@ConditionalOnClass(GroupedOpenApi.class)
@ConditionalOnBean(Engine.Bundle.class)
public class ApiversaSpringdocConfiguration {
    public ApiversaSpringdocConfiguration(Engine.Bundle bundle, ConfigurableBeanFactory factory) {
        for (String date : bundle.dates()) {
            String name = "apiversaOpenApi-" + date;
            if (factory.containsSingleton(name)) continue;
            factory.registerSingleton(name, GroupedOpenApi.builder()
                    .group(date)
                    .pathsToMatch("/**")
                    .addOpenApiCustomizer(openApi -> {
                        if (openApi.getInfo() == null) openApi.setInfo(new Info());
                        openApi.getInfo().setVersion(date);
                    })
                    .build());
        }
    }
}
