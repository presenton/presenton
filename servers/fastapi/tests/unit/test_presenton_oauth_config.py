from utils.get_env import (
    DEFAULT_PRESENTON_OAUTH_ISSUER,
    get_presenton_oauth_issuer,
)


def test_issuer_is_built_in():
    assert get_presenton_oauth_issuer() == DEFAULT_PRESENTON_OAUTH_ISSUER
