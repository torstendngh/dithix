import { approvePost, deletePost, GalleryNotConfigured, isAdmin, isUuid, listPending } from "@/lib/gallery/server";

/** Review queue, behind `Authorization: Bearer <GALLERY_ADMIN_TOKEN>`. */

const fail = (error: string, status: number) => Response.json({ error }, { status });

function serverError(err: unknown) {
  if (err instanceof GalleryNotConfigured) return fail(err.message, 503);
  console.error("[gallery admin]", err);
  return fail("Something went wrong.", 500);
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return fail("Wrong admin token.", 401);
  try {
    return Response.json({ posts: await listPending() });
  } catch (err) {
    return serverError(err);
  }
}

/** Body: { id, action: "approve" | "delete" }. Delete works on pending and live posts. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return fail("Wrong admin token.", 401);
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  if (!body || !isUuid(body.id)) return fail("Missing post id.", 400);
  try {
    if (body.action === "approve") {
      return (await approvePost(body.id)) ? Response.json({ ok: true }) : fail("No pending post with that id.", 404);
    }
    if (body.action === "delete") {
      return (await deletePost(body.id)) ? Response.json({ ok: true }) : fail("No post with that id.", 404);
    }
    return fail("Unknown action.", 400);
  } catch (err) {
    return serverError(err);
  }
}
