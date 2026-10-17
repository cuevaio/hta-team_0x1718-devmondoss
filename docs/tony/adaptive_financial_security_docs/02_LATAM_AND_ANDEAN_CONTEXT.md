# 02 — Contexto LATAM y Andino

## 1. Digitalización rápida + protección desigual

En América Latina y el Caribe alrededor del **70% de los adultos tiene una cuenta financiera** y más de la mitad la usa digitalmente mediante tarjeta o teléfono. La expansión digital está ocurriendo rápido, pero no de manera homogénea por ingreso, edad, educación o territorio.

En 2024, la brecha regional de propiedad de cuenta entre el 40% de menores ingresos y el 60% más rico era de aproximadamente **15 puntos porcentuales**; la brecha en uso de pagos digitales era de **16 puntos**.

*Fuente: `18` #14, #15.*

Esto importa porque una arquitectura de seguridad diseñada alrededor de un smartphone, datos móviles permanentes y habilidades digitales altas no representa a toda la base de usuarios.

## 2. El problema no es solo cobertura

En la región, aproximadamente **31% de la población vive bajo cobertura de banda ancha móvil pero no utiliza internet móvil**. La brecha de cobertura es mucho menor, alrededor de 5%.

Las principales barreras ya no son únicamente “no hay antena”: también aparecen costo del dispositivo, habilidades digitales, seguridad/confianza y relevancia del contenido.

En zonas rurales, la brecha de uso es todavía más importante: globalmente, poblaciones rurales en economías de ingreso bajo y medio son significativamente menos propensas a usar internet móvil y servicios online como banca.

*Fuente: `18` #16, #17.*

### Consecuencia de producto

“Enviar un push” no significa “el cliente recibió protección”.

## 3. South America está entre las regiones con mayor exposición a scams

El Global State of Scams 2025 reportó que la exposición a estafas fue especialmente frecuente en **Sudamérica, África y Oceanía**. A nivel global, 23% de adultos reportó haber perdido dinero en el último año; en las regiones de mayor exposición, la cifra llegó hasta aproximadamente uno de cada cuatro.

*Fuente: `18` #1, #2.*

**No usar como claim:** “LATAM tiene la mayor tasa de fraude del planeta”.

**Sí usar:** “Sudamérica aparece entre las regiones con mayor exposición a estafas en estudios globales recientes.”

## 4. La ingeniería social está creciendo con fuerza

Datos agregados de 36 instituciones financieras latinoamericanas que atienden a más de 300 millones de clientes reportaron para 2025:

- intentos de estafa por ingeniería social: **+155%**;
- fraude usando herramientas de acceso remoto: **más de 5×**;
- ataques de malware reportados: **+225%**;
- fraude desde dispositivos robados: **+344%**;
- cuentas mula reportadas: **+42%**.

*Fuente: `18` #4, #5.*

Esto refuerza una transición: el atacante no necesita “romper la criptografía”; puede manipular al usuario, controlar su dispositivo o aprovechar una identidad ya validada.

## 5. El usuario latinoamericano está expuesto en varios canales

Una encuesta regional de 2026 reportó que:

- **41%** de adultos encuestados en Latinoamérica fue impactado por fraude digital en una ventana de 2025;
- vishing fue el esquema más reportado entre consumidores objetivo;
- quienes perdieron dinero declararon una pérdida mediana cercana a **USD 1,973**.

*Fuente: probablemente `18` #3 — **confirmar antes de usar en el pitch**.*

Esto sugiere que el riesgo es omnicanal: teléfono, mensajes, correo, web y app convergen en el mismo usuario.

## 6. Perú: evidencia muy directa

Una encuesta nacional representativa de 1,007 usuarios de servicios financieros digitales realizada en 2025 encontró:

- **47%** había estado expuesto a fraude o estafas durante el último año;
- **21% de los expuestos** perdió dinero, equivalente a alrededor del **10% de todos los usuarios encuestados**;
- entre usuarios afectados por riesgos digitales, **25% redujo su uso**, **11% lo dejó completamente** y **17% cambió de proveedor/agente/operador**.

*Fuente: `18` #7.*

Este punto es estratégico: **el fraude no solo produce pérdida económica; destruye adopción y confianza.**

## 7. Perú está digitalizándose rápidamente

En 2025, alrededor del **67% de adultos peruanos** tenía una cuenta o billetera digital, frente a 42% en 2020. Entre usuarios de servicios financieros digitales, nueve de cada diez utilizaba billeteras digitales y cerca de tres cuartas partes las usaba diariamente.

*Fuente: `18` #8, #14 — confirmar cuál respalda cada cifra.*

Más usuarios + más transacciones + más canales = mayor necesidad de seguridad usable.

## 8. Inclusión no equivale a solo “tener cuenta”

La inclusión efectiva requiere que el servicio sea:

- accesible;
- comprensible;
- seguro;
- útil;
- operable autónomamente.

En Perú existen obligaciones de adecuar procedimientos y plataformas financieras para que personas con discapacidad puedan manifestar su voluntad mediante ajustes razonables y sin depender obligatoriamente de terceros.

*Fuente: `18` #12, #13.*

Eso convierte accesibilidad y seguridad en una misma pregunta de arquitectura: **¿cómo verificas de forma fuerte sin quitar autonomía?**

## 9. La región todavía tiene brechas estructurales de ciberseguridad

Evaluaciones regionales recientes reconocen avances, pero señalan brechas persistentes en:

- recursos;
- talento especializado;
- coordinación intersectorial;
- protección de infraestructura crítica;
- calidad de software;
- investigación e innovación;
- adopción de mecanismos de transferencia de riesgo.

*Fuente: `18` #19.*

Esto explica por qué no basta importar un patrón de producto de mercados con distinta infraestructura, conectividad y soporte.

## 10. Cuentas mula: el otro extremo del fraude

**HECHO:** los mismos datos agregados de instituciones latinoamericanas reportan **+42% en cuentas mula** en 2025 (ver sección 4).

Las cuentas mula son el punto donde el fraude contra el cliente se convierte en un problema de lavado de activos. Cada estafa exitosa necesita una cuenta receptora; cada cuenta receptora suele recibir de **varias víctimas**.

**HIPÓTESIS:** detectar y confirmar una mula temprano protege a múltiples víctimas futuras, no solo a la actual.

**HIPÓTESIS (por verificar con fuente):** una parte relevante de las mulas son personas reclutadas con ofertas de empleo falsas o que “prestan” su cuenta sin entender el delito. Esto obliga a tratar el etiquetado con cuidado (ver `15`).

## 11. El lado AML: investigación de alertas

En Perú, las entidades del sistema financiero son sujetos obligados a reportar operaciones sospechosas (ROS) a la UIF-Perú. **Fuente normativa exacta: pendiente de citar en `18`.**

El brief del reto B1 describe el dolor operativo:

- cada alerta del sistema de monitoreo exige reconstruir manualmente historial, contrapartes, señales de riesgo y normativa;
- más alertas no significa más analistas: significa backlog, fatiga y riesgo regulatorio si una alerta real se cierra sin la debida diligencia.

**HIPÓTESIS:** la mayor parte del tiempo de un analista se va en reunir contexto, no en decidir.

## 12. La narrativa regional correcta

No es:

> “Aquí todo es inseguro y los bancos son malos.”

Es:

> **Latinoamérica combina digitalización financiera acelerada, alta exposición a ingeniería social, crecimiento de cuentas mula y una población heterogénea en conectividad, dispositivos, habilidades y accesibilidad. Los mecanismos de seguridad deben funcionar en ese entorno real, no solo en el happy path de un usuario siempre conectado — y lo que se aprende de una víctima debe proteger a la siguiente.**
