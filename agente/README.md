# Agente de consulta — Card Escrow

Asistente de solo lectura que consulta el estado del programa Card Escrow en Solana Devnet usando tool calling.

## Instalación

```bash
cd agente
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta el puerto si es necesario:

```env
RPC_URL=https://api.devnet.solana.com
LLM_BASE_URL=http://localhost:1235/v1
LLM_MODEL=qwen2.5-7b-instruct
LLM_API_KEY=sk-no-necesaria-local
```

## Prueba directa (sin IA)

```bash
npm run prueba
```

Muestra el resumen calculado directamente desde las cuentas on-chain.

### Resultado observado (26 nov 2026)

```json
{
  "existe": true,
  "total_ordenes": 10,
  "pendientes": 8,
  "pagadas": 1,
  "completadas": 1,
  "reembolsadas": 0,
  "monto_total_retenido": "11000000"
}
```

## Ejecutar el agente

1. Inicia **LM Studio**, carga **Qwen2.5 7B Instruct** y activa el servidor local.
2. Confirma que `LLM_BASE_URL` apunte al puerto correcto (ej. `http://localhost:1235/v1`).
3. Ejecuta:

```bash
npm run agente -- "¿Cuántas órdenes pendientes hay?"
```

### Evidencia de respuestas del agente

| Pregunta | Respuesta del agente | Coincide con prueba directa |
|----------|----------------------|-----------------------------|
| ¿Cuántas órdenes pendientes hay? | Hay 8 órdenes pendientes. | Sí |
| (otras preguntas de prueba) | Ver capturas | Sí |

El agente usa la herramienta `CARD_ESCROW_RESUMEN` y no inventa datos.

## Qué consulta la herramienta

`CARD_ESCROW_RESUMEN` lee todas las órdenes del programa y calcula:

- Total de órdenes
- Pendientes, pagadas, completadas y reembolsadas
- Monto total retenido (en órdenes pagadas o en tránsito)
- Lista de ofertas activas (pendientes)

## Caso sin registros (cuenta inexistente)

Equivalente al caso “sin registro” del taller guiado.

Cuando no hay órdenes en el programa (o se consulta un Program ID sin cuentas), la herramienta devuelve:

```json
{
  "existe": false,
  "total_ordenes": 0,
  "pendientes": 0,
  "pagadas": 0,
  "completadas": 0,
  "reembolsadas": 0,
  "monto_total_retenido": "0",
  "ofertas_activas": []
}
```

Esto se puede comprobar temporalmente cambiando el `PROGRAM_ID` en `tools/resumenEscrow.ts` por uno sin cuentas y ejecutando `npm run prueba`.
