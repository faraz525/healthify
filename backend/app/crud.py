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
