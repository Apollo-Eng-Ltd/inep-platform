// Plain (non-"use client") module so these lists can be imported by both the
// server page (page.tsx) and the client component (dashboard-client.tsx) —
// a "use client" file's runtime exports can't be used as plain values from
// server code, only its React components can cross that boundary.

/** Hero-row indicators — six-year real trend series each. */
export const EPRA_HERO_SLUGS = [
  "energy_generated_gwh",
  "renewable_share_pct",
  "peak_demand_mw",
  "tou_savings_kes_m",
  "lpg_demand_growth_pct",
  "petroleum_demand_growth_pct",
] as const;

/** Generation mix by source — one current-year snapshot each. */
export const EPRA_MIX_SLUGS = [
  "mix_geothermal_mw",
  "mix_hydro_mw",
  "mix_wind_mw",
  "mix_solar_mw",
  "mix_thermal_mw",
  "mix_imports_mw",
] as const;

/** Monthly actual/target for the current FY — period_year 1-12 = month order. */
export const EPRA_MONTHLY_SLUGS = ["monthly_generation_gwh", "monthly_generation_target_gwh"] as const;

// ---- Overview tab -------------------------------------------------------------
export const GDP_GROWTH_SLUG = "gdp_growth_pct";
export const PER_CAPITA_CONSUMPTION_SLUG = "per_capita_consumption_kwh";

// ---- Electricity tab --------------------------------------------------------
export const ELECTRICITY_RELIABILITY_SLUGS = ["system_losses_pct", "saidi_hours", "saifi_count", "hhi_index", "ghg_emissions_mtco2e"] as const;
export const ELECTRICITY_TARIFF_SLUG = "avg_tariff_trend_kes_kwh";
export const DAILY_DEMAND_SLUG = "daily_demand_profile_mw";
export const FINAL_CONSUMPTION_SLUGS = [
  "final_consumption_residential_gwh",
  "final_consumption_commercial_gwh",
  "final_consumption_industrial_gwh",
  "final_consumption_transport_gwh",
] as const;

// ---- Renewable Energy tab ----------------------------------------------------
export const RENEWABLE_MIX_SLUGS = ["mix_geothermal_mw", "mix_hydro_mw", "mix_wind_mw", "mix_solar_mw"] as const;
export const RENEWABLE_GEN_SLUGS = ["gen_geothermal_gwh", "gen_hydro_gwh", "gen_wind_gwh", "gen_solar_gwh"] as const;
export const EAC_ACCESS_SLUGS = ["eac_access_kenya", "eac_access_uganda", "eac_access_tanzania", "eac_access_rwanda", "eac_access_ethiopia"] as const;

// ---- Efficiency tab -----------------------------------------------------------
export const EFFICIENCY_APPLIANCE_SLUG = "avg_appliance_star_rating";

// ---- Petroleum tab --------------------------------------------------------------
export const PETROLEUM_TREND_SLUGS = ["petroleum_import_volume_kt", "pipeline_throughput_kt", "crude_oil_price_usd_bbl"] as const;
export const PUMP_PRICE_SLUGS = ["pump_price_petrol_kes_l", "pump_price_diesel_kes_l", "pump_price_kerosene_kes_l"] as const;
export const OMC_SHARE_SLUGS = ["omc_share_vivo", "omc_share_totalenergies", "omc_share_rubis", "omc_share_ola", "omc_share_others"] as const;

// ---- LPG tab ------------------------------------------------------------------
export const LPG_TREND_SLUG = "lpg_import_volume_kt";
export const LPG_MONTHLY_SLUGS = ["lpg_consumption_kt", "lpg_consumption_target_kt"] as const;
export const LPG_ROUTE_SLUGS = ["lpg_import_route_mombasa_pct", "lpg_import_route_overland_pct"] as const;
export const LPG_STORAGE_SLUGS = ["storage_mombasa_kt", "storage_nairobi_kt", "storage_kisumu_kt", "storage_nakuru_kt", "storage_eldoret_kt"] as const;

// ---- Consumer Protection tab -----------------------------------------------------
export const CONSUMER_PROTECTION_SLUGS = ["licensing_volume", "compliance_rate_pct", "complaints_resolved_pct"] as const;

/** Every EPRA-sourced slug this dashboard reads — the fetch scope in page.tsx. */
export const EPRA_SLUGS = [
  ...EPRA_HERO_SLUGS,
  ...EPRA_MIX_SLUGS,
  ...EPRA_MONTHLY_SLUGS,
  GDP_GROWTH_SLUG,
  PER_CAPITA_CONSUMPTION_SLUG,
  ...ELECTRICITY_RELIABILITY_SLUGS,
  ELECTRICITY_TARIFF_SLUG,
  DAILY_DEMAND_SLUG,
  ...FINAL_CONSUMPTION_SLUGS,
  ...RENEWABLE_GEN_SLUGS,
  ...EAC_ACCESS_SLUGS,
  EFFICIENCY_APPLIANCE_SLUG,
  ...PETROLEUM_TREND_SLUGS,
  ...PUMP_PRICE_SLUGS,
  ...OMC_SHARE_SLUGS,
  LPG_TREND_SLUG,
  ...LPG_MONTHLY_SLUGS,
  ...LPG_ROUTE_SLUGS,
  ...LPG_STORAGE_SLUGS,
  ...CONSUMER_PROTECTION_SLUGS,
] as const;

export const FY_MONTH_LABELS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
export const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
