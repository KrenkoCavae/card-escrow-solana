import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createRoot } from 'react-dom/client';
import { actionInstruction, condiciones, explorer, formatSol, getCashbackIxs, getWallet, listarMisOrdenes, listarOfertas, program, publish, readOrder, send, states, CASHBACK_PORCENTAJE, CARTA_MINT, CARTA_DELEGATE, rpc } from './chain';
import type { Action, Order } from './chain';
import { obtenerCarta } from './cartas';
import { Condicion } from './generated/types';
import { getAta, buildCashbackInstructions, calcularCashback } from './cashback';
import { TOKEN_2022_PROGRAM_ID, getAccount } from '@solana/spl-token';
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

const buttonClass: Partial<Record<Action, string>> = {
  enviar: 'logistica',
  recibir: 'logistica',
  devolver: 'devolucion',
  reembolsar: 'devolucion',
  aceptar: 'aceptar',
};

const buttonIcon: Partial<Record<Action, string>> = {
  enviar: '🚚',
  recibir: '📦',
  devolver: '↩️',
  reembolsar: '↩️',
  aceptar: '✓',
};

const condTagClass = ['tag-m', 'tag-nm', 'tag-lp', 'tag-mp', 'tag-hp', 'tag-dmg'];

function CartaVisual({ idCarta, esFoil }: { idCarta: number; esFoil: boolean }) {
  const carta = obtenerCarta(idCarta);
  if (!carta) return <div className="demo-card">?</div>;
  return (
    <div className={`carta ${esFoil ? 'foil' : ''}`}>
      <img src={carta.imagen} alt={carta.nombre} />
    </div>
  );
}

function TagsCarta({ esFoil, condicion }: { esFoil: boolean; condicion: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
      {esFoil && <span className="tag tag-foil">Foil</span>}
      <span className={`tag ${condTagClass[condicion] ?? 'tag-m'}`}>{condiciones[condicion]?.split(' ')[0]}</span>
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
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

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
        <div className="inner">
          <div>
            <small style={{ color: '#475569' }}>Solana Devnet</small>
            <h1 style={{ cursor: 'pointer' }} onClick={() => navigate('#/')}>Vault<span>Trade</span> Escrow</h1>
          </div>
          <nav>
            <a href="#/">Home</a>
            <a href="#/catalogo">Catálogo</a>
            <a href="#/publicar">Publicar</a>
            <a href="#/mis-ordenes">Mis órdenes</a>
            <a href="#/perfil">Mi Perfil</a>
            {actor ? (
              <>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>{actor.slice(0, 4) + '…' + actor.slice(-4)}</span>
                <button className="secondary" disabled={busy} onClick={() => void run(disconnectWallet)}>Desconectar</button>
              </>
            ) : (
              <button disabled={busy} onClick={() => void run(connectWallet)}>Conectar wallet</button>
            )}
          </nav>
        </div>
      </header>

      <main>
        {ruta === '#/' && <Landing />}
        {ruta === '#/catalogo' && <Catalogo busy={busy} run={run} />}
        {esOrden && <DetalleOrden ordenKey={ordenKey} actor={actor} busy={busy} run={run} setSignature={setSignature} setToast={setToast} />}
        {ruta === '#/publicar' && <Publicar actor={actor} busy={busy} run={run} setSignature={setSignature} setMessage={setMessage} />}
        {ruta === '#/mis-ordenes' && <MisOrdenes actor={actor} busy={busy} run={run} setSignature={setSignature} setMessage={setMessage} />}
        {ruta === '#/perfil' && <MiPerfil actor={actor} />}

        {error && <p role="alert" className="error">{error}</p>}
        {signature && <p><a href={explorer('tx', signature)} target="_blank" rel="noreferrer">Ver transacción</a></p>}
        <small><a href={explorer('address', program.toBase58())} target="_blank" rel="noreferrer">Programa en Devnet</a></small>
      </main>

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? '✓' : 'ℹ'} {toast.text}
        </div>
      )}
    </div>
  );
}

function Landing() {
  const [ofertas, setOfertas] = useState<{ key: string; data: Order }[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await listarOfertas();
      setOfertas(list.slice(0, 3));
    })();
  }, []);

  const cards = [0, 1, 2].map(i => ofertas[i] ?? null);

  return (
    <div>
      <div className="hero-wrap">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="dot" />
              TEMPORADA DE INTERCAMBIOS ABIERTA
            </div>
            <h2>Renueva tu mazo con cartas verificadas y <span>trades justos</span>.</h2>
            <p>
              Conecta con coleccionistas, inspecciona el estado físico real y protege tus intercambios con escrow en Solana.
            </p>
            <div className="actions">
              <a href="#/catalogo"><button style={{ background: '#F59E0B', color: '#0F172A' }}>Explorar catálogo</button></a>
              <a href="#/publicar"><button className="secondary" style={{ background: 'rgba(255,255,255,.08)', color: 'white', borderColor: 'rgba(255,255,255,.2)' }}>Publicar mi carpeta</button></a>
            </div>
          </div>

          <div className="card-fan">
            {cards.map((item, idx) => {
              const pos = idx === 0 ? 'left' : idx === 1 ? 'center' : 'right';
              if (!item) {
                return <div key={idx} className={`fan-card ${pos} fan-placeholder`}>Sin ofertas</div>;
              }
              return (
                <div key={item.key} className={`fan-card ${pos}`}>
                  <CartaVisual idCarta={item.data.idCarta} esFoil={item.data.esFoil} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="promo-grid">
        <div className="promo-card">
          <div className="promo-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          </div>
          <div>
            <div className="promo-label">Beneficio Trade</div>
            <h3>0% Comisión en Intercambios</h3>
            <p>Cambia cartas de igual valor con otros usuarios sin tarifas de plataforma.</p>
          </div>
        </div>

        <div className="promo-card">
          <div className="promo-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>
          </div>
          <div>
            <div className="promo-label" style={{ color: '#D97706' }}>Cupón: JUEGO10</div>
            <h3>10% OFF en Estados LP y MP</h3>
            <p>Ahorra armando mazos competitivos con cartas de desgaste ligero.</p>
          </div>
        </div>

        <div className="promo-card" onClick={() => setShowModal(true)} style={{ cursor: 'pointer' }}>
          <div className="promo-icon" style={{ background: '#ECFDF5', color: '#16A34A' }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <div>
            <div className="promo-label" style={{ color: '#16A34A' }}>Compra Segura</div>
            <h3>Envío Consolidado y Verificado</h3>
            <p>Revisamos autenticidad y estado físico antes de liberar el pago.</p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Proceso de verificación</h3>
            <ol>
              <li>El vendedor publica la carta con condición y fotos.</li>
              <li>El comprador paga. El SOL queda retenido en el escrow.</li>
              <li>El vendedor envía la carta física.</li>
              <li>El comprador confirma recepción o solicita devolución.</li>
              <li>Al aceptar, el pago se libera al vendedor.</li>
            </ol>
            <button onClick={() => setShowModal(false)}>Entendido</button>
          </div>
        </div>
      )}

      <section>
        <h2>¿Cómo funciona?</h2>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.7 }}>
          <li>El vendedor publica la carta con condición, foil y precio.</li>
          <li>El comprador paga. El dinero queda retenido en el escrow y recibe {CASHBACK_PORCENTAJE}% de cashback en CartaCoin.</li>
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
              <TagsCarta esFoil={data.esFoil} condicion={data.condicion} />
              <p style={{ marginTop: '0.3rem' }}>
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
  ordenKey, actor, busy, run, setSignature, setToast
}: {
  ordenKey: string;
  actor: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
  setSignature: (s: string) => void;
  setToast: (t: { text: string; type: 'success' | 'info' } | null) => void;
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

  const puedeEnviarCashback = actor === CARTA_DELEGATE.toBase58() && order.data.comprador && order.data.comprador !== CARTA_DELEGATE.toBase58();

  function perform(action: Action) {
    void run(async () => {
      const wallet = getWallet();
      if (!wallet || !actor) throw new Error('Conecta Solflare');
      const latest = await readOrder(ordenKey);
      setSignature('');
      const extra = action === 'pagar' ? getCashbackIxs(latest.total, actor) : [];
      await send(wallet, actor, actionInstruction(action, ordenKey, latest, actor), setSignature, extra);
      if (action === 'pagar') {
        setToast({ text: 'Pago confirmado + cashback en CartaCoin', type: 'success' });
      } else {
        setToast({ text: 'Operación confirmada', type: 'success' });
      }
      await load();
    });
  }

  function enviarCashback() {
    void run(async () => {
      if (!order?.data.comprador) return;
      const wallet = getWallet();
      if (!wallet || actor !== CARTA_DELEGATE.toBase58()) throw new Error('Conecta la wallet del permanent delegate');
      const amount = calcularCashback(order.data.total, CASHBACK_PORCENTAJE);
      if (amount === 0n) throw new Error('El cashback es 0');
      const ixs = buildCashbackInstructions(
        CARTA_MINT,
        CARTA_DELEGATE,
        new PublicKey(order.data.comprador),
        amount,
        CARTA_DELEGATE,
      );
      const tip = await rpc.getLatestBlockhash();
      const tx = new Transaction({ feePayer: CARTA_DELEGATE, ...tip }).add(...ixs);
      const signed = await wallet.signTransaction(tx);
      const sig = await rpc.sendRawTransaction(signed.serialize());
      setSignature(sig);
      setToast({ text: 'Cashback enviado en CartaCoin', type: 'success' });
    });
  }

  return (
    <section>
      <h2>Detalle de la orden</h2>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <CartaVisual idCarta={order.data.idCarta} esFoil={order.data.esFoil} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3>{obtenerCarta(order.data.idCarta)?.nombre}</h3>
          <TagsCarta esFoil={order.data.esFoil} condicion={order.data.condicion} />
          <dl style={{ marginTop: '0.8rem' }}>
            <dt>Precio</dt><dd>{formatSol(order.data.precio)}</dd>
            <dt>Envío</dt><dd>{formatSol(order.data.envio)}</dd>
            <dt>Total</dt><dd><strong>{formatSol(order.data.precio + order.data.envio)}</strong></dd>
            <dt>Cashback</dt><dd>{CASHBACK_PORCENTAJE}% en CartaCoin</dd>
            <dt>Estado</dt><dd className="status">{states[order.data.estado]}</dd>
            <dt>Vendedor</dt><dd>{order.data.vendedor}</dd>
            {order.data.estado !== 0 && <><dt>Comprador</dt><dd>{order.data.comprador}</dd></>}
          </dl>
          <div className="actions">
            {available.map(a => (
              <button key={a} className={buttonClass[a]} disabled={busy} onClick={() => perform(a)}>
                {buttonIcon[a] && <span>{buttonIcon[a]}</span>}
                {actions[a]}
              </button>
            ))}
            {puedeEnviarCashback && (
              <button disabled={busy} onClick={enviarCashback}>Enviar cashback</button>
            )}
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

function MisOrdenes({
  actor, busy, run, setSignature, setMessage
}: {
  actor: string;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
  setSignature: (s: string) => void;
  setMessage: (m: string) => void;
}) {
  const [ordenes, setOrdenes] = useState<{ key: string; data: Order; rol: 'vendedor' | 'comprador' }[]>([]);

  async function cargar() {
    if (!actor) {
      setOrdenes([]);
      return;
    }
    setOrdenes(await listarMisOrdenes(actor));
  }

  useEffect(() => { void cargar(); }, [actor]);

  function accionesDisponibles(data: Order, rol: 'vendedor' | 'comprador'): Action[] {
    const { estado } = data;
    const list: Action[] = [];
    if (rol === 'vendedor') {
      if (estado === 1) list.push('enviar');
      if (estado === 5) list.push('reembolsar');
    }
    if (rol === 'comprador') {
      if (estado === 3) list.push('recibir');
      if (estado === 4) list.push('aceptar', 'devolver');
    }
    return list;
  }

  function perform(key: string, action: Action) {
    void run(async () => {
      const wallet = getWallet();
      if (!wallet || !actor) throw new Error('Conecta Solflare');
      const latest = await readOrder(key);
      setSignature('');
      await send(wallet, actor, actionInstruction(action, key, latest, actor), setSignature);
      setMessage('Operación confirmada');
      await cargar();
    });
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Mis órdenes</h2>
        {actor && <button disabled={busy} onClick={() => void run(cargar)}>Actualizar</button>}
      </div>
      {!actor && <p>Conecta tu wallet para ver tus órdenes.</p>}
      {actor && ordenes.length === 0 && <p>No tienes órdenes activas o finalizadas.</p>}
      <div className="grid-catalogo">
        {ordenes.map(({ key, data, rol }) => {
          const carta = obtenerCarta(data.idCarta);
          const disponibles = accionesDisponibles(data, rol);
          return (
            <div key={key} className="card-oferta">
              <CartaVisual idCarta={data.idCarta} esFoil={data.esFoil} />
              <h3>{carta?.nombre ?? 'Carta'}</h3>
              <TagsCarta esFoil={data.esFoil} condicion={data.condicion} />
              <p>
                <strong>{rol === 'vendedor' ? 'Venta' : 'Compra'}</strong><br />
                {formatSol(data.precio)}<br />
                <span className="status">{states[data.estado]}</span>
              </p>
              <div className="actions" style={{ marginTop: '0.5rem' }}>
                {disponibles.map(a => (
                  <button key={a} className={buttonClass[a]} disabled={busy} onClick={() => perform(key, a)}>
                    {buttonIcon[a] && <span>{buttonIcon[a]}</span>}
                    {actions[a]}
                  </button>
                ))}
                <a href={`#/orden/${key}`}><button>Ver detalle</button></a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MiPerfil({ actor }: { actor: string }) {
  const [ordenes, setOrdenes] = useState<{ key: string; data: Order; rol: 'vendedor' | 'comprador' }[]>([]);
  const [cartaSaldo, setCartaSaldo] = useState<string>('0');

  useEffect(() => {
    if (!actor) return;
    void (async () => {
      const list = await listarMisOrdenes(actor);
      setOrdenes(list);

      try {
        const ata = getAta(CARTA_MINT, new PublicKey(actor));
        const acc = await getAccount(rpc, ata, undefined, TOKEN_2022_PROGRAM_ID);
        const ui = Number(acc.amount) / 100;
        setCartaSaldo(ui.toFixed(2));
      } catch {
        setCartaSaldo('0');
      }
    })();
  }, [actor]);

  if (!actor) return <section><p>Conecta tu wallet para ver tu perfil.</p></section>;

  const compras = ordenes.filter(o => o.rol === 'comprador');
  const ventas = ordenes.filter(o => o.rol === 'vendedor');

  const comprasExitosas = compras.filter(o => o.data.estado === 2).length;
  const comprasDevolucion = compras.filter(o => o.data.estado === 6).length;
  const ventasExitosas = ventas.filter(o => o.data.estado === 2).length;
  const ventasReembolso = ventas.filter(o => o.data.estado === 6).length;

  const solGastado = compras.reduce((s, o) => s + o.data.total, 0n);
  const solGanado = ventas.filter(o => o.data.estado === 2).reduce((s, o) => s + o.data.total, 0n);

  const enTransito = compras.filter(o => o.data.estado === 3).length;
  const pendientesEnvio = ventas.filter(o => o.data.estado === 1).length;
  const enTransporte = ventas.filter(o => o.data.estado === 3).length;

  const recientes = [...ordenes].sort((a, b) => Number(b.data.numero - a.data.numero)).slice(0, 5);

  return (
    <div>
      <h2>Mi Perfil</h2>
      <div className="grid-catalogo" style={{ marginBottom: '1.5rem' }}>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>🛒</div>
          <div><h3>Compras</h3><p>{compras.length} · {comprasExitosas} exitosas</p></div>
        </div>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#ECFDF5', color: '#16A34A' }}>💰</div>
          <div><h3>Ventas</h3><p>{ventas.length} · {ventasExitosas} exitosas</p></div>
        </div>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>↓</div>
          <div><h3>SOL gastado</h3><p>{formatSol(solGastado)}</p></div>
        </div>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#DCFCE7', color: '#16A34A' }}>↑</div>
          <div><h3>SOL ganado</h3><p>{formatSol(solGanado)}</p></div>
        </div>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>✨</div>
          <div>
            <h3>CartaCoin</h3>
            <p>{cartaSaldo} CARTA</p>
            <a href={explorer('address', CARTA_MINT.toBase58())} target="_blank" rel="noreferrer"><button className="secondary" style={{ marginTop: '0.4rem' }}>Ver mint</button></a>
          </div>
        </div>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>🚚</div>
          <div><h3>Logística</h3><p>En tránsito: {enTransito}<br/>Pend. envío: {pendientesEnvio}<br/>En transporte: {enTransporte}</p></div>
        </div>
        <div className="perfil-card">
          <div className="perfil-icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>↩️</div>
          <div><h3>Devoluciones</h3><p>Compras: {comprasDevolucion}<br/>Ventas: {ventasReembolso}</p></div>
        </div>
      </div>

      <section>
        <h2>Actividad reciente</h2>
        {recientes.length === 0 && <p>Sin actividad.</p>}
        {recientes.map(({ key, data, rol }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <strong>{obtenerCarta(data.idCarta)?.nombre}</strong>
              <TagsCarta esFoil={data.esFoil} condicion={data.condicion} />
              <small>{rol === 'vendedor' ? 'Venta' : 'Compra'} · {states[data.estado]}</small>
            </div>
            <a href={`#/orden/${key}`}><button className="secondary">Ver</button></a>
          </div>
        ))}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
