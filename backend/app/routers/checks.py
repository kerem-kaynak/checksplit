from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.check import Check, Item
from app.schemas.check import (
    CheckCreate,
    CheckUpdate,
    CheckResponse,
    ClaimRequest,
    CheckSummary,
    ParticipantSummary,
    OCRResponse,
    ItemResponse,
    PaymentMethods,
)
from app.services.ocr import parse_receipt_image
from app.services.exchange import get_exchange_rate

router = APIRouter(prefix="/api/checks", tags=["checks"])


def item_to_response(item: Item) -> ItemResponse:
    """Convert Item model to ItemResponse with total_price."""
    return ItemResponse(
        id=item.id,
        name=item.name,
        quantity=item.quantity,
        unit_price=item.unit_price,
        total_price=item.unit_price * item.quantity,
        claims=item.claims or {},
    )


def check_to_response(check: Check) -> CheckResponse:
    """Convert Check model to CheckResponse."""
    # Convert stored dict to PaymentMethods schema
    payment_methods = None
    if check.payment_methods:
        payment_methods = PaymentMethods.model_validate(check.payment_methods)

    return CheckResponse(
        id=check.id,
        code=check.code,
        title=check.title,
        payment_methods=payment_methods,
        currency=check.currency,
        tip_amount=check.tip_amount,
        created_at=check.created_at,
        items=[item_to_response(item) for item in check.items],
    )


@router.get("/exchange-rate")
async def get_rate(from_currency: str, to_currency: str) -> dict:
    """Get exchange rate between two currencies using Frankfurter API."""
    rate = await get_exchange_rate(from_currency.upper(), to_currency.upper())
    return {
        "from": from_currency.upper(),
        "to": to_currency.upper(),
        "rate": str(rate),
    }


@router.post("", response_model=CheckResponse)
def create_check(check_data: CheckCreate, db: Session = Depends(get_db)) -> CheckResponse:
    """Create a new check with items."""
    check = Check(
        title=check_data.title,
        payment_methods=check_data.payment_methods.model_dump(exclude_none=True),
        currency=check_data.currency,
        tip_amount=check_data.tip_amount,
    )
    db.add(check)
    db.flush()

    for position, item_data in enumerate(check_data.items):
        # Initialize claims dict for all sub-items
        claims = {str(i): [] for i in range(item_data.quantity)}
        item = Item(
            check_id=check.id,
            name=item_data.name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            claims=claims,
            position=position,
        )
        db.add(item)

    db.commit()
    db.refresh(check)

    return check_to_response(check)


@router.get("/{code}", response_model=CheckResponse)
def get_check(code: str, db: Session = Depends(get_db)) -> CheckResponse:
    """Get a check by its code."""
    check = db.query(Check).filter(Check.code == code.upper()).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    return check_to_response(check)


@router.patch("/{code}", response_model=CheckResponse)
def update_check(
    code: str, check_data: CheckUpdate, db: Session = Depends(get_db)
) -> CheckResponse:
    """Update a check's currency, tip, or items."""
    check = db.query(Check).filter(Check.code == code.upper()).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    if check_data.currency is not None:
        check.currency = check_data.currency

    if check_data.tip_amount is not None:
        check.tip_amount = check_data.tip_amount

    if check_data.items is not None:
        db.query(Item).filter(Item.check_id == check.id).delete()

        for position, item_data in enumerate(check_data.items):
            claims = {str(i): [] for i in range(item_data.quantity)}
            item = Item(
                check_id=check.id,
                name=item_data.name,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                claims=claims,
                position=position,
            )
            db.add(item)

    db.commit()
    db.refresh(check)

    return check_to_response(check)


@router.post("/{code}/claim", response_model=CheckResponse)
def claim_item(
    code: str, claim_data: ClaimRequest, db: Session = Depends(get_db)
) -> CheckResponse:
    """Toggle claim for a specific sub-item."""
    check = db.query(Check).filter(Check.code == code.upper()).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    participant_name = claim_data.participant_name.strip()
    sub_index = str(claim_data.sub_item_index)

    # Find the item
    item = next((i for i in check.items if i.id == claim_data.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Validate sub-item index
    if claim_data.sub_item_index < 0 or claim_data.sub_item_index >= item.quantity:
        raise HTTPException(status_code=400, detail="Invalid sub-item index")

    # Initialize claims if needed
    if not item.claims:
        item.claims = {str(i): [] for i in range(item.quantity)}

    # Ensure the sub-item key exists
    if sub_index not in item.claims:
        item.claims[sub_index] = []

    # Toggle claim - need to create a new dict for SQLAlchemy to detect the change
    new_claims = dict(item.claims)
    current_claimants = list(new_claims.get(sub_index, []))

    if participant_name in current_claimants:
        current_claimants.remove(participant_name)
    else:
        current_claimants.append(participant_name)

    new_claims[sub_index] = current_claimants
    item.claims = new_claims

    db.commit()
    db.refresh(check)

    return check_to_response(check)


@router.get("/{code}/summary", response_model=CheckSummary)
def get_check_summary(code: str, db: Session = Depends(get_db)) -> CheckSummary:
    """Get a summary of the check with calculated amounts per participant."""
    check = db.query(Check).filter(Check.code == code.upper()).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    participant_subtotals: dict[str, Decimal] = {}
    unclaimed_total = Decimal("0.00")

    for item in check.items:
        claims = item.claims or {}

        for sub_index in range(item.quantity):
            claimants = claims.get(str(sub_index), [])

            if not claimants:
                unclaimed_total += item.unit_price
            else:
                # Split unit_price among all claimants of this sub-item
                share = item.unit_price / len(claimants)
                for name in claimants:
                    if name not in participant_subtotals:
                        participant_subtotals[name] = Decimal("0.00")
                    participant_subtotals[name] += share

    total_items = sum((item.unit_price * item.quantity for item in check.items), Decimal("0.00"))

    participants: list[ParticipantSummary] = []
    for name, subtotal in participant_subtotals.items():
        if total_items > 0:
            tip_share = (subtotal / total_items) * check.tip_amount
        else:
            tip_share = Decimal("0.00")

        participants.append(
            ParticipantSummary(
                name=name,
                items_subtotal=subtotal.quantize(Decimal("0.01")),
                tip_share=tip_share.quantize(Decimal("0.01")),
                total=(subtotal + tip_share).quantize(Decimal("0.01")),
            )
        )

    participants.sort(key=lambda p: p.name)

    return CheckSummary(
        check=check_to_response(check),
        participants=participants,
        unclaimed_total=unclaimed_total.quantize(Decimal("0.01")),
    )


ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


@router.post("/ocr", response_model=OCRResponse)
async def process_receipt(file: UploadFile = File(...)) -> OCRResponse:
    """Process a receipt image and extract items using OCR."""
    content_type = file.content_type or ""
    filename = file.filename or ""

    # Check by content type or file extension for HEIC (iOS may not send correct mime type)
    is_valid = (
        content_type in ALLOWED_IMAGE_TYPES
        or content_type.startswith("image/")
        or filename.lower().endswith((".heic", ".heif"))
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await file.read()

    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be less than 10MB")

    # Use appropriate mime type for Gemini
    mime_type = content_type if content_type in ALLOWED_IMAGE_TYPES else "image/jpeg"
    if filename.lower().endswith(".heic"):
        mime_type = "image/heic"
    elif filename.lower().endswith(".heif"):
        mime_type = "image/heif"

    return parse_receipt_image(image_data, mime_type)
