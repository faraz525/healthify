import uuid
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    """User account for authentication"""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")  # "admin" or "user"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    daily_entries = relationship("DailyEntry", back_populates="user", cascade="all, delete-orphan")
    workout_routines = relationship("WorkoutRoutine", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    """Refresh tokens for session management"""
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")


class DailyEntry(Base):
    """Main daily health entry - one per day per user"""
    __tablename__ = "daily_entries"
    __table_args__ = (UniqueConstraint('user_id', 'date', name='uix_user_date'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    date = Column(Date, index=True, nullable=False)

    # Core metrics
    stress_level = Column(Integer, nullable=True)  # 1-10 scale
    worked_out = Column(Boolean, default=False)
    workout_type = Column(String(50), nullable=True)  # e.g., "chest", "back", "cardio", "yoga"
    workout_notes = Column(Text, nullable=True)

    # General notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="daily_entries")
    health_issues = relationship("HealthIssue", back_populates="daily_entry", cascade="all, delete-orphan")

    # Future extensibility: store arbitrary metrics from devices
    device_metrics = Column(JSON, nullable=True)


class HealthIssue(Base):
    """Health issues/symptoms logged for a day"""
    __tablename__ = "health_issues"

    id = Column(Integer, primary_key=True, index=True)
    daily_entry_id = Column(Integer, ForeignKey("daily_entries.id"), nullable=False)

    issue_type = Column(String(100), nullable=False)  # e.g., "heart_palpitations", "headache"
    severity = Column(Integer, nullable=True)  # 1-10 scale
    notes = Column(Text, nullable=True)
    time_of_day = Column(String(50), nullable=True)  # morning, afternoon, evening, night

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    daily_entry = relationship("DailyEntry", back_populates="health_issues")


class IssueType(Base):
    """Predefined issue types for quick selection"""
    __tablename__ = "issue_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=True)  # For UI display
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class WorkoutRoutine(Base):
    """A workout routine that contains multiple workout days"""
    __tablename__ = "workout_routines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="workout_routines")
    days = relationship("WorkoutDay", back_populates="routine", cascade="all, delete-orphan")


class WorkoutDay(Base):
    """A day within a workout routine (e.g., Push Day, Pull Day)"""
    __tablename__ = "workout_days"

    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("workout_routines.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Push Day", "Leg Day"
    day_of_week = Column(Integer, nullable=True)  # 0=Monday, 6=Sunday, null=flexible
    sort_order = Column(Integer, default=0)

    routine = relationship("WorkoutRoutine", back_populates="days")
    exercises = relationship("Exercise", back_populates="workout_day", cascade="all, delete-orphan")


class Exercise(Base):
    """An exercise within a workout day"""
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    workout_day_id = Column(Integer, ForeignKey("workout_days.id"), nullable=False)
    name = Column(String(100), nullable=False)
    target_sets = Column(Integer, nullable=True)
    target_reps = Column(String(50), nullable=True)  # e.g., "8-12", "10", "5x5"
    target_weight = Column(String(50), nullable=True)  # e.g., "135 lbs", "60 kg"
    rest_seconds = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    workout_day = relationship("WorkoutDay", back_populates="exercises")
