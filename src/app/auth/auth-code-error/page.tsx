import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="dl-panel p-5">
        <div className="flex items-center gap-2 text-signal-error">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <h1 className="text-base font-semibold">No hemos podido iniciar sesion</h1>
        </div>
        <p className="mt-2 text-sm text-ink-400">
          El enlace de acceso no es valido o ha caducado. Vuelve a intentarlo o usa otro metodo de
          acceso.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/auth/sign-in"
            className="rounded-md border border-line-strong bg-carbon-800 px-3 py-1.5 text-xs font-medium text-ink-100 transition-colors hover:bg-carbon-700"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-electric-300 transition-colors hover:bg-carbon-800"
          >
            Volver al laboratorio
          </Link>
        </div>
      </div>
    </div>
  )
}
