import logging
from typing import Optional
from workers.analytics_worker import BackgroundAnalyticsProcessor
from pipelines.resume_pipeline import ResumePipeline
from pipelines.voice_pipeline import VoicePipeline
from services.pdf_service import PDFReportGenerator

logger = logging.getLogger("preppr-container")


class AppContainer:
    """
    Centralized service locator and dependency injection container holding singleton 
    instances of core platform services (BackgroundAnalyticsProcessor, ResumePipeline, VoicePipeline, PDFReportGenerator).
    """

    def __init__(self):
        self._analytics_processor: Optional[BackgroundAnalyticsProcessor] = None
        self._resume_pipeline: Optional[ResumePipeline] = None
        self._voice_pipeline: Optional[VoicePipeline] = None
        self._pdf_generator: Optional[PDFReportGenerator] = None
        self._is_initialized: bool = False

    def initialize(self) -> None:
        """
        Initializes and registers singleton instances during application startup.
        """
        if self._is_initialized:
            logger.warning("AppContainer has already been initialized.")
            return

        logger.info("Initializing AppContainer singleton services...")
        self._analytics_processor = BackgroundAnalyticsProcessor()
        self._resume_pipeline = ResumePipeline()
        self._voice_pipeline = VoicePipeline()
        self._pdf_generator = PDFReportGenerator()
        self._is_initialized = True
        logger.info("AppContainer singleton services successfully initialized.")

    def shutdown(self) -> None:
        """
        Cleans up and releases singleton service references during application shutdown.
        """
        logger.info("Shutting down AppContainer singleton services...")
        self._analytics_processor = None
        self._resume_pipeline = None
        self._voice_pipeline = None
        self._pdf_generator = None
        self._is_initialized = False
        logger.info("AppContainer singleton services successfully shutdown.")

    @property
    def analytics_processor(self) -> BackgroundAnalyticsProcessor:
        """Access singleton BackgroundAnalyticsProcessor instance."""
        if not self._is_initialized or self._analytics_processor is None:
            raise RuntimeError("AppContainer is not initialized. Call container.initialize() during startup.")
        return self._analytics_processor

    @property
    def resume_pipeline(self) -> ResumePipeline:
        """Access singleton ResumePipeline instance."""
        if not self._is_initialized or self._resume_pipeline is None:
            raise RuntimeError("AppContainer is not initialized. Call container.initialize() during startup.")
        return self._resume_pipeline

    @property
    def voice_pipeline(self) -> VoicePipeline:
        """Access singleton VoicePipeline instance."""
        if not self._is_initialized or self._voice_pipeline is None:
            raise RuntimeError("AppContainer is not initialized. Call container.initialize() during startup.")
        return self._voice_pipeline

    @property
    def pdf_generator(self) -> PDFReportGenerator:
        """Access singleton PDFReportGenerator instance."""
        if not self._is_initialized or self._pdf_generator is None:
            raise RuntimeError("AppContainer is not initialized. Call container.initialize() during startup.")
        return self._pdf_generator


# Global AppContainer Singleton Instance
container = AppContainer()


def get_container() -> AppContainer:
    """
    FastAPI dependency injection provider function for routes requiring AppContainer.
    """
    return container
