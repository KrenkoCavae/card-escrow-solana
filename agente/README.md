# Agente de consulta — Card Escrow

Asistente de solo lectura que consulta el estado del programa Card Escrow en Solana Devnet usando tool calling.

## Instalación

```bash
cd agente
npm install
```

## Variables de entorno

Copia `.env.example` a `.env`:

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

Muestra el resumen calculado directamente desde las cuentas on-chain. Úsalo para verificar que los datos coinciden con la app.

## Ejecutar el agente

1. Inicia **LM Studio**, carga un modelo compatible con tool calling (ej. Qwen2.5 7B Instruct) y activa el servidor local.
2. Confirma que `LLM_BASE_URL` apunte a `http://localhost:1234/v1`.
3. Ejecuta:

```bash
npm run agente
```

O con una pregunta específica:

```bash
npm run agente -- "¿Cuántas órdenes pendientes hay?"
```

## Qué consulta la herramienta

`CARD_ESCROW_RESUMEN` lee todas las órdenes del programa y calcula:

- Total de órdenes
- Pendientes, pagadas, completadas y reembolsadas
- Monto total retenido (en órdenes pagadas o en tránsito)
- Lista de ofertas activas (pendientes)

El agente solo responde con datos reales obtenidos de la herramienta.
