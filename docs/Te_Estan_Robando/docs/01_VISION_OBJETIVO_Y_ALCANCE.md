# 01 · Visión, objetivo y alcance

> **Proyecto:** Te están robando / El barrio no duerme. **Fecha de corte:** 17 de octubre de 2026. **Tipo:** propuesta de diseño salvo indicación expresa. **Entorno:** exclusivamente datos y cuentas sintéticas.

## Tesis del producto
«La seguridad bancaria no debería depender de que la víctima reaccione a tiempo». La **solución** es una capa de protección preejecución que evalúa operaciones riesgosas, las retiene antes de mover fondos, verifica el contexto del cliente, investiga cuentas receptoras, documenta evidencia y reutiliza conocimiento confirmado. La **demo** es un entorno de experimentación y comunicación que permite probar ese motor, NO un producto de educación financiera ni una prueba en producción.

## Tres resultados que no deben confundirse
1. **Funcionamiento de ingeniería:** una API recibió una transferencia simulada, cambió estado de forma persistente y produjo evidencia.
2. **Experimento con participantes:** las personas entendieron, completaron tareas y expresaron una preferencia; muestra limitada y sesgada.
3. **Tracción comercial:** conversaciones con especialistas o posibles compradores, pilotos y compromisos; no inferible a partir de votos de jugadores.

## Problema observado
Cuando el titular está manipulado o suplantado, incluso una autenticación válida puede coexistir con una operación peligrosa. Avisar no es lo mismo que proteger: si la alerta se produce después de ejecutar el pago, su utilidad puede ser limitada. La actividad sospechosa de la cuenta receptora también puede tardar en llegar a un analista, dejando expuestas transferencias siguientes. Evidencia en [02](02_PROBLEMA_EVIDENCIA_Y_CASOS_PERU.md).

## Producto vs demostración
| Capa | Propósito | Validación |
|---|---|---|
| Motor de protección | Decisiones transaccionales con reglas + agentes + políticas | Logs, invariantes, replay, pruebas |
| Juego narrativo | Generar operaciones contextualizadas y registrar elecciones | Telemetría de sesión |
| Monitor del jurado | Exponer el motor sin suplantar su decisión | Eventos persistidos y evidencias |
| Estudio de campo | Aprender sobre fricción, comprensión e interés | Encuesta + entrevista y muestra declarada |

## Público
- Usuario final ficticio: Rosa (bodega), Jorge (cuenta), Lucía (sin señal), Don Pepe (comercio legítimo).
- Comprador hipotético: entidad financiera con capacidad de integrar el control al ciclo de ejecución del pago.
- Usuario operacional: área de riesgo, fraude o AML. En documentos del equipo aparece revisión humana de cuentas mula.
- Audiencia de hackathon: asistentes, mentores y jurado; necesitan entender en segundos y verificar con un clic.

## Principios no negociables
- Solo transferencias simuladas, sin datos bancarios ni teléfonos reales.
- El servidor controla saldo, estados, señales de riesgo y decisión; el cliente nunca declara éxito.
- `HELD` antes de cualquier llamada a IA en operaciones sujetas a retención.
- Una cuenta sospechosa no se etiqueta automáticamente como *confirmada*.
- La IA investiga; Policy determinista decide. El Auditor revisa evidencia.
- Las pruebas incluyen un caso que falla y uno legítimo que debe pasar.
- El prototipo no pretende detectar todo fraude bancario ni replicar un core real.

## Historias a contar
- **Humanidad:** Rosa está trabajando y recibe presión.
- **Ingeniería:** el motor retiene sin esperar a un agente o al cliente.
- **Aprendizaje:** una cuenta ya verificada se reconoce en nuevas operaciones.
- **Honestidad:** una transferencia pequeña sin señal puede pasar, y eso se mide.

## Alcance MVP
Historia de Rosa, investigación de M-01, retención posterior por Memoria, caso de Don Pepe, monitor en vivo, medición completa, URL pública estable. Arena multiusuario y Lucía son ampliaciones; movimiento pixelado no debe retrasar la integración. Conectar con [21](21_BACKLOG_PRIORIZACION_Y_PLAN.md).

## Fuera de alcance
Integración bancaria real, KYC real, entrenamiento ML, vigilancia telefónica del usuario, transferencias reales, intercambio entre bancos, atribución de delitos, casos en otros bancos con historial completo, recomendación AML concluyente sin evidencia y recaudación de datos personales.
