from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/links", tags=["links"])


class CreateLinkRequest(BaseModel):
    repo_owner: str
    repo_name: str
    branch: str
    expires_at: datetime
    link_type: Literal["public", "private"] = "public"
    recipient_email: EmailStr | None = None


class CreateLinkResponse(BaseModel):
    repo_owner: str
    repo_name: str
    branch: str
    expires_at: datetime
    commit_sha: str
    share_url: str


@router.post("/", response_model=CreateLinkResponse)
async def create_link(request: CreateLinkRequest):
    pass
