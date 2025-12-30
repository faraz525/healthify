from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from .database import get_db
from .config import get_settings
from . import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/signup", response_model=schemas.TokenResponse, status_code=201)
def signup(user_data: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    # Check if user exists
    existing = db.query(models.User).filter(models.User.email == user_data.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "user_exists", "message": "Email already registered"}
        )

    # Determine role - first user with admin email becomes admin
    role = "user"
    if user_data.email.lower() == settings.admin_email.lower():
        existing_admin = db.query(models.User).filter(models.User.role == "admin").first()
        if not existing_admin:
            role = "admin"

    # Create user
    user = models.User(
        email=user_data.email.lower(),
        password_hash=auth.hash_password(user_data.password),
        role=role
    )
    db.add(user)
    db.flush()

    # Generate tokens
    access_token = auth.create_access_token(user.id, user.email, user.role)
    refresh_token = auth.generate_refresh_token()

    # Store refresh token hash
    db_token = models.RefreshToken(
        user_id=user.id,
        token_hash=auth.hash_refresh_token(refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(db_token)
    db.commit()

    # Set refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60
    )

    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=schemas.UserResponse.model_validate(user)
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(credentials: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email.lower()).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_credentials", "message": "Invalid email or password"}
        )

    # Generate tokens
    access_token = auth.create_access_token(user.id, user.email, user.role)
    refresh_token = auth.generate_refresh_token()

    # Store refresh token hash
    db_token = models.RefreshToken(
        user_id=user.id,
        token_hash=auth.hash_refresh_token(refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(db_token)
    db.commit()

    # Set refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60
    )

    return schemas.TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=schemas.UserResponse.model_validate(user)
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_tokens(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    body: Optional[schemas.RefreshRequest] = None,
    db: Session = Depends(get_db)
):
    # Accept token from cookie or body
    token = refresh_token or (body.refresh_token if body else None)
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"code": "token_required", "message": "Refresh token required"}
        )

    token_hash = auth.hash_refresh_token(token)
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token_hash == token_hash,
        models.RefreshToken.revoked_at.is_(None),
        models.RefreshToken.expires_at > datetime.utcnow()
    ).first()

    if not db_token:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Invalid or expired refresh token"}
        )

    user = db_token.user

    # Revoke old token
    db_token.revoked_at = datetime.utcnow()

    # Generate new tokens
    new_access_token = auth.create_access_token(user.id, user.email, user.role)
    new_refresh_token = auth.generate_refresh_token()

    # Store new refresh token
    new_db_token = models.RefreshToken(
        user_id=user.id,
        token_hash=auth.hash_refresh_token(new_refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(new_db_token)
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60
    )

    return schemas.TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=schemas.UserResponse.model_validate(user)
    )


@router.post("/logout", response_model=schemas.MessageResponse)
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    if refresh_token:
        token_hash = auth.hash_refresh_token(refresh_token)
        db_token = db.query(models.RefreshToken).filter(
            models.RefreshToken.token_hash == token_hash
        ).first()
        if db_token:
            db_token.revoked_at = datetime.utcnow()
            db.commit()

    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
