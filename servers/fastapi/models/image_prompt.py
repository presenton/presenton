from pydantic import BaseModel


class ImagePrompt(BaseModel):
    prompt: str
    theme_prompt: str | None = None

    def get_image_prompt(self, with_theme: bool = False) -> str:
        return f"{self.prompt}, {self.theme_prompt}" if with_theme else self.prompt
