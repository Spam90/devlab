import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/AuthForm'

export const metadata: Metadata = {
  title: 'Iniciar sesion',
}

export default function SignInPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10">
      <AuthForm mode="sign-in" />
    </div>
  )
}
