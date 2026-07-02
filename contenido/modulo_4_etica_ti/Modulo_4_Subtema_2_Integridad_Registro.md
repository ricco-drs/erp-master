# Módulo 4: Ética Profesional en TI

## 4.2 Integridad en el registro de información

### La Integridad de Datos como Base de la Confiabilidad Operativa
La integridad en el registro de información es el pilar ético que garantiza que los datos contenidos en el sistema ERP son precisos, consistentes, completos y confiables para la toma de decisiones. En un sistema integrado donde la información se centraliza en una "Única Fuente de Verdad", cualquier dato corrupto ingresado en un punto (ej. el registro de una venta) se propaga automáticamente y de forma inalterable a todos los módulos correlacionados (inventario, finanzas, contabilidad).

El profesional de TI tiene la responsabilidad ética de asegurar que el sistema esté diseñado y operado de manera que impida la manipulación fraudulenta o la alteración accidental de los registros transaccionales.

### El Principio de "Única Fuente de Verdad" (Central Database) y Responsabilidad Ética
*   **Centralización:** La fortaleza del ERP radica en tener una sola base de datos centralizada. Éticamente, esto impone una obligación superior de integridad. Si la central se corrompe, todos los reportes operativos y financieros basados en ella serán falsos.
*   **Automatización de Controles:** El sistema debe automatizar controles de integridad (ej. no permitir registrar una venta si no hay stock, o no permitir un asiento contable que no esté balanceado). Éticamente, el diseñador no debe "relajar" estos controles por presión operativa si comprometen la precisión de los datos.

### El Impacto Técnico y Ético de "Garbage In, Garbage Out" (GIGO)
*   **Impacto Técnico:** Si un usuario de almacén ingresa que ingresaron 100 unidades de un material cuando solo ingresaron 10, Ventas intentará vender un stock que no existe, generando una parálisis operativa y la pérdida de clientes.
*   **Responsabilidad Ética del Usuario:** Es una falta ética del usuario operativo ingresar datos incorrectos ("datos basura") "solo para cumplir" con el sistema, sin comprender la trazabilidad del impacto en el resto de la empresa.

### Mecanismos de Integridad y Ética Profesional
Para garantizar la integridad, el profesional de TI debe implementar y respetar:

1.  **Controles de Entrada y Validación:** Diseño de interfaces que validen campos obligatorios, formatos correctos de datos, y reglas de negocio.
2.  **Auditoría y Logs (Audit Trails):** El sistema debe registrar de forma automática e inalterable quién, cuándo y qué dato se modificó. Éticamente, es inadmisible y una violación de auditoría que un usuario pueda alterar un registro transaccional sin dejar rastro.
3.  **Segregación de Funciones (SoD - Segregation of Duties):** Éticamente, el sistema debe configurarse para que una persona no pueda completar un ciclo transaccional completo de alto riesgo por sí misma (ej. la persona que crea un proveedor ficticio no puede ser la misma que autorice el pago a ese proveedor).

### Consecuencias Éticas y Legales de la Falta de Integridad
*   **Reportes Gerenciales Falsos:** Decisions de negocio catastróficas basadas en datos financieros corruptos.
*   **Fraudes Financieros:** La manipulación intencional de registros para ocultar robos o desfalcos.
*   **Sanciones Penales:** La alteración de registros contables y fiscales puede resultar en consecuencias penales severas bajo leyes fiscales y anticorrupción.
