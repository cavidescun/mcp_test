import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { homologacionAprobada } from "../../services/homologaciones/homologacion.js";
import { authenticate, isAuthenticated, logout } from "../../services/auth/auth.js";
import { z } from "zod";

export function homologacion_mcp_tools(server: McpServer) {
  
  server.registerTool(
    "auth_login",
    {
      title: "Iniciar sesión",
      description: "Autenticarse con la palabra secreta para acceder a las homologaciones",
      inputSchema: {
        secret: z.string().describe("Palabra secreta para autenticación")
      }
    },
    async ({ secret }) => {
      try {
        const result = authenticate(secret);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: result.success,
                sessionId: result.sessionId,
                message: result.message,
                expiresIn: result.success ? "30 minutos" : undefined
              }, null, 2),
            },
          ],
          isError: !result.success,
        };
      } catch (err) {
        const e = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error en autenticación: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "auth_logout",
    {
      title: "Cerrar sesión",
      description: "Cerrar la sesión actual y eliminar el sessionId",
      inputSchema: {
        sessionId: z.string().describe("ID de sesión a cerrar")
      }
    },
    async ({ sessionId }) => {
      try {
        const success = logout(sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success,
                message: success 
                  ? "✅ Sesión cerrada correctamente" 
                  : "⚠️ Sesión no encontrada o ya expirada"
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        const e = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Error cerrando sesión: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "buscar_homologaciones_aprobadas",
    {
      title: "Buscar homologaciones aprobadas",
      description: "Busca homologaciones aprobadas junto con la respectiva información. Requiere autenticación previa.",
      inputSchema: {
        sessionId: z.string().describe("ID de sesión obtenido tras autenticarse")
      }
    },
    async ({ sessionId }) => {
      try {
        // Verificar autenticación
        if (!isAuthenticated(sessionId)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "No autorizado",
                  message: "❌ Sesión inválida o expirada. Por favor, autentícate usando 'auth_login'.",
                  requiredAction: "Usa la tool 'auth_login' con tu palabra secreta"
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const results = await homologacionAprobada();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                authenticated: true,
                sessionId,
                data: results,
                timestamp: new Date().toISOString()
              }, null, 2),
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

  server.registerTool(
    "auth_help",
    {
      title: "Ayuda de autenticación",
      description: "Muestra instrucciones sobre cómo usar el sistema de autenticación"
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Sistema de Autenticación MCP",
              steps: [
                {
                  step: 1,
                  action: "Iniciar sesión",
                  tool: "auth_login",
                  description: "Usa tu palabra secreta para autenticarte",
                  example: {
                    tool: "auth_login",
                    input: { secret: "tu_palabra_secreta" }
                  }
                },
                {
                  step: 2,
                  action: "Obtener sessionId",
                  description: "Guarda el sessionId que se devuelve tras el login exitoso"
                },
                {
                  step: 3,
                  action: "Consultar homologaciones",
                  tool: "buscar_homologaciones_aprobadas",
                  description: "Usa el sessionId para acceder a las homologaciones",
                  example: {
                    tool: "buscar_homologaciones_aprobadas",
                    input: { sessionId: "session_xxxxx" }
                  }
                },
                {
                  step: 4,
                  action: "Cerrar sesión (opcional)",
                  tool: "auth_logout",
                  description: "Cierra tu sesión cuando termines",
                  example: {
                    tool: "auth_logout",
                    input: { sessionId: "session_xxxxx" }
                  }
                }
              ],
              notes: [
                "Las sesiones expiran después de 30 minutos de inactividad",
                "Cada consulta a homologaciones renueva automáticamente la sesión",
                "Puedes tener múltiples sesiones activas simultáneamente"
              ]
            }, null, 2),
          },
        ],
      };
    }
  );
}