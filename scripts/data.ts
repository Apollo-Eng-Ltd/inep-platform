// Reference data for the INEP seed: counties, providers, private-sector orgs,
// energy sectors, indicators, and the approval-chain stages.
// Kept separate from the seeding logic so the shapes are easy to read/edit.

export type SectorSeed = {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
};

export type IndicatorSeed = {
  sector: string; // sector slug
  slug: string;
  name: string;
  unit: string;
  expected_min: number;
  expected_max: number;
  // baseline national-ish magnitude used to synthesise plausible county numbers
  base: number;
  // 'absolute' scales with county size; 'percent' is a 0..100 rate
  kind: "absolute" | "percent";
  description: string;
  sort_order: number;
};

export type StageSeed = {
  submitter_type: "county" | "national_provider" | "private_sector";
  stage_key: string;
  name: string;
  description: string;
  sort_order: number;
  is_terminal: boolean;
};

// ---------------------------------------------------------------------------
// 47 counties, official Kenya county codes (001–047), with a rough size factor
// (loosely population-weighted) used to scale absolute indicator values.
// ---------------------------------------------------------------------------
export const COUNTIES: { code: string; name: string; region: string; factor: number }[] = [
  { code: "001", name: "Mombasa", region: "Coast", factor: 1.9 },
  { code: "002", name: "Kwale", region: "Coast", factor: 0.9 },
  { code: "003", name: "Kilifi", region: "Coast", factor: 1.5 },
  { code: "004", name: "Tana River", region: "Coast", factor: 0.4 },
  { code: "005", name: "Lamu", region: "Coast", factor: 0.2 },
  { code: "006", name: "Taita Taveta", region: "Coast", factor: 0.4 },
  { code: "007", name: "Garissa", region: "North Eastern", factor: 0.7 },
  { code: "008", name: "Wajir", region: "North Eastern", factor: 0.8 },
  { code: "009", name: "Mandera", region: "North Eastern", factor: 0.9 },
  { code: "010", name: "Marsabit", region: "Eastern", factor: 0.5 },
  { code: "011", name: "Isiolo", region: "Eastern", factor: 0.3 },
  { code: "012", name: "Meru", region: "Eastern", factor: 1.6 },
  { code: "013", name: "Tharaka-Nithi", region: "Eastern", factor: 0.5 },
  { code: "014", name: "Embu", region: "Eastern", factor: 0.7 },
  { code: "015", name: "Kitui", region: "Eastern", factor: 1.3 },
  { code: "016", name: "Machakos", region: "Eastern", factor: 1.5 },
  { code: "017", name: "Makueni", region: "Eastern", factor: 1.2 },
  { code: "018", name: "Nyandarua", region: "Central", factor: 0.8 },
  { code: "019", name: "Nyeri", region: "Central", factor: 0.9 },
  { code: "020", name: "Kirinyaga", region: "Central", factor: 0.8 },
  { code: "021", name: "Murang'a", region: "Central", factor: 1.2 },
  { code: "022", name: "Kiambu", region: "Central", factor: 2.6 },
  { code: "023", name: "Turkana", region: "Rift Valley", factor: 1.1 },
  { code: "024", name: "West Pokot", region: "Rift Valley", factor: 0.7 },
  { code: "025", name: "Samburu", region: "Rift Valley", factor: 0.4 },
  { code: "026", name: "Trans Nzoia", region: "Rift Valley", factor: 1.0 },
  { code: "027", name: "Uasin Gishu", region: "Rift Valley", factor: 1.3 },
  { code: "028", name: "Elgeyo-Marakwet", region: "Rift Valley", factor: 0.5 },
  { code: "029", name: "Nandi", region: "Rift Valley", factor: 0.9 },
  { code: "030", name: "Baringo", region: "Rift Valley", factor: 0.7 },
  { code: "031", name: "Laikipia", region: "Rift Valley", factor: 0.6 },
  { code: "032", name: "Nakuru", region: "Rift Valley", factor: 2.3 },
  { code: "033", name: "Narok", region: "Rift Valley", factor: 1.2 },
  { code: "034", name: "Kajiado", region: "Rift Valley", factor: 1.2 },
  { code: "035", name: "Kericho", region: "Rift Valley", factor: 1.0 },
  { code: "036", name: "Bomet", region: "Rift Valley", factor: 0.9 },
  { code: "037", name: "Kakamega", region: "Western", factor: 2.0 },
  { code: "038", name: "Vihiga", region: "Western", factor: 0.6 },
  { code: "039", name: "Bungoma", region: "Western", factor: 1.8 },
  { code: "040", name: "Busia", region: "Western", factor: 0.9 },
  { code: "041", name: "Siaya", region: "Nyanza", factor: 1.0 },
  { code: "042", name: "Kisumu", region: "Nyanza", factor: 1.3 },
  { code: "043", name: "Homa Bay", region: "Nyanza", factor: 1.2 },
  { code: "044", name: "Migori", region: "Nyanza", factor: 1.1 },
  { code: "045", name: "Kisii", region: "Nyanza", factor: 1.3 },
  { code: "046", name: "Nyamira", region: "Nyanza", factor: 0.7 },
  { code: "047", name: "Nairobi", region: "Nairobi", factor: 3.0 },
];

// A few wards per county are enough to demo ward-level participation.
export const SAMPLE_WARDS: Record<string, { sub_county: string; name: string }[]> = {
  Makueni: [
    { sub_county: "Makueni", name: "Wote" },
    { sub_county: "Kibwezi West", name: "Makindu" },
    { sub_county: "Kilome", name: "Kasikeu" },
  ],
  Nairobi: [
    { sub_county: "Westlands", name: "Parklands" },
    { sub_county: "Embakasi South", name: "Imara Daima" },
    { sub_county: "Dagoretti North", name: "Kilimani" },
  ],
};

// ---------------------------------------------------------------------------
// National energy service providers
// ---------------------------------------------------------------------------
export const PROVIDERS: { code: string; name: string; region: string }[] = [
  { code: "KPLC", name: "Kenya Power & Lighting Company", region: "National" },
  { code: "KENGEN", name: "Kenya Electricity Generating Company", region: "National" },
  { code: "REREC", name: "Rural Electrification & Renewable Energy Corporation", region: "National" },
  { code: "KETRACO", name: "Kenya Electricity Transmission Company", region: "National" },
  { code: "GDC", name: "Geothermal Development Company", region: "National" },
];

// ---------------------------------------------------------------------------
// Private sector / PBO organizations (Annex-5 reporters)
// ---------------------------------------------------------------------------
export const PRIVATE_ORGS: {
  code: string;
  name: string;
  region: string;
  profile: Record<string, unknown>;
}[] = [
  {
    code: "MKOPA",
    name: "M-KOPA Solar",
    region: "Nairobi",
    profile: {
      registration_no: "PVT-2011-0042",
      project_name: "Pay-as-you-go Solar Home Systems",
      partners: ["Sunrun", "CommercialBank of Africa"],
      project_cost_kes_m: 1800,
      gps_lat: -1.2921,
      gps_lng: 36.8219,
      scope: "Off-grid solar for low-income households",
    },
  },
  {
    code: "DLIGHT",
    name: "d.light Design",
    region: "Nairobi",
    profile: {
      registration_no: "PVT-2010-0311",
      project_name: "Solar Lanterns & Home Systems",
      partners: ["IFC", "KfW"],
      project_cost_kes_m: 950,
      gps_lat: -1.3009,
      gps_lng: 36.7789,
      scope: "Solar lighting distribution",
    },
  },
  {
    code: "BASIGO",
    name: "BasiGo",
    region: "Nairobi",
    profile: {
      registration_no: "PVT-2021-0777",
      project_name: "Electric Bus Deployment",
      partners: ["Kenya Power", "Trigger"],
      project_cost_kes_m: 640,
      gps_lat: -1.319,
      gps_lng: 36.851,
      scope: "E-mobility, electric public transport",
    },
  },
  {
    code: "SUNKING",
    name: "Sun King (Greenlight Planet)",
    region: "Kisumu",
    profile: {
      registration_no: "PVT-2012-0190",
      project_name: "Off-grid Solar Financing",
      partners: ["Stanbic Bank"],
      project_cost_kes_m: 1200,
      gps_lat: -0.0917,
      gps_lng: 34.768,
      scope: "Household solar financing in western Kenya",
    },
  },
  {
    code: "SUNCULTURE",
    name: "SunCulture",
    region: "Machakos",
    profile: {
      registration_no: "PVT-2013-0455",
      project_name: "Solar Irrigation Systems",
      partners: ["Acumen", "USAID"],
      project_cost_kes_m: 520,
      gps_lat: -1.517,
      gps_lng: 37.263,
      scope: "Solar-powered agricultural water pumping",
    },
  },
];

// ---------------------------------------------------------------------------
// Sectors (mirror the five national sub-committees)
// ---------------------------------------------------------------------------
export const SECTORS: SectorSeed[] = [
  { slug: "electricity", name: "Electricity", description: "Grid connections, capacity, tariffs", sort_order: 1 },
  { slug: "energy_access", name: "Energy Access", description: "Off-grid, mini-grids, clean cooking", sort_order: 2 },
  { slug: "bioenergy", name: "Bio-energy", description: "Biogas, cookstoves, biomass", sort_order: 3 },
  { slug: "efficiency", name: "Efficiency & Conservation", description: "Audits, retrofits, savings", sort_order: 4 },
  { slug: "resource_dev", name: "Resource & Development", description: "Studies, budgets, capacity", sort_order: 5 },
];

// ---------------------------------------------------------------------------
// Indicators — the standard fields every submission reports
// ---------------------------------------------------------------------------
export const INDICATORS: IndicatorSeed[] = [
  // Electricity
  { sector: "electricity", slug: "grid_connections", name: "Households connected to grid", unit: "households", expected_min: 0, expected_max: 2_000_000, base: 90_000, kind: "absolute", description: "Total households with a grid connection", sort_order: 1 },
  { sector: "electricity", slug: "electricity_access_pct", name: "Electricity access rate", unit: "%", expected_min: 0, expected_max: 100, base: 62, kind: "percent", description: "Share of households with electricity", sort_order: 2 },
  { sector: "electricity", slug: "installed_capacity_mw", name: "Installed capacity", unit: "MW", expected_min: 0, expected_max: 1000, base: 45, kind: "absolute", description: "Generation capacity installed in-county", sort_order: 3 },
  { sector: "electricity", slug: "avg_tariff_kwh", name: "Average tariff", unit: "KES/kWh", expected_min: 5, expected_max: 45, base: 23, kind: "percent", description: "Average end-user tariff", sort_order: 4 },
  { sector: "electricity", slug: "transformers_installed", name: "Transformers installed", unit: "units", expected_min: 0, expected_max: 5000, base: 320, kind: "absolute", description: "Distribution transformers in service", sort_order: 5 },

  // Energy access
  { sector: "energy_access", slug: "solar_home_systems", name: "Solar home systems", unit: "systems", expected_min: 0, expected_max: 500_000, base: 18_000, kind: "absolute", description: "Off-grid solar home systems in use", sort_order: 1 },
  { sector: "energy_access", slug: "mini_grids", name: "Mini-grids", unit: "sites", expected_min: 0, expected_max: 200, base: 6, kind: "absolute", description: "Operational mini-grid sites", sort_order: 2 },
  { sector: "energy_access", slug: "clean_cooking_pct", name: "Clean cooking access", unit: "%", expected_min: 0, expected_max: 100, base: 28, kind: "percent", description: "Share of households using clean cooking", sort_order: 3 },
  { sector: "energy_access", slug: "population_served", name: "Population served (access programs)", unit: "people", expected_min: 0, expected_max: 5_000_000, base: 240_000, kind: "absolute", description: "People reached by access programs", sort_order: 4 },

  // Bio-energy
  { sector: "bioenergy", slug: "biogas_digesters", name: "Biogas digesters", unit: "units", expected_min: 0, expected_max: 50_000, base: 1_100, kind: "absolute", description: "Installed biogas digesters", sort_order: 1 },
  { sector: "bioenergy", slug: "improved_cookstoves", name: "Improved cookstoves", unit: "units", expected_min: 0, expected_max: 1_000_000, base: 42_000, kind: "absolute", description: "Improved cookstoves distributed", sort_order: 2 },
  { sector: "bioenergy", slug: "firewood_dependency_pct", name: "Firewood dependency", unit: "%", expected_min: 0, expected_max: 100, base: 55, kind: "percent", description: "Share of households relying on firewood", sort_order: 3 },

  // Efficiency & conservation
  { sector: "efficiency", slug: "energy_audits_done", name: "Energy audits completed", unit: "audits", expected_min: 0, expected_max: 1000, base: 22, kind: "absolute", description: "Energy audits carried out", sort_order: 1 },
  { sector: "efficiency", slug: "street_lights_led", name: "LED street lights", unit: "units", expected_min: 0, expected_max: 100_000, base: 3_400, kind: "absolute", description: "Public LED street lights installed", sort_order: 2 },
  { sector: "efficiency", slug: "efficiency_savings_gwh", name: "Efficiency savings", unit: "GWh", expected_min: 0, expected_max: 500, base: 12, kind: "absolute", description: "Energy saved through efficiency measures", sort_order: 3 },

  // Resource & development
  { sector: "resource_dev", slug: "feasibility_studies", name: "Feasibility studies", unit: "studies", expected_min: 0, expected_max: 100, base: 4, kind: "absolute", description: "Energy feasibility studies completed", sort_order: 1 },
  { sector: "resource_dev", slug: "rd_budget_kes_m", name: "Energy budget", unit: "KES millions", expected_min: 0, expected_max: 2000, base: 85, kind: "absolute", description: "County energy budget allocation", sort_order: 2 },
  { sector: "resource_dev", slug: "staff_trained", name: "Staff trained", unit: "people", expected_min: 0, expected_max: 5000, base: 40, kind: "absolute", description: "Energy staff trained in the period", sort_order: 3 },
];

// ---------------------------------------------------------------------------
// Approval-chain stages, one ordered set per submitter type
// ---------------------------------------------------------------------------
export const STAGES: StageSeed[] = [
  // County chain
  { submitter_type: "county", stage_key: "draft", name: "Draft", description: "County officer prepares the plan", sort_order: 0, is_terminal: false },
  { submitter_type: "county", stage_key: "committee_review", name: "Committee Review", description: "County Energy Planning Committee", sort_order: 1, is_terminal: false },
  { submitter_type: "county", stage_key: "executive_approval", name: "Executive Approval", description: "County Executive Committee", sort_order: 2, is_terminal: false },
  { submitter_type: "county", stage_key: "assembly_approval", name: "Assembly Approval", description: "County Assembly sign-off", sort_order: 3, is_terminal: false },
  { submitter_type: "county", stage_key: "published", name: "Published", description: "Public website + sent to national", sort_order: 4, is_terminal: true },

  // National provider chain
  { submitter_type: "national_provider", stage_key: "draft", name: "Draft", description: "Provider prepares the plan", sort_order: 0, is_terminal: false },
  { submitter_type: "national_provider", stage_key: "technical_review", name: "Technical Review", description: "Technical sub-committee review", sort_order: 1, is_terminal: false },
  { submitter_type: "national_provider", stage_key: "committee_review", name: "Committee Review", description: "Full national committee", sort_order: 2, is_terminal: false },
  { submitter_type: "national_provider", stage_key: "approved", name: "Approved", description: "Cabinet Secretary sign-off", sort_order: 3, is_terminal: false },
  { submitter_type: "national_provider", stage_key: "published", name: "Published", description: "Consolidated into national plan", sort_order: 4, is_terminal: true },

  // Private sector / PBO chain
  { submitter_type: "private_sector", stage_key: "draft", name: "Draft", description: "Organization prepares the report", sort_order: 0, is_terminal: false },
  { submitter_type: "private_sector", stage_key: "validation_review", name: "Validation Review", description: "National planner validates the report", sort_order: 1, is_terminal: false },
  { submitter_type: "private_sector", stage_key: "approved", name: "Approved", description: "Accepted into national picture", sort_order: 2, is_terminal: false },
  { submitter_type: "private_sector", stage_key: "published", name: "Published", description: "Included in national dashboard", sort_order: 3, is_terminal: true },
];

// Demo login accounts (documented so the user can sign in immediately).
export const DEMO_PASSWORD = "Inep2026!";
export const DEMO_USERS: {
  email: string;
  full_name: string;
  role: "county_officer" | "national_planner" | "admin" | "committee_member";
  submitter_code?: string; // links a submitter by code
}[] = [
  { email: "admin@inep.go.ke", full_name: "System Administrator", role: "admin" },
  { email: "planner@inep.go.ke", full_name: "Grace Wanjiru (National Planner)", role: "national_planner" },
  { email: "committee@inep.go.ke", full_name: "David Otieno (Committee Member)", role: "committee_member" },
  { email: "makueni@inep.go.ke", full_name: "Mary Mwikali (Makueni Energy Officer)", role: "county_officer", submitter_code: "017" },
  { email: "nairobi@inep.go.ke", full_name: "John Kamau (Nairobi Energy Officer)", role: "county_officer", submitter_code: "047" },
];
