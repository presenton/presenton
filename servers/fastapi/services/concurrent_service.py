import asyncio
from asyncio import Task
from collections.abc import Callable, Coroutine
from typing import Any


class ConcurrentService:
    def __init__(self):
        self._background_tasks = set[Task]()

    def run_task(
        self,
        delay: int | None,
        callable: Callable[..., Coroutine[Any, Any, Any]],
        *args,
        **kwargs,
    ):
        async def wrapper():
            if delay:
                await asyncio.sleep(delay)
            await callable(*args, **kwargs)

        task = asyncio.create_task(wrapper())

        # Avoid printing asyncio.Task repr (<Task pending ...>) — it looks like a hung bug.
        print(f"Background task started: {callable.__name__}")

        self._background_tasks.add(task)
        task.add_done_callback(self.on_task_done)

    def on_task_done(self, task: Task):
        exc = task.exception()
        if exc:
            print(f"Background task finished: failed ({exc})")
        else:
            print("Background task finished: ok")

        self._background_tasks.discard(task)


CONCURRENT_SERVICE = ConcurrentService()
