## Cómo probarlo

1. Abre Solana Playground y crea un proyecto Anchor.
2. Copia el contenido de `src/lib.rs` del repositorio al proyecto y ejecuta Build.
3. Usa Devnet y el Program ID indicado arriba para consultar las transacciones de evidencia.
4. En Playground, usa una cuenta Solflare con SOL de Devnet para las operaciones de prueba.

El flujo se probó desde el cliente de Playground.

Se seleccionó la ruta de proyecto propio:
Program ID: Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7
https://explorer.solana.com/address/Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7?cluster=devnet

Confirmación de aceptación y pago:
https://explorer.solana.com/tx/5x5KubBGtwB33FX7qDb6YDRMQqjs6CyVqCvFLmYL3RnoH59e18nDcEuxL1WHpWrJywTYYDqu4iEKPy8aPDbsx4jX?cluster=devnet

Confirmación reembolso:
https://explorer.solana.com/tx/5yYz24B5aaEz3HWbJrBfirJgCJnbN17FbqQK3T1J1FnU8bEAvZYDcDnut7Crvf8quaERMkvrqd3EpYUcXcoGkaUe?cluster=devnet


## Para codespaces

El frontend usa React, TypeScript, Vite y Solflare. El cliente de
TypeScript se genera con Codama a partir de `idl.json`.

Desde la raíz del repositorio, con Node.js 24:

```bash
cd frontend
npm ci
npm run generate
npm run build
npm run dev
```

En Codespaces, abre el puerto 5173 desde la pestaña **Ports**. En local,
abre `http://localhost:5173`.

Pulsa **Ver ejemplo** para consultar una orden real en Devnet sin
conectar una wallet. El resultado esperado es **Reembolsada** con un
total de **0.012 SOL**. Para publicar una orden, conecta Solflare con
una wallet que tenga SOL de prueba en Devnet.

## Estado de verificación

- El frontend compiló y la pantalla principal abrió en Codespaces.
- Quedó pendiente ejecutar la consulta de ejemplo y firmar una
  transacción desde el frontend.
- El flujo del programa sí se probó en Devnet desde Solana Playground.
  La aceptación cerró la bóveda y pagó 12,000,000 lamports al vendedor.
  La devolución cerró la bóveda y reembolsó 12,853,440 lamports al
  comprador, incluido el depósito de la bóveda.
  [Aceptación](https://explorer.solana.com/tx/5x5KubBGtwB33FX7qDb6YDRMQqjs6CyVqCvFLmYL3RnoH59e18nDcEuxL1WHpWrJywTYYDqu4iEKPy8aPDbsx4jX?cluster=devnet)
  · [Reembolso](https://explorer.solana.com/tx/5yYz24B5aaEz3HWbJrBfirJgCJnbN17FbqQK3T1J1FnU8bEAvZYDcDnut7Crvf8quaERMkvrqd3EpYUcXcoGkaUe?cluster=devnet)
