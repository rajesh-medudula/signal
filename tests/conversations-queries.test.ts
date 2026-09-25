import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  listCustomers,
  getCustomer,
  updateCustomerDetails,
  updateChannelConnectionDetails,
  listConversations,
  getConversation,
  updateConversationDetails,
  listMessages,
  getMessage,
} = await import("@/lib/conversations/queries");

/**
 * A minimal thenable stand-in for supabase-js's PostgrestFilterBuilder:
 * every chain method returns `this` and records what it was called
 * with, and the chain resolves to `result` when awaited — matching how
 * `.select().eq().order().returns()` behaves for real.
 */
function makeBuilder(result: { data: unknown; error: { message: string } | null }) {
  const calls: {
    select?: string;
    eq: [string, unknown][];
    order: [string, Record<string, unknown> | undefined][];
    lt?: [string, unknown];
    gt?: [string, unknown];
    or: string[];
    limit?: number;
    update?: Record<string, unknown>;
    terminal?: "maybeSingle" | "single" | "none";
  } = { eq: [], order: [], or: [] };

  const builder: Record<string, unknown> = {
    select: vi.fn((cols: string) => {
      calls.select = cols;
      return builder;
    }),
    eq: vi.fn((col: string, val: unknown) => {
      calls.eq.push([col, val]);
      return builder;
    }),
    order: vi.fn((col: string, opts?: Record<string, unknown>) => {
      calls.order.push([col, opts]);
      return builder;
    }),
    lt: vi.fn((col: string, val: unknown) => {
      calls.lt = [col, val];
      return builder;
    }),
    gt: vi.fn((col: string, val: unknown) => {
      calls.gt = [col, val];
      return builder;
    }),
    or: vi.fn((expr: string) => {
      calls.or.push(expr);
      return builder;
    }),
    limit: vi.fn((n: number) => {
      calls.limit = n;
      return builder;
    }),
    update: vi.fn((patch: Record<string, unknown>) => {
      calls.update = patch;
      return builder;
    }),
    maybeSingle: vi.fn(() => {
      calls.terminal = "maybeSingle";
      return builder;
    }),
    single: vi.fn(() => {
      calls.terminal = "single";
      return builder;
    }),
    returns: vi.fn(() => builder),
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  return { builder, calls };
}

function fakeSupabase(result: { data: unknown; error: { message: string } | null }) {
  const { builder, calls } = makeBuilder(result);
  const from = vi.fn(() => builder);
  return { supabase: { from } as never, calls, from };
}

const businessId = "biz-1";

describe("listCustomers", () => {
  it("maps snake_case rows to the Customer domain shape, filtered by business_id", async () => {
    const row = {
      id: "cust-1",
      business_id: businessId,
      display_name: "Ravi Kumar",
      primary_email: "ravi@example.com",
      primary_phone: null,
      metadata: { source: "instagram" },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };
    const { supabase, calls, from } = fakeSupabase({ data: [row], error: null });

    const result = await listCustomers(supabase, businessId);

    expect(from).toHaveBeenCalledWith("customers");
    expect(calls.eq).toContainEqual(["business_id", businessId]);
    expect(result).toEqual([
      {
        id: "cust-1",
        businessId,
        displayName: "Ravi Kumar",
        primaryEmail: "ravi@example.com",
        primaryPhone: null,
        metadata: { source: "instagram" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("throws when the query errors", async () => {
    const { supabase } = fakeSupabase({ data: null, error: { message: "boom" } });

    await expect(listCustomers(supabase, businessId)).rejects.toThrow(/boom/);
  });
});

describe("getCustomer", () => {
  it("returns null when no row matches", async () => {
    const { supabase } = fakeSupabase({ data: null, error: null });

    const result = await getCustomer(supabase, businessId, "cust-404");

    expect(result).toBeNull();
  });
});

describe("updateCustomerDetails", () => {
  it("only patches fields that were actually provided", async () => {
    const row = {
      id: "cust-1",
      business_id: businessId,
      display_name: "Renamed",
      primary_email: null,
      primary_phone: null,
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-03T00:00:00.000Z",
    };
    const { supabase, calls } = fakeSupabase({ data: row, error: null });

    const result = await updateCustomerDetails(supabase, businessId, "cust-1", {
      displayName: "Renamed",
    });

    expect(calls.update).toEqual({ display_name: "Renamed" });
    expect(result.displayName).toBe("Renamed");
  });
});

describe("updateChannelConnectionDetails", () => {
  it("only ever patches display_label/status — never the immutable columns", async () => {
    const row = {
      id: "cc-1",
      business_id: businessId,
      channel: "gmail",
      display_label: "Renamed inbox",
      external_account_id: "acct-1",
      status: "disconnected",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-03T00:00:00.000Z",
    };
    const { supabase, calls } = fakeSupabase({ data: row, error: null });

    const result = await updateChannelConnectionDetails(supabase, businessId, "cc-1", {
      displayLabel: "Renamed inbox",
      status: "disconnected",
    });

    expect(calls.update).toEqual({
      display_label: "Renamed inbox",
      status: "disconnected",
    });
    expect(result.channel).toBe("gmail");
  });
});

describe("listConversations", () => {
  it("defaults to a limit of 50, most-recently-active first, with no status/cursor filters", async () => {
    const { supabase, calls } = fakeSupabase({ data: [], error: null });

    await listConversations(supabase, businessId);

    expect(calls.limit).toBe(50);
    expect(calls.order).toContainEqual([
      "last_message_at",
      { ascending: false, nullsFirst: false },
    ]);
    expect(calls.lt).toBeUndefined();
  });

  it("applies a status filter and a last_message_at cursor when given", async () => {
    const { supabase, calls } = fakeSupabase({ data: [], error: null });

    await listConversations(supabase, businessId, {
      status: "open",
      cursor: "2026-01-01T00:00:00.000Z",
      limit: 10,
    });

    expect(calls.eq).toContainEqual(["status", "open"]);
    expect(calls.lt).toEqual(["last_message_at", "2026-01-01T00:00:00.000Z"]);
    expect(calls.limit).toBe(10);
  });

  it("normalizes bigint last_message_sequence to a string", async () => {
    const row = {
      id: "conv-1",
      business_id: businessId,
      customer_id: "cust-1",
      channel_connection_id: "cc-1",
      external_conversation_id: "thread-1",
      subject: null,
      status: "open",
      last_message_at: "2026-01-01T00:00:00.000Z",
      // PostgREST serializes int8/bigint as a JSON string precisely to
      // avoid precision loss beyond Number.MAX_SAFE_INTEGER — modeled
      // here as a string, not a JS number literal (a literal that big
      // would already have lost precision before this test even runs).
      last_message_sequence: "9007199254740993",
      last_message_preview: "Hello",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const { supabase } = fakeSupabase({ data: [row], error: null });

    const [conversation] = await listConversations(supabase, businessId);

    expect(conversation.lastMessageSequence).toBe("9007199254740993");
    expect(typeof conversation.lastMessageSequence).toBe("string");
  });
});

describe("getConversation", () => {
  it("returns null when RLS/absence filters the row away", async () => {
    const { supabase } = fakeSupabase({ data: null, error: null });

    const result = await getConversation(supabase, businessId, "conv-404");

    expect(result).toBeNull();
  });
});

describe("updateConversationDetails", () => {
  it("only ever patches subject/status — never the trigger-owned last_message_* fields", async () => {
    const row = {
      id: "conv-1",
      business_id: businessId,
      customer_id: "cust-1",
      channel_connection_id: "cc-1",
      external_conversation_id: "thread-1",
      subject: "New subject",
      status: "closed",
      last_message_at: null,
      last_message_sequence: null,
      last_message_preview: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-04T00:00:00.000Z",
    };
    const { supabase, calls } = fakeSupabase({ data: row, error: null });

    const result = await updateConversationDetails(supabase, businessId, "conv-1", {
      subject: "New subject",
      status: "closed",
    });

    expect(calls.update).toEqual({ subject: "New subject", status: "closed" });
    expect(result.status).toBe("closed");
  });
});

describe("listMessages", () => {
  it("with no cursor, defaults to the most recent page in descending order", async () => {
    const { supabase, calls } = fakeSupabase({ data: [], error: null });

    await listMessages(supabase, businessId, "conv-1");

    expect(calls.or).toEqual([]);
    expect(calls.order).toEqual([
      ["provider_sent_at", { ascending: false }],
      ["sequence", { ascending: false }],
    ]);
    expect(calls.limit).toBe(50);
  });

  it("direction: 'before' with a cursor builds a strict tuple-less-than filter, descending order", async () => {
    const { supabase, calls } = fakeSupabase({ data: [], error: null });

    await listMessages(supabase, businessId, "conv-1", {
      direction: "before",
      cursor: { providerSentAt: "2026-01-02T00:00:00.000Z", sequence: "42" },
    });

    expect(calls.or).toEqual([
      "provider_sent_at.lt.2026-01-02T00:00:00.000Z," +
        "and(provider_sent_at.eq.2026-01-02T00:00:00.000Z,sequence.lt.42)",
    ]);
    expect(calls.order).toEqual([
      ["provider_sent_at", { ascending: false }],
      ["sequence", { ascending: false }],
    ]);
  });

  it("direction: 'after' with a cursor builds a strict tuple-greater-than filter, ascending order", async () => {
    const { supabase, calls } = fakeSupabase({ data: [], error: null });

    await listMessages(supabase, businessId, "conv-1", {
      direction: "after",
      cursor: { providerSentAt: "2026-01-02T00:00:00.000Z", sequence: "42" },
    });

    expect(calls.or).toEqual([
      "provider_sent_at.gt.2026-01-02T00:00:00.000Z," +
        "and(provider_sent_at.eq.2026-01-02T00:00:00.000Z,sequence.gt.42)",
    ]);
    expect(calls.order).toEqual([
      ["provider_sent_at", { ascending: true }],
      ["sequence", { ascending: true }],
    ]);
  });

  it("normalizes bigint sequence to a string on every returned message", async () => {
    const row = {
      id: "msg-1",
      business_id: businessId,
      conversation_id: "conv-1",
      channel_connection_id: "cc-1",
      external_message_id: "ext-1",
      direction: "inbound",
      sender_type: "customer",
      sender_customer_id: "cust-1",
      sender_member_user_id: null,
      body: "hi",
      content_type: "text/plain",
      attachments: [],
      provider_metadata: {},
      provider_sent_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      // See the comment on last_message_sequence above.
      sequence: "9007199254740993",
    };
    const { supabase } = fakeSupabase({ data: [row], error: null });

    const [message] = await listMessages(supabase, businessId, "conv-1");

    expect(message.sequence).toBe("9007199254740993");
    expect(typeof message.sequence).toBe("string");
  });
});

describe("getMessage", () => {
  it("returns null when no row matches", async () => {
    const { supabase } = fakeSupabase({ data: null, error: null });

    const result = await getMessage(supabase, businessId, "msg-404");

    expect(result).toBeNull();
  });
});
