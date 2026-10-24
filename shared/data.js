// Reference data for the EWRA platform (Scope Document v1.0: §7 taxonomy, §10 controls, §12 appetite).
// Entity register and control library are illustrative defaults, to be confirmed in Discovery.

export const LABELS = ["", "Low", "Medium-Low", "Medium", "Medium-High", "High"];
export const ENV_LABELS = ["", "Effective", "Largely effective", "Partially effective", "Ineffective"];
export const RESULTS = ["Pass", "Pass with minor exceptions", "Fail – partial", "Fail"];
export const STATUSES = ["Draft", "Submitted", "Approved", "Conditions", "Returned"];
export const NONBANK = ["Subsidiary – investment", "Subsidiary – insurance", "Subsidiary – leasing"];
export const TIERS = ["Tier 1", "Tier 2", "Tier 3"];

// code, name, domain, appetite level, max acceptable residual (1–5)
export const RISKS = [
  ["FC-01", "Money laundering", "Financial crime", "Very low", 2],
  ["FC-02", "Terrorist financing", "Financial crime", "Zero tolerance", 1],
  ["FC-03", "Proliferation financing", "Financial crime", "Zero tolerance", 1],
  ["FC-04", "Sanctions", "Financial crime", "Zero tolerance", 1],
  ["FC-05", "Bribery and corruption", "Financial crime", "Zero tolerance", 1],
  ["FC-06", "Fraud", "Financial crime", "Low", 3],
  ["FC-07", "Tax evasion and transparency", "Financial crime", "Zero tolerance", 1],
  ["RC-01", "Regulatory compliance", "Regulatory and conduct", "Very low", 2],
  ["RC-02", "Conduct and consumer protection", "Regulatory and conduct", "Low", 3],
  ["RC-03", "Data protection and privacy", "Regulatory and conduct", "Very low", 2],
  ["RC-04", "Shariah non-compliance", "Regulatory and conduct", "Very low", 2],
  ["ER-01", "Credit risk", "Enterprise", "Moderate", 4],
  ["ER-02", "Market risk", "Enterprise", "Moderate", 4],
  ["ER-03", "Liquidity and funding", "Enterprise", "Low", 3],
  ["ER-04", "Operational risk", "Enterprise", "Low", 3],
  ["ER-05", "Cyber, information security and technology", "Enterprise", "Very low", 2],
  ["ER-06", "Third-party and outsourcing", "Enterprise", "Low", 3],
  ["ER-07", "Legal and litigation", "Enterprise", "Very low", 2],
  ["ER-08", "Reputational", "Enterprise", "Low", 3],
  ["ER-09", "Strategic, business model and ESG", "Enterprise", "Moderate", 4],
].map(([code, name, domain, appetite, max]) => ({ code, name, domain, appetite, max }));

// code, name, region, type, tier, islamic, sample-data profile (L/M/H)
export const ENTITIES = [
  ["JO-HO", "Arab Bank plc – Jordan (Head Office)", "Jordan", "Head Office / branches", 1, false, "M"],
  ["JO-IIAB", "Islamic International Arab Bank", "Jordan", "Subsidiary – Islamic bank", 1, true, "M"],
  ["JO-INV", "Al-Arabi Investment Group (AB Invest)", "Jordan", "Subsidiary – investment", 3, false, "M"],
  ["JO-INS", "Insurance subsidiary – Jordan", "Jordan", "Subsidiary – insurance", 3, false, "M"],
  ["JO-LSG", "Leasing subsidiary – Jordan", "Jordan", "Subsidiary – leasing", 3, false, "M"],
  ["PS", "Arab Bank – Palestine", "Levant", "Foreign branch", 1, false, "H"],
  ["PS-INV", "Al-Arabi Investment Group – Palestine", "Levant", "Subsidiary – investment", 3, false, "H"],
  ["LB", "Arab Bank – Lebanon", "Levant", "Foreign branch", 2, false, "H"],
  ["SY", "Arab Bank – Syria", "Levant", "Subsidiary – bank", 2, false, "H"],
  ["AE", "Arab Bank – UAE", "GCC", "Foreign branch", 1, false, "M"],
  ["BH", "Arab Bank – Bahrain", "GCC", "Foreign branch", 2, false, "M"],
  ["QA", "Arab Bank – Qatar", "GCC", "Foreign branch", 2, false, "M"],
  ["SA", "Arab National Bank (affiliate)", "GCC", "Affiliate", 2, false, "M"],
  ["OM", "Oman Arab Bank (affiliate)", "GCC", "Affiliate", 2, false, "M"],
  ["IQ", "Arab Bank Iraq", "Iraq and Yemen", "Subsidiary – bank", 2, false, "H"],
  ["YE", "Arab Bank – Yemen", "Iraq and Yemen", "Foreign branch", 3, false, "H"],
  ["EG", "Arab Bank – Egypt", "North Africa", "Foreign branch", 1, false, "M"],
  ["DZ", "Arab Bank – Algeria", "North Africa", "Foreign branch", 2, false, "M"],
  ["MA", "Arab Bank – Morocco", "North Africa", "Foreign branch", 3, false, "M"],
  ["TN", "Arab Tunisian Bank", "North Africa", "Subsidiary – bank", 2, false, "M"],
  ["SD", "Arab Sudanese Bank", "North Africa", "Subsidiary – bank", 3, false, "H"],
  ["GB", "Europe Arab Bank – United Kingdom", "Europe", "Subsidiary – bank", 1, false, "L"],
  ["FR", "Arab Bank – France", "Europe", "Foreign branch", 2, false, "L"],
  ["DE", "Arab Bank – Germany", "Europe", "Foreign branch", 3, false, "L"],
  ["IT", "Arab Bank – Italy", "Europe", "Foreign branch", 3, false, "L"],
  ["CH", "Arab Bank (Switzerland)", "Europe", "Sister company", 1, false, "L"],
  ["SG", "Arab Bank – Singapore", "Asia-Pacific", "Foreign branch", 2, false, "L"],
  ["CN", "Arab Bank – China", "Asia-Pacific", "Foreign branch", 3, false, "L"],
  ["AU", "Arab Bank Australia", "Asia-Pacific", "Subsidiary – bank", 2, false, "L"],
  ["US", "Arab Bank – United States", "Americas", "Foreign branch", 3, false, "L"],
].map(([code, name, region, type, tier, islamic, profile]) => ({ code, name, region, type, tier, islamic, profile }));

// id, name, key, frequency, applies-to, [[risk, contribution weight], ...]
export const CONTROLS = [
  ["CTL-KYC-01", "Customer due diligence and ID verification at onboarding", "Y", "Event-driven", "All", [["FC-01", 3], ["FC-02", 2], ["FC-06", 2], ["FC-07", 1]]],
  ["CTL-KYC-02", "Enhanced due diligence for high-risk customers and PEPs", "Y", "Event-driven", "All", [["FC-01", 3], ["FC-02", 2], ["FC-05", 2]]],
  ["CTL-KYC-03", "Ultimate beneficial owner identification and verification", "Y", "Event-driven", "All", [["FC-01", 2], ["FC-03", 2], ["FC-04", 1], ["FC-07", 2]]],
  ["CTL-KYC-04", "Periodic KYC review by customer risk rating", "Y", "Monthly", "All", [["FC-01", 2], ["FC-02", 1], ["FC-07", 1]]],
  ["CTL-CRR-01", "Customer risk rating model and annual validation", "N", "Annual", "All", [["FC-01", 1], ["FC-02", 1]]],
  ["CTL-TM-01", "Automated transaction monitoring scenarios and tuning", "Y", "Continuous", "Banks only", [["FC-01", 3], ["FC-02", 2], ["FC-06", 1]]],
  ["CTL-TM-02", "Alert investigation and quality assurance within SLA", "Y", "Daily", "All", [["FC-01", 2], ["FC-02", 2]]],
  ["CTL-STR-01", "STR decision and filing within regulatory deadline", "Y", "Event-driven", "All", [["FC-01", 2], ["FC-02", 2], ["RC-01", 1]]],
  ["CTL-SAN-01", "Real-time payment sanctions screening", "Y", "Continuous", "All", [["FC-04", 3], ["FC-03", 2], ["FC-02", 1]]],
  ["CTL-SAN-02", "Customer and counterparty screening", "Y", "Continuous", "All", [["FC-04", 2], ["FC-03", 1], ["FC-02", 2]]],
  ["CTL-SAN-03", "Sanctions list updates applied within 24 hours", "N", "Daily", "All", [["FC-04", 1]]],
  ["CTL-TF-01", "NPO and charity enhanced due diligence", "N", "Event-driven", "All", [["FC-02", 2]]],
  ["CTL-TBML-01", "Trade-based ML red-flag review and pricing checks", "Y", "Event-driven", "Banks only", [["FC-01", 1], ["FC-03", 2]]],
  ["CTL-PF-01", "Dual-use goods, vessel and port screening", "Y", "Event-driven", "Banks only", [["FC-03", 3], ["FC-04", 1]]],
  ["CTL-CB-01", "Correspondent bank due diligence and nesting detection", "Y", "Annual", "Banks only", [["FC-01", 2], ["FC-04", 1], ["FC-02", 1]]],
  ["CTL-PAY-01", "Payment transparency checks (FATF R.16)", "N", "Continuous", "Banks only", [["FC-04", 1], ["FC-01", 1], ["FC-02", 1]]],
  ["CTL-ABC-01", "Third-party and intermediary anti-bribery due diligence", "Y", "Event-driven", "All", [["FC-05", 3], ["ER-06", 1]]],
  ["CTL-ABC-02", "Gifts, hospitality and donations register", "N", "Event-driven", "All", [["FC-05", 2]]],
  ["CTL-FRD-01", "Real-time fraud monitoring for cards and digital channels", "Y", "Continuous", "Banks only", [["FC-06", 3]]],
  ["CTL-FRD-02", "Maker-checker on payments and static data", "Y", "Daily", "All", [["FC-06", 2], ["ER-04", 2]]],
  ["CTL-FRD-03", "Mandatory leave and rotation for sensitive roles", "N", "Annual", "All", [["FC-06", 1], ["FC-05", 1]]],
  ["CTL-TAX-01", "FATCA/CRS self-certification and classification", "Y", "Event-driven", "All", [["FC-07", 3]]],
  ["CTL-TAX-02", "FATCA/CRS reporting reconciliation and filing", "N", "Annual", "All", [["FC-07", 2], ["RC-01", 1]]],
  ["CTL-TRN-01", "Annual AML, sanctions and anti-bribery training", "N", "Annual", "All", [["FC-01", 1], ["FC-04", 1], ["FC-05", 1]]],
  ["CTL-REG-01", "Regulatory change management and obligations register", "Y", "Monthly", "All", [["RC-01", 3]]],
  ["CTL-REG-02", "Regulatory return review and senior sign-off", "Y", "Monthly", "All", [["RC-01", 2]]],
  ["CTL-CON-01", "New product approval and suitability assessment", "Y", "Event-driven", "All", [["RC-02", 3]]],
  ["CTL-CON-02", "Complaints handling and root-cause analysis", "N", "Monthly", "All", [["RC-02", 2], ["ER-08", 1]]],
  ["CTL-DP-01", "Data protection impact assessments and records", "Y", "Event-driven", "All", [["RC-03", 2]]],
  ["CTL-DP-02", "Data loss prevention and access recertification", "Y", "Quarterly", "All", [["RC-03", 2], ["ER-05", 1]]],
  ["CTL-SH-01", "Shariah review of products and income purification", "Y", "Quarterly", "Islamic only", [["RC-04", 3]]],
  ["CTL-CR-01", "Credit approval authorities and committee review", "Y", "Event-driven", "All", [["ER-01", 3]]],
  ["CTL-CR-02", "Collateral valuation and exposure limit monitoring", "N", "Monthly", "All", [["ER-01", 2]]],
  ["CTL-MR-01", "Market risk limits and daily VaR monitoring", "Y", "Daily", "All", [["ER-02", 3]]],
  ["CTL-LQ-01", "Liquidity buffers, LCR/NSFR and contingency funding plan", "Y", "Daily", "All", [["ER-03", 3]]],
  ["CTL-OR-01", "Business continuity plans and annual testing", "Y", "Annual", "All", [["ER-04", 2], ["ER-05", 1]]],
  ["CTL-OR-02", "Operational loss event capture and RCSA", "N", "Quarterly", "All", [["ER-04", 2]]],
  ["CTL-CY-01", "Vulnerability and patch management", "Y", "Monthly", "All", [["ER-05", 3]]],
  ["CTL-CY-02", "Privileged access management and SOC monitoring", "Y", "Continuous", "All", [["ER-05", 2], ["FC-06", 1]]],
  ["CTL-TP-01", "Critical vendor due diligence and exit plans", "Y", "Annual", "All", [["ER-06", 3]]],
  ["CTL-LG-01", "Legal review of contracts and litigation register", "Y", "Event-driven", "All", [["ER-07", 3]]],
  ["CTL-RP-01", "Media monitoring and reputational-risk escalation", "Y", "Daily", "All", [["ER-08", 2]]],
  ["CTL-ST-01", "Strategy execution monitoring and E&S screening of lending", "Y", "Quarterly", "All", [["ER-09", 3]]],
].map(([id, name, key, freq, applies, maps]) => ({ id, name, key: key === "Y", freq, applies, maps }));

// Default configuration (editable by the Group CCO in Settings)
export const DEFAULT_CONFIG = {
  asOf: "2026-09-30",
  cycle: "EWRA 2026",
  // residual matrix: inherent (1–5) → residual for control environment 1..4 (§10.4)
  matrix: { 5: [3, 4, 5, 5], 4: [2, 3, 4, 4], 3: [1, 2, 3, 3], 2: [1, 1, 2, 2], 1: [1, 1, 1, 1] },
  keyCap: 3, // any key control ineffective → environment no better than Partially effective
  // months to next test: [Tier 1, Tier 2, Tier 3] (§11.1)
  intervals: { eff: [6, 12, 12], mid: [3, 6, 6], ineff: [3, 3, 4], nonkey: [12, 12, 24] },
  appetite: Object.fromEntries(RISKS.map(r => [r.code, r.max])),
};

export const entity = code => ENTITIES.find(e => e.code === code);
export const risk = code => RISKS.find(r => r.code === code);
export const control = id => CONTROLS.find(c => c.id === id);
