import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { bdHomologacion } from "../../services/bd/conectiondb.js";
import { z } from "zod";

export function database_mcp_tools(server: McpServer) {
  
  server.registerTool(
    "get_database_context",
    {
      title: "Obtener contexto completo de la base de datos",
      description: "Analiza toda la estructura de la base de datos, tablas, columnas, relaciones y datos de ejemplo"
    },
    async () => {
      try {
        const client = await bdHomologacion();

        const tablesResult = await client.query(`
          SELECT 
            t.table_name,
            obj_description(c.oid) as table_comment
          FROM information_schema.tables t
          LEFT JOIN pg_class c ON c.relname = t.table_name
          WHERE t.table_schema = 'public'
          ORDER BY t.table_name
        `);

        const tableDetails = [];
        for (const table of tablesResult.rows) {
          const columnsResult = await client.query(`
            SELECT 
              c.column_name,
              c.data_type,
              c.is_nullable,
              c.column_default,
              c.character_maximum_length,
              col_description(pgc.oid, c.ordinal_position) as column_comment
            FROM information_schema.columns c
            LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
            WHERE c.table_name = $1 AND c.table_schema = 'public'
            ORDER BY c.ordinal_position
          `, [table.table_name]);

          const foreignKeysResult = await client.query(`
            SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name,
              tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = $1
          `, [table.table_name]);

          const primaryKeysResult = await client.query(`
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = $1
          `, [table.table_name]);

          const countResult = await client.query(`SELECT COUNT(*) as total FROM ${table.table_name}`);

          const sampleDataResult = await client.query(`SELECT * FROM ${table.table_name} LIMIT 3`);
          
          tableDetails.push({
            name: table.table_name,
            comment: table.table_comment,
            totalRows: parseInt(countResult.rows[0].total),
            columns: columnsResult.rows,
            primaryKeys: primaryKeysResult.rows.map(pk => pk.column_name),
            foreignKeys: foreignKeysResult.rows,
            sampleData: sampleDataResult.rows
          });
        }
        
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                database: "homologacion",
                totalTables: tableDetails.length,
                tables: tableDetails,
                summary: `Base de datos con ${tableDetails.length} tablas y ${tableDetails.reduce((sum, t) => sum + t.totalRows, 0)} registros totales`
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
              text: `Error obteniendo contexto: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_table_relationships",
    {
      title: "Obtener relaciones entre tablas",
      description: "Muestra todas las relaciones y foreign keys entre tablas"
    },
    async () => {
      try {
        const client = await bdHomologacion();
        
        const relationshipsResult = await client.query(`
          SELECT
            tc.table_name as source_table,
            kcu.column_name as source_column,
            ccu.table_name as target_table,
            ccu.column_name as target_column,
            tc.constraint_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
          ORDER BY tc.table_name
        `);
        
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                relationships: relationshipsResult.rows,
                totalRelationships: relationshipsResult.rows.length,
                summary: `${relationshipsResult.rows.length} relaciones encontradas entre tablas`
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
              text: `Error obteniendo relaciones: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "execute_query",
    {
      title: "Ejecutar consulta SQL",
      description: "Ejecuta una consulta SELECT en la base de datos",
      inputSchema: {
        query: z.string().describe("Consulta SQL SELECT"),
        limit: z.number().default(1000).describe("Límite de resultados")
      }
    },
    async ({ query, limit = 1000 }) => {
      try {
        const client = await bdHomologacion();

        if (!query.trim().toLowerCase().startsWith('select')) {
          throw new Error('Solo se permiten consultas SELECT por seguridad');
        }

        // const limitedQuery = query.includes('LIMIT') ? query : `${query} LIMIT ${limit}`;
        const limitedQuery = query;
        
        const result = await client.query(limitedQuery);
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                rows: result.rows,
                rowCount: result.rowCount,
                query: limitedQuery,
                executedAt: new Date().toISOString()
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
              text: `Error ejecutando consulta: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_table_schema",
    {
      title: "Obtener esquema de tabla",
      description: "Obtiene la estructura detallada de una tabla específica",
      inputSchema: {
        tableName: z.string().describe("Nombre de la tabla")
      }
    },
    async ({ tableName }) => {
      try {
        const client = await bdHomologacion();

        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          )
        `, [tableName]);
        
        if (!tableExists.rows[0].exists) {
          throw new Error(`La tabla '${tableName}' no existe`);
        }
        
        const result = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            col_description(pgc.oid, c.ordinal_position) as column_comment
          FROM information_schema.columns c
          LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
          WHERE c.table_name = $1 AND c.table_schema = 'public'
          ORDER BY c.ordinal_position
        `, [tableName]);
        
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                table: tableName,
                columns: result.rows,
                totalColumns: result.rows.length
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
              text: `Error obteniendo esquema: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_tables",
    {
      title: "Listar tablas",
      description: "Lista todas las tablas disponibles en la base de datos"
    },
    async () => {
      try {
        const client = await bdHomologacion();
        
        const result = await client.query(`
          SELECT 
            table_name,
            obj_description(c.oid) as table_comment
          FROM information_schema.tables t
          LEFT JOIN pg_class c ON c.relname = t.table_name
          WHERE t.table_schema = 'public'
          ORDER BY t.table_name
        `);
        
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                tables: result.rows,
                totalTables: result.rows.length
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
              text: `Error listando tablas: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "suggest_queries",
    {
      title: "Sugerir consultas",
      description: "Sugiere consultas SQL útiles basadas en la pregunta del usuario",
      inputSchema: {
        userQuestion: z.string().describe("Pregunta o necesidad del usuario")
      }
    },
    async ({ userQuestion }) => {
      try {
        // Mapeo de palabras clave a consultas sugeridas
        const suggestionMap = {
          "homologaciones aprobadas": [
            "SELECT * FROM homologaciones WHERE estado = 'Aprobado'",
            "SELECT COUNT(*) as total_aprobadas FROM homologaciones WHERE estado = 'Aprobado'"
          ],
          "homologaciones pendientes": [
            "SELECT * FROM homologaciones WHERE estado = 'Pendiente'",
            "SELECT COUNT(*) as total_pendientes FROM homologaciones WHERE estado = 'Pendiente'"
          ],
          "usuarios": [
            "SELECT * FROM usuarios",
            "SELECT tipo_usuario, COUNT(*) as cantidad FROM usuarios GROUP BY tipo_usuario"
          ],
          "reportes": [
            "SELECT estado, COUNT(*) as cantidad FROM homologaciones GROUP BY estado",
            "SELECT DATE_TRUNC('month', fecha_solicitud) as mes, COUNT(*) FROM homologaciones GROUP BY mes ORDER BY mes"
          ],
          "estadísticas": [
            "SELECT COUNT(*) as total_homologaciones FROM homologaciones",
            "SELECT AVG(EXTRACT(DAY FROM (fecha_aprobacion - fecha_solicitud))) as dias_promedio_aprobacion FROM homologaciones WHERE fecha_aprobacion IS NOT NULL"
          ]
        };

        const relevantSuggestions = [];
        const lowerQuestion = userQuestion.toLowerCase();
        
        for (const [keyword, queries] of Object.entries(suggestionMap)) {
          if (lowerQuestion.includes(keyword.toLowerCase())) {
            relevantSuggestions.push({
              keyword,
              queries
            });
          }
        }

        if (relevantSuggestions.length === 0) {
          relevantSuggestions.push({
            keyword: "consultas generales",
            queries: [
              "SELECT * FROM homologaciones LIMIT 10",
              "SELECT * FROM usuarios LIMIT 10",
              "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
            ]
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                userQuestion,
                suggestions: relevantSuggestions,
                tip: "Usa la tool 'execute_query' para ejecutar cualquiera de estas consultas",
                totalSuggestions: relevantSuggestions.reduce((sum, s) => sum + s.queries.length, 0)
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
              text: `Error generando sugerencias: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "insert_data",
    {
      title: "Insertar datos",
      description: "Inserta nuevos datos en una tabla",
      inputSchema: {
        table: z.string().describe("Nombre de la tabla"),
        data: z.record(z.any()).describe("Datos a insertar como objeto clave-valor")
      }
    },
    async ({ table, data }) => {
      try {
        const client = await bdHomologacion();
        
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await client.query(query, values);
        
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                inserted: result.rows[0],
                table: table,
                insertedAt: new Date().toISOString()
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
              text: `Error insertando datos: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "test_connection",
    {
      title: "Verificar conexión",
      description: "Verifica que la conexión a la base de datos funcione correctamente"
    },
    async () => {
      try {
        const client = await bdHomologacion();
        
        const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
        await client.end();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                connectionStatus: "✅ Conexión exitosa",
                serverInfo: result.rows[0],
                testedAt: new Date().toISOString()
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
              text: `❌ Error de conexión: ${e.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}