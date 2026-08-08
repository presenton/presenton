'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import ChatGptAuthRedirectHandler from './ChatGptAuthRedirectHandler';

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>
      <ChatGptAuthRedirectHandler />
      {children}
  </Provider>;
}
