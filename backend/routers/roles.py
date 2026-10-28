from typing import List, Optional
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

router = APIRouter(tags=["Companies & Roles"])


class RoleResponse(BaseModel):
    id: str
    company_id: str
    category: str
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
        # Admin
        RoleResponse(id="role_admin_asst", company_id="comp_startup", category="Admin", role_name="Administrative Assistant", difficulty="Medium", requirements=["Scheduling", "Communication", "Office Management"]),
        RoleResponse(id="role_office_mgr", company_id="comp_startup", category="Admin", role_name="Office Manager", difficulty="Medium", requirements=["Vendor Management", "Budgeting", "Operations"]),
        RoleResponse(id="role_exec_asst", company_id="comp_startup", category="Admin", role_name="Executive Assistant", difficulty="Hard", requirements=["Stakeholder Management", "Confidentiality", "Prioritization"]),
        RoleResponse(id="role_receptionist", company_id="comp_startup", category="Admin", role_name="Receptionist", difficulty="Easy", requirements=["Customer Service", "Phone Skills", "Greeting"]),
        RoleResponse(id="role_data_entry", company_id="comp_amazon", category="Admin", role_name="Data Entry Clerk", difficulty="Easy", requirements=["Typing", "Accuracy", "Data Management"]),
        
        # HR
        RoleResponse(id="role_hr_gen", company_id="comp_startup", category="HR", role_name="HR Generalist", difficulty="Medium", requirements=["Employee Relations", "Onboarding", "Compliance"]),
        RoleResponse(id="role_recruiter", company_id="comp_amazon", category="HR", role_name="Recruiter", difficulty="Medium", requirements=["Sourcing", "Interviewing", "Negotiation"]),
        RoleResponse(id="role_hr_mgr", company_id="comp_meta", category="HR", role_name="HR Manager", difficulty="Hard", requirements=["Strategic HR", "Performance Management", "Leadership"]),
        RoleResponse(id="role_hr_coord", company_id="comp_startup", category="HR", role_name="HR Coordinator", difficulty="Easy", requirements=["Scheduling", "Documentation", "HRIS"]),
        RoleResponse(id="role_comp_analyst", company_id="comp_google", category="HR", role_name="Compensation Analyst", difficulty="Medium", requirements=["Data Analysis", "Market Research", "Excel"]),
        
        # Finance
        RoleResponse(id="role_fin_analyst", company_id="comp_amazon", category="Finance", role_name="Financial Analyst", difficulty="Medium", requirements=["Financial Modeling", "Excel", "Forecasting"]),
        RoleResponse(id="role_accountant", company_id="comp_startup", category="Finance", role_name="Accountant", difficulty="Medium", requirements=["GAAP", "Reconciliation", "Tax Preparation"]),
        RoleResponse(id="role_fin_mgr", company_id="comp_google", category="Finance", role_name="Finance Manager", difficulty="Hard", requirements=["Corporate Finance", "Budgeting", "Team Management"]),
        RoleResponse(id="role_bookkeeper", company_id="comp_startup", category="Finance", role_name="Bookkeeper", difficulty="Easy", requirements=["QuickBooks", "Accounts Payable", "Accounts Receivable"]),
        RoleResponse(id="role_payroll", company_id="comp_amazon", category="Finance", role_name="Payroll Specialist", difficulty="Medium", requirements=["Payroll Processing", "Compliance", "Data Entry"]),

        # IT
        RoleResponse(id="role_frontend_jr", company_id="comp_startup", category="IT", role_name="Frontend Engineer", difficulty="Easy", requirements=["HTML/CSS/JS", "React", "State Management", "Responsive Design"]),
        RoleResponse(id="role_backend_sr", company_id="comp_amazon", category="IT", role_name="Backend Engineer", difficulty="Hard", requirements=["Python/Go", "Distributed Systems", "SQL/NoSQL", "System Design"]),
        RoleResponse(id="role_devops", company_id="comp_google", category="IT", role_name="DevOps Engineer", difficulty="Medium", requirements=["AWS/GCP", "CI/CD", "Docker/Kubernetes", "Infrastructure as Code"]),
        RoleResponse(id="role_qa_eng", company_id="comp_startup", category="IT", role_name="QA Engineer", difficulty="Medium", requirements=["Testing", "Automation", "Selenium", "Bug Tracking"]),
        RoleResponse(id="role_data_sci", company_id="comp_meta", category="IT", role_name="Data Scientist", difficulty="Hard", requirements=["Python", "Machine Learning", "SQL", "Statistics"]),

        # Sales
        RoleResponse(id="role_ae", company_id="comp_startup", category="Sales", role_name="Account Executive", difficulty="Medium", requirements=["B2B Sales", "Closing", "CRM", "Pipeline Management"]),
        RoleResponse(id="role_sdr", company_id="comp_amazon", category="Sales", role_name="Sales Development Rep", difficulty="Easy", requirements=["Cold Calling", "Lead Generation", "Email Outreach"]),
        RoleResponse(id="role_sales_mgr", company_id="comp_meta", category="Sales", role_name="Sales Manager", difficulty="Hard", requirements=["Sales Strategy", "Quota Attainment", "Team Leadership"]),
        RoleResponse(id="role_csm", company_id="comp_google", category="Sales", role_name="Customer Success Manager", difficulty="Medium", requirements=["Onboarding", "Retention", "Relationship Management"]),
        RoleResponse(id="role_acct_mgr", company_id="comp_amazon", category="Sales", role_name="Account Manager", difficulty="Medium", requirements=["Upselling", "Client Relations", "Account Planning"])
    ]

    if company_id:
        return [r for r in all_roles if r.company_id == company_id]
    return all_roles
