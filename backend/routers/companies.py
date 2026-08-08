from typing import List, Optional
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

router = APIRouter(tags=["Companies & Roles"])


class CompanyResponse(BaseModel):
    id: str
    name: str
    description: str
    values: List[str]
    interview_style: str


@router.get(
    "/companies",
    response_model=List[CompanyResponse],
    status_code=status.HTTP_200_OK,
    summary="List Seeded Target Companies",
    description="Returns list of available target companies for mock interview setup."
)
@router.get("/api/companies", include_in_schema=False)
async def list_companies():
    return [
        CompanyResponse(
            id="comp_amazon",
            name="Amazon",
            description="Global technology leader focusing on e-commerce, cloud computing, and AI.",
            values=["Customer Obsession", "Ownership", "Bias for Action", "Deep Dive", "Deliver Results"],
            interview_style="Leadership Principles + STAR Framework Behavioral & System Design"
        ),
        CompanyResponse(
            id="comp_google",
            name="Google",
            description="Multinational technology company specializing in online search, cloud computing, and AI.",
            values=["Focus on the user", "Fast is better than slow", "Democracy on the web works", "Great just isn't good enough"],
            interview_style="Algorithmic Problem Solving + Distributed Systems Architecture"
        ),
        CompanyResponse(
            id="comp_meta",
            name="Meta",
            description="Social technology company building products that help people connect.",
            values=["Move Fast", "Focus on Long-Term Impact", "Build Awesome Things", "Be Open"],
            interview_style="Rapid Coding + Product Architecture & Scalability"
        ),
        CompanyResponse(
            id="comp_startup",
            name="Generic Tech Startup",
            description="Fast-growing Series B engineering company scaling core products.",
            values=["Agility", "Customer-First", "High Velocity"],
            interview_style="Practical Coding + System Architecture + Culture Alignment"
        )
    ]
