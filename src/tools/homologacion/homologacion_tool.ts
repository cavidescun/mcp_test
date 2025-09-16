import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { homologacionAprobada } from "../../services/homologaciones/homologacion.js";

export function homologacion_mcp_tools(server: McpServer){
   server.registerTool(
    "buscar_homologaciones_aprobadas",
    {
      title: "Buscar homologaciones aprobadas",
      description: "Busca homologaciones aprobadas junto con la respectiva informacion"
    },
    async ({ query, maxResults }) => {
      try {
        const results = await homologacionAprobada();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (err) {
        const e = err as Error;

        return {
          content: [
            {
              type: "text",
              text: `Error consultando homologaciones: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}