import { address, createNoopSigner } from '@solana/kit';
import type { Instruction } from '@solana/kit';
import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
  CARD_ESCROW_PROGRAM_ADDRESS, ORDEN_DISCRIMINATOR, getOrdenDecoder, getPublicarInstruction,
  getPagarInstruction, getCancelarInstruction, getMarcarEnviadaInstruction,
  getConfirmarRecepcionInstruction, getAceptarInstruction,
  getSolicitarDevolucionInstruction, getConfirmarDevolucionInstruction,
} from './generated';
import { Condicion } from './generated/types';

export const program = new PublicKey(CARD_ESCROW_PROGRAM_ADDRESS);
export const rpc = new Connection(import.meta.env.VITE_DEVNET_RPC_URL || clusterApiUrl('devnet'), 'confirmed');
export const states = ['Pendiente de pago', 'Pagada', 'Completada', 'Enviada', 'Recibida', 'Devolución solicitada', 'Reembolsada'];
export const condiciones = ['Mint (M)', 'Near Mint (NM)', 'Lightly Played (LP)', 'Moderately Played (MP)', 'Heavily Played (HP)', 'Damaged (DMG)'];
export const explorer = (kind: 'address' | 'tx', value: string) =>
  'https://explorer.solana.com/' + kind + '/' + value + '?cluster=devnet';

export interface Wallet {
  publicKey?: PublicKey | null;
  connect(): Promise<void | { publicKey?: PublicKey | null }>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  on?(event: string, fn: (key?: PublicKey | null) => void): void;
  off?(event: string, fn: (key?: PublicKey | null) => void): void;
}
export function getWallet() {
  return (window as Window & { solflare?: Wallet }).solflare;
}

export async function readOrder(key: string) {
  const account = await rpc.getAccountInfo(new PublicKey(key));
  if (!account) throw new Error('La orden no existe en Devnet o ya se cerró.');
  if (!account.owner.equals(program)) throw new Error('La cuenta pertenece a otro programa.');
  const decoder = getOrdenDecoder();
  const expected = Buffer.from(ORDEN_DISCRIMINATOR);
  if (!expected.equals(account.data.subarray(0, 8))) throw new Error('La cuenta indicada no es una orden.');
  return decoder.decode(account.data);
}
export type Order = Awaited<ReturnType<typeof readOrder>>;

export function parseSol(value: string) {
  const match = /^(\d+)(?:\.(\d{1,9}))?$/.exec(value.trim());
  if (!match) throw new Error('Escribe un importe en SOL con hasta nueve decimales y usa punto decimal.');
  return BigInt(match[1]) * 1_000_000_000n + BigInt((match[2] || '').padEnd(9, '0'));
}

export function formatSol(value: bigint) {
  const fraction = String(value % 1_000_000_000n).padStart(9, '0').replace(/0+$/, '');
  return String(value / 1_000_000_000n) + (fraction ? '.' + fraction : '') + ' SOL';
}

export function publish(
  seller: string,
  idCarta: number,
  esFoil: boolean,
  condicion: Condicion,
  price: string,
  shipping: string,
) {
  const precio = parseSol(price);
  const envio = parseSol(shipping);
  if (precio === 0n || precio + envio > (1n << 64n) - 1n) throw new Error('El importe está fuera de rango.');
  if (idCarta < 1 || idCarta > 5) throw new Error('El id de carta debe estar entre 1 y 5.');

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(8)));
  const [key] = PublicKey.findProgramAddressSync([Buffer.from('orden'), new PublicKey(seller).toBuffer(), nonce], program);
  const orden = address(key.toBase58());

  return {
    key: orden,
    instruction: getPublicarInstruction({
      vendedor: createNoopSigner(address(seller)),
      orden,
      numero: nonce.readBigUInt64LE(),
      idCarta,
      esFoil,
      condicion,
      precio,
      envio,
    }),
  };
}

export type Action = 'pagar' | 'cancelar' | 'enviar' | 'recibir' | 'aceptar' | 'devolver' | 'reembolsar';

export function actionInstruction(action: Action, key: string, order: Order, actor: string): Instruction {
  const orden = address(key);
  const signer = createNoopSigner(address(actor));
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('boveda'), new PublicKey(key).toBuffer()], program);
  const boveda = address(vault.toBase58());
  switch (action) {
    case 'pagar': return getPagarInstruction({ comprador: signer, orden, boveda });
    case 'cancelar': return getCancelarInstruction({ vendedor: signer, orden });
    case 'enviar': return getMarcarEnviadaInstruction({ vendedor: signer, orden });
    case 'recibir': return getConfirmarRecepcionInstruction({ comprador: signer, orden });
    case 'aceptar': return getAceptarInstruction({ comprador: signer, vendedor: order.vendedor, orden, boveda });
    case 'devolver': return getSolicitarDevolucionInstruction({ comprador: signer, orden });
    case 'reembolsar': return getConfirmarDevolucionInstruction({ vendedor: signer, comprador: order.comprador, orden, boveda });
  }
}

export async function send(wallet: Wallet, actor: string, ix: Instruction, onSent: (signature: string) => void) {
  if (wallet.publicKey?.toBase58() !== actor) throw new Error('La cuenta de Solflare cambió. Vuelve a conectarla.');
  const tip = await rpc.getLatestBlockhash();
  const tx = new Transaction({ feePayer: new PublicKey(actor), ...tip }).add(new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map(({ address, role }) => ({
      pubkey: new PublicKey(address), isWritable: (role & 1) === 1, isSigner: role >= 2,
    })),
    data: Buffer.from(ix.data ?? []),
  }));
  const signed = await wallet.signTransaction(tx);
  const signature = await rpc.sendRawTransaction(signed.serialize(), { preflightCommitment: 'confirmed' });
  onSent(signature);
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = (await rpc.getSignatureStatuses([signature])).value[0];
    if (status?.err) throw new Error('La transacción falló: ' + JSON.stringify(status.err));
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Confirmación pendiente. Revisa la firma en Explorer antes de volver a enviar.');
}
