import { createMcpHandler } from "mcp-handler";
import { requireMcpAuth } from "@better-auth/mcp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MCP_RESOURCE } from "@/lib/env";
import { reframeGuide } from "@/lib/reframe-guide";
import { addExperiences, getExperience, listExperiences, searchCareer, updateExperience } from "@/lib/career";

type Claims = { sub?: string; azp?: string; scope?: string };

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
});

// Lines carrying either marker are recorded but not yet confirmed by the owner.
const UNCONFIRMED = '"[unconfirmed]" or "확인 필요"';

function buildHandler(_claims: Claims) {
  return createMcpHandler(
    (server) => {
      server.registerTool(
        "list_experiences",
        {
          title: "List experiences",
          description:
            "Lists the user's whole career record: experience ID, parent ID and title. Call this first for any career question or job posting analysis.",
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        },
        async () => json(await listExperiences()),
      );

      server.registerTool(
        "get_experience",
        {
          title: "Get experience",
          description:
            `Returns one experience's body exactly as written. Do not use lines marked ${UNCONFIRMED} as evidence, ` +
            'and follow any usage rules written in the body (for example "do not use" or "only with this caveat").',
          inputSchema: z.object({ display_id: z.string().describe("Experience ID, for example A1-2") }),
          annotations: { readOnlyHint: true },
        },
        async ({ display_id }) => {
          const e = await getExperience(display_id);
          return e ? json(e) : fail(`No experience ${display_id}. Check the ID with list_experiences.`);
        },
      );

      server.registerTool(
        "search_career",
        {
          title: "Search career",
          description:
            "Finds lines that contain an exact word (company, tool, number). It does not match by meaning, so pick related experiences with list_experiences.",
          inputSchema: z.object({ query: z.string().min(1) }),
          annotations: { readOnlyHint: true },
        },
        async ({ query }) => json(await searchCareer(query)),
      );

      server.registerTool(
        "add_experiences",
        {
          title: "Add experiences",
          description:
            "Records one or more new experiences (a job, a project, an episode) in one call. Split a resume, portfolio or note into jobs and the projects inside them. " +
            "Rules: use only when the user asks to record something. Keep the user's sentences as written: do not summarize, polish, or add numbers, roles or results that are not in the source. " +
            'The body is Markdown, one point per line starting with "- ". Show the user how you split the text and get their agreement before calling. ' +
            "parent is an existing experience ID or a display_id that appears earlier in the same list. If any item fails, nothing is saved.",
          inputSchema: z.object({
            experiences: z
              .array(
                z.object({
                  title: z.string().min(1),
                  parent: z.string().optional().describe("Parent experience ID, for example A1"),
                  display_id: z.string().optional().describe("Leave empty to get N1, N2, ..."),
                  body: z.string().describe("Experience body (Markdown)"),
                }),
              )
              .min(1),
          }),
        },
        async ({ experiences }) => {
          try {
            return json({ created: await addExperiences(experiences) });
          } catch (e) {
            return fail(e);
          }
        },
      );

      server.registerTool(
        "update_experience",
        {
          title: "Update experience",
          description:
            "Changes an experience's title, parent or body. Use only when the user asks to record or fix something, and show the change and get their agreement first. " +
            "To add content, use append: it adds lines at the end and leaves existing lines untouched. body replaces the whole body, so use it only when the user asks to fix or remove specific lines, " +
            "and change only that part of what get_experience returned. Do not send append and body together. " +
            `When the user confirms a line marked ${UNCONFIRMED}, remove only the marker.`,
          inputSchema: z.object({
            display_id: z.string(),
            title: z.string().min(1).optional(),
            parent: z.string().nullable().optional().describe("Parent experience ID. null moves it to the top level"),
            append: z.string().min(1).optional().describe("Lines to add at the end (Markdown)"),
            body: z.string().optional().describe("Replaces the whole body"),
          }),
        },
        async ({ display_id, ...patch }) => {
          try {
            return json(await updateExperience(display_id, patch));
          } catch (e) {
            return fail(e);
          }
        },
      );

      server.registerTool(
        "get_reframe_guide",
        {
          title: "Reframe guide",
          description:
            "Returns the steps and rules for reading the user's experience against a job posting. Call it first whenever the user asks to analyze a posting or see their experience from another angle, then follow it.",
          inputSchema: z.object({ jd: z.string().describe("The job posting text") }),
          annotations: { readOnlyHint: true },
        },
        async ({ jd }) => ({ content: [{ type: "text", text: reframeGuide(jd) }] }),
      );
    },
    {
      serverInfo: { name: "career", version: "0.4.0" },
      instructions:
        `The user's career record. Base every claim about their career only on what is written here and cite experience IDs. Do not use lines marked ${UNCONFIRMED}, or numbers that are not recorded here.`,
    },
  );
}


// Record which client / protocol actually talks to us, so mobile and web runs can be compared.
async function logRequest(request: Request, claims: Claims) {
  try {
    const body = await request.clone().json();
    const msgs = Array.isArray(body) ? body : [body];
    for (const m of msgs) {
      const p = m?.params ?? {};
      const meta = p._meta ?? {};
      const clientInfo = p.clientInfo ?? meta["io.modelcontextprotocol/clientInfo"] ?? meta.clientInfo;
      await db
        .insertInto("mcp_request_log")
        .values({
          id: undefined,
          at: new Date(),
          rpc_method: m?.method ?? null,
          protocol_version:
            p.protocolVersion ??
            meta["io.modelcontextprotocol/protocolVersion"] ??
            request.headers.get("mcp-protocol-version"),
          client_name: clientInfo?.name ?? null,
          client_version: clientInfo?.version ?? null,
          user_agent: request.headers.get("user-agent"),
          azp: claims.azp ?? null,
          capabilities: (() => {
            const caps = p.capabilities ?? meta["io.modelcontextprotocol/clientCapabilities"];
            return caps ? JSON.stringify(caps) : null;
          })(),
        })
        .execute();
    }
  } catch {
    // logging must never break the MCP call
  }
}

const handler = requireMcpAuth(
  auth,
  async (request, claims) => {
    const c = claims as Claims;
    await logRequest(request, c);
    return buildHandler(c)(request);
  },
  { resource: MCP_RESOURCE },
);

export { handler as GET, handler as POST, handler as DELETE };
