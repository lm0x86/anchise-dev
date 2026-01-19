import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;
  
  // Then try Accept-Language header
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  const browserLocale = acceptLanguage?.split(',')[0]?.split('-')[0];
  
  // Determine locale
  let locale: Locale = defaultLocale;
  
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  } else if (browserLocale && locales.includes(browserLocale as Locale)) {
    locale = browserLocale as Locale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});

