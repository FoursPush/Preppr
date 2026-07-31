from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Float, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database.config import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationships
    sessions: Mapped[List["InterviewSession"]] = relationship(
        "InterviewSession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    company_target: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")
    analytics: Mapped[Optional["AnalyticsSummary"]] = relationship(
        "AnalyticsSummary", back_populates="session", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<InterviewSession(id={self.id}, user_id={self.user_id}, "
            f"score={self.overall_score}, company='{self.company_target}')>"
        )


class AnalyticsSummary(Base):
    __tablename__ = "analytics_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    average_wpm: Mapped[float] = mapped_column(Float, nullable=False)
    total_filler_words: Mapped[int] = mapped_column(Integer, nullable=False)
    longest_silence: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="analytics")

    def __repr__(self) -> str:
        return (
            f"<AnalyticsSummary(id={self.id}, session_id={self.session_id}, "
            f"wpm={self.average_wpm}, filler_words={self.total_filler_words})>"
        )
