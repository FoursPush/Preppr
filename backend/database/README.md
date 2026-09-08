# Database Module (`backend/database/`)

## 📌 Title & Purpose
The `database/` module manages async relational data persistence and schema mappings for Preppr using SQLAlchemy 2.0 and `asyncpg`. It stores user accounts, candidate interview sessions, and detailed acoustic telemetry metrics.

## 📂 File Directory & Responsibilities
* **[__init__.py](file:///c:/Users/Soham/Preppr/backend/database/__init__.py)**: Package initializer exposing engine, session factories, and ORM models.
* **[config.py](file:///c:/Users/Soham/Preppr/backend/database/config.py)**: Configures the async PostgreSQL engine (`create_async_engine`), session factory (`AsyncSessionLocal`), declarative `Base`, and the `get_async_session()` FastAPI dependency.
* **[models.py](file:///c:/Users/Soham/Preppr/backend/database/models.py)**: Defines relational ORM models: `User`, `InterviewSession`, and `AnalyticsSummary`.

## 🔄 Data Flow / Architecture
* **Asynchronous Persistence**: `workers/analytics_worker.py` writes post-interview scores and `AnalyticsSummary` records to PostgreSQL asynchronously.
* **Query & Dashboard**: `routers/dashboard.py` queries `InterviewSession` and `AnalyticsSummary` tables using `get_async_session()` to populate candidate performance dashboards.

## 🔑 Key Exports & Classes
* `Base`: Declarative SQLAlchemy base class.
* `engine`: Async SQLAlchemy database engine.
* `AsyncSessionLocal`: Async session factory.
* `get_async_session()`: FastAPI dependency for database sessions.
* `User`: ORM schema mapping user profile attributes (`id`, `email`, `name`).
* `InterviewSession`: ORM schema tracking interview session metadata (`id`, `user_id`, `overall_score`, `company_target`, `created_at`).
* `AnalyticsSummary`: ORM schema storing acoustic summary telemetry (`id`, `session_id`, `average_wpm`, `total_filler_words`, `longest_silence`).
