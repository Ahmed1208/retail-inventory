import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { buttonVariants } from '@/components/ui/button'
import { CloudRequestForm } from '@/components/home/CloudRequestForm'
import { cn } from '@/lib/utils'

const DOWNLOAD_ZIP_URL =
  'https://github.com/Ahmed1208/retail-inventory/archive/refs/heads/develop.zip'

type ShopOs = 'windows' | 'mac' | 'linux'

function detectShopOs(): ShopOs {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent.toLowerCase()
  const plat = (navigator.platform || '').toLowerCase()
  if (ua.includes('win') || plat.includes('win')) return 'windows'
  if (ua.includes('mac') || plat.includes('mac')) return 'mac'
  return 'linux'
}

const OS_TABS: { id: ShopOs; labelKey: 'osWindows' | 'osMac' | 'osLinux' }[] = [
  { id: 'windows', labelKey: 'osWindows' },
  { id: 'mac', labelKey: 'osMac' },
  { id: 'linux', labelKey: 'osLinux' },
]

const OS_COPY: Record<
  ShopOs,
  {
    step1: 'setupStep1BodyWindows' | 'setupStep1BodyMac' | 'setupStep1BodyLinux'
    afterStep1:
      | 'setupAfterStep1BodyWindows'
      | 'setupAfterStep1BodyMac'
      | 'setupAfterStep1BodyLinux'
    start: 'cmdStartWindows' | 'cmdStartMac' | 'cmdStartLinux'
    update: 'cmdUpdateWindows' | 'cmdUpdateMac' | 'cmdUpdateLinux'
  }
> = {
  windows: {
    step1: 'setupStep1BodyWindows',
    afterStep1: 'setupAfterStep1BodyWindows',
    start: 'cmdStartWindows',
    update: 'cmdUpdateWindows',
  },
  mac: {
    step1: 'setupStep1BodyMac',
    afterStep1: 'setupAfterStep1BodyMac',
    start: 'cmdStartMac',
    update: 'cmdUpdateMac',
  },
  linux: {
    step1: 'setupStep1BodyLinux',
    afterStep1: 'setupAfterStep1BodyLinux',
    start: 'cmdStartLinux',
    update: 'cmdUpdateLinux',
  },
}

function CommandBlock({
  label,
  command,
  copyLabel,
  copiedLabel,
}: {
  label?: string
  command: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-[#0c1418]/70">
      {label ? (
        <p className="border-b border-white/10 px-3 py-1.5 text-xs text-teal-100/70">
          {label}
        </p>
      ) : null}
      <div className="relative">
        <pre className="overflow-x-auto p-3 pe-12 text-xs leading-relaxed text-teal-50/90 sm:text-sm">
          <code>{command}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-teal-100/80 transition hover:bg-white/10 hover:text-white"
          aria-label={copyLabel}
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              {copyLabel}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function PlanCard({
  badge,
  title,
  body,
  points,
  featured,
  children,
}: {
  badge: string
  title: string
  body: string
  points: string[]
  featured?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border p-6 sm:p-8',
        featured
          ? 'border-teal-400/40 bg-teal-500/[0.07]'
          : 'border-white/10 bg-white/[0.03]',
      )}
    >
      <span
        className={cn(
          'inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
          featured
            ? 'bg-teal-500 text-[#04201c]'
            : 'bg-white/10 text-teal-100/80',
        )}
      >
        {badge}
      </span>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-teal-100/75">{body}</p>
      <ul className="mt-6 space-y-3">
        {points.map((point) => (
          <li key={point} className="flex gap-3 text-sm text-teal-100/70">
            <Check className="mt-0.5 size-4 shrink-0 text-teal-400" aria-hidden />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:items-center">
        {children}
      </div>
    </div>
  )
}

export function HomePage() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const { toggleLanguage, isRTL } = useLanguage()
  const [shopOs, setShopOs] = useState<ShopOs>(detectShopOs)
  const osCopy = OS_COPY[shopOs]

  useEffect(() => {
    document.title = t('home.pageTitle')
    return () => {
      document.title = 'StockPilot'
    }
  }, [t])

  const authHref = !loading && session ? '/app' : '/login'
  const authLabel = !loading && session ? t('home.openApp') : t('home.login')

  const downloadClass = cn(
    buttonVariants({ size: 'default' }),
    'bg-teal-500 text-[#04201c] hover:bg-teal-400',
  )
  const downloadClassLg = cn(
    buttonVariants({ size: 'lg', variant: 'outline' }),
    'border-white/25 bg-transparent text-teal-50 hover:bg-white/10 hover:text-white',
  )

  return (
    <div className="home-page min-h-screen bg-[#071114] text-[#e8f4f2]">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-8">
        <span className="sr-only">StockPilot</span>
        <button
          type="button"
          onClick={toggleLanguage}
          className="rounded-md px-3 py-1.5 text-sm text-teal-100/80 transition hover:bg-white/10 hover:text-white"
        >
          {t('home.langToggle')}
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to={authHref}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'border-white/20 bg-transparent text-teal-50 hover:bg-white/10 hover:text-white',
            )}
          >
            {authLabel}
          </Link>
          <a
            href={DOWNLOAD_ZIP_URL}
            className={downloadClass}
            download
          >
            {t('home.downloadNow')}
          </a>
        </div>
      </header>

      <section className="home-hero relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-5 pb-16 pt-24 sm:px-8 sm:pb-20 lg:justify-center lg:pb-24">
        <div className="home-hero-visual pointer-events-none absolute inset-0" aria-hidden>
          <div className="home-hero-gradient absolute inset-0" />
          <div className="home-hero-shelves absolute inset-0" />
          <div className="home-hero-glow absolute -end-24 top-1/4 size-[28rem] rounded-full bg-teal-400/20 blur-3xl" />
          <div className="home-hero-glow-delayed absolute -start-16 bottom-0 size-[22rem] rounded-full bg-cyan-600/15 blur-3xl" />
        </div>

        <div
          className={cn(
            'home-hero-copy relative z-10 max-w-2xl',
            isRTL ? 'ms-auto text-right' : 'me-auto text-left',
          )}
        >
          <p className="home-brand text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {isRTL ? (
              <>
                <span className="block">{t('home.brandAr')}</span>
                <span className="mt-1 block text-[0.55em] font-medium tracking-wide text-teal-100/80">
                  StockPilot
                </span>
              </>
            ) : (
              <>
                <span className="block">StockPilot</span>
                <span className="mt-1 block text-[0.55em] font-medium tracking-wide text-teal-100/80">
                  {t('home.brandAr')}
                </span>
              </>
            )}
          </p>
          <h1 className="home-headline mt-6 max-w-xl text-xl font-medium leading-snug text-teal-50/95 sm:text-2xl">
            {t('home.headline')}
          </h1>
          <p className="home-support mt-4 max-w-lg text-base leading-relaxed text-teal-100/70 sm:text-lg">
            {t('home.support')}
          </p>
          <div className="home-ctas mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={authHref}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-teal-500 text-[#04201c] hover:bg-teal-400',
              )}
            >
              {authLabel}
            </Link>
            <a href={DOWNLOAD_ZIP_URL} className={downloadClassLg} download>
              {t('home.downloadNow')}
            </a>
            <a href="#services" className={downloadClassLg}>
              {t('home.seePlans')}
            </a>
          </div>
        </div>
      </section>

      <main className="relative z-10 border-t border-white/10 bg-[#0a1619]">
        <section className="home-section mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {t('home.whatTitle')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-teal-100/75 sm:text-lg">
            {t('home.whatBody')}
          </p>
        </section>

        <section className="home-section border-t border-white/10 bg-[#081215]">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t('home.whoTitle')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-teal-100/75 sm:text-lg">
              {t('home.whoBody')}
            </p>
          </div>
        </section>

        <section
          id="services"
          className="home-section scroll-mt-8 border-t border-white/10"
        >
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t('home.servicesTitle')}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-teal-100/75 sm:text-lg">
              {t('home.servicesIntro')}
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <PlanCard
                badge={t('home.freePlanBadge')}
                title={t('home.freePlanTitle')}
                body={t('home.freePlanBody')}
                points={[
                  t('home.freePoint1'),
                  t('home.freePoint2'),
                  t('home.freePoint3'),
                  t('home.freePoint4'),
                ]}
              >
                <a href={DOWNLOAD_ZIP_URL} className={downloadClass} download>
                  {t('home.downloadNow')}
                </a>
                <a
                  href="#setup"
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'border-white/20 bg-transparent text-teal-50 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {t('home.freePlanCta')}
                </a>
              </PlanCard>

              <PlanCard
                featured
                badge={t('home.cloudPlanBadge')}
                title={t('home.cloudPlanTitle')}
                body={t('home.cloudPlanBody')}
                points={[
                  t('home.cloudPoint1'),
                  t('home.cloudPoint2'),
                  t('home.cloudPoint3'),
                  t('home.cloudPoint4'),
                ]}
              >
                <a href="#cloud-request" className={downloadClass}>
                  {t('home.cloudPlanCta')}
                </a>
              </PlanCard>
            </div>
          </div>
        </section>

        <section
          id="setup"
          className="home-section scroll-mt-8 border-t border-white/10 bg-[#081215]"
        >
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
            <span className="inline-flex w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-teal-100/80">
              {t('home.freePlanBadge')}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t('home.setupTitle')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-teal-100/75 sm:text-lg">
              {t('home.setupIntro')}
            </p>
            <p className="mt-3 text-sm text-teal-100/55">{t('home.osHint')}</p>
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="tablist"
              aria-label={t('home.osHint')}
            >
              {OS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={shopOs === tab.id}
                  onClick={() => setShopOs(tab.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition',
                    shopOs === tab.id
                      ? 'bg-teal-500 text-[#04201c]'
                      : 'border border-white/20 text-teal-100/80 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {t(`home.${tab.labelKey}`)}
                </button>
              ))}
            </div>

            <h3 className="mt-12 text-xl font-semibold tracking-tight text-teal-50">
              {t('home.standaloneHeading')}
            </h3>
            <ol className="mt-8 space-y-12">
              <li>
                <h4 className="text-lg font-semibold text-teal-50">
                  {t('home.setupStep1Title')}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                  {t(`home.${osCopy.step1}`)}
                </p>
                <CommandBlock
                  command={t('home.cmdDockerCheck')}
                  copyLabel={t('home.copy')}
                  copiedLabel={t('home.copied')}
                />
              </li>

              <li>
                <h4 className="text-lg font-semibold text-teal-50">
                  {t('home.setupStep2Title')}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                  {t('home.setupStep2Body')}
                </p>
              </li>

              <li>
                <h4 className="text-lg font-semibold text-teal-50">
                  {t('home.setupStep3Title')}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                  {t('home.setupStep3Body')}
                </p>
                {shopOs === 'linux' ? (
                  <>
                    <p className="mt-3 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                      {t('home.setupStep3LinuxHint')}
                    </p>
                    <CommandBlock
                      command={t('home.cmdChmodLinux')}
                      copyLabel={t('home.copy')}
                      copiedLabel={t('home.copied')}
                    />
                  </>
                ) : (
                  <CommandBlock
                    command={t(`home.${osCopy.start}`)}
                    copyLabel={t('home.copy')}
                    copiedLabel={t('home.copied')}
                  />
                )}
                <p className="mt-3 text-sm text-teal-100/55">
                  {t('home.setupStep3Options')}
                </p>
                <p className="mt-2 text-sm text-teal-100/55">
                  {t('home.setupStep3NpmHint')}
                </p>
                <CommandBlock
                  command={t('home.cmdSetup')}
                  copyLabel={t('home.copy')}
                  copiedLabel={t('home.copied')}
                />
                <p className="mt-4 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                  {t('home.setupStep3FreshHint')}
                </p>
                <CommandBlock
                  command={t('home.cmdFresh')}
                  copyLabel={t('home.copy')}
                  copiedLabel={t('home.copied')}
                />
              </li>

              <li>
                <h4 className="text-lg font-semibold text-teal-50">
                  {t('home.setupStep4Title')}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                  {t('home.setupStep4Body')}
                </p>
                <p className="mt-3 text-sm text-teal-100/55">
                  {t('home.setupStep4ServeHint')}
                </p>
                <CommandBlock
                  command={t('home.cmdServe')}
                  copyLabel={t('home.copy')}
                  copiedLabel={t('home.copied')}
                />
              </li>
            </ol>

            <div className="mt-16 border-t border-white/10 pt-10">
              <h3 className="text-xl font-semibold tracking-tight text-teal-50">
                {t('home.setupAfterTitle')}
              </h3>
              <ol className="mt-8 space-y-12">
                <li>
                  <h4 className="text-lg font-semibold text-teal-50">
                    {t('home.setupAfterStep1Title')}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                    {t(`home.${osCopy.afterStep1}`)}
                  </p>
                </li>
                <li>
                  <h4 className="text-lg font-semibold text-teal-50">
                    {t('home.setupAfterStep2Title')}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                    {t('home.setupAfterStep2Body')}
                  </p>
                </li>
                <li>
                  <h4 className="text-lg font-semibold text-teal-50">
                    {t('home.setupAfterStep3Title')}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                    {t('home.setupAfterStep3Body')}
                  </p>
                  <CommandBlock
                    command={t(`home.${osCopy.start}`)}
                    copyLabel={t('home.copy')}
                    copiedLabel={t('home.copied')}
                  />
                </li>
                <li>
                  <h4 className="text-lg font-semibold text-teal-50">
                    {t('home.setupAfterStep4Title')}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                    {t('home.setupAfterStep4Body')}
                  </p>
                  <CommandBlock
                    command={t(`home.${osCopy.update}`)}
                    copyLabel={t('home.copy')}
                    copiedLabel={t('home.copied')}
                  />
                </li>
                <li>
                  <h4 className="text-lg font-semibold text-teal-50">
                    {t('home.setupAfterStep5Title')}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-teal-100/70 sm:text-base">
                    {t('home.setupAfterStep5Body')}
                  </p>
                  <CommandBlock
                    command={t('home.cmdBackup')}
                    copyLabel={t('home.copy')}
                    copiedLabel={t('home.copied')}
                  />
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section
          id="cloud-request"
          className="home-section scroll-mt-8 border-t border-white/10"
        >
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
            <span className="inline-flex w-fit rounded-full bg-teal-500 px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#04201c]">
              {t('home.cloudPlanBadge')}
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t('home.requestTitle')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-teal-100/75 sm:text-lg">
              {t('home.requestIntro')}
            </p>
            <CloudRequestForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-teal-100/40 sm:px-8">
        StockPilot
      </footer>
    </div>
  )
}
