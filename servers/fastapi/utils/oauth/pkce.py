"""
PKCE utilities using Python's secrets and hashlib.
Python port of pi-mono-main/packages/ai/src/utils/oauth/pkce.ts
"""

import base64
import hashlib
import secrets


def generate_pkce() -> tuple[str, str]:
    """
    Generate PKCE code verifier and challenge (S256 method).

    Returns:
        (verifier, challenge) — both base64url-encoded, no padding
    """
    verifier_bytes = secrets.token_bytes(32)
    verifier = base64.urlsafe_b64encode(verifier_bytes).rstrip(b"=").decode()

    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    return verifier, challenge
