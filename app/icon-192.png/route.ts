import { dessinerIcone } from '@/lib/icone';

export const dynamic = 'force-static'; // icône 192 px du manifest (Chrome l'exige pour proposer l'installation)

export function GET() {
  return dessinerIcone(192);
}
