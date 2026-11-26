# Agente de consulta — Card Escrow

Asistente de solo lectura que consulta el estado del programa Card Escrow en Solana Devnet.

## Instalación

```bash
cd agente
npm install
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta si es necesario:

```env
RPC_URL=https://api.devnet.solana.com
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=Qwen2.5-7B-Instruct
LLM_API_KEY=sk-no-necesaria-local
```

## Prueba directa (sin IA)

```bash
npm run prueba
```

Muestra el resumen calculado directamente desde las cuentas on-chain.

## Qué consulta la herramienta

La tool `CARD_ESCROW_RESUMEN` lee todas las órdenes del programa y calcula:

- Total de órdenes
- Pendientes, pagadas, completadas y reembolsadas
- Monto total retenido (en órdenes pagadas o en tránsito)
- Lista de ofertas activas (pendientes) con carta, foil, condición y precio

## Ejecutar el agente

1. Inicia LM Studio (o un servidor compatible) con un modelo que soporte tool calling.
2. Asegúrate de que `LLM_BASE_URL` apunte a él.
3. Ejecuta:

```bash
npm run agente
```

(El archivo `src/agent.ts` se completará en el siguiente paso.)
