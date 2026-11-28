import { useId, type FormEvent } from 'react';
import { formatPrivateVehiclePlate, type PrivateVehicleView, type RegisterPrivateVehicleInput } from '@semh/contracts';
import { field, useCommand } from '../../shared/api/use-screen';

interface Props {
  vehicle?: PrivateVehicleView;
  onSaved: (vehicle: PrivateVehicleView) => void;
}

export function PrivateVehicleForm({ vehicle, onSaved }: Props) {
  const action = useCommand();
  const plateHintId = useId();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const plate = vehicle?.plate ?? formatPrivateVehiclePlate(field(data, 'plate'));
    if (!plate) {
      const input = form.elements.namedItem('plate');
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity('Nhập biển số theo mẫu 59-X1 1234 hoặc 59-X1 123.45.');
        input.reportValidity();
      }
      return;
    }
    const battery = field(data, 'batteryPercent');
    const input: RegisterPrivateVehicleInput = {
      plate,
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
        <input name="plate" placeholder="59-X1 123.45" autoCapitalize="characters" autoComplete="off" spellCheck={false}
          maxLength={24} required aria-describedby={plateHintId}
          onInput={event => event.currentTarget.setCustomValidity('')}
          onBlur={event => {
            const input = event.currentTarget;
            input.value = formatPrivateVehiclePlate(input.value) ?? input.value;
          }} />
        <small id={plateHintId} className="muted">Ví dụ 59-X1 1234 hoặc 59-X1 123.45. Có thể nhập liền không dấu.</small>
      </label>}
      <label>{vehicle ? 'Mức pin hiện tại (%)' : 'Mức pin ban đầu (%) · tùy chọn'}
        <input name="batteryPercent" type="number" min={0} max={100} step={1} required={!!vehicle} />
      </label>
      <button className="primary" disabled={action.pending}>{vehicle ? 'Lưu mức pin' : 'Lưu xe'}</button>
    </form>
    {action.error && <p className="error" role="alert">{action.error}</p>}
  </>;
}
