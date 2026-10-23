/**
 * The slice of the Pages Functions runtime this project uses, declared here
 * rather than pulled from `@cloudflare/workers-types`.
 *
 * The frontend has no Workers types installed, and `web/functions` is outside
 * the app's `tsconfig` include, so the Functions bundle is type-checked by
 * `npm run typecheck:functions` against this file alone. Declaring what is used
 * keeps the deploy build free of a dependency it does not otherwise need.
 */

export interface AssetFetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

/** The two KV methods the edge uses: read a version, and nothing else. */
export interface KvLike {
  get(key: string): Promise<string | null>;
}

export interface PagesEnv {
  /** The built site, served by Pages. Always present in production. */
  ASSETS: AssetFetcher;
  /**
   * Origin of the API Worker, for the live deal data a deal page needs.
   *
   * Optional: when it is absent the origin the browser uses is read out of the
   * app shell instead (see `resolveApiOrigin`), so deal pages are annotated with
   * no configuration at all. Set it only when the edge must reach a different
   * origin than the browser does.
   */
  API_ORIGIN?: string;
  /**
   * Optional KV namespace holding a `deals` content version. Bound in both the
   * Pages project and the Worker, it lets a deal write purge the cached HTML
   * immediately instead of waiting out the TTL.
   */
  CONTENT_VERSION_KV?: KvLike;
  [key: string]: unknown;
}

export interface PagesContext<E = PagesEnv> {
  request: Request;
  env: E;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  /** Continue to the static asset pipeline (`_redirects`, `_headers`, 404 stub). */
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}

export type PagesFunction<E = PagesEnv> = (context: PagesContext<E>) => Response | Promise<Response>;