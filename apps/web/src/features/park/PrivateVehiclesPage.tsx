import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ParkingOverview, PrivateVehicleView } from '@semh/contracts';
import { useScreen } from '../../shared/api/use-screen';
import { PageBanner } from '../../shared/ui/PageBanner';
import { PrivateVehicleForm } from './PrivateVehicleForm';

export function PrivateVehiclesPage() {
  const [params, setParams] = useSearchParams();
  const [savedPlate, setSavedPlate] = useState('');
  const { data, error, refresh } = useScreen<ParkingOverview>('/parking');
  const adding = params.get('add') === '1';

  function toggleForm() {
    setSavedPlate('');
    setParams(adding ? {} : { add: '1' }, { replace: true });
  }

  function onSaved(vehicle: PrivateVehicleView) {
    setSavedPlate(vehicle.plate);
    setParams({}, { replace: true });
    refresh();
  }

  return (
    <section>
      <PageBanner title="Xe cá nhân" actions={
        <button type="button" className="outline" aria-expanded={adding} onClick={toggleForm}>
          {adding ? 'Đóng biểu mẫu' : 'Thêm xe'}
        </button>
      } />
      <div className="work-stack">
        {savedPlate && <p className="handoff-notice" role="status">Đã lưu xe {savedPlate}.</p>}
        <div className={adding ? 'work-grid' : 'work-stack'}>
          {adding && <section className="work-card">
            <h2>Thêm xe</h2>
            <PrivateVehicleForm onSaved={onSaved} />
          </section>}
          <section className="work-card">
            <h2>Xe đã lưu</h2>
            {error && <>
              <p className="error" role="alert">{error}</p>
              <button type="button" className="outline" onClick={refresh}>Thử lại</button>
            </>}
            {!data && !error && <p role="status">Đang tải danh sách xe…</p>}
            {data && (data.vehicles.length > 0 ? (
              <ul className="work-list" role="list">
                {data.vehicles.map(vehicle => <li key={vehicle.id}>{vehicle.plate}</li>)}
              </ul>
            ) : <p>Bạn chưa lưu xe cá nhân.</p>)}
          </section>
        </div>
      </div>
    </section>
  );
}
