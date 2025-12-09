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
