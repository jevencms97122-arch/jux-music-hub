import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { listPocketBaseRecords, publicSong } from "../pocketbase";

export default defineTool({
  name: "list_trending_songs",
  title: "Titres tendance",
  description: "Liste les morceaux publics les plus écoutés sur Jux Music pendant la période hebdomadaire en cours.",
  inputSchema: {
    limit: z.number().int().optional().describe("Nombre maximal de titres, de 1 à 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ limit }) => {
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 10);
    try {
      const records = await listPocketBaseRecords("songs", {
        perPage: safeLimit,
        sort: "-weekly_play_count,-play_count",
      });
      const songs = records.map((record, index) => ({ rank: index + 1, ...publicSong(record) }));
      return {
        content: [{ type: "text", text: songs.length ? JSON.stringify(songs) : "Aucun titre tendance disponible." }],
        structuredContent: { songs },
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : "Tendances indisponibles." }],
        isError: true,
      };
    }
  },
});