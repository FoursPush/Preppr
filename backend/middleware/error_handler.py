import time
import logging
from typing import Callable
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("preppr-middleware")


# =========================================================================
# Custom Exception Hierarchy
# =========================================================================

class PrepprException(Exception):
    """Base exception class for all core Preppr domain errors."""

    def __init__(
        self,
        message: str,
        error_code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail: str = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.detail = detail or message


class VoiceGatewayException(PrepprException):
    """Raised when errors occur during WebRTC or LiveKit voice streaming operations."""

    def __init__(self, message: str, detail: str = None):
        super().__init__(
            message=message,
            error_code="VOICE_GATEWAY_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )


class PipelineException(PrepprException):
    """Raised when errors occur during resume parsing, STT, or LLM processing pipelines."""

    def __init__(self, message: str, detail: str = None):
        super().__init__(
            message=message,
            error_code="PIPELINE_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


class DatabaseException(PrepprException):
    """Raised when errors occur during database queries or persistence operations."""

    def __init__(self, message: str, detail: str = None):
        super().__init__(
            message=message,
            error_code="DATABASE_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )


# =========================================================================
# Global Exception Handler
# =========================================================================

async def preppr_exception_handler(request: Request, exc: PrepprException) -> JSONResponse:
    """
    Global FastAPI exception handler converting PrepprException instances 
    into a standardized JSON error response.
    """
    logger.error(f"[{exc.error_code}] Path: {request.url.path} - Message: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error_code": exc.error_code,
            "message": exc.message,
            "detail": exc.detail,
        },
    )


# =========================================================================
# Custom ASGI Request & Latency Middleware
# =========================================================================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    ASGI middleware measuring request processing latency, catching unexpected system errors,
    and attaching the X-Process-Time duration header to all HTTP responses.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            process_time_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"[UNHANDLED_SYSTEM_ERROR] {request.method} {request.url.path} failed after {process_time_ms:.2f}ms: {exc}",
                exc_info=True,
            )
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "error_code": "SYSTEM_CRITICAL_ERROR",
                    "message": "An unexpected system error occurred while processing your request.",
                    "detail": str(exc),
                },
            )

        process_time_ms = (time.perf_counter() - start_time) * 1000
        response.headers["X-Process-Time"] = f"{process_time_ms:.2f}ms"
        logger.info(f"{request.method} {request.url.path} -> {response.status_code} [{process_time_ms:.2f}ms]")

        return response
