from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from enums.webhook_event import WebhookEvent
from models.sql.webhook_subscription import WebhookSubscription
from services.database import get_async_session

API_V1_WEBHOOK_ROUTER = APIRouter(prefix="/api/v1/webhook", tags=["Webhook"])


class SubscribeToWebhookRequest(BaseModel):
    url: str = Field(description="The URL to send the webhook to")
    secret: str | None = Field(None, description="The secret to use for the webhook")
    event: WebhookEvent = Field(description="The event to subscribe to")


class SubscribeToWebhookResponse(BaseModel):
    id: str


@API_V1_WEBHOOK_ROUTER.post(
    "/subscribe", response_model=SubscribeToWebhookResponse, status_code=201
)
async def subscribe_to_webhook(
    body: SubscribeToWebhookRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    webhook_subscription = WebhookSubscription(
        url=body.url,
        secret=body.secret,
        event=body.event,
    )
    sql_session.add(webhook_subscription)
    await sql_session.commit()
    return SubscribeToWebhookResponse(id=webhook_subscription.id)


@API_V1_WEBHOOK_ROUTER.delete("/unsubscribe", status_code=204)
async def unsubscribe_to_webhook(
    id: str = Body(
        embed=True, description="The ID of the webhook subscription to unsubscribe from"
    ),
    sql_session: AsyncSession = Depends(get_async_session),
):

    webhook_subscription = await sql_session.get(WebhookSubscription, id)
    if not webhook_subscription:
        raise HTTPException(404, "Webhook subscription not found")

    await sql_session.delete(webhook_subscription)
    await sql_session.commit()
