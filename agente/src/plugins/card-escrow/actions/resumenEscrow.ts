import { z } from 'zod';
import { resumenEscrow } from '../tools/resumenEscrow.js';

export const resumenEscrowAction = {
  name: 'CARD_ESCROW_RESUMEN',
  description: 'Obtiene un resumen del estado actual del escrow de cartas en Devnet: total de órdenes, pendientes, pagadas, completadas, reembolsadas, monto retenido y ofertas activas.',
  parameters: z.object({}),
  execute: async () => {
    const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
    return await resumenEscrow(rpcUrl);
  },
};
