# Card Escrow v2

## Ruta elegida y propósito

**Proyecto propio.** Card Escrow es una demostración de compraventa de cartas TCG en Solana Devnet. El vendedor publica una oferta indicando la carta (de un catálogo de 5), si es foil, su condición (Mint a Damaged), el precio y el costo de envío. El comprador deposita el total en una bóveda asociada a la orden. Tras el envío y la confirmación de recepción, el comprador puede aceptar la carta y liberar el pago, o solicitar una devolución. En ese caso el vendedor confirma y el programa reembolsa al comprador y cierra la bóveda.

## Configuración

- Red y fondos de prueba en **Solana Devnet**.
- Program ID `Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7`.  
  [Ver el programa en Explorer](https://explorer.solana.com/address/Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7?cluster=devnet)

## Ejecución local / Codespaces

```bash
cd frontend
npm ci
npm run generate
npm run build
npm exec -- vite preview --port 5173 --strictPort
```

En Codespaces abre el puerto 5173 desde la pestaña **Ports**.

## Acceso por hosting (Vercel)

https://card-escrow-solana-krenkocavae.vercel.app/

Navegación principal:
- `#/` → Home / Landing
- `#/catalogo` → Catálogo de ofertas activas
- `#/publicar` → Publicar nueva oferta
- `#/orden/<dirección>` → Detalle de una orden
- `#/mis-ordenes` → Panel del usuario (en desarrollo)

## Aporte propio (v2) y cómo probarlo

### Nuevas capacidades respecto a v1
- Catálogo universal de 5 cartas con imágenes.
- Campos on-chain: `id_carta`, `es_foil` y `condicion` (Mint, NearMint, LightlyPlayed, ModeratelyPlayed, HeavilyPlayed, Damaged).
- Efecto foil visual en el frontend cuando la oferta es foil.
- Catálogo público de ofertas pendientes (listado con `getProgramAccounts`).
- Landing page con carta destacada (foil + Mint + mayor precio; en empate, la más reciente).
- Navegación por hash y diseño mejorado.

### Flujo recomendado de prueba
1. Abre la Home (`#/`). Observa la carta destacada (si hay ofertas foil Mint).
2. Ve al Catálogo. Comprueba que aparecen las ofertas con imagen, foil, condición y precio.
3. Como vendedor, entra a Publicar, elige carta, marca Foil si quieres, selecciona condición, precio y envío. Firma la transacción.
4. Copia el enlace de la orden y ábrelo en otra ventana/navegador (o con otra wallet).
5. Como comprador, paga la orden. Verifica en Explorer que el total se depositó en la bóveda.
6. Completa el flujo (marcar enviada → confirmar recepción → aceptar) o prueba un rechazo (por ejemplo, intentar aceptar antes de marcar como recibida → `EstadoInvalido`).

## Pruebas y evidencias

| Caso | Resultado observado en Devnet |
| --- | --- |
| Publicar y pagar | La orden queda Pagada y el total se transfiere a la bóveda. [Publicación](https://explorer.solana.com/tx/ZTpdyZKnZRsrC1fppRzJ8xxMFUtCzgLRH6ows8zeTcHCkt3MWWDW1kUNRpgYi5QY4HeYh51QYnsB3p4iYnoLwdD?cluster=devnet) · [Pago](https://explorer.solana.com/tx/3RfGmFeMSbR1eq8RGiDnjr8zccxA2DipphiG6fM6qq7sbJR2Y7J78TSQNni5unDqQEJT5ccPr2Hs7CnnRmCWHUJn?cluster=devnet) |
| Cancelar orden pendiente | El vendedor cierra la cuenta. [Cancelación](https://explorer.solana.com/tx/2w8ztvCJYXAjn9zFM5ntKTTMxuQtLJBx9A39eaCdufpctXzTZmo8uHvTzrsu3ccBSNpXdHSdPSY296TuLpkqxbVv?cluster=devnet) |
| Cancelar orden pagada | Rechazo `EstadoInvalido` (6001). Estado y saldos se conservan. |
| Aceptar con wallet ajena | Rechazo `CompradorNoAutorizado` (6003). |
| Bóveda de otra orden | Rechazo `ConstraintSeeds` (2006). |
| Aceptar antes de recepción | Rechazo `EstadoInvalido` (6001). |
| Aceptar tras recepción | Orden Completada, pago liberado al vendedor y bóveda cerrada. [Aceptación](https://explorer.solana.com/tx/5x5KubBGtwB33FX7qDb6YDRMQqjs6CyVqCvFLmYL3RnoH59e18nDcEuxL1WHpWrJywTYYDqu4iEKPy8aPDbsx4jX?cluster=devnet) |
| Solicitar y confirmar devolución | Orden Reembolsada, bóveda cerrada y fondos devueltos al comprador. [Solicitud](https://explorer.solana.com/tx/387EAyZwzoqQ9imwAxTMQPwcJeaatsq2LyZsKMRV5pafUUc5Wk5KgTHxkZggC4HU3Z4h9KYXcdhiNvTkTn4cmBsc?cluster=devnet) · [Reembolso](https://explorer.solana.com/tx/5yYz24B5aaEz3HWbJrBfirJgCJnbN17FbqQK3T1J1FnU8bEAvZYDcDnut7Crvf8quaERMkvrqd3EpYUcXcoGkaUe?cluster=devnet) |
| Id de carta fuera de rango (1-5) | Rechazo `CartaInvalida` (6004). |

Los rechazos se verifican con el mensaje del programa y una lectura posterior de las cuentas (el estado de negocio se mantiene).

## Correspondencia con criterios de evaluación

- **Operaciones válidas**: publicar, pagar, marcar enviada, confirmar recepción, aceptar, solicitar/confirmar devolución, cancelar.
- **Permisos**: solo el vendedor cancela o marca enviada; solo el comprador paga, confirma recepción o acepta; la bóveda está ligada a la orden.
- **Relación entre cuentas**: Orden ↔ Bóveda (seeds), vendedor/comprador verificados con `has_one`.
- **Baja / cierre condicionado**: la orden solo se puede cancelar en estado Pendiente; la bóveda se cierra al aceptar o reembolsar.
- **Regla nueva (v2)**: validación de `id_carta` entre 1 y 5 (`CartaInvalida`).

## Notas

- Las imágenes de las cartas viven en `frontend/public/cartas/` y no se almacenan on-chain.
- El efecto foil es puramente visual (CSS) y se activa con el campo `es_foil`.
- El catálogo lista solo órdenes en estado Pendiente.
