package io.github.kathanp.examples.nativeimage;

import io.github.kathanp.apiversa.spring.ApiversaSchemas;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

/** Example process used by the native-image profile. */
@SpringBootApplication
public class NativeApp {
    public static void main(String[] args) {
        SpringApplication.run(NativeApp.class, args);
    }

    @Bean
    ApiversaSchemas apiversaSchemas() {
        return new ApiversaSchemas().schema("Hotel", "id", "name");
    }
}
