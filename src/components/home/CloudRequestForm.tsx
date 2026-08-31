import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'

const CONTACT_EMAIL = 'ahmedhoss14@gmail.com'
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit'
const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY as
  | string
  | undefined

const cloudRequestSchema = z.object({
  business: z.string().trim().min(2, 'home.requestValidationBusiness'),
  email: z.email('home.requestValidationEmail'),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{6,}$/, 'home.requestValidationPhone'),
  botcheck: z.boolean(),
})

type CloudRequestValues = z.infer<typeof cloudRequestSchema>

const fieldClass =
  'mt-1 border-white/15 bg-white/5 text-teal-50 placeholder:text-teal-100/35 focus-visible:ring-teal-400 focus-visible:ring-offset-[#081215]'

export function CloudRequestForm() {
  const { t } = useTranslation()
  const { currentLanguage } = useLanguage()

  const form = useForm<CloudRequestValues>({
    resolver: zodResolver(cloudRequestSchema) as Resolver<CloudRequestValues>,
    defaultValues: { business: '', email: '', phone: '', botcheck: false },
  })

  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: CloudRequestValues) {
    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject: `StockPilot cloud request - ${values.business}`,
          from_name: 'StockPilot landing page',
          replyto: values.email,
          botcheck: values.botcheck,
          business_name: values.business,
          email: values.email,
          phone: values.phone,
          language: currentLanguage,
        }),
      })
      const json: { success?: boolean; message?: string } = await res.json()
      if (!json.success) throw new Error(json.message)
      toast.success(t('home.requestSuccess'))
      form.reset()
    } catch (e) {
      console.error('Cloud request submission failed', e)
      toast.error(t('home.requestError'))
    }
  }

  // Self-hosted builds have no access key baked in; fall back to a plain mail link
  // so the call to action is never a dead button.
  if (!accessKey) {
    return (
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('StockPilot cloud service request')}`}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'mt-8 bg-teal-500 text-[#04201c] hover:bg-teal-400',
        )}
      >
        {t('home.requestEmailUs')}
      </a>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mt-8 max-w-md space-y-5"
      noValidate
    >
      <div>
        <Label htmlFor="cloud-request-business" className="text-teal-50">
          {t('home.requestBusiness')}
        </Label>
        <Input
          id="cloud-request-business"
          className={fieldClass}
          placeholder={t('home.requestBusinessPlaceholder')}
          autoComplete="organization"
          aria-required
          aria-invalid={!!errors.business}
          {...form.register('business')}
        />
        {errors.business && (
          <p className="mt-1 text-sm text-amber-300" role="alert">
            {t(errors.business.message!)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="cloud-request-email" className="text-teal-50">
          {t('home.requestEmail')}
        </Label>
        <Input
          id="cloud-request-email"
          type="email"
          className={fieldClass}
          placeholder={t('home.requestEmailPlaceholder')}
          autoComplete="email"
          aria-required
          aria-invalid={!!errors.email}
          {...form.register('email')}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-amber-300" role="alert">
            {t(errors.email.message!)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="cloud-request-phone" className="text-teal-50">
          {t('home.requestPhone')}
        </Label>
        <Input
          id="cloud-request-phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          className={fieldClass}
          placeholder={t('home.requestPhonePlaceholder')}
          autoComplete="tel"
          aria-required
          aria-invalid={!!errors.phone}
          {...form.register('phone')}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-amber-300" role="alert">
            {t(errors.phone.message!)}
          </p>
        )}
      </div>

      <input
        type="checkbox"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        {...form.register('botcheck')}
      />

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="bg-teal-500 text-[#04201c] hover:bg-teal-400"
      >
        {isSubmitting ? t('home.requestSubmitting') : t('home.requestSubmit')}
      </Button>

      <p className="text-sm text-teal-100/55">{t('home.requestPrivacy')}</p>
    </form>
  )
}
