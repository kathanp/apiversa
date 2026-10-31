package io.github.kathanp.apiversa.webflux;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.Json;
import io.github.kathanp.apiversa.Json.SchemaDef;
import io.github.kathanp.apiversa.YamlDocs;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.web.server.WebExceptionHandler;
import org.springframework.web.server.WebFilter;

/** Same request and response conversion as Spring MVC, on WebFlux. */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
@EnableConfigurationProperties(ApiversaWebFluxProperties.class)
public class ApiversaWebFluxAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    Engine.Bundle apiversaBundle(ApiversaWebFluxProperties properties, Environment environment) throws IOException {
        properties.resolveTrace(environment);
        Path dir = materialize(properties.getDir());
        String today = properties.getToday() == null || properties.getToday().isBlank() ? null : properties.getToday();
        return Engine.load(dir, today, schemas(dir), Map.of(), new Engine.Limits(properties.getMaxBodyBytes(), properties.getMaxArrayItems()), null, properties.getOversize());
    }

    @Bean
    WebFilter apiversaWebFilter(Engine.Bundle bundle, ApiversaWebFluxProperties properties) {
        return new ApiversaWebFilter(bundle, properties);
    }

    @Bean
    WebExceptionHandler apiversaWebExceptionHandler() {
        return new ApiversaWebExceptionHandler();
    }

    private static Map<String, SchemaDef> schemas(Path dir) throws IOException {
        Map<String, SchemaDef> registry = new LinkedHashMap<>();
        try (var stream = Files.list(dir)) {
            for (Path file : stream.filter(path -> {
                String name = path.getFileName().toString();
                return name.endsWith(".yaml") && !"versions.yaml".equals(name);
            }).toList()) {
                Object doc = YamlDocs.parse(Files.readString(file));
                if (!(doc instanceof Map<?, ?> map) || !(map.get("changes") instanceof List<?> ops)) continue;
                for (Object item : ops) {
                    if (item instanceof Map<?, ?> op && op.get("schema") != null) registry.putIfAbsent(String.valueOf(op.get("schema")), new SchemaDef(List.of()));
                }
            }
        }
        return registry;
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
