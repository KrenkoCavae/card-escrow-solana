import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializePermanentDelegateInstruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  getMintLen,
  ExtensionType,
} from '@solana/spl-token';

export const CARTA_DECIMALS = 2;
export const CARTA_SYMBOL = 'CARTA';
export const CARTA_NAME = 'CartaCoin';

export function getAta(mint: PublicKey, owner: PublicKey) {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
}

export async function crearCartaCoin(
  connection: Connection,
  payer: Keypair,
  permanentDelegate: PublicKey,
  initialSupply: bigint,
): Promise<PublicKey> {
  const mint = Keypair.generate();

  const mintLen = getMintLen([
    ExtensionType.MetadataPointer,
    ExtensionType.PermanentDelegate,
  ]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      payer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializePermanentDelegateInstruction(
      mint.publicKey,
      permanentDelegate,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      CARTA_DECIMALS,
      payer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID,
    ),
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mint]);

  const reserveAta = getAta(mint.publicKey, permanentDelegate);
  const mintTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      reserveAta,
      permanentDelegate,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    createMintToInstruction(
      mint.publicKey,
      reserveAta,
      payer.publicKey,
      initialSupply,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  );
  await sendAndConfirmTransaction(connection, mintTx, [payer]);

  return mint.publicKey;
}

export function buildCashbackInstructions(
  mint: PublicKey,
  payer: PublicKey,
  recipient: PublicKey,
  amount: bigint,
  permanentDelegate: PublicKey,
) {
  const sourceAta = getAta(mint, permanentDelegate);
  const destAta = getAta(mint, recipient);

  return [
    createAssociatedTokenAccountInstruction(
      payer,
      destAta,
      recipient,
      mint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createTransferInstruction(
      sourceAta,
      destAta,
      permanentDelegate,
      amount,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ];
}

export function calcularCashback(totalLamports: bigint, porcentaje: number): bigint {
  if (porcentaje <= 0) return 0n;
  const base = (totalLamports * BigInt(porcentaje)) / 100n;
  return base / 10_000_000n;
}
