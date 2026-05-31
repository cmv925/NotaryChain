"""
Smart Contract Template Library — catalog of the most-used real-world legal
agreements. Each template has structured fields + a body with {{placeholder}}
tokens. Rendered deterministically (field substitution) and optionally tailored
by GPT-5.2, then anchored on Hedera HCS for an immutable, timestamped proof.
"""
from typing import Dict, List, Optional

CATEGORIES = {
    "business": "Business",
    "real_estate": "Real Estate",
    "finance": "Finance & Lending",
    "employment": "Employment & Freelance",
    "personal": "Personal & Estate",
    "sales": "Sales & Transfers",
}


def _f(key, label, type="text", required=True, placeholder="", help=""):
    return {"key": key, "label": label, "type": type, "required": required,
            "placeholder": placeholder, "help": help}


COMMON_PARTIES = [
    _f("effective_date", "Effective Date", type="date", placeholder="2026-01-01"),
]

TEMPLATES: List[Dict] = [
    {
        "id": "nda",
        "name": "Non-Disclosure Agreement (NDA)",
        "category": "business",
        "icon": "lock",
        "popularity": 98,
        "description": "Protect confidential information shared between two parties.",
        "fields": [
            _f("disclosing_party", "Disclosing Party", placeholder="Acme Inc."),
            _f("receiving_party", "Receiving Party", placeholder="Jane Doe"),
            _f("effective_date", "Effective Date", type="date"),
            _f("purpose", "Purpose of Disclosure", type="textarea",
               placeholder="Evaluating a potential business relationship"),
            _f("term_years", "Confidentiality Term (years)", type="number", placeholder="3"),
            _f("governing_law", "Governing Law (State)", placeholder="Florida"),
        ],
        "body": """NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement (the "Agreement") is entered into as of {{effective_date}} by and between {{disclosing_party}} ("Disclosing Party") and {{receiving_party}} ("Receiving Party").

1. PURPOSE. The parties wish to explore the following opportunity: {{purpose}}. In connection with this purpose, the Disclosing Party may share certain confidential and proprietary information.

2. CONFIDENTIAL INFORMATION. "Confidential Information" means any non-public information disclosed by the Disclosing Party, whether oral, written, or electronic, including but not limited to business plans, financials, customer lists, trade secrets, and technical data.

3. OBLIGATIONS. The Receiving Party shall (a) hold all Confidential Information in strict confidence, (b) use it solely for the stated Purpose, and (c) not disclose it to any third party without prior written consent.

4. TERM. The obligations under this Agreement shall remain in effect for {{term_years}} year(s) from the Effective Date.

5. GOVERNING LAW. This Agreement shall be governed by the laws of the State of {{governing_law}}.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

DISCLOSING PARTY: {{disclosing_party}}        Signature: __________________  Date: __________

RECEIVING PARTY: {{receiving_party}}          Signature: __________________  Date: __________
""",
    },
    {
        "id": "service_agreement",
        "name": "Master Service Agreement",
        "category": "business",
        "icon": "handshake",
        "popularity": 92,
        "description": "Define the terms for ongoing professional services between a provider and client.",
        "fields": [
            _f("provider", "Service Provider", placeholder="BrightWorks LLC"),
            _f("client", "Client", placeholder="Acme Inc."),
            _f("effective_date", "Effective Date", type="date"),
            _f("services", "Description of Services", type="textarea",
               placeholder="Web design and ongoing maintenance"),
            _f("fees", "Fees / Rate", placeholder="$150/hour, invoiced monthly"),
            _f("term", "Term", placeholder="12 months, auto-renewing"),
            _f("governing_law", "Governing Law (State)", placeholder="California"),
        ],
        "body": """MASTER SERVICE AGREEMENT

This Master Service Agreement (the "Agreement") is made as of {{effective_date}} between {{provider}} ("Provider") and {{client}} ("Client").

1. SERVICES. Provider shall perform the following services: {{services}}.

2. COMPENSATION. Client shall pay Provider {{fees}}. Invoices are due within thirty (30) days of receipt.

3. TERM. This Agreement shall remain in effect for {{term}} unless terminated earlier in accordance with this Agreement.

4. INDEPENDENT CONTRACTOR. Provider is an independent contractor. Nothing herein creates an employment, partnership, or agency relationship.

5. INTELLECTUAL PROPERTY. All deliverables created specifically for Client shall, upon full payment, become the property of Client.

6. CONFIDENTIALITY. Each party shall protect the other's confidential information and use it only to perform under this Agreement.

7. GOVERNING LAW. This Agreement is governed by the laws of the State of {{governing_law}}.

PROVIDER: {{provider}}     Signature: __________________  Date: __________

CLIENT: {{client}}         Signature: __________________  Date: __________
""",
    },
    {
        "id": "independent_contractor",
        "name": "Independent Contractor Agreement",
        "category": "employment",
        "icon": "file-check",
        "popularity": 90,
        "description": "Engage a freelancer or contractor for a specific scope of work.",
        "fields": [
            _f("company", "Company / Client", placeholder="Acme Inc."),
            _f("contractor", "Contractor", placeholder="John Smith"),
            _f("effective_date", "Effective Date", type="date"),
            _f("scope", "Scope of Work", type="textarea", placeholder="Develop a mobile application"),
            _f("compensation", "Compensation", placeholder="$5,000 fixed fee"),
            _f("deadline", "Completion Deadline", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Texas"),
        ],
        "body": """INDEPENDENT CONTRACTOR AGREEMENT

This Agreement is entered into on {{effective_date}} between {{company}} ("Company") and {{contractor}} ("Contractor").

1. SERVICES. Contractor agrees to perform the following: {{scope}}.

2. COMPENSATION. Company shall pay Contractor {{compensation}} upon satisfactory completion of the Services.

3. DEADLINE. Contractor shall complete the Services by {{deadline}}.

4. INDEPENDENT CONTRACTOR STATUS. Contractor is not an employee and is responsible for all taxes on amounts received. Contractor controls the manner and means of performing the Services.

5. OWNERSHIP. All work product is "work made for hire" and is owned by Company upon payment.

6. TERMINATION. Either party may terminate with written notice; Contractor shall be paid for work completed.

7. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

COMPANY: {{company}}        Signature: __________________  Date: __________

CONTRACTOR: {{contractor}}  Signature: __________________  Date: __________
""",
    },
    {
        "id": "employment_offer",
        "name": "Employment Offer Letter",
        "category": "employment",
        "icon": "file-check",
        "popularity": 85,
        "description": "Extend a formal job offer with role, compensation, and start date.",
        "fields": [
            _f("company", "Company", placeholder="Acme Inc."),
            _f("candidate", "Candidate Name", placeholder="Maria Garcia"),
            _f("position", "Position / Title", placeholder="Senior Engineer"),
            _f("start_date", "Start Date", type="date"),
            _f("salary", "Annual Salary", placeholder="$120,000"),
            _f("employment_type", "Employment Type", placeholder="Full-time, at-will"),
            _f("governing_law", "Governing Law (State)", placeholder="New York"),
        ],
        "body": """EMPLOYMENT OFFER LETTER

Date: {{start_date}}

Dear {{candidate}},

{{company}} ("Company") is pleased to offer you the position of {{position}}.

1. POSITION. You will serve as {{position}}, reporting to your designated manager, beginning on {{start_date}}.

2. COMPENSATION. Your annualized base salary will be {{salary}}, payable in accordance with the Company's standard payroll schedule.

3. EMPLOYMENT TYPE. This is a {{employment_type}} position. Your employment is at-will and may be terminated by either party at any time.

4. CONFIDENTIALITY. You agree to protect the Company's confidential information during and after employment.

5. GOVERNING LAW. This offer is governed by the laws of the State of {{governing_law}}.

We are excited to have you join the team.

Sincerely,
{{company}}

Accepted by {{candidate}}:  Signature: __________________  Date: __________
""",
    },
    {
        "id": "lease_residential",
        "name": "Residential Lease Agreement",
        "category": "real_estate",
        "icon": "home",
        "popularity": 94,
        "description": "Rent a home or apartment with clear terms for landlord and tenant.",
        "fields": [
            _f("landlord", "Landlord", placeholder="Sunset Properties LLC"),
            _f("tenant", "Tenant", placeholder="Alex Johnson"),
            _f("property_address", "Property Address", placeholder="123 Main St, Miami, FL"),
            _f("start_date", "Lease Start Date", type="date"),
            _f("term_months", "Lease Term (months)", type="number", placeholder="12"),
            _f("monthly_rent", "Monthly Rent", placeholder="$2,000"),
            _f("security_deposit", "Security Deposit", placeholder="$2,000"),
            _f("governing_law", "Governing Law (State)", placeholder="Florida"),
        ],
        "body": """RESIDENTIAL LEASE AGREEMENT

This Lease is made on {{start_date}} between {{landlord}} ("Landlord") and {{tenant}} ("Tenant").

1. PREMISES. Landlord leases to Tenant the residential property located at {{property_address}} (the "Premises").

2. TERM. The lease term is {{term_months}} month(s), beginning on {{start_date}}.

3. RENT. Tenant shall pay {{monthly_rent}} per month, due on the first day of each month.

4. SECURITY DEPOSIT. Tenant shall pay a security deposit of {{security_deposit}}, refundable subject to the condition of the Premises.

5. USE. The Premises shall be used solely as a private residence.

6. MAINTENANCE. Tenant shall keep the Premises clean and promptly report needed repairs.

7. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

LANDLORD: {{landlord}}   Signature: __________________  Date: __________

TENANT: {{tenant}}       Signature: __________________  Date: __________
""",
    },
    {
        "id": "lease_commercial",
        "name": "Commercial Lease Agreement",
        "category": "real_estate",
        "icon": "building",
        "popularity": 78,
        "description": "Lease commercial or office space with business-specific terms.",
        "fields": [
            _f("landlord", "Landlord", placeholder="Downtown Holdings LLC"),
            _f("tenant", "Tenant (Business)", placeholder="Acme Inc."),
            _f("property_address", "Property Address", placeholder="500 Market St, Suite 200"),
            _f("permitted_use", "Permitted Use", placeholder="General office use"),
            _f("start_date", "Lease Start Date", type="date"),
            _f("term_months", "Lease Term (months)", type="number", placeholder="36"),
            _f("monthly_rent", "Monthly Rent", placeholder="$6,500"),
            _f("governing_law", "Governing Law (State)", placeholder="Illinois"),
        ],
        "body": """COMMERCIAL LEASE AGREEMENT

This Commercial Lease is made on {{start_date}} between {{landlord}} ("Landlord") and {{tenant}} ("Tenant").

1. PREMISES. Landlord leases to Tenant the commercial space at {{property_address}} (the "Premises").

2. PERMITTED USE. Tenant shall use the Premises only for: {{permitted_use}}.

3. TERM. The term is {{term_months}} month(s) commencing {{start_date}}.

4. RENT. Base rent is {{monthly_rent}} per month, payable in advance on the first of each month.

5. MAINTENANCE & UTILITIES. Tenant is responsible for utilities and interior maintenance unless otherwise agreed in writing.

6. INSURANCE. Tenant shall maintain commercial general liability insurance naming Landlord as additional insured.

7. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

LANDLORD: {{landlord}}   Signature: __________________  Date: __________

TENANT: {{tenant}}       Signature: __________________  Date: __________
""",
    },
    {
        "id": "bill_of_sale",
        "name": "General Bill of Sale",
        "category": "sales",
        "icon": "file-check",
        "popularity": 88,
        "description": "Record the sale and transfer of personal property between two parties.",
        "fields": [
            _f("seller", "Seller", placeholder="Pat Lee"),
            _f("buyer", "Buyer", placeholder="Sam Rivera"),
            _f("item_description", "Item(s) Description", type="textarea",
               placeholder="One (1) used MacBook Pro, Serial #XYZ123"),
            _f("sale_price", "Sale Price", placeholder="$800"),
            _f("sale_date", "Sale Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Ohio"),
        ],
        "body": """BILL OF SALE

This Bill of Sale is executed on {{sale_date}} between {{seller}} ("Seller") and {{buyer}} ("Buyer").

1. SALE. Seller hereby sells, transfers, and conveys to Buyer the following property: {{item_description}} (the "Property").

2. PURCHASE PRICE. Buyer agrees to pay Seller {{sale_price}} for the Property, receipt of which is acknowledged.

3. "AS-IS". The Property is sold "AS-IS," without warranties of any kind unless expressly stated herein.

4. TITLE. Seller warrants that Seller is the lawful owner of the Property and that it is free of all liens and encumbrances.

5. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

SELLER: {{seller}}   Signature: __________________  Date: __________

BUYER: {{buyer}}     Signature: __________________  Date: __________
""",
    },
    {
        "id": "vehicle_bill_of_sale",
        "name": "Vehicle Bill of Sale",
        "category": "sales",
        "icon": "file-check",
        "popularity": 82,
        "description": "Transfer ownership of a car, motorcycle, or other vehicle.",
        "fields": [
            _f("seller", "Seller", placeholder="Pat Lee"),
            _f("buyer", "Buyer", placeholder="Sam Rivera"),
            _f("vehicle", "Vehicle (Year/Make/Model)", placeholder="2018 Honda Civic"),
            _f("vin", "VIN", placeholder="1HG...123456"),
            _f("odometer", "Odometer Reading", placeholder="42,000 miles"),
            _f("sale_price", "Sale Price", placeholder="$12,500"),
            _f("sale_date", "Sale Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Georgia"),
        ],
        "body": """VEHICLE BILL OF SALE

This Vehicle Bill of Sale is executed on {{sale_date}} between {{seller}} ("Seller") and {{buyer}} ("Buyer").

1. VEHICLE. Seller sells to Buyer the following vehicle: {{vehicle}}, VIN {{vin}}, with an odometer reading of {{odometer}}.

2. PURCHASE PRICE. Buyer agrees to pay {{sale_price}}, receipt of which is acknowledged by Seller.

3. "AS-IS". The vehicle is sold "AS-IS" with no warranty, express or implied, unless stated herein.

4. TITLE. Seller certifies lawful ownership and that the vehicle is free of liens except as disclosed.

5. ODOMETER DISCLOSURE. Seller states that the odometer reading is accurate to the best of Seller's knowledge.

6. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

SELLER: {{seller}}   Signature: __________________  Date: __________

BUYER: {{buyer}}     Signature: __________________  Date: __________
""",
    },
    {
        "id": "promissory_note",
        "name": "Promissory Note",
        "category": "finance",
        "icon": "landmark",
        "popularity": 80,
        "description": "Document a borrower's promise to repay a loan with terms.",
        "fields": [
            _f("lender", "Lender", placeholder="First Capital LLC"),
            _f("borrower", "Borrower", placeholder="Chris Park"),
            _f("principal", "Principal Amount", placeholder="$10,000"),
            _f("interest_rate", "Annual Interest Rate", placeholder="6%"),
            _f("repayment_terms", "Repayment Terms", type="textarea",
               placeholder="$500/month for 24 months"),
            _f("note_date", "Date of Note", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Florida"),
        ],
        "body": """PROMISSORY NOTE

Date: {{note_date}}
Principal: {{principal}}

FOR VALUE RECEIVED, {{borrower}} ("Borrower") promises to pay to {{lender}} ("Lender") the principal sum of {{principal}}, together with interest at an annual rate of {{interest_rate}}.

1. REPAYMENT. Borrower shall repay the loan as follows: {{repayment_terms}}.

2. PREPAYMENT. Borrower may prepay all or part of the principal at any time without penalty.

3. DEFAULT. If any payment is more than fifteen (15) days late, the entire unpaid balance shall become due at Lender's option.

4. GOVERNING LAW. This Note is governed by the laws of the State of {{governing_law}}.

BORROWER: {{borrower}}   Signature: __________________  Date: __________
""",
    },
    {
        "id": "loan_agreement",
        "name": "Loan Agreement",
        "category": "finance",
        "icon": "landmark",
        "popularity": 76,
        "description": "A detailed loan contract with collateral and default provisions.",
        "fields": [
            _f("lender", "Lender", placeholder="First Capital LLC"),
            _f("borrower", "Borrower", placeholder="Chris Park"),
            _f("loan_amount", "Loan Amount", placeholder="$25,000"),
            _f("interest_rate", "Annual Interest Rate", placeholder="8%"),
            _f("term_months", "Term (months)", type="number", placeholder="36"),
            _f("collateral", "Collateral (if any)", type="textarea", required=False,
               placeholder="2020 Toyota Camry"),
            _f("loan_date", "Loan Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Nevada"),
        ],
        "body": """LOAN AGREEMENT

This Loan Agreement is entered into on {{loan_date}} between {{lender}} ("Lender") and {{borrower}} ("Borrower").

1. LOAN. Lender agrees to loan Borrower {{loan_amount}} (the "Loan").

2. INTEREST. The Loan bears interest at {{interest_rate}} per annum.

3. TERM & REPAYMENT. Borrower shall repay the Loan in full over {{term_months}} month(s) in equal installments.

4. COLLATERAL. The Loan is secured by the following collateral, if any: {{collateral}}.

5. DEFAULT. Failure to make timely payments constitutes default, entitling Lender to accelerate the balance and pursue remedies.

6. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

LENDER: {{lender}}     Signature: __________________  Date: __________

BORROWER: {{borrower}} Signature: __________________  Date: __________
""",
    },
    {
        "id": "llc_operating",
        "name": "LLC Operating Agreement",
        "category": "business",
        "icon": "building",
        "popularity": 74,
        "description": "Govern the ownership and operations of a limited liability company.",
        "fields": [
            _f("company", "LLC Name", placeholder="BrightWorks LLC"),
            _f("state", "State of Formation", placeholder="Delaware"),
            _f("members", "Members & Ownership %", type="textarea",
               placeholder="Jane Doe (60%), John Smith (40%)"),
            _f("management", "Management Structure", placeholder="Member-managed"),
            _f("effective_date", "Effective Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Delaware"),
        ],
        "body": """LLC OPERATING AGREEMENT

This Operating Agreement of {{company}} (the "Company"), a limited liability company organized under the laws of {{state}}, is effective as of {{effective_date}}.

1. FORMATION. The Company is formed under the {{state}} Limited Liability Company Act.

2. MEMBERS & OWNERSHIP. The members and their ownership interests are: {{members}}.

3. MANAGEMENT. The Company shall be {{management}}.

4. CAPITAL CONTRIBUTIONS. Each member's contributions and percentage interests are as set forth above.

5. DISTRIBUTIONS. Profits and losses shall be allocated to members in proportion to their ownership interests.

6. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

MEMBERS:
{{members}}

Signature: __________________  Date: __________
""",
    },
    {
        "id": "partnership_agreement",
        "name": "Partnership Agreement",
        "category": "business",
        "icon": "handshake",
        "popularity": 70,
        "description": "Set terms between business partners on roles, profits, and exits.",
        "fields": [
            _f("partner_a", "Partner A", placeholder="Jane Doe"),
            _f("partner_b", "Partner B", placeholder="John Smith"),
            _f("business_name", "Business Name", placeholder="Doe & Smith Ventures"),
            _f("profit_split", "Profit / Loss Split", placeholder="50/50"),
            _f("contributions", "Capital Contributions", type="textarea",
               placeholder="Each partner contributes $10,000"),
            _f("effective_date", "Effective Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Colorado"),
        ],
        "body": """PARTNERSHIP AGREEMENT

This Partnership Agreement is made on {{effective_date}} between {{partner_a}} and {{partner_b}} (the "Partners").

1. PARTNERSHIP. The Partners agree to operate a business under the name {{business_name}}.

2. CAPITAL CONTRIBUTIONS. {{contributions}}.

3. PROFITS & LOSSES. Profits and losses shall be shared {{profit_split}}.

4. MANAGEMENT. The Partners shall have equal rights in the management of the partnership business unless otherwise agreed.

5. DISSOLUTION. The partnership may be dissolved by mutual agreement; assets shall be distributed after liabilities are paid.

6. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

PARTNER A: {{partner_a}}   Signature: __________________  Date: __________

PARTNER B: {{partner_b}}   Signature: __________________  Date: __________
""",
    },
    {
        "id": "power_of_attorney",
        "name": "Power of Attorney",
        "category": "personal",
        "icon": "scale",
        "popularity": 84,
        "description": "Authorize someone to act on your behalf for financial or legal matters.",
        "fields": [
            _f("principal", "Principal (You)", placeholder="Robert Chen"),
            _f("agent", "Agent / Attorney-in-Fact", placeholder="Linda Chen"),
            _f("powers", "Powers Granted", type="textarea",
               placeholder="Manage bank accounts and pay bills"),
            _f("effective_date", "Effective Date", type="date"),
            _f("durable", "Durable (survives incapacity)?", placeholder="Yes"),
            _f("governing_law", "Governing Law (State)", placeholder="Florida"),
        ],
        "body": """POWER OF ATTORNEY

I, {{principal}} ("Principal"), hereby appoint {{agent}} as my Agent (Attorney-in-Fact), effective {{effective_date}}.

1. GRANT OF AUTHORITY. My Agent is authorized to act on my behalf with respect to: {{powers}}.

2. DURABILITY. Durable: {{durable}}. If "Yes," this Power of Attorney shall not be affected by my subsequent disability or incapacity.

3. REVOCATION. I may revoke this Power of Attorney at any time by written notice to my Agent.

4. THIRD PARTY RELIANCE. Third parties may rely on this document until they receive actual notice of revocation.

5. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

PRINCIPAL: {{principal}}   Signature: __________________  Date: __________

AGENT: {{agent}}           Signature: __________________  Date: __________
""",
    },
    {
        "id": "simple_will",
        "name": "Last Will & Testament",
        "category": "personal",
        "icon": "scroll",
        "popularity": 86,
        "description": "Direct how your assets are distributed and name an executor.",
        "fields": [
            _f("testator", "Testator (You)", placeholder="Eleanor Vance"),
            _f("executor", "Executor", placeholder="Thomas Vance"),
            _f("beneficiaries", "Beneficiaries & Bequests", type="textarea",
               placeholder="My home to my daughter; remainder split equally among my children"),
            _f("guardian", "Guardian for Minors (if any)", required=False,
               placeholder="Sarah Vance"),
            _f("will_date", "Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Florida"),
        ],
        "body": """LAST WILL AND TESTAMENT

I, {{testator}}, being of sound mind, declare this to be my Last Will and Testament, made on {{will_date}}, and revoke all prior wills.

1. EXECUTOR. I appoint {{executor}} as Executor of this Will.

2. BEQUESTS. I direct that my assets be distributed as follows: {{beneficiaries}}.

3. GUARDIAN. If applicable, I appoint {{guardian}} as guardian of my minor children.

4. RESIDUARY. Any remaining assets not specifically bequeathed shall pass to my named beneficiaries in equal shares.

5. GOVERNING LAW. This Will is governed by the laws of the State of {{governing_law}}.

NOTE: A valid will typically requires the signatures of the testator and two witnesses. Consult a licensed attorney.

TESTATOR: {{testator}}   Signature: __________________  Date: __________

WITNESS 1: __________________   WITNESS 2: __________________
""",
    },
    {
        "id": "release_of_liability",
        "name": "Release of Liability / Waiver",
        "category": "personal",
        "icon": "scale",
        "popularity": 72,
        "description": "Waive claims and release a party from liability for an activity.",
        "fields": [
            _f("releasor", "Releasor (Participant)", placeholder="Jordan Blake"),
            _f("releasee", "Releasee (Organization)", placeholder="Summit Adventures LLC"),
            _f("activity", "Activity / Event", type="textarea", placeholder="Guided rock climbing tour"),
            _f("effective_date", "Effective Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Utah"),
        ],
        "body": """RELEASE OF LIABILITY AND WAIVER

This Release is executed on {{effective_date}} by {{releasor}} ("Releasor") in favor of {{releasee}} ("Releasee").

1. ACTIVITY. Releasor wishes to participate in the following: {{activity}} (the "Activity").

2. ASSUMPTION OF RISK. Releasor understands the Activity involves inherent risks and voluntarily assumes all such risks.

3. RELEASE. Releasor releases and holds harmless Releasee from any and all claims, liabilities, and damages arising from participation in the Activity, to the fullest extent permitted by law.

4. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

RELEASOR: {{releasor}}   Signature: __________________  Date: __________
""",
    },
    {
        "id": "mou",
        "name": "Memorandum of Understanding (MOU)",
        "category": "business",
        "icon": "handshake",
        "popularity": 68,
        "description": "Outline the intentions of parties before a formal contract.",
        "fields": [
            _f("party_a", "Party A", placeholder="Acme Inc."),
            _f("party_b", "Party B", placeholder="Globex Corp."),
            _f("objective", "Objective", type="textarea",
               placeholder="Collaborate on a joint marketing campaign"),
            _f("responsibilities", "Key Responsibilities", type="textarea",
               placeholder="Acme provides design; Globex provides distribution"),
            _f("effective_date", "Effective Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="Washington"),
        ],
        "body": """MEMORANDUM OF UNDERSTANDING

This Memorandum of Understanding ("MOU") is entered into on {{effective_date}} between {{party_a}} and {{party_b}} (the "Parties").

1. OBJECTIVE. The Parties intend to: {{objective}}.

2. RESPONSIBILITIES. {{responsibilities}}.

3. NON-BINDING. This MOU expresses the Parties' intentions and is not legally binding except for any provisions expressly stated to be binding.

4. TERM. This MOU remains in effect until superseded by a definitive agreement or terminated by either Party.

5. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

PARTY A: {{party_a}}   Signature: __________________  Date: __________

PARTY B: {{party_b}}   Signature: __________________  Date: __________
""",
    },
    {
        "id": "media_release",
        "name": "Photo / Media Release",
        "category": "personal",
        "icon": "file-check",
        "popularity": 60,
        "description": "Grant permission to use someone's likeness in photos or video.",
        "fields": [
            _f("releasor", "Person Granting Release", placeholder="Casey Morgan"),
            _f("company", "Company / Photographer", placeholder="Lens & Light Studio"),
            _f("usage", "Permitted Usage", type="textarea",
               placeholder="Marketing materials, website, and social media"),
            _f("effective_date", "Effective Date", type="date"),
            _f("governing_law", "Governing Law (State)", placeholder="California"),
        ],
        "body": """PHOTO / MEDIA RELEASE

This Release is granted on {{effective_date}} by {{releasor}} to {{company}}.

1. GRANT. {{releasor}} grants {{company}} the irrevocable right to use their name, likeness, image, and voice in photographs and recordings.

2. USAGE. Such materials may be used for: {{usage}}.

3. WAIVER. {{releasor}} waives any right to inspect or approve the finished materials and any claim for compensation.

4. GOVERNING LAW. Governed by the laws of the State of {{governing_law}}.

RELEASOR: {{releasor}}   Signature: __________________  Date: __________
""",
    },
]

_TEMPLATE_INDEX = {t["id"]: t for t in TEMPLATES}


def list_templates(category: Optional[str] = None, query: Optional[str] = None) -> List[Dict]:
    items = TEMPLATES
    if category:
        items = [t for t in items if t["category"] == category]
    if query:
        q = query.lower()
        items = [t for t in items if q in t["name"].lower() or q in t["description"].lower()]
    return [
        {
            "id": t["id"], "name": t["name"], "category": t["category"],
            "category_label": CATEGORIES.get(t["category"], t["category"]),
            "icon": t["icon"], "popularity": t["popularity"],
            "description": t["description"], "field_count": len(t["fields"]),
        }
        for t in sorted(items, key=lambda x: -x["popularity"])
    ]


def get_template(template_id: str) -> Optional[Dict]:
    return _TEMPLATE_INDEX.get(template_id)


def render_template(template_id: str, values: Dict[str, str]) -> Dict:
    """Deterministic field substitution. Missing required fields are blanked + reported."""
    t = get_template(template_id)
    if not t:
        return {"error": "Template not found"}
    body = t["body"]
    missing = []
    for field in t["fields"]:
        key = field["key"]
        val = (values.get(key) or "").strip()
        if not val:
            if field.get("required", True):
                missing.append(field["label"])
            val = "[__________]"
        body = body.replace("{{" + key + "}}", val)
    # Title = template name + first party value if present
    return {
        "title": t["name"],
        "category": t["category"],
        "content": body.strip(),
        "missing_fields": missing,
    }
