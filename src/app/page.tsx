'use client'

import { LabProvider } from '@/lib/lab/LabProvider'
import { LabWorkspace } from '@/components/lab/LabWorkspace'
import { LabBootstrap } from '@/components/lab/LabBootstrap'
import { OnboardingTour } from '@/components/lab/OnboardingTour'
import { GuestBanner } from '@/components/layout/GuestBanner'

export default function LabPage() {
  return (
    <LabProvider>
      <GuestBanner />
      <LabBootstrap />
      <LabWorkspace />
      <OnboardingTour />
    </LabProvider>
  )
}
