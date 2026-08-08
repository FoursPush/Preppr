from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Float, Integer, ForeignKey, DateTime, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database.config import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    sessions: Mapped[List["InterviewSession"]] = relationship(
        "InterviewSession", back_populates="user", cascade="all, delete-orphan"
    )
    resumes: Mapped[List["Resume"]] = relationship(
        "Resume", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="resumes")
    profile: Mapped[Optional["CandidateProfile"]] = relationship(
        "CandidateProfile", back_populates="resume", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Resume(id={self.id}, user_id={self.user_id}, file_name='{self.file_name}')>"


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resume_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("resumes.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    skills: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    education: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    experience: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    projects: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)

    # Relationships
    resume: Mapped["Resume"] = relationship("Resume", back_populates="profile")

    def __repr__(self) -> str:
        return f"<CandidateProfile(id={self.id}, resume_id={self.resume_id})>"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    values: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    interview_style: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    roles: Mapped[List["Role"]] = relationship("Role", back_populates="company", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Company(id={self.id}, name='{self.name}')>"


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_name: Mapped[str] = mapped_column(String(100), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium", nullable=False)
    requirements: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="roles")
    sessions: Mapped[List["InterviewSession"]] = relationship("InterviewSession", back_populates="role")

    def __repr__(self) -> str:
        return f"<Role(id={self.id}, role_name='{self.role_name}', company_id={self.company_id})>"


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'resume', 'company', 'role'
    source_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(JSON, nullable=True)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<KnowledgeChunk(id={self.id}, source_type='{self.source_type}', source_id='{self.source_id}')>"


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    role_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True
    )
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium", nullable=False)
    duration: Mapped[int] = mapped_column(Integer, default=15, nullable=False)  # minutes
    status: Mapped[str] = mapped_column(String(50), default="created", nullable=False)  # 'created', 'in_progress', 'completed'
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    company_target: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")
    role: Mapped[Optional["Role"]] = relationship("Role", back_populates="sessions")
    questions: Mapped[List["InterviewQuestion"]] = relationship(
        "InterviewQuestion", back_populates="session", cascade="all, delete-orphan"
    )
    evaluation: Mapped[Optional["Evaluation"]] = relationship(
        "Evaluation", back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    report: Mapped[Optional["Report"]] = relationship(
        "Report", back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    analytics: Mapped[Optional["AnalyticsSummary"]] = relationship(
        "AnalyticsSummary", back_populates="session", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<InterviewSession(id={self.id}, user_id={self.user_id}, "
            f"score={self.overall_score}, status='{self.status}')>"
        )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="questions")
    answers: Mapped[List["InterviewAnswer"]] = relationship(
        "InterviewAnswer", back_populates="question", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<InterviewQuestion(id={self.id}, session_id={self.session_id}, order={self.question_order})>"


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transcript: Mapped[str] = mapped_column(Text, nullable=False)
    duration: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # seconds

    # Relationships
    question: Mapped["InterviewQuestion"] = relationship("InterviewQuestion", back_populates="answers")
    audio_metrics: Mapped[Optional["AudioMetric"]] = relationship(
        "AudioMetric", back_populates="answer", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<InterviewAnswer(id={self.id}, question_id={self.question_id}, duration={self.duration})>"


class AudioMetric(Base):
    __tablename__ = "audio_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    answer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_answers.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wpm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    filler_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    filler_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    longest_pause: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    average_pause: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    answer: Mapped["InterviewAnswer"] = relationship("InterviewAnswer", back_populates="audio_metrics")

    def __repr__(self) -> str:
        return f"<AudioMetric(id={self.id}, answer_id={self.answer_id}, wpm={self.wpm})>"


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    scores: Mapped[Dict[str, float]] = mapped_column(JSON, nullable=False)
    feedback_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="evaluation")

    def __repr__(self) -> str:
        return f"<Evaluation(id={self.id}, session_id={self.session_id})>"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    session: Mapped["InterviewSession"] = relationship("InterviewSession", back_populates="report")

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, session_id={self.session_id}, path='{self.file_path}')>"


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
