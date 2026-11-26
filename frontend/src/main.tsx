import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { PublicKey } from '@solana/web3.js';
import { createRoot } from 'react-dom/client';
import { actionInstruction, condiciones, explorer, formatSol, getWallet, listarOfertas, parseSol, program, publish, readOrder, send, states } from './chain';
import type { Action, Order } from './chain';
import { obtenerCarta } from './cartas';
import { Condicion } from './generated/types';
import './style.css';

const demo = 'GfBqavM1TDMh19ZfQnqHCTJjXjTd2wCjJFwybUPiAT8M';
const actions: Record<Action, string> = {
  pagar: 'Pagar con Solflare', cancelar: 'Cancelar orden', enviar: 'Marcar como enviada',
  recibir: 'Confirmar recepción', aceptar: 'Aceptar y liberar pago',
  devolver: 'Solicitar devolución', reembolsar: 'Confirmar devolución y reembolsar',
};

function CartaVisual({ idCarta, esFoil }: { idCarta: number; esFoil: boolean }) {
  const carta = obtenerCarta(idCarta);
  if (!carta) return <div className="demo-card">?</div>;
  return (
    <div className={`carta ${esFoil ? 'foil' : ''}`}>
      <img src={carta.imagen} alt={carta.nombre} />
    </div>
  );
}

function App() {
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('orden') || '');
  const [order, setOrder] = useState<{key: string; data: Order}>();
  const [ofertas, setOfertas] = useState<{key: string; data: Order}[]>([]);
  const [actor, setActor] = useState('');
  const [price, setPrice] = useState('0.01');
  const [shipping, setShipping] = useState('0.002');
  const [idCarta, setIdCarta] = useState(1);
  const [esFoil, setEsFoil] = useState(false);
  const [condicion, setCondicion] = useState<Condicion>(Condicion.Mint);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    const wallet = getWallet();
    const update = (key?: PublicKey | null) => {
      setActor((key === undefined ? wallet?.publicKey : key)?.toBase58() ?? '');
    };
    const disconnect = () => setActor('');
    wallet?.on?.('accountChanged', update);
    wallet?.on?.('disconnect', disconnect);
    return () => {
      wallet?.off?.('accountChanged', update);
      wallet?.off?.('disconnect', disconnect);
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

  async function cargarOfertas() {
    const lista = await listarOfertas();
    setOfertas(lista);
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
    void cargarOfertas();
    if (query) void run(() => load(query));
  }, []);

  async function connectWallet() {
    const wallet = getWallet();
    if (!wallet) throw new Error('Abre esta página en un navegador con la extensión Solflare.');
    const result = await wallet.connect();
    const key = wallet.publicKey ?? result?.publicKey;
    if (!key) throw new Error('Solflare no devolvió una dirección. Desbloquea la extensión e intenta conectar de nuevo.');
    setActor(key.toBase58());
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
      const { key, instruction } = publish(actor, idCarta, esFoil, condicion, price, shipping);
      setQuery(key);
      await send(wallet, actor, instruction, setSignature);
      setMessage('Publicación confirmada.');
      await load(key);
      await cargarOfertas();
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
      await cargarOfertas();
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

  return <main>
    <header>
      <div><small>Solana Devnet</small><h1>Card Escrow</h1></div>
      <button disabled={busy} onClick={() => void run(connectWallet)}>{actor ? actor.slice(0, 5) + '…' + actor.slice(-4) : 'Conectar Solflare'}</button>
    </header>

    <section>
      <h2>Catálogo de ofertas</h2>
      <button disabled={busy} onClick={() => void run(cargarOfertas)}>Actualizar ofertas</button>
      {ofertas.length === 0 && <p>No hay ofertas pendientes en este momento.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {ofertas.map(({ key, data }) => {
          const carta = obtenerCarta(data.idCarta);
          return (
            <div key={key} style={{ border: '1px solid #34465d', borderRadius: '0.75rem', padding: '0.75rem', background: '#101722' }}>
              <CartaVisual idCarta={data.idCarta} esFoil={data.esFoil} />
              <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{carta?.nombre ?? 'Carta desconocida'}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {data.esFoil ? 'Foil · ' : ''}{condiciones[data.condicion]}<br />
                <strong>{formatSol(data.precio)}</strong>
              </p>
              <button style={{ marginTop: '0.5rem', width: '100%' }} disabled={busy} onClick={() => void run(() => load(key))}>
                Ver / Comprar
              </button>
            </div>
          );
        })}
      </div>
    </section>

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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', margin: '1rem 0' }}>
          <CartaVisual idCarta={order.data.idCarta} esFoil={order.data.esFoil} />
          <div>
            <h3>{obtenerCarta(order.data.idCarta)?.nombre ?? 'Carta'}</h3>
            <dl>
              <dt>Condición</dt><dd>{condiciones[order.data.condicion]}</dd>
              <dt>Foil</dt><dd>{order.data.esFoil ? 'Sí' : 'No'}</dd>
              <dt>Precio</dt><dd>{formatSol(order.data.precio)}</dd>
              <dt>Envío</dt><dd>{formatSol(order.data.envio)}</dd>
              <dt>Total</dt><dd><strong>{formatSol(order.data.precio + order.data.envio)}</strong></dd>
              <dt>Estado</dt><dd className="status">{states[order.data.estado]}</dd>
              <dt>Vendedor</dt><dd>{order.data.vendedor}</dd>
              {order.data.estado !== 0 && <><dt>Comprador</dt><dd>{order.data.comprador}</dd></>}
            </dl>
          </div>
        </div>
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
          <div>
            <label htmlFor="idCarta">Carta</label>
            <select id="idCarta" value={idCarta} onChange={e => setIdCarta(Number(e.target.value))}>
              {[1,2,3,4,5].map(id => {
                const c = obtenerCarta(id);
                return <option key={id} value={id}>{c?.nombre}</option>;
              })}
            </select>
          </div>
          <div>
            <label>
              <input type="checkbox" checked={esFoil} onChange={e => setEsFoil(e.target.checked)} /> Foil
            </label>
          </div>
          <div>
            <label htmlFor="condicion">Condición</label>
            <select id="condicion" value={condicion} onChange={e => setCondicion(Number(e.target.value) as Condicion)}>
              {condiciones.map((nombre, i) => <option key={i} value={i}>{nombre}</option>)}
            </select>
          </div>
          <div><label htmlFor="price">Precio en SOL</label><input id="price" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} required /></div>
          <div><label htmlFor="shipping">Envío en SOL</label><input id="shipping" inputMode="decimal" value={shipping} onChange={e => setShipping(e.target.value)} required /></div>
        </div>
        <div className="actions"><button disabled={busy || !actor}>Publicar orden</button></div>
      </form>
    </section>

    <p role="status">{busy ? 'Procesando solicitud…' : message}</p>
    {error && <p role="alert" className="error">{error}</p>}
    {signature && <p><a href={explorer('tx', signature)} target="_blank" rel="noreferrer">Ver última transacción en Explorer</a></p>}
    <small><a href={explorer('address', program.toBase58())} target="_blank" rel="noreferrer">Programa en Devnet</a></small>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
