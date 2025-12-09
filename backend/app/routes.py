from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from . import crud, schemas
from .database import get_db

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
    db: Session = Depends(get_db)
):
    """Get daily entries with optional date filtering"""
    return crud.get_daily_entries(db, skip=skip, limit=limit, start_date=start_date, end_date=end_date)


@router.get("/entries/{entry_date}", response_model=schemas.DailyEntry)
def get_entry(entry_date: date, db: Session = Depends(get_db)):
    """Get a specific daily entry by date"""
    entry = crud.get_daily_entry(db, entry_date)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.post("/entries", response_model=schemas.DailyEntry, status_code=201)
def create_entry(entry: schemas.DailyEntryCreate, db: Session = Depends(get_db)):
    """Create a new daily entry"""
    existing = crud.get_daily_entry(db, entry.date)
    if existing:
        raise HTTPException(status_code=400, detail="Entry for this date already exists")
    return crud.create_daily_entry(db, entry)


@router.put("/entries/{entry_date}", response_model=schemas.DailyEntry)
def update_entry(
    entry_date: date,
    entry_update: schemas.DailyEntryUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing daily entry"""
    entry = crud.update_daily_entry(db, entry_date, entry_update)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.delete("/entries/{entry_date}", status_code=204)
def delete_entry(entry_date: date, db: Session = Depends(get_db)):
    """Delete a daily entry"""
    success = crud.delete_daily_entry(db, entry_date)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return None


@router.get("/issue-types", response_model=list[schemas.IssueType])
def list_issue_types(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get all issue types"""
    return crud.get_issue_types(db, active_only=active_only)


@router.post("/issue-types", response_model=schemas.IssueType, status_code=201)
def create_issue_type(
    issue_type: schemas.IssueTypeCreate,
    db: Session = Depends(get_db)
):
    """Create a new issue type"""
    return crud.create_issue_type(db, issue_type)


@router.get("/stats", response_model=schemas.StatsResponse)
def get_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get health statistics for the past N days"""
    return crud.get_stats(db, days=days)


@router.get("/today", response_model=Optional[schemas.DailyEntry])
def get_today(db: Session = Depends(get_db)):
    """Get today's entry or null if not created"""
    return crud.get_daily_entry(db, date.today())


# Workout Routine Endpoints

@router.get("/workouts", response_model=list[schemas.WorkoutRoutine])
def list_workout_routines(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get all workout routines"""
    return crud.get_workout_routines(db, active_only=active_only)


@router.get("/workouts/today", response_model=Optional[schemas.WorkoutDay])
def get_todays_workout(db: Session = Depends(get_db)):
    """Get today's scheduled workout based on day of week"""
    return crud.get_todays_workout(db)


@router.get("/workouts/{routine_id}", response_model=schemas.WorkoutRoutine)
def get_workout_routine(routine_id: int, db: Session = Depends(get_db)):
    """Get a specific workout routine"""
    routine = crud.get_workout_routine(db, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return routine


@router.post("/workouts", response_model=schemas.WorkoutRoutine, status_code=201)
def create_workout_routine(
    routine: schemas.WorkoutRoutineCreate,
    db: Session = Depends(get_db)
):
    """Create a new workout routine"""
    return crud.create_workout_routine(db, routine)


@router.put("/workouts/{routine_id}", response_model=schemas.WorkoutRoutine)
def update_workout_routine(
    routine_id: int,
    routine_update: schemas.WorkoutRoutineUpdate,
    db: Session = Depends(get_db)
):
    """Update a workout routine"""
    routine = crud.update_workout_routine(db, routine_id, routine_update)
    if not routine:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return routine


@router.delete("/workouts/{routine_id}", status_code=204)
def delete_workout_routine(routine_id: int, db: Session = Depends(get_db)):
    """Delete a workout routine"""
    success = crud.delete_workout_routine(db, routine_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return None


# Workout Day Endpoints

@router.post("/workouts/{routine_id}/days", response_model=schemas.WorkoutDay, status_code=201)
def create_workout_day(
    routine_id: int,
    day: schemas.WorkoutDayCreate,
    db: Session = Depends(get_db)
):
    """Add a day to a workout routine"""
    result = crud.create_workout_day(db, routine_id, day)
    if not result:
        raise HTTPException(status_code=404, detail="Workout routine not found")
    return result


@router.put("/workouts/days/{day_id}", response_model=schemas.WorkoutDay)
def update_workout_day(
    day_id: int,
    day_update: schemas.WorkoutDayUpdate,
    db: Session = Depends(get_db)
):
    """Update a workout day"""
    day = crud.update_workout_day(db, day_id, day_update)
    if not day:
        raise HTTPException(status_code=404, detail="Workout day not found")
    return day


@router.delete("/workouts/days/{day_id}", status_code=204)
def delete_workout_day(day_id: int, db: Session = Depends(get_db)):
    """Delete a workout day"""
    success = crud.delete_workout_day(db, day_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workout day not found")
    return None


# Exercise Endpoints

@router.post("/workouts/days/{day_id}/exercises", response_model=schemas.Exercise, status_code=201)
def create_exercise(
    day_id: int,
    exercise: schemas.ExerciseCreate,
    db: Session = Depends(get_db)
):
    """Add an exercise to a workout day"""
    result = crud.create_exercise(db, day_id, exercise)
    if not result:
        raise HTTPException(status_code=404, detail="Workout day not found")
    return result


@router.put("/workouts/exercises/{exercise_id}", response_model=schemas.Exercise)
def update_exercise(
    exercise_id: int,
    exercise_update: schemas.ExerciseUpdate,
    db: Session = Depends(get_db)
):
    """Update an exercise"""
    exercise = crud.update_exercise(db, exercise_id, exercise_update)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.delete("/workouts/exercises/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Delete an exercise"""
    success = crud.delete_exercise(db, exercise_id)
    if not success:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return None
