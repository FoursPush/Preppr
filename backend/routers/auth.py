import os
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from livekit import api

router = APIRouter(prefix="/api/tokens", tags=["Authentication & Tokens"])

class TokenRequest(BaseModel):
    room_name: str = Field(..., description="The name of the LiveKit room to join", example="interview-room-101")
    participant_name: str = Field(..., description="The display name or ID of the participant", example="Soham")

class TokenResponse(BaseModel):
    token: str = Field(..., description="Signed LiveKit JWT token for client SDK authentication")

@router.post(
    "/generate",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate LiveKit Connection Token",
    description="Generates a signed LiveKit JWT connection token for joining a room with specific grants."
)
async def generate_token(payload: TokenRequest):
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing."
        )

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate LiveKit connection token: {str(e)}"
        )
