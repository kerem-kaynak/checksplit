from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BankAccount(BaseModel):
    account_holder: str = Field(..., min_length=1, max_length=70)
    iban: str = Field(..., min_length=15, max_length=34)


class PayPalMethod(BaseModel):
    url: str = Field(..., pattern=r"^https?://paypal\.me/[\w-]+$")


class OtherMethod(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class PaymentMethods(BaseModel):
    bank: BankAccount | None = None
    paypal: PayPalMethod | None = None
    other: OtherMethod | None = None

    @model_validator(mode="after")
    def at_least_one_method(self) -> "PaymentMethods":
        if not any([self.bank, self.paypal, self.other]):
            raise ValueError("At least one payment method is required")
        return self


class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(default=1, ge=1)
    unit_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    total_price: Decimal | None = Field(None, ge=0, decimal_places=2)

    @model_validator(mode="after")
    def calculate_prices(self) -> "ItemCreate":
        if self.unit_price is None and self.total_price is None:
            raise ValueError("Either unit_price or total_price must be provided")
        if self.unit_price is None and self.total_price is not None:
            self.unit_price = (self.total_price / self.quantity).quantize(Decimal("0.01"))
        if self.total_price is None and self.unit_price is not None:
            self.total_price = (self.unit_price * self.quantity).quantize(Decimal("0.01"))
        return self


class ItemResponse(BaseModel):
    id: UUID
    name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    claims: dict[str, list[str]]  # {"0": ["Alice"], "1": ["Bob", "Charlie"], ...}

    model_config = ConfigDict(from_attributes=True)


class CheckBase(BaseModel):
    currency: str = Field(default="EUR", pattern="^[A-Z]{3}$")
    tip_amount: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)


class CheckCreate(CheckBase):
    title: str | None = Field(None, max_length=255)
    payment_methods: PaymentMethods
    items: list[ItemCreate]


class CheckUpdate(BaseModel):
    currency: str | None = Field(None, pattern="^[A-Z]{3}$")
    tip_amount: Decimal | None = Field(None, ge=0, decimal_places=2)
    items: list[ItemCreate] | None = None


class CheckResponse(CheckBase):
    id: UUID
    code: str
    title: str | None
    payment_methods: PaymentMethods | None
    created_at: datetime
    items: list[ItemResponse]

    model_config = ConfigDict(from_attributes=True)


class ClaimRequest(BaseModel):
    participant_name: str = Field(..., min_length=1, max_length=100)
    item_id: UUID
    sub_item_index: int = Field(..., ge=0)


class ParticipantSummary(BaseModel):
    name: str
    items_subtotal: Decimal
    tip_share: Decimal
    total: Decimal


class CheckSummary(BaseModel):
    check: CheckResponse
    participants: list[ParticipantSummary]
    unclaimed_total: Decimal


class OCRItem(BaseModel):
    name: str
    quantity: int
    unit_price: Decimal


class OCRResponse(BaseModel):
    items: list[OCRItem]
    currency: str | None = Field(default=None, pattern="^[A-Z]{3}$")
