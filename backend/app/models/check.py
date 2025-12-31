import uuid
import secrets
import string
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import String, Numeric, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.check import Item


def generate_code() -> str:
    """Generate a 6-character alphanumeric code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class Check(Base):
    __tablename__ = "checks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(6), unique=True, index=True, default=generate_code
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    tip_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["Item"]] = relationship(
        "Item", back_populates="check", cascade="all, delete-orphan", order_by="Item.position"
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    check_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checks.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Claims stored as {"0": ["Alice"], "1": ["Bob", "Charlie"], ...}
    # Keys are sub-item indices (0 to quantity-1), values are lists of claimant names
    claims: Mapped[dict[str, list[str]]] = mapped_column(JSONB, default=dict)
    position: Mapped[int] = mapped_column(Integer, default=0)

    check: Mapped["Check"] = relationship("Check", back_populates="items")

    @property
    def total_price(self) -> Decimal:
        return self.unit_price * self.quantity

    def initialize_claims(self) -> None:
        """Initialize empty claims dict for all sub-items."""
        if not self.claims:
            self.claims = {str(i): [] for i in range(self.quantity)}
