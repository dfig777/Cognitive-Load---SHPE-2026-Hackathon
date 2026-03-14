"""
Azure Monitor / Application Insights integration for NeuroFocus.

Call configure_monitoring() BEFORE FastAPI() is instantiated so the
azure-monitor-opentelemetry SDK can auto-instrument all HTTP requests,
outbound calls (Azure OpenAI, Cosmos DB, etc.), and exceptions.

Graceful degradation: if APP_INSIGHTS_CONNECTION_STRING is not set,
monitoring is disabled with a warning. All structured logger.*(extra={})
calls still emit to stdout — only the Azure pipeline is skipped.

Custom events are tracked via track_event() using OpenTelemetry spans.
These show up in Application Insights as customEvents with dimension
properties, making them queryable in Log Analytics / KQL.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Flag set once configure_monitoring() succeeds so track_event() can
# skip the OpenTelemetry span setup when monitoring is disabled.
_MONITORING_ENABLED = False


def configure_monitoring(connection_string: str | None) -> None:
    """
    Bootstrap Azure Monitor OpenTelemetry distro.

    Must be called before FastAPI() is created. After this call:
    - All HTTP requests are auto-instrumented (request duration, status codes)
    - All outbound HTTPX/requests calls are traced (OpenAI, Cosmos, etc.)
    - Unhandled exceptions are captured automatically
    - logger.*() calls flow into Application Insights as traces

    Safe to call with connection_string=None — logs a warning and returns.
    Idempotent — subsequent calls are no-ops to prevent double-instrumentation.
    """
    global _MONITORING_ENABLED

    if _MONITORING_ENABLED:
        return  # already configured — prevent double-instrumentation

    if not connection_string:
        logger.warning(
            "monitoring.configure",
            extra={
                "event": "monitoring_disabled",
                "reason": "APP_INSIGHTS_CONNECTION_STRING not set — telemetry will not be sent",
            },
        )
        return

    try:
        from azure.monitor.opentelemetry import configure_azure_monitor

        configure_azure_monitor(connection_string=connection_string)
        _MONITORING_ENABLED = True
        logger.info(
            "monitoring.configure",
            extra={"event": "monitoring_enabled"},
        )
    except Exception as exc:
        logger.warning(
            "monitoring.configure",
            extra={"event": "monitoring_failed", "error": str(exc)},
        )


def track_event(name: str, properties: dict[str, Any] | None = None) -> None:
    """
    Emit a named custom event to Application Insights.

    Uses an OpenTelemetry span so the event appears as a customEvent in
    the Application Insights portal with full property dimensions for KQL
    queries. No-ops silently if monitoring is not configured.

    Args:
        name:       Short event name, e.g. "task_decomposed", "document_uploaded"
        properties: Key/value pairs that appear as custom dimensions.
                    Values are coerced to strings for App Insights compatibility.
    """
    if not _MONITORING_ENABLED:
        return

    try:
        from opentelemetry import trace

        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span(name) as span:
            if properties:
                for key, value in properties.items():
                    # OTel attribute values must be primitives
                    span.set_attribute(key, str(value))
    except Exception:
        # Never let telemetry failures surface to the user
        pass
