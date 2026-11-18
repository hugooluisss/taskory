# Diseño

`ReportGenerator` continúa coordinando la generación y los proveedores continúan encapsulando las llamadas externas. El servicio obtiene el presupuesto de consolidación a partir del identificador del proveedor: 12.000 caracteres por defecto para Ollama y 3.500.000 para DeepSeek. `LLM_MAX_CONSOLIDATION_CHARS` permite ajustar ambos casos en despliegues con distintos modelos. El mismo valor controla el ajuste de chunks, la agrupación y la validación del prompt final, así la consolidación jerárquica solo ocurre cuando hace falta.

No cambia la capa API: el controlador y los repositorios no participan en este cálculo.
