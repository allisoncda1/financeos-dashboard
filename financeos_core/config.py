"""
financeos_core/config.py
-------------------------
Central configuration loader for the FinanceOS Core sync engine.

Reads ALL environment variables once at startup and returns an immutable
configuration object. The sync engine must consume this object — it must
never read os.environ directly.

Required environment variables:
    QBO_CLIENT_ID             QuickBooks OAuth2 client ID
    QBO_CLIENT_SECRET         QuickBooks OAuth2 client secret
    QBO_BASE_URL              QuickBooks API base URL
    QBO_TOKEN_URL             QuickBooks OAuth2 token endpoint

Per company (repeat for each suffix: CARDEALER_AI, T3_MARKETING, TOPMRKTR, SMILE_MORE):
    QBO_REALM_{SUFFIX}          QBO company realm ID
    QBO_REFRESH_TOKEN_{SUFFIX}  Current OAuth2 refresh token

Never logs or exposes credential values.
"""

import os
import logging
from dataclasses import dataclass, field
from typing import List, Optional
from pathlib import Path

log = logging.getLogger(__name__)

# Registry: env var suffix → human display name
# Order determines sync order.
_COMPANY_REGISTRY = [
    ("T3_MARKETING",  "T3 Marketing"),
    ("CARDEALER_AI",  "CarDealer.ai"),
    ("TOPMRKTR",      "TopMrktr"),
    ("SMILE_MORE",    "Smile More"),
]


@dataclass(frozen=True)
class CompanyConfig:
    name: str
    realm_id: str
    refresh_token: str   # never logged


@dataclass
class QBOConfig:
    """
    Immutable runtime configuration for the QBO sync engine.
    Constructed once by config.load() and passed through the call stack.
    """
    client_id: str       # never logged
    client_secret: str   # never logged
    base_url: str
    token_url: str
    companies: List[CompanyConfig] = field(default_factory=list)

    def to_env_dict(self) -> dict:
        """
        Returns a dict with the legacy key names that connectors/quickbooks.py
        expects (PROD_CLIENT_ID, PROD_CLIENT_SECRET, BASE, TOKEN_URL).
        This bridges the new env var names to the existing connector interface
        without modifying the connector.
        """
        return {
            "PROD_CLIENT_ID":     self.client_id,
            "PROD_CLIENT_SECRET": self.client_secret,
            "BASE":               self.base_url,
            "TOKEN_URL":          self.token_url,
        }

    def to_company_dicts(self) -> List[dict]:
        """
        Returns a list of dicts with the keys connectors/quickbooks.py expects:
        { name, realm_id, refresh_token }
        """
        return [
            {
                "name":          c.name,
                "realm_id":      c.realm_id,
                "refresh_token": c.refresh_token,
            }
            for c in self.companies
        ]

    def note_rotated_token(self, company_name: str, new_refresh_token: str) -> None:
        """
        Called when QBO returns a rotated refresh token after use.

        In the environment-driven architecture there is no companies.json to
        update on disk. The rotated token is NOT persisted here — it is lost
        when the process exits. This is acceptable for short sync runs because
        QBO refresh tokens have a 100-day expiry and only rotate on use.

        For long-term production use, persist the rotated token by updating
        the Replit Secret QBO_REFRESH_TOKEN_{SUFFIX} manually, or implement
        a DB-backed token store in a future phase.
        """
        log.warning(
            f"[config] QBO refresh token rotated for '{company_name}'. "
            f"Update the corresponding QBO_REFRESH_TOKEN_* secret in Replit "
            f"to avoid re-using the old token on the next run."
        )


def _require(name: str) -> str:
    """Return the value of a required env var, or raise with a clear message."""
    val = os.environ.get(name, "").strip()
    if not val:
        raise RuntimeError(
            f"Required environment variable '{name}' is not set. "
            f"Add it to Replit Secrets (production) or .env (local dev)."
        )
    return val


def _optional(name: str) -> Optional[str]:
    return os.environ.get(name, "").strip() or None


def load() -> QBOConfig:
    """
    Load and validate all required environment variables.

    Raises RuntimeError with a descriptive message if any required variable
    is missing. Skips companies with incomplete configuration (both
    QBO_REALM_* and QBO_REFRESH_TOKEN_* must be set) and logs a warning.
    Raises if no companies are configured at all.

    Never logs credential values.
    """
    _load_dotenv_if_present()

    client_id     = _require("QBO_CLIENT_ID")
    client_secret = _require("QBO_CLIENT_SECRET")
    base_url      = _require("QBO_BASE_URL")
    token_url     = _require("QBO_TOKEN_URL")

    companies: List[CompanyConfig] = []
    skipped: List[str] = []

    for suffix, display_name in _COMPANY_REGISTRY:
        realm = _optional(f"QBO_REALM_{suffix}")
        token = _optional(f"QBO_REFRESH_TOKEN_{suffix}")

        if realm and token:
            companies.append(CompanyConfig(
                name=display_name,
                realm_id=realm,
                refresh_token=token,
            ))
        else:
            missing = []
            if not realm:
                missing.append(f"QBO_REALM_{suffix}")
            if not token:
                missing.append(f"QBO_REFRESH_TOKEN_{suffix}")
            log.warning(
                f"[config] Skipping '{display_name}' — missing: {', '.join(missing)}"
            )
            skipped.extend(missing)

    if not companies:
        raise RuntimeError(
            f"No companies configured. Missing environment variables: "
            f"{', '.join(skipped)}"
        )

    log.info(
        f"[config] Loaded {len(companies)} companies: "
        f"{[c.name for c in companies]}"
    )
    return QBOConfig(
        client_id=client_id,
        client_secret=client_secret,
        base_url=base_url,
        token_url=token_url,
        companies=companies,
    )


def _load_dotenv_if_present() -> None:
    """
    Parse a .env file from the project root into os.environ if one exists.
    Only active in local development — Replit injects secrets directly.
    Does not override variables already set in the environment.
    Never raises if the file is absent or unreadable.
    """
    root = Path(__file__).parent.parent
    env_path = root / ".env"
    if not env_path.exists():
        return
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
        log.debug("[config] Loaded .env from %s", env_path)
    except Exception as exc:
        log.debug("[config] Could not read .env: %s", exc)
