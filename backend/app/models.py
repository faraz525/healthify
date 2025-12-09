from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class DailyEntry(Base):
    """Main daily health entry - one per day"""
    __tablename__ = "daily_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True, nullable=False)

    # Core metrics
    stress_level = Column(Integer, nullable=True)  # 1-10 scale
    worked_out = Column(Boolean, default=False)
    workout_notes = Column(Text, nullable=True)

    # General notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
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
