import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ParkingOverview, PrivateVehicleView } from '@semh/contracts';
import { useCommand, useScreen } from '../../shared/api/use-screen';
import { PageBanner } from '../../shared/ui/PageBanner';
import { VehiclePlate } from '../../shared/ui/VehicleVisual';
import { PrivateVehicleForm } from './PrivateVehicleForm';
import './private-vehicles.css';

function RemoveVehicleDialog({ vehicle, onDismiss, onRemoved }: {
  vehicle: PrivateVehicleView;
  onDismiss: () => void;
  onRemoved: (vehicle: PrivateVehicleView) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = useCommand();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function remove() {
    const result = await action.send<{ id: string }>('/parking/vehicles/' + vehicle.id, {}, 'DELETE', false);
    if (result) onRemoved(vehicle);
  }

  return (
    <dialog className="work-card private-vehicle-dialog" ref={dialogRef} aria-labelledby="remove-vehicle-title"
      onCancel={event => {
        event.preventDefault();
        if (!action.pending) onDismiss();
      }}>
      <h2 id="remove-vehicle-title">Xóa xe {vehicle.plate}?</h2>
      <p>Xe sẽ được gỡ khỏi danh sách của bạn. Lịch sử đặt chỗ đỗ và sạc vẫn được lưu.</p>
      {action.error && <p className="error" role="alert">{action.error}</p>}
      <div className="work-actions">
        <button type="button" className="outline" disabled={action.pending} onClick={onDismiss} autoFocus>Giữ xe</button>
        <button type="button" className="danger" disabled={action.pending} onClick={() => void remove()}>
          {action.pending ? 'Đang xóa…' : 'Xóa xe'}
        </button>
      </div>
    </dialog>
  );
}

export function PrivateVehiclesPage() {
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<PrivateVehicleView>();
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
  const { data, error, refresh } = useScreen<ParkingOverview>('/parking');
  const adding = params.get('add') === '1';
  const vehicles = data?.vehicles.filter(vehicle => !removedIds.has(vehicle.id));

  function toggleForm() {
    setNotice('');
    setParams(adding ? {} : { add: '1' }, { replace: true });
  }

  function onSaved(vehicle: PrivateVehicleView) {
    setNotice('Đã lưu xe ' + vehicle.plate + '.');
    setParams({}, { replace: true });
    refresh();
  }

  function onRemoved(vehicle: PrivateVehicleView) {
    setRemoving(undefined);
    setRemovedIds(ids => new Set(ids).add(vehicle.id));
    setNotice('Đã xóa xe ' + vehicle.plate + '.');
    refresh();
  }

  return (
    <section>
      <PageBanner title="Xe cá nhân" actions={
        <button type="button" className={adding ? 'outline' : 'primary'} aria-expanded={adding} onClick={toggleForm}>
          {adding ? 'Đóng biểu mẫu' : 'Thêm xe'}
        </button>
      } />
      <div className="work-stack">
        {notice && <p className="handoff-notice" role="status">{notice}</p>}
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
            {vehicles && (vehicles.length > 0 ? (
              <ul className="work-list" role="list">
                {vehicles.map(vehicle => <li key={vehicle.id}>
                  <div className="private-vehicle-identity">
                    <span className="muted">Biển số</span>
                    <VehiclePlate code={vehicle.plate} />
                  </div>
                  <button type="button" className="quiet-action quiet-action-destructive"
                    aria-label={'Xóa xe ' + vehicle.plate} onClick={() => setRemoving(vehicle)}>
                    Xóa
                  </button>
                </li>)}
              </ul>
            ) : <p>Bạn chưa lưu xe cá nhân.</p>)}
          </section>
        </div>
      </div>
      {removing && <RemoveVehicleDialog vehicle={removing} onDismiss={() => setRemoving(undefined)} onRemoved={onRemoved} />}
    </section>
  );
}
