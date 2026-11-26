import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { PublicKey } from '@solana/web3.js';
import { createRoot } from 'react-dom/client';
import { actionInstruction, condiciones, explorer, formatSol, getWallet, listarOfertas, program, publish, readOrder, send, states } from './chain';
import type { Action, Order } from './chain';
import { obtenerCarta } from './cartas';
import { Condicion } from './generated/types';
import './style.css';

const actions: Record<Action, string> = {
  pagar: 'Pagar con Solflare',
  cancelar: 'Cancelar orden',
  enviar: 'Marcar como enviada',
  recibir: 'Confirmar recepción',
  aceptar: 'Aceptar y liberar pago',
  devolver: 'Solicitar devolución',
  reembolsar: 'Confirmar devolución y reembolsar',
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

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function App() {
  const hash = useHash();
  const [actor, setActor] = useState('');
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
    update();
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

  async function connectWallet() {
    const wallet = getWallet();
    if (!wallet) throw new Error('Abre esta página en un navegador con la extensión Solflare.');
    const result = await wallet.connect();
    const key = wallet.publicKey ?? result?.publicKey;
    if (!key) throw new Error('Solflare no devolvió una dirección.');
    setActor(key.toBase58());
  }

  async function disconnectWallet() {
    const wallet = getWallet();
    if (wallet?.disconnect) {
      await wallet.disconnect();
    }
    setActor('');
  }

  function navigate(to: string) {
    location.hash = to;
  }

  const ruta = hash.split('?')[0];
  const esOrden = ruta.startsWith('#/orden/');
  const ordenKey = esOrden ? ruta.slice('#/orden/'.length) : '';

  return (
    <div>
      <header>
        <div>
          <small>Solana Devnet</small>
          <h1 style={{ cursor: 'pointer' }} onClick={() => navigate('#/')}>Card Escrow</h1>
        </div>
        <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <a href="#/">Home</a>
          <a href="#/catalogo">Catálogo</a>
          <a href="#/publicar">Publicar</a>
          <a href="#/mis-ordenes">Mis órdenes</a>
          {actor ? (
            <>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{actor.slice(0, 4) + '…' + actor.slice(-4)}</span>
              <button disabled={busy} onClick={() => void run(disconnectWallet)}>Desconectar</button>
            </>
          ) : (
            <button disabled={busy} onClick={() => void run(connectWallet)}>Conectar</button>
          )}
        </nav>
      </header>

      <main>
        {ruta === '#/' && <Landing />}
        {ruta === '#/catalogo' && <Catalogo busy={busy} run={run} />}
        {esOrden && <DetalleOrden ordenKey={ordenKey} actor={actor} busy={busy} run={run} setSignature={setSignature} setMessage={setMessage} />}
        {ruta === '#/publicar' && <Publicar actor={actor} busy={busy} run={run} setSignature={setSignature} setMessage={setMessage} />}
        {ruta === '#/mis-ordenes' && <MisOrdenes actor={actor} />}

        <p role="status">{busy ? 'Procesando…' : message}</p>
        {error && <p role="alert" className="error">{error}</p>}
        {signature && <p><a href={explorer('tx', signature)} target="_blank" rel="noreferrer">Ver transacción</a></p>}
        <small><a href={explorer('address', program.toBase58())} target="_blank" rel="noreferrer">Programa en Devnet</a></small>
      </main>
    </div>
  );
}

function Landing() {
  const [destacada, setDestacada] = useState<{ key: string; data: Order } | null>(null);

  useEffect(() => {
    void (async () => {
      const ofertas = await listarOfertas();
      const foilsMint = ofertas
        .filter(o => o.data.esFoil && o.data.condicion === Condicion.Mint)
        .sort((a, b) => {
          if (a.data.precio !== b.data.precio) return Number(b.data.precio - a.data.precio);
          return b.data.numero > a.data.numero ? 1 : -1;
        });
      setDestacada(foilsMint[0] ?? null);
    })();
  }, []);

  return (
    <div>
      <section style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <h2 style={{ fontSize: '2.2rem', marginBottom: '.6rem' }}>Compra y vende cartas con confianza</h2>
        <p style={{ fontSize: '1.15rem', color: '#cbd5e1', maxWidth: '36rem', margin: '0 auto 1.5rem' }}>
          Escrow seguro en Solana. El pago queda bloqueado hasta que confirmes la recepción de tu carta.
        </p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <a href="#/catalogo"><button>Explorar catálogo</button></a>
          <a href="#/publicar"><button>Publicar una carta</button></a>
        </div>
      </section>

      {destacada && (
        <section>
          <h2>Carta destacada</h2>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ maxWidth: 240 }}>
              <CartaVisual idCarta={destacada.data.idCarta} esFoil={true} />
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>{obtenerCarta(destacada.data.idCarta)?.nombre}</h3>
              <p>
                <strong>Foil · Mint</strong><br />
                Precio: <strong>{formatSol(destacada.data.precio)}</strong>
              </p>
              <a href={`#/orden/${destacada.key}`}><button>Ver oferta</button></a>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2>Promociones del momento</h2>
        <div className="grid-catalogo">
          <div className="card-oferta">
            <h3>Envío gratis en tu primera compra</h3>
            <p>Usa el código <strong>DEVNETFREE</strong> al publicar (demo).</p>
          </div>
          <div className="card-oferta">
            <h3>Vendedores verificados</h3>
            <p>Todas las transacciones quedan registradas en Solana Explorer.</p>
          </div>
          <div className="card-oferta">
            <h3>Protección total</h3>
            <p>Si hay problema, puedes solicitar devolución antes de liberar el pago.</p>
          </div>
        </div>
      </section>

      <section>
        <h2>¿Cómo funciona?</h2>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.7 }}>
          <li>El vendedor publica la carta con condición, foil y precio.</li>
          <li>El comprador paga. El dinero queda retenido en el escrow.</li>
          <li>El vendedor envía la carta física.</li>
          <li>El comprador confirma la recepción o solicita devolución.</li>
        </ol>
      </section>
    </div>
  );
}

function Catalogo({ busy, run }: { busy: boolean; run: (fn: () => Promise<void>) => void }) {
  const [ofertas, setOfertas] = useState<{ key: string; data: Order }[]>([]);

  async function cargar() {
    setOfertas(await listarOfertas());
  }

  useEffect(() => { void cargar(); }, []);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Catálogo de ofertas</h2>
        <button disabled={busy} onClick={() => void run(cargar)}>Actualizar</button>
      </div>
      {ofertas.length === 0 && <p>No hay ofertas activas.</p>}
      <div className="grid-catalogo">
        {ofertas.map(({ key, data }) => {
          const carta = obtenerCarta(data.idCarta);
          return (
            <div key={key} className="card-oferta">
              <CartaVisual idCarta={data.idCarta} esFoil={data.esFoil} />
              <h3>{carta?.nombre ?? 'Carta'}</h3>
              <p>
                {data.esFoil ? 'Foil · ' : ''}{condiciones[data.condicion]}<br />
                <strong>{formatSol(data.precio)}</strong>
              </p>
              <a href={`#/orden/${key}`}><button style={{ width: '100%' }}>Ver detalle</button></a>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DetalleOrden({
  ordenKey, actor, busy, run, setSignature, setMessage
}: {
  ordenKey: string;
  actor: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
  setSignature: (s: string) => void;
  setMessage: (m: string) => void;
}) {
  const [order, setOrder] = useState<{ key: string; data: Order } | null>(null);

  async function load() {
    const data = await readOrder(ordenKey);
    setOrder({ key: ordenKey, data });
  }

  useEffect(() => { void load(); }, [ordenKey]);

  if (!order) return <section><p>Cargando orden…</p></section>;

  const available: Action[] = [];
  if (actor) {
    const { estado, vendedor, comprador } = order.data;
    if (estado === 0) available.push(actor === vendedor ? 'cancelar' : 'pagar');
    if (estado === 1 && actor === vendedor) available.push('enviar');
    if (estado === 3 && actor === comprador) available.push('recibir');
    if (estado === 4 && actor === comprador) available.push('aceptar', 'devolver');
    if (estado === 5 && actor === vendedor) available.push('reembolsar');
  }

  function perform(action: Action) {
    void run(async () => {
      const wallet = getWallet();
      if (!wallet || !actor) throw new Error('Conecta Solflare');
      const latest = await readOrder(ordenKey);
      setSignature('');
      await send(wallet, actor, actionInstruction(action, ordenKey, latest, actor), setSignature);
      setMessage('Operación confirmada');
      await load();
    });
  }

  return (
    <section>
      <h2>Detalle de la orden</h2>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <CartaVisual idCarta={order.data.idCarta} esFoil={order.data.esFoil} />
        <div>
          <h3>{obtenerCarta(order.data.idCarta)?.nombre}</h3>
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
          <div className="actions">
            {available.map(a => (
              <button key={a} disabled={busy} onClick={() => perform(a)}>{actions[a]}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Publicar({
  actor, busy, run, setSignature, setMessage
}: {
  actor: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
  setSignature: (s: string) => void;
  setMessage: (m: string) => void;
}) {
  const [idCarta, setIdCarta] = useState(1);
  const [esFoil, setEsFoil] = useState(false);
  const [condicion, setCondicion] = useState<Condicion>(Condicion.Mint);
  const [price, setPrice] = useState('0.01');
  const [shipping, setShipping] = useState('0.002');

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (!actor) throw new Error('Conecta Solflare');
      const wallet = getWallet()!;
      setSignature('');
      const { key, instruction } = publish(actor, idCarta, esFoil, condicion, price, shipping);
      await send(wallet, actor, instruction, setSignature);
      setMessage('Publicación confirmada');
      location.hash = `#/orden/${key}`;
    });
  }

  return (
    <section>
      <h2>Publicar oferta</h2>
      <form onSubmit={submit}>
        <div className="amounts">
          <div className="form-field">
            <label>Carta</label>
            <select value={idCarta} onChange={e => setIdCarta(Number(e.target.value))}>
              {[1,2,3,4,5].map(id => <option key={id} value={id}>{obtenerCarta(id)?.nombre}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Condición</label>
            <select value={condicion} onChange={e => setCondicion(Number(e.target.value) as Condicion)}>
              {condiciones.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </div>
          <div className="checkbox-field">
            <input type="checkbox" id="foil" checked={esFoil} onChange={e => setEsFoil(e.target.checked)} />
            <label htmlFor="foil" style={{ margin: 0 }}>Foil</label>
          </div>
          <div className="form-field">
            <label>Precio (SOL)</label>
            <input value={price} onChange={e => setPrice(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Envío (SOL)</label>
            <input value={shipping} onChange={e => setShipping(e.target.value)} required />
          </div>
        </div>
        <div className="actions">
          <button disabled={busy || !actor}>Publicar</button>
        </div>
      </form>
    </section>
  );
}

function MisOrdenes({ actor }: { actor: string }) {
  return (
    <section>
      <h2>Mis órdenes</h2>
      {!actor ? <p>Conecta tu wallet para ver tus órdenes.</p> : <p>Próximamente: filtro de órdenes donde eres vendedor o comprador.</p>}
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
