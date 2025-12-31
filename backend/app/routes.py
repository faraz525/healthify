from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from . import crud, schemas, models
from .database import get_db
from .auth import get_current_user

router = APIRouter(prefix="/api")


@router.get("/health")
def health_check():
    """Health check endpoint for Docker"""
    return {"status": "healthy"}


@router.get("/entries", response_model=list[schemas.DailyEntry])
def list_entries(
    skip: int = 0,
    limit: int = Query(30, le=100),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get daily entries with optional date filtering"""
    return crud.get_daily_entries(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/entries/{entry_date}", response_model=schemas.DailyEntry)
def get_entry(
    entry_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific daily entry by date"""
    entry = crud.get_daily_entry(db, current_user.id, entry_date)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.post("/entries", response_model=schemas.DailyEntry, status_code=201)
def create_entry(
    entry: schemas.DailyEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new daily entry"""
    existing = crud.get_daily_entry(db, current_user.id, entry.date)
    if existing:
        raise HTTPException(status_code=400, detail="Entry for this date already exists")
    return crud.create_daily_entry(db, current_user.id, entry)


@router.put("/entries/{entry_date}", response_model=schemas.DailyEntry)
def update_entry(
    entry_date: date,
    entry_update: schemas.DailyEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update an existing daily entry"""
    entry = crud.update_daily_entry(db, current_user.id, entry_date, entry_update)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.delete("/entries/{entry_date}", status_code=204)
def delete_entry(
    entry_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a daily entry"""
    success = crud.delete_daily_entry(db, current_user.id, entry_date)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return None


@router.get("/issue-types", response_model=list[schemas.IssueType])
def list_issue_types(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get all issue types (public endpoint)"""
    return crud.get_issue_types(db, active_only=active_only)


@router.post("/issue-types", response_model=schemas.IssueType, status_code=201)
def create_issue_type(
    issue_type: schemas.IssueTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new issue type (requires auth)"""
    return crud.create_issue_type(db, issue_type)


@router.get("/stats", response_model=schemas.StatsResponse)
def get_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get health statistics for the past N days"""
    return crud.get_stats(db, current_user.id, days=days)


@router.get("/today", response_model=Optional[schemas.DailyEntry])
def get_today(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get today's entry or null if not created"""
    return crud.get_daily_entry(db, current_user.id, date.today())


# Workout Routine Endpoints

@router.get("/workouts", response_model=list[schemas.WorkoutRoutine])
def list_workout_routines(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all workout routines"""
    return crud.get_workout_routines(db, current_user.id, active_only=active_only)


@router.get("/workouts/today", response_model=Optional[schemas.WorkoutDay])
def get_todays_workout(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get today's scheduled workout based on day of week"""
    return crud.get_todays_workout(db, current_user.id)


@router.get("/workouts/{routine_id}", response_model=schemas.WorkoutRoutine)
def get_workout_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific workout routine"""
    routine = crud.get_workout_routine(db, current_user.id, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return routine


@router.post("/workouts", response_model=schemas.WorkoutRoutine, status_code=201)
def create_workout_routine(
    routine: schemas.WorkoutRoutineCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new workout routine"""
    return crud.create_workout_routine(db, current_user.id, routine)


@router.put("/workouts/{routine_id}", response_model=schemas.WorkoutRoutine)
def update_workout_routine(
    routine_id: int,
    routine_update: schemas.WorkoutRoutineUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a workout routine"""
    routine = crud.update_workout_routine(db, current_user.id, routine_id, routine_update)
    if not routine:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return routine


@router.delete("/workouts/{routine_id}", status_code=204)
def delete_workout_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a workout routine"""
    success = crud.delete_workout_routine(db, current_user.id, routine_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return None


# Workout Day Endpoints

@router.post("/workouts/{routine_id}/days", response_model=schemas.WorkoutDay, status_code=201)
def create_workout_day(
    routine_id: int,
    day: schemas.WorkoutDayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add a day to a workout routine"""
    result = crud.create_workout_day(db, current_user.id, routine_id, day)
    if not result:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return result


@router.put("/workouts/days/{day_id}", response_model=schemas.WorkoutDay)
def update_workout_day(
    day_id: int,
    day_update: schemas.WorkoutDayUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a workout day"""
    day = crud.update_workout_day(db, current_user.id, day_id, day_update)
    if not day:
        raise HTTPException(status_code=404, detail="Workout day not found")
    return day


@router.delete("/workouts/days/{day_id}", status_code=204)
def delete_workout_day(
    day_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a workout day"""
    success = crud.delete_workout_day(db, current_user.id, day_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout day not found")
    return None


# Exercise Endpoints

@router.post("/workouts/days/{day_id}/exercises", response_model=schemas.Exercise, status_code=201)
def create_exercise(
    day_id: int,
    exercise: schemas.ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add an exercise to a workout day"""
    result = crud.create_exercise(db, current_user.id, day_id, exercise)
    if not result:
        raise HTTPException(status_code=404, detail="Workout day not found")
    return result


@router.put("/workouts/exercises/{exercise_id}", response_model=schemas.Exercise)
def update_exercise(
    exercise_id: int,
    exercise_update: schemas.ExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update an exercise"""
    exercise = crud.update_exercise(db, current_user.id, exercise_id, exercise_update)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.delete("/workouts/exercises/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete an exercise"""
    success = crud.delete_exercise(db, current_user.id, exercise_id)
    if not success:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return None


# Workout Session Endpoints

@router.get("/sessions", response_model=list[schemas.WorkoutSessionSummary])
def list_workout_sessions(
    skip: int = 0,
    limit: int = Query(30, le=100),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get workout sessions with optional date filtering"""
    sessions = crud.get_workout_sessions(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date
    )
    # Transform to summary format
    result = []
    for s in sessions:
        result.append(schemas.WorkoutSessionSummary(
            id=s.id,
            workout_day_id=s.workout_day_id,
            date=s.date,
            notes=s.notes,
            started_at=s.started_at,
            completed_at=s.completed_at,
            created_at=s.created_at,
            workout_day_name=s.workout_day.name if s.workout_day else None,
            exercises_completed=len(s.exercise_logs)
        ))
    return result


@router.get("/sessions/active", response_model=Optional[schemas.WorkoutSession])
def get_active_session(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get the active (not completed) session for today, if any"""
    session = crud.get_active_session(db, current_user.id, date.today())
    if not session:
        return None
    return schemas.WorkoutSession(
        id=session.id,
        workout_day_id=session.workout_day_id,
        date=session.date,
        notes=session.notes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        exercise_logs=session.exercise_logs,
        workout_day_name=session.workout_day.name if session.workout_day else None
    )


@router.get("/sessions/{session_id}", response_model=schemas.WorkoutSession)
def get_workout_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific workout session with exercise logs"""
    session = crud.get_workout_session(db, current_user.id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Workout session not found")
    return schemas.WorkoutSession(
        id=session.id,
        workout_day_id=session.workout_day_id,
        date=session.date,
        notes=session.notes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        exercise_logs=session.exercise_logs,
        workout_day_name=session.workout_day.name if session.workout_day else None
    )


@router.post("/sessions", response_model=schemas.WorkoutSession, status_code=201)
def create_workout_session(
    session: schemas.WorkoutSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Start a new workout session"""
    db_session = crud.create_workout_session(db, current_user.id, session)
    return schemas.WorkoutSession(
        id=db_session.id,
        workout_day_id=db_session.workout_day_id,
        date=db_session.date,
        notes=db_session.notes,
        started_at=db_session.started_at,
        completed_at=db_session.completed_at,
        created_at=db_session.created_at,
        exercise_logs=[],
        workout_day_name=db_session.workout_day.name if db_session.workout_day else None
    )


@router.put("/sessions/{session_id}", response_model=schemas.WorkoutSession)
def update_workout_session(
    session_id: int,
    session_update: schemas.WorkoutSessionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a workout session"""
    session = crud.update_workout_session(db, current_user.id, session_id, session_update)
    if not session:
        raise HTTPException(status_code=404, detail="Workout session not found")
    return schemas.WorkoutSession(
        id=session.id,
        workout_day_id=session.workout_day_id,
        date=session.date,
        notes=session.notes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        exercise_logs=session.exercise_logs,
        workout_day_name=session.workout_day.name if session.workout_day else None
    )


@router.post("/sessions/{session_id}/complete", response_model=schemas.WorkoutSession)
def complete_workout_session(
    session_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mark a workout session as complete"""
    session = crud.complete_workout_session(db, current_user.id, session_id, notes)
    if not session:
        raise HTTPException(status_code=404, detail="Workout session not found")
    return schemas.WorkoutSession(
        id=session.id,
        workout_day_id=session.workout_day_id,
        date=session.date,
        notes=session.notes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        exercise_logs=session.exercise_logs,
        workout_day_name=session.workout_day.name if session.workout_day else None
    )


@router.delete("/sessions/{session_id}", status_code=204)
def delete_workout_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a workout session"""
    success = crud.delete_workout_session(db, current_user.id, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout session not found")
    return None


# Exercise Log Endpoints

@router.post("/sessions/{session_id}/log", response_model=schemas.ExerciseLog, status_code=201)
def log_exercise(
    session_id: int,
    log: schemas.ExerciseLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Log a completed exercise in a session"""
    result = crud.log_exercise(db, current_user.id, session_id, log)
    if not result:
        raise HTTPException(status_code=404, detail="Workout session not found")
    return result


@router.put("/sessions/{session_id}/log/{log_id}", response_model=schemas.ExerciseLog)
def update_exercise_log(
    session_id: int,
    log_id: int,
    log_update: schemas.ExerciseLogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update an exercise log"""
    result = crud.update_exercise_log(db, current_user.id, session_id, log_id, log_update)
    if not result:
        raise HTTPException(status_code=404, detail="Exercise log not found")
    return result


@router.delete("/sessions/{session_id}/log/{log_id}", status_code=204)
def delete_exercise_log(
    session_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete an exercise log"""
    success = crud.delete_exercise_log(db, current_user.id, session_id, log_id)
    if not success:
        raise HTTPException(status_code=404, detail="Exercise log not found")
    return None


# Personal Record Endpoints

@router.get("/prs", response_model=list[schemas.PersonalRecord])
def list_personal_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all personal records"""
    return crud.get_personal_records(db, current_user.id)


@router.post("/prs", response_model=schemas.PersonalRecord, status_code=201)
def create_personal_record(
    pr: schemas.PersonalRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Manually create a personal record"""
    return crud.create_personal_record(db, current_user.id, pr)


@router.delete("/prs/{pr_id}", status_code=204)
def delete_personal_record(
    pr_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a personal record"""
    success = crud.delete_personal_record(db, current_user.id, pr_id)
    if not success:
        raise HTTPException(status_code=404, detail="Personal record not found")
    return None


# Exercise Progression Endpoints

@router.get("/exercises/logged", response_model=list[str])
def list_logged_exercises(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get list of exercise names that have been logged"""
    return crud.get_logged_exercises(db, current_user.id)


@router.get("/exercises/{exercise_name}/history", response_model=schemas.ExerciseProgression)
def get_exercise_history(
    exercise_name: str,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get exercise progression history for charts"""
    history = crud.get_exercise_history(db, current_user.id, exercise_name, limit)
    pr = crud.get_exercise_pr(db, current_user.id, exercise_name)

    return schemas.ExerciseProgression(
        exercise_name=exercise_name,
        history=[schemas.ExerciseProgressionPoint(**h) for h in history],
        current_pr=pr
    )
