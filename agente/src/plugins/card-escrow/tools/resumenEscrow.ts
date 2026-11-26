import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7');
const ORDEN_DISCRIMINATOR = Buffer.from([0x5b, 0x6c, 0x7d, 0x8e, 0x9f, 0xa0, 0xb1, 0xc2]); // placeholder, se valida por tamaño

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

function decodeOrden(data: Buffer) {
  // Layout aproximado de Orden (100 bytes después del discriminador de 8):
  // vendedor: 32, comprador: 32, numero: 8, idCarta: 1, esFoil: 1, condicion: 1,
  // precio: 8, envio: 8, total: 8, estado: 1
  let offset = 8;
  const vendedor = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;
  const comprador = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;
  offset += 8; // numero
  const idCarta = data.readUInt8(offset);
  offset += 1;
  const esFoil = data.readUInt8(offset) === 1;
  offset += 1;
  const condicion = data.readUInt8(offset);
  offset += 1;
  const precio = data.readBigUInt64LE(offset);
  offset += 8;
  offset += 8; // envio
  const total = data.readBigUInt64LE(offset);
  offset += 8;
  const estado = data.readUInt8(offset);

  return { vendedor, comprador, idCarta, esFoil, condicion, precio, total, estado };
}

export async function resumenEscrow(rpcUrl: string): Promise<ResumenEscrow> {
  const connection = new Connection(rpcUrl, 'confirmed');

  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 108 }], // 8 + 100
  });

  let pendientes = 0;
  let pagadas = 0;
  let completadas = 0;
  let reembolsadas = 0;
  let montoRetenido = 0n;
  const ofertasActivas: ResumenEscrow['ofertas_activas'] = [];

  for (const { pubkey, account } of accounts) {
    try {
      const data = decodeOrden(account.data);
      const estado = data.estado;

      if (estado === 0) pendientes++;
      else if (estado === 1) pagadas++;
      else if (estado === 2) completadas++;
      else if (estado === 6) reembolsadas++;

      if ([1, 3, 4, 5].includes(estado)) {
        montoRetenido += data.total;
      }

      if (estado === 0) {
        ofertasActivas.push({
          key: pubkey.toBase58(),
          carta: data.idCarta,
          foil: data.esFoil,
          condicion: data.condicion,
          precio: data.precio.toString(),
          vendedor: data.vendedor,
        });
      }
    } catch {
      // ignorar
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
