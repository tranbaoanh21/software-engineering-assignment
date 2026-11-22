import { ForbiddenException } from '@nestjs/common';
import type { SessionView } from '@semh/contracts';

export function canOperateAt(session: SessionView, hubId: string | null) {
  return session.roles.includes('OPR') && (session.operatorHubIds === null || (hubId !== null && session.operatorHubIds?.includes(hubId) === true));
}

export function assertOperatorHubs(session: SessionView, ...hubIds: (string | null)[]) {
  if (!hubIds.every(hubId => canOperateAt(session, hubId))) throw new ForbiddenException('Bạn không có quyền vận hành Hub này.');
}
