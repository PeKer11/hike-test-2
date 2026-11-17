import type { SupabaseClient } from "@supabase/supabase-js";

type Reply = { data?: unknown; error?: { code?: string } | null; count?: number };

/** A minimal Supabase stand-in: rpc by name, tables by name (every query chain resolves to the same reply). Records calls. */
export function fakeSupabase(opts: { rpc?: Record<string, Reply | ((args: Record<string, unknown>) => Reply)>; tables?: Record<string, Reply> } = {}) {
  const calls: { kind: "rpc" | "from"; name: string; args?: Record<string, unknown> }[] = [];
  const reply = (r: Reply | undefined) => ({ data: r?.data ?? null, error: r?.error ?? null, count: r?.count ?? null });
  const chain = (table: string): unknown => {
    const result = Promise.resolve(reply(opts.tables?.[table]));
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === "then") return result.then.bind(result);
        return () => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler);
  };
  const client = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ kind: "rpc", name, args });
      const h = opts.rpc?.[name];
      return reply(typeof h === "function" ? h(args) : h);
    },
    from: (table: string) => {
      calls.push({ kind: "from", name: table });
      return chain(table);
    },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  };
  return { client: client as unknown as SupabaseClient, calls };
}
