# Core Module (`backend/core/`)

## 📌 Title & Purpose
The `core/` module acts as the centralized dependency injection and service locator framework for Preppr. It manages singletons for heavy platform services (such as background workers, ETL pipelines, and document generators), ensuring single-instance initialization during application startup and graceful teardown during shutdown.

## 📂 File Directory & Responsibilities
* **[__init__.py](file:///c:/Users/Soham/Preppr/backend/core/__init__.py)**: Package initializer exposing the global `AppContainer` instance and dependency provider functions.
* **[container.py](file:///c:/Users/Soham/Preppr/backend/core/container.py)**: Defines the `AppContainer` service locator class holding singleton references to platform services.

## 🔄 Data Flow / Architecture
1. **Startup**: FastAPI's `lifespan` context manager in `main.py` calls `container.initialize()` on application launch.
2. **Injection**: Routers and services access singletons via `container.analytics_processor`, `container.resume_pipeline`, and `container.pdf_generator` or via the `get_container()` dependency provider.
3. **Shutdown**: FastAPI lifespan triggers `container.shutdown()` to release singleton references cleanly upon server termination.

## 🔑 Key Exports & Classes
* `AppContainer`: Centralized service locator class.
* `container`: Global singleton instance of `AppContainer`.
* `get_container()`: FastAPI dependency provider function.
