import { defineMcp } from "@lovable.dev/mcp-js";
import listTrendingSongs from "./tools/list-trending-songs";
import searchSongs from "./tools/search-songs";

export default defineMcp({
  name: "jux-music-mcp",
  title: "Jux Music",
  version: "0.1.0",
  instructions: "Outils publics et en lecture seule pour découvrir le catalogue musical Jux Music et ses tendances. N'utilise jamais ces outils pour modifier des données.",
  tools: [searchSongs, listTrendingSongs],
});