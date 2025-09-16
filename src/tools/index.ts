import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { homologacion_mcp_tools } from "./homologacion/homologacion_tool.js"; 
import { database_mcp_tools } from "./db/db_tool.js";

export function mpc_tools(server: McpServer){

  homologacion_mcp_tools(server);
  database_mcp_tools(server);

}