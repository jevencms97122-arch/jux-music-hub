import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { escapePocketBaseFilter, listPocketBaseRecords, publicSong } from "../pocketbase";

export default defineTool({
  name: "search_songs",
  title: "Rechercher des titres",
  description: "Recherche des morceaux publics du catalogue Jux Music par titre, artiste ou genre.",
  inputSchema: {
    query: z.string().trim().describe("Titre, artiste ou genre à rechercher."),
    limit: z.number().int().optional().describe("Nombre maximal de résultats, de 1 à 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }) => {
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 20);
    const term = escapePocketBaseFilter(query.slice(0, 100));
    const filter = term
      ? `title ~ "${term}" || author ~ "${term}" || genre ~ "${term}"`
      : undefined;

    try {
      const records = await listPocketBaseRecords("songs", {
        perPage: safeLimit,
        filter,
        sort: "-weekly_play_count,-play_count",
      });
      const songs = records.map(publicSong);
      return {
        content: [{ type: "text", text: songs.length ? JSON.stringify(songs) : "Aucun titre trouvé." }],
        structuredContent: { songs },
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : "Recherche indisponible." }],
        isError: true,
      };
    }
  },
});