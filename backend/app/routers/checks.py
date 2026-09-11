from decimal import Decimal
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.check import Check, Item, Payment
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
    PaymentUpdate,
)
from app.services.ocr import parse_receipt_image
from app.services.exchange import ExchangeRateError, get_exchange_rate

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
    try:
        rate = await get_exchange_rate(from_currency.upper(), to_currency.upper())
    except ExchangeRateError as e:
        raise HTTPException(status_code=503, detail="Could not fetch exchange rate.") from e
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
    check = db.query(Check).filter(Check.code == code.upper()).with_for_update().first()
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
    check = db.query(Check).filter(Check.code == code.upper()).with_for_update().first()
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


def build_check_summary(check: Check) -> CheckSummary:
    """Calculate current shares and compare them to recorded payments."""
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

    payments = {payment.participant_name: payment for payment in check.payments}
    # Retain a payment even if an edit or unclaim removes all of that person's items.
    for name in payments:
        participant_subtotals.setdefault(name, Decimal("0.00"))

    participants: list[ParticipantSummary] = []
    for name, subtotal in participant_subtotals.items():
        if total_items > 0:
            tip_share = (subtotal / total_items) * check.tip_amount
        else:
            tip_share = Decimal("0.00")

        total = (subtotal + tip_share).quantize(Decimal("0.01"))
        payment = payments.get(name)
        payment_status = "unpaid"
        if payment:
            payment_status = (
                "paid"
                if payment.amount == total and payment.currency == check.currency
                else "needs_review"
            )

        participants.append(
            ParticipantSummary(
                name=name,
                items_subtotal=subtotal.quantize(Decimal("0.01")),
                tip_share=tip_share.quantize(Decimal("0.01")),
                total=total,
                payment_status=payment_status,
                paid_amount=payment.amount if payment else None,
                paid_currency=payment.currency if payment else None,
                paid_at=payment.paid_at if payment else None,
            )
        )

    participants.sort(key=lambda p: p.name)

    return CheckSummary(
        check=check_to_response(check),
        participants=participants,
        unclaimed_total=unclaimed_total.quantize(Decimal("0.01")),
    )


@router.get("/{code}/summary", response_model=CheckSummary)
def get_check_summary(code: str, db: Session = Depends(get_db)) -> CheckSummary:
    """Get current amounts and self-reported payment status for everyone."""
    check = db.query(Check).filter(Check.code == code.upper()).first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    return build_check_summary(check)


@router.put("/{code}/payment", response_model=CheckSummary)
def update_payment(
    code: str, payment_data: PaymentUpdate, db: Session = Depends(get_db)
) -> CheckSummary:
    # Claims, edits and payment updates share this lock so the recorded amount
    # cannot race with a change to the split. Repeated requests set, not toggle.
    check = db.query(Check).filter(Check.code == code.upper()).with_for_update().first()
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")

    name = payment_data.participant_name
    payment = next((p for p in check.payments if p.participant_name == name), None)

    if payment_data.paid:
        participant = next((p for p in build_check_summary(check).participants if p.name == name), None)
        if participant is None or participant.total <= 0:
            raise HTTPException(status_code=400, detail="Claim items with a positive total before marking your share as paid.")
        if (
            participant.total != payment_data.expected_total
            or check.currency != payment_data.expected_currency
        ):
            raise HTTPException(status_code=409, detail="Your share changed. Review the updated amount and try again.")

        if payment is None:
            payment = Payment(participant_name=name)
            check.payments.append(payment)
        if payment.amount != participant.total or payment.currency != check.currency:
            payment.amount = participant.total
            payment.currency = check.currency
            payment.paid_at = datetime.now(timezone.utc)
    elif payment is not None:
        check.payments.remove(payment)

    db.commit()
    db.refresh(check)
    return build_check_summary(check)


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
