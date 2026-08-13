"""
Live public API integrations — no authentication required.

These wrap free U.S. federal public APIs (CMS, FDA, NLM, NIH) and expose
them through Axeris with standardized JSON shapes + graceful fallback.
Used by the live demo to demonstrate real federal data integration.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import urllib.request
import urllib.parse
import json
import ssl

router = APIRouter(prefix="/public-apis", tags=["public-apis"])


def _http_get(url: str, timeout: int = 10):
    """Helper: make a GET request with SSL + UA, return parsed JSON or raise."""
    req = urllib.request.Request(url, headers={
        "User-Agent": "Axeris/0.8 (clinical decision support; +https://axeris.health)",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ─── 1. openFDA — Drug Labels ───
@router.get("/openfda/drug-label")
def openfda_drug_label(
    name: str = Query(..., description="Generic or brand drug name"),
    limit: int = 1,
):
    """Live FDA drug label lookup via openFDA API.
    Source: https://api.fda.gov/drug/label.json
    """
    try:
        q = urllib.parse.quote(f'openfda.generic_name:"{name}" OR openfda.brand_name:"{name}"')
        url = f"https://api.fda.gov/drug/label.json?search={q}&limit={limit}"
        data = _http_get(url)
        results = []
        for r in data.get("results", []):
            of = r.get("openfda", {})
            results.append({
                "generic_name": (of.get("generic_name") or [None])[0],
                "brand_name": (of.get("brand_name") or [None])[0],
                "manufacturer": (of.get("manufacturer_name") or [None])[0],
                "ndc": of.get("product_ndc", []),
                "rxcui": of.get("rxcui", []),
                "schedule": (of.get("dea_schedule") or [None])[0],
                "indications_and_usage": (r.get("indications_and_usage") or [""])[0][:600],
                "warnings": (r.get("warnings") or [""])[0][:600],
                "contraindications": (r.get("contraindications") or [""])[0][:600],
                "boxed_warning": (r.get("boxed_warning") or [""])[0][:600] if r.get("boxed_warning") else None,
                "drug_interactions": (r.get("drug_interactions") or [""])[0][:600] if r.get("drug_interactions") else None,
                "pregnancy": (r.get("pregnancy") or [""])[0][:300] if r.get("pregnancy") else None,
                "spl_id": r.get("id"),
            })
        return {
            "source": "openFDA Drug Label API (live)",
            "source_url": url,
            "live": True,
            "total": data.get("meta", {}).get("results", {}).get("total", 0),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(502, f"openFDA upstream: {str(e)[:200]}")


# ─── 2. openFDA — Adverse Events (FAERS) ───
@router.get("/openfda/adverse-events")
def openfda_adverse_events(name: str = Query(...), limit: int = 5):
    """Live FDA Adverse Events Reporting System (FAERS) via openFDA.
    Source: https://api.fda.gov/drug/event.json
    """
    try:
        q = urllib.parse.quote(f'patient.drug.medicinalproduct:"{name}"')
        url = f"https://api.fda.gov/drug/event.json?search={q}&limit={limit}"
        data = _http_get(url)
        events = []
        for r in data.get("results", []):
            patient = r.get("patient", {})
            reactions = [x.get("reactionmeddrapt") for x in patient.get("reaction", [])][:5]
            events.append({
                "report_id": r.get("safetyreportid"),
                "report_date": r.get("receivedate"),
                "serious": r.get("serious") == "1",
                "patient_age": patient.get("patientonsetage"),
                "patient_sex": {"1": "M", "2": "F"}.get(patient.get("patientsex"), "U"),
                "reactions": reactions,
                "outcome": [
                    {"1": "recovered", "2": "recovering", "3": "not recovered",
                     "4": "recovered with sequelae", "5": "fatal", "6": "unknown"}.get(x.get("reactionoutcome"))
                    for x in patient.get("reaction", []) if x.get("reactionoutcome")
                ][:3],
            })
        return {
            "source": "openFDA FAERS Adverse Events API (live)",
            "source_url": url,
            "live": True,
            "total_reports": data.get("meta", {}).get("results", {}).get("total", 0),
            "events": events,
        }
    except Exception as e:
        raise HTTPException(502, f"openFDA upstream: {str(e)[:200]}")


# ─── 3. openFDA — Drug Recalls ───
@router.get("/openfda/recalls")
def openfda_recalls(name: Optional[str] = None, limit: int = 5):
    """Live FDA drug enforcement / recall reports via openFDA.
    Source: https://api.fda.gov/drug/enforcement.json
    """
    try:
        if name:
            q = urllib.parse.quote(f'product_description:"{name}"')
            url = f"https://api.fda.gov/drug/enforcement.json?search={q}&limit={limit}"
        else:
            url = f"https://api.fda.gov/drug/enforcement.json?limit={limit}"
        data = _http_get(url)
        recalls = []
        for r in data.get("results", []):
            recalls.append({
                "recall_number": r.get("recall_number"),
                "product": r.get("product_description", "")[:200],
                "reason": r.get("reason_for_recall", "")[:300],
                "classification": r.get("classification"),
                "status": r.get("status"),
                "recall_initiation_date": r.get("recall_initiation_date"),
                "recalling_firm": r.get("recalling_firm"),
                "voluntary_mandated": r.get("voluntary_mandated"),
                "distribution_pattern": r.get("distribution_pattern", "")[:200],
            })
        return {
            "source": "openFDA Drug Enforcement / Recalls API (live)",
            "source_url": url,
            "live": True,
            "total": data.get("meta", {}).get("results", {}).get("total", 0),
            "recalls": recalls,
        }
    except Exception as e:
        raise HTTPException(502, f"openFDA upstream: {str(e)[:200]}")


# ─── 4. RxNav (NLM) — Drug Normalization ───
@router.get("/rxnav/lookup")
def rxnav_lookup(name: str = Query(...)):
    """RxNorm drug normalization via RxNav REST API (NLM).
    Source: https://rxnav.nlm.nih.gov/REST/
    """
    try:
        url = f"https://rxnav.nlm.nih.gov/REST/drugs.json?name={urllib.parse.quote(name)}"
        data = _http_get(url)
        groups = data.get("drugGroup", {}).get("conceptGroup", []) or []
        out = []
        for g in groups:
            for cp in g.get("conceptProperties", []) or []:
                out.append({
                    "rxcui": cp.get("rxcui"),
                    "name": cp.get("name"),
                    "synonym": cp.get("synonym"),
                    "tty": cp.get("tty"),
                    "language": cp.get("language"),
                    "suppress": cp.get("suppress"),
                })
        return {
            "source": "RxNav (NLM) RxNorm API (live)",
            "source_url": url,
            "live": True,
            "total": len(out),
            "concepts": out[:20],
        }
    except Exception as e:
        raise HTTPException(502, f"RxNav upstream: {str(e)[:200]}")


@router.get("/rxnav/interaction/{rxcui}")
def rxnav_interaction(rxcui: str):
    """Drug-drug interaction lookup for an RxCUI via RxNav.
    Source: https://rxnav.nlm.nih.gov/REST/interaction/interaction.json
    """
    try:
        url = f"https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui={urllib.parse.quote(str(rxcui))}"
        data = _http_get(url)
        groups = data.get("interactionTypeGroup", []) or []
        out = []
        for g in groups:
            for it in g.get("interactionType", []) or []:
                for ip in it.get("interactionPair", []) or []:
                    out.append({
                        "severity": ip.get("severity"),
                        "description": ip.get("description", "")[:300],
                        "source": g.get("sourceName"),
                    })
        return {
            "source": "RxNav (NLM) Interaction API (live)",
            "source_url": url,
            "live": True,
            "rxcui": rxcui,
            "total": len(out),
            "interactions": out[:30],
        }
    except Exception as e:
        raise HTTPException(502, f"RxNav upstream: {str(e)[:200]}")


# ─── 5. NLM Clinical Tables — ICD-10 Lookup ───
@router.get("/clinicaltables/icd10")
def clinicaltables_icd10(q: str = Query(..., description="Search term"), limit: int = 10):
    """Live ICD-10-CM diagnosis lookup via NLM Clinical Tables API.
    Source: https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search
    """
    try:
        url = f"https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms={urllib.parse.quote(q)}&maxList={limit}"
        data = _http_get(url)
        # Returns: [total, codes[], extra, displayList[]]
        codes = data[1] if len(data) > 1 else []
        display = data[3] if len(data) > 3 else []
        results = []
        for i, code in enumerate(codes):
            name = display[i][1] if i < len(display) and len(display[i]) > 1 else ""
            results.append({"code": code, "description": name})
        return {
            "source": "NLM Clinical Tables ICD-10-CM API (live)",
            "source_url": url,
            "live": True,
            "total": data[0] if data else 0,
            "results": results,
        }
    except Exception as e:
        raise HTTPException(502, f"Clinical Tables upstream: {str(e)[:200]}")


# ─── 6. CMS Open Payments — Sunshine Act ───
@router.get("/openpayments/provider/{npi}")
def openpayments_provider(npi: str, year: int = 2023):
    """CMS Open Payments (Sunshine Act) — pharma payments to physicians by NPI.
    Source: https://openpaymentsdata.cms.gov/
    """
    if not (npi.isdigit() and len(npi) == 10):
        raise HTTPException(400, "NPI must be 10 digits")
    try:
        # Open Payments uses a Socrata-style API
        dataset_id = "i7uf-fjdr"  # general payments resource
        url = (
            f"https://openpaymentsdata.cms.gov/resource/{dataset_id}.json"
            f"?$where=physician_npi='{npi}'&program_year={year}&$limit=10"
        )
        data = _http_get(url)
        out = []
        total = 0.0
        for r in data:
            amt = float(r.get("total_amount_of_payment_usdollars", 0) or 0)
            total += amt
            out.append({
                "manufacturer": r.get("applicable_manufacturer_or_applicable_gpo_making_payment_name"),
                "amount_usd": amt,
                "nature_of_payment": r.get("nature_of_payment_or_transfer_of_value"),
                "drug_or_device": r.get("name_of_drug_or_biological_or_device_or_medical_supply_1"),
                "date": r.get("date_of_payment"),
            })
        return {
            "source": "CMS Open Payments / Sunshine Act (live)",
            "source_url": url,
            "live": True,
            "npi": npi,
            "program_year": year,
            "total_payments_usd": round(total, 2),
            "payment_count": len(out),
            "payments": out,
        }
    except Exception as e:
        return {
            "source": "CMS Open Payments / Sunshine Act",
            "live": False,
            "npi": npi,
            "upstream_error": str(e)[:200],
            "note": "CMS Open Payments uses Socrata API; rate limits may apply for unauthenticated requests.",
        }


# ─── 7. PubMed E-utilities — Drug Safety Literature ───
@router.get("/pubmed/search")
def pubmed_search(q: str = Query(...), limit: int = 5):
    """Live PubMed literature search via NCBI E-utilities.
    Source: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
    """
    try:
        es_url = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            f"?db=pubmed&term={urllib.parse.quote(q)}&retmode=json&retmax={limit}"
        )
        es = _http_get(es_url)
        ids = es.get("esearchresult", {}).get("idlist", [])
        if not ids:
            return {"source": "PubMed E-utilities (live)", "live": True, "total": 0, "articles": []}
        sum_url = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
            f"?db=pubmed&id={','.join(ids)}&retmode=json"
        )
        sm = _http_get(sum_url)
        result = sm.get("result", {})
        articles = []
        for pmid in ids:
            r = result.get(pmid, {})
            articles.append({
                "pmid": pmid,
                "title": r.get("title"),
                "authors": [a.get("name") for a in r.get("authors", [])][:5],
                "journal": r.get("fulljournalname") or r.get("source"),
                "pub_date": r.get("pubdate"),
                "doi": next((x.get("value") for x in r.get("articleids", []) if x.get("idtype") == "doi"), None),
            })
        return {
            "source": "PubMed E-utilities (NCBI, live)",
            "source_url": es_url,
            "live": True,
            "total": int(es.get("esearchresult", {}).get("count", 0)),
            "articles": articles,
        }
    except Exception as e:
        raise HTTPException(502, f"PubMed upstream: {str(e)[:200]}")


# ─── 8. Catalog of all live APIs ───
@router.get("/catalog")
def public_api_catalog():
    """Catalog of all live public APIs Axeris uses (with cost = $0)."""
    return {
        "live_apis": [
            {"id": "nppes", "name": "NPPES NPI Registry", "owner": "CMS", "endpoint": "/v8/public-api/nppes/{npi}",
             "upstream": "https://npiregistry.cms.hhs.gov/api/", "purpose": "Real-time prescriber identity verification"},
            {"id": "openfda_label", "name": "openFDA Drug Label", "owner": "FDA", "endpoint": "/public-apis/openfda/drug-label?name=...",
             "upstream": "https://api.fda.gov/drug/label.json", "purpose": "FDA SPL labels — indications, warnings, contraindications, boxed warnings"},
            {"id": "openfda_faers", "name": "openFDA Adverse Events (FAERS)", "owner": "FDA", "endpoint": "/public-apis/openfda/adverse-events?name=...",
             "upstream": "https://api.fda.gov/drug/event.json", "purpose": "Drug adverse event reports for risk surveillance"},
            {"id": "openfda_recalls", "name": "openFDA Drug Recalls", "owner": "FDA", "endpoint": "/public-apis/openfda/recalls",
             "upstream": "https://api.fda.gov/drug/enforcement.json", "purpose": "Active drug recall enforcement reports"},
            {"id": "rxnav_norm", "name": "RxNav RxNorm Lookup", "owner": "NLM", "endpoint": "/public-apis/rxnav/lookup?name=...",
             "upstream": "https://rxnav.nlm.nih.gov/REST/drugs.json", "purpose": "Drug normalization (NDC ↔ RxCUI ↔ ingredient ↔ brand)"},
            {"id": "rxnav_inter", "name": "RxNav Interactions", "owner": "NLM", "endpoint": "/public-apis/rxnav/interaction/{rxcui}",
             "upstream": "https://rxnav.nlm.nih.gov/REST/interaction/interaction.json", "purpose": "Drug-drug interactions by RxCUI"},
            {"id": "clinicaltables_icd10", "name": "NLM Clinical Tables (ICD-10)", "owner": "NLM", "endpoint": "/public-apis/clinicaltables/icd10?q=...",
             "upstream": "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search", "purpose": "ICD-10-CM diagnosis code lookup"},
            {"id": "open_payments", "name": "CMS Open Payments (Sunshine Act)", "owner": "CMS", "endpoint": "/public-apis/openpayments/provider/{npi}",
             "upstream": "https://openpaymentsdata.cms.gov/", "purpose": "Pharma payments to physicians (conflict-of-interest context for ML pill-mill check)"},
            {"id": "pubmed", "name": "PubMed E-utilities", "owner": "NCBI / NLM", "endpoint": "/public-apis/pubmed/search?q=...",
             "upstream": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/", "purpose": "Drug safety literature for clinical reviewer evidence"},
        ],
        "batch_synced_apis": [
            {"id": "leie", "name": "HHS-OIG LEIE", "frequency": "Monthly CSV", "purpose": "Foundational excluded provider screening"},
            {"id": "samgov", "name": "SAM.gov Exclusions", "frequency": "Daily API", "purpose": "Federal debarment cross-reference"},
            {"id": "nadac", "name": "CMS NADAC", "frequency": "Weekly CSV", "purpose": "Drug pricing benchmark"},
            {"id": "partd_puf", "name": "CMS Medicare Part D PUF", "frequency": "Annual", "purpose": "1.2M prescriber peer baseline"},
            {"id": "orange_book", "name": "FDA Orange Book", "frequency": "Monthly", "purpose": "Generic AB-rated equivalents"},
            {"id": "purple_book", "name": "FDA Purple Book", "frequency": "Monthly", "purpose": "Biosimilar interchangeability"},
            {"id": "credible_meds", "name": "CredibleMeds (AZ CERT)", "frequency": "Continuous", "purpose": "QT prolongation tier"},
            {"id": "cpic", "name": "CPIC Guidelines", "frequency": "Versioned JSON", "purpose": "Pharmacogenomic clinical actions"},
            {"id": "cdc_2022", "name": "CDC 2022 Opioid Guideline", "frequency": "Static", "purpose": "MME thresholds + naloxone"},
            {"id": "ags_beers", "name": "AGS Beers Criteria 2023", "frequency": "Open access PDF", "purpose": "Geriatric safety"},
        ],
        "validation_databases": [
            {"id": "truveta_tdm", "name": "Truveta TDM", "owner": "Truveta", "purpose": "EHR + linked claims — ML training corpus and clinical validation", "license": "Subscription (Truveta Studio)"},
            {"id": "kythera", "name": "Kythera Wayfinder", "owner": "Kythera Labs", "purpose": "Production retraining (310M patients open claims)", "license": "Commercial"},
            {"id": "truveta", "name": "Truveta TDM", "owner": "Truveta", "purpose": "De-identified EHR — patient context (40-table EHR + LOINC)", "license": "Hopkins SAFE/SAFER Desktop"},
        ],
    }
