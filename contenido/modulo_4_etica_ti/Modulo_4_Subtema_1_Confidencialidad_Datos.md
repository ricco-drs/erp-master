# Módulo 4: Ética Profesional en TI

## 4.1 Confidencialidad y manejo de datos sensibles

### La Confidencialidad como Pilar de Confianza en la Era Digital
La confidencialidad es un principio ético y profesional fundamental en el ámbito de las Tecnologías de la Información (TI), especialmente en la implementación y operación de sistemas empresariales integrados como los ERP. En un entorno donde la información se centraliza en una "Única Fuente de Verdad", el profesional de TI asume una responsabilidad crítica de salvaguardar los datos que, por su naturaleza, no deben ser divulgados a terceros no autorizados.

La confidencialidad trasciende la simple obligación legal; es la base de la confianza operativa entre la organización, sus clientes, sus empleados y los consultores externos que manejan la central de datos. Sin ella, la adopción operativa del sistema colapsa debido al temor de los departamentos a compartir su información.

### Tipos de Datos Sensibles en un ERP
Un sistema ERP centraliza información crítica de todas las áreas funcionales. Entre los datos sensibles más comunes destacan:

*   **Datos de Identidad Personal (PII):** Nombres completos, números de documentos de identidad (DNI, pasaporte), direcciones, teléfonos, correos electrónicos.
*   **Datos Financieros:** Números de cuentas bancarias, de tarjetas de crédito/débito, estados financieros internos, márgenes de ganancia por producto, fórmulas de producción exclusivas.
*   **Datos de Estrategia Comercial:** Listas de clientes preferenciales, contratos con proveedores clave, planes de expansión.
*   **Datos Laborales:** Planillas salariales (nóminas), bonificaciones, evaluaciones de desempeño, historial médico (si el módulo de HCM lo registra).

### El Principio de Menor Privilegio y Ética Profesional
Desde la perspectiva ética, el profesional de TI debe acceder a más información de la estrictamente necesaria para cumplir con sus funciones.
*   **Acceso Justificado:** Un consultor externo configurando el módulo de producción no tiene ninguna justificación ética para acceder a los salarios de los directivos.
*   **Roles de Usuario:** Éticamente, el diseñador del sistema debe configurar los permisos de usuario de forma granular, asegurando que un empleado de almacén pueda ver el inventario pero no los datos fiscales de los clientes.

### Marcos Legales y Consecuencias
La confidencialidad está protegida por marcos legales cada vez más estrictos.

1.  **Leyes de Protección de Datos (ej. APPD Perú/GDPR UE):** Imponen severas multas a las organizaciones por fugas de datos de ciudadanos (ej. la Ley de Protección de Datos Personales en Perú).
2.  **Consecuencias Reputacionales y Económicas:** La filtración intencional o por negligencia (como dejar una sesión abierta o compartir contraseñas) puede resultar en:
    *   **Pérdida masiva de confianza** de los clientes y empleados.
    *   **Pérdida de ventaja competitiva** si la competencia accede a datos estratégicos.
    *   **Consecuencias Penales** para el profesional que violó el secreto profesional.

### Obligaciones Éticas Específicas en ERP
*   **Firmas de Acuerdos de Confidencialidad (NDA):** Obligatorias para todos los consultores y empleados con acceso a la central de datos.
*   **No Uso de Datos Reales en Pruebas:** Es una falta de ética y a menudo una violación legal usar la base de datos de producción real para realizar capacitaciones o pruebas en el entorno *Sandbox*.
*   **Custodia de Contraseñas:** Compartir contraseñas de "Superusuario" (como las de administración del sistema ERP) es una violación ética de seguridad que pone en riesgo toda la integridad de la información centralizada.
