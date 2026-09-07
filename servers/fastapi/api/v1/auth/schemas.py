import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

USERNAME_PATTERN = r"^\S+$"


class InternalUserCreate(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=128,
        pattern=USERNAME_PATTERN,
    )
    password: str = Field(min_length=8, max_length=128)


class PublicUser(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AuthCredentialsRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=128,
        pattern=USERNAME_PATTERN,
    )
    password: str = Field(min_length=8, max_length=128)


class LoginCredentialsRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=128,
        pattern=USERNAME_PATTERN,
    )
    # The pre-multi-user release allowed six-character passwords. Login keeps
    # that compatibility while all newly-created passwords require eight.
    password: str = Field(min_length=6, max_length=128)


class TelegramAuthRequest(BaseModel):
    # initData передаём сырой строкой как есть: подпись считается по исходному
    # тексту, любая пересборка на стороне клиента её ломает.
    init_data: str = Field(min_length=1, max_length=8192)


class AdminSetQuotaRequest(BaseModel):
    # null сбрасывает на дефолт из GENERATION_QUOTA_PER_DAY; 0 = безлимит.
    limit: int | None = Field(default=None, ge=0)


class AdminCreateUserRequest(AuthCredentialsRequest):
    pass


class AdminResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AdminCreateApiKeyRequest(BaseModel):
    user_id: uuid.UUID
    label: str = Field(default="API client", min_length=1, max_length=120)
    expiry_days: int = Field(default=90, ge=1, le=365)


class ApiKeyPublic(BaseModel):
    id: str
    user_id: uuid.UUID
    created_by_id: uuid.UUID
    label: str
    created_at: datetime
    expires_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreated(ApiKeyPublic):
    token: str


class ApiKeyToken(BaseModel):
    id: str
    token: str
