# Card Escrow

## Ruta elegida y propósito

**Proyecto propio.** Card Escrow es una demostración de compraventa de cartas en Solana Devnet. El vendedor publica una orden con el precio de la carta y el costo del envío. El comprador deposita el total en una bóveda asociada a la orden. Después del envío y la confirmación de recepción, el comprador puede aceptar la carta y liberar el pago al vendedor, o solicitar una devolución. En ese caso, el vendedor confirma que recibió la carta de regreso y el programa reembolsa al comprador y cierra la bóveda.

El programa está escrito en Rust con Anchor. El frontend usa React, TypeScript y Vite. Codama genera el cliente desde [idl.json](idl.json) y Solflare firma las transacciones. [Código del programa](src/lib.rs) · [Cliente generado](frontend/src/generated)

## Configuración

- Red y fondos de prueba en **Solana Devnet**.
- Program ID `Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7`. [Ver el programa en Explorer](https://explorer.solana.com/address/Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7?cluster=devnet)
- Node.js 24 y npm para ejecutar el frontend.
- Solflare para firmar. Usa cuentas distintas para vendedor y comprador, ambas con SOL de Devnet. La consulta pública abre sin conectar una wallet.

## Ejecución desde Codespaces

Desde la raíz del repositorio:

```bash
cd frontend
npm ci
npm run generate
npm run build
```

Para abrir la versión compilada en local:

```bash
npm exec -- vite preview --port 5173 --strictPort
```

Abre `http://localhost:5173`. En GitHub Codespaces, usa este comando en lugar del anterior y abre el puerto 5173 desde la pestaña **Ports**:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="${CODESPACE_NAME}-5173.app.github.dev" \
npm exec -- vite preview --host 0.0.0.0 --port 5173 --strictPort
```

## Acceso por hosting (Vercel)

Ingresar a https://card-escrow-solana-krenkocavae.vercel.app/ 

## Aporte propio y cómo probarlo

El checkout comparte una orden mediante un enlace que puede abrirse sin wallet. La vista previa del vendedor y la consulta del comprador muestran la misma carta ficticia, **Guardián Aurora**, y el desglose del precio, envío y total. La imagen y el nombre son ilustrativos y se definen en el frontend. Los importes y el estado de la orden publicada se consultan en Devnet.

1. Pulsa **Ver ejemplo** para consultar una orden reembolsada con un total de **0.012 SOL**.
2. Conecta Solflare como vendedor, ingresa el precio y el envío y pulsa **Publicar orden**. Tras confirmarla, pulsa **Copiar enlace de pago**.
3. Abre el enlace en otro navegador. Comprueba la carta, el desglose y el estado **Pendiente de pago**. Si compartes el enlace de Codespaces, el puerto debe estar público y el servidor activo.
4. Abre el mismo enlace con Solflare y la cuenta compradora. Pulsa **Pagar con Solflare** y firma. Comprueba que la orden quede **Pagada** y que Explorer muestre el depósito en la bóveda.

El flujo de recepción también se comprueba intentando aceptar una orden pagada antes de marcarla como recibida. El programa devuelve `EstadoInvalido` (6001) y conserva los datos y saldos. El camino válido continúa con **Marcar como enviada**, **Confirmar recepción** y **Aceptar y liberar pago** o **Solicitar devolución**.

## Pruebas y evidencias

| Caso | Resultado observado en Devnet |
| --- | --- |
| Publicar y pagar desde el checkout | La orden quedó pagada. La instrucción `Pagar` transfirió 2.05 SOL de prueba a su bóveda y aportó 853,440 lamports para crearla. [Publicación](https://explorer.solana.com/tx/ZTpdyZKnZRsrC1fppRzJ8xxMFUtCzgLRH6ows8zeTcHCkt3MWWDW1kUNRpgYi5QY4HeYh51QYnsB3p4iYnoLwdD?cluster=devnet) · [Orden](https://explorer.solana.com/address/FsKdbBryaxndrDeqh9xatS743tu49m4EaTPuDNu2Mg8F?cluster=devnet) · [Pago](https://explorer.solana.com/tx/3RfGmFeMSbR1eq8RGiDnjr8zccxA2DipphiG6fM6qq7sbJR2Y7J78TSQNni5unDqQEJT5ccPr2Hs7CnnRmCWHUJn?cluster=devnet) |
| Cancelar una orden pendiente | El vendedor canceló la orden y la lectura posterior confirmó que se cerró la cuenta. [Cancelación](https://explorer.solana.com/tx/2w8ztvCJYXAjn9zFM5ntKTTMxuQtLJBx9A39eaCdufpctXzTZmo8uHvTzrsu3ccBSNpXdHSdPSY296TuLpkqxbVv?cluster=devnet) |
| Cancelar una orden pagada | El programa devolvió `EstadoInvalido` (6001). La orden y la bóveda conservaron sus datos y saldos. |
| Aceptar con una wallet ajena | El programa devolvió `CompradorNoAutorizado` (6003). La orden y la bóveda conservaron sus datos y saldos. |
| Presentar la bóveda de otra orden | El programa devolvió `ConstraintSeeds` (2006). Las dos órdenes y sus dos bóvedas conservaron sus datos y saldos. |
| Aceptar antes de la recepción | El programa devolvió `EstadoInvalido` (6001). La orden siguió pagada y la bóveda conservó su saldo. |
| Aceptar después de la recepción | La orden quedó completada, el vendedor recibió 12,000,000 lamports y se cerró la bóveda. [Aceptación y liquidación](https://explorer.solana.com/tx/5x5KubBGtwB33FX7qDb6YDRMQqjs6CyVqCvFLmYL3RnoH59e18nDcEuxL1WHpWrJywTYYDqu4iEKPy8aPDbsx4jX?cluster=devnet) |
| Solicitar y confirmar devolución | La orden quedó reembolsada, la bóveda se cerró y el comprador recibió 12,853,440 lamports, incluido el depósito de la bóveda. [Solicitud](https://explorer.solana.com/tx/387EAyZwzoqQ9imwAxTMQPwcJeaatsq2LyZsKMRV5pafUUc5Wk5KgTHxkZggC4HU3Z4h9KYXcdhiNvTkTn4cmBsc?cluster=devnet) · [Reembolso](https://explorer.solana.com/tx/5yYz24B5aaEz3HWbJrBfirJgCJnbN17FbqQK3T1J1FnU8bEAvZYDcDnut7Crvf8quaERMkvrqd3EpYUcXcoGkaUe?cluster=devnet) |

La publicación y el pago del checkout se probaron en Codespaces con Solflare. Las demás pruebas del programa se realizaron en Playground durante el desarrollo, en varias actualizaciones del mismo Program ID. Los rechazos se comprobaron con el mensaje del programa y una lectura posterior de las cuentas. Se hizo el deployment en Vercel para una mejor experiencia de manejo y ejecución.
