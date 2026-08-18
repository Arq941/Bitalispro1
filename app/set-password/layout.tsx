import {Suspense} from 'react';
export default function SetPasswordLayout({children}:{children:React.ReactNode}){return <Suspense fallback={<main className="p-6 text-center">Cargando…</main>}>{children}</Suspense>}
