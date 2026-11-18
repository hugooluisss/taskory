# Ajustar el presupuesto de consolidación de reportes

La consolidación de memoria usa un límite de caracteres adecuado para Ollama incluso cuando el proveedor configurado es DeepSeek. Eso puede gastar miles de tokens condensando memoria que DeepSeek puede recibir directamente y hacer fallar el reporte.

## Alcance

- Elegir el presupuesto de consolidación según el proveedor, con `LLM_MAX_CONSOLIDATION_CHARS` como ajuste explícito.
- Mantener la consolidación jerárquica cuando la memoria exceda el presupuesto aplicable.
- Cubrir con una prueba de proveedor DeepSeek simulado que memoria válida y una respuesta de reporte realista no requieren llamadas de consolidación.

## Fuera de alcance

- Cambiar validación de salida estructurada o prompts de evaluación.
- Cambiar límites de contexto del proveedor fuera del presupuesto de la canalización de reportes.
