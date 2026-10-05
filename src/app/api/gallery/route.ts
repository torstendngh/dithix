import { checkImage, validateSubmission } from "@/lib/gallery/shared";
import { createPost, GalleryNotConfigured, hashIp, listApproved, submissionBlocked } from "@/lib/gallery/server";

/** Public gallery: GET lists approved posts (newest first), POST submits one for review. */

const fail = (error: string, status: number) => Response.json({ error }, { status });

function serverError(err: unknown) {
  if (err instanceof GalleryNotConfigured) return fail(err.message, 503);
  console.error("[gallery]", err);
  return fail("Something went wrong. Try again in a moment.", 500);
}

export async function GET(request: Request) {
  try {
    const before = new URL(request.url).searchParams.get("before");
    return Response.json(await listApproved(before));
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("The upload could not be read.", 400);
  }
  const fields = validateSubmission({
    title: form.get("title"),
    author: form.get("author"),
    agree: form.get("agree"),
    settings: form.get("settings"),
  });
  if (!fields.ok) return fail(fields.error, 400);
  const file = form.get("image");
  if (!(file instanceof Blob)) return fail("The image is missing.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = checkImage(bytes);
  if (!image.ok) return fail(image.error, 400);

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = hashIp(ip);
    const blocked = await submissionBlocked(ipHash);
    if (blocked) return fail(blocked, 429);
    await createPost({
      ...fields.value,
      image: bytes,
      format: image.format,
      width: image.width,
      height: image.height,
      ipHash,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
