# Middleware Module (`backend/middleware/`)

## 📌 Title & Purpose
The `middleware/` module handles cross-cutting concerns across the Preppr platform. It establishes a domain-specific exception hierarchy, formats custom errors into standardized JSON responses, and logs incoming HTTP request processing latency.

## 📂 File Directory & Responsibilities
* **[__init__.py](file:///c:/Users/Soham/Preppr/backend/middleware/__init__.py)**: Package initializer exposing domain exceptions, exception handlers, and ASGI middleware.
* **[error_handler.py](file:///c:/Users/Soham/Preppr/backend/middleware/error_handler.py)**: Defines domain exception classes (`VoiceGatewayException`, `PipelineException`, `DatabaseException`), the global `preppr_exception_handler`, and the `RequestLoggingMiddleware`.

## 🔄 Data Flow / Architecture
1. **Request Ingress**: Incoming HTTP requests pass through `RequestLoggingMiddleware` in `main.py`, starting a high-precision `time.perf_counter()` timer.
2. **Domain Exception Capture**: Any domain exception (`PrepprException` subclass) raised in routers/services is intercepted by `preppr_exception_handler` and converted to a uniform JSON error structure.
3. **Response Egress**: `RequestLoggingMiddleware` appends the total execution time as an `X-Process-Time` HTTP header (e.g. `X-Process-Time: 5.42ms`).

## 🔑 Key Exports & Classes
* `PrepprException`: Base exception class for all application domain errors.
* `VoiceGatewayException`: Raised on WebRTC / LiveKit connection issues (HTTP 502).
* `PipelineException`: Raised on resume extraction or RAG pipeline errors (HTTP 422).
* `DatabaseException`: Raised on database query or commit failures (HTTP 500).
* `preppr_exception_handler`: Global exception handler returning structured JSON errors.
* `RequestLoggingMiddleware`: ASGI middleware logging request timing and attaching `X-Process-Time` headers.
