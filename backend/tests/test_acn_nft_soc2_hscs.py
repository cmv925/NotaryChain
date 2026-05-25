"""Tests for iter-117: ACN jurisdiction expansion + NFT mint, SOC2 run-now, Hedera real deploy."""
import os, pytest, requests, uuid

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = ("admin@notarychain.com", "Admin123!")
USER = ("demo@test.com", "Demo123!")


def _login(email, pwd):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(*ADMIN)}"}


@pytest.fixture(scope="module")
def user_h():
    return {"Authorization": f"Bearer {_login(*USER)}"}


# ── ACN: jurisdictions expansion ───────────────────────────────────────────
def test_acn_jurisdictions_count_and_keys(user_h):
    r = requests.get(f"{BASE}/api/acn/jurisdictions", headers=user_h, timeout=30)
    assert r.status_code == 200
    juris = r.json()["jurisdictions"]
    codes = {j["code"] for j in juris}
    assert len(codes) >= 65, f"expected >=65, got {len(codes)}"
    # 10 ASEAN
    for c in ["SG", "ID", "TH", "VN", "MY", "PH", "MM", "KH", "LA", "BN"]:
        assert c in codes, f"missing ASEAN: {c}"
    # sample US states (not in original 11)
    for c in ["US-CO", "US-MA", "US-WA", "US-OR", "US-GA"]:
        assert c in codes, f"missing US state: {c}"
    # originals
    for c in ["US-FL", "EU", "GB", "DE-de", "JP"]:
        assert c in codes


def test_acn_analyze_expanded(user_h):
    txt = "Buyer in Colorado, seller in Massachusetts. Co-signer in Singapore. Witness in Philippines."
    r = requests.post(f"{BASE}/api/acn/analyze", headers=user_h,
                      json={"doc_text": txt, "source_jurisdiction": "US-FL"}, timeout=60)
    assert r.status_code == 200, r.text
    detected = set(r.json()["detected_jurisdictions"])
    for c in ["US-CO", "US-MA", "SG", "PH"]:
        assert c in detected, f"missing detection: {c} in {detected}"


# ── ACN NFT mint ────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def sealed_packet(user_h):
    r = requests.post(f"{BASE}/api/acn/analyze", headers=user_h,
                      json={"doc_text": "Florida only test packet TEST_iter117",
                            "source_jurisdiction": "US-FL",
                            "hint_codes": ["US-FL"]}, timeout=60)
    pid = r.json()["id"]
    # seal only FL to keep it fast
    r2 = requests.post(f"{BASE}/api/acn/packets/{pid}/seal", headers=user_h,
                       json={"jurisdictions": ["US-FL"]}, timeout=180)
    assert r2.status_code == 200, r2.text
    return pid


def test_mint_nft_on_unsealed_returns_400(user_h):
    r = requests.post(f"{BASE}/api/acn/analyze", headers=user_h,
                      json={"doc_text": "Test unsealed Singapore packet", "source_jurisdiction": "US-FL"}, timeout=60)
    pid = r.json()["id"]
    r2 = requests.post(f"{BASE}/api/acn/packets/{pid}/mint-nft", headers=user_h, timeout=30)
    assert r2.status_code == 400
    assert "sealed" in r2.json().get("detail", "").lower()


def test_mint_nft_success_and_idempotent(sealed_packet, user_h):
    pid = sealed_packet
    r = requests.post(f"{BASE}/api/acn/packets/{pid}/mint-nft", headers=user_h, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["already_minted"] is False
    nft = data["nft"]
    assert nft.get("token_id", "").startswith("0.0.")
    assert "serial_number" in nft
    assert nft.get("mode") == "mock"
    assert "metadata_uri" in nft
    tok1 = nft["token_id"]
    ser1 = nft["serial_number"]
    # idempotent
    r2 = requests.post(f"{BASE}/api/acn/packets/{pid}/mint-nft", headers=user_h, timeout=30)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["already_minted"] is True
    assert d2["nft"]["token_id"] == tok1
    assert d2["nft"]["serial_number"] == ser1


def test_public_verify_includes_nft(sealed_packet):
    pid = sealed_packet
    r = requests.get(f"{BASE}/api/acn/public/verify/{pid}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("nft") is not None
    assert data["nft"].get("token_id", "").startswith("0.0.")


# ── SOC2 run-now + scheduled download + history ────────────────────────────
def test_soc2_run_now_admin(admin_h):
    r = requests.post(f"{BASE}/api/admin/audit-export/run-now", headers=admin_h, timeout=120)
    # may 400 if no audit rows in last 7 days — accept that
    assert r.status_code in (200, 400), r.text
    if r.status_code == 200:
        d = r.json()
        assert "export_id" in d
        assert "row_count" in d
        assert "root_hash" in d
        assert d.get("email_sent_to") == "mrclay925@gmail.com"
        pytest.export_id = d["export_id"]
    else:
        pytest.export_id = None


def test_soc2_run_now_non_admin_403(user_h):
    r = requests.post(f"{BASE}/api/admin/audit-export/run-now", headers=user_h, timeout=30)
    assert r.status_code == 403


def test_soc2_scheduled_download_unknown_404(admin_h):
    r = requests.get(f"{BASE}/api/admin/audit-export/scheduled/AUDIT-UNKNOWN-XYZ/download",
                     headers=admin_h, timeout=30)
    assert r.status_code == 404


def test_soc2_scheduled_download_real(admin_h):
    eid = getattr(pytest, "export_id", None)
    if not eid:
        pytest.skip("no export from run-now")
    r = requests.get(f"{BASE}/api/admin/audit-export/scheduled/{eid}/download",
                     headers=admin_h, timeout=60)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/zip")
    assert r.headers.get("X-Root-Hash")
    # zip should contain expected files
    import io, zipfile
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = set(z.namelist())
    assert "audit_log.csv" in names
    assert "audit_log.json" in names
    assert "MANIFEST.txt" in names


def test_soc2_history_excludes_zip_b64(admin_h):
    r = requests.get(f"{BASE}/api/admin/audit-export/history", headers=admin_h, timeout=30)
    assert r.status_code == 200
    for row in r.json()["exports"]:
        assert "zip_b64" not in row, "history must not include payload"


# ── Hedera real escrow deploy ──────────────────────────────────────────────
@pytest.fixture(scope="module")
def escrow_id(admin_h):
    # use admin to bypass feature paywall
    r = requests.post(f"{BASE}/api/escrow/create", headers=admin_h,
                      json={"title": "TEST iter117 escrow", "escrow_type": "freelancer",
                            "buyer_email": "admin@notarychain.com", "seller_email": "seller@test.com",
                            "escrow_amount": 1000}, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()["escrow_id"]


def test_deploy_real_default_mode_mock(escrow_id, admin_h):
    r = requests.post(f"{BASE}/api/escrow/{escrow_id}/contract/deploy-real",
                      headers=admin_h, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    dep = d["deployment"]
    assert dep["mode"] == "mock"
    assert dep["contract_id"].startswith("0.0.")
    assert "bytecode_sha256" in dep
    assert d["op"]["opcode"] == "UPGRADE_TO_HSCS"


def test_deploy_real_state_after(escrow_id, admin_h):
    r = requests.get(f"{BASE}/api/escrow/{escrow_id}/contract-state",
                     headers=admin_h, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "mode" in d
    assert d.get("real_deployment") is not None


def test_deploy_real_non_party_403(admin_h):
    # admin creates an escrow w/o user as party; user shouldn't be able to deploy
    r = requests.post(f"{BASE}/api/escrow/create", headers=admin_h,
                      json={"title": "TEST iter117 access-check",
                            "buyer_email": "buyer-x@test.com", "seller_email": "seller-x@test.com",
                            "escrow_amount": 100}, timeout=60)
    assert r.status_code == 200, r.text
    eid = r.json()["escrow_id"]
    # log in as notary (not a party)
    tok = _login("notarytest@test.com", "Test123!")
    h = {"Authorization": f"Bearer {tok}"}
    r2 = requests.post(f"{BASE}/api/escrow/{eid}/contract/deploy-real",
                       headers=h, timeout=30)
    assert r2.status_code == 403
