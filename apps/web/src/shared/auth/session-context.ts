import { createContext } from 'react';
import type { SessionView } from '@semh/contracts';

export const SessionContext = createContext<SessionView | null>(null);
