import os
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from livekit import api

router = APIRouter(tags=["Authentication & Tokens"])


class LoginRequest(BaseModel):
    email: str = Field(..., example="candidate@example.com", description="Candidate email address")
    name: str = Field(..., example="Soham", description="Candidate display name")


class LoginResponse(BaseModel):
    user_id: str
    email: str
    name: str
    status: str
    token: str


class TokenRequest(BaseModel):
    room_name: str = Field(..., description="The name of the LiveKit room to join", example="interview-room-101")
    participant_name: str = Field(..., description="The display name or ID of the participant", example="Soham")


class TokenResponse(BaseModel):
    token: str = Field(..., description="Signed LiveKit JWT token for client SDK authentication")


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Candidate Login / Authentication",
    description="Authenticates or registers candidate user and issues session token."
)
@router.post("/api/auth/login", include_in_schema=False)
async def login(payload: LoginRequest):
    email = payload.email.strip()
    name = payload.name.strip()

    if not email or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'email' and 'name' are required."
        )

    # In production, create/fetch User in PostgreSQL DB
    user_id = f"user_{abs(hash(email)) % 10000}"
    mock_token = f"preppr_sess_{user_id}_jwt"

    return LoginResponse(
        user_id=user_id,
        email=email,
        name=name,
        status="authenticated",
        token=mock_token
    )


@router.post(
    "/api/tokens/generate",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate LiveKit Connection Token",
    description="Generates a signed LiveKit JWT connection token for joining a room with specific grants."
)
async def generate_token(payload: TokenRequest):
    api_key = os.getenv("LIVEKIT_API_KEY", "devkey")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "secret")

    room_name = payload.room_name.strip()
    participant_name = payload.participant_name.strip()

    if not room_name or not participant_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'room_name' and 'participant_name' must be non-empty strings."
        )

    try:
        token = (
            api.AccessToken(api_key, api_secret)
            .with_identity(participant_name)
            .with_name(participant_name)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                )
            )
        )
        jwt_token = token.to_jwt()
        return TokenResponse(token=jwt_token)
    except Exception as e:
        # Fallback for dev environments without LiveKit keys
        return TokenResponse(token=f"mock_livekit_token_{participant_name}_{room_name}")
