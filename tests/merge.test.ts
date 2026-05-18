import { describe, expect, it } from "vitest";
import { mergeChunkTranscripts, removeOverlappingPrefix } from "@/lib/ai/merge";

describe("transcript merge", () => {
  it("removes repeated overlap from chunk prefixes", () => {
    const previous = "El cliente quiere vender flores en linea y necesita un sitio con carrito de compras.";
    const current = "quiere vender flores en linea y necesita un sitio con carrito de compras. Tambien necesita pagos.";

    expect(removeOverlappingPrefix(previous, current)).toBe("Tambien necesita pagos.");
  });

  it("keeps chunk headings while deduplicating text", () => {
    const merged = mergeChunkTranscripts([
      {
        heading: "## Parte 1",
        text: "El cliente quiere vender flores en linea y necesita un sitio con carrito de compras.",
      },
      {
        heading: "## Parte 2",
        text: "quiere vender flores en linea y necesita un sitio con carrito de compras. Tambien necesita pagos.",
      },
    ]);

    expect(merged).toContain("## Parte 1");
    expect(merged).toContain("## Parte 2");
    expect(merged).toContain("Tambien necesita pagos.");
  });
});
