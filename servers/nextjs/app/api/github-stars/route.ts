import { NextResponse } from "next/server";

const GITHUB_REPOSITORY_API_URL =
  "https://api.github.com/repos/presenton/presenton";

type GitHubRepositoryResponse = {
  stargazers_count?: unknown;
};

export const revalidate = 3600;

export async function GET() {
  try {
    const response = await fetch(GITHUB_REPOSITORY_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "presenton-dashboard",
      },
      next: { revalidate },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch GitHub stars" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as GitHubRepositoryResponse;

    if (typeof data.stargazers_count !== "number") {
      return NextResponse.json(
        { error: "Invalid GitHub repository response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ stars: data.stargazers_count });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch GitHub stars" },
      { status: 502 }
    );
  }
}
