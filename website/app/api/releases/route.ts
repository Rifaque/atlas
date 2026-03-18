import { NextResponse } from "next/server";
import { fetchLatestRelease, RELEASE_CACHE_SECONDS } from "@/lib/github";

export async function GET() {
  try {
    const latestRelease = await fetchLatestRelease();
    return NextResponse.json(latestRelease, {
      status: 200,
      headers: {
        "Cache-Control": `public, s-maxage=${RELEASE_CACHE_SECONDS}, stale-while-revalidate=60`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected release fetch failure";
    return NextResponse.json(
      {
        error: "release_unavailable",
        message
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
