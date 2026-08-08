from typing import List, Optional
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

router = APIRouter(tags=["Companies & Roles"])


class RoleResponse(BaseModel):
    id: str
    company_id: str
    role_name: str
    difficulty: str
    requirements: List[str]


@router.get(
    "/roles",
    response_model=List[RoleResponse],
    status_code=status.HTTP_200_OK,
    summary="List Seeded Interview Roles",
    description="Returns available interview roles filtered by company or difficulty."
)
@router.get("/api/roles", include_in_schema=False)
async def list_roles(company_id: Optional[str] = None):
    all_roles = [
        RoleResponse(
            id="role_backend_sr",
            company_id="comp_amazon",
            role_name="Senior Software Engineer - Backend",
            difficulty="Hard",
            requirements=["Python/Go", "Distributed Systems", "SQL/NoSQL", "System Design"]
        ),
        RoleResponse(
            id="role_fullstack_mid",
            company_id="comp_google",
            role_name="Full Stack Engineer",
            difficulty="Medium",
            requirements=["React/TypeScript", "Node.js/Python", "REST/GraphQL", "Data Structures"]
        ),
        RoleResponse(
            id="role_system_design",
            company_id="comp_meta",
            role_name="Systems Architect",
            difficulty="Hard",
            requirements=["Scalability", "High Availability", "Cache Design", "Load Balancing"]
        ),
        RoleResponse(
            id="role_frontend_jr",
            company_id="comp_startup",
            role_name="Frontend Engineer",
            difficulty="Easy",
            requirements=["HTML/CSS/JS", "React", "State Management", "Responsive Design"]
        )
    ]

    if company_id:
        return [r for r in all_roles if r.company_id == company_id]
    return all_roles
