use opentelemetry::{KeyValue, global, trace::TracerProvider};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    Resource,
    logs::SdkLoggerProvider,
    metrics::{PeriodicReader, SdkMeterProvider},
    propagation::TraceContextPropagator,
    trace::{self as sdktrace},
};
use tracing_subscriber::{EnvFilter, Registry, layer::SubscriberExt, util::SubscriberInitExt};

fn otlp_base_endpoint(endpoint: &str) -> String {
    let mut e = endpoint.trim_end_matches('/').to_string();

    for suffix in ["/v1/traces", "/v1/metrics", "/v1/logs"] {
        if e.ends_with(suffix) {
            e.truncate(e.len().saturating_sub(suffix.len()));
            e = e.trim_end_matches('/').to_string();
            break;
        }
    }

    e
}

fn otlp_endpoint(endpoint: &str, path: &str) -> String {
    format!("{}/{}", otlp_base_endpoint(endpoint), path.trim_start_matches('/'))
}

pub(crate) fn init_telemetry(
    service_name: &'static str,
    endpoint: &str,
) -> Result<sdktrace::SdkTracerProvider, Box<dyn std::error::Error>> {
    // 1. Set Propagator
    global::set_text_map_propagator(TraceContextPropagator::new());

    let resource = Resource::builder()
        .with_attributes(vec![KeyValue::new("service.name", service_name)])
        .build();
    // 2. Traces
    let tracer_provider = init_tracer(endpoint, resource.clone())?;
    let tracer = tracer_provider.tracer("rtes");

    // 3. Metrics
    let meter_provider = init_metrics(endpoint, resource.clone())?;
    global::set_meter_provider(meter_provider);

    // 4. Logs
    let logger_provider = init_logs(endpoint, resource)?;
    let log_layer =
        opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge::new(&logger_provider);

    // 5. Subscriber Registry
    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let fmt_layer = tracing_subscriber::fmt::layer();

    Registry::default()
        .with(env_filter)
        .with(telemetry_layer)
        .with(log_layer)
        .with(fmt_layer)
        .init();

    Ok(tracer_provider)
}

fn init_tracer(
    endpoint: &str,
    resource: Resource,
) -> Result<sdktrace::SdkTracerProvider, Box<dyn std::error::Error>> {
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(otlp_endpoint(endpoint, "/v1/traces"))
        .build()?;

    let provider = sdktrace::SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(resource)
        .build();

    global::set_tracer_provider(provider.clone());
    Ok(provider)
}

fn init_metrics(
    endpoint: &str,
    resource: Resource,
) -> Result<SdkMeterProvider, Box<dyn std::error::Error>> {
    let exporter = opentelemetry_otlp::MetricExporter::builder()
        .with_http()
        .with_endpoint(otlp_endpoint(endpoint, "/v1/metrics"))
        .build()?;

    let reader = PeriodicReader::builder(exporter).build();

    let provider = SdkMeterProvider::builder()
        .with_resource(resource)
        .with_reader(reader)
        .build();

    Ok(provider)
}

fn init_logs(
    endpoint: &str,
    resource: Resource,
) -> Result<SdkLoggerProvider, Box<dyn std::error::Error>> {
    let exporter = opentelemetry_otlp::LogExporter::builder()
        .with_http()
        .with_endpoint(otlp_endpoint(endpoint, "/v1/logs"))
        .build()?;

    let provider = SdkLoggerProvider::builder()
        .with_resource(resource)
        .with_batch_exporter(exporter)
        .build();

    Ok(provider)
}
