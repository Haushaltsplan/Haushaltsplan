"""
SEC EDGAR XBRL data-quality checks for annual (10-K / 20-F) pandas frames.

Designed to sit *after* edgar-tools / sec-edgar-downloader / sec-api have
already produced a year-indexed DataFrame. It does not fetch filings.

Known failure modes this module is built for (same classes we already
fight in the TypeScript SEC pipeline):

  * Gross-vs-net revenue (ASC 606 / customer incentives) — Mastercard/Visa
    tagging ``us-gaap:Revenues`` pre-rebate vs net interchange.
  * Weighted-average shares in mixed XBRL units (ones vs thousands vs millions)
    and unadjusted split jumps.
  * Isolated GAAP/tax distortions (TCJA 2017).
  * Broken accounting identities (FCF, balance-sheet equation, EBITDA).

Usage::

    from sec_data_validator import validate_sec_dataframe, validate_sec_csv

    clean, report = validate_sec_dataframe(df)
    print(report.summary())
    cagr_ok = clean.loc[~clean["exclude_from_cagr"]]
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Literal, Mapping

import numpy as np
import pandas as pd

Category = Literal["DATA_FEED_ERRORS", "ACCOUNTING_SHIFTS", "ONE_TIME_EFFECTS"]
Severity = Literal["info", "warn", "error"]

# --- thresholds (tune via ValidateConfig) ---------------------------------

ASC606_EFFECTIVE_YEARS = frozenset({2017, 2018, 2019})
TCJA_YEARS = frozenset({2017, 2018})

# Share YoY ratios treated as unit glitches, not economics.
UNIT_RATIO_TARGETS = (10.0, 100.0, 1000.0, 0.1, 0.01, 0.001)


# Column aliases accepted from edgar-tools / companyfacts / custom CSVs.
COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "year": ("year", "fy", "fiscal_year", "fiscalyear", "period_end_year", "date"),
    "revenue": (
        "revenue",
        "revenues",
        "sales",
        "netsales",
        "totalrevenue",
        "umsatz",
        "revenuefromcontractwithcustomerexcludingassessedtax",
    ),
    "ebit": (
        "ebit",
        "operatingincome",
        "operatingincomeloss",
        "operating_income",
        "betriebsergebnis",
    ),
    "net_income": (
        "netincome",
        "net_income",
        "ni",
        "netincomeloss",
        "profitloss",
        "nettogewinn",
    ),
    "ocf": (
        "ocf",
        "operatingcashflow",
        "cfo",
        "netcashprovidedbyusedinoperatingactivities",
        "cashfromoperations",
    ),
    "capex": (
        "capex",
        "capitalexpenditures",
        "paymentstoacquirepropertyplantandequipment",
        "ppe_purchases",
    ),
    "fcf": ("fcf", "freecashflow", "free_cash_flow"),
    "da": (
        "da",
        "d_and_a",
        "depreciation",
        "depreciationandamortization",
        "depreciationdepletionandamortization",
    ),
    "ebitda": ("ebitda",),
    "assets": ("assets", "totalassets", "gesamtvormoegen", "total_assets"),
    "liabilities": (
        "liabilities",
        "totalliabilities",
        "gesamtschulden",
        "total_liabilities",
    ),
    "equity": (
        "equity",
        "stockholdersequity",
        "stockholders_equity",
        "shareholdersequity",
        "eigenkapital",
    ),
    "shares": (
        "shares",
        "sharesoutstanding",
        "weightedavgshares",
        "weightedaverageshares",
        "weightedaverageNumberofdilutedsharesoutstanding",
        "dilutedshares",
        "commonstocksharesoutstanding",
        "aktien",
    ),
    "market_cap": ("marketcap", "market_cap", "mcap", "marktkapitalisierung"),
    "price": ("price", "close", "adjclose", "kurs"),
    "pe": ("pe", "kgv", "trailingpe"),
    "ps": ("ps", "kuv", "pricetosales"),
    "split_factor": ("split_factor", "split", "stock_split", "splitfactor"),
}


@dataclass(frozen=True)
class ValidateConfig:
    """Tunable thresholds. Defaults match Finviz-style *strict* screening."""

    revenue_jump_pct: float = 18.0
    """YoY |revenue| move that can be an ASC 606 / gross-vs-net break."""

    profit_stable_pct: float = 10.0
    """EBIT and NI are 'stable' if |YoY| stays below this."""

    identity_tolerance_pct: float = 2.0
    """Relative error allowed on FCF / BS / EBITDA identities."""

    share_unit_ratio_min: float = 8.0
    """YoY |shares| factor ≥ this (and near 10/100/1000) → unit glitch."""

    share_split_ratio: float = 1.85
    """YoY factor ≥ this without a matching split → possible unadjusted split.
    Same 1.85 cap as ``cagrJaehrlichAusSerie`` in the TS pipeline."""

    pe_floor_quality: float = 3.0
    ps_floor_quality: float = 1.0
    """Implausibly cheap multiples on otherwise profitable names → feed error."""

    tax_ni_vs_ebit_gap_pct: float = 40.0
    """ |NI YoY| this far from |EBIT YoY| (and OCF stable) → one-time tax."""

    apply_corrections: bool = True
    ticker: str | None = None


@dataclass
class QualityFlag:
    year: int | None
    category: Category
    code: str
    severity: Severity
    message: str
    evidence: dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "year": self.year,
            "category": self.category,
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "evidence": self.evidence,
            "suggestion": self.suggestion,
        }


@dataclass
class DataQualityReport:
    """Structured QC output — three buckets as specified."""

    ticker: str | None
    column_mapping: dict[str, str]
    flags: list[QualityFlag]
    exclude_from_cagr_years: list[int]
    corrections_applied: list[str]
    n_rows: int

    @property
    def data_feed_errors(self) -> list[QualityFlag]:
        return [f for f in self.flags if f.category == "DATA_FEED_ERRORS"]

    @property
    def accounting_shifts(self) -> list[QualityFlag]:
        return [f for f in self.flags if f.category == "ACCOUNTING_SHIFTS"]

    @property
    def one_time_effects(self) -> list[QualityFlag]:
        return [f for f in self.flags if f.category == "ONE_TIME_EFFECTS"]

    def summary(self) -> str:
        lines = [
            f"SEC data quality - {self.ticker or 'unknown'}  ({self.n_rows} years)",
            f"  DATA_FEED_ERRORS   : {len(self.data_feed_errors)}",
            f"  ACCOUNTING_SHIFTS  : {len(self.accounting_shifts)}",
            f"  ONE_TIME_EFFECTS   : {len(self.one_time_effects)}",
            f"  CAGR-exclude years : {self.exclude_from_cagr_years or '-'}",
        ]
        if self.corrections_applied:
            lines.append("  Corrections        : " + "; ".join(self.corrections_applied))
        for bucket, items in (
            ("DATA_FEED_ERRORS", self.data_feed_errors),
            ("ACCOUNTING_SHIFTS", self.accounting_shifts),
            ("ONE_TIME_EFFECTS", self.one_time_effects),
        ):
            if not items:
                continue
            lines.append(f"\n[{bucket}]")
            for f in items:
                yr = f"{f.year} " if f.year is not None else ""
                lines.append(f"  - {yr}[{f.severity}] {f.code}: {f.message}")
                if f.suggestion:
                    lines.append(f"      -> {f.suggestion}")
        return "\n".join(lines)

    def to_frame(self) -> pd.DataFrame:
        if not self.flags:
            return pd.DataFrame(
                columns=["year", "category", "code", "severity", "message", "suggestion"]
            )
        return pd.DataFrame([f.as_dict() for f in self.flags])


def _norm_name(name: str) -> str:
    return (
        str(name)
        .strip()
        .lower()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
        .replace("'", "")
        .replace(".", "")
    )


def map_columns(df: pd.DataFrame, extra: Mapping[str, str] | None = None) -> dict[str, str]:
    """Return canonical → actual column name."""
    by_norm = {_norm_name(c): str(c) for c in df.columns}
    mapping: dict[str, str] = {}
    if extra:
        for canon, actual in extra.items():
            if actual in df.columns:
                mapping[canon] = actual
    for canon, aliases in COLUMN_ALIASES.items():
        if canon in mapping:
            continue
        for alias in aliases:
            hit = by_norm.get(_norm_name(alias))
            if hit:
                mapping[canon] = hit
                break
    return mapping


def _num(series: pd.Series | None) -> pd.Series:
    if series is None:
        return pd.Series(dtype="float64")
    return pd.to_numeric(series, errors="coerce")


def _year_index(df: pd.DataFrame, mapping: dict[str, str]) -> pd.DataFrame:
    out = df.copy()
    if "year" in mapping:
        raw = out[mapping["year"]]
        if pd.api.types.is_datetime64_any_dtype(raw):
            years = pd.to_datetime(raw, errors="coerce").dt.year
        else:
            numeric = pd.to_numeric(raw, errors="coerce")
            looks_like_year = numeric.between(1900, 2100).mean() > 0.5
            if looks_like_year:
                years = numeric
            else:
                parsed = pd.to_datetime(raw, errors="coerce", utc=False)
                years = parsed.dt.year
        out["_year"] = pd.to_numeric(years, errors="coerce").astype("Int64")
    else:
        if isinstance(out.index, pd.DatetimeIndex):
            out["_year"] = out.index.year.astype("Int64")
        else:
            out["_year"] = pd.to_numeric(out.index, errors="coerce").astype("Int64")
    out = out.dropna(subset=["_year"]).sort_values("_year")
    out["_year"] = out["_year"].astype(int)
    return out.reset_index(drop=True)


def _col(df: pd.DataFrame, mapping: dict[str, str], key: str) -> pd.Series:
    name = mapping.get(key)
    if not name:
        return pd.Series(np.nan, index=df.index, dtype="float64")
    return _num(df[name])


def _yoy_pct(s: pd.Series) -> pd.Series:
    prev = s.shift(1)
    with np.errstate(divide="ignore", invalid="ignore"):
        return (s / prev - 1.0) * 100.0


def _near_unit_ratio(ratio: float) -> float | None:
    if not np.isfinite(ratio) or ratio <= 0:
        return None
    for target in UNIT_RATIO_TARGETS:
        if abs(np.log10(ratio / target)) < 0.08:  # ~20 % band around 10/100/1000
            return target
    return None


def _is_binary_split_ratio(ratio: float, band: float = 0.08) -> bool:
    """True if ``ratio`` is within ``band`` of 2^k for k != 0 (2-for-1, 4-for-1, reverse)."""
    if not np.isfinite(ratio) or ratio <= 0:
        return False
    k = int(round(np.log(ratio) / np.log(2)))
    if k == 0:
        return False
    return abs(ratio / (2 ** k) - 1.0) <= band


def _is_stable(yoy: float | None, limit: float) -> bool:
    return yoy is not None and np.isfinite(yoy) and abs(yoy) <= limit


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def _flag_accounting_shifts(
    work: pd.DataFrame, cfg: ValidateConfig, flags: list[QualityFlag], exclude: set[int]
) -> None:
    rev_yoy = work["_revenue_yoy"]
    ebit_yoy = work["_ebit_yoy"]
    ni_yoy = work["_ni_yoy"]
    for i, row in work.iterrows():
        year = int(row["_year"])
        r, e, n = rev_yoy.loc[i], ebit_yoy.loc[i], ni_yoy.loc[i]
        if not (np.isfinite(r) and abs(r) >= cfg.revenue_jump_pct):
            continue
        ebit_ok = _is_stable(float(e) if np.isfinite(e) else None, cfg.profit_stable_pct)
        ni_ok = _is_stable(float(n) if np.isfinite(n) else None, cfg.profit_stable_pct)
        if not (ebit_ok or ni_ok):
            continue
        # Profit stable while sales jump → denominator (revenue tagging) changed.
        around_asc = year in ASC606_EFFECTIVE_YEARS or (year - 1) in ASC606_EFFECTIVE_YEARS
        code = "ASC606_GROSS_VS_NET" if around_asc else "REVENUE_RECOGNITION_BREAK"
        flags.append(
            QualityFlag(
                year=year,
                category="ACCOUNTING_SHIFTS",
                code=code,
                severity="error" if around_asc else "warn",
                message=(
                    f"Revenue YoY {r:+.1f}% while EBIT YoY "
                    f"{(e if np.isfinite(e) else float('nan')):+.1f}% and NI YoY "
                    f"{(n if np.isfinite(n) else float('nan')):+.1f}%. "
                    "Typical of ASC 606 / customer-incentive gross-vs-net "
                    "(us-gaap:Revenues including rebates vs net interchange)."
                ),
                evidence={
                    "revenue_yoy_pct": round(float(r), 2),
                    "ebit_yoy_pct": round(float(e), 2) if np.isfinite(e) else None,
                    "ni_yoy_pct": round(float(n), 2) if np.isfinite(n) else None,
                    "ebit_margin": round(float(row["_ebit_margin"]), 4)
                    if np.isfinite(row["_ebit_margin"])
                    else None,
                    "net_margin": round(float(row["_net_margin"]), 4)
                    if np.isfinite(row["_net_margin"])
                    else None,
                },
                suggestion=(
                    "Prefer us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax "
                    "or net-of-incentives revenue. Exclude this year from revenue CAGR; "
                    "keep EBIT/NI CAGR. Do not mix pre/post break in a 5y sales CAGR."
                ),
            )
        )
        exclude.add(year)
        # The year *before* the jump is also a bad CAGR endpoint.
        prev_years = work.loc[work["_year"] < year, "_year"]
        if len(prev_years):
            exclude.add(int(prev_years.iloc[-1]))


def _flag_share_glitches(
    work: pd.DataFrame, cfg: ValidateConfig, flags: list[QualityFlag], exclude: set[int]
) -> None:
    shares = work["_shares"]
    if shares.notna().sum() < 2:
        return
    ratio = shares / shares.shift(1)
    split = work["_split_factor"] if "_split_factor" in work.columns else pd.Series(1.0, index=work.index)

    for i, row in work.iterrows():
        year = int(row["_year"])
        r = ratio.loc[i]
        if not np.isfinite(r) or r <= 0:
            continue
        split_f = float(split.loc[i]) if np.isfinite(split.loc[i]) else 1.0
        unit = _near_unit_ratio(float(r))
        implied_px = row["_implied_price"]
        listed_px = row["_price"]

        if unit is not None and (abs(r) >= cfg.share_unit_ratio_min or unit in (0.1, 0.01, 0.001)):
            persists = False
            later = shares.loc[work.index > i].dropna()
            if len(later) >= 1:
                # After the jump, level stays on the new scale.
                persists = True
            flags.append(
                QualityFlag(
                    year=year,
                    category="DATA_FEED_ERRORS",
                    code="SHARES_UNIT_GLITCH",
                    severity="error",
                    message=(
                        f"Weighted-average shares jumped x{r:.2f} (matches XBRL unit "
                        f"factor ~x{unit:g}). Almost never dilution - ones vs thousands "
                        "vs millions tagging."
                    ),
                    evidence={
                        "yoy_ratio": round(float(r), 4),
                        "unit_factor": unit,
                        "shares": float(row["_shares"]) if np.isfinite(row["_shares"]) else None,
                        "persists": persists,
                    },
                    suggestion=(
                        "Rescale older (or newer) years onto the *latest* unit so the "
                        "series is in one scale. Cap dilution CAGR at ~1.85x YoY "
                        "(same rule as the app's cagrJaehrlichAusSerie)."
                    ),
                )
            )
            exclude.add(year)
            continue

        documented_split = split_f >= 1.5 or split_f <= 0.67
        if _is_binary_split_ratio(float(r)):
            if not documented_split:
                flags.append(
                    QualityFlag(
                        year=year,
                        category="DATA_FEED_ERRORS",
                        code="SHARES_UNDOCUMENTED_SPLIT",
                        severity="warn",
                        message=(
                            f"Shares moved x{r:.2f} with no matching split_factor. "
                            "Could be a 2-for-1 split missing from the calendar, or a "
                            "pre-split WAS figure left in the XBRL series."
                        ),
                        evidence={"yoy_ratio": round(float(r), 4), "split_factor": split_f},
                        suggestion=(
                            "Confirm against the issuer split history. If it is a split, "
                            "set split_factor and restated WAS; otherwise drop the year "
                            "from dilution CAGR."
                        ),
                    )
                )
        elif r >= cfg.share_split_ratio or r <= 1 / cfg.share_split_ratio:
            if not documented_split:
                flags.append(
                    QualityFlag(
                        year=year,
                        category="DATA_FEED_ERRORS",
                        code="SHARES_LEVEL_JUMP",
                        severity="warn",
                        message=(
                            f"Shares YoY factor x{r:.2f} exceeds the {cfg.share_split_ratio} "
                            "split cap and is not a 10/100/1000 unit jump."
                        ),
                        evidence={"yoy_ratio": round(float(r), 4)},
                        suggestion="Exclude from share-CAGR / dilution; inspect the 10-K WAS footnote.",
                    )
                )
                exclude.add(year)

        if np.isfinite(implied_px) and np.isfinite(listed_px) and listed_px > 0:
            px_ratio = float(implied_px / listed_px)
            unit_px = _near_unit_ratio(px_ratio)
            if unit_px is not None:
                flags.append(
                    QualityFlag(
                        year=year,
                        category="DATA_FEED_ERRORS",
                        code="SHARES_VS_MARKETCAP_UNIT",
                        severity="error",
                        message=(
                            f"Market cap / shares (= {implied_px:.2f}) is x{px_ratio:.2f} "
                            f"the listed price ({listed_px:.2f}) - shares or mcap unit mismatch."
                        ),
                        evidence={
                            "implied_price": round(float(implied_px), 4),
                            "listed_price": round(float(listed_px), 4),
                            "ratio": round(px_ratio, 4),
                        },
                        suggestion="Rescale shares so mcap/shares ~ close. Prefer diluted WAS, not basic.",
                    )
                )


def _flag_extreme_multiples(work: pd.DataFrame, cfg: ValidateConfig, flags: list[QualityFlag]) -> None:
    profitable = (work["_net_income"] > 0) & (work["_ebit"] > 0) & (work["_ebit_margin"] > 0.08)
    for i, row in work.loc[profitable].iterrows():
        year = int(row["_year"])
        pe, ps = row["_pe"], row["_ps"]
        if np.isfinite(pe) and 0 < pe < cfg.pe_floor_quality:
            flags.append(
                QualityFlag(
                    year=year,
                    category="DATA_FEED_ERRORS",
                    code="IMPLAUSIBLE_PE",
                    severity="warn",
                    message=(
                        f"KGV {pe:.2f} with EBIT margin "
                        f"{row['_ebit_margin']*100:.1f}% - for a profitable franchise this is "
                        "almost always EPS or price in the wrong unit, not a 3x quality compounder."
                    ),
                    evidence={"pe": round(float(pe), 3), "ebit_margin": round(float(row["_ebit_margin"]), 4)},
                    suggestion="Recompute PE from net_income and market_cap in the same currency/scale.",
                )
            )
        if np.isfinite(ps) and 0 < ps < cfg.ps_floor_quality:
            flags.append(
                QualityFlag(
                    year=year,
                    category="DATA_FEED_ERRORS",
                    code="IMPLAUSIBLE_PS",
                    severity="warn",
                    message=(
                        f"KUV {ps:.2f} on a profitable name. Often gross TPV in the "
                        "denominator (payments/platform) or revenue still in thousands."
                    ),
                    evidence={"ps": round(float(ps), 3)},
                    suggestion="Switch to net revenue before computing KUV; check revenue unit.",
                )
            )


def _flag_one_time_tax(
    work: pd.DataFrame, cfg: ValidateConfig, flags: list[QualityFlag], exclude: set[int]
) -> None:
    ni_ebit = work["_net_income"] / work["_ebit"].replace(0, np.nan)
    typical = float(ni_ebit.replace([np.inf, -np.inf], np.nan).median())
    if not np.isfinite(typical):
        typical = 0.75

    for i, row in work.iterrows():
        year = int(row["_year"])
        ni_yoy = row["_ni_yoy"]
        ebit_yoy = row["_ebit_yoy"]
        ocf_yoy = row["_ocf_yoy"]
        conv = ni_ebit.loc[i]
        ni_shock = np.isfinite(ni_yoy) and abs(float(ni_yoy)) >= cfg.tax_ni_vs_ebit_gap_pct
        ebit_stable = _is_stable(float(ebit_yoy) if np.isfinite(ebit_yoy) else None, cfg.profit_stable_pct)
        ocf_stable = _is_stable(float(ocf_yoy) if np.isfinite(ocf_yoy) else None, cfg.profit_stable_pct + 5)
        conversion_outlier = np.isfinite(conv) and abs(float(conv) - typical) >= 0.25
        tcja = year in TCJA_YEARS
        yoy_pattern = ni_shock and (ebit_stable or ocf_stable)
        if not (yoy_pattern or (tcja and conversion_outlier)):
            continue
        flags.append(
            QualityFlag(
                year=year,
                category="ONE_TIME_EFFECTS",
                code="TCJA_TAX_DISTORTION" if tcja else "ONE_TIME_TAX_OR_GAAP",
                severity="warn",
                message=(
                    f"NI YoY {(ni_yoy if np.isfinite(ni_yoy) else float('nan')):+.1f}% while EBIT YoY "
                    f"{(ebit_yoy if np.isfinite(ebit_yoy) else float('nan')):+.1f}% and OCF YoY "
                    f"{(ocf_yoy if np.isfinite(ocf_yoy) else float('nan')):+.1f}%. "
                    + (
                        "Classic TCJA 2017/18 one-time tax (repatriation / deferred-tax remeasure)."
                        if tcja
                        else "Isolated tax or non-operating GAAP item - do not use this NI in margins/CAGR."
                    )
                ),
                evidence={
                    "ni_yoy_pct": round(float(ni_yoy), 2) if np.isfinite(ni_yoy) else None,
                    "ebit_yoy_pct": round(float(ebit_yoy), 2) if np.isfinite(ebit_yoy) else None,
                    "ocf_yoy_pct": round(float(ocf_yoy), 2) if np.isfinite(ocf_yoy) else None,
                    "ni_over_ebit": round(float(conv), 3) if np.isfinite(conv) else None,
                    "typical_ni_over_ebit": round(typical, 3),
                },
                suggestion=(
                    "Use EBIT / OCF for 2017-18 quality; drop NI and net margin that year "
                    "from medians and from NI-CAGR. Do not treat it as a structural ROE collapse."
                ),
            )
        )
        exclude.add(year)


def _flag_invariants(work: pd.DataFrame, cfg: ValidateConfig, flags: list[QualityFlag]) -> None:
    tol = cfg.identity_tolerance_pct
    for i, row in work.iterrows():
        year = int(row["_year"])
        ocf, capex, fcf = row["_ocf"], row["_capex_abs"], row["_fcf"]
        if np.isfinite(ocf) and np.isfinite(capex):
            fcf_calc = float(ocf) - float(capex)
            if np.isfinite(fcf):
                denom = max(abs(fcf_calc), abs(float(fcf)), 1e-9)
                err = abs(fcf_calc - float(fcf)) / denom * 100.0
                if err > tol:
                    flags.append(
                        QualityFlag(
                            year=year,
                            category="DATA_FEED_ERRORS",
                            code="FCF_IDENTITY_BREAK",
                            severity="error" if err > 10 else "warn",
                            message=(
                                f"OCF - |CapEx| = {fcf_calc:,.0f} vs reported FCF {float(fcf):,.0f} "
                                f"({err:.1f}% off, tolerance {tol}%)."
                            ),
                            evidence={
                                "ocf": float(ocf),
                                "capex_abs": float(capex),
                                "fcf_reported": float(fcf),
                                "fcf_calc": fcf_calc,
                                "rel_err_pct": round(err, 2),
                            },
                            suggestion="Replace reported FCF with OCF - |CapEx| (SEC 10-Q CF is YTD, not TTM).",
                        )
                    )

        assets, liab, equity = row["_assets"], row["_liabilities"], row["_equity"]
        if np.isfinite(assets) and np.isfinite(liab) and np.isfinite(equity):
            identity = float(assets) - float(liab)
            denom = max(abs(float(assets)), 1e-9)
            err = abs(identity - float(equity)) / denom * 100.0
            if err > tol:
                flags.append(
                    QualityFlag(
                        year=year,
                        category="DATA_FEED_ERRORS",
                        code="BALANCE_SHEET_IDENTITY_BREAK",
                        severity="error" if err > 5 else "warn",
                        message=(
                            f"Assets - Liabilities = {identity:,.0f} vs equity {float(equity):,.0f} "
                            f"({err:.2f}% of assets)."
                        ),
                        evidence={
                            "assets": float(assets),
                            "liabilities": float(liab),
                            "equity": float(equity),
                            "assets_minus_liab": identity,
                            "rel_err_pct": round(err, 3),
                        },
                        suggestion=(
                            "Prefer StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest "
                            "or recompute equity = assets - liabilities for ROIC invested capital."
                        ),
                    )
                )

        ebit, da, ebitda = row["_ebit"], row["_da"], row["_ebitda"]
        if np.isfinite(ebit) and np.isfinite(da) and np.isfinite(ebitda):
            calc = float(ebit) + abs(float(da))
            denom = max(abs(calc), abs(float(ebitda)), 1e-9)
            err = abs(calc - float(ebitda)) / denom * 100.0
            if err > tol:
                flags.append(
                    QualityFlag(
                        year=year,
                        category="DATA_FEED_ERRORS",
                        code="EBITDA_IDENTITY_BREAK",
                        severity="warn",
                        message=(
                            f"EBIT + |D&A| = {calc:,.0f} vs reported EBITDA {float(ebitda):,.0f} "
                            f"({err:.1f}% off)."
                        ),
                        evidence={
                            "ebit": float(ebit),
                            "da": float(da),
                            "ebitda_reported": float(ebitda),
                            "ebitda_calc": calc,
                            "rel_err_pct": round(err, 2),
                        },
                        suggestion="Recompute EBITDA = EBIT + |D&A| when the tagged EBITDA uses a different definition (SBC, leases).",
                    )
                )


# ---------------------------------------------------------------------------
# Corrections
# ---------------------------------------------------------------------------


def _rescale_shares_to_latest(work: pd.DataFrame) -> tuple[pd.Series, list[str]]:
    """Walk from the newest year backward; undo 10/100/1000 unit jumps."""
    notes: list[str] = []
    s = work["_shares"].copy()
    if s.notna().sum() < 2:
        return s, notes
    years = work["_year"].to_numpy()
    vals = s.to_numpy(dtype=float)
    # newest → oldest
    for i in range(len(vals) - 1, 0, -1):
        cur, prev = vals[i], vals[i - 1]
        if not (np.isfinite(cur) and np.isfinite(prev) and prev > 0 and cur > 0):
            continue
        ratio = prev / cur  # how much *older* is vs newer
        unit = _near_unit_ratio(ratio)
        if unit is None:
            continue
        # Older year is unit× the newer scale → divide older by unit.
        vals[i - 1] = prev / unit
        notes.append(f"shares {int(years[i - 1])}: /{unit:g} to match {int(years[i])} unit")
    s.iloc[:] = vals
    return s, notes


def _apply_corrections(work: pd.DataFrame, cfg: ValidateConfig) -> list[str]:
    applied: list[str] = []
    if not cfg.apply_corrections:
        return applied

    # FCF: always (re)compute from OCF − |CapEx| when both exist.
    has_parts = work["_ocf"].notna() & work["_capex_abs"].notna()
    if has_parts.any():
        work.loc[has_parts, "_fcf_clean"] = work.loc[has_parts, "_ocf"] - work.loc[has_parts, "_capex_abs"]
        applied.append("fcf = ocf - |capex| where both present")
    else:
        work["_fcf_clean"] = work["_fcf"]

    # Equity fallback.
    has_bs = work["_assets"].notna() & work["_liabilities"].notna()
    if has_bs.any():
        work["_equity_clean"] = work["_equity"]
        broken = has_bs & work["_equity"].notna()
        if broken.any():
            calc = work["_assets"] - work["_liabilities"]
            denom = work["_assets"].abs().replace(0, np.nan)
            err = (calc - work["_equity"]).abs() / denom * 100.0
            fix = broken & (err > cfg.identity_tolerance_pct)
            work.loc[fix, "_equity_clean"] = calc[fix]
            if fix.any():
                applied.append("equity = assets - liabilities where identity fails")
        work.loc[has_bs & work["_equity"].isna(), "_equity_clean"] = (
            work["_assets"] - work["_liabilities"]
        )

    # Shares unit walk.
    scaled, notes = _rescale_shares_to_latest(work)
    if notes:
        work["_shares_clean"] = scaled
        applied.extend(notes)
    else:
        work["_shares_clean"] = work["_shares"]

    # EBITDA fallback.
    has_da = work["_ebit"].notna() & work["_da"].notna()
    work["_ebitda_clean"] = work["_ebitda"]
    if has_da.any():
        calc = work["_ebit"] + work["_da"].abs()
        work.loc[has_da, "_ebitda_clean"] = calc[has_da]
        applied.append("ebitda = ebit + |d&a| where both present")

    # Revenue for CAGR: NaN years flagged as recognition breaks.
    work["_revenue_for_cagr"] = work["_revenue"]
    return applied


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_sec_dataframe(
    df: pd.DataFrame,
    *,
    config: ValidateConfig | None = None,
    column_map: Mapping[str, str] | None = None,
) -> tuple[pd.DataFrame, DataQualityReport]:
    """
    Inspect an annual SEC XBRL frame and return ``(cleaned_df, report)``.

    The cleaned frame keeps original columns and adds:

    * ``year``, ``ebit_margin``, ``net_margin``, ``fcf_clean``, ``equity_clean``,
      ``shares_clean``, ``ebitda_clean``, ``revenue_for_cagr``
    * ``exclude_from_cagr`` (bool) — drop these years from multi-year CAGRs
    * ``qc_*`` boolean columns per flag code
    """
    if df is None or len(df) == 0:
        empty = pd.DataFrame(df) if df is not None else pd.DataFrame()
        return empty, DataQualityReport(
            ticker=config.ticker if config else None,
            column_mapping={},
            flags=[
                QualityFlag(
                    year=None,
                    category="DATA_FEED_ERRORS",
                    code="EMPTY_FRAME",
                    severity="error",
                    message="DataFrame is empty.",
                    suggestion="Check the EDGAR pull (CIK, form 10-K/20-F, units).",
                )
            ],
            exclude_from_cagr_years=[],
            corrections_applied=[],
            n_rows=0,
        )

    cfg = config or ValidateConfig()
    mapping = map_columns(df, extra=column_map)
    work = _year_index(df, mapping)

    work["_revenue"] = _col(work, mapping, "revenue")
    work["_ebit"] = _col(work, mapping, "ebit")
    work["_net_income"] = _col(work, mapping, "net_income")
    work["_ocf"] = _col(work, mapping, "ocf")
    capex_raw = _col(work, mapping, "capex")
    work["_capex_abs"] = capex_raw.abs()
    work["_fcf"] = _col(work, mapping, "fcf")
    work["_da"] = _col(work, mapping, "da")
    work["_ebitda"] = _col(work, mapping, "ebitda")
    work["_assets"] = _col(work, mapping, "assets")
    work["_liabilities"] = _col(work, mapping, "liabilities")
    work["_equity"] = _col(work, mapping, "equity")
    work["_shares"] = _col(work, mapping, "shares")
    work["_market_cap"] = _col(work, mapping, "market_cap")
    work["_price"] = _col(work, mapping, "price")
    work["_pe"] = _col(work, mapping, "pe")
    work["_ps"] = _col(work, mapping, "ps")
    if "split_factor" in mapping:
        work["_split_factor"] = _col(work, mapping, "split_factor").fillna(1.0)
    else:
        work["_split_factor"] = 1.0

    with np.errstate(divide="ignore", invalid="ignore"):
        work["_ebit_margin"] = work["_ebit"] / work["_revenue"]
        work["_net_margin"] = work["_net_income"] / work["_revenue"]
        work["_implied_price"] = work["_market_cap"] / work["_shares"].replace(0, np.nan)
        work["_assets_to_equity"] = work["_assets"] / work["_equity"].replace(0, np.nan)
        if work["_pe"].isna().all() and work["_market_cap"].notna().any():
            work["_pe"] = work["_market_cap"] / work["_net_income"].replace(0, np.nan)
        if work["_ps"].isna().all() and work["_market_cap"].notna().any():
            work["_ps"] = work["_market_cap"] / work["_revenue"].replace(0, np.nan)

    work["_revenue_yoy"] = _yoy_pct(work["_revenue"])
    work["_ebit_yoy"] = _yoy_pct(work["_ebit"])
    work["_ni_yoy"] = _yoy_pct(work["_net_income"])
    work["_ocf_yoy"] = _yoy_pct(work["_ocf"])
    work["_shares_yoy_ratio"] = work["_shares"] / work["_shares"].shift(1)

    flags: list[QualityFlag] = []
    exclude: set[int] = set()

    missing = [k for k in ("revenue", "ebit", "net_income") if k not in mapping]
    if missing:
        flags.append(
            QualityFlag(
                year=None,
                category="DATA_FEED_ERRORS",
                code="MISSING_CORE_COLUMNS",
                severity="error",
                message=f"Could not map columns: {', '.join(missing)}.",
                evidence={"available": list(df.columns)},
                suggestion="Pass column_map={canonical: actual_name} or rename to revenue/ebit/net_income.",
            )
        )

    _flag_accounting_shifts(work, cfg, flags, exclude)
    _flag_share_glitches(work, cfg, flags, exclude)
    _flag_extreme_multiples(work, cfg, flags)
    _flag_one_time_tax(work, cfg, flags, exclude)
    _flag_invariants(work, cfg, flags)

    applied = _apply_corrections(work, cfg)

    # Revenue used for CAGR: blank out recognition-break years (keep EBIT series intact).
    shift_years = {f.year for f in flags if f.category == "ACCOUNTING_SHIFTS" and f.year is not None}
    work["_revenue_for_cagr"] = work["_revenue"]
    if shift_years:
        work.loc[work["_year"].isin(shift_years), "_revenue_for_cagr"] = np.nan
        applied.append("revenue_for_cagr blanks ASC 606 / gross-vs-net break years")

    work["exclude_from_cagr"] = work["_year"].isin(exclude)

    cleaned = work.copy()
    cleaned["year"] = cleaned["_year"]
    cleaned["ebit_margin"] = cleaned["_ebit_margin"]
    cleaned["net_margin"] = cleaned["_net_margin"]
    cleaned["fcf_clean"] = cleaned.get("_fcf_clean", cleaned["_fcf"])
    cleaned["equity_clean"] = cleaned.get("_equity_clean", cleaned["_equity"])
    cleaned["shares_clean"] = cleaned.get("_shares_clean", cleaned["_shares"])
    cleaned["ebitda_clean"] = cleaned.get("_ebitda_clean", cleaned["_ebitda"])
    cleaned["revenue_for_cagr"] = cleaned["_revenue_for_cagr"]
    cleaned["assets_to_equity"] = cleaned["_assets_to_equity"]
    cleaned["implied_price"] = cleaned["_implied_price"]

    for f in flags:
        col = f"qc_{f.code.lower()}"
        if col not in cleaned.columns:
            cleaned[col] = False
        if f.year is not None:
            cleaned.loc[cleaned["year"] == f.year, col] = True

    drop_internal = [c for c in cleaned.columns if c.startswith("_")]
    cleaned = cleaned.drop(columns=drop_internal)

    report = DataQualityReport(
        ticker=cfg.ticker,
        column_mapping=mapping,
        flags=flags,
        exclude_from_cagr_years=sorted(exclude),
        corrections_applied=applied,
        n_rows=len(cleaned),
    )
    return cleaned, report


def validate_sec_csv(
    path: str | Path,
    *,
    config: ValidateConfig | None = None,
    column_map: Mapping[str, str] | None = None,
    **read_csv_kwargs: Any,
) -> tuple[pd.DataFrame, DataQualityReport]:
    df = pd.read_csv(path, **read_csv_kwargs)
    return validate_sec_dataframe(df, config=config, column_map=column_map)


def cagr_excluding_breaks(series: pd.Series, years: pd.Series, exclude: Iterable[int], window: int = 5) -> float | None:
    """CAGR over the last ``window`` years, skipping flagged years (and unit jumps)."""
    tmp = pd.DataFrame({"y": pd.to_numeric(years, errors="coerce"), "v": pd.to_numeric(series, errors="coerce")})
    tmp = tmp.dropna().sort_values("y")
    skip = set(exclude)
    tmp = tmp[~tmp["y"].isin(skip)]
    tmp = tmp[tmp["v"] > 0]
    if len(tmp) < 2:
        return None
    last = tmp.iloc[-1]
    target = int(last["y"]) - window
    start_rows = tmp[tmp["y"] <= target]
    if start_rows.empty:
        start = tmp.iloc[0]
    else:
        start = start_rows.iloc[-1]
    n = int(last["y"] - start["y"])
    if n < 2:
        return None
    return float((last["v"] / start["v"]) ** (1 / n) - 1)


# ---------------------------------------------------------------------------
# Self-check with synthetic Mastercard-like / TCJA / unit-glitch series
# ---------------------------------------------------------------------------


def _demo_frame() -> pd.DataFrame:
    """Synthetic 2015–2021 series covering all four error classes."""
    return pd.DataFrame(
        {
            "year": [2015, 2016, 2017, 2018, 2019, 2020, 2021],
            "revenue": [9_667, 10_776, 12_497, 14_950, 16_883, 15_301, 18_884],
            # 2018: tagged *gross* incentives — sales jump, profit does not.
            "ebit": [5_116, 5_741, 6_622, 6_860, 9_664, 8_080, 10_082],
            "net_income": [3_808, 4_059, 1_620, 5_859, 8_118, 6_411, 8_687],  # 2017 TCJA hit
            "ocf": [4_000, 4_500, 5_300, 5_800, 7_200, 6_500, 8_000],
            "capex": [300, 320, 340, 360, 400, 380, 420],
            "fcf": [3_700, 4_180, 4_960, 5_440, 6_800, 6_120, 7_580],
            "da": [400, 420, 450, 470, 500, 510, 530],
            "ebitda": [5_516, 6_161, 7_072, 7_330, 10_164, 8_590, 10_612],
            "assets": [16_250, 18_680, 21_329, 24_860, 29_240, 33_630, 37_669],
            "liabilities": [10_000, 11_500, 13_200, 15_000, 17_500, 20_000, 22_400],
            "equity": [6_250, 7_180, 8_129, 9_860, 11_740, 13_630, 15_269],
            # 2019: thousands instead of ones (×0.001), 2020 back to ones.
            "shares": [1_120_000_000, 1_100_000_000, 1_080_000_000, 1_050_000_000, 1_040_000, 1_020_000_000, 990_000_000],
            "market_cap": [100e9, 110e9, 140e9, 180e9, 280e9, 320e9, 360e9],
            "price": [89, 100, 130, 171, 269, 314, 364],
            "split_factor": [1, 1, 1, 1, 1, 1, 1],
        }
    )


def _inject_demo_breaks(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    # ASC 606 gross-up: 2018 revenue ×1.35, profits almost unchanged vs 2017 run-rate.
    out.loc[out["year"] == 2018, "revenue"] = 22_000
    out.loc[out["year"] == 2018, "ebit"] = 6_700
    out.loc[out["year"] == 2018, "net_income"] = 5_900
    # Broken FCF identity in 2020.
    out.loc[out["year"] == 2020, "fcf"] = 1_000
    # BS break in 2021.
    out.loc[out["year"] == 2021, "equity"] = 1_000
    # Cheap multiple glitch 2016 (same unit as NI → PE ≈ 2.5).
    out.loc[out["year"] == 2016, "pe"] = 2.4
    out.loc[out["year"] == 2016, "ps"] = 0.6
    return out


if __name__ == "__main__":
    demo = _inject_demo_breaks(_demo_frame())
    clean, report = validate_sec_dataframe(demo, config=ValidateConfig(ticker="MA-demo"))
    print(report.summary())
    print("\nCAGR-exclude:", report.exclude_from_cagr_years)
    print(
        clean[
            [
                "year",
                "ebit_margin",
                "net_margin",
                "fcf_clean",
                "shares_clean",
                "exclude_from_cagr",
            ]
        ].to_string(index=False)
    )
    assert any(f.code == "ASC606_GROSS_VS_NET" for f in report.accounting_shifts), "ASC 606 not caught"
    assert any(f.code == "SHARES_UNIT_GLITCH" for f in report.data_feed_errors), "shares unit not caught"
    assert any(f.code.startswith("TCJA") or f.code == "ONE_TIME_TAX_OR_GAAP" for f in report.one_time_effects)
    assert any(f.code == "FCF_IDENTITY_BREAK" for f in report.data_feed_errors)
    assert any(f.code == "BALANCE_SHEET_IDENTITY_BREAK" for f in report.data_feed_errors)
    print("\nself-check ok")
