import logging
from datetime import datetime, timedelta
from decimal import Decimal

import httpx

logger = logging.getLogger(__name__)

# Cache exchange rates for 5 minutes
_rate_cache: dict[str, tuple[datetime, Decimal]] = {}
CACHE_TTL_SECONDS = 300


class ExchangeRateError(Exception):
    """An exchange rate could not be retrieved or was invalid."""


async def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """
    Get exchange rate from Frankfurter API.
    Returns the rate to multiply by to convert from_currency to to_currency.

    Args:
        from_currency: Source currency ISO code (e.g., "USD")
        to_currency: Target currency ISO code (e.g., "EUR")

    Returns:
        Exchange rate as Decimal. Returns 1.0 only for the same currency.

    Raises:
        ExchangeRateError: If the rate is unavailable or invalid.
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return Decimal("1.0")

    cache_key = f"{from_currency}_{to_currency}"
    now = datetime.utcnow()

    # Check cache
    if cache_key in _rate_cache:
        cached_time, cached_rate = _rate_cache[cache_key]
        if now - cached_time < timedelta(seconds=CACHE_TTL_SECONDS):
            return cached_rate

    # Fetch from Frankfurter API
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                "https://api.frankfurter.dev/v1/latest",
                params={"base": from_currency, "symbols": to_currency},
            )
            response.raise_for_status()
            data = response.json()
            rates = data.get("rates", {})
            rate_value = rates.get(to_currency)

            if rate_value is None:
                raise ValueError(f"No rate found for {from_currency} -> {to_currency}")

            rate = Decimal(str(rate_value))
            if not rate.is_finite() or rate <= 0:
                raise ValueError(f"Invalid exchange rate: {rate_value}")
            _rate_cache[cache_key] = (now, rate)
            return rate

    except Exception as e:
        logger.error("Exchange rate error for %s -> %s: %s", from_currency, to_currency, e)
        raise ExchangeRateError("Could not fetch exchange rate.") from e


def clear_rate_cache() -> None:
    """Clear the rate cache (for testing)."""
    _rate_cache.clear()
