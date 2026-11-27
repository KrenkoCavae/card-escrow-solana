# CartaCoin – Cashback (Taller 2)

## Qué es

CartaCoin es un token SPL Token-2022 usado como cashback en el escrow. Se emite con las extensiones **MetadataPointer** y **PermanentDelegate**. El 5 % del total de una orden se puede entregar en CartaCoin al comprador.

## Direcciones

| Concepto | Dirección |
|----------|----------|
| Mint | `GL46rcJHo25NujJxEWg6A7NRwxYqXFGTGaNx8VcMhdNV` |
| Permanent Delegate | `48c76qcJyjDu9K2cXg37EViQNzAQRLkTd9Zhhwv4TetQ` |
| Decimales | 2 |
| Suministro inicial | 1,000,000 CARTA |

- [Mint en Explorer](https://explorer.solana.com/address/GL46rcJHo25NujJxEWg6A7NRwxYqXFGTGaNx8VcMhdNV?cluster=devnet)

## Cómo se creó

El mint se creó una sola vez con el script `crear-cartacoin.ts` (no hay interfaz de creación en la web). El permanent delegate queda como autoridad que puede transferir tokens sin la firma del propietario de la ATA.

## Cómo se entrega el cashback

El cashback no se incluye automáticamente en el pago del comprador (porque el permanent delegate debe firmar). En su lugar:

1. El comprador paga la orden normalmente.
2. El operador de la plataforma (wallet `48c76...`) entra al detalle de la orden y presiona **Enviar cashback**.
3. Esa transacción crea la ATA del comprador (si no existe) y transfiere el 5 % desde la reserva.

### Evidencia

- Transacción de cashback: [Explorer](https://explorer.solana.com/tx/WBUoWp5qcdnYXuJCWFqWC8c6iHDdxXn884fvDz9VmgPRtznKJZT9LS76picG9rtXH7frAwDh6n3kEBryTkQujKV?cluster=devnet)
- Holdings del comprador de prueba: [6aUL6Yv…](https://explorer.solana.com/address/6aUL6YvZeHZwwLbyKjfWczkUhbewxxb1zwGqcssHpRcg/tokens?cluster=devnet)

## Consulta de saldo

En la página **Mi Perfil** se muestra el saldo de CartaCoin de la wallet conectada. También se puede consultar en Explorer.

## Autoridades y validaciones

| Autoridad | Qué puede hacer |
|-----------|------------------|
| Mint authority | Crear el mint y mintear el suministro inicial de CartaCoin |
| Permanent Delegate | Transferir CartaCoin a cualquier wallet sin la firma del dueño de la ATA |
| Comprador | Recibir el cashback; no puede mintear ni transferir desde la reserva |

La red valida que el permanent delegate firme la transferencia. La aplicación solo muestra el botón cuando la wallet conectada es el permanent delegate.

## Limitantes

Dado que el demo contempla que hay múltiples vendedores y compradores, se determinó que la wallet `48c76...` es la única que puede brindar el cashback dada la complejidad técnica en torno a ventas descentralizadas. Por la misma situación, el otorgamiento de cashback se hace en dos partes:

- Primera: La wallet compradora liquida y valida por completa la orden.
- Segunda: La wallet `48c76...`, para las ordenes completadas, otorga cashback/token al presionar un botón que solo aparece en las ordenes si la wallet conectada es `48c76...` y si su estatus está como completado.

Esto se realizó de este modo ya que ambas wallets, compradora y vendedora (`48c76...`) tendrían que firmar al mismo tiempo.

## Archivos relevantes

- `src/cashback.ts` – creación del mint y construcción de instrucciones de transferencia
- `crear-cartacoin.ts` – script de una sola ejecución
- `src/chain.ts` – constantes del mint y del delegate
- `src/main.tsx` – botón “Enviar cashback” y visualización de saldo
