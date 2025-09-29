import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });


const authenticatedSessions = new Map<string, { timestamp: number }>();
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutos

export function authenticate(secret: string): { success: boolean; sessionId?: string; message: string } {
  const expectedSecret = process.env.AUTH_SECRET;

  if (!expectedSecret) {
    return {
      success: false,
      message: '❌ Error: AUTH_SECRET no configurado en variables de entorno'
    };
  }

  if (secret === expectedSecret) {
    // Generar un sessionId único
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    authenticatedSessions.set(sessionId, {
      timestamp: Date.now()
    });

    return {
      success: true,
      sessionId,
      message: '✅ Autenticación exitosa. Guarda tu sessionId para futuras consultas.'
    };
  }

  return {
    success: false,
    message: '❌ Palabra secreta incorrecta'
  };
}

export function isAuthenticated(sessionId: string): boolean {
  const session = authenticatedSessions.get(sessionId);
  
  if (!session) {
    return false;
  }

  // Verificar si la sesión ha expirado
  if (Date.now() - session.timestamp > SESSION_DURATION) {
    authenticatedSessions.delete(sessionId);
    return false;
  }

  // Actualizar timestamp de la sesión
  session.timestamp = Date.now();
  return true;
}

export function logout(sessionId: string): boolean {
  return authenticatedSessions.delete(sessionId);
}

// Limpieza periódica de sesiones expiradas (cada 10 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of authenticatedSessions.entries()) {
    if (now - session.timestamp > SESSION_DURATION) {
      authenticatedSessions.delete(sessionId);
    }
  }
}, 10 * 60 * 1000);