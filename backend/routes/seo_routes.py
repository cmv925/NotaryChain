"""
Dynamic, host-aware XML sitemap for search engines + answer engines.

Served at /api/seo/sitemap.xml (referenced from /robots.txt). Includes the static
public pages plus dynamically-generated entries for every public notary profile
and every supported state-compliance page, so new notaries/states are indexed
automatically. Uses the request host so it is correct on any domain.
"""
from fastapi import APIRouter, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from xml.sax.saxutils import escape
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/seo", tags=["seo"])
db: AsyncIOMotorDatabase = None


def set_db(database):
    global db
    db = database


# Static public, indexable routes → (path, changefreq, priority)
STATIC_ROUTES = [
    ("/", "weekly", "1.0"),
    ("/pricing", "monthly", "0.9"),
    ("/florida", "monthly", "0.9"),
    ("/florida/notaries", "monthly", "0.7"),
    ("/notaries", "daily", "0.8"),
    ("/trustlayer", "monthly", "0.6"),
    ("/trust-badge", "monthly", "0.6"),
    ("/verify", "monthly", "0.7"),
    ("/compliance/states", "monthly", "0.7"),
    ("/developers/sdk", "monthly", "0.6"),
    ("/scanner/demo", "monthly", "0.6"),
    ("/docs", "monthly", "0.5"),
]


def _url(base: str, path: str, changefreq: str = "weekly", priority: str = "0.6") -> str:
    return (
        f"  <url>\n"
        f"    <loc>{escape(base + path)}</loc>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


@router.get("/sitemap.xml")
async def dynamic_sitemap(request: Request):
    # Origin from the incoming request (works on preview AND custom domains).
    # Force https — behind the ingress the request arrives as http internally,
    # but the public canonical URL is always https.
    base = str(request.base_url).rstrip("/")
    fwd_proto = request.headers.get("x-forwarded-proto")
    if fwd_proto:
        base = base.replace("http://", f"{fwd_proto.split(',')[0].strip()}://", 1)
    elif base.startswith("http://"):
        base = "https://" + base[len("http://"):]

    parts = [_url(base, p, cf, pr) for (p, cf, pr) in STATIC_ROUTES]

    # State compliance pages
    try:
        from data.state_compliance_abstracts import STATE_ABSTRACTS
        for code in STATE_ABSTRACTS.keys():
            parts.append(_url(base, f"/compliance/states/{code}", "monthly", "0.6"))
    except Exception as e:
        logger.warning(f"sitemap state pages skipped: {e}")

    # Public notary profiles
    try:
        cursor = db.users.find(
            {"role": {"$in": ["notary", "admin"]}, "active": {"$ne": False}},
            {"_id": 0, "id": 1},
        ).limit(5000)
        async for n in cursor:
            if n.get("id"):
                parts.append(_url(base, f"/notary/{n['id']}", "weekly", "0.5"))
    except Exception as e:
        logger.warning(f"sitemap notary profiles skipped: {e}")

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(parts)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")
