from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


class HealthIssueBase(BaseModel):
    issue_type: str
    severity: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None
    time_of_day: Optional[str] = None


class HealthIssueCreate(HealthIssueBase):
    pass


class HealthIssue(HealthIssueBase):
    id: int
    daily_entry_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DailyEntryBase(BaseModel):
    date: date
    stress_level: Optional[int] = Field(None, ge=1, le=10)
    worked_out: bool = False
    workout_notes: Optional[str] = None
    notes: Optional[str] = None


class DailyEntryCreate(DailyEntryBase):
    health_issues: list[HealthIssueCreate] = []


class DailyEntryUpdate(BaseModel):
    stress_level: Optional[int] = Field(None, ge=1, le=10)
    worked_out: Optional[bool] = None
    workout_notes: Optional[str] = None
    notes: Optional[str] = None
    health_issues: Optional[list[HealthIssueCreate]] = None


class DailyEntry(DailyEntryBase):
    id: int
    health_issues: list[HealthIssue] = []
    device_metrics: Optional[dict] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IssueTypeBase(BaseModel):
    name: str
    display_name: str
    icon: Optional[str] = None


class IssueTypeCreate(IssueTypeBase):
    pass


class IssueType(IssueTypeBase):
    id: int
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_entries: int
    workout_days: int
    avg_stress: Optional[float]
    common_issues: list[dict]
    streak_days: int
