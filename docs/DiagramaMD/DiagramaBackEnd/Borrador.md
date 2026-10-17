### Justificación del Motor de Base de Datos

Para la persistencia de datos del sistema, evaluamos alternativas nativas y de código abierto gestionadas (Azure SQL Database vs. Azure Database for PostgreSQL). La decisión técnica final es implementar **Azure Database for PostgreSQL (Flexible Server)**.

**Argumentos de la elección:**
1. **Estándar Relacional y Trazabilidad:** Su estricto cumplimiento del modelo relacional permite una definición robusta de claves e integridad referencial, asegurando la consistencia del catálogo de hardware (Vendor/Device IDs) y los perfiles de usuario.
2. **Eficiencia de Costos (Flexible Server):** La arquitectura de servidor flexible nos permite desplegar instancias *Burstable* (B1ms). Esto optimiza el consumo de los créditos de Azure for Students, garantizando la viabilidad operativa hasta el despliegue final en producción.
3. **Escalabilidad Híbrida (JSONB):** Proporciona la capacidad nativa de indexar datos desestructurados mediante el tipo `JSONB`. Esto nos prepara arquitectónicamente para futuras integraciones de *web scraping*, donde los metadatos de los fabricantes pueden variar en estructura.

**Desventaja y Costo Asumido:**
Al optar por PostgreSQL Flexible Server en lugar de Azure SQL Database (Serverless), **asumimos el costo técnico de no contar con "Auto-pausa nativa a cero"**. El servidor se mantendrá encendido 24/7 consumiendo una cuota mínima de procesamiento continuo, lo que requiere un monitoreo más riguroso de nuestra facturación mensual. Además, exige configurar reglas de cortafuegos más explícitas (pg_hba.conf gestionado) en comparación con las integraciones por defecto de los servicios puramente nativos de Microsoft.