import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { actionInstruction, explorer, formatSol, getWallet, parseSol, program, publish, readOrder, send, states } from './chain';
import type { Action, Order } from './chain';
import './style.css';

const demo = 'GfBqavM1TDMh19ZfQnqHCTJjXjTd2wCjJFwybUPiAT8M';
const actions: Record<Action, string> = {
  pagar: 'Pagar con Solflare', cancelar: 'Cancelar orden', enviar: 'Marcar como enviada',
  recibir: 'Confirmar recepción', aceptar: 'Aceptar y liberar pago',
  devolver: 'Solicitar devolución', reembolsar: 'Confirmar devolución y reembolsar',
};

function Checkout({ precio, envio }: { precio: bigint; envio: bigint }) {
  return <div className="checkout">
    <div className="demo-card" aria-hidden="true">✦</div>
    <div>
      <small>Carta de demostración</small>
      <h3>Guardián Aurora</h3>
      <dl>
        <dt>Precio</dt><dd>{formatSol(precio)}</dd>
        <dt>Envío</dt><dd>{formatSol(envio)}</dd>
        <dt>Total</dt><dd><strong>{formatSol(precio + envio)}</strong></dd>
      </dl>
    </div>
  </div>;
}

function previewAmounts(price: string, shipping: string) {
  try {
    const precio = parseSol(price);
    const envio = parseSol(shipping);
    if (precio > 0n && precio + envio <= (1n << 64n) - 1n) return { precio, envio };
  } catch {
    // The preview is hidden until both amounts are valid.
  }
}

function App() {
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('orden') || '');
  const [order, setOrder] = useState<{key: string; data: Order}>();
  const [actor, setActor] = useState('');
  const [price, setPrice] = useState('0.01');
  const [shipping, setShipping] = useState('0.002');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    const wallet = getWallet();
    const update = () => setActor(wallet?.publicKey?.toBase58() || '');
    wallet?.on?.('accountChanged', update);
    wallet?.on?.('disconnect', update);
    return () => {
      wallet?.off?.('accountChanged', update);
      wallet?.off?.('disconnect', update);
    };
  }, []);

  async function run(task: () => Promise<void>) {
    setError('');
    setMessage('');
    setBusy(true);
    try { await task(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function load(key: string) {
    const cleanKey = key.trim();
    setOrder(undefined);
    const data = await readOrder(cleanKey);
    setOrder({ key: cleanKey, data });
    setQuery(cleanKey);
    const url = new URL(location.href);
    url.searchParams.set('orden', cleanKey);
    history.replaceState(null, '', url);
  }

  useEffect(() => {
    if (query) void run(() => load(query));
  }, []);

  async function connectWallet() {
    const wallet = getWallet();
    if (!wallet) throw new Error('Abre esta página en un navegador con la extensión Solflare.');
    const result = await wallet.connect();
    setActor(result.publicKey.toBase58());
  }

  function copyOrder(key: string, shareLink: boolean) {
    void run(async () => {
      const url = new URL(location.href);
      url.searchParams.set('orden', key);
      await navigator.clipboard.writeText(shareLink ? url.href : key);
      setMessage(shareLink ? 'Enlace de pago copiado.' : 'Dirección copiada.');
    });
  }

  function walletRequired() {
    const wallet = getWallet();
    if (!wallet || !actor) throw new Error('Conecta Solflare para firmar.');
    return wallet;
  }

  function submitPublish(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const wallet = walletRequired();
      setSignature('');
      const { key, instruction } = publish(actor, price, shipping);
      setQuery(key);
      await send(wallet, actor, instruction, setSignature);
      setMessage('Publicación confirmada.');
      await load(key);
    });
  }

  function perform(action: Action) {
    if (!order) return;
    const key = order.key;
    void run(async () => {
      const wallet = walletRequired();
      const latest = await readOrder(key);
      setSignature('');
      await send(wallet, actor, actionInstruction(action, key, latest, actor), setSignature);
      setMessage('Operación confirmada.');
      if (action === 'cancelar') setOrder(undefined);
      else await load(key);
    });
  }

  const available: Action[] = [];
  if (order && actor) {
    const { estado, vendedor, comprador } = order.data;
    if (estado === 0) available.push(actor === vendedor ? 'cancelar' : 'pagar');
    if (estado === 1 && actor === vendedor) available.push('enviar');
    if (estado === 3 && actor === comprador) available.push('recibir');
    if (estado === 4 && actor === comprador) available.push('aceptar', 'devolver');
    if (estado === 5 && actor === vendedor) available.push('reembolsar');
  }

  const preview = previewAmounts(price, shipping);

  return <main>
    <header>
      <div><small>Solana Devnet</small><h1>Card Escrow</h1></div>
      <button disabled={busy} onClick={() => void run(connectWallet)}>{actor ? actor.slice(0, 5) + '…' + actor.slice(-4) : 'Conectar Solflare'}</button>
    </header>
    <section>
      <h2>Consultar orden</h2>
      <form onSubmit={e => { e.preventDefault(); void run(() => load(query)); }}>
        <label htmlFor="order">Dirección de la orden</label>
        <div className="line">
          <input id="order" value={query} onChange={e => setQuery(e.target.value)} required />
          <button disabled={busy}>Consultar</button>
          <button type="button" disabled={busy} onClick={() => void run(() => load(demo))}>Ver ejemplo</button>
        </div>
      </form>
      {order && <>
        <Checkout precio={order.data.precio} envio={order.data.envio} />
        <dl>
          <dt>Estado</dt><dd className="status">{states[order.data.estado]}</dd>
          <dt>Vendedor</dt><dd>{order.data.vendedor}</dd>
          {order.data.estado !== 0 && <><dt>Comprador</dt><dd>{order.data.comprador}</dd></>}
        </dl>
        <div className="actions">
          <a href={explorer('address', order.key)} target="_blank" rel="noreferrer">Ver orden en Explorer</a>
          <button disabled={busy} onClick={() => copyOrder(order.key, true)}>Copiar enlace de pago</button>
          <button disabled={busy} onClick={() => copyOrder(order.key, false)}>Copiar dirección</button>
          {order.data.estado === 0 && !actor &&
            <button disabled={busy} onClick={() => void run(connectWallet)}>Conectar Solflare para pagar</button>}
          {available.map(action => <button disabled={busy} key={action} onClick={() => perform(action)}>{actions[action]}</button>)}
        </div>
      </>}
    </section>
    <section>
      <h2>Publicar orden</h2>
      <form onSubmit={submitPublish}>
        <div className="amounts">
          <div><label htmlFor="price">Precio en SOL</label><input id="price" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} required /></div>
          <div><label htmlFor="shipping">Envío en SOL</label><input id="shipping" inputMode="decimal" value={shipping} onChange={e => setShipping(e.target.value)} required /></div>
        </div>
        {preview && <Checkout {...preview} />}
        <div className="actions"><button disabled={busy || !actor || !preview}>Publicar orden</button></div>
      </form>
    </section>
    <p role="status">{busy ? 'Procesando solicitud…' : message}</p>
    {error && <p role="alert" className="error">{error}</p>}
    {signature && <p><a href={explorer('tx', signature)} target="_blank" rel="noreferrer">Ver última transacción en Explorer</a></p>}
    <small><a href={explorer('address', program.toBase58())} target="_blank" rel="noreferrer">Programa en Devnet</a></small>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
