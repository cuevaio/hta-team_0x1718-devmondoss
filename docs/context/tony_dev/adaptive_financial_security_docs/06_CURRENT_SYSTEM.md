# 06 — Current System

## Arquitectura simplificada actual — fraude (lado emisor)

```mermaid
flowchart TD
    A["Login / dispositivo"] --> B["Identity & Authentication<br/>password · OTP · biometría"]
    B --> C["Solicitud de transacción"]
    C --> D["Risk engine<br/>device · IP · monto · historial<br/>beneficiario · velocity · ubicación"]
    D --> E{"Reglas / modelo"}
    E -->|riesgo bajo| F["Allow"]
    E -->|riesgo medio| G["Challenge"]
    E -->|riesgo alto| H["Block / hold / review"]
    H --> I["Notificación"]
    I --> J(["Usuario"])
```

## Arquitectura simplificada actual — AML (lado receptor)

```mermaid
flowchart TD
    A["Transacciones ya ejecutadas"] --> B["Monitoreo transaccional<br/>reglas / escenarios"]
    B --> C["Alerta → cola de alertas (backlog)"]
    C --> D["Analista abre varios sistemas<br/>core · KYC · historial · contrapartes · listas · normativa"]
    D --> E["Reconstruye el caso a mano"]
    E --> F{"Decide"}
    F -->|descartar| G["Caso cerrado"]
    F -->|escalar| H["ROS a la UIF-Perú"]
```

## Controles clásicos útiles

- MFA / OTP;
- biometría;
- device binding;
- behavioral analytics;
- velocity rules;
- límites transaccionales;
- new-beneficiary controls;
- AML / mule detection;
- transaction monitoring;
- fraud operations;
- alertas push/SMS/email;
- bloqueos manuales;
- call center;
- branch escalation.

El problema no es que estos controles sean inútiles. El problema aparece en los **gaps entre ellos**.

## Tres paradigmas distintos

### Authentication
“¿Quién eres?”

### Transaction risk
“¿Esta operación se parece a fraude?”

### Customer safety
“¿Esta operación refleja la intención segura del usuario y puede verificarse de manera accesible y oportuna?”

La tercera pregunta es la menos resuelta.

## Arquitectura organizacional fragmentada

```mermaid
flowchart LR
    IAM["IAM / Identity"] --> INC(["Incidente"])
    FE["Fraud engine"] --> INC
    APP["Mobile app"] --> INC
    CC["Contact center"] --> INC
    SIEM["Security / SIEM"] --> INC
    CMP["Complaints"] --> INC
    ACC["Accessibility"] --> INC
    AML["AML / Compliance<br/>ve al receptor, días después"] -.-> INC
```

Cada equipo ve una parte distinta. En particular, **fraude ve a la víctima y AML ve a la mula**, aunque sea la misma transacción.

## Hipótesis de gap

La información existe, pero la organización no siempre convierte señales dispersas en una **política contextual de protección** antes de que el dinero salga, ni reutiliza lo que AML confirma para proteger a la siguiente víctima.

## Dónde se inserta nuestra capa

No reemplaza nada: se agrega **entre el risk engine y la ejecución**, y **sobre la cola de alertas AML**.

```mermaid
flowchart LR
    RE["Risk engine existente"] --> CAPA["⭐ NUESTRA CAPA"]
    AQ["Cola de alertas AML"] --> CAPA
    CAPA --> EX["Ejecución / pausa"]
    CAPA --> CON["Consola del analista"]
    CON --> MEM[("🧠 Memoria de riesgo")]
    MEM --> CAPA
    style CAPA stroke-width:3px
```

- **Entrada:** transacciones marcadas por el risk engine + alertas AML.
- **Salida:** decisión `PERMITIR / PAUSAR / VERIFICAR / ESCALAR` + expediente.
- **Integración mínima:** API de lectura de historial y una API para retener/liberar una operación pendiente.
