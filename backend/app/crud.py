from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date, timedelta
from . import models, schemas


def get_daily_entry(db: Session, entry_date: date) -> models.DailyEntry | None:
    return db.query(models.DailyEntry).filter(models.DailyEntry.date == entry_date).first()


def get_daily_entry_by_id(db: Session, entry_id: int) -> models.DailyEntry | None:
    return db.query(models.DailyEntry).filter(models.DailyEntry.id == entry_id).first()


def get_daily_entries(
    db: Session,
    skip: int = 0,
    limit: int = 30,
    start_date: date | None = None,
    end_date: date | None = None
) -> list[models.DailyEntry]:
    query = db.query(models.DailyEntry)

    if start_date:
        query = query.filter(models.DailyEntry.date >= start_date)
    if end_date:
        query = query.filter(models.DailyEntry.date <= end_date)

    return query.order_by(desc(models.DailyEntry.date)).offset(skip).limit(limit).all()


def create_daily_entry(db: Session, entry: schemas.DailyEntryCreate) -> models.DailyEntry:
    db_entry = models.DailyEntry(
        date=entry.date,
        stress_level=entry.stress_level,
        worked_out=entry.worked_out,
        workout_notes=entry.workout_notes,
        notes=entry.notes,
    )
    db.add(db_entry)
    db.flush()

    for issue in entry.health_issues:
        db_issue = models.HealthIssue(
            daily_entry_id=db_entry.id,
            issue_type=issue.issue_type,
            severity=issue.severity,
            notes=issue.notes,
            time_of_day=issue.time_of_day,
        )
        db.add(db_issue)

    db.commit()
    db.refresh(db_entry)
    return db_entry


def update_daily_entry(
    db: Session,
    entry_date: date,
    entry_update: schemas.DailyEntryUpdate
) -> models.DailyEntry | None:
    db_entry = get_daily_entry(db, entry_date)
    if not db_entry:
        return None

    update_data = entry_update.model_dump(exclude_unset=True, exclude={"health_issues"})
    for field, value in update_data.items():
        setattr(db_entry, field, value)

    if entry_update.health_issues is not None:
        # Clear existing issues and add new ones
        db.query(models.HealthIssue).filter(
            models.HealthIssue.daily_entry_id == db_entry.id
        ).delete()

        for issue in entry_update.health_issues:
            db_issue = models.HealthIssue(
                daily_entry_id=db_entry.id,
                issue_type=issue.issue_type,
                severity=issue.severity,
                notes=issue.notes,
                time_of_day=issue.time_of_day,
            )
            db.add(db_issue)

    db.commit()
    db.refresh(db_entry)
    return db_entry


def delete_daily_entry(db: Session, entry_date: date) -> bool:
    db_entry = get_daily_entry(db, entry_date)
    if not db_entry:
        return False

    db.delete(db_entry)
    db.commit()
    return True


def get_issue_types(db: Session, active_only: bool = True) -> list[models.IssueType]:
    query = db.query(models.IssueType)
    if active_only:
        query = query.filter(models.IssueType.is_active == True)
    return query.order_by(models.IssueType.sort_order).all()


def create_issue_type(db: Session, issue_type: schemas.IssueTypeCreate) -> models.IssueType:
    db_issue_type = models.IssueType(**issue_type.model_dump())
    db.add(db_issue_type)
    db.commit()
    db.refresh(db_issue_type)
    return db_issue_type


def get_stats(db: Session, days: int = 30) -> dict:
    start_date = date.today() - timedelta(days=days)

    entries = db.query(models.DailyEntry).filter(
        models.DailyEntry.date >= start_date
    ).all()

    total_entries = len(entries)
    workout_days = sum(1 for e in entries if e.worked_out)

    stress_levels = [e.stress_level for e in entries if e.stress_level is not None]
    avg_stress = sum(stress_levels) / len(stress_levels) if stress_levels else None

    # Get common issues
    issue_counts = db.query(
        models.HealthIssue.issue_type,
        func.count(models.HealthIssue.id).label("count")
    ).join(models.DailyEntry).filter(
        models.DailyEntry.date >= start_date
    ).group_by(models.HealthIssue.issue_type).order_by(
        desc("count")
    ).limit(5).all()

    common_issues = [{"type": issue_type, "count": count} for issue_type, count in issue_counts]

    # Calculate streak
    streak = 0
    check_date = date.today()
    while True:
        entry = db.query(models.DailyEntry).filter(
            models.DailyEntry.date == check_date
        ).first()
        if entry:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    return {
        "total_entries": total_entries,
        "workout_days": workout_days,
        "avg_stress": round(avg_stress, 1) if avg_stress else None,
        "common_issues": common_issues,
        "streak_days": streak,
    }


def seed_default_issue_types(db: Session):
    """Seed default issue types if none exist"""
    existing = db.query(models.IssueType).first()
    if existing:
        return

    default_types = [
        {"name": "heart_palpitations", "display_name": "Heart Palpitations", "icon": "heart", "sort_order": 1},
        {"name": "headache", "display_name": "Headache", "icon": "brain", "sort_order": 2},
        {"name": "fatigue", "display_name": "Fatigue", "icon": "battery-low", "sort_order": 3},
        {"name": "anxiety", "display_name": "Anxiety", "icon": "alert-circle", "sort_order": 4},
        {"name": "digestive", "display_name": "Digestive Issues", "icon": "stomach", "sort_order": 5},
        {"name": "sleep_issues", "display_name": "Sleep Issues", "icon": "moon", "sort_order": 6},
        {"name": "muscle_pain", "display_name": "Muscle Pain", "icon": "activity", "sort_order": 7},
        {"name": "dizziness", "display_name": "Dizziness", "icon": "compass", "sort_order": 8},
        {"name": "other", "display_name": "Other", "icon": "plus-circle", "sort_order": 99},
    ]

    for issue_type in default_types:
        db.add(models.IssueType(**issue_type))

    db.commit()


# Workout Routine CRUD Operations

def get_workout_routines(db: Session, active_only: bool = True) -> list[models.WorkoutRoutine]:
    query = db.query(models.WorkoutRoutine)
    if active_only:
        query = query.filter(models.WorkoutRoutine.is_active == True)
    return query.all()


def get_workout_routine(db: Session, routine_id: int) -> models.WorkoutRoutine | None:
    return db.query(models.WorkoutRoutine).filter(models.WorkoutRoutine.id == routine_id).first()


def create_workout_routine(db: Session, routine: schemas.WorkoutRoutineCreate) -> models.WorkoutRoutine:
    db_routine = models.WorkoutRoutine(
        name=routine.name,
        description=routine.description,
    )
    db.add(db_routine)
    db.flush()

    for day_data in routine.days:
        db_day = models.WorkoutDay(
            routine_id=db_routine.id,
            name=day_data.name,
            day_of_week=day_data.day_of_week,
            sort_order=day_data.sort_order,
        )
        db.add(db_day)
        db.flush()

        for exercise_data in day_data.exercises:
            db_exercise = models.Exercise(
                workout_day_id=db_day.id,
                name=exercise_data.name,
                target_sets=exercise_data.target_sets,
                target_reps=exercise_data.target_reps,
                target_weight=exercise_data.target_weight,
                rest_seconds=exercise_data.rest_seconds,
                notes=exercise_data.notes,
                sort_order=exercise_data.sort_order,
            )
            db.add(db_exercise)

    db.commit()
    db.refresh(db_routine)
    return db_routine


def update_workout_routine(
    db: Session,
    routine_id: int,
    routine_update: schemas.WorkoutRoutineUpdate
) -> models.WorkoutRoutine | None:
    db_routine = get_workout_routine(db, routine_id)
    if not db_routine:
        return None

    update_data = routine_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_routine, field, value)

    db.commit()
    db.refresh(db_routine)
    return db_routine


def delete_workout_routine(db: Session, routine_id: int) -> bool:
    db_routine = get_workout_routine(db, routine_id)
    if not db_routine:
        return False

    db.delete(db_routine)
    db.commit()
    return True


# Workout Day CRUD Operations

def get_workout_day(db: Session, day_id: int) -> models.WorkoutDay | None:
    return db.query(models.WorkoutDay).filter(models.WorkoutDay.id == day_id).first()


def create_workout_day(
    db: Session,
    routine_id: int,
    day: schemas.WorkoutDayCreate
) -> models.WorkoutDay | None:
    routine = get_workout_routine(db, routine_id)
    if not routine:
        return None

    db_day = models.WorkoutDay(
        routine_id=routine_id,
        name=day.name,
        day_of_week=day.day_of_week,
        sort_order=day.sort_order,
    )
    db.add(db_day)
    db.flush()

    for exercise_data in day.exercises:
        db_exercise = models.Exercise(
            workout_day_id=db_day.id,
            name=exercise_data.name,
            target_sets=exercise_data.target_sets,
            target_reps=exercise_data.target_reps,
            target_weight=exercise_data.target_weight,
            rest_seconds=exercise_data.rest_seconds,
            notes=exercise_data.notes,
            sort_order=exercise_data.sort_order,
        )
        db.add(db_exercise)

    db.commit()
    db.refresh(db_day)
    return db_day


def update_workout_day(
    db: Session,
    day_id: int,
    day_update: schemas.WorkoutDayUpdate
) -> models.WorkoutDay | None:
    db_day = get_workout_day(db, day_id)
    if not db_day:
        return None

    update_data = day_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_day, field, value)

    db.commit()
    db.refresh(db_day)
    return db_day


def delete_workout_day(db: Session, day_id: int) -> bool:
    db_day = get_workout_day(db, day_id)
    if not db_day:
        return False

    db.delete(db_day)
    db.commit()
    return True


# Exercise CRUD Operations

def get_exercise(db: Session, exercise_id: int) -> models.Exercise | None:
    return db.query(models.Exercise).filter(models.Exercise.id == exercise_id).first()


def create_exercise(
    db: Session,
    day_id: int,
    exercise: schemas.ExerciseCreate
) -> models.Exercise | None:
    day = get_workout_day(db, day_id)
    if not day:
        return None

    db_exercise = models.Exercise(
        workout_day_id=day_id,
        name=exercise.name,
        target_sets=exercise.target_sets,
        target_reps=exercise.target_reps,
        target_weight=exercise.target_weight,
        rest_seconds=exercise.rest_seconds,
        notes=exercise.notes,
        sort_order=exercise.sort_order,
    )
    db.add(db_exercise)
    db.commit()
    db.refresh(db_exercise)
    return db_exercise


def update_exercise(
    db: Session,
    exercise_id: int,
    exercise_update: schemas.ExerciseUpdate
) -> models.Exercise | None:
    db_exercise = get_exercise(db, exercise_id)
    if not db_exercise:
        return None

    update_data = exercise_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_exercise, field, value)

    db.commit()
    db.refresh(db_exercise)
    return db_exercise


def delete_exercise(db: Session, exercise_id: int) -> bool:
    db_exercise = get_exercise(db, exercise_id)
    if not db_exercise:
        return False

    db.delete(db_exercise)
    db.commit()
    return True


def get_todays_workout(db: Session) -> models.WorkoutDay | None:
    """Get the workout day scheduled for today based on day_of_week"""
    today_dow = date.today().weekday()  # Monday=0, Sunday=6

    # Get the active routine
    routine = db.query(models.WorkoutRoutine).filter(
        models.WorkoutRoutine.is_active == True
    ).first()

    if not routine:
        return None

    # Find the workout day for today
    return db.query(models.WorkoutDay).filter(
        models.WorkoutDay.routine_id == routine.id,
        models.WorkoutDay.day_of_week == today_dow
    ).first()
