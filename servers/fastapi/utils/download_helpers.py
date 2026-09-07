import asyncio
import mimetypes
import os
import uuid
from urllib.parse import urlparse

import aiohttp


async def download_file(url: str, save_directory: str, headers: dict | None = None) -> str | None:
    try:
        os.makedirs(save_directory, exist_ok=True)

        parsed_url = urlparse(url)
        filename = os.path.basename(parsed_url.path)

        if not filename or "." not in filename:
            async with aiohttp.ClientSession(trust_env=True) as session:
                async with session.head(url, headers=headers) as response:
                    if response.status == 200:
                        content_disposition = response.headers.get("Content-Disposition", "")
                        if "filename=" in content_disposition:
                            filename = content_disposition.split("filename=")[1].strip("\"'")
                        else:
                            content_type = response.headers.get("Content-Type", "")
                            if content_type:
                                extension = mimetypes.guess_extension(content_type.split(";")[0])
                                if extension:
                                    filename = f"{uuid.uuid4()}{extension}"

        filename = filename or str(uuid.uuid4())
        save_path = os.path.join(save_directory, filename)

        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    with open(save_path, "wb") as file:
                        async for chunk in response.content.iter_chunked(8192):
                            file.write(chunk)
                    print(f"File downloaded successfully: {save_path}")
                    return save_path
                else:
                    print(f"Failed to download file. HTTP status: {response.status}")
                    return None

    except Exception as e:
        print(f"Error downloading file from {url}: {e}")
        return None


async def download_files(
    urls: list[str], save_directory: str, headers: dict | None = None
) -> list[str | None]:
    print(f"Starting download of {len(urls)} files to {save_directory}")
    coroutines = [download_file(url, save_directory, headers) for url in urls]
    results = await asyncio.gather(*coroutines, return_exceptions=True)
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Exception during download of {urls[i]}: {result}")
            final_results.append(None)
        else:
            final_results.append(result)

    successful_downloads = sum(1 for result in final_results if result is not None)
    print(f"Download completed: {successful_downloads}/{len(urls)} files downloaded successfully")

    return final_results
