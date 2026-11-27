import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { crearCartaCoin } from './src/cashback';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Reemplaza con tu private key en base58 (la exportas desde Solflare o Phantom)
  const PRIVATE_KEY = 'PEGA_AQUI_TU_PRIVATE_KEY_EN_BASE58';

  if (PRIVATE_KEY.startsWith('PEGA')) {
    console.error('Edita el archivo y pega tu private key en PRIVATE_KEY');
    process.exit(1);
  }

  const secret = bs58.decode(PRIVATE_KEY);
  const payer = Keypair.fromSecretKey(secret);

  console.log('Creando CartaCoin con wallet:', payer.publicKey.toBase58());

  const mint = await crearCartaCoin(
    connection,
    payer,
    payer.publicKey,
    1_000_000n * 100n,
  );

  console.log('\nMint CartaCoin creado:');
  console.log(mint.toBase58());
  console.log('\nGuarda esta dirección. La usaremos en el frontend.');
}

main().catch(console.error);
