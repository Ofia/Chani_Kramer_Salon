"""
Financial calculation engine.

All the business logic lives here — not in routes, not in the frontend.
One place to update if rates change.

The math chain:
  total_revenue
  - total_expenses
  - total_payroll
  = net_profit
    * 40% → bank_portion
    * 60% → owner_portion

  bank_tithes  = (bank_portion × 0.91125) / 10
                   strip 8.875% NY sales tax first, then take 10%
  owner_tithes = owner_portion / 10

  final_take_home = net_profit - bank_tithes - owner_tithes
"""

from decimal import Decimal, ROUND_HALF_UP


# ── Constants ───────────────────────────────────────────────

BANK_RULE_PCT      = Decimal("0.40")         # 40% to bank
TITHE_PCT          = Decimal("0.10")         # 10% tithe
NY_SALES_TAX       = Decimal("0.08875")      # 8.875% cash
NY_SALES_TAX_CC    = Decimal("0.045")        # 4.5% CC/wire
TAX_STRIP_FACTOR   = Decimal("1") - NY_SALES_TAX   # 0.91125 — divide by this to remove tax
                                                     # multiply by this to get pre-tax amount


def _round2(value: Decimal) -> Decimal:
    """Round to 2 decimal places (banker's rounding)."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_snapshot(
    total_revenue: Decimal,
    total_expenses: Decimal,
    total_payroll: Decimal,
) -> dict:
    """
    Given raw totals, compute the full financial breakdown.
    Returns a dict ready to be stored in financial_snapshots.
    """
    total_revenue  = Decimal(str(total_revenue))
    total_expenses = Decimal(str(total_expenses))
    total_payroll  = Decimal(str(total_payroll))

    net_profit    = _round2(total_revenue - total_expenses - total_payroll)
    bank_portion  = _round2(net_profit * BANK_RULE_PCT)
    owner_portion = _round2(net_profit - bank_portion)

    # Bank tithes: strip sales tax from the bank portion first, then take 10%
    # bank_tithes = (bank_portion × 0.91125) / 10
    bank_tithes  = _round2((bank_portion * TAX_STRIP_FACTOR) * TITHE_PCT)

    # Owner tithes: no tax stripping — straight 10%
    owner_tithes = _round2(owner_portion * TITHE_PCT)

    total_tithes    = _round2(bank_tithes + owner_tithes)
    final_take_home = _round2(net_profit - total_tithes)

    return {
        "total_revenue":   total_revenue,
        "total_expenses":  total_expenses,
        "total_payroll":   total_payroll,
        "net_profit":      net_profit,
        "bank_portion":    bank_portion,
        "owner_portion":   owner_portion,
        "bank_tithes":     bank_tithes,
        "owner_tithes":    owner_tithes,
        "total_tithes":    total_tithes,
        "final_take_home": final_take_home,
    }


def simulate_snapshot(
    total_revenue: Decimal,
    total_expenses: Decimal,
    total_payroll: Decimal,
) -> dict:
    """
    Same as compute_snapshot but also returns the full breakdown
    for the owner's "what if" simulation UI.
    Identical logic — the name distinction makes intent clear in routes.
    """
    return compute_snapshot(total_revenue, total_expenses, total_payroll)
