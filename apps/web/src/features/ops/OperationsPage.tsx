import { useLocation, useSearchParams } from 'react-router';
import type { IncidentView, NetworkHub, PlanView } from '@semh/contracts';
import { operationViews } from '../../app/navigation';
import { PageBanner } from '../../shared/ui/PageBanner';
import { useScreen } from '../../shared/api/use-screen';
import { ResourceCatalog } from './ResourceCatalog';
import { OperationsOverview } from './OperationsOverview';
import { IncidentPanel, type Technician } from './IncidentPanel';
import { TransferPanel, type TransferDraft } from './TransferPanel';

interface Overview { hubs: NetworkHub[]; incidents: IncidentView[]; plans: PlanView[]; technicians: Technician[] }

export function OperationsPage() {
  const maintenance = useLocation().pathname.startsWith('/maintenance');
  const [params] = useSearchParams();
  const view = params.get('tab');
  const tab = view === 'incidents' || view === 'plans' || view === 'resources' ? view : 'overview';
  const draftId = params.get('run');
  const recId = params.get('rec');
  const review = useScreen<TransferDraft>(draftId && recId ?
    '/simulations/runs/' + encodeURIComponent(draftId) + '/recommendations/' + encodeURIComponent(recId) + '/draft' : '');
  const screen = useScreen<Overview>(maintenance ? '/operations/maintenance' : '/operations', 8000);
  const publicHubs = useScreen<NetworkHub[]>(maintenance ? '/network/hubs' : '');
  const { data } = screen;
  return <section>
    {maintenance ? <PageBanner title="Công việc kỹ thuật của tôi" />
      : tab !== 'overview' && <header className="page-heading"><h1>{operationViews.find(item => item.key === tab)?.title}</h1></header>}
    {screen.error && <p className="error" role="alert">{screen.error}</p>}
    {!data && !screen.error && <p role="status">Đang tải dữ liệu…</p>}
    {data && (maintenance ? <IncidentPanel incidents={data.incidents} hubs={publicHubs.data ?? []}
      technicians={[]} maintenance refresh={screen.refresh} /> : <>
      {tab === 'overview' && <OperationsOverview hubs={data.hubs} refresh={screen.refresh} />}
      {tab === 'incidents' && <IncidentPanel incidents={data.incidents} hubs={data.hubs} technicians={data.technicians} refresh={screen.refresh} />}
      {tab === 'plans' && <>
        {review.error && <p className="error" role="alert">{review.error}</p>}
        <TransferPanel key={review.data?.recommendationId ?? 'manual'} hubs={data.hubs} plans={data.plans}
          prefilled={draftId ? review.data : undefined} refresh={screen.refresh} />
      </>}
      {tab === 'resources' && <ResourceCatalog hubs={data.hubs} refresh={screen.refresh} />}
    </>)}
  </section>;
}
