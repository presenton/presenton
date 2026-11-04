'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import ChatGptAuthRedirectHandler from './ChatGptAuthRedirectHandler';
import MotionPreferences from '@/components/motion/MotionPreferences';

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>
      <MotionPreferences />
      <ChatGptAuthRedirectHandler />
      {children}
  </Provider>;
}
