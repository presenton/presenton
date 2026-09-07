from datetime import UTC, datetime


def get_current_utc_datetime():
    return datetime.now(UTC)
