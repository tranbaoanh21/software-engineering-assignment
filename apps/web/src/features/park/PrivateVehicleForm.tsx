import type { FormEvent } from 'react';
import type { PrivateVehicleView, RegisterPrivateVehicleInput } from '@semh/contracts';
import { field, useCommand } from '../../shared/api/use-screen';

interface Props {
  vehicle?: PrivateVehicleView;
  onSaved: (vehicle: PrivateVehicleView) => void;
}

export function PrivateVehicleForm({ vehicle, onSaved }: Props) {
  const action = useCommand();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const battery = field(data, 'batteryPercent');
    const input: RegisterPrivateVehicleInput = {
      plate: vehicle?.plate ?? field(data, 'plate'),
      batteryPercent: battery === '' ? null : Number(battery),
    };
    const saved = await action.send<PrivateVehicleView>('/parking/vehicles', input, 'POST', false);
    if (saved) {
      form.reset();
      onSaved(saved);
    }
  }

  return <>
    <form className="work-form" onSubmit={save}>
      {!vehicle && <label>Biển số
        <input name="plate" placeholder="59-X1 123.45" autoCapitalize="characters" spellCheck={false} maxLength={24} required />
      </label>}
      <label>{vehicle ? 'Mức pin hiện tại (%)' : 'Mức pin ban đầu (%) · tùy chọn'}
        <input name="batteryPercent" type="number" min={0} max={100} step={1} required={!!vehicle} />
      </label>
      <button className="primary" disabled={action.pending}>{vehicle ? 'Lưu mức pin' : 'Lưu xe'}</button>
    </form>
    {action.error && <p className="error" role="alert">{action.error}</p>}
  </>;
}
