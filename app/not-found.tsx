import { T } from '@/lib/i18n';

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center p-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">
          <T k="Page introuvable" />
        </h1>
        <p className="mt-2 text-stone-600">
          <T k="Ce site de livraison ou cette page n’existe pas." />
        </p>
      </div>
    </div>
  );
}
