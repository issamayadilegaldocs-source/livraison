import { dessinerIcone } from '@/lib/icone';

export const dynamic = 'force-static'; // construite au build avec le livreur du client
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return dessinerIcone(size.width);
}
