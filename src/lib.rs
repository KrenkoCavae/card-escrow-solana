use anchor_lang::{prelude::*, system_program};

declare_id!("Hq83Mc7kCATrYLwQ71e3Q7QoKBxU54iAH5hiyx8j4Gb7");

#[program]
pub mod card_escrow {
    use super::*;

    pub fn publicar(
        ctx: Context<Publicar>,
        numero: u64,
        precio: u64,
        envio: u64,
    ) -> Result<()> {
        require!(precio > 0, ErrorEscrow::ImporteInvalido);
        let total = precio.checked_add(envio).ok_or(ErrorEscrow::ImporteInvalido)?;

        ctx.accounts.orden.set_inner(Orden {
            vendedor: ctx.accounts.vendedor.key(),
            comprador: Pubkey::default(),
            numero,
            precio,
            envio,
            total,
            estado: Estado::Pendiente,
        });
        Ok(())
    }

    pub fn marcar_enviada(ctx: Context<ActualizarComoVendedor>) -> Result<()> {
    let orden = &mut ctx.accounts.orden;
    require!(orden.estado == Estado::Pagada, ErrorEscrow::EstadoInvalido);
    orden.estado = Estado::Enviada;
    Ok(())
    }

pub fn confirmar_recepcion(ctx: Context<ActualizarComoComprador>) -> Result<()> {
    let orden = &mut ctx.accounts.orden;
    require!(orden.estado == Estado::Enviada, ErrorEscrow::EstadoInvalido);
    orden.estado = Estado::Recibida;
    Ok(())
    }

pub fn solicitar_devolucion(ctx: Context<ActualizarComoComprador>) -> Result<()> {
    let orden = &mut ctx.accounts.orden;
    require!(orden.estado == Estado::Recibida, ErrorEscrow::EstadoInvalido);
    orden.estado = Estado::DevolucionSolicitada;
    Ok(())
    }

pub fn confirmar_devolucion(ctx: Context<ConfirmarDevolucion>) -> Result<()> {
    let orden = &mut ctx.accounts.orden;
    require!(
        orden.estado == Estado::DevolucionSolicitada,
        ErrorEscrow::EstadoInvalido
    );
    orden.estado = Estado::Reembolsada;
    Ok(())
    }

    pub fn cancelar(ctx: Context<Cancelar>) -> Result<()> {
    require!(
        ctx.accounts.orden.estado == Estado::Pendiente,
        ErrorEscrow::EstadoInvalido
    );
    Ok(())
    }   

    pub fn pagar(ctx: Context<Pagar>) -> Result<()> {
        let orden = &mut ctx.accounts.orden;
        require!(orden.estado == Estado::Pendiente, ErrorEscrow::EstadoInvalido);
        require_keys_neq!(
            orden.vendedor,
            ctx.accounts.comprador.key(),
            ErrorEscrow::CompradorInvalido
        );

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.comprador.to_account_info(),
                    to: ctx.accounts.boveda.to_account_info(),
                },
            ),
            orden.total,
        )?;
        ctx.accounts.boveda.orden = orden.key();
        orden.comprador = ctx.accounts.comprador.key();
        orden.estado = Estado::Pagada;
        Ok(())
    }

    pub fn aceptar(ctx: Context<Aceptar>) -> Result<()> {
        let orden = &mut ctx.accounts.orden;
        require!(orden.estado == Estado::Recibida, ErrorEscrow::EstadoInvalido);

        let boveda = ctx.accounts.boveda.to_account_info();
        let vendedor = ctx.accounts.vendedor.to_account_info();
        let saldo_boveda = boveda.lamports()
            .checked_sub(orden.total)
            .ok_or(ErrorEscrow::ImporteInvalido)?;
        let saldo_vendedor = vendedor.lamports()
            .checked_add(orden.total)
            .ok_or(ErrorEscrow::ImporteInvalido)?;

        **boveda.try_borrow_mut_lamports()? = saldo_boveda;
        **vendedor.try_borrow_mut_lamports()? = saldo_vendedor;
        orden.estado = Estado::Completada;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(numero: u64)]
pub struct Publicar<'info> {
    #[account(mut)]
    pub vendedor: Signer<'info>,
    #[account(
        init,
        payer = vendedor,
        space = 8 + Orden::TAMANO,
        seeds = [b"orden", vendedor.key().as_ref(), &numero.to_le_bytes()],
        bump
    )]
    pub orden: Account<'info, Orden>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancelar<'info> {
    #[account(mut)]
    pub vendedor: Signer<'info>,

    #[account(mut, has_one = vendedor, close = vendedor)]
    pub orden: Account<'info, Orden>,
}

#[derive(Accounts)]
pub struct Pagar<'info> {
    #[account(mut)]
    pub comprador: Signer<'info>,
    #[account(mut)]
    pub orden: Account<'info, Orden>,
    #[account(
        init,
        payer = comprador,
        space = 8 + 32,
        seeds = [b"boveda", orden.key().as_ref()],
        bump
    )]
    pub boveda: Account<'info, Boveda>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActualizarComoVendedor<'info> {
    pub vendedor: Signer<'info>,

    #[account(mut, has_one = vendedor)]
    pub orden: Account<'info, Orden>,
}

#[derive(Accounts)]
pub struct ActualizarComoComprador<'info> {
    pub comprador: Signer<'info>,

    #[account(mut, has_one = comprador @ ErrorEscrow::CompradorNoAutorizado)]
    pub orden: Account<'info, Orden>,
}

#[derive(Accounts)]
pub struct ConfirmarDevolucion<'info> {
    pub vendedor: Signer<'info>,

    #[account(mut)]
    pub comprador: SystemAccount<'info>,

    #[account(mut, has_one = vendedor, has_one = comprador)]
    pub orden: Account<'info, Orden>,

    #[account(
        mut,
        seeds = [b"boveda", orden.key().as_ref()],
        bump,
        has_one = orden,
        close = comprador
    )]
    pub boveda: Account<'info, Boveda>,
}

#[derive(Accounts)]
pub struct Aceptar<'info> {
    #[account(mut)]
    pub comprador: Signer<'info>,
    #[account(
        mut,
        has_one = comprador @ ErrorEscrow::CompradorNoAutorizado,
        has_one = vendedor
    )]
    pub orden: Account<'info, Orden>,
    #[account(mut)]
    pub vendedor: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"boveda", orden.key().as_ref()],
        bump,
        has_one = orden,
        close = comprador
    )]
    pub boveda: Account<'info, Boveda>,
}

#[account]
pub struct Orden {
    pub vendedor: Pubkey,
    pub comprador: Pubkey,
    pub numero: u64,
    pub precio: u64,
    pub envio: u64,
    pub total: u64,
    pub estado: Estado,
}

impl Orden {
    const TAMANO: usize = 32 + 32 + 8 * 4 + 1;
}

#[account]
pub struct Boveda {
    pub orden: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Estado {
    Pendiente,
    Pagada,
    Completada,
    Enviada,
    Recibida,
    DevolucionSolicitada,
    Reembolsada,
}

#[error_code]
pub enum ErrorEscrow {
    #[msg("El precio debe ser positivo y el total debe caber en u64.")]
    ImporteInvalido,
    #[msg("La operacion no esta permitida en el estado actual.")]
    EstadoInvalido,
    #[msg("El vendedor no puede pagar su propia orden.")]
    CompradorInvalido,
    #[msg("Solo el comprador de la orden puede aceptar la carta.")]
    CompradorNoAutorizado,
}
