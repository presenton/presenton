'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import ChatGptAuthRedirectHandler from './ChatGptAuthRedirectHandler';
import { I18nProvider } from '@/i18n/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>
    <I18nProvider>
      <ChatGptAuthRedirectHandler />
      {children}
    </I18nProvider>
  </Provider>;
}
