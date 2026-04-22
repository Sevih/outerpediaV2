import { loadMessages } from '@/i18n'
import { I18nProvider } from '@/lib/contexts/I18nContext'
import Client from './Client'

export default async function Page() {
  const messages = await loadMessages('en')
  return (
    <I18nProvider lang="en" messages={messages}>
      <Client />
    </I18nProvider>
  )
}
