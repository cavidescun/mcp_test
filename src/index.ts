import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { homologacion_mcp_tools } from "./tools/homologacion/homologacion_tool.js";
import { database_mcp_tools } from "./tools/db/db_tool.js";
import 'dotenv/config';


async function main() {
  const server = new McpServer({
    name: "MPC-Test",
    version: "1.0.0",
  });


  homologacion_mcp_tools(server);
  database_mcp_tools(server);

  // registrar prompts

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("MCP funcionando")
}

main().catch((err) => {
  console.error("MCP fallando", err);
});
