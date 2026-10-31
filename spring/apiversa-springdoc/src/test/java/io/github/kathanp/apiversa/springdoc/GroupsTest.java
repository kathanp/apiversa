package io.github.kathanp.apiversa.springdoc;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.github.kathanp.apiversa.spring.ApiversaSchemas;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;

@SpringBootTest(classes = GroupsTest.App.class)
class GroupsTest {
    @jakarta.annotation.Resource
    private ApplicationContext context;

    @Test
    void oneGroupPerVersion() {
        Set<String> groups = context.getBeansOfType(GroupedOpenApi.class).values().stream().map(GroupedOpenApi::getGroup).collect(Collectors.toSet());
        assertEquals(Set.of("2026-03-01", "2026-01-15"), groups);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class App {
        @Bean
        ApiversaSchemas schemas() {
            return new ApiversaSchemas().schema("Hotel", "id", "name");
        }
    }
}
