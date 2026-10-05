import { getImage, isUuid } from "@/lib/gallery/server";

/** Serves a post's 1× image from the database. Approved images never change, so they cache well. */
export async function GET(_request: Request, ctx: RouteContext<"/api/gallery/image/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  try {
    const image = await getImage(id);
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": `image/${image.format}`,
        // A taken-down post can linger in caches for up to a day; pending ones aren't cached.
        "Cache-Control": image.approved ? "public, max-age=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not available", { status: 503 });
  }
}
