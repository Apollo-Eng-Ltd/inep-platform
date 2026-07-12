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
// gps_lat/gps_lng are city-level HQ coordinates (all five are genuinely
// Nairobi-headquartered), not exact building/facility GPS — precision noted
// wherever these are surfaced on the point map.
export const PROVIDERS: { code: string; name: string; region: string; gps_lat: number; gps_lng: number }[] = [
  { code: "KPLC", name: "Kenya Power & Lighting Company", region: "National", gps_lat: -1.2762, gps_lng: 36.8172 },
  { code: "KENGEN", name: "Kenya Electricity Generating Company", region: "National", gps_lat: -1.2833, gps_lng: 36.8172 },
  { code: "REREC", name: "Rural Electrification & Renewable Energy Corporation", region: "National", gps_lat: -1.2921, gps_lng: 36.8219 },
  { code: "KETRACO", name: "Kenya Electricity Transmission Company", region: "National", gps_lat: -1.2667, gps_lng: 36.8000 },
  { code: "GDC", name: "Geothermal Development Company", region: "National", gps_lat: -1.3, gps_lng: 36.78 },
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
// EPRA "Year at a Glance" indicators — national-level context figures, never
// tied to a county submission. Kept as a separate catalog from INDICATORS so
// they're never included in a county/provider/private submission's field
// list; they only ever appear as national_summaries rows with
// source = 'epra_national', same as the pre-existing avg_tariff_kwh/
// installed_capacity_mw EPRA figures.
// ---------------------------------------------------------------------------
export interface EpraIndicatorSeed {
  slug: string;
  name: string;
  unit: string;
  sector: string; // FK convenience only — these never appear on a submission form
  description: string;
}

export const EPRA_INDICATORS: EpraIndicatorSeed[] = [
  { slug: "energy_generated_gwh", name: "Energy Generated", unit: "GWh", sector: "electricity", description: "National electricity generation, EPRA Year at a Glance." },
  { slug: "renewable_share_pct", name: "Renewable Share of Capacity", unit: "%", sector: "electricity", description: "Renewable share of installed generation capacity, EPRA." },
  { slug: "peak_demand_mw", name: "Peak Demand", unit: "MW", sector: "electricity", description: "National system peak demand, EPRA." },
  { slug: "tou_savings_kes_m", name: "TOU Savings", unit: "KES M", sector: "efficiency", description: "Estimated consumer savings from time-of-use tariffs, EPRA." },
  { slug: "lpg_demand_growth_pct", name: "LPG Demand Growth", unit: "%", sector: "bioenergy", description: "Year-on-year growth in LPG consumption, EPRA." },
  { slug: "petroleum_demand_growth_pct", name: "Petroleum Demand Growth", unit: "%", sector: "resource_dev", description: "Year-on-year growth in petroleum products demand, EPRA." },

  // Generation mix by source — one snapshot each, installed capacity in MW.
  { slug: "mix_geothermal_mw", name: "Geothermal", unit: "MW", sector: "electricity", description: "Installed geothermal capacity, EPRA generation mix." },
  { slug: "mix_hydro_mw", name: "Hydro", unit: "MW", sector: "electricity", description: "Installed hydro capacity, EPRA generation mix." },
  { slug: "mix_wind_mw", name: "Wind", unit: "MW", sector: "electricity", description: "Installed wind capacity, EPRA generation mix." },
  { slug: "mix_solar_mw", name: "Solar", unit: "MW", sector: "electricity", description: "Installed solar capacity, EPRA generation mix." },
  { slug: "mix_thermal_mw", name: "Thermal", unit: "MW", sector: "electricity", description: "Installed thermal capacity, EPRA generation mix." },
  { slug: "mix_imports_mw", name: "Imports", unit: "MW", sector: "electricity", description: "Imported capacity / interconnection, EPRA generation mix." },

  // Monthly generation vs. target for the current financial year. There's no
  // month column anywhere in the schema, so — for these two indicators only —
  // national_summaries.period_year is repurposed to hold FY-month-order
  // (1 = Jul .. 12 = Jun), not a real calendar year. This encoding never
  // leaves the two queries that explicitly know about it.
  { slug: "monthly_generation_gwh", name: "Monthly Generation", unit: "GWh", sector: "electricity", description: "Monthly generation for the current FY, EPRA. period_year 1-12 = FY month order (Jul..Jun), not a calendar year." },
  { slug: "monthly_generation_target_gwh", name: "Monthly Generation Target", unit: "GWh", sector: "electricity", description: "EPRA's monthly generation benchmark for the current FY. Same period_year-as-month-order encoding." },

  // ---- Overview tab: growth-vs-economy context ----------------------------
  { slug: "gdp_growth_pct", name: "GDP Growth", unit: "%", sector: "electricity", description: "National GDP growth rate, for comparison against generation growth, EPRA/KNBS. National context." },
  { slug: "per_capita_consumption_kwh", name: "Per Capita Electricity Consumption", unit: "kWh", sector: "electricity", description: "National electricity consumption per capita, EPRA. National context." },

  // ---- Electricity tab: reliability, tariffs, market structure, emissions ----
  { slug: "system_losses_pct", name: "System Losses", unit: "%", sector: "electricity", description: "Transmission + distribution losses, EPRA. National context, not a county rollup." },
  { slug: "saidi_hours", name: "SAIDI", unit: "hrs/customer/yr", sector: "electricity", description: "System Average Interruption Duration Index, EPRA. National context." },
  { slug: "saifi_count", name: "SAIFI", unit: "interruptions/customer/yr", sector: "electricity", description: "System Average Interruption Frequency Index, EPRA. National context." },
  { slug: "avg_tariff_trend_kes_kwh", name: "Average Tariff", unit: "KES/kWh", sector: "electricity", description: "National average end-user tariff over time, EPRA. National context." },
  { slug: "hhi_index", name: "Market Concentration (HHI)", unit: "index (0-10,000)", sector: "electricity", description: "Herfindahl-Hirschman Index for the generation market, EPRA. National context." },
  { slug: "ghg_emissions_mtco2e", name: "Power Sector GHG Emissions", unit: "MtCO2e", sector: "electricity", description: "Grid emissions, EPRA. National context." },
  { slug: "daily_demand_profile_mw", name: "Daily Demand Profile", unit: "MW", sector: "electricity", description: "Typical-day hourly system demand, EPRA. period_year 0-23 = hour of day, not a calendar year. National context." },

  // Final consumption by category — one 6-year trend per category. Reused as
  // a current-year snapshot bar (Electricity tab) and as the multi-year trend
  // itself (Energy Balance tab), so the same real seeded series backs both.
  { slug: "final_consumption_residential_gwh", name: "Residential", unit: "GWh", sector: "electricity", description: "Final electricity consumption, residential category, EPRA. National context." },
  { slug: "final_consumption_commercial_gwh", name: "Commercial", unit: "GWh", sector: "electricity", description: "Final electricity consumption, commercial category, EPRA. National context." },
  { slug: "final_consumption_industrial_gwh", name: "Industrial", unit: "GWh", sector: "electricity", description: "Final electricity consumption, industrial category, EPRA. National context." },
  { slug: "final_consumption_transport_gwh", name: "Transport", unit: "GWh", sector: "electricity", description: "Final electricity consumption, transport category (e-mobility), EPRA. National context." },

  // ---- Renewable Energy tab: per-source generation trend + EAC comparison ---
  { slug: "gen_geothermal_gwh", name: "Geothermal Generation", unit: "GWh", sector: "electricity", description: "Geothermal generation over time, EPRA. National context." },
  { slug: "gen_hydro_gwh", name: "Hydro Generation", unit: "GWh", sector: "electricity", description: "Hydro generation over time, EPRA. National context." },
  { slug: "gen_wind_gwh", name: "Wind Generation", unit: "GWh", sector: "electricity", description: "Wind generation over time, EPRA. National context." },
  { slug: "gen_solar_gwh", name: "Solar Generation", unit: "GWh", sector: "electricity", description: "Solar generation over time, EPRA. National context." },
  { slug: "eac_access_kenya", name: "Kenya", unit: "%", sector: "electricity", description: "Electricity access rate, Kenya. EAC regional comparison, national context." },
  { slug: "eac_access_uganda", name: "Uganda", unit: "%", sector: "electricity", description: "Electricity access rate, Uganda. EAC regional comparison, national context." },
  { slug: "eac_access_tanzania", name: "Tanzania", unit: "%", sector: "electricity", description: "Electricity access rate, Tanzania. EAC regional comparison, national context." },
  { slug: "eac_access_rwanda", name: "Rwanda", unit: "%", sector: "electricity", description: "Electricity access rate, Rwanda. EAC regional comparison, national context." },
  { slug: "eac_access_ethiopia", name: "Ethiopia", unit: "%", sector: "electricity", description: "Electricity access rate, Ethiopia. EAC regional comparison, national context." },

  // ---- Efficiency tab -------------------------------------------------------
  { slug: "avg_appliance_star_rating", name: "Average Appliance Star Rating", unit: "stars", sector: "efficiency", description: "Average energy-label star rating of appliances sold, EPRA/KEBS. National context." },

  // ---- Petroleum tab ---------------------------------------------------------
  { slug: "petroleum_import_volume_kt", name: "Petroleum Import Volume", unit: "kt", sector: "resource_dev", description: "Refined petroleum products import volume, EPRA. National context." },
  { slug: "pipeline_throughput_kt", name: "Pipeline Throughput", unit: "kt", sector: "resource_dev", description: "Kenya Pipeline Company throughput, EPRA. National context." },
  { slug: "crude_oil_price_usd_bbl", name: "Crude Oil Price", unit: "USD/bbl", sector: "resource_dev", description: "Benchmark crude price, EPRA. National context." },
  { slug: "pump_price_petrol_kes_l", name: "Super Petrol Pump Price", unit: "KES/L", sector: "resource_dev", description: "EPRA-gazetted pump price, super petrol. National context." },
  { slug: "pump_price_diesel_kes_l", name: "Diesel Pump Price", unit: "KES/L", sector: "resource_dev", description: "EPRA-gazetted pump price, automotive diesel. National context." },
  { slug: "pump_price_kerosene_kes_l", name: "Kerosene Pump Price", unit: "KES/L", sector: "resource_dev", description: "EPRA-gazetted pump price, illuminating kerosene. National context." },
  { slug: "omc_share_vivo", name: "Vivo Energy (Shell)", unit: "%", sector: "resource_dev", description: "Oil marketing company market share, EPRA. National context." },
  { slug: "omc_share_totalenergies", name: "TotalEnergies", unit: "%", sector: "resource_dev", description: "Oil marketing company market share, EPRA. National context." },
  { slug: "omc_share_rubis", name: "Rubis Energy", unit: "%", sector: "resource_dev", description: "Oil marketing company market share, EPRA. National context." },
  { slug: "omc_share_ola", name: "Ola Energy", unit: "%", sector: "resource_dev", description: "Oil marketing company market share, EPRA. National context." },
  { slug: "omc_share_others", name: "Other OMCs", unit: "%", sector: "resource_dev", description: "Remaining oil marketing companies, combined market share, EPRA. National context." },

  // ---- LPG tab -----------------------------------------------------------------
  { slug: "lpg_import_volume_kt", name: "LPG Import Volume", unit: "kt", sector: "bioenergy", description: "LPG import volume over time, EPRA. National context." },
  { slug: "lpg_consumption_kt", name: "Monthly LPG Consumption", unit: "kt", sector: "bioenergy", description: "Monthly LPG consumption for the current FY, EPRA. period_year 1-12 = FY month order. National context." },
  { slug: "lpg_consumption_target_kt", name: "Monthly LPG Consumption Target", unit: "kt", sector: "bioenergy", description: "EPRA's monthly LPG consumption benchmark. Same month-order encoding. National context." },
  { slug: "lpg_import_route_mombasa_pct", name: "Mombasa Port", unit: "%", sector: "bioenergy", description: "Share of LPG imports landed at Mombasa, EPRA. National context." },
  { slug: "lpg_import_route_overland_pct", name: "Overland (Uganda/Tanzania)", unit: "%", sector: "bioenergy", description: "Share of LPG imports arriving overland, EPRA. National context." },
  { slug: "storage_mombasa_kt", name: "Mombasa", unit: "kt", sector: "bioenergy", description: "LPG storage capacity, Mombasa depot, EPRA. National context." },
  { slug: "storage_nairobi_kt", name: "Nairobi", unit: "kt", sector: "bioenergy", description: "LPG storage capacity, Nairobi depot, EPRA. National context." },
  { slug: "storage_kisumu_kt", name: "Kisumu", unit: "kt", sector: "bioenergy", description: "LPG storage capacity, Kisumu depot, EPRA. National context." },
  { slug: "storage_nakuru_kt", name: "Nakuru", unit: "kt", sector: "bioenergy", description: "LPG storage capacity, Nakuru depot, EPRA. National context." },
  { slug: "storage_eldoret_kt", name: "Eldoret", unit: "kt", sector: "bioenergy", description: "LPG storage capacity, Eldoret depot, EPRA. National context." },

  // ---- Consumer Protection tab -------------------------------------------------
  { slug: "licensing_volume", name: "Licenses Issued", unit: "licenses", sector: "resource_dev", description: "Energy sector licenses issued by EPRA per year. National context." },
  { slug: "compliance_rate_pct", name: "Compliance Rate", unit: "%", sector: "resource_dev", description: "Licensee compliance rate on inspection, EPRA. National context." },
  { slug: "complaints_resolved_pct", name: "Complaints Resolved", unit: "%", sector: "resource_dev", description: "Consumer complaints resolved within SLA, EPRA. National context." },
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
  { email: "makueni.committee@inep.go.ke", full_name: "Peter Mwangi (Makueni Energy Planning Committee)", role: "committee_member", submitter_code: "017" },
  { email: "makueni@inep.go.ke", full_name: "Mary Mwikali (Makueni Energy Officer)", role: "county_officer", submitter_code: "017" },
  { email: "nairobi@inep.go.ke", full_name: "John Kamau (Nairobi Energy Officer)", role: "county_officer", submitter_code: "047" },
];
