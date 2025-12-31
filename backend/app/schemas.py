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
    workout_type: Optional[str] = None  # e.g., "chest", "back", "cardio", "yoga"
    workout_notes: Optional[str] = None
    notes: Optional[str] = None


class DailyEntryCreate(DailyEntryBase):
    health_issues: list[HealthIssueCreate] = []


class DailyEntryUpdate(BaseModel):
    stress_level: Optional[int] = Field(None, ge=1, le=10)
    worked_out: Optional[bool] = None
    workout_type: Optional[str] = None
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


# Workout Routine Schemas
class ExerciseBase(BaseModel):
    name: str
    target_sets: Optional[int] = None
    target_reps: Optional[str] = None
    target_weight: Optional[str] = None
    rest_seconds: Optional[int] = None
    notes: Optional[str] = None
    sort_order: int = 0


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    target_sets: Optional[int] = None
    target_reps: Optional[str] = None
    target_weight: Optional[str] = None
    rest_seconds: Optional[int] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class Exercise(ExerciseBase):
    id: int
    workout_day_id: int

    class Config:
        from_attributes = True


class WorkoutDayBase(BaseModel):
    name: str
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    sort_order: int = 0


class WorkoutDayCreate(WorkoutDayBase):
    exercises: list[ExerciseCreate] = []


class WorkoutDayUpdate(BaseModel):
    name: Optional[str] = None
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    sort_order: Optional[int] = None


class WorkoutDay(WorkoutDayBase):
    id: int
    routine_id: int
    exercises: list[Exercise] = []

    class Config:
        from_attributes = True


class WorkoutRoutineBase(BaseModel):
    name: str
    description: Optional[str] = None


class WorkoutRoutineCreate(WorkoutRoutineBase):
    days: list[WorkoutDayCreate] = []


class WorkoutRoutineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WorkoutRoutine(WorkoutRoutineBase):
    id: int
    is_active: bool
    days: list[WorkoutDay] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Auth Schemas
class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str


# Workout Session Schemas
class ExerciseLogBase(BaseModel):
    exercise_id: Optional[int] = None  # Links to planned exercise
    exercise_name: str
    sets_completed: int
    reps_achieved: Optional[str] = None  # e.g., "10,10,8" or "10"
    weight_used: Optional[str] = None  # e.g., "135 lbs"
    notes: Optional[str] = None


class ExerciseLogCreate(ExerciseLogBase):
    pass


class ExerciseLogUpdate(BaseModel):
    sets_completed: Optional[int] = None
    reps_achieved: Optional[str] = None
    weight_used: Optional[str] = None
    notes: Optional[str] = None


class ExerciseLog(ExerciseLogBase):
    id: int
    session_id: int
    is_pr: bool = False
    completed_at: datetime

    class Config:
        from_attributes = True


class WorkoutSessionBase(BaseModel):
    workout_day_id: Optional[int] = None
    date: date
    notes: Optional[str] = None


class WorkoutSessionCreate(WorkoutSessionBase):
    pass


class WorkoutSessionUpdate(BaseModel):
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None


class WorkoutSessionSummary(WorkoutSessionBase):
    """Summary without exercise logs for list views"""
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    workout_day_name: Optional[str] = None
    exercises_completed: int = 0

    class Config:
        from_attributes = True


class WorkoutSession(WorkoutSessionBase):
    """Full session with exercise logs"""
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    exercise_logs: list[ExerciseLog] = []
    workout_day_name: Optional[str] = None

    class Config:
        from_attributes = True


# Personal Record Schemas
class PersonalRecordBase(BaseModel):
    exercise_name: str
    record_type: str  # "weight", "reps", "volume"
    value: str
    achieved_at: date
    notes: Optional[str] = None


class PersonalRecordCreate(PersonalRecordBase):
    exercise_log_id: Optional[int] = None


class PersonalRecord(PersonalRecordBase):
    id: int
    exercise_log_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Progression Data for Charts
class ExerciseProgressionPoint(BaseModel):
    date: date
    weight: Optional[str] = None
    sets: int
    reps: Optional[str] = None
    is_pr: bool = False


class ExerciseProgression(BaseModel):
    exercise_name: str
    history: list[ExerciseProgressionPoint]
    current_pr: Optional[PersonalRecord] = None
