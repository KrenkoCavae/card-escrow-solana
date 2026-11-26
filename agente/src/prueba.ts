import 'dotenv/config';
import { resumenEscrow } from './plugins/card-escrow/tools/resumenEscrow.js';

async function main() {
  const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
  console.log('Consultando resumen del escrow en Devnet...\n');
  const resumen = await resumenEscrow(rpcUrl);
  console.log(JSON.stringify(resumen, null, 2));
}

main().catch(console.error);
