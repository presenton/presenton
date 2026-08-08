import pytest
from pydantic import ValidationError

from api.v1.auth.schemas import (
    AdminCreateUserRequest,
    AuthCredentialsRequest,
    InternalUserCreate,
    LoginCredentialsRequest,
)


@pytest.mark.parametrize(
    ("schema", "password"),
    (
        (InternalUserCreate, "secret123"),
        (AuthCredentialsRequest, "secret123"),
        (AdminCreateUserRequest, "secret123"),
        (LoginCredentialsRequest, "secret"),
    ),
)
@pytest.mark.parametrize("username", ("   ", "admin user", "admin\tuser"))
def test_username_credentials_reject_whitespace(schema, password, username):
    with pytest.raises(ValidationError):
        schema(username=username, password=password)


@pytest.mark.parametrize(
    ("schema", "password"),
    (
        (InternalUserCreate, "secret123"),
        (AuthCredentialsRequest, "secret123"),
        (AdminCreateUserRequest, "secret123"),
        (LoginCredentialsRequest, "secret"),
    ),
)
def test_username_credentials_accept_non_whitespace_username(schema, password):
    credentials = schema(username="admin-user", password=password)

    assert credentials.username == "admin-user"
