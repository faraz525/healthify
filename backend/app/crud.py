from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date, timedelta
from . import models, schemas


def get_daily_entry(db: Session, user_id: str, entry_date: date) -> models.DailyEntry | None:
    return db.query(models.DailyEntry).filter(
        models.DailyEntry.user_id == user_id,
        models.DailyEntry.date == entry_date
    ).first()


def get_daily_entry_by_id(db: Session, user_id: str, entry_id: int) -> models.DailyEntry | None:
    return db.query(models.DailyEntry).filter(
        models.DailyEntry.user_id == user_id,
        models.DailyEntry.id == entry_id
    ).first()


def get_daily_entries(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 30,
    start_date: date | None = None,
    end_date: date | None = None
) -> list[models.DailyEntry]:
    query = db.query(models.DailyEntry).filter(models.DailyEntry.user_id == user_id)

    if start_date:
        query = query.filter(models.DailyEntry.date >= start_date)
    if end_date:
        query = query.filter(models.DailyEntry.date <= end_date)

    return query.order_by(desc(models.DailyEntry.date)).offset(skip).limit(limit).all()


def create_daily_entry(db: Session, user_id: str, entry: schemas.DailyEntryCreate) -> models.DailyEntry:
    db_entry = models.DailyEntry(
        user_id=user_id,
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
    user_id: str,
    entry_date: date,
    entry_update: schemas.DailyEntryUpdate
) -> models.DailyEntry | None:
    db_entry = get_daily_entry(db, user_id, entry_date)
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


def delete_daily_entry(db: Session, user_id: str, entry_date: date) -> bool:
    db_entry = get_daily_entry(db, user_id, entry_date)
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


def get_stats(db: Session, user_id: str, days: int = 30) -> dict:
    start_date = date.today() - timedelta(days=days)

    entries = db.query(models.DailyEntry).filter(
        models.DailyEntry.user_id == user_id,
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
        models.DailyEntry.user_id == user_id,
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
            models.DailyEntry.user_id == user_id,
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

def get_workout_routines(db: Session, user_id: str, active_only: bool = True) -> list[models.WorkoutRoutine]:
    query = db.query(models.WorkoutRoutine).filter(models.WorkoutRoutine.user_id == user_id)
    if active_only:
        query = query.filter(models.WorkoutRoutine.is_active == True)
    return query.all()


def get_workout_routine(db: Session, user_id: str, routine_id: int) -> models.WorkoutRoutine | None:
    return db.query(models.WorkoutRoutine).filter(
        models.WorkoutRoutine.user_id == user_id,
        models.WorkoutRoutine.id == routine_id
    ).first()


def create_workout_routine(db: Session, user_id: str, routine: schemas.WorkoutRoutineCreate) -> models.WorkoutRoutine:
    db_routine = models.WorkoutRoutine(
        user_id=user_id,
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
    user_id: str,
    routine_id: int,
    routine_update: schemas.WorkoutRoutineUpdate
) -> models.WorkoutRoutine | None:
    db_routine = get_workout_routine(db, user_id, routine_id)
    if not db_routine:
        return None

    update_data = routine_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_routine, field, value)

    db.commit()
    db.refresh(db_routine)
    return db_routine


def delete_workout_routine(db: Session, user_id: str, routine_id: int) -> bool:
    db_routine = get_workout_routine(db, user_id, routine_id)
    if not db_routine:
        return False

    db.delete(db_routine)
    db.commit()
    return True


# Workout Day CRUD Operations

def get_workout_day(db: Session, user_id: str, day_id: int) -> models.WorkoutDay | None:
    """Get a workout day, verifying it belongs to the user"""
    return db.query(models.WorkoutDay).join(models.WorkoutRoutine).filter(
        models.WorkoutRoutine.user_id == user_id,
        models.WorkoutDay.id == day_id
    ).first()


def create_workout_day(
    db: Session,
    user_id: str,
    routine_id: int,
    day: schemas.WorkoutDayCreate
) -> models.WorkoutDay | None:
    routine = get_workout_routine(db, user_id, routine_id)
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
    user_id: str,
    day_id: int,
    day_update: schemas.WorkoutDayUpdate
) -> models.WorkoutDay | None:
    db_day = get_workout_day(db, user_id, day_id)
    if not db_day:
        return None

    update_data = day_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_day, field, value)

    db.commit()
    db.refresh(db_day)
    return db_day


def delete_workout_day(db: Session, user_id: str, day_id: int) -> bool:
    db_day = get_workout_day(db, user_id, day_id)
    if not db_day:
        return False

    db.delete(db_day)
    db.commit()
    return True


# Exercise CRUD Operations

def get_exercise(db: Session, user_id: str, exercise_id: int) -> models.Exercise | None:
    """Get an exercise, verifying it belongs to the user"""
    return db.query(models.Exercise).join(models.WorkoutDay).join(models.WorkoutRoutine).filter(
        models.WorkoutRoutine.user_id == user_id,
        models.Exercise.id == exercise_id
    ).first()


def create_exercise(
    db: Session,
    user_id: str,
    day_id: int,
    exercise: schemas.ExerciseCreate
) -> models.Exercise | None:
    day = get_workout_day(db, user_id, day_id)
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
    user_id: str,
    exercise_id: int,
    exercise_update: schemas.ExerciseUpdate
) -> models.Exercise | None:
    db_exercise = get_exercise(db, user_id, exercise_id)
    if not db_exercise:
        return None

    update_data = exercise_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_exercise, field, value)

    db.commit()
    db.refresh(db_exercise)
    return db_exercise


def delete_exercise(db: Session, user_id: str, exercise_id: int) -> bool:
    db_exercise = get_exercise(db, user_id, exercise_id)
    if not db_exercise:
        return False

    db.delete(db_exercise)
    db.commit()
    return True


def get_todays_workout(db: Session, user_id: str) -> models.WorkoutDay | None:
    """Get the workout day scheduled for today based on day_of_week"""
    today_dow = date.today().weekday()  # Monday=0, Sunday=6

    # Get the active routine for this user
    routine = db.query(models.WorkoutRoutine).filter(
        models.WorkoutRoutine.user_id == user_id,
        models.WorkoutRoutine.is_active == True
    ).first()

    if not routine:
        return None

    # Find the workout day for today
    return db.query(models.WorkoutDay).filter(
        models.WorkoutDay.routine_id == routine.id,
        models.WorkoutDay.day_of_week == today_dow
    ).first()


# Workout Session CRUD Operations

def get_workout_sessions(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 30,
    start_date: date | None = None,
    end_date: date | None = None
) -> list[models.WorkoutSession]:
    """Get workout sessions for a user with optional date filtering"""
    query = db.query(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == user_id
    )

    if start_date:
        query = query.filter(models.WorkoutSession.date >= start_date)
    if end_date:
        query = query.filter(models.WorkoutSession.date <= end_date)

    return query.order_by(desc(models.WorkoutSession.date)).offset(skip).limit(limit).all()


def get_workout_session(db: Session, user_id: str, session_id: int) -> models.WorkoutSession | None:
    """Get a specific workout session"""
    return db.query(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == user_id,
        models.WorkoutSession.id == session_id
    ).first()


def get_active_session(db: Session, user_id: str, session_date: date) -> models.WorkoutSession | None:
    """Get an active (not completed) session for today"""
    return db.query(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == user_id,
        models.WorkoutSession.date == session_date,
        models.WorkoutSession.completed_at == None
    ).first()


def create_workout_session(
    db: Session,
    user_id: str,
    session: schemas.WorkoutSessionCreate
) -> models.WorkoutSession:
    """Create a new workout session"""
    from datetime import datetime
    db_session = models.WorkoutSession(
        user_id=user_id,
        workout_day_id=session.workout_day_id,
        date=session.date,
        started_at=datetime.now(),
        notes=session.notes,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def update_workout_session(
    db: Session,
    user_id: str,
    session_id: int,
    session_update: schemas.WorkoutSessionUpdate
) -> models.WorkoutSession | None:
    """Update a workout session"""
    db_session = get_workout_session(db, user_id, session_id)
    if not db_session:
        return None

    update_data = session_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_session, field, value)

    db.commit()
    db.refresh(db_session)
    return db_session


def complete_workout_session(
    db: Session,
    user_id: str,
    session_id: int,
    notes: str | None = None
) -> models.WorkoutSession | None:
    """Mark a workout session as complete"""
    from datetime import datetime
    db_session = get_workout_session(db, user_id, session_id)
    if not db_session:
        return None

    db_session.completed_at = datetime.now()
    if notes:
        db_session.notes = notes

    db.commit()
    db.refresh(db_session)
    return db_session


def delete_workout_session(db: Session, user_id: str, session_id: int) -> bool:
    """Delete a workout session"""
    db_session = get_workout_session(db, user_id, session_id)
    if not db_session:
        return False

    db.delete(db_session)
    db.commit()
    return True


# Exercise Log CRUD Operations

def log_exercise(
    db: Session,
    user_id: str,
    session_id: int,
    log: schemas.ExerciseLogCreate
) -> models.ExerciseLog | None:
    """Log a completed exercise in a session"""
    db_session = get_workout_session(db, user_id, session_id)
    if not db_session:
        return None

    # Check for PR
    is_pr = check_is_pr(db, user_id, log.exercise_name, log.weight_used)

    db_log = models.ExerciseLog(
        session_id=session_id,
        exercise_id=log.exercise_id,
        exercise_name=log.exercise_name,
        sets_completed=log.sets_completed,
        reps_achieved=log.reps_achieved,
        weight_used=log.weight_used,
        is_pr=is_pr,
        notes=log.notes,
    )
    db.add(db_log)
    db.flush()

    # Record PR if detected
    if is_pr and log.weight_used:
        record_pr(
            db, user_id,
            exercise_name=log.exercise_name,
            record_type="weight",
            value=log.weight_used,
            achieved_at=db_session.date,
            exercise_log_id=db_log.id
        )

    db.commit()
    db.refresh(db_log)
    return db_log


def update_exercise_log(
    db: Session,
    user_id: str,
    session_id: int,
    log_id: int,
    log_update: schemas.ExerciseLogUpdate
) -> models.ExerciseLog | None:
    """Update an exercise log"""
    db_session = get_workout_session(db, user_id, session_id)
    if not db_session:
        return None

    db_log = db.query(models.ExerciseLog).filter(
        models.ExerciseLog.session_id == session_id,
        models.ExerciseLog.id == log_id
    ).first()

    if not db_log:
        return None

    update_data = log_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_log, field, value)

    db.commit()
    db.refresh(db_log)
    return db_log


def delete_exercise_log(db: Session, user_id: str, session_id: int, log_id: int) -> bool:
    """Delete an exercise log"""
    db_session = get_workout_session(db, user_id, session_id)
    if not db_session:
        return False

    db_log = db.query(models.ExerciseLog).filter(
        models.ExerciseLog.session_id == session_id,
        models.ExerciseLog.id == log_id
    ).first()

    if not db_log:
        return False

    db.delete(db_log)
    db.commit()
    return True


# Personal Record CRUD Operations

def parse_weight(weight_str: str | None) -> float | None:
    """Extract numeric weight from a string like '135 lbs' or '60 kg'"""
    if not weight_str:
        return None
    import re
    match = re.match(r'(\d+(?:\.\d+)?)', weight_str.strip())
    return float(match.group(1)) if match else None


def check_is_pr(db: Session, user_id: str, exercise_name: str, weight_used: str | None) -> bool:
    """Check if this weight is a new PR for the exercise"""
    if not weight_used:
        return False

    new_weight = parse_weight(weight_used)
    if not new_weight:
        return False

    # Get current weight PR for this exercise
    current_pr = db.query(models.PersonalRecord).filter(
        models.PersonalRecord.user_id == user_id,
        models.PersonalRecord.exercise_name == exercise_name,
        models.PersonalRecord.record_type == "weight"
    ).first()

    if not current_pr:
        return True  # First time logging this exercise = PR

    current_weight = parse_weight(current_pr.value)
    return new_weight > current_weight if current_weight else True


def record_pr(
    db: Session,
    user_id: str,
    exercise_name: str,
    record_type: str,
    value: str,
    achieved_at: date,
    exercise_log_id: int | None = None,
    notes: str | None = None
) -> models.PersonalRecord:
    """Record a new personal record, replacing the old one if exists"""
    # Delete existing PR of same type for this exercise
    db.query(models.PersonalRecord).filter(
        models.PersonalRecord.user_id == user_id,
        models.PersonalRecord.exercise_name == exercise_name,
        models.PersonalRecord.record_type == record_type
    ).delete()

    db_pr = models.PersonalRecord(
        user_id=user_id,
        exercise_name=exercise_name,
        record_type=record_type,
        value=value,
        achieved_at=achieved_at,
        exercise_log_id=exercise_log_id,
        notes=notes,
    )
    db.add(db_pr)
    db.flush()
    return db_pr


def get_personal_records(db: Session, user_id: str) -> list[models.PersonalRecord]:
    """Get all personal records for a user"""
    return db.query(models.PersonalRecord).filter(
        models.PersonalRecord.user_id == user_id
    ).order_by(models.PersonalRecord.exercise_name).all()


def get_exercise_pr(db: Session, user_id: str, exercise_name: str) -> models.PersonalRecord | None:
    """Get the weight PR for a specific exercise"""
    return db.query(models.PersonalRecord).filter(
        models.PersonalRecord.user_id == user_id,
        models.PersonalRecord.exercise_name == exercise_name,
        models.PersonalRecord.record_type == "weight"
    ).first()


def create_personal_record(
    db: Session,
    user_id: str,
    pr: schemas.PersonalRecordCreate
) -> models.PersonalRecord:
    """Manually create a personal record"""
    db_pr = record_pr(
        db, user_id,
        exercise_name=pr.exercise_name,
        record_type=pr.record_type,
        value=pr.value,
        achieved_at=pr.achieved_at,
        exercise_log_id=pr.exercise_log_id,
        notes=pr.notes
    )
    db.commit()
    db.refresh(db_pr)
    return db_pr


def delete_personal_record(db: Session, user_id: str, pr_id: int) -> bool:
    """Delete a personal record"""
    db_pr = db.query(models.PersonalRecord).filter(
        models.PersonalRecord.user_id == user_id,
        models.PersonalRecord.id == pr_id
    ).first()

    if not db_pr:
        return False

    db.delete(db_pr)
    db.commit()
    return True


# Exercise History / Progression

def get_exercise_history(
    db: Session,
    user_id: str,
    exercise_name: str,
    limit: int = 50
) -> list[dict]:
    """Get exercise history for progression charts"""
    logs = db.query(models.ExerciseLog).join(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == user_id,
        models.ExerciseLog.exercise_name == exercise_name
    ).order_by(desc(models.WorkoutSession.date)).limit(limit).all()

    history = []
    for log in logs:
        history.append({
            "date": log.session.date,
            "weight": log.weight_used,
            "sets": log.sets_completed,
            "reps": log.reps_achieved,
            "is_pr": log.is_pr,
        })

    # Reverse to get chronological order
    return list(reversed(history))


def get_logged_exercises(db: Session, user_id: str) -> list[str]:
    """Get list of exercise names that have been logged"""
    results = db.query(models.ExerciseLog.exercise_name).join(models.WorkoutSession).filter(
        models.WorkoutSession.user_id == user_id
    ).distinct().all()

    return [r[0] for r in results]
