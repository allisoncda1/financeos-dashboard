#!/usr/bin/env python3
"""
connectors/quickbooks.py
------------------------
Low-level QuickBooks Online API connector.
- Loads credentials from .env and companies.json in the project root
- Provides: refresh_token(), query_entity(), get_report()
- Read-only — never writes to QBO.
- Handles pagination transparently (QBO max 1000 rows/call).
"""

import os
import sys
import json
import base64
import urllib.parse
import urllib.request
import urllib.error

# Project root is one level up from this file (connectors/)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── Credential loading ──────────────────────────────────────────────────────

def load_env():
    env = {}
    p = os.path.join(ROOT, ".env")
    if not os.path.exists(p):
        sys.exit("Missing .env — copy .env.template to .env and fill in PROD keys.")
    for line in open(p):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def load_companies():
    p = os.path.join(ROOT, "companies.json")
    if not os.path.exists(p):
        sys.exit("Missing companies.json — see companies.template.json.")
    companies = json.load(open(p))["companies"]
    return [c for c in companies if "PUT_" not in c.get("realm_id", "")]


# ── Auth ────────────────────────────────────────────────────────────────────

def refresh_access_token(env, refresh_token):
    """
    Exchange a refresh token for a fresh access token (valid ~1h).
    Returns (access_token, new_refresh_token).
    NOTE: Refresh tokens rotate roughly every 24h — callers should persist
          the returned new_refresh_token if it differs from the input.
    """
    auth = base64.b64encode(
        f"{env['PROD_CLIENT_ID']}:{env['PROD_CLIENT_SECRET']}".encode()
    ).decode()
    data = urllib.parse.urlencode(
        {"grant_type": "refresh_token", "refresh_token": refresh_token}
    ).encode()
    req = urllib.request.Request(env["TOKEN_URL"], data=data, method="POST")
    req.add_header("Authorization", f"Basic {auth}")
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req) as r:
        body = json.load(r)
    return body["access_token"], body.get("refresh_token", refresh_token)


def save_rotated_tokens(token_map):
    """
    Persist rotated refresh tokens back to companies.json.
    token_map: dict of {company_name: new_refresh_token}
    Writes atomically — reads the file, updates matching entries, writes back.
    """
    if not token_map:
        return
    p = os.path.join(ROOT, "companies.json")
    data = json.load(open(p))
    updated = []
    for company in data["companies"]:
        name = company["name"]
        if name in token_map:
            old = company["refresh_token"]
            new = token_map[name]
            if old != new:
                company["refresh_token"] = new
                updated.append(name)
    if updated:
        # Write atomically via temp file
        tmp = p + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, p)
        print(f"  [connector] Persisted rotated refresh tokens for: {', '.join(updated)}")


# ── Query API (entity data) ──────────────────────────────────────────────────

def _query_page(env, token, realm, sql, start, page_size=1000):
    """Run one page of a QBO SQL query. Returns (rows_list, entity_key)."""
    paged_sql = f"{sql} STARTPOSITION {start} MAXRESULTS {page_size}"
    qs = urllib.parse.urlencode({"query": paged_sql, "minorversion": "65"})
    url = f"{env['BASE']}/v3/company/{realm}/query?{qs}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req) as r:
        body = json.load(r)
    qr = body.get("QueryResponse", {})
    # Entity key is whichever key is not a metadata key
    meta = {"startPosition", "maxResults", "totalCount"}
    entity_keys = [k for k in qr if k not in meta]
    if not entity_keys:
        return [], None
    key = entity_keys[0]
    return qr.get(key, []), key


def query_entity(env, token, realm, entity, extra_fields="*"):
    """
    Pull all records for a QBO entity (Account, Customer, Vendor, etc.)
    using paginated SELECT queries.
    Returns a flat list of raw QBO dicts.
    """
    sql = f"SELECT {extra_fields} FROM {entity}"
    rows = []
    start = 1
    page_size = 1000
    while True:
        page, _ = _query_page(env, token, realm, sql, start, page_size)
        rows.extend(page)
        if len(page) < page_size:
            break
        start += page_size
    return rows


# ── Reports API ──────────────────────────────────────────────────────────────

def get_report(env, token, realm, report_name, params=None):
    """Pull a QBO report (TrialBalance, ProfitAndLoss, BalanceSheet, etc.)."""
    qs = ("?" + urllib.parse.urlencode(params)) if params else ""
    url = f"{env['BASE']}/v3/company/{realm}/reports/{report_name}{qs}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req) as r:
        return json.load(r)


# ── Number helper ────────────────────────────────────────────────────────────

def parse_amount(value):
    """Safely convert a QBO value string (may have commas, $, parens) to float."""
    if value is None:
        return None
    s = str(value).replace(",", "").replace("$", "").strip()
    # QBO sometimes uses parentheses for negatives
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return None
