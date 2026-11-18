import { ERROR_CODES } from "../errors/error-codes";

export const messages: Record<"en" | "es", Record<string, string>> = {
  en: {
    [ERROR_CODES.EMAIL_TAKEN]: "Email is already registered",
    [ERROR_CODES.INVALID_CREDENTIALS]: "Invalid email or password",
    [ERROR_CODES.UNAUTHORIZED]: "Authentication required",
    [ERROR_CODES.NOT_FOUND]: "Resource not found",
    [ERROR_CODES.VALIDATION_ERROR]: "Request validation failed",
    [ERROR_CODES.PAYLOAD_TOO_LARGE]: "Request body is too large",
    [ERROR_CODES.TOO_MANY_REQUESTS]: "Too many requests",
    [ERROR_CODES.API_KEY_LIMIT]: "You have reached the active API key limit",
    [ERROR_CODES.INTERNAL_ERROR]: "Internal server error",
    [ERROR_CODES.NO_ACTIVITIES]: "No activities found for this report",
    [ERROR_CODES.RANGE_TOO_LARGE]: "Too many activities for one report",
    [ERROR_CODES.LLM_UNAVAILABLE]: "LLM provider is unavailable",
    [ERROR_CODES.REPORT_IN_PROGRESS]: "A report is already in progress",
    [ERROR_CODES.REPORT_NOT_RETRYABLE]: "Only failed reports can be retried",
    [ERROR_CODES.INVALID_LLM_OUTPUT]: "The LLM returned invalid output",
  },
  es: {
    [ERROR_CODES.EMAIL_TAKEN]: "El correo ya está registrado",
    [ERROR_CODES.INVALID_CREDENTIALS]: "Correo o contraseña no válidos",
    [ERROR_CODES.UNAUTHORIZED]: "Autenticación requerida",
    [ERROR_CODES.NOT_FOUND]: "Recurso no encontrado",
    [ERROR_CODES.VALIDATION_ERROR]: "La solicitud no es válida",
    [ERROR_CODES.PAYLOAD_TOO_LARGE]:
      "El cuerpo de la solicitud es demasiado grande",
    [ERROR_CODES.TOO_MANY_REQUESTS]: "Demasiadas solicitudes",
    [ERROR_CODES.API_KEY_LIMIT]:
      "Has alcanzado el límite de claves API activas",
    [ERROR_CODES.INTERNAL_ERROR]: "Error interno del servidor",
    [ERROR_CODES.NO_ACTIVITIES]:
      "No se encontraron actividades para el informe",
    [ERROR_CODES.RANGE_TOO_LARGE]: "Demasiadas actividades para un informe",
    [ERROR_CODES.LLM_UNAVAILABLE]: "El proveedor de IA no está disponible",
    [ERROR_CODES.REPORT_IN_PROGRESS]: "Ya hay un informe en curso",
    [ERROR_CODES.REPORT_NOT_RETRYABLE]:
      "Solo se pueden reintentar informes fallidos",
    [ERROR_CODES.INVALID_LLM_OUTPUT]:
      "El proveedor de IA devolvió una respuesta no válida",
  },
};
