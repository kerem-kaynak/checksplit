import base64
from decimal import Decimal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.check import OCRItem, OCRResponse


class ReceiptItem(BaseModel):
    """A single line item from a receipt."""

    name: str = Field(
        description="The item name in English, cleaned of special characters and codes"
    )
    unit_price: float = Field(
        description="Price per single unit of this item in decimal format (e.g., 12.50)"
    )
    quantity: int = Field(
        description="Number of this item ordered. Default is 1 if not specified on receipt."
    )


class ReceiptData(BaseModel):
    """Complete structured data extracted from a receipt image."""

    items: list[ReceiptItem] = Field(
        description="All food/drink/product items from the receipt. Exclude totals, subtotals, tax, tips, and service charges."
    )


RECEIPT_EXTRACTION_PROMPT = """You are a receipt parser. Extract all purchasable items from this receipt image.

OUTPUT REQUIREMENTS:
- Extract ONLY individual items that were purchased (food, drinks, products)
- For each item provide: name, unit_price (price for ONE item), quantity (how many were ordered)
- If quantity is not shown, set quantity to 1
- If an item shows "2x Coffee €3.00", set name="Coffee", unit_price=1.50, quantity=2
- Clean item names: remove codes, numbers, abbreviations. "CAFE LATTE 1x" becomes "Cafe Latte"
- IMPORTANT: If the quantity appears in the item name but the receipt shows quantity as 1, extract the quantity from the name. Example: "5 Tequila x 1 = €50.00" should become name="Tequila", quantity=5, unit_price=10.00

TRANSLATION:
- Translate item names to English (e.g., "Kaffee" → "Coffee", "Bier" → "Beer", "Wasser" → "Water")
- Keep culturally specific food names untranslated: Schnitzel, Pretzel, Döner, Croissant, Espresso, Cappuccino, Ramen, Sushi, Currywurst, Bratwurst, etc.

EXCLUDE FROM OUTPUT:
- Subtotal, total, grand total lines
- Tax lines (VAT, MwSt, KDV, sales tax)
- Service charges, tips, gratuity
- Discounts (but apply them: if item is €10 with €2 discount, use unit_price=8.00)
- Payment method lines
- Date, time, receipt numbers

HANDLING UNCLEAR TEXT:
- If item name is partially readable, include your best interpretation
- If price is unclear, estimate based on similar items on the receipt
- If completely unreadable, skip that item

Extract the items now."""


def parse_receipt_image(image_data: bytes, mime_type: str) -> OCRResponse:
    """
    Parse a receipt image using Gemini 3 Flash with structured output.

    Args:
        image_data: Raw image bytes
        mime_type: MIME type of the image

    Returns:
        OCRResponse containing extracted items
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    image_base64 = base64.b64encode(image_data).decode("utf-8")

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[
            {
                "role": "user",
                "parts": [
                    {"text": RECEIPT_EXTRACTION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_base64,
                        }
                    },
                ],
            }
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ReceiptData,
        ),
    )

    receipt_data: ReceiptData = response.parsed

    items: list[OCRItem] = []
    for item in receipt_data.items:
        items.append(
            OCRItem(
                name=item.name,
                quantity=item.quantity,
                unit_price=Decimal(str(item.unit_price)).quantize(Decimal("0.01")),
            )
        )

    return OCRResponse(items=items)
