import asyncio
import logging

import aiohttp
from sqlmodel import select

from enums.webhook_event import WebhookEvent
from models.sql.webhook_subscription import WebhookSubscription
from services.database import get_async_session

LOGGER = logging.getLogger(__name__)

# Доставка: начальная попытка + ретраи с возрастающей задержкой. Полноценная
# очередь не нужна — у бота есть страховка через поллинг
# /api/v1/async-tasks/{id}; вебхук только ускоряет ответ.
WEBHOOK_DELIVERY_ATTEMPTS = 4
WEBHOOK_RETRY_BACKOFF_SECONDS: tuple[float, ...] = (2, 5, 10)
WEBHOOK_DELIVERY_TIMEOUT = aiohttp.ClientTimeout(total=10)


class WebhookService:
    @classmethod
    async def send_webhook(cls, event: WebhookEvent, data: dict):
        async for sql_session in get_async_session():
            webhook_subscriptions = await sql_session.scalars(
                select(WebhookSubscription).where(WebhookSubscription.event == event.value)
            )
            webhook_subscriptions = list(webhook_subscriptions)
            if not webhook_subscriptions:
                return

            async_tasks = []
            for webhook_subscription in webhook_subscriptions:
                async_tasks.append(cls.send_request_to_webhook(webhook_subscription, data))

            await asyncio.gather(*async_tasks)

            break

    @classmethod
    async def send_request_to_webhook(cls, subscription: WebhookSubscription, data: dict):
        """Доставляет событие в один вебхук с ретраями.

        Ретраятся сетевые ошибки и ответы 5xx/429 (временные сбои). Прочие 4xx
        не ретраятся — это постоянная ошибка конфигурации подписки. Метод не
        бросает исключений: один неудачный вебхук не должен ронять соседние
        доставки в общем gather.
        """
        headers = {
            "Content-Type": "application/json",
        }
        if subscription.secret:
            headers["Authorization"] = f"Bearer {subscription.secret}"

        last_error = "unknown error"
        for attempt in range(1, WEBHOOK_DELIVERY_ATTEMPTS + 1):
            try:
                async with aiohttp.ClientSession(timeout=WEBHOOK_DELIVERY_TIMEOUT) as session:
                    async with session.post(
                        subscription.url,
                        json=data,
                        headers=headers,
                    ) as response:
                        body = await response.text()
                        if 200 <= response.status < 300:
                            if attempt > 1:
                                LOGGER.info(
                                    "Webhook %s delivered after %d attempts",
                                    subscription.id,
                                    attempt,
                                )
                            return
                        last_error = f"HTTP {response.status}: {body[:200]}"
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"

            if attempt < WEBHOOK_DELIVERY_ATTEMPTS and cls._is_retryable(last_error):
                delay = WEBHOOK_RETRY_BACKOFF_SECONDS[attempt - 1]
                LOGGER.warning(
                    "Webhook %s delivery failed (attempt %d/%d): %s; retrying in %ss",
                    subscription.id,
                    attempt,
                    WEBHOOK_DELIVERY_ATTEMPTS,
                    last_error,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                break

        LOGGER.error(
            "Webhook %s delivery failed after %d attempts: %s",
            subscription.id,
            attempt,
            last_error,
        )

    @staticmethod
    def _is_retryable(last_error: str) -> bool:
        """True для сетевых сбоев и временных HTTP-ошибок (5xx, 429)."""
        if not last_error.startswith("HTTP "):
            return True  # сетевая ошибка / таймаут
        status = int(last_error.split(":")[0].removeprefix("HTTP "))
        return status >= 500 or status == 429
