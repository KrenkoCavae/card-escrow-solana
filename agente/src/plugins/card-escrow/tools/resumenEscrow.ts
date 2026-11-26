import { Connection, PublicKey } from '@solana/web3.js';
import { getOrdenDecoder } from '../../../generated/accounts/orden.js';
import { CARD_ESCROW_PROGRAM_ADDRESS } from '../../../generated/index.js';

export interface ResumenEscrow {
  existe: boolean;
  total_ordenes: number;
  pendientes: number;
  pagadas: number;
  completadas: number;
  reembolsadas: number;
  monto_total_retenido: string;
  ofertas_activas: {
    key: string;
    carta: number;
    foil: boolean;
    condicion: number;
    precio: string;
    vendedor: string;
  }[];
}

const states = ['Pendiente', 'Pagada', 'Completada', 'Enviada', 'Recibida', 'DevolucionSolicitada', 'Reembolsada'];

export async function resumenEscrow(rpcUrl: string): Promise<ResumenEscrow> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const programId = new PublicKey(CARD_ESCROW_PROGRAM_ADDRESS);

  const accounts = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: 8 + 100 }],
  });

  const decoder = getOrdenDecoder();
  let pendientes = 0;
  let pagadas = 0;
  let completadas = 0;
  let reembolsadas = 0;
  let montoRetenido = 0n;
  const ofertasActivas: ResumenEscrow['ofertas_activas'] = [];

  for (const { pubkey, account } of accounts) {
    try {
      const data = decoder.decode(account.data);
      const estado = Number(data.estado);

      if (estado === 0) pendientes++;
      else if (estado === 1) pagadas++;
      else if (estado === 2) completadas++;
      else if (estado === 6) reembolsadas++;

      // Monto retenido: órdenes pagadas o en tránsito (1, 3, 4, 5)
      if ([1, 3, 4, 5].includes(estado)) {
        montoRetenido += BigInt(data.total);
      }

      if (estado === 0) {
        ofertasActivas.push({
          key: pubkey.toBase58(),
          carta: Number(data.idCarta),
          foil: Boolean(data.esFoil),
          condicion: Number(data.condicion),
          precio: String(data.precio),
          vendedor: String(data.vendedor),
        });
      }
    } catch {
      // ignorar cuentas inválidas
    }
  }

  return {
    existe: accounts.length > 0,
    total_ordenes: accounts.length,
    pendientes,
    pagadas,
    completadas,
    reembolsadas,
    monto_total_retenido: montoRetenido.toString(),
    ofertas_activas: ofertasActivas,
  };
}
