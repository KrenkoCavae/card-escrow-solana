export interface Carta {
  id: number;
  nombre: string;
  imagen: string;
}

export const CARTAS: Carta[] = [
  {
    id: 1,
    nombre: 'Guardián Aurora',
    imagen: '/cartas/guardian-aurora.jpg',
  },
  {
    id: 2,
    nombre: 'Dragón de Ceniza',
    imagen: '/cartas/dragon-ceniza.jpg',
  },
  {
    id: 3,
    nombre: 'Hechicera del Vacío',
    imagen: '/cartas/hechicera-vacio.jpg',
  },
  {
    id: 4,
    nombre: 'Caballero de Hierro',
    imagen: '/cartas/caballero-hierro.jpg',
  },
  {
    id: 5,
    nombre: 'Espíritu del Bosque',
    imagen: '/cartas/espiritu-bosque.jpg',
  },
];

export function obtenerCarta(id: number): Carta | undefined {
  return CARTAS.find(c => c.id === id);
}
