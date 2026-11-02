package io.github.kathanp.apiversa.spring;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.ReleasedLock;
import io.github.kathanp.apiversa.Json.SchemaDef;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Boot 3 auto-configuration. Framework 7 hosts can call {@link Engine#resolve} from their own resolver. */
@AutoConfiguration
@ImportRuntimeHints(ApiversaRuntimeHints.class)
@ConditionalOnWebApplication
@ConditionalOnClass(DispatcherServlet.class)
@EnableConfigurationProperties(ApiversaProperties.class)
public class ApiversaAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    Engine.Bundle apiversaBundle(ApiversaProperties properties, ObjectProvider<ApiversaSchemas> schemas, ObjectProvider<Engine.Converter> converters, Environment environment) throws IOException {
        properties.resolveTrace(environment);
        Path folder = materialize(properties.getDir());
        if (properties.isProduction()) ReleasedLock.check(folder);
        Map<String, Engine.Converter> found = new LinkedHashMap<>();
        converters.orderedStream().forEach(converter -> {
            VersionChange mark = AnnotationUtils.findAnnotation(converter.getClass(), VersionChange.class);
            if (mark != null) found.put(mark.value(), converter);
        });
        Map<String, SchemaDef> registry = schemas.getIfAvailable(ApiversaSchemas::new).registry();
        String today = properties.getToday() == null || properties.getToday().isBlank() ? null : properties.getToday();
        return Engine.load(folder, today, registry, found, new Engine.Limits(properties.getMaxBodyBytes(), properties.getMaxArrayItems()), null, properties.getOversize());
    }

    @Bean
    ApiversaCounts apiversaCounts() {
        return new ApiversaCounts();
    }

    @Bean
    ApiversaInterceptor apiversaInterceptor(Engine.Bundle bundle, ApiversaProperties properties, ObjectProvider<ApiversaVersionResolver> resolvers, ObjectProvider<ApiversaUsage> usages) {
        return new ApiversaInterceptor(bundle, properties, resolvers.getIfAvailable(), usages);
    }

    @Bean
    FilterRegistrationBean<ApiversaFilter> apiversaFilter(Engine.Bundle bundle, ApiversaProperties properties, ObjectProvider<ApiversaVersionResolver> resolvers, ObjectProvider<ApiversaUsage> usages) {
        FilterRegistrationBean<ApiversaFilter> registration = new FilterRegistrationBean<>(new ApiversaFilter(bundle, properties, resolvers.getIfAvailable(), usages));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return registration;
    }

    @Bean
    ApiversaAdvice apiversaAdvice(Engine.Bundle bundle, ApiversaProperties properties, ObjectMapper mapper) {
        return new ApiversaAdvice(bundle, properties, mapper);
    }

    @Bean
    ApiversaJsonConverter apiversaJsonConverter(ObjectMapper mapper) {
        return new ApiversaJsonConverter(mapper);
    }

    @Bean
    WebMvcConfigurer apiversaWeb(ApiversaInterceptor interceptor, ApiversaJsonConverter converter) {
        return new WebMvcConfigurer() {
            @Override
            public void addInterceptors(InterceptorRegistry registry) {
                registry.addInterceptor(interceptor);
            }

            @Override
            public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
                converters.add(0, converter);
            }
        };
    }

    private static Path materialize(String dir) throws IOException {
        if (dir != null && dir.startsWith("classpath:")) {
            String location = dir.substring("classpath:".length()).replaceAll("^/+", "");
            Path temp = Files.createTempDirectory("apiversa-");
            temp.toFile().deleteOnExit();
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath*:" + location + "/*");
            for (Resource resource : resources) {
                String name = resource.getFilename();
                if (name == null || !name.endsWith(".yaml")) continue;
                Path target = temp.resolve(name);
                try (InputStream input = resource.getInputStream()) {
                    Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
                }
                target.toFile().deleteOnExit();
            }
            return temp;
        }
        String path = dir == null ? "" : dir.startsWith("file:") ? dir.substring("file:".length()) : dir;
        return Path.of(path);
    }
}
