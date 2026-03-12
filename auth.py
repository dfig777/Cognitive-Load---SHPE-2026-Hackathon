"""
Azure AD authentication via MSAL + JWT verification.

Flow:
  1. React SPA acquires a token via MSAL (implicit / auth-code-PKCE).
  2. Token is sent as Bearer in the Authorization header.
  3. FastAPI validates signature + claims using Azure AD JWKS.
"""
from __future__ import annotations

import httpx
from functools import lru_cache
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import get_settings, Settings

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwks_uri(tenant_id: str) -> str:
    oidc_url = (
        f"https://login.microsoftonline.com/{tenant_id}/v2.0"
        "/.well-known/openid-configuration"
    )
    resp = httpx.get(oidc_url, timeout=10)
    resp.raise_for_status()
    return resp.json()["jwks_uri"]


def _fetch_jwks(tenant_id: str) -> dict:
    uri = _get_jwks_uri(tenant_id)
    resp = httpx.get(uri, timeout=10)
    resp.raise_for_status()
    return resp.json()


def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Validates the Azure AD Bearer token.
    Returns the decoded claims dict (includes 'oid' as the user identifier).
    Raises 401 on any failure.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    token = credentials.credentials
    try:
        jwks = _fetch_jwks(settings.azure_tenant_id)
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.azure_client_id,
            options={"verify_exp": True},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {exc}",
        )

    return claims


def get_user_id(claims: dict = Depends(verify_token)) -> str:
    """Extract the stable Azure AD object ID as user identifier."""
    oid = claims.get("oid")
    if not oid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'oid' claim",
        )
    return oid
