import logging
from datetime import datetime, timedelta
from decimal import Decimal

import httpx

logger = logging.getLogger(__name__)

# Cache exchange rates for 5 minutes
_rate_cache: dict[str, tuple[datetime, Decimal]] = {}
CACHE_TTL_SECONDS = 300


async def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """
    Get exchange rate from Frankfurter API.
    Returns the rate to multiply by to convert from_currency to to_currency.

    Args:
        from_currency: Source currency ISO code (e.g., "USD")
        to_currency: Target currency ISO code (e.g., "EUR")

    Returns:
        Exchange rate as Decimal. Returns 1.0 on error or same currency.
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.frankfurter.app/latest",
                params={"from": from_currency, "to": to_currency},
            )
            response.raise_for_status()
            data = response.json()
            rates = data.get("rates", {})
            rate_value = rates.get(to_currency)

            if rate_value is None:
                logger.warning(
                    f"No rate found for {from_currency} -> {to_currency}"
                )
                return Decimal("1.0")

            rate = Decimal(str(rate_value))
            _rate_cache[cache_key] = (now, rate)
            return rate

    except httpx.HTTPStatusError as e:
        logger.error(f"Frankfurter API HTTP error: {e.response.status_code}")
        return Decimal("1.0")
    except httpx.RequestError as e:
        logger.error(f"Frankfurter API request error: {e}")
        return Decimal("1.0")
    except Exception as e:
        logger.error(f"Exchange rate error: {e}")
        return Decimal("1.0")


def clear_rate_cache() -> None:
    """Clear the rate cache (for testing)."""
    _rate_cache.clear()
