import { createHash, timingSafeEqual } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { DitherSettings } from "@/lib/dither/types";
import type { GalleryFormat, GalleryPage, GalleryPost } from "./shared";

/**
 * Gallery storage: posts and their images (1× PNG/GIF, small) in Neon Postgres. Server only.
 *
 * Environment:
 * - DATABASE_URL (or POSTGRES_URL): set by the Neon integration.
 * - GALLERY_ADMIN_TOKEN: a long random secret; sign in with it on /admin to approve posts.
 */

export class GalleryNotConfigured extends Error {
  constructor() {
    super("The gallery isn't set up yet.");
  }
}

export const PAGE_SIZE = 24;
/** Posts one visitor may submit per hour. */
const HOURLY_LIMIT = 5;
/** Stop taking submissions while this many wait for review, so abuse can't fill the store. */
const MAX_PENDING = 300;

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new GalleryNotConfigured();
  return neon(url);
}


let schema: Promise<void> | null = null;

/** Creates the table on first use, so there is no migration step. */
function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  schema ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS gallery_posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        author text NOT NULL,
        image bytea NOT NULL,
        format text NOT NULL,
        width int NOT NULL,
        height int NOT NULL,
        settings jsonb NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        ip_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        approved_at timestamptz
      )`;
    await sql`CREATE INDEX IF NOT EXISTS gallery_posts_live ON gallery_posts (approved_at DESC, id DESC) WHERE status = 'approved'`;
    await sql`CREATE INDEX IF NOT EXISTS gallery_posts_ip ON gallery_posts (ip_hash, created_at)`;
  })().catch((err) => {
    schema = null;
    throw err;
  });
  return schema;
}

async function query() {
  const sql = db();
  await ensureSchema(sql);
  return sql;
}

type Row = {
  id: string;
  title: string;
  author: string;
  format: GalleryFormat;
  width: number;
  height: number;
  settings: DitherSettings;
  created_at: Date | string;
  approved_at: Date | string | null;
};

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();

const toPost = (r: Row): GalleryPost => ({
  id: r.id,
  title: r.title,
  author: r.author,
  imageUrl: `/api/gallery/image/${r.id}`,
  format: r.format,
  width: r.width,
  height: r.height,
  settings: r.settings,
  date: iso(r.approved_at ?? r.created_at),
});

/** Everything but the image bytes, which are served by their own route. */
const COLUMNS = "id, title, author, format, width, height, settings, created_at, approved_at";

/** Cursor of a post in the approved list: its approval time and id. */
const cursorOf = (p: GalleryPost) => `${p.date}_${p.id}`;

/** Approved posts, newest first. `before` is the `next` cursor of the previous page. */
export async function listApproved(before: string | null): Promise<GalleryPage> {
  const sql = await query();
  const [time, id] = before?.split("_") ?? [];
  const valid = time && id && !Number.isNaN(Date.parse(time)) && /^[0-9a-f-]{36}$/i.test(id);
  const rows = (
    valid
      ? await sql`
          SELECT ${sql.unsafe(COLUMNS)} FROM gallery_posts
          WHERE status = 'approved' AND (approved_at, id) < (${time}::timestamptz, ${id}::uuid)
          ORDER BY approved_at DESC, id DESC LIMIT ${PAGE_SIZE + 1}`
      : await sql`
          SELECT ${sql.unsafe(COLUMNS)} FROM gallery_posts WHERE status = 'approved'
          ORDER BY approved_at DESC, id DESC LIMIT ${PAGE_SIZE + 1}`
  ) as Row[];
  const posts = rows.slice(0, PAGE_SIZE).map(toPost);
  return { posts, next: rows.length > PAGE_SIZE ? cursorOf(posts[posts.length - 1]) : null };
}

/** Pseudonymous visitor id for rate limiting; the IP itself is never stored. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${process.env.GALLERY_ADMIN_TOKEN ?? ""}:${ip}`).digest("hex").slice(0, 32);
}

/** Why a visitor can't submit right now, or null if they can. */
export async function submissionBlocked(ipHash: string): Promise<string | null> {
  const sql = await query();
  const [{ recent }] = (await sql`
    SELECT count(*)::int AS recent FROM gallery_posts
    WHERE ip_hash = ${ipHash} AND created_at > now() - interval '1 hour'`) as { recent: number }[];
  if (recent >= HOURLY_LIMIT) return "You've published a lot in the last hour. Try again later.";
  const [{ pending }] = (await sql`
    SELECT count(*)::int AS pending FROM gallery_posts WHERE status = 'pending'`) as { pending: number }[];
  if (pending >= MAX_PENDING) return "The review queue is full right now. Try again later.";
  return null;
}

export async function createPost(post: {
  title: string;
  author: string;
  image: Uint8Array;
  format: GalleryFormat;
  width: number;
  height: number;
  settings: DitherSettings;
  ipHash: string;
}): Promise<void> {
  const sql = await query();
  await sql`
    INSERT INTO gallery_posts (title, author, image, format, width, height, settings, ip_hash)
    VALUES (${post.title}, ${post.author}, decode(${Buffer.from(post.image).toString("base64")}, 'base64'),
      ${post.format}, ${post.width}, ${post.height}, ${JSON.stringify(post.settings)}::jsonb, ${post.ipHash})`;
}

export async function listPending(): Promise<GalleryPost[]> {
  const sql = await query();
  const rows = (await sql`
    SELECT ${sql.unsafe(COLUMNS)} FROM gallery_posts WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`) as Row[];
  return rows.map(toPost);
}

/** True if a pending post was approved. */
export async function approvePost(id: string): Promise<boolean> {
  const sql = await query();
  const rows = await sql`
    UPDATE gallery_posts SET status = 'approved', approved_at = now()
    WHERE id = ${id}::uuid AND status = 'pending' RETURNING id`;
  return rows.length > 0;
}

/** Deletes a post (pending or live) with its image. True if there was one. */
export async function deletePost(id: string): Promise<boolean> {
  const sql = await query();
  const rows = await sql`DELETE FROM gallery_posts WHERE id = ${id}::uuid RETURNING id`;
  return rows.length > 0;
}

/**
 * A post's image bytes. Pending posts are served too: their ids only ever reach the admin, and
 * the review page needs to show them.
 */
export async function getImage(id: string): Promise<{ bytes: Buffer; format: GalleryFormat; approved: boolean } | null> {
  const sql = await query();
  const rows = (await sql`
    SELECT encode(image, 'base64') AS image, format, status FROM gallery_posts WHERE id = ${id}::uuid`) as {
    image: string;
    format: GalleryFormat;
    status: string;
  }[];
  const row = rows[0];
  return row ? { bytes: Buffer.from(row.image, "base64"), format: row.format, approved: row.status === "approved" } : null;
}

/** Checks `Authorization: Bearer <GALLERY_ADMIN_TOKEN>` in constant time. */
export function isAdmin(request: Request): boolean {
  const secret = process.env.GALLERY_ADMIN_TOKEN;
  if (!secret || secret.length < 16) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
