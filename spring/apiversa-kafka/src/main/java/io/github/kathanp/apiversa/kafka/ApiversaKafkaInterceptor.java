package io.github.kathanp.apiversa.kafka;

import io.github.kathanp.apiversa.Engine;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.listener.RecordInterceptor;

/** Spring Kafka consumer interceptor. The record value is upgraded before the listener sees it. */
public final class ApiversaKafkaInterceptor implements RecordInterceptor<String, String> {
    private final Engine.Bundle bundle;
    private final String schema;
    private final String headerName;

    public ApiversaKafkaInterceptor(Engine.Bundle bundle, String schema) {
        this(bundle, schema, "Api-Version");
    }

    public ApiversaKafkaInterceptor(Engine.Bundle bundle, String schema, String headerName) {
        this.bundle = bundle;
        this.schema = schema;
        this.headerName = headerName;
    }

    @Override
    public ConsumerRecord<String, String> intercept(ConsumerRecord<String, String> record, Consumer<String, String> consumer) {
        return ApiversaMessages.upgrade(bundle, record, schema, headerName);
    }
}
